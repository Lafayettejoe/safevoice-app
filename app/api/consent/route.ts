import { z } from "zod";
import { fail, ok } from "../../../lib/api-response";
import { writeAuditLog } from "../../../lib/audit";
import { recordConsent } from "../../../lib/consent";
import {
    isEnabledLanguage,
    languageToDb,
    type LanguageCode,
} from "../../../lib/languages";

const bodySchema = z.object({
    language: z.custom<LanguageCode>(
        (value) => typeof value === "string" && isEnabledLanguage(value),
    ),
});

export async function POST(request: Request) {
    const token = request.headers.get("x-session-token");
    if (!token) {
        return fail("SESSION_TOKEN_MISSING", "Session token is required.", 401);
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return fail("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
        return fail("INVALID_INPUT", "A supported language is required.", 400);
    }

    const ipAddress =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const result = await recordConsent({
        token,
        language: parsed.data.language,
        ipAddress,
    });

    if (!result.ok) {
        if (result.reason === "EXPIRED") {
            return fail(
                "SESSION_TOKEN_EXPIRED",
                "Your session has ended. Please start again.",
                401,
            );
        }
        if (result.reason === "ALREADY_USED") {
            return fail("SESSION_TOKEN_USED", "This session was already used.", 409);
        }
        return fail(
            "SESSION_TOKEN_INVALID",
            "Session not recognised. Please start again.",
            401,
        );
    }

    if (result.created) {
        await writeAuditLog({
            action: "CONSENT_RECORDED",
            entityType: "ConsentRecord",
            entityId: result.consentId,
            metadata: { language: languageToDb(parsed.data.language) },
        });
    }

    return ok({ consented: true });
}