-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'HAUSA', 'YORUBA', 'IGBO', 'PIDGIN');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CASE_WORKER', 'CAMP_ADMIN');

-- CreateEnum
CREATE TYPE "AgeBand" AS ENUM ('UNDER_15', 'AGE_15_TO_17', 'AGE_18_TO_24', 'AGE_25_TO_34', 'AGE_35_PLUS', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('SEXUAL_VIOLENCE', 'PHYSICAL_VIOLENCE', 'FORCED_MARRIAGE', 'ECONOMIC_ABUSE', 'EMOTIONAL_ABUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "TimingOfDay" AS ENUM ('DAY', 'NIGHT', 'UNSURE');

-- CreateEnum
CREATE TYPE "TimingRecency" AS ENUM ('RECENT', 'SOME_TIME_AGO', 'LONG_TIME_AGO');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "AiClassStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'REFERRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'CONTACTED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('MEDICAL', 'PSYCHOSOCIAL', 'LEGAL', 'SHELTER', 'CHILD_PROTECTION', 'LIVELIHOOD', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "PreWrittenStatus" AS ENUM ('CASE_RECEIVED', 'CASE_ASSIGNED', 'REFERRAL_MADE', 'REFERRAL_FAILED', 'CASE_CLOSED');

-- CreateEnum
CREATE TYPE "EscalationContactType" AS ENUM ('CAMP_ADMIN', 'UNFPA_GBV_AOR', 'NAPTIP_STATE', 'POLICE_GBV_UNIT');

-- CreateTable
CREATE TABLE "Camp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "defaultLanguage" "Language" NOT NULL DEFAULT 'HAUSA',
    "panicRedirectUrl" TEXT NOT NULL DEFAULT 'https://weather.com',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "campId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedViaProxy" BOOLEAN NOT NULL DEFAULT false,
    "proxyConsentRecorded" BOOLEAN NOT NULL DEFAULT false,
    "sessionToken" TEXT NOT NULL,
    "survivorAgeBand" "AgeBand" NOT NULL,
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "incidentTypes" "IncidentType"[],
    "timingOfDay" "TimingOfDay",
    "timingRecency" "TimingRecency",
    "language" "Language" NOT NULL,
    "audioFileKey" TEXT,
    "audioDurationSeconds" INTEGER,
    "transcriptionStatus" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "transcriptText" TEXT,
    "aiRiskLevel" "RiskLevel",
    "aiRiskRationale" TEXT,
    "aiClassificationStatus" "AiClassStatus" NOT NULL DEFAULT 'PENDING',
    "humanRiskLevel" "RiskLevel",
    "status" "ReportStatus" NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closureReason" TEXT,
    "childProtectionFlag" BOOLEAN NOT NULL DEFAULT false,
    "proxyNotes" TEXT,
    "submittedOffline" BOOLEAN NOT NULL DEFAULT false,
    "audioSyncComplete" BOOLEAN NOT NULL DEFAULT false,
    "scheduledDeletionAt" TIMESTAMP(3) NOT NULL,
    "deletionHeld" BOOLEAN NOT NULL DEFAULT false,
    "survivorIdentityId" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurvivorIdentity" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "identityPayload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurvivorIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurvivorContact" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "channel" "ContactChannel" NOT NULL,
    "contactPayload" TEXT NOT NULL,
    "safetyWarningAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurvivorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportStatusUpdate" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "status" "PreWrittenStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportStatusUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralPartner" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "contactMethod" TEXT NOT NULL,
    "operatingHours" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "referralPartnerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationContact" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "contactType" "EscalationContactType" NOT NULL,
    "name" TEXT NOT NULL,
    "contactMethod" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscalationContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationLog" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "escalationLevel" INTEGER NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactType" "EscalationContactType" NOT NULL,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EscalationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskOverride" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "caseWorkerId" TEXT NOT NULL,
    "originalRisk" "RiskLevel",
    "overriddenTo" "RiskLevel" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymousSessionToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousSessionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Camp_region_idx" ON "Camp"("region");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_campId_idx" ON "User"("campId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_sessionToken_key" ON "ConsentRecord"("sessionToken");

-- CreateIndex
CREATE INDEX "ConsentRecord_sessionToken_idx" ON "ConsentRecord"("sessionToken");

-- CreateIndex
CREATE INDEX "ConsentRecord_confirmedAt_idx" ON "ConsentRecord"("confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_referenceCode_key" ON "Report"("referenceCode");

-- CreateIndex
CREATE INDEX "Report_campId_status_idx" ON "Report"("campId", "status");

-- CreateIndex
CREATE INDEX "Report_campId_aiRiskLevel_idx" ON "Report"("campId", "aiRiskLevel");

-- CreateIndex
CREATE INDEX "Report_referenceCode_idx" ON "Report"("referenceCode");

-- CreateIndex
CREATE INDEX "Report_childProtectionFlag_idx" ON "Report"("childProtectionFlag");

-- CreateIndex
CREATE INDEX "Report_scheduledDeletionAt_idx" ON "Report"("scheduledDeletionAt");

-- CreateIndex
CREATE INDEX "Report_submittedAt_idx" ON "Report"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_sessionToken_key" ON "Report"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "SurvivorIdentity_reportId_key" ON "SurvivorIdentity"("reportId");

-- CreateIndex
CREATE INDEX "SurvivorIdentity_reportId_idx" ON "SurvivorIdentity"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "SurvivorContact_reportId_key" ON "SurvivorContact"("reportId");

-- CreateIndex
CREATE INDEX "SurvivorContact_reportId_idx" ON "SurvivorContact"("reportId");

-- CreateIndex
CREATE INDEX "ReportStatusUpdate_reportId_idx" ON "ReportStatusUpdate"("reportId");

-- CreateIndex
CREATE INDEX "ReferralPartner_campId_isActive_idx" ON "ReferralPartner"("campId", "isActive");

-- CreateIndex
CREATE INDEX "Referral_reportId_idx" ON "Referral"("reportId");

-- CreateIndex
CREATE INDEX "Referral_referralPartnerId_idx" ON "Referral"("referralPartnerId");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE INDEX "EscalationContact_campId_contactType_idx" ON "EscalationContact"("campId", "contactType");

-- CreateIndex
CREATE INDEX "EscalationLog_reportId_idx" ON "EscalationLog"("reportId");

-- CreateIndex
CREATE INDEX "EscalationLog_triggeredAt_idx" ON "EscalationLog"("triggeredAt");

-- CreateIndex
CREATE INDEX "RiskOverride_reportId_idx" ON "RiskOverride"("reportId");

-- CreateIndex
CREATE INDEX "RiskOverride_caseWorkerId_idx" ON "RiskOverride"("caseWorkerId");

-- CreateIndex
CREATE INDEX "RiskOverride_createdAt_idx" ON "RiskOverride"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousSessionToken_token_key" ON "AnonymousSessionToken"("token");

-- CreateIndex
CREATE INDEX "AnonymousSessionToken_token_idx" ON "AnonymousSessionToken"("token");

-- CreateIndex
CREATE INDEX "AnonymousSessionToken_expiresAt_idx" ON "AnonymousSessionToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportStatusUpdate" ADD CONSTRAINT "ReportStatusUpdate_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPartner" ADD CONSTRAINT "ReferralPartner_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referralPartnerId_fkey" FOREIGN KEY ("referralPartnerId") REFERENCES "ReferralPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationContact" ADD CONSTRAINT "EscalationContact_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationLog" ADD CONSTRAINT "EscalationLog_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskOverride" ADD CONSTRAINT "RiskOverride_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskOverride" ADD CONSTRAINT "RiskOverride_caseWorkerId_fkey" FOREIGN KEY ("caseWorkerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonymousSessionToken" ADD CONSTRAINT "AnonymousSessionToken_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
