import type { ReactNode } from "react";
import { LanguageProvider } from "../../components/survivor/LanguageProvider";

export default function SurvivorLayout({ children }: { children: ReactNode }) {
    return <LanguageProvider>{children}</LanguageProvider>;
}