import { redirect } from "next/navigation";
import { LogoutButton } from "../../../components/shared/LogoutButton";
import { getCurrentUser } from "../../../lib/auth";

export default async function InboxPage() {
    // The gate in proxy.ts already blocks visitors. This is the second lock.
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    return (
        <main className="mx-auto max-w-2xl px-4 py-8">
            <h1 className="text-2xl font-bold">Report inbox</h1>
            <p className="mt-2">
                Signed in as {user.displayName} ({user.role}).
            </p>
            <p className="mt-2 text-on-surface-variant">
                The report list will appear here in a later task.
            </p>
            <div className="mt-6">
                <LogoutButton />
            </div>
        </main>
    );
}