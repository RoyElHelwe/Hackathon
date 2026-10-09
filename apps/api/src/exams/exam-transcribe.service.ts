import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AiService } from '../ai/ai.service';
import { transcribeAnswer } from '../ai/tasks';
import { AuthContext } from '../common/auth-context';
import { config } from '../config';
import { FfmpegMediaTools } from '../courses/media-tools';
import { ExamRoomService } from './exam-room.service';

/** a spoken answer is short: 2 MB of opus is several minutes, 60 s is plenty */
export const MAX_ANSWER_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_ANSWER_SEC = 60;
const AUDIO_MIME = /^audio\/(webm|ogg|mp4|mpeg|wav|x-wav|aac|x-m4a|m4a)(;.*)?$/;

export interface AnswerAudio {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/**
 * VR exam: the Quest browser may have no speech recognition, so the headset records the spoken answer and Tajriba
 * turns it into text. The student sees the text and sends it with the normal /answer call (nothing is graded here,
 * nothing is stored — the exam recording already keeps the audio).
 */
@Injectable()
export class ExamTranscribeService {
  private readonly logger = new Logger('ExamTranscribe');
  /** min gap between two transcriptions of the same attempt (overridable in tests) */
  gapMs = 2_000;
  private readonly last = new Map<string, number>();
  private readonly ffmpeg = new FfmpegMediaTools();

  constructor(
    private readonly room: ExamRoomService,
    private readonly ai: AiService,
  ) {}

  async transcribe(a: AuthContext, attemptId: string, file: AnswerAudio | undefined): Promise<{ text: string }> {
    const att = await this.room.runningAttempt(a, attemptId);
    if (!file?.size) throw new BadRequestException({ message: 'No audio received.', code: 'NO_AUDIO' });
    if (!AUDIO_MIME.test(file.mimetype)) throw new BadRequestException({ message: 'This is not an audio clip.', code: 'NOT_AUDIO' });
    this.throttle(att.id);

    const clipId = createHash('sha256').update(file.buffer).digest('hex');
    const input = { locale: att.exam.locale || 'en', clipId };
    // the mock AI (tests, demo without a key) needs no audio
    if (config.AI_PROVIDER === 'mock') return this.ai.run(transcribeAnswer, input);

    const dir = await mkdtemp(join(tmpdir(), 'tj-answer-'));
    try {
      const src = join(dir, `${randomUUID()}.webm`);
      const mp3 = join(dir, `${randomUUID()}.mp3`);
      await writeFile(src, file.buffer);
      await this.ffmpeg.extractAudio(src, mp3, MAX_ANSWER_SEC);
      const data = (await readFile(mp3)).toString('base64');
      return await this.ai.run(transcribeAnswer, input, { media: [{ type: 'input_audio', input_audio: { data, format: 'mp3' } }] });
    } catch (e) {
      this.logger.warn(`transcription failed: ${e instanceof Error ? e.message.slice(0, 160) : e}`);
      throw new ServiceUnavailableException({ message: "Arzino couldn't hear that — try again or type your answer.", code: 'AI_UNAVAILABLE' });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** tests: forget previous calls */
  resetThrottle() {
    this.last.clear();
  }

  private throttle(attemptId: string) {
    const now = Date.now();
    const prev = this.last.get(attemptId);
    if (prev && now - prev < this.gapMs) throw new HttpException({ message: 'One answer at a time.', code: 'TOO_SOON' }, HttpStatus.TOO_MANY_REQUESTS);
    this.last.set(attemptId, now);
    if (this.last.size > 2_000) for (const [k, t] of this.last) if (now - t > this.gapMs) this.last.delete(k);
  }
}
