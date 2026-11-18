import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "./lib/jwt";

// Routes that only a camp admin may open. Case workers get a 403.
const ADMIN_PREFIXES = [
    "/partners",
    "/escalation",
    "/accounts",
    "/stats",
    "/api/admin",
];

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isApi = pathname.startsWith("/api/");

    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const payload = token ? await verifyAuthToken(token) : null;

    if (!payload) {
        if (isApi) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "UNAUTHENTICATED", message: "Please log in." },
                },
                { status: 401 },
            );
        }
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const needsAdmin = ADMIN_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

    if (needsAdmin && payload.role !== "CAMP_ADMIN") {
        if (isApi) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "FORBIDDEN", message: "Admin access required." },
                },
                { status: 403 },
            );
        }
        return NextResponse.redirect(new URL("/inbox", request.url));
    }

    return NextResponse.next();
}

// Only these routes pass through the gate. Survivor pages and the anonymous
// endpoints are deliberately not listed. /report/:path+ means "/report/<id>"
// (a case worker opening one report), so the survivor page "/report" stays open.
export const config = {
    matcher: [
        "/inbox/:path*",
        "/search/:path*",
        "/report/:path+",
        "/partners/:path*",
        "/escalation/:path*",
        "/accounts/:path*",
        "/stats/:path*",
        "/api/caseworker/:path*",
        "/api/admin/:path*",
        "/api/report/:path+",
    ],
};