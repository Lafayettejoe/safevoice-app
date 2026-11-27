import "server-only";
import { writeAuditLog } from "../audit";
import { db } from "../db";
import { languageFromDb } from "../languages";
import { readAudio } from "../storage";
import { classifyReport } from "./classify";
import { transcribeAudio } from "./transcribe";

function errorName(error: unknown): string {
    return error instanceof Error ? error.name : "unknown";
}

// Transcribes a report's audio, then asks for a risk level. Any failure is
// recorded on the report and never thrown, so the survivor's report is never lost.
export async function processReport(reportId: string): Promise<void> {
    // Claim the report so two runs cannot work on it at the same time.
    const claimed = await db.report.updateMany({
        where: {
            id: reportId,
            audioFileKey: { not: null },
            transcriptionStatus: { in: ["PENDING", "FAILED"] },
        },
        data: { transcriptionStatus: "PROCESSING" },
    });
    if (claimed.count !== 1) return;

    const report = await db.report.findUnique({
        where: { id: reportId },
        select: {
            audioFileKey: true,
            language: true,
            survivorAgeBand: true,
            incidentTypes: true,
            timingOfDay: true,
            timingRecency: true,
        },
    });

    let transcript = "";
    try {
        if (!report?.audioFileKey) throw new Error("No audio");
        const audio = await readAudio(report.audioFileKey);
        transcript = await transcribeAudio(audio, languageFromDb(report.language));
    } catch (error) {
        console.error("Speech to text failed:", errorName(error));
    }

    // Nothing usable was heard: the case worker must listen to the audio.
    if (!report || transcript.length < 3) {
        await db.report.update({
            where: { id: reportId },
            data: { transcriptionStatus: "FAILED", aiClassificationStatus: "UNCLASSIFIED" },
        });
        await audit(reportId, "FAILED", "UNCLASSIFIED");
        return;
    }

    await db.report.update({
        where: { id: reportId },
        data: { transcriptText: transcript, transcriptionStatus: "COMPLETE" },
    });

    let riskStatus: "COMPLETE" | "FAILED" = "FAILED";
    try {
        const result = await classifyReport({
            transcript,
            ageBand: report.survivorAgeBand,
            incidentTypes: report.incidentTypes,
            timingOfDay: report.timingOfDay,
            timingRecency: report.timingRecency,
        });

        await db.report.update({
            where: { id: reportId },
            data: {
                aiRiskLevel: result.riskLevel,
                aiRiskRationale: result.rationale,
                aiClassificationStatus: "COMPLETE",
            },
        });
        riskStatus = "COMPLETE";
    } catch (error) {
        console.error("Risk check failed:", errorName(error));
        await db.report.update({
            where: { id: reportId },
            data: { aiClassificationStatus: "FAILED" },
        });
    }

    await audit(reportId, "COMPLETE", riskStatus);
}

// The audit log refuses keys containing words like "transcript", so the keys
// here are named textStatus and riskStatus.
async function audit(reportId: string, textStatus: string, riskStatus: string) {
    try {
        await writeAuditLog({
            action: "REPORT_AI_PROCESSED",
            entityType: "Report",
            entityId: reportId,
            metadata: { textStatus, riskStatus },
        });
    } catch (error) {
        console.error("Audit write failed:", errorName(error));
    }
}