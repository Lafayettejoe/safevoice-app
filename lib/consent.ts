import "server-only";
import { Prisma } from "@prisma/client";
import { createHmac } from "node:crypto";
import { db } from "./db";
import { env } from "./env";
import { languageToDb, type LanguageCode } from "./languages";
import { validateSessionToken } from "./session";

export type RecordConsentResult =
    | { ok: true; consentId: string; created: boolean }
    | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "ALREADY_USED" };

// A plain SHA-256 of an IPv4 address can be reversed by trying every address,
// so this uses a keyed SHA-256 (HMAC). Used only for abuse auditing.
function hashIpAddress(ip: string): string {
    return createHmac("sha256", env.JWT_SECRET)
        .update(`ip-hash:${ip}`)
        .digest("hex");
}

// Writes the ConsentRecord that activates a session token. The IP hash is
// created here, after the survivor tapped "I agree", and never before.
export async function recordConsent(input: {
    token: string;
    language: LanguageCode;
    ipAddress: string | null;
}): Promise<RecordConsentResult> {
    const check = await validateSessionToken(input.token);
    if (!check.valid) return { ok: false, reason: check.reason };

    const existing = await db.consentRecord.findUnique({
        where: { sessionToken: input.token },
        select: { id: true },
    });
    if (existing) return { ok: true, consentId: existing.id, created: false };

    try {
        const record = await db.consentRecord.create({
            data: {
                sessionToken: input.token,
                campId: check.campId,
                language: languageToDb(input.language),
                ipHash: input.ipAddress ? hashIpAddress(input.ipAddress) : null,
            },
            select: { id: true },
        });
        return { ok: true, consentId: record.id, created: true };
    } catch (error) {
        // Two taps at the same moment: the second one hits the "one consent per
        // token" rule. The consent exists, so treat it as done.
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            const winner = await db.consentRecord.findUnique({
                where: { sessionToken: input.token },
                select: { id: true },
            });
            if (winner) return { ok: true, consentId: winner.id, created: false };
        }
        throw error;
    }
}