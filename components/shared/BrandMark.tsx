export function BrandMark() {
    return (
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-secondary text-on-secondary">
            <svg
                role="img"
                aria-label="SafeVoice"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
        </div>
    );
}