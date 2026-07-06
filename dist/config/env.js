"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from .env file
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().default(3000),
    DATABASE_URL: zod_1.z.string().url(),
    SUPABASE_URL: zod_1.z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().min(1),
    SUPABASE_JWT_SECRET: zod_1.z.string().min(1),
    AT_API_KEY: zod_1.z.string().min(1),
    AT_USERNAME: zod_1.z.string().min(1),
    KHAYA_API_KEY: zod_1.z.string().min(1),
    ANTHROPIC_API_KEY: zod_1.z.string().min(1),
    GOOGLE_API_KEY: zod_1.z.string().min(1),
    MOOLRE_API_USER: zod_1.z.string().min(1),
    MOOLRE_API_KEY: zod_1.z.string().min(1),
    MOOLRE_VASKEY: zod_1.z.string().min(1),
    MOOLRE_PUBKEY: zod_1.z.string().min(1),
    // Per-provider webhook secrets (B-5 — split from single WEBHOOK_SHARED_SECRET for isolation)
    AT_WEBHOOK_SECRET: zod_1.z.string().min(1),
    MOOLRE_WEBHOOK_SECRET: zod_1.z.string().min(1),
    LLM_PROVIDER: zod_1.z.enum(['claude', 'gemini']),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    // CORS: comma-separated list of allowed origins (A-3 — env-driven for production)
    ALLOWED_ORIGINS: zod_1.z.string().default('http://localhost:5173,http://localhost:3000'),
    // IP allowlists: comma-separated CIDR ranges for webhook source-IP verification (B-4, G-9)
    AT_IP_ALLOWLIST: zod_1.z.string().default(''),
    MOOLRE_IP_ALLOWLIST: zod_1.z.string().default(''),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
}
exports.env = parsed.data;
