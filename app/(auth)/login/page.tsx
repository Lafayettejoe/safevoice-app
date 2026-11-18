import { redirect } from "next/navigation";
import { BrandMark } from "../../../components/shared/BrandMark";
import { LoginForm } from "../../../components/shared/LoginForm";
import { getCurrentUser } from "../../../lib/auth";

export default async function LoginPage() {
    const user = await getCurrentUser();
    if (user) redirect("/inbox");

    return (
        <main className="flex min-h-screen items-center justify-center px-4 py-8">
            <div className="w-full max-w-sm rounded-xl bg-surface-container-lowest p-8 shadow-lg">
                <BrandMark />
                <div className="mt-4 mb-6 text-center">
                    <h1 className="text-lg font-bold">Login</h1>
                    <p className="mt-1 text-xs text-on-surface-variant">
                        Sign in to your SafeVoice staff account
                    </p>
                </div>
                <LoginForm />
            </div>
        </main>
    );
}