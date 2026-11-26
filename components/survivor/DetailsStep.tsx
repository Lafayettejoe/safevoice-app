"use client";
// The short questions after the recording.

import { useState } from "react";
import {
    AGE_BANDS,
    INCIDENT_TYPES,
    TIMING_RECENCIES,
    TIMINGS_OF_DAY,
    type AgeBand,
    type IncidentType,
    type TimingOfDay,
    type TimingRecency,
} from "../../lib/report-options";
import { BrandMark } from "../shared/BrandMark";
import { useLanguage } from "./LanguageProvider";
import { SurvivorCard } from "./SurvivorCard";

export type DetailsValues = {
    ageBand: AgeBand;
    incidentTypes: IncidentType[];
    timingOfDay: TimingOfDay | null;
    timingRecency: TimingRecency | null;
};

function Choice({
    type,
    name,
    value,
    checked,
    label,
    onChange,
}: {
    type: "radio" | "checkbox";
    name: string;
    value: string;
    checked: boolean;
    label: string;
    onChange: () => void;
}) {
    return (
        <label
            className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-base ${checked
                ? "border-secondary bg-primary text-on-primary-container ring-1 ring-secondary"
                : "border-outline bg-surface-container-lowest text-on-surface"
                }`}
        >
            <input
                type={type}
                name={name}
                value={value}
                checked={checked}
                onChange={onChange}
                className="h-5 w-5 shrink-0 accent-secondary"
            />
            <span>{label}</span>
        </label>
    );
}

export function DetailsStep({
    sending,
    sendError,
    onSubmit,
    onLeave,
}: {
    sending: boolean;
    sendError: { sessionEnded: boolean } | null;
    onSubmit: (values: DetailsValues) => void;
    onLeave: () => void;
}) {
    const { language, t } = useLanguage();

    const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
    const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
    const [timingOfDay, setTimingOfDay] = useState<TimingOfDay | null>(null);
    const [timingRecency, setTimingRecency] = useState<TimingRecency | null>(null);

    function toggleIncident(type: IncidentType) {
        setIncidentTypes((current) =>
            current.includes(type)
                ? current.filter((item) => item !== type)
                : [...current, type],
        );
    }

    function submit() {
        if (ageBand === null || sending) return;
        onSubmit({ ageBand, incidentTypes, timingOfDay, timingRecency });
    }

    const sessionEnded = sendError?.sessionEnded === true;

    return (
        <SurvivorCard lang={language}>
            <BrandMark />
            <h1 className="mt-4 mb-2 text-center text-lg font-bold">
                {t("details.title")}
            </h1>

            <fieldset className="mt-6">
                <legend className="mb-2 text-base font-medium">{t("details.age")}</legend>
                <div className="flex flex-col gap-2">
                    {AGE_BANDS.map((band) => (
                        <Choice
                            key={band}
                            type="radio"
                            name="age"
                            value={band}
                            checked={ageBand === band}
                            label={t(`age.${band}`)}
                            onChange={() => setAgeBand(band)}
                        />
                    ))}
                </div>
            </fieldset>

            <fieldset className="mt-6">
                <legend className="mb-2 text-base font-medium">
                    {t("details.incident")}
                </legend>
                <div className="flex flex-col gap-2">
                    {INCIDENT_TYPES.map((type) => (
                        <Choice
                            key={type}
                            type="checkbox"
                            name="incident"
                            value={type}
                            checked={incidentTypes.includes(type)}
                            label={t(`incident.${type}`)}
                            onChange={() => toggleIncident(type)}
                        />
                    ))}
                </div>
            </fieldset>

            <fieldset className="mt-6">
                <legend className="mb-2 text-base font-medium">{t("details.when")}</legend>
                <div className="flex flex-col gap-2">
                    {TIMINGS_OF_DAY.map((timing) => (
                        <Choice
                            key={timing}
                            type="radio"
                            name="timing"
                            value={timing}
                            checked={timingOfDay === timing}
                            label={t(`timing.${timing}`)}
                            onChange={() => setTimingOfDay(timing)}
                        />
                    ))}
                </div>
                <div className="mt-3 flex flex-col gap-2">
                    {TIMING_RECENCIES.map((recency) => (
                        <Choice
                            key={recency}
                            type="radio"
                            name="recency"
                            value={recency}
                            checked={timingRecency === recency}
                            label={t(`recency.${recency}`)}
                            onChange={() => setTimingRecency(recency)}
                        />
                    ))}
                </div>
            </fieldset>

            {sendError && (
                <div
                    role="alert"
                    className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
                >
                    <p>{sessionEnded ? t("error.session") : t("details.error")}</p>
                    {sessionEnded && (
                        <button
                            type="button"
                            onClick={onLeave}
                            className="mt-2 min-h-11 rounded-lg border border-outline px-4 font-medium"
                        >
                            {t("common.retry")}
                        </button>
                    )}
                </div>
            )}

            <button
                type="button"
                onClick={submit}
                disabled={ageBand === null || sending || sessionEnded}
                className="mt-6 min-h-11 w-full rounded-lg bg-secondary px-4 text-base font-semibold text-on-secondary disabled:opacity-60"
            >
                {sending ? t("details.sending") : t("details.submit")}
            </button>
        </SurvivorCard>
    );
}