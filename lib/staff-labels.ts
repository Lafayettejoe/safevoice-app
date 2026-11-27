// Plain-English names for the values stored in the database.

export const STATUS_LABEL: Record<string, string> = {
    NEW: "New",
    IN_PROGRESS: "In progress",
    REFERRED: "Referred",
    CLOSED: "Closed",
};

export const INCIDENT_LABEL: Record<string, string> = {
    SEXUAL_VIOLENCE: "Sexual violence",
    PHYSICAL_VIOLENCE: "Physical violence",
    FORCED_MARRIAGE: "Forced marriage",
    ECONOMIC_ABUSE: "Economic abuse",
    EMOTIONAL_ABUSE: "Emotional abuse",
    OTHER: "Other",
};

export const ROLE_LABEL: Record<string, string> = {
    CASE_WORKER: "Case worker",
    CAMP_ADMIN: "Camp administrator",
};

export function incidentSummary(types: string[]): string {
    if (types.length === 0) return "No type chosen";
    return types.map((type) => INCIDENT_LABEL[type] ?? type).join(", ");
}