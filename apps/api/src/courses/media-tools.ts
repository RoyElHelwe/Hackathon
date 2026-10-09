import { spawn } from "node:child_process";
import { copyFile, stat } from "node:fs/promises";

/**
 * ffmpeg/ffprobe (+ a YouTube availability check) behind a seam so tests never need the binaries or the network.
 * Every command runs with a hard timeout; callers own the temp files and delete them.
 */
export interface MediaTools {
  readonly kind: "ffmpeg" | "fake";
  /** duration (seconds, 0 when unknown) and size (bytes) of a local media file */
  probe(file: string): Promise<{ durationSec: number; bytes: number }>;
  /** small "study copy": max 480px wide, 1 fps, h264 crf 32, mono AAC 32k, keyframe every 30 s; first maxSec seconds */
  transcodeStudy(input: string, output: string, maxSec: number): Promise<void>;
  /** audio only: mono 16 kHz mp3 at 24 kbps; first maxSec seconds */
  extractAudio(input: string, output: string, maxSec: number): Promise<void>;
  /** stream-copies [startSec, startSec + lenSec) of input into output (same container/codecs) */
  cut(
    input: string,
    output: string,
    startSec: number,
    lenSec: number,
  ): Promise<void>;
  /** public/unlisted → 'ok'; private/removed → 'unavailable'; network trouble → 'unknown' (try anyway) */
  youtubeStatus(videoId: string): Promise<"ok" | "unavailable" | "unknown">;
}

export const MEDIA_TOOLS = Symbol("MEDIA_TOOLS");

const TRANSCODE_TIMEOUT_MS = 30 * 60 * 1000;
const CUT_TIMEOUT_MS = 2 * 60 * 1000;
const PROBE_TIMEOUT_MS = 30 * 1000;

/** Runs a command with a timeout (SIGKILL); resolves stdout, rejects with the tail of stderr. */
export function run(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      killSignal: "SIGKILL",
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => {
      if (out.length < 64_000) out += d.toString();
    });
    // keep only the tail: ffmpeg is chatty
    child.stderr.on("data", (d: Buffer) => {
      err = (err + d.toString()).slice(-2000);
    });
    child.on("error", reject);
    child.on("close", (code, sig) => {
      if (code === 0) resolve(out);
      else
        reject(
          new Error(
            `${cmd} ${sig ? `killed (${sig})` : `exited ${code}`}: ${err.trim().split("\n").slice(-3).join(" | ")}`,
          ),
        );
    });
  });
}

const sec = (n: number) => String(Math.max(0, Math.round(n * 1000) / 1000));

export class FfmpegMediaTools implements MediaTools {
  readonly kind = "ffmpeg" as const;

  async probe(file: string) {
    const { size } = await stat(file);
    let durationSec = 0;
    try {
      const out = await run(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=nw=1:nk=1",
          file,
        ],
        PROBE_TIMEOUT_MS,
      );
      durationSec = Number.parseFloat(out.trim()) || 0;
    } catch {
      durationSec = 0;
    }
    return { durationSec, bytes: size };
  }

  async transcodeStudy(input: string, output: string, maxSec: number) {
    // -threads 2 keeps ffmpeg's memory small on a 512 MB dyno.
    await run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-threads",
        "2",
        "-i",
        input,
        "-t",
        sec(maxSec),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        "fps=1,scale='min(480,trunc(iw/2)*2)':-2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "32",
        "-g",
        "30",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-ac",
        "1",
        "-b:a",
        "32k",
        "-movflags",
        "+faststart",
        output,
      ],
      TRANSCODE_TIMEOUT_MS,
    );
  }

  async extractAudio(input: string, output: string, maxSec: number) {
    await run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-threads",
        "2",
        "-i",
        input,
        "-t",
        sec(maxSec),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "24k",
        output,
      ],
      TRANSCODE_TIMEOUT_MS,
    );
  }

  async cut(input: string, output: string, startSec: number, lenSec: number) {
    await run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        sec(startSec),
        "-i",
        input,
        "-t",
        sec(lenSec),
        "-map",
        "0",
        "-c",
        "copy",
        "-avoid_negative_ts",
        "make_zero",
        output,
      ],
      CUT_TIMEOUT_MS,
    );
  }

  async youtubeStatus(
    videoId: string,
  ): Promise<"ok" | "unavailable" | "unknown"> {
    try {
      const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) return "ok";
      // oEmbed answers 401/403 for private videos and 404 for removed ones
      return [401, 403, 404].includes(res.status) ? "unavailable" : "unknown";
    } catch {
      return "unknown";
    }
  }
}

/** Test/dev stand-in (CLASSROOM_PROVIDER=fake): "transcoding" copies the file; override methods to simulate more. */
export class FakeMediaTools implements MediaTools {
  readonly kind = "fake" as const;

  async probe(file: string) {
    return { durationSec: 600, bytes: (await stat(file)).size };
  }
  async transcodeStudy(input: string, output: string) {
    await copyFile(input, output);
  }
  async extractAudio(input: string, output: string) {
    await copyFile(input, output);
  }
  async cut(input: string, output: string) {
    await copyFile(input, output);
  }
  async youtubeStatus(
    videoId: string,
  ): Promise<"ok" | "unavailable" | "unknown"> {
    return videoId.includes("private") ? "unavailable" : "ok";
  }
}
