import { isEnabledLanguage, type LanguageCode } from "./languages";

// Everything the survivor flow keeps in the browser lives in sessionStorage,
// which is wiped when the tab closes. Never localStorage, never cookies.

const TOKEN_KEY = "sv_token";
const LANGUAGE_KEY = "sv_lang";
const PANIC_URL_KEY = "sv_panic_url";

function getStorage(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.sessionStorage;
    } catch {
        // Some private browsing modes block storage entirely.
        return null;
    }
}

function safeSet(key: string, value: string): void {
    try {
        getStorage()?.setItem(key, value);
    } catch {
        // Storage full or blocked: the flow still works for this page.
    }
}

export function readStoredLanguage(): LanguageCode | null {
    const value = getStorage()?.getItem(LANGUAGE_KEY) ?? null;
    return value !== null && isEnabledLanguage(value) ? value : null;
}

export function storeLanguage(code: LanguageCode): void {
    safeSet(LANGUAGE_KEY, code);
}

export function readSessionToken(): string | null {
    return getStorage()?.getItem(TOKEN_KEY) ?? null;
}

export function storeSessionToken(token: string): void {
    safeSet(TOKEN_KEY, token);
}

// The camp's decoy page for the panic exit.
export function readPanicUrl(): string | null {
    return getStorage()?.getItem(PANIC_URL_KEY) ?? null;
}

export function storePanicUrl(url: string): void {
    safeSet(PANIC_URL_KEY, url);
}

// Used by "withdraw": leaves nothing behind.
export function clearSurvivorStorage(): void {
    const storage = getStorage();
    storage?.removeItem(TOKEN_KEY);
    storage?.removeItem(LANGUAGE_KEY);
    storage?.removeItem(PANIC_URL_KEY);
}