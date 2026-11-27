type Level = "LOW" | "MEDIUM" | "HIGH";

const STYLES: Record<Level, string> = {
    HIGH: "bg-on-error-container text-on-error",
    MEDIUM: "bg-error-container text-on-error-container",
    LOW: "bg-surface-container-high text-on-surface",
};

const LABELS: Record<Level, string> = {
    HIGH: "High risk",
    MEDIUM: "Medium risk",
    LOW: "Low risk",
};

export function RiskBadge({
    level,
    source,
}: {
    level: Level | null;
    source?: "HUMAN" | "AI" | null;
}) {
    if (level === null) {
        return (
            <span className="inline-flex items-center rounded-full border border-dashed border-outline px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
                Not analysed
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[level]}`}
        >
            {LABELS[level]}
            {source && (
                <span className="font-normal opacity-90">
                    · {source === "HUMAN" ? "Reviewed" : "AI"}
                </span>
            )}
        </span>
    );
}