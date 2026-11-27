import { after } from "next/server";
import { processReport } from "../../../lib/ai/process-report";
import { fail, ok } from "../../../lib/api-response";
import { writeAuditLog } from "../../../lib/audit";
import { languageToDb } from "../../../lib/languages";
import { createReport } from "../../../lib/report";
import { reportFieldsSchema } from "../../../lib/report-schema";
import { hasConsent, validateSessionToken } from "../../../lib/session";

// A 5 minute recording at 32 kbps is about 1.2 MB. 3 MB leaves room, and stays
// under the 4.5 MB request limit on Vercel.
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 100 * 1024;
const ALLOWED_AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4"];

// Includes the transcription and risk check that run after the response.
export const maxDuration = 60;

export async function POST(request: Request) {
    const token = request.headers.get("x-session-token");
    if (!token) {
        return fail("SESSION_TOKEN_MISSING", "Session token is required.", 401);
    }

    const check = await validateSessionToken(token);
    if (!check.valid) {
        if (check.reason === "EXPIRED") {
            return fail(
                "SESSION_TOKEN_EXPIRED",
                "Your session has ended. Please start again.",
                401,
            );
        }
        if (check.reason === "ALREADY_USED") {
            return fail("SESSION_TOKEN_USED", "This session was already used.", 409);
        }
        return fail(
            "SESSION_TOKEN_INVALID",
            "Session not recognised. Please start again.",
            401,
        );
    }

    if (!(await hasConsent(token))) {
        return fail("CONSENT_REQUIRED", "Consent has not been given.", 403);
    }

    // Refuse oversized requests before reading them.
    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_REQUEST_BYTES) {
        return fail("AUDIO_TOO_LARGE", "The recording is too large.", 413);
    }

    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return fail("INVALID_FORM", "Request must be a valid form upload.", 400);
    }

    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
        return fail("AUDIO_MISSING", "A recording is required.", 400);
    }
    if (audio.size > MAX_AUDIO_BYTES) {
        return fail("AUDIO_TOO_LARGE", "The recording is too large.", 413);
    }

    // The browser may add details like ";codecs=opus". Keep only the main type.
    const audioType = audio.type.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_AUDIO_TYPES.includes(audioType)) {
        return fail("AUDIO_TYPE_INVALID", "This recording format is not supported.", 415);
    }

    const rawFields = form.get("fields");
    if (typeof rawFields !== "string") {
        return fail("INVALID_INPUT", "Report details are required.", 400);
    }

    let fieldsJson: unknown;
    try {
        fieldsJson = JSON.parse(rawFields);
    } catch {
        return fail("INVALID_JSON", "Report details must be valid JSON.", 400);
    }

    const parsed = reportFieldsSchema.safeParse(fieldsJson);
    if (!parsed.success) {
        return fail("INVALID_INPUT", "The report details are not valid.", 400);
    }

    const result = await createReport({
        token,
        campId: check.campId,
        fields: parsed.data,
        audio: new Uint8Array(await audio.arrayBuffer()),
        audioContentType: audioType,
    });

    if (!result.ok) {
        if (result.reason === "TOKEN_SPENT") {
            return fail("SESSION_TOKEN_USED", "This session was already used.", 409);
        }
        if (result.reason === "STORAGE_FAILED") {
            return fail("STORAGE_FAILED", "The recording could not be saved. Please try again.", 502);
        }
        return fail("SAVE_FAILED", "The report could not be saved. Please try again.", 500);
    }

    // The report is already saved. A failed audit write must not make the
    // survivor think her report was lost, because her token is now spent.
    try {
        await writeAuditLog({
            action: "REPORT_SUBMITTED",
            entityType: "Report",
            entityId: result.reportId,
            metadata: {
                language: languageToDb(parsed.data.language),
                incidentTypeCount: parsed.data.incidentTypes.length,
                audioSeconds: parsed.data.durationSeconds,
            },
        });
    } catch (error) {
        console.error("Audit write failed:", error instanceof Error ? error.name : "unknown");
    }

    // Transcription and risk check run after the survivor has her code.
    // processReport records its own failures, so nothing can reach her.
    const reportId = result.reportId;
    after(async () => {
        try {
            await processReport(reportId);
        } catch (error) {
            console.error("AI processing failed:", error instanceof Error ? error.name : "unknown");
        }
    });

    return ok({ referenceCode: result.referenceCode }, 201);
}