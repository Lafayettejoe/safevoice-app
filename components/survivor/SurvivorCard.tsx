import type { ReactNode } from "react";

// The one card every survivor screen sits in, so they all look the same.
export function SurvivorCard({
    children,
    lang,
    busy,
}: {
    children?: ReactNode;
    lang?: string;
    busy?: boolean;
}) {
    return (
        <div
            lang={lang}
            aria-busy={busy}
            className="rounded-xl bg-surface-container-lowest p-6 shadow-lg sm:p-8"
        >
            {children}
        </div>
    );
}