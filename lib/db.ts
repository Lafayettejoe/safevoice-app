import "server-only";
import { PrismaClient } from "@prisma/client";

// Next.js dev mode reloads files often. Keeping the client on globalThis
// stops it from opening a new database connection on every reload.
// The cast is needed because TypeScript does not know about our custom property.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = db;
}