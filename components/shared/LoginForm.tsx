"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const inputClass =
    "min-h-11 w-full rounded-lg border border-outline bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-tertiary focus:outline-2 focus:outline-tertiary";

export function LoginForm() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        const form = new FormData(event.currentTarget);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: form.get("email"),
                    password: form.get("password"),
                }),
            });

            if (response.ok) {
                router.push("/inbox");
                router.refresh();
                return;
            }

            const result: { error?: { message?: string } } = await response.json();
            setError(result.error?.message ?? "Could not log in. Try again.");
        } catch {
            setError("Could not reach the server. Check your connection.");
        }

        setSubmitting(false);
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium">
                    Your email<span aria-hidden="true" className="text-error"> *</span>
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@organisation.org"
                    required
                    className={inputClass}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-medium">
                    Password<span aria-hidden="true" className="text-error"> *</span>
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className={inputClass}
                />
            </div>

            {error && (
                <p
                    role="alert"
                    className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
                >
                    {error}
                </p>
            )}

            <button
                type="submit"
                disabled={submitting}
                className="min-h-11 w-full rounded-lg bg-secondary px-4 text-sm font-semibold text-on-secondary disabled:opacity-60"
            >
                {submitting ? "Logging in..." : "Log in"}
            </button>

            <p className="text-center text-xs text-on-surface-variant">
                Forgot your password? Ask your camp administrator to reset it.
            </p>
        </form>
    );
}