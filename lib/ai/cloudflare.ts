import "server-only";
import { env } from "../env";

export class AiError extends Error { }

// One place that talks to Cloudflare Workers AI. Returns the parsed JSON.
export async function runCloudflareModel(
    model: string,
    body: unknown,
    timeoutMs: number,
): Promise<unknown> {
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.AI_API_KEY) {
        throw new AiError(
            "AI is not configured. Check CLOUDFLARE_ACCOUNT_ID and AI_API_KEY in .env",
        );
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.AI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
    });

    // The status is safe to log. The body could contain survivor words, so
    // it is never put in the error message.
    if (!response.ok) {
        throw new AiError(`AI request failed with status ${response.status}`);
    }

    return (await response.json()) as unknown;
}