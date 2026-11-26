import { z } from "zod";
import { isEnabledLanguage, type LanguageCode } from "./languages";
import {
    AGE_BANDS,
    INCIDENT_TYPES,
    MAX_RECORDING_SECONDS,
    MIN_RECORDING_SECONDS,
    TIMING_RECENCIES,
    TIMINGS_OF_DAY,
} from "./report-options";

// What the survivor's phone is allowed to send with the recording.
export const reportFieldsSchema = z.object({
    language: z.custom<LanguageCode>(
        (value) => typeof value === "string" && isEnabledLanguage(value),
    ),
    ageBand: z.enum(AGE_BANDS),
    incidentTypes: z.array(z.enum(INCIDENT_TYPES)).max(INCIDENT_TYPES.length).default([]),
    timingOfDay: z.enum(TIMINGS_OF_DAY).nullable().default(null),
    timingRecency: z.enum(TIMING_RECENCIES).nullable().default(null),
    durationSeconds: z
        .number()
        .int()
        .min(MIN_RECORDING_SECONDS)
        .max(MAX_RECORDING_SECONDS),
});

export type ReportFields = z.infer<typeof reportFieldsSchema>;