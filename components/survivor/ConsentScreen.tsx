"use client";
// Reads the session token from sessionStorage and posts the consent, so it
// must run in the browser.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
    clearSurvivorStorage,
    readSessionToken,
} from "../../lib/survivor-storage";
import { BrandMark } from "../shared/BrandMark";
import { useLanguage } from "./LanguageProvider";
import { SurvivorCard } from "./SurvivorCard";

const POINT_KEYS = [
    "consent.point1",
    "consent.point2",
    "consent.point3",
    "consent.point4",
    "consent.point5",
    "consent.point6",
] as const;

type SubmitState =
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "error"; sessionEnded: boolean };

export function ConsentScreen() {
    const router = useRouter();
    const { language, status, t } = useLanguage();
    const [state, setState] = useState<SubmitState>({ kind: "idle" });

    // No token means the page was opened directly or the tab was reset.
    useEffect(() => {
        if (readSessionToken() === null) router.replace("/");
    }, [router]);

    async function confirm() {
        const token = readSessionToken();
        if (token === null) {
            router.replace("/");
            return;
        }

        setState({ kind: "saving" });

        try {
            const response = await fetch("/api/consent", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": token,
                },
                body: JSON.stringify({ language }),
            });

            if (response.ok) {
                // replace, not push: keeps a single SafeVoice entry in the history.
                router.replace("/report");
                return;
            }

            const result: { error?: { code?: string } } = await response.json();
            const code = result.error?.code ?? "";
            setState({ kind: "error", sessionEnded: code.startsWith("SESSION_TOKEN") });
        } catch {
            setState({ kind: "error", sessionEnded: false });
        }
    }

    // Declining, or starting again after an expired session: nothing is saved
    // and the browser keeps nothing.
    function leave() {
        clearSurvivorStorage();
        router.replace("/");
    }

    if (status === "error") {
        return (
            <SurvivorCard>
                <p>Could not load this page. Please reload.</p>
            </SurvivorCard>
        );
    }

    if (status !== "ready") {
        return <SurvivorCard busy />;
    }

    const saving = state.kind === "saving";
    const sessionEnded = state.kind === "error" && state.sessionEnded;

    return (
        <SurvivorCard lang={language}>
            <BrandMark />
            <h1 className="mt-4 mb-6 text-center text-lg font-bold">
                {t("consent.title")}
            </h1>

            <ul className="flex flex-col gap-3 text-base leading-relaxed">
                {POINT_KEYS.map((key) => (
                    <li key={key} className="flex gap-3">
                        <svg
                            aria-hidden="true"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mt-1 shrink-0 text-secondary"
                        >
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                        <span>{t(key)}</span>
                    </li>
                ))}
            </ul>

            {state.kind === "error" && (
                <div
                    role="alert"
                    className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
                >
                    <p>{sessionEnded ? t("error.session") : t("error.generic")}</p>
                    {sessionEnded && (
                        <button
                            type="button"
                            onClick={leave}
                            className="mt-2 min-h-11 rounded-lg border border-outline px-4 font-medium"
                        >
                            {t("common.retry")}
                        </button>
                    )}
                </div>
            )}

            <button
                type="button"
                onClick={confirm}
                disabled={saving || sessionEnded}
                className="mt-6 min-h-11 w-full rounded-lg bg-secondary px-4 text-base font-semibold text-on-secondary disabled:opacity-60"
            >
                {saving ? t("common.loading") : t("consent.confirm")}
            </button>

            <button
                type="button"
                onClick={leave}
                disabled={saving}
                className="mt-3 min-h-11 w-full rounded-lg border border-outline px-4 text-base font-medium disabled:opacity-60"
            >
                {t("consent.decline")}
            </button>
        </SurvivorCard>
    );
}