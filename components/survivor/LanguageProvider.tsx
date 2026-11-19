"use client";
// Needs sessionStorage and fetch, which only exist in the browser.

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { DEFAULT_LANGUAGE, type LanguageCode } from "../../lib/languages";
import { readStoredLanguage, storeLanguage } from "../../lib/survivor-storage";

type Messages = Record<string, string>;
type Status = "loading" | "ready" | "error";

type LanguageContextValue = {
    language: LanguageCode;
    setLanguage: (code: LanguageCode) => void;
    status: Status;
    t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
    // null until the browser has told us what was chosen before. This keeps the
    // server and browser first render identical.
    const [chosen, setChosen] = useState<LanguageCode | null>(null);
    const [loaded, setLoaded] = useState<{
        language: LanguageCode;
        messages: Messages;
    } | null>(null);
    const [failed, setFailed] = useState<LanguageCode | null>(null);

    useEffect(() => {
        setChosen(readStoredLanguage() ?? DEFAULT_LANGUAGE);
    }, []);

    useEffect(() => {
        if (chosen === null) return;
        let cancelled = false;

        fetch(`/locales/${chosen}.json`)
            .then((response) => {
                if (!response.ok) throw new Error("Could not load translations");
                return response.json();
            })
            .then((messages: Messages) => {
                if (!cancelled) setLoaded({ language: chosen, messages });
            })
            .catch(() => {
                if (!cancelled) setFailed(chosen);
            });

        return () => {
            cancelled = true;
        };
    }, [chosen]);

    const language = chosen ?? DEFAULT_LANGUAGE;

    const setLanguage = useCallback((code: LanguageCode) => {
        storeLanguage(code);
        setChosen(code);
    }, []);

    const status: Status =
        chosen !== null && loaded?.language === chosen
            ? "ready"
            : chosen !== null && failed === chosen
                ? "error"
                : "loading";

    // Never falls back to English: a missing key shows the key itself, so the
    // gap is obvious during testing.
    const t = useCallback(
        (key: string) =>
            chosen !== null && loaded?.language === chosen
                ? (loaded.messages[key] ?? key)
                : "",
        [chosen, loaded],
    );

    const value = useMemo(
        () => ({ language, setLanguage, status, t }),
        [language, setLanguage, status, t],
    );

    return (
        <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    );
}

export function useLanguage(): LanguageContextValue {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used inside LanguageProvider");
    }
    return context;
}