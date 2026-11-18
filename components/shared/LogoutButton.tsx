"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
    const router = useRouter();

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
    }

    return (
        <button
            type="button"
            onClick={handleLogout}
            className="min-h-11 rounded-md border border-outline px-4 font-medium"
        >
            Log out
        </button>
    );
}