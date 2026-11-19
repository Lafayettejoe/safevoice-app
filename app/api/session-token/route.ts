import { fail, ok } from "../../../lib/api-response";
import { issueSessionToken } from "../../../lib/session";

export async function POST() {
    const result = await issueSessionToken();

    if (!result.ok) {
        return fail(
            "CAMP_NOT_CONFIGURED",
            "This SafeVoice site is not set up yet.",
            503,
        );
    }

    return ok(
        {
            token: result.token,
            expiresAt: result.expiresAt.toISOString(),
            defaultLanguage: result.defaultLanguage,
        },
        201,
    );
}