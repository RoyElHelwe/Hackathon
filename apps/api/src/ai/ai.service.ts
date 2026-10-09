import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import sharp from 'sharp';
import { config } from '../config';
import { sha256 } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { TaskDef } from './task';

/** Video part: a YouTube URL (Gemini via AI Studio only) or a base64 data URL (`data:video/mp4;base64,…`). */
export interface VideoPart {
  type: 'video_url';
  video_url: { url: string };
}
/** Audio part (OpenRouter): base64 data only, no URLs. */
export interface AudioPart {
  type: 'input_audio';
  input_audio: { data: string; format: 'mp3' | 'wav' | 'aac' | 'ogg' | 'flac' | 'm4a' | 'aiff' };
}
export type MediaPart = VideoPart | AudioPart;
export type ChatContent = string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } } | MediaPart)[];
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: ChatContent;
}

export interface CompletionResult {
  text: string;
  tokensIn?: number;
  tokensOut?: number;
}

/** Transport for chat completions. Swappable in tests. */
export interface CompletionOptions {
  jsonMode: boolean;
  maxTokens?: number;
  timeoutMs?: number;
  /** OpenRouter provider routing, e.g. { order: ['google-ai-studio'], allow_fallbacks: false } */
  provider?: Record<string, unknown>;
}

export interface AiTransport {
  complete(model: string, messages: ChatMessage[], opts: CompletionOptions): Promise<CompletionResult>;
}

export class OpenRouterTransport implements AiTransport {
  async complete(model: string, messages: ChatMessage[], opts: CompletionOptions): Promise<CompletionResult> {
    const res = await fetch(`${config.OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': config.WEB_URL,
        'X-Title': 'Tajriba',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens ?? config.AI_MAX_TOKENS,
        temperature: 0.4,
        ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        ...(opts.provider ? { provider: opts.provider } : {}),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const err = new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
    };
  }
}

export class AiUnavailableError extends ServiceUnavailableException {
  constructor() {
    super({ message: 'Bousla is thinking too hard right now. Please try again.', code: 'AI_UNAVAILABLE' });
  }
}

/** Extracts the first complete JSON object from a model reply (tolerates code fences and text after the object). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  if (start < 0) throw new Error('No JSON object in reply');
  // scan to the brace that closes the first object, skipping braces inside strings
  let depth = 0;
  let inString = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(raw.slice(start, i + 1));
  }
  throw new Error('Unterminated JSON object in reply (output cut off?)');
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalize(v)]),
    );
  }
  if (typeof value === 'string') return value.trim();
  return value;
}

export interface RunOptions {
  /** already-loaded image buffers (vision tasks) */
  images?: Buffer[];
  /** video/audio parts sent after the prompt. Not hashed: put a stable media identity in the task input instead. */
  media?: MediaPart[];
  /** OpenRouter provider routing (overrides the task's) */
  provider?: Record<string, unknown>;
  /** bypass cache (e.g. "regenerate") */
  fresh?: boolean;
  /** overrides the task's maxTokens (output sized to the input, e.g. number of exam questions) */
  maxTokens?: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger('AI');
  transport: AiTransport = new OpenRouterTransport();
  /** overridable for tests */
  provider: 'openrouter' | 'mock' = config.AI_PROVIDER;
  cacheEnabled = config.AI_CACHE;
  apiKey = config.OPENROUTER_API_KEY;
  models = { fast: config.AI_MODEL_FAST, vision: config.AI_MODEL_VISION };

  constructor(private readonly prisma: PrismaService) {}

  modelFor(kind: 'fast' | 'vision'): string {
    if (this.provider === 'mock') return `mock-${kind}`;
    return (kind === 'vision' ? this.models.vision : this.models.fast) || this.models.fast || this.models.vision;
  }

  /** Resize to max 1280px and compress before sending to the model. */
  static async prepareImage(buf: Buffer): Promise<string> {
    const out = await sharp(buf).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  }

  async run<I, O>(task: TaskDef<I, O>, input: I, opts: RunOptions = {}): Promise<O> {
    const model = this.modelFor(task.model);
    const imageHashes = (opts.images ?? []).map((b) => sha256(b.toString('base64')));
    const key = sha256(JSON.stringify([task.name, model, normalize(input), imageHashes]));

    // Expensive tasks (video) cache even when AI_CACHE is off, so regenerating a lesson doesn't re-pay.
    const useCache = this.cacheEnabled || (!!task.alwaysCache && this.provider !== 'mock');
    if (useCache && !opts.fresh) {
      const hit = await this.prisma.aiCache.findUnique({ where: { key } });
      if (hit) {
        const parsed = task.schema.safeParse(hit.response);
        if (parsed.success) return parsed.data;
      }
    }

    const started = Date.now();
    let result: O;
    if (this.provider === 'mock') {
      result = task.schema.parse(task.mock(input));
      await this.log(task.name, model, started, true);
    } else {
      result = await this.callModel(task, input, model, opts, started);
    }

    if (useCache) {
      await this.prisma.aiCache
        .upsert({
          where: { key },
          update: { response: result as Prisma.InputJsonValue },
          create: { key, response: result as Prisma.InputJsonValue },
        })
        .catch(() => undefined);
    }
    return result;
  }

  private async callModel<I, O>(task: TaskDef<I, O>, input: I, model: string, opts: RunOptions, started: number): Promise<O> {
    const images = opts.images ?? [];
    const media = opts.media ?? [];
    const provider = opts.provider ?? task.provider;
    if (!this.apiKey || !model) {
      await this.log(task.name, model || 'unset', started, false, 'OpenRouter not configured');
      throw new AiUnavailableError();
    }
    const userText = task.user(input);
    const content: ChatContent =
      images.length || media.length
        ? [
            { type: 'text', text: userText },
            ...(await Promise.all(images.map(async (b) => ({ type: 'image_url' as const, image_url: { url: await AiService.prepareImage(b) } })))),
            ...media,
          ]
        : userText;
    const messages: ChatMessage[] = [
      { role: 'system', content: task.system },
      { role: 'user', content },
    ];
    let tokensIn = 0;
    let tokensOut = 0;
    let jsonMode = true;
    let lastError = '';
    // Attempt 1, then one retry with the validation error.
    for (let attempt = 0; attempt < 2; attempt++) {
      let reply: CompletionResult;
      try {
        reply = await this.transport.complete(model, messages, { jsonMode, maxTokens: opts.maxTokens ?? task.maxTokens, timeoutMs: task.timeoutMs, provider });
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (status === 400 && jsonMode) {
          // Model may not support response_format: retry once without it.
          jsonMode = false;
          attempt--;
          continue;
        }
        await this.log(task.name, model, started, false, e instanceof Error ? e.message.slice(0, 200) : 'error', tokensIn, tokensOut);
        throw new AiUnavailableError();
      }
      tokensIn += reply.tokensIn ?? 0;
      tokensOut += reply.tokensOut ?? 0;
      try {
        const parsed = task.schema.safeParse(extractJson(reply.text));
        if (parsed.success) {
          await this.log(task.name, model, started, true, undefined, tokensIn, tokensOut);
          return parsed.data;
        }
        lastError = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'invalid JSON';
      }
      messages.push({ role: 'assistant', content: reply.text });
      messages.push({ role: 'user', content: `Your reply did not match the schema (${lastError}). Return only the corrected JSON object.` });
    }
    await this.log(task.name, model, started, false, `invalid output: ${lastError.slice(0, 180)}`, tokensIn, tokensOut);
    throw new AiUnavailableError();
  }

  private async log(task: string, model: string, started: number, ok: boolean, error?: string, tokensIn?: number, tokensOut?: number) {
    try {
      await this.prisma.aiLog.create({ data: { task, model, ok, error, tokensIn, tokensOut, ms: Date.now() - started } });
    } catch (e) {
      this.logger.warn(`AiLog write failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
