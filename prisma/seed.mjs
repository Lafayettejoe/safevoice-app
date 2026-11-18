import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const db = new PrismaClient();

// The system user logs actions that have no human behind them:
// survivor submissions and automatic jobs. It can never log in:
// it is inactive and its password hash "!" matches no password.
const SYSTEM_USER_EMAIL = "system@safevoice.internal";

async function main() {
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

    console.log("Seed complete: system camp and system user are in place.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => db.$disconnect());