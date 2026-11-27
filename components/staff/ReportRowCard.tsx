import Link from "next/link";
import { formatDateTime } from "../../lib/format";
import type { ReportRow } from "../../lib/reports-query";
import { incidentSummary, STATUS_LABEL } from "../../lib/staff-labels";
import { RiskBadge } from "./RiskBadge";

export function ReportRowCard({ row }: { row: ReportRow }) {
    const analysisNote =
        row.aiStatus === "FAILED" || row.aiStatus === "UNCLASSIFIED"
            ? "Analysis failed. Listen to the audio."
            : row.aiStatus === "PENDING"
                ? "Analysis in progress."
                : null;

    return (
        <Link
            href={`/report/${row.id}`}
            className="block rounded-xl bg-surface-container-lowest p-4 shadow-sm hover:shadow-md focus-visible:outline-2 focus-visible:outline-tertiary"
        >
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold">{row.referenceCode}</span>
                <RiskBadge level={row.risk} source={row.riskSource} />
                {row.childProtectionFlag && (
                    <span className="inline-flex items-center rounded-full bg-inverse-surface px-2.5 py-0.5 text-xs font-semibold text-inverse-on-surface">
                        Child protection
                    </span>
                )}
            </div>
            <p className="mt-2 text-sm text-on-surface-variant">
                {incidentSummary(row.incidentTypes)}
            </p>
            {analysisNote && (
                <p className="mt-1 text-xs text-on-surface-variant">{analysisNote}</p>
            )}
            <p className="mt-2 text-xs text-on-surface-variant">
                {STATUS_LABEL[row.status] ?? row.status} · {formatDateTime(row.submittedAt)}
            </p>
        </Link>
    );
}