// Dates on staff screens are shown in Nigerian time.
const dateTime = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
});

const dateOnly = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
});

const fullDate = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: "Africa/Lagos",
});

export function formatDateTime(date: Date): string {
    return dateTime.format(date);
}

export function formatToday(): string {
    return fullDate.format(new Date());
}

// "5 min ago", "3 h ago", "2 d ago". Older than a week shows the date.
export function timeAgo(date: Date, now: Date = new Date()): string {
    const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} d ago`;
    return dateOnly.format(date);
}