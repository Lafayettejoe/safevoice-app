import pkg from "@prisma/client";
import bcrypt from "bcryptjs";

const { PrismaClient } = pkg;
const db = new PrismaClient();

const BCRYPT_ROUNDS = 12;

// The system user logs actions that have no human behind them:
// survivor submissions and automatic jobs. It can never log in:
// it is inactive and its password hash "!" matches no password.
const SYSTEM_USER_EMAIL = "system@safevoice.internal";

async function seedSystemUser() {
    const systemCamp = await db.camp.upsert({
        where: { id: "system-camp" },
        update: {},
        create: {
            id: "system-camp",
            name: "SafeVoice System (internal)",
            region: "internal",
        },
    });

    await db.user.upsert({
        where: { email: SYSTEM_USER_EMAIL },
        update: {},
        create: {
            email: SYSTEM_USER_EMAIL,
            passwordHash: "!",
            role: "CASE_WORKER",
            displayName: "System",
            isActive: false,
            campId: systemCamp.id,
        },
    });

    console.log("System camp and system user are in place.");
}

// Demo data for development and the capstone demo. Fictional people only.
async function seedDemoUsers() {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const caseWorkerPassword = process.env.SEED_CASEWORKER_PASSWORD;

    if (!adminPassword || !caseWorkerPassword) {
        console.log(
            "Skipped demo users: set SEED_ADMIN_PASSWORD and SEED_CASEWORKER_PASSWORD in .env",
        );
        return;
    }

    const demoCamp = await db.camp.upsert({
        where: { id: "demo-camp" },
        update: {},
        create: {
            id: "demo-camp",
            name: "Demo IDP Camp",
            region: "Borno",
            defaultLanguage: "HAUSA",
        },
    });

    await db.user.upsert({
        where: { email: "admin@demo.safevoice.test" },
        update: {},
        create: {
            email: "admin@demo.safevoice.test",
            passwordHash: await bcrypt.hash(adminPassword, BCRYPT_ROUNDS),
            role: "CAMP_ADMIN",
            displayName: "Demo Camp Admin",
            campId: demoCamp.id,
        },
    });

    await db.user.upsert({
        where: { email: "caseworker@demo.safevoice.test" },
        update: {},
        create: {
            email: "caseworker@demo.safevoice.test",
            passwordHash: await bcrypt.hash(caseWorkerPassword, BCRYPT_ROUNDS),
            role: "CASE_WORKER",
            displayName: "Demo Case Worker",
            campId: demoCamp.id,
        },
    });

    console.log("Demo camp, admin and case worker are in place.");
}

async function main() {
    await seedSystemUser();
    await seedDemoUsers();
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => db.$disconnect());