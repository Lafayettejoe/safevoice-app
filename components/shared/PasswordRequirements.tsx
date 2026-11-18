import { PASSWORD_RULES } from "../../lib/password-policy";

// Live checklist shown under a password field while someone creates a password.
export function PasswordRequirements({ password }: { password: string }) {
    return (
        <ul aria-label="Password requirements" className="mt-2 flex flex-col gap-1 text-sm">
            {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                    <li
                        key={rule.id}
                        className={`flex items-center gap-2 ${met ? "text-secondary" : "text-on-surface-variant"
                            }`}
                    >
                        <svg
                            aria-hidden="true"
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            {met ? <path d="M3 8.5l3.5 3.5L13 4.5" /> : <circle cx="8" cy="8" r="5" />}
                        </svg>
                        <span>
                            {rule.label}
                            <span className="sr-only">{met ? " (met)" : " (not met)"}</span>
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}