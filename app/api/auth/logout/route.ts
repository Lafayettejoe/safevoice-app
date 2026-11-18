import { fail, ok } from "../../../../lib/api-response";
import { clearAuthCookie, getCurrentUser } from "../../../../lib/auth";
import { writeAuditLog } from "../../../../lib/audit";

export async function POST() {
    const user = await getCurrentUser();
    if (!user) {
        return fail("UNAUTHENTICATED", "You are not logged in.", 401);
    }

    await clearAuthCookie();

    await writeAuditLog({
        userId: user.id,
        action: "USER_LOGOUT",
        entityType: "User",
        entityId: user.id,
    });

    return ok({ loggedOut: true });
}