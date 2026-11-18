import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";
import { env } from "./env";
import {
    AUTH_COOKIE_NAME,
    AUTH_TOKEN_LIFETIME_SECONDS,
    verifyAuthToken,
} from "./jwt";

const BCRYPT_ROUNDS = 12;

// Used when an email does not exist, so a wrong email and a wrong password
// take the same time and an attacker cannot tell which one was wrong.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

export type CurrentUser = {
    id: string;
    role: "CASE_WORKER" | "CAMP_ADMIN";
    campId: string;
    displayName: string;
};

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Returns the user if the email and password are right and the account is
// active. Returns null for every kind of failure.
export async function authenticateUser(
    email: string,
    password: string,
): Promise<CurrentUser | null> {
    const user = await db.user.findUnique({
        where: { email: email.trim().toLowerCase() },
    });

    const passwordMatches = await bcrypt.compare(
        password,
        user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !user.isActive || !passwordMatches) return null;

    return {
        id: user.id,
        role: user.role,
        campId: user.campId,
        displayName: user.displayName,
    };
}

export async function setAuthCookie(token: string): Promise<void> {
    const store = await cookies();
    store.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true, // JavaScript on the page cannot read it
        secure: env.NODE_ENV === "production", // HTTPS only when live
        sameSite: "strict", // never sent from another website
        path: "/",
        maxAge: AUTH_TOKEN_LIFETIME_SECONDS,
    });
}

export async function clearAuthCookie(): Promise<void> {
    const store = await cookies();
    store.delete(AUTH_COOKIE_NAME);
}

// Who is logged in right now? Checks the JWT, then the database, so a
// deactivated account is locked out even if its token has not expired.
export async function getCurrentUser(): Promise<CurrentUser | null> {
    const store = await cookies();
    const token = store.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifyAuthToken(token);
    if (!payload) return null;

    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return null;

    return {
        id: user.id,
        role: user.role,
        campId: user.campId,
        displayName: user.displayName,
    };
}