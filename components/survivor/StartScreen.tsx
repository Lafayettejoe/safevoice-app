"use client";
// Uses sessionStorage and fetch when the page loads, so it must run in the browser.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
    enabledLanguages,
    isEnabledLanguage,
    LANGUAGE_LABELS,
} from "../../lib/languages";
import {
    readStoredLanguage,
    storePanicUrl,
    storeSessionToken,
} from "../../lib/survivor-storage";
import { BrandMark } from "../shared/BrandMark";
import { useLanguage } from "./LanguageProvider";
import { SurvivorCard } from "./SurvivorCard";

type TokenStatus = "loading" | "ready" | "error";

type TokenResponse = {
    data?: {
        token?: string;
        defaultLanguage?: string;
        panicRedirectUrl?: string;
    };
};

export function StartScreen() {
    const router = useRouter();
    const { language, setLanguage, status, t } = useLanguage();
    const [tokenStatus, setTokenStatus] = useState<TokenStatus>("loading");
    const [attempt, setAttempt] = useState(0);

    // A fresh anonymous token on every page load (FR-03A).
    useEffect(() => {
        let cancelled = false;

        async function getToken() {
            try {
                const response = await fetch("/api/session-token", { method: "POST" });
                if (!response.ok) throw new Error("Token request failed");

                const result: TokenResponse = await response.json();

                const token = result.data?.token;
                if (!token) throw new Error("No token returned");
                if (cancelled) return;

                storeSessionToken(token);

                const panicRedirectUrl = result.data?.panicRedirectUrl;
                if (panicRedirectUrl) storePanicUrl(panicRedirectUrl);

                // Use the camp's default language until the survivor picks one.
                const defaultLanguage = result.data?.defaultLanguage;
                if (
                    readStoredLanguage() === null &&
                    defaultLanguage &&
                    isEnabledLanguage(defaultLanguage)
                ) {
                    setLanguage(defaultLanguage);
                }

                setTokenStatus("ready");
            } catch {
                if (!cancelled) setTokenStatus("error");
            }
        }

        getToken();

        return () => {
            cancelled = true;
        };
    }, [attempt, setLanguage]);

    function retry() {
        setTokenStatus("loading");
        setAttempt((value) => value + 1);
    }

    const textReady = status === "ready";
    const canContinue = textReady && tokenStatus === "ready";

    return (
        <SurvivorCard lang={language}>
            <BrandMark />

            <div className="mt-4 mb-6 text-center">
                <h1 className="text-lg font-bold">SafeVoice</h1>
                <p className="mt-1 min-h-10 text-sm text-on-surface-variant">
                    {textReady ? t("landing.subtitle") : ""}
                </p>
            </div>

            <h2 className="min-h-5 text-sm font-medium">
                {textReady ? t("language.prompt") : ""}
            </h2>

            <div role="group" aria-label="Language" className="mt-1.5 flex flex-col gap-3">
                {enabledLanguages().map((code) => {
                    const selected = language === code;
                    return (
                        <button
                            key={code}
                            type="button"
                            lang={code}
                            aria-pressed={selected}
                            onClick={() => setLanguage(code)}
                            className={`flex min-h-11 items-center justify-between rounded-lg border px-3 text-base font-medium ${selected
                                ? "border-secondary bg-primary text-on-primary-container ring-1 ring-secondary"
                                : "border-outline bg-surface-container-lowest text-on-surface"
                                }`}
                        >
                            <span>{LANGUAGE_LABELS[code]}</span>
                            {selected && (
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
                                >
                                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                                </svg>
                            )}
                        </button>
                    );
                })}
            </div>

            {tokenStatus === "error" && (
                <div
                    role="alert"
                    className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
                >
                    <p>{textReady ? t("error.generic") : "Something went wrong."}</p>
                    <button
                        type="button"
                        onClick={retry}
                        className="mt-2 min-h-11 rounded-lg border border-outline px-4 font-medium"
                    >
                        {textReady ? t("common.retry") : "Try again"}
                    </button>
                </div>
            )}

            {/* replace, not push: the flow keeps a single SafeVoice entry in the
          browser history, so the panic exit leaves nothing to go back to. */}
            <button
                type="button"
                disabled={!canContinue}
                onClick={() => router.replace("/consent")}
                className="mt-6 min-h-11 w-full rounded-lg bg-secondary px-4 text-base font-semibold text-on-secondary disabled:opacity-60"
            >
                {textReady ? t("landing.start") : "..."}
            </button>
        </SurvivorCard>
    );
}