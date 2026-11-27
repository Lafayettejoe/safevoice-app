"use client";
// Needs the current URL (highlight) and open/closed state (menu and drawer).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ROLE_LABEL } from "../../lib/staff-labels";
import { LogoutButton } from "../shared/LogoutButton";

type NavItem = { href: string; label: string; icon: ReactNode; matchPrefixes: string[] };
type NavSection = { label: string; items: NavItem[] };

function Icon({ children }: { children: ReactNode }) {
    return (
        <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {children}
        </svg>
    );
}

// Only pages that exist are listed, so no link leads to a 404.
const SECTIONS: NavSection[] = [
    {
        label: "Workspace",
        items: [
            {
                href: "/dashboard",
                label: "Dashboard",
                matchPrefixes: ["/dashboard"],
                icon: (
                    <Icon>
                        <rect x="3" y="3" width="7" height="9" rx="1" />
                        <rect x="14" y="3" width="7" height="5" rx="1" />
                        <rect x="14" y="12" width="7" height="9" rx="1" />
                        <rect x="3" y="16" width="7" height="5" rx="1" />
                    </Icon>
                ),
            },
            {
                href: "/inbox",
                label: "Inbox",
                // An open report belongs to the inbox, so keep Inbox highlighted there.
                matchPrefixes: ["/inbox", "/report/"],
                icon: (
                    <Icon>
                        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                        <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" />
                    </Icon>
                ),
            },
        ],
    },
];

function Brand() {
    return (
        <div className="flex items-center gap-2.5">
            <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-on-secondary"
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
            </span>
            <span className="text-lg font-bold">SafeVoice</span>
        </div>
    );
}

function initialsOf(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("");
}

function NavSections({
    pathname,
    onNavigate,
}: {
    pathname: string;
    onNavigate?: () => void;
}) {
    return (
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
            {SECTIONS.map((section) => (
                <div key={section.label} className="mb-4">
                    <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                        {section.label}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                        {section.items.map((item) => {
                            const active = item.matchPrefixes.some((prefix) =>
                                pathname.startsWith(prefix),
                            );
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        onClick={onNavigate}
                                        aria-current={active ? "page" : undefined}
                                        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm ${active
                                            ? "bg-primary font-semibold text-on-primary-container"
                                            : "font-medium text-on-surface hover:bg-surface-container"
                                            }`}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

// The person at the bottom of the sidebar. The "..." button opens a small
// menu with Log out.
function Profile({ displayName, role }: { displayName: string; role: string }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        function onPointerDown(event: PointerEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false);
        }

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    return (
        <div ref={ref} className="relative border-t border-outline-variant p-3">
            {open && (
                <div className="absolute right-3 bottom-full left-3 mb-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-2 shadow-lg">
                    <LogoutButton />
                </div>
            )}
            <div className="flex items-center gap-3">
                <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container"
                >
                    {initialsOf(displayName)}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-on-surface-variant">
                        {ROLE_LABEL[role] ?? role}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    aria-label="Account options"
                    aria-expanded={open}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-tertiary"
                >
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="5" cy="12" r="1.8" />
                        <circle cx="12" cy="12" r="1.8" />
                        <circle cx="19" cy="12" r="1.8" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export function StaffSidebar({
    displayName,
    role,
}: {
    displayName: string;
    role: string;
}) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);

    // While the drawer is open: Escape closes it and the page behind it
    // does not scroll.
    useEffect(() => {
        if (!menuOpen) return;

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") setMenuOpen(false);
        }
        document.addEventListener("keydown", onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [menuOpen]);

    return (
        <>
            {/* Wide screens: the sidebar. */}
            <aside className="hidden border-r border-outline-variant bg-surface-container-low lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
                <div className="px-5 py-5">
                    <Brand />
                </div>
                <NavSections pathname={pathname} />
                <Profile displayName={displayName} role={role} />
            </aside>

            {/* Phones and tablets: a slim header with a menu button. */}
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-3 py-2 lg:hidden">
                <button
                    type="button"
                    onClick={() => setMenuOpen(true)}
                    aria-label="Open menu"
                    aria-expanded={menuOpen}
                    aria-controls="staff-menu"
                    className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-tertiary"
                >
                    <svg
                        aria-hidden="true"
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                    >
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <Brand />
                <span
                    aria-hidden="true"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container"
                >
                    {initialsOf(displayName)}
                </span>
            </header>

            {menuOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <button
                        type="button"
                        aria-label="Close menu"
                        tabIndex={-1}
                        onClick={() => setMenuOpen(false)}
                        className="absolute inset-0 bg-black/40"
                    />
                    <div
                        id="staff-menu"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Menu"
                        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface-container-low shadow-xl"
                    >
                        <div className="flex items-center justify-between px-4 py-4">
                            <Brand />
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setMenuOpen(false)}
                                aria-label="Close menu"
                                className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-tertiary"
                            >
                                <svg
                                    aria-hidden="true"
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                >
                                    <path d="M6 6l12 12M18 6 6 18" />
                                </svg>
                            </button>
                        </div>
                        <NavSections
                            pathname={pathname}
                            onNavigate={() => setMenuOpen(false)}
                        />
                        <Profile displayName={displayName} role={role} />
                    </div>
                </div>
            )}
        </>
    );
}