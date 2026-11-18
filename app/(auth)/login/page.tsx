import { redirect } from "next/navigation";
import { LoginForm } from "../../../components/shared/LoginForm";
import { getCurrentUser } from "../../../lib/auth";

export default async function LoginPage() {
    const user = await getCurrentUser();
    if (user) redirect("/inbox");

    return (
        <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
            <div>
                <h1 className="text-2xl font-bold">SafeVoice staff login</h1>
                <p className="mt-1 text-on-surface-variant">
                    For case workers and camp administrators only.
                </p>
            </div>
            <LoginForm />
        </main>
    );
}