import "server-only";
import { z } from "zod";
import { env } from "../env";
import type { LanguageCode } from "../languages";
import { AiError, runCloudflareModel } from "./cloudflare";

// Telling Whisper the language helps it. Languages not listed here are
// left for Whisper to detect.
const WHISPER_LANGUAGE: Record<string, string> = { en: "en", ha: "ha" };

const responseSchema = z.object({
    result: z.object({ text: z.string() }),
});

export async function transcribeAudio(
    audio: Uint8Array,
    language: LanguageCode,
): Promise<string> {
    const body: { audio: string; language?: string } = {
        audio: Buffer.from(audio).toString("base64"),
    };
    const hint = WHISPER_LANGUAGE[language];
    if (hint) body.language = hint;

    const json = await runCloudflareModel(env.AI_TRANSCRIBE_MODEL, body, 90_000);

    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) throw new AiError("Unexpected transcription response");

    return parsed.data.result.text.trim();
}