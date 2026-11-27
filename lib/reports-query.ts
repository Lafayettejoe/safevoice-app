import "server-only";
import {
    Prisma,
    type AiClassStatus,
    type ReportStatus,
    type RiskLevel,
} from "@prisma/client";
import { db } from "./db";

export const INBOX_FILTERS = [
    "open",
    "new",
    "in_progress",
    "referred",
    "closed",
    "high",
    "unclassified",
    "child",
    "all",
] as const;

export type InboxFilter = (typeof INBOX_FILTERS)[number];

export function parseInboxFilter(value: string | undefined): InboxFilter {
    return INBOX_FILTERS.find((filter) => filter === value) ?? "open";
}

// "Open" means any report that is not closed.
const NOT_CLOSED: Prisma.ReportWhereInput = { status: { not: "CLOSED" } };

function filterWhere(filter: InboxFilter): Prisma.ReportWhereInput {
    switch (filter) {
        case "open":
            return NOT_CLOSED;
        case "new":
            return { status: "NEW" };
        case "in_progress":
            return { status: "IN_PROGRESS" };
        case "referred":
            return { status: "REFERRED" };
        case "closed":
            return { status: "CLOSED" };
        case "high":
            // The case worker's level wins. Otherwise the AI's level counts.
            return {
                AND: [
                    NOT_CLOSED,
                    {
                        OR: [
                            { humanRiskLevel: "HIGH" },
                            { humanRiskLevel: null, aiRiskLevel: "HIGH" },
                        ],
                    },
                ],
            };
        case "unclassified":
            return {
                AND: [
                    NOT_CLOSED,
                    {
                        humanRiskLevel: null,
                        aiClassificationStatus: {
                            in: ["PENDING", "FAILED", "UNCLASSIFIED"],
                        },
                    },
                ],
            };
        case "child":
            return { AND: [NOT_CLOSED, { childProtectionFlag: true }] };
        case "all":
            return {};
    }
}

const ROW_SELECT = {
    id: true,
    referenceCode: true,
    submittedAt: true,
    status: true,
    humanRiskLevel: true,
    aiRiskLevel: true,
    aiClassificationStatus: true,
    childProtectionFlag: true,
    incidentTypes: true,
} satisfies Prisma.ReportSelect;

export type ReportRow = {
    id: string;
    referenceCode: string;
    submittedAt: Date;
    status: ReportStatus;
    risk: RiskLevel | null;
    riskSource: "HUMAN" | "AI" | null;
    aiStatus: AiClassStatus;
    childProtectionFlag: boolean;
    incidentTypes: string[];
};

function toRow(row: Prisma.ReportGetPayload<{ select: typeof ROW_SELECT }>): ReportRow {
    return {
        id: row.id,
        referenceCode: row.referenceCode,
        submittedAt: row.submittedAt,
        status: row.status,
        risk: row.humanRiskLevel ?? row.aiRiskLevel,
        riskSource: row.humanRiskLevel ? "HUMAN" : row.aiRiskLevel ? "AI" : null,
        aiStatus: row.aiClassificationStatus,
        childProtectionFlag: row.childProtectionFlag,
        incidentTypes: row.incidentTypes,
    };
}

// DRAFT urgency order: child protection first, then risk, then the report
// that has waited longest. A report with no risk level yet is ranked like
// MEDIUM so a failed analysis never buries it.
function riskRank(risk: RiskLevel | null): number {
    if (risk === "HIGH") return 3;
    if (risk === null || risk === "MEDIUM") return 2;
    return 1;
}

function sortByUrgency(rows: ReportRow[]): ReportRow[] {
    return [...rows].sort((a, b) => {
        if (a.childProtectionFlag !== b.childProtectionFlag) {
            return a.childProtectionFlag ? -1 : 1;
        }
        const rankDifference = riskRank(b.risk) - riskRank(a.risk);
        if (rankDifference !== 0) return rankDifference;
        return a.submittedAt.getTime() - b.submittedAt.getTime();
    });
}

// Reports for one camp. The camp always comes from the logged-in user.
export async function getInbox(
    campId: string,
    filter: InboxFilter,
    limit = 100,
): Promise<ReportRow[]> {
    const where = { campId, ...filterWhere(filter) };

    // Finished work is shown newest first. Everything else by urgency.
    if (filter === "closed" || filter === "all") {
        const rows = await db.report.findMany({
            where,
            select: ROW_SELECT,
            orderBy: { submittedAt: "desc" },
            take: limit,
        });
        return rows.map(toRow);
    }

    const rows = await db.report.findMany({
        where,
        select: ROW_SELECT,
        orderBy: { submittedAt: "asc" },
        take: 500,
    });
    return sortByUrgency(rows.map(toRow)).slice(0, limit);
}

export type DashboardData = {
    counts: Record<"new" | "inProgress" | "referred" | "high" | "child" | "unclassified", number>;
    urgent: ReportRow[];
};

export async function getDashboard(campId: string): Promise<DashboardData> {
    const count = (filter: InboxFilter) =>
        db.report.count({ where: { campId, ...filterWhere(filter) } });

    const [newCount, inProgress, referred, high, child, unclassified, urgent] =
        await Promise.all([
            count("new"),
            count("in_progress"),
            count("referred"),
            count("high"),
            count("child"),
            count("unclassified"),
            getInbox(campId, "open", 5),
        ]);

    return {
        counts: { new: newCount, inProgress, referred, high, child, unclassified },
        urgent,
    };
}