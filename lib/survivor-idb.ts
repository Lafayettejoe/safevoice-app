// IndexedDB access for the survivor flow's offline data. The offline queue
// (a later task) will store its entries under these key prefixes, so the
// panic exit already knows how to remove them.

const DB_NAME = "safevoice";
const STORE_NAME = "kv";

export const IDB_KEY_PREFIXES = {
    reportPending: "report:pending:",
    audioPending: "audio:pending:",
    refcode: "refcode:",
} as const;

// Only unsent data and reference codes are removed. A report that was already
// submitted is never touched here.
const UNSENT_PREFIXES: string[] = Object.values(IDB_KEY_PREFIXES);

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Deletes every unsent report, audio blob and reference code, for any token.
// On a shared device it is safer to remove all of them than only the current one.
export async function clearUnsentEntries(): Promise<void> {
    if (typeof indexedDB === "undefined") return;

    const database = await openDatabase();

    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const cursorRequest = store.openKeyCursor();

            cursorRequest.onsuccess = () => {
                const cursor = cursorRequest.result;
                if (!cursor) return;

                const key = String(cursor.key);
                if (UNSENT_PREFIXES.some((prefix) => key.startsWith(prefix))) {
                    store.delete(cursor.key);
                }
                cursor.continue();
            };

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        database.close();
    }
}