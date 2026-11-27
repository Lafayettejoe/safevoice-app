import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { StaffSidebar } from "../../components/staff/StaffSidebar";
import { getCurrentUser } from "../../lib/auth";

export default async function StaffLayout({ children }: { children: ReactNode }) {
    // The gate in proxy.ts already blocks visitors. This is the second lock.
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    return (
        <div className="min-h-screen lg:flex">
            <StaffSidebar displayName={user.displayName} role={user.role} />
            <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
                <div className="mx-auto max-w-5xl">{children}</div>
            </main>
        </div>
    );
}