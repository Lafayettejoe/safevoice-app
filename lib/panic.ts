import { clearUnsentEntries } from "./survivor-idb";
import { readPanicUrl } from "./survivor-storage";

// PRD default decoy page: a public weather service. Each camp can set its own.
export const DEFAULT_DECOY_URL = "https://weather.com";

function isHttpsUrl(value: string): boolean {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}

export function resolveDecoyUrl(): string {
    const stored = readPanicUrl();
    return stored !== null && isHttpsUrl(stored) ? stored : DEFAULT_DECOY_URL;
}

function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// The four steps run in order. A failure in any step must never stop the
// redirect, because leaving the page is the whole point.
export async function runPanicExit(): Promise<void> {
    // Read the destination first, because step 2 wipes it.
    const decoyUrl = resolveDecoyUrl();

    // Step 1, React state: the full-page replace in step 4 discards everything
    // held in memory, so there is nothing to reset by hand.

    // Step 2: clear sessionStorage.
    try {
        window.sessionStorage.clear();
    } catch {
        // Blocked storage holds nothing to clear.
    }

    // Step 3: delete unsent reports, audio and reference codes. Gives up after
    // one second so a stuck database cannot trap the survivor on the page.
    try {
        await Promise.race([clearUnsentEntries(), wait(1000)]);
    } catch {
        // Carry on to the redirect.
    }

    // Step 4: replace() removes SafeVoice from the history, unlike push().
    window.location.replace(decoyUrl);
}