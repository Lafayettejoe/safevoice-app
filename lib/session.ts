import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";

// Anonymous session tokens let a survivor submit ONE report without an account.
// Rules: issued on page load, valid for 30 minutes, usable once, and only
// after a ConsentRecord exists for the token.

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;

export type TokenCheck =
    | { valid: true; campId: string }
    | { valid: false; reason: "NOT_FOUND" | "EXPIRED" | "ALREADY_USED" };

export async function generateSessionToken(
    campId: string,
): Promise<{ token: string; expiresAt: Date }> {
    // 32 random bytes cannot be guessed.
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS);

    await db.anonymousSessionToken.create({
        data: { token, campId, expiresAt },
    });

    return { token, expiresAt };
}

export async function validateSessionToken(token: string): Promise<TokenCheck> {
    const row = await db.anonymousSessionToken.findUnique({ where: { token } });

    if (!row) return { valid: false, reason: "NOT_FOUND" };
    if (row.usedAt) return { valid: false, reason: "ALREADY_USED" };
    if (row.expiresAt <= new Date()) return { valid: false, reason: "EXPIRED" };

    return { valid: true, campId: row.campId };
}

// Marks the token as spent. The check and the update happen in one database
// statement, so two requests at the same moment cannot both succeed.
// Returns false if the token was already used, expired or unknown.
export async function markTokenUsed(token: string): Promise<boolean> {
    const result = await db.anonymousSessionToken.updateMany({
        where: { token, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
    });

    return result.count === 1;
}

// A report is only accepted if the survivor confirmed consent for this token.
export async function hasConsent(token: string): Promise<boolean> {
    const record = await db.consentRecord.findUnique({
        where: { sessionToken: token },
        select: { id: true },
    });

    return record !== null;
}