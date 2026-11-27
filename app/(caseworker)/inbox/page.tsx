import Link from "next/link";
import { redirect } from "next/navigation";
import { ReportRowCard } from "../../../components/staff/ReportRowCard";
import { getCurrentUser } from "../../../lib/auth";
import {
    getInbox,
    parseInboxFilter,
    type InboxFilter,
} from "../../../lib/reports-query";

const TABS: { filter: InboxFilter; label: string }[] = [
    { filter: "open", label: "Open" },
    { filter: "new", label: "New" },
    { filter: "in_progress", label: "In progress" },
    { filter: "referred", label: "Referred" },
    { filter: "high", label: "High risk" },
    { filter: "child", label: "Child protection" },
    { filter: "unclassified", label: "Not analysed" },
    { filter: "closed", label: "Closed" },
    { filter: "all", label: "All" },
];

export default async function InboxPage({
    searchParams,
}: {
    searchParams: Promise<{ filter?: string }>;
}) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const { filter: rawFilter } = await searchParams;
    const filter = parseInboxFilter(rawFilter);
    const rows = await getInbox(user.campId, filter);

    return (
        <>
            <h1 className="text-2xl font-bold">Inbox</h1>

            <nav aria-label="Filter reports" className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {TABS.map((tab) => {
                    const active = tab.filter === filter;
                    return (
                        <Link
                            key={tab.filter}
                            href={tab.filter === "open" ? "/inbox" : `/inbox?filter=${tab.filter}`}
                            aria-current={active ? "page" : undefined}
                            className={`flex min-h-11 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap ${active
                                ? "border-secondary bg-primary text-on-primary-container"
                                : "border-outline bg-surface-container-lowest text-on-surface"
                                }`}
                        >
                            {tab.label}
                        </Link>
                    );
                })}
            </nav>

            <p className="mt-4 text-sm text-on-surface-variant">
                {rows.length} {rows.length === 1 ? "report" : "reports"}
            </p>

            <div className="mt-3 flex flex-col gap-3">
                {rows.length === 0 ? (
                    <p className="rounded-xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
                        No reports here.
                    </p>
                ) : (
                    rows.map((row) => <ReportRowCard key={row.id} row={row} />)
                )}
            </div>
        </>
    );
}