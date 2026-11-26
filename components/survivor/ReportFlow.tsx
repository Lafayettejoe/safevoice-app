"use client";
// Holds the survivor's report in memory while she moves between steps.
// Nothing here is saved in the browser.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { runPanicExit } from "../../lib/panic";
import {
    clearSurvivorStorage,
    readSessionToken,
} from "../../lib/survivor-storage";
import { BrandMark } from "../shared/BrandMark";
import { DetailsStep, type DetailsValues } from "./DetailsStep";
import { useLanguage } from "./LanguageProvider";
import { RecordStep, type RecordedAudio } from "./RecordStep";
import { SurvivorCard } from "./SurvivorCard";

type Step =
    | { kind: "record" }
    | { kind: "details"; audio: RecordedAudio }
    | { kind: "done"; referenceCode: string };

type SendError = { sessionEnded: boolean } | null;

type ReportResponse = {
    data?: { referenceCode?: string };
    error?: { code?: string };
};

export function ReportFlow() {
    const router = useRouter();
    const { language, t } = useLanguage();
    const [step, setStep] = useState<Step>({ kind: "record" });
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<SendError>(null);

    // No token means the page was opened directly or the tab was reset.
    useEffect(() => {
        if (readSessionToken() === null) router.replace("/");
    }, [router]);

    async function send(audio: RecordedAudio, values: DetailsValues) {
        const token = readSessionToken();
        if (token === null) {
            router.replace("/");
            return;
        }

        setSending(true);
        setSendError(null);

        try {
            const form = new FormData();
            form.append("audio", audio.blob, "recording");
            form.append(
                "fields",
                JSON.stringify({
                    language,
                    ageBand: values.ageBand,
                    incidentTypes: values.incidentTypes,
                    timingOfDay: values.timingOfDay,
                    timingRecency: values.timingRecency,
                    durationSeconds: audio.seconds,
                }),
            );

            const response = await fetch("/api/report", {
                method: "POST",
                headers: { "x-session-token": token },
                body: form,
            });
            const result: ReportResponse = await response.json();

            const referenceCode = result.data?.referenceCode;
            if (response.ok && referenceCode) {
                // The recording is dropped from memory when this step is replaced.
                setStep({ kind: "done", referenceCode });
                return;
            }

            const code = result.error?.code ?? "";
            setSendError({ sessionEnded: code.startsWith("SESSION_TOKEN") });
        } catch {
            setSendError({ sessionEnded: false });
        } finally {
            setSending(false);
        }
    }

    // Starting again after an expired session: nothing is kept.
    function leave() {
        clearSurvivorStorage();
        router.replace("/");
    }

    if (step.kind === "record") {
        return (
            <RecordStep onContinue={(audio) => setStep({ kind: "details", audio })} />
        );
    }

    if (step.kind === "details") {
        const { audio } = step;
        return (
            <DetailsStep
                sending={sending}
                sendError={sendError}
                onSubmit={(values) => void send(audio, values)}
                onLeave={leave}
            />
        );
    }

    return (
        <SurvivorCard lang={language}>
            <BrandMark />
            <h1 className="mt-4 mb-6 text-center text-lg font-bold">
                {t("done.title")}
            </h1>

            <p className="text-sm font-medium text-on-surface-variant">
                {t("done.codeLabel")}
            </p>
            <p className="mt-1 rounded-lg bg-surface-container px-3 py-3 text-center font-mono text-2xl font-bold tracking-wider select-all">
                {step.referenceCode}
            </p>
            <p className="mt-3 text-base">{t("done.codeHint")}</p>

            {/* Same exit as the Exit button: clears everything and leaves. */}
            <button
                type="button"
                onClick={() => void runPanicExit()}
                className="mt-6 min-h-11 w-full rounded-lg bg-secondary px-4 text-base font-semibold text-on-secondary"
            >
                {t("done.leave")}
            </button>
        </SurvivorCard>
    );
}