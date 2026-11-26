// Shared by the survivor screens (browser) and the submit route (server).
// The values match the enums in prisma/schema.prisma exactly.

export const MIN_RECORDING_SECONDS = 3;
export const MAX_RECORDING_SECONDS = 300; // 5 minutes
export const AUDIO_BITS_PER_SECOND = 32000;

export const AGE_BANDS = [
    "UNDER_15",
    "AGE_15_TO_17",
    "AGE_18_TO_24",
    "AGE_25_TO_34",
    "AGE_35_PLUS",
    "PREFER_NOT_TO_SAY",
] as const;

export const INCIDENT_TYPES = [
    "SEXUAL_VIOLENCE",
    "PHYSICAL_VIOLENCE",
    "FORCED_MARRIAGE",
    "ECONOMIC_ABUSE",
    "EMOTIONAL_ABUSE",
    "OTHER",
] as const;

export const TIMINGS_OF_DAY = ["DAY", "NIGHT", "UNSURE"] as const;

export const TIMING_RECENCIES = [
    "RECENT",
    "SOME_TIME_AGO",
    "LONG_TIME_AGO",
] as const;

export type AgeBand = (typeof AGE_BANDS)[number];
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type TimingOfDay = (typeof TIMINGS_OF_DAY)[number];
export type TimingRecency = (typeof TIMING_RECENCIES)[number];