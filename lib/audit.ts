import "server-only";
import { z } from "zod";
import { db } from "./db";

// The only way to write to AuditLog. Route handlers never write to it directly.
// This file only ever CREATES rows. There is no update or delete, on purpose.

const SYSTEM_USER_EMAIL = "system@safevoice.internal";

// Metadata may never contain keys that could hold survivor identity data.
const FORBIDDEN_KEY_PARTS = [
    "name",
    "phone",
    "email",
    "contact",
    "identity",
    "address",
    "payload",
    "transcript",
    "sessiontoken",
    "iphash",
    "latitude",
    "longitude",
    "gps",
];

function isForbiddenKey(key: string): boolean {
    const normalised = key.toLowerCase().replace(/[^a-z]/g, "");
    return FORBIDDEN_KEY_PARTS.some((part) => normalised.includes(part));
}

// Flat key/value pairs only, so identity data cannot hide inside a nested object.
// Dates are converted to ISO strings.
const metadataSchema = z
    .record(
        z.string(),
        z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.null(),
            z.date().transform((d) => d.toISOString()),
        ]),
    )
    .refine((obj) => Object.keys(obj).every((key) => !isForbiddenKey(key)), {
        message: "metadata contains a key that may reference identity data",
    });

const auditEntrySchema = z.object({
    userId: z.string().min(1).optional(),
    action: z.string().regex(/^[A-Z][A-Z0-9_]*$/, "use UPPER_SNAKE_CASE"),
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    metadata: metadataSchema.optional(),
});

export type AuditEntryInput = z.input<typeof auditEntrySchema>;

let cachedSystemUserId: string | undefined;

async function getSystemUserId(): Promise<string> {
    if (cachedSystemUserId) return cachedSystemUserId;

    const systemUser = await db.user.findUnique({
        where: { email: SYSTEM_USER_EMAIL },
        select: { id: true },
    });

    if (!systemUser) {
        throw new Error("System user is missing. Run: npm run db:seed");
    }

    cachedSystemUserId = systemUser.id;
    return systemUser.id;
}

// userId is the case worker or admin who did the action.
// Leave it out for survivor actions and automatic jobs: they are logged
// under the system user.
export async function writeAuditLog(entry: AuditEntryInput): Promise<void> {
    const parsed = auditEntrySchema.parse(entry);
    const userId = parsed.userId ?? (await getSystemUserId());

    await db.auditLog.create({
        data: {
            userId,
            action: parsed.action,
            entityType: parsed.entityType,
            entityId: parsed.entityId,
            metadata: parsed.metadata,
        },
    });
}