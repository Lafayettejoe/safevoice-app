import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { languageToDb } from "./languages";
import { generateReferenceCode } from "./reference-code";
import type { ReportFields } from "./report-schema";
import { deleteAudio, uploadAudio } from "./storage";

// Matches the consent screen: "deleted after 24 months".
const RETENTION_MONTHS = 24;

class TokenSpentError extends Error { }

export type CreateReportInput = {
    token: string;
    campId: string;
    fields: ReportFields;
    audio: Uint8Array;
    audioContentType: string;
};

export type CreateReportResult =
    | { ok: true; reportId: string; referenceCode: string }
    | { ok: false; reason: "TOKEN_SPENT" | "STORAGE_FAILED" | "SAVE_FAILED" };

function deletionDate(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + RETENTION_MONTHS);
    return date;
}

function isReferenceCodeClash(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== "P2002") return false;
    const target = error.meta?.target;
    if (Array.isArray(target)) return target.includes("referenceCode");
    return typeof target === "string" && target.includes("referenceCode");
}

async function removeAudio(key: string) {
    try {
        await deleteAudio(key);
    } catch {
        // Best effort. The nightly deletion job is the safety net.
    }
}

// Saves the recording, then creates the report and spends the token in ONE
// database transaction. If anything fails, the recording is removed again and
// the token stays unused so the survivor can try again.
export async function createReport(
    input: CreateReportInput,
): Promise<CreateReportResult> {
    let audioKey: string;
    try {
        audioKey = await uploadAudio(input.audio, input.audioContentType);
    } catch (error) {
        console.error("Audio upload failed:", error instanceof Error ? error.name : "unknown");
        return { ok: false, reason: "STORAGE_FAILED" };
    }

    const { fields } = input;
    const isMinor = fields.ageBand === "UNDER_15" || fields.ageBand === "AGE_15_TO_17";
    const incidentTypes = [...new Set(fields.incidentTypes)];

    // A clash on the reference code is very unlikely. Try a new code if it happens.
    for (let attempt = 0; attempt < 5; attempt++) {
        const referenceCode = generateReferenceCode();

        try {
            const report = await db.$transaction(
                async (tx) => {
                    // Same rule as markTokenUsed in lib/session.ts, but inside this
                    // transaction so a failed save does not spend the token.
                    const claimed = await tx.anonymousSessionToken.updateMany({
                        where: { token: input.token, usedAt: null, expiresAt: { gt: new Date() } },
                        data: { usedAt: new Date() },
                    });
                    if (claimed.count !== 1) throw new TokenSpentError();

                    return tx.report.create({
                        data: {
                            referenceCode,
                            campId: input.campId,
                            sessionToken: input.token,
                            survivorAgeBand: fields.ageBand,
                            isMinor,
                            childProtectionFlag: isMinor,
                            incidentTypes,
                            timingOfDay: fields.timingOfDay,
                            timingRecency: fields.timingRecency,
                            language: languageToDb(fields.language),
                            audioFileKey: audioKey,
                            audioDurationSeconds: fields.durationSeconds,
                            audioSyncComplete: true,
                            scheduledDeletionAt: deletionDate(),
                            statusUpdates: { create: { status: "CASE_RECEIVED" } },
                        },
                        select: { id: true },
                    });
                },
                // Neon can be slow to wake up, so allow more time than the default.
                { maxWait: 10000, timeout: 15000 },
            );

            return { ok: true, reportId: report.id, referenceCode };
        } catch (error) {
            if (isReferenceCodeClash(error)) continue;

            await removeAudio(audioKey);
            if (error instanceof TokenSpentError) {
                return { ok: false, reason: "TOKEN_SPENT" };
            }
            console.error("Report save failed:", error instanceof Error ? error.name : "unknown");
            return { ok: false, reason: "SAVE_FAILED" };
        }
    }

    await removeAudio(audioKey);
    return { ok: false, reason: "SAVE_FAILED" };
}