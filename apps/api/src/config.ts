import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  API_URL: z.string().default('http://localhost:4000'),
  WEB_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(1).default('change-me'),
  TOKEN_ENCRYPTION_KEY: z.string().default('change-me-32-bytes-base64'),
  UPLOAD_DIR: z.string().default('./uploads'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:4000/auth/google/callback'),
  CLASSROOM_PROVIDER: z.enum(['google', 'fake']).default('fake'),
  AI_PROVIDER: z.enum(['openrouter', 'mock']).default('mock'),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  AI_MODEL_VISION: z.string().optional().default(''),
  AI_MODEL_FAST: z.string().optional().default(''),
  AI_MAX_TOKENS: z.coerce.number().default(1200),
  AI_CACHE: bool,
  DEV_LOGIN: bool,
  // WebRTC: optional TURN relay for strict school networks (comma-separated URLs, e.g. turn:relay.example.com:3478)
  TURN_URLS: z.string().optional().default(''),
  TURN_USERNAME: z.string().optional().default(''),
  TURN_CREDENTIAL: z.string().optional().default(''),
  // Mic recordings (stored in Postgres): per-school budget, retention, and whether study sessions are recorded at all
  RECORDINGS_MAX_MB_PER_SCHOOL: z.coerce.number().positive().default(300),
  RECORDINGS_RETENTION_DAYS: z.coerce.number().positive().default(14),
  RECORD_STUDY_SESSIONS: bool,
  CRON_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
});

/** Strip inline comments like `fake   # google | fake` that some .env editors keep. */
function cleanEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    out[k] = v === undefined ? undefined : v.replace(/\s+#.*$/, '').trim() || undefined;
  }
  return out;
}

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(): AppConfig {
  return schema.parse(cleanEnv(process.env));
}

export const config: AppConfig = loadConfig();

export function uploadRoot(): string {
  return path.isAbsolute(config.UPLOAD_DIR) ? config.UPLOAD_DIR : path.resolve(__dirname, '../../..', config.UPLOAD_DIR.replace(/^\.\//, 'apps/api/'));
}
