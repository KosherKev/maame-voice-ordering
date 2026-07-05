import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  AT_API_KEY: z.string().min(1),
  AT_USERNAME: z.string().min(1),
  KHAYA_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  GOOGLE_API_KEY: z.string().min(1),
  MOOLRE_API_USER: z.string().min(1),
  MOOLRE_API_KEY: z.string().min(1),
  MOOLRE_VASKEY: z.string().min(1),
  MOOLRE_PUBKEY: z.string().min(1),
  // Per-provider webhook secrets (B-5 — split from single WEBHOOK_SHARED_SECRET for isolation)
  AT_WEBHOOK_SECRET: z.string().min(1),
  MOOLRE_WEBHOOK_SECRET: z.string().min(1),
  LLM_PROVIDER: z.enum(['claude', 'gemini']),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // CORS: comma-separated list of allowed origins (A-3 — env-driven for production)
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  // IP allowlists: comma-separated CIDR ranges for webhook source-IP verification (B-4, G-9)
  AT_IP_ALLOWLIST: z.string().default(''),
  MOOLRE_IP_ALLOWLIST: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;

