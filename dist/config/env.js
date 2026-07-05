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
    WEBHOOK_SHARED_SECRET: zod_1.z.string().min(1),
    LLM_PROVIDER: zod_1.z.enum(['claude', 'gemini']),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
}
exports.env = parsed.data;
