import Link from "next/link";
import { redirect } from "next/navigation";
import { ReportRowCard } from "../../../components/staff/ReportRowCard";
import { getCurrentUser } from "../../../lib/auth";
import { getDashboard, type InboxFilter } from "../../../lib/reports-query";

type Card = { label: string; filter: InboxFilter; value: number; emphasis?: boolean };

export default async function DashboardPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const { counts, urgent } = await getDashboard(user.campId);

    const cards: Card[] = [
        { label: "New reports", filter: "new", value: counts.new },
        { label: "In progress", filter: "in_progress", value: counts.inProgress },
        { label: "High risk", filter: "high", value: counts.high, emphasis: true },
        { label: "Child protection", filter: "child", value: counts.child, emphasis: true },
        { label: "Not analysed", filter: "unclassified", value: counts.unclassified },
        { label: "Referred", filter: "referred", value: counts.referred },
    ];

    return (
        <>
            <h1 className="text-2xl font-bold">Welcome, {user.displayName}</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
                Open reports for your camp. High risk and child protection reports come first.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
                {cards.map((card) => (
                    <Link
                        key={card.label}
                        href={`/inbox?filter=${card.filter}`}
                        className="rounded-xl bg-surface-container-lowest p-4 shadow-sm hover:shadow-md focus-visible:outline-2 focus-visible:outline-tertiary"
                    >
                        <p
                            className={`text-3xl font-bold ${card.emphasis && card.value > 0 ? "text-on-error-container" : ""
                                }`}
                        >
                            {card.value}
                        </p>
                        <p className="mt-1 text-sm text-on-surface-variant">{card.label}</p>
                    </Link>
                ))}
            </div>

            <div className="mt-8 flex items-center justify-between">
                <h2 className="text-lg font-bold">Needs attention first</h2>
                <Link href="/inbox" className="text-sm font-medium text-secondary underline">
                    View all
                </Link>
            </div>

            <div className="mt-3 flex flex-col gap-3">
                {urgent.length === 0 ? (
                    <p className="rounded-xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
                        No open reports. New reports will appear here.
                    </p>
                ) : (
                    urgent.map((row) => <ReportRowCard key={row.id} row={row} />)
                )}
            </div>
        </>
    );
}