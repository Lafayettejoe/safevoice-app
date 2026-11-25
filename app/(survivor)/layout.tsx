import type { ReactNode } from "react";
import { LanguageProvider } from "../../components/survivor/LanguageProvider";
import { PanicExitButton } from "../../components/survivor/PanicExitButton";

// Every survivor page sits inside this shell. The bottom padding is always
// reserved for the fixed exit button, so page content never hides under it.
export default function SurvivorLayout({ children }: { children: ReactNode }) {
    return (
        <LanguageProvider>
            <div className="flex min-h-screen flex-col pb-20">
                <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-4 sm:py-8">
                    {children}
                </main>
            </div>
            <PanicExitButton />
        </LanguageProvider>
    );
}