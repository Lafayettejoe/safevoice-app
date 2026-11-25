"use client";
// Clears browser storage and redirects, so it must run in the browser.

import { useState } from "react";
import { runPanicExit } from "../../lib/panic";
import { useLanguage } from "./LanguageProvider";

export function PanicExitButton() {
    const { language, status, t } = useLanguage();
    const [exiting, setExiting] = useState(false);

    function handleClick() {
        if (exiting) return;
        setExiting(true);
        void runPanicExit();
    }

    // The fill is the dark red from the design system (on-error-container). The
    // standard error red with white text measures 4.49:1, just under the 4.5:1
    // AA minimum. This dark red measures 9.4:1, and it is the only red element
    // on the survivor screens, so it stands out.
    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label="Exit now. Clears this session and leaves SafeVoice."
            lang={language}
            className="fixed right-3 bottom-3 z-50 flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-on-error-container px-5 text-base font-bold text-on-error shadow-lg ring-2 ring-surface-container-lowest"
        >
            <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            >
                <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            {status === "ready" && <span>{t("panic.exit")}</span>}
        </button>
    );
}