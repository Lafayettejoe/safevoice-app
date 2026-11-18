import { z } from "zod";
import { fail, ok } from "../../../../lib/api-response";
import { authenticateUser, setAuthCookie } from "../../../../lib/auth";
import { writeAuditLog } from "../../../../lib/audit";
import { createAuthToken } from "../../../../lib/jwt";

const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return fail("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
        return fail("INVALID_INPUT", "Enter a valid email and password.", 400);
    }

    const user = await authenticateUser(parsed.data.email, parsed.data.password);
    if (!user) {
        // Same message for a wrong email and a wrong password, on purpose.
        return fail("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
    }

    const token = await createAuthToken({
        sub: user.id,
        role: user.role,
        campId: user.campId,
    });
    await setAuthCookie(token);

    await writeAuditLog({
        userId: user.id,
        action: "USER_LOGIN",
        entityType: "User",
        entityId: user.id,
    });

    return ok({ displayName: user.displayName, role: user.role });
}