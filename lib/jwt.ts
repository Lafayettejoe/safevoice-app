import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { env } from "./env";

// Creates and checks JWTs. It is kept separate from lib/auth.ts so the route
// gate (proxy.ts) can use it without importing database or cookie code.

export const AUTH_COOKIE_NAME = "sv_auth";
export const AUTH_TOKEN_LIFETIME_SECONDS = 60 * 60 * 8; // 8 hours, one shift

const payloadSchema = z.object({
    sub: z.string().min(1),
    role: z.enum(["CASE_WORKER", "CAMP_ADMIN"]),
    campId: z.string().min(1),
});

export type AuthTokenPayload = z.infer<typeof payloadSchema>;

const secretKey = new TextEncoder().encode(env.JWT_SECRET);

export async function createAuthToken(payload: AuthTokenPayload): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000);

    return new SignJWT({ role: payload.role, campId: payload.campId })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(payload.sub)
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + AUTH_TOKEN_LIFETIME_SECONDS)
        .sign(secretKey);
}

// Returns the payload if the token is genuine and not expired, otherwise null.
export async function verifyAuthToken(
    token: string,
): Promise<AuthTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secretKey, {
            algorithms: ["HS256"],
        });
        const parsed = payloadSchema.safeParse(payload);
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}