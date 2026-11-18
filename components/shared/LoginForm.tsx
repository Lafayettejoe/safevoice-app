"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
            <div className="flex flex-col gap-1">
                <label htmlFor="email" className="font-medium">
                    Email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    className="min-h-11 rounded-md border border-outline bg-surface-variant px-3 text-on-surface-variant focus:border-tertiary focus:outline-2 focus:outline-tertiary"
                />
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="password" className="font-medium">
                    Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="min-h-11 rounded-md border border-outline bg-surface-variant px-3 text-on-surface-variant focus:border-tertiary focus:outline-2 focus:outline-tertiary"
                />
            </div>

            {error && (
                <p
                    role="alert"
                    className="rounded-md bg-error-container px-3 py-2 text-on-error-container"
                >
                    {error}
                </p>
            )}

            <button
                type="submit"
                disabled={submitting}
                className="min-h-11 rounded-md bg-secondary px-4 font-semibold text-on-secondary disabled:opacity-60"
            >
                {submitting ? "Logging in..." : "Log in"}
            </button>
        </form>
    );
}