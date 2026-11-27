import { z } from "zod";

// Everything the app reads from .env goes through this file.
// If a required value is missing or the wrong shape, the app refuses to start.

const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),

    // Database (Neon)
    DATABASE_URL: z.string().min(1, "is required"),
    DIRECT_URL: z.string().min(1, "is required"),

    // Security
    ENCRYPTION_KEY: z
        .string()
        .regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex characters (32 bytes)"),
    JWT_SECRET: z.string().min(32, "must be at least 32 characters"),

    // Needed later (Task 13: deletion and escalation jobs). Optional for now.
    CRON_SECRET: z.string().min(16).optional(),
    // Which camp this SafeVoice site serves.
    DEFAULT_CAMP_ID: z.string().min(1).optional(),

    // Audio storage on Supabase S3.
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),

    // AI pipeline on Cloudflare Workers AI.
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    AI_API_KEY: z.string().optional(),
    AI_TRANSCRIBE_MODEL: z.string().default("@cf/openai/whisper-large-v3-turbo"),
    AI_CLASSIFY_MODEL: z.string().default("@cf/openai/gpt-oss-20b"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    // Print only the variable names and problems, never the values.
    const problems = parsed.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
    throw new Error(`Invalid environment variables:\n${problems}`);
}

export const env = parsed.data;