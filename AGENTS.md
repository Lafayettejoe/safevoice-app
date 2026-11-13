AGENTS.md — SafeVoice

## SECTION 1: WHAT IS THIS PROJECT

SafeVoice is a low-data, high-safety progressive web application that lets
women and girls in Nigerian IDP camps report gender-based violence (GBV) by
voice and get referred to support services. It is built for survivors who
may not own a phone, cannot read or write, and only have 2G connectivity.

**Version being built:** Phase 1 MVP only.

**Source of truth:** SafeVoice PRD v2.0 (July 2026). Every feature you build
must trace back to a requirement in that document. If it does not, do not
build it.

**Four user types:**

| User | Has account? | Language |
|---|---|---|
| Survivor | Never | Chosen at first screen |
| Trusted Proxy | Never | Chosen at first screen |
| Case Worker | Yes — JWT | English / Hausa |
| Camp Administrator | Yes — JWT | English |

**Five supported languages in MVP:** English, Hausa, Yoruba, Igbo,
Nigerian Pidgin. No other languages. Kanuri and Fulfulde are Phase 2.

---

## SECTION 2: WHAT IS LOCKED

Do not change, swap, upgrade, or replace any item in this list. If you think
a better option exists, stop and flag it. Do not act on that opinion.

### Framework and language

- **Next.js App Router** — all routing lives here. No Pages Router.
- **TypeScript strict mode** — no `any` types, no type assertions without
  a comment explaining why.
- **Tailwind CSS** — all styling. No CSS-in-JS libraries. No plain CSS files
  except global resets.

### Data layer

- **Prisma** — the only way to talk to the database. No raw SQL except the
  single GIN index migration (see Section 4).
- **PostgreSQL** — the only database. No SQLite, no Redis as a primary store.
- **Schema:** Use the exact schema from PRD Section 10. Do not add models,
  remove models, rename fields, or change enum values without a documented
  change request. The `@@unique([sessionToken])` constraint on `Report` and
  the `@relation` declarations on `ConsentRecord` and `AnonymousSessionToken`
  must exist. Do not remove them.

### AI services

- **OpenAI Whisper large-v3** — transcription only. No other model.
- **GPT-4o mini** — risk classification only. No other model.
- Both are called through wrapper functions in `lib/ai/`. No route handler
  calls an AI service directly.

### Storage

- **AWS S3** (or equivalent object store) — audio files only. Encrypted
  at rest with AES-256. Private ACLs. No public buckets. No public URLs.

### PWA

- **next-pwa (Workbox)** — service worker management. No other PWA library.

### Encryption

- **AES-256-GCM** — application-layer encryption for `SurvivorIdentity`
  and `SurvivorContact`. Implemented in `lib/crypto.ts` only.
- **TLS 1.3** — all data in transit.

### Input validation

- **Zod** — all API route input validation and AuditLog metadata validation.
  No other validation library.

### Auth

- **JWT** — case worker and admin authentication. Anonymous session tokens
  for survivor submissions. No OAuth, no third-party auth provider in MVP.

### Audio format

- **WebM/Opus at 32kbps** — the only format captured and uploaded.
  No MP3, no WAV, no AAC.

### Browser targets

| Browser | Minimum |
|---|---|
| Chrome for Android | 90+ on Android 8.0+ |
| Samsung Internet | 14+ |
| Firefox for Android | 90+ |
| Chrome desktop | 90+ |
| Firefox desktop | 90+ |
| Safari iOS | **Not supported in MVP. Do not write iOS-specific code.** |

### Dashboard polling

- **30-second interval** — the case worker dashboard polls for new reports
  every 30 seconds. Do not implement WebSockets. WebSocket push is Phase 2.

---

## SECTION 3: WHAT MUST NEVER HAPPEN

**Breaking any rule in this section means the task has failed, even if the
code compiles and the feature appears to work.**

References in parentheses point to PRD requirement numbers.

---

### Consent and data collection

**RULE-01** — Never store any data about a survivor or proxy before a
`ConsentRecord` exists in the database for that session token. The consent
screen must come first. There are no exceptions. (FR-001, FR-002, Goal 11)

**RULE-02** — Never allow the API to accept a report submission from a
session token that does not have a matching `ConsentRecord` in the database.
Check this server-side on every report submission. A UI bug must not bypass
this check. (FR-002, Goal 11)

**RULE-03** — Never populate the `ipHash` field in `ConsentRecord` before the
consent confirmation button has been tapped. It is optional. If the user
abandons before confirming, write nothing. (PRD Section 07 — Consent and
Data Handling)

**RULE-04** — Never require survivors or proxies to create an account, choose
a password, or provide an email address. They must be able to start and
complete a report with zero credentials. (FR-004)

---

### Survivor identity and anonymisation

**RULE-05** — Every report must be assigned a pseudonym ID at creation in the
format `SVR-XXXX-XXXX`. This is the only identifier case workers see. Never
display a survivor's name, contact detail, or real identity in the case
worker dashboard or any API response to a case worker role. (FR-035,
PRD Section 07 — Anonymisation)

**RULE-06** — Never return `SurvivorIdentity` or `SurvivorContact` data
through any API route accessible to the `CASE_WORKER` or `CAMP_ADMIN` role.
Enforce this in `middleware.ts` and in each route handler. (FR-035)

**RULE-07** — Never write `aiRiskRationale` to any API response. It is stored
for internal audit only. Neither survivors nor case workers see it.
(PRD Section 06 — Stage 3)

**RULE-08** — Never store the GPS location of a survivor. Do not call the
Geolocation API. Do not add a location field to any model. (Assumption 25)

**RULE-09** — Never persist the reference code in `sessionStorage`, `localStorage`,
or browser history for completed online submissions. After the confirmation
screen session ends, the code must not be recoverable from the device.
For offline submissions only, store the code in IndexedDB until background
sync completes, then remove it automatically. The panic exit must clear this
IndexedDB entry immediately. (FR-021, FR-21A)

---

### Audio handling

**RULE-10** — Never upload audio through the Next.js API. The client fetches
a presigned S3 URL from `/api/audio-upload-url` and uploads directly to S3
in chunks of 256kb. The Next.js server must not proxy binary audio data.
(PRD Section 06 — Stage 1, Assumption 30)

**RULE-11** — Never write the `audioFileKey` to the `Report` record until all
upload chunks have been confirmed by S3. A partial upload must not be marked
complete. (PRD Section 06 — Stage 1)

**RULE-12** — Never generate a public URL for an audio file. All access to
audio files must use signed, time-limited S3 URLs generated server-side
on authenticated request. (PRD Section 07 — Data Encryption)

**RULE-13** — Reject any recording shorter than 3 seconds on the client,
before any data is sent to the server. Show a retry prompt in the survivor's
selected language. (PRD Section 06 — Stage 1)

---

### Panic exit

**RULE-14** — The panic exit button must be visible on screen at all times
during the survivor reporting flow without scrolling, on viewports as small
as 360px wide. Use `position: fixed`. Do not let any other element cover it.
(FR-013)

**RULE-15** — When the panic exit is triggered, execute all four of these
steps in order before navigation:
  1. Clear all form state from React context.
  2. Clear `sessionStorage`.
  3. Delete the unsubmitted report queue entry and audio blob from IndexedDB.
  4. Call `window.location.replace(decoyUrl)`.
Never use `window.location.push` or `router.push` for the panic exit.
`replace()` is required so the back button cannot return to SafeVoice. (FR-012,
PRD Section 07 — Panic Exit)

**RULE-16** — Never delete a report that has already been successfully
submitted when the panic exit fires. Only delete the pending, unsubmitted
entry. A submitted report must remain in the database to protect the
survivor's active case. (PRD Section 07 — Panic Exit, Assumption 26)

---

### Page weight

**RULE-17** — Every route in the survivor reporting flow must have a First
Contentful Paint payload under 200kb. Measure HTML + CSS + JS + images
combined. Audio upload is excluded from this budget. Run Lighthouse CI
with 2G throttling on every build. Fail the build if any survivor route
exceeds 200kb. (Goal 8, PRD Section 07 — Page Weight Budget)

**RULE-18** — Never load an external icon font library anywhere in the
application. All icons must be inline SVG or an SVG sprite. (PRD Section 07
— Page Weight Budget)

**RULE-19** — Never load third-party scripts (analytics, error tracking,
chat widgets, etc.) in the survivor reporting flow. Third-party scripts
are only permitted in the case worker dashboard. (PRD Section 07 — Page
Weight Budget)

**RULE-20** — All images must be WebP format with explicit `width` and
`height` attributes. Never use JPEG, PNG, or GIF in new UI. (PRD Section 07
— Page Weight Budget)

**RULE-21** — Lazy-load all audio UI components. They must not be part of
the initial bundle for any survivor flow route. (PRD Section 07 — Page
Weight Budget)

---

### Accessibility

**RULE-22** — Every interactive element in the entire application must have a
minimum tap target of 44×44px. (PRD Section 07 — Accessibility)

**RULE-23** — Never use color as the only way to convey information. Every
risk tag, status badge, and flag must include both a color and a text or
icon label. (PRD Section 07 — Accessibility)

**RULE-24** — All text must meet a contrast ratio of 4.5:1 minimum.
(PRD Section 07 — Accessibility)

**RULE-25** — All icons in the survivor flow must trigger an audio label in
the survivor's selected language on tap. Not on hover. On tap. (FR-005,
PRD Section 07 — Accessibility)

---

### Multi-tenancy and data isolation

**RULE-26** — Every database query that reads or writes report, user, referral,
or partner data must include a `campId` filter matching the authenticated
user's `campId`. Enforce this in `middleware.ts`. Never allow a case worker
or admin to read or write data outside their assigned camp. (FR-035,
PRD Section 07 — Multi-Tenant Architecture)

**RULE-27** — Every table in the schema must have a `campId` field with a
Prisma `@relation` to `Camp`. This includes `ConsentRecord` and
`AnonymousSessionToken`. Never leave a `campId` field as an orphaned string
without a relation. (PRD Section 07 — Multi-Tenant Architecture)

---

### API and authentication

**RULE-28** — All API routes live under `/api/`. Every route requires either
a valid JWT (for case workers and admins) or a valid anonymous session token
(for survivor submission and audio URL endpoints). There are no public API
routes except the session token generation endpoint. (PRD Section 07 — API
Design)

**RULE-29** — An anonymous session token expires after 30 minutes and is valid
for exactly one report submission. Mark it as used in `AnonymousSessionToken`
the moment a report is created from it. Reject any second use. (PRD Section
07 — API Design)

**RULE-30** — Rate-limit the anonymous submission endpoint to a maximum of
5 requests per token. Rate-limit case worker routes separately. (PRD Section
07 — API Design)

**RULE-31** — All mutations — every create, update, delete — must be written
to the `AuditLog` table before the route handler returns a success response.
The audit log is append-only. Never update or delete an existing AuditLog
row. (PRD Section 07 — API Design)

**RULE-32** — The `AuditLog.metadata` field must be validated through a Zod
schema before every write. The schema must explicitly list permitted keys.
No key in `metadata` may reference `survivorId`, `identityPayload`,
`contactPayload`, or any field from `SurvivorIdentity` or `SurvivorContact`.
Enforce this in `lib/audit.ts`, not in individual route handlers. No route
handler calls Prisma to write an AuditLog entry directly. (PRD Section 07
— API Design, Assumption 29)

---

### AI pipeline

**RULE-33** — Human triage is always mandatory. The AI risk tag is a starting
point for the case worker, not a final decision. Never prevent a case worker
from acting on a report solely because AI classification has not completed.
If `aiClassificationStatus` is `UNCLASSIFIED` or `FAILED`, surface the
report at the top of the inbox with a "review manually" flag. (PRD Section
06 — Stage 3, Section 09 Risk 5)

**RULE-34** — Never use a status called `READY`. It does not exist in the
`ReportStatus` enum. When AI classification completes, set
`aiClassificationStatus` to `COMPLETE`. Leave `ReportStatus` as `NEW`.
(PRD Section 06 — Stage 3)

**RULE-35** — The GPT-4o mini classification prompt must explicitly instruct
the model not to treat the survivor's relationship to the perpetrator as a
risk-reducing factor. This instruction must be in the system prompt, not
the user message, and must survive every prompt update. (PRD Section 06
— Bias Mitigation)

**RULE-36** — Before enabling any language in production, run the
cross-language classification parity test: submit identical incident
descriptions in all five languages and compare risk outputs. Any language
that produces a different risk level for the same incident must be
investigated and fixed before that language is switched on. Log the test
results. (PRD Section 06 — Bias Mitigation, Section 11)

**RULE-37** — If Whisper times out after 30 seconds, set `transcriptionStatus`
to `FAILED`, keep the audio file in S3, and show the case worker the raw
audio with a note. Retry transcription in a background job every 15 minutes
for up to 3 attempts. Never block the case worker from acting on a report
because transcription has not completed. (PRD Section 06 — Stage 2)

---

### Child protection and escalation

**RULE-38** — Auto-set `childProtectionFlag = true` and `isMinor = true` on
any report where the survivor's selected age band is `UNDER_15`. This must
happen at report creation time in the API, not in the client and not in a
post-creation job. (FR-008, Goal 4)

**RULE-39** — Enforce the escalation timing exactly as specified:
  - Child protection flag unassigned for **1 hour** → alert case worker and
    camp admin.
  - High-risk report unassigned for **2 hours** → alert case worker and
    camp admin.
  - High-risk report unassigned for **6 hours** → alert the UNFPA GBV AoR
    contact configured for that camp.
Do not change these timings. Do not combine them. (FR-036, FR-037, FR-038)

---

### Case worker status updates to survivors

**RULE-40** — Case workers may only post status updates to survivors using
the five pre-written options: `CASE_RECEIVED`, `CASE_ASSIGNED`,
`REFERRAL_MADE`, `REFERRAL_FAILED`, `CASE_CLOSED`. Never allow free-text
from a case worker to be displayed to a survivor. Validate this on the
server — not just the client — by checking the posted value against the
`PreWrittenStatus` enum. (FR-026)

---

### Survivor safety rating

**RULE-41** — Never show the survivor safety rating prompt on the report
submission confirmation screen. Show it only on the in-app status check
screen, when the survivor returns to check their reference code. Collecting
a rating immediately after trauma disclosure is a design violation in this
product. (PRD Section 11 — Survivor safety rating)

---

### Scheduled deletion

**RULE-42** — The nightly deletion job runs at 02:00 UTC via
`/api/cron/delete-expired-reports`. It must delete the S3 audio file first,
then delete the `Report` record and all cascade-linked records in this order:
`Referral`, `RiskOverride`, `ReportStatusUpdate`, `EscalationLog`,
`SurvivorIdentity`, `SurvivorContact`, `ConsentRecord`. Never delete the
database record before the S3 file. If S3 deletion fails, do not proceed
with the database deletion. Log each deletion to `AuditLog` with action
`REPORT_AUTO_DELETED`. (PRD Section 10 — Scheduled Deletion Job)

**RULE-43** — Protect the cron endpoint with a shared secret header. Reject
any request that does not carry the correct secret. Never expose this
endpoint to unauthenticated traffic. (PRD Section 10 — Scheduled Deletion
Job)

---

### Phase scope

**RULE-44** — Never build Phase 2 or Phase 3 features while working on Phase
1. The following are explicitly out of scope for MVP. Do not write code for
any of them, even as a stub or a placeholder:
  - USSD or SMS reporting channel
  - Automated referral routing
  - WebSocket real-time push
  - iOS Safari support
  - AI-generated case summaries
  - Kanuri or Fulfulde language support
  - GBVIMS integration
  - Physical data isolation per NGO client
  - Native iOS or Android app
  - Billing and license key infrastructure
  (PRD Section 03 — Non-Goals)

---

## SECTION 4: HOW IS THE WORK ARRANGED
safevoice/
│
├── app/ # Next.js App Router — routes only
│ ├── (survivor)/ # Survivor flow — no auth required
│ │ ├── layout.tsx # Injects PanicExitButton, LanguageProvider
│ │ ├── consent/
│ │ │ └── page.tsx
│ │ ├── report/
│ │ │ └── page.tsx
│ │ └── confirm/
│ │ └── page.tsx
│ ├── (caseworker)/ # Case worker dashboard — JWT required
│ │ ├── layout.tsx
│ │ ├── inbox/
│ │ │ └── page.tsx
│ │ ├── report/
│ │ │ └── [id]/page.tsx
│ │ └── search/
│ │ └── page.tsx
│ ├── (admin)/ # Camp admin panel — JWT + CAMP_ADMIN role
│ │ ├── layout.tsx
│ │ ├── partners/page.tsx
│ │ ├── escalation/page.tsx
│ │ ├── accounts/page.tsx
│ │ └── stats/page.tsx
│ └── api/ # Route handlers — thin, no business logic
│ ├── auth/
│ │ └── login/route.ts
│ ├── consent/
│ │ └── route.ts # Writes ConsentRecord, issues session token
│ ├── session-token/
│ │ └── route.ts # Issues anonymous token on page load
│ ├── audio-upload-url/
│ │ └── route.ts # Returns presigned S3 URL
│ ├── report/
│ │ ├── route.ts # POST: create report
│ │ └── [id]/
│ │ └── route.ts # PATCH: update status, assign, override risk
│ ├── caseworker/
│ │ ├── inbox/route.ts
│ │ ├── report/[id]/route.ts
│ │ └── search/route.ts
│ ├── admin/
│ │ ├── partners/route.ts
│ │ ├── escalation/route.ts
│ │ ├── accounts/route.ts
│ │ └── stats/route.ts
│ └── cron/
│ └── delete-expired-reports/
│ └── route.ts # Protected by shared secret header
│
├── lib/ # All business logic — no framework coupling
│ ├── ai/
│ │ ├── transcribe.ts # Whisper large-v3 wrapper only
│ │ └── classify.ts # GPT-4o mini risk classification only
│ ├── audit.ts # Central AuditLog writer + Zod schema
│ ├── crypto.ts # AES-256-GCM encrypt/decrypt
│ ├── session.ts # Anonymous token generate / validate / mark used
│ ├── escalation.ts # Escalation timer logic (1hr / 2hr / 6hr)
│ ├── deletion.ts # Nightly deletion logic (S3 first, then DB)
│ ├── parity.ts # Cross-language classification parity test
│ └── pseudonym.ts # SVR-XXXX-XXXX reference code generator
│
├── components/
│ ├── survivor/ # Survivor flow UI only
│ │ ├── PanicExitButton.tsx # Fixed position, always visible, min 44x44px
│ │ ├── AudioRecorder.tsx # MediaRecorder wrapper, lazy-loaded
│ │ ├── ConsentScreen.tsx
│ │ ├── LanguageSelector.tsx
│ │ ├── AgeSelector.tsx
│ │ ├── IncidentTypeGrid.tsx
│ │ └── OfflineSyncStatus.tsx
│ ├── caseworker/
│ │ ├── ReportInbox.tsx
│ │ ├── RiskBadge.tsx # Color + label — never color alone
│ │ ├── RiskOverrideForm.tsx
│ │ ├── ReferralAssigner.tsx
│ │ └── AudioPlayer.tsx
│ ├── admin/
│ │ ├── PartnerForm.tsx
│ │ ├── EscalationContactForm.tsx
│ │ └── AggregateStats.tsx
│ └── shared/
│ └── LanguageAudio.tsx # Plays audio label on tap, not hover
│
├── hooks/
│ ├── useOfflineQueue.ts # IndexedDB: metadata + audio blob queue
│ ├── useAudioRecorder.ts # MediaRecorder, WebM/Opus 32kbps
│ └── useChunkedUpload.ts # 256kb chunks, 30s timeout, 3 retries
│
├── workers/
│ └── service-worker.ts # Workbox: pre-cache survivor flow,
│ # handle background sync
│
├── prisma/
│ ├── schema.prisma # Exact schema from PRD Section 10
│ └── migrations/
│ └── 001_add_gin_index.sql # CREATE INDEX report_incident_types_gin
│ # ON "Report" USING GIN ("incidentTypes");
│
├── public/
│ ├── audio/ # Native-speaker recordings per language
│ │ ├── en/
│ │ ├── ha/
│ │ ├── yo/
│ │ ├── ig/
│ │ └── pcm/
│ └── icons/ # SVG sprites only — no icon fonts
│
├── middleware.ts # JWT verify, campId scope, role check
├── .env.example # All secret keys listed, no values
├── lighthouserc.json # 2G throttle, 200kb FCP budget, fail on exceed
└── AGENTS.md # This file

**One raw SQL migration is permitted:** `001_add_gin_index.sql` adds the GIN
index on `Report.incidentTypes`. Write it as a raw migration file. Use
Prisma's typed client for everything else.

---

## SECTION 5: HOW SHOULD THE CODE LOOK

- **TypeScript strict mode is on.** No `any`. No `as SomeType` without a
  comment explaining why a type assertion is necessary.

- **Server components by default.** Only add `'use client'` when the
  component genuinely needs browser APIs (MediaRecorder, IndexedDB,
  `window.location`). Do not add it out of habit.

- **Route handlers are thin.** They validate input with Zod, call one `lib/`
  function, write to the AuditLog via `lib/audit.ts`, and return a response.
  No business logic in route handlers.

- **lib/ functions are pure where possible.** They take typed inputs and
  return typed outputs. They do not import from `app/` or `components/`.

- **Name functions as descriptive verbs:**
  `createReport`, `flagChildProtection`, `triggerEscalation`,
  `encryptIdentityPayload`, `generatePseudonymId`, `markTokenUsed`.

- **Use named exports everywhere.** No default exports except for Next.js
  page files where the framework requires it.

- **Error responses follow one envelope:**
```ts
  { success: false, error: { code: string, message: string } }
```
  Success responses:
```ts
  { success: true, data: T }
```
  Never return different shapes from the same route.

- **Environment variables for all secrets.** No hardcoded keys, URLs, or
  model names anywhere in code. Every secret is in `.env` and listed in
  `.env.example` with a description but no value.

- **Comments explain why, not what.** If the code needs a comment to explain
  what it does, rewrite it until it is clear without comments.

- **Do not leave TODO comments** except for items that map to an open
  question from PRD Section 14. Format: `// TODO(OQ-1): SMS gateway not
  yet selected. See PRD Section 14.`

---

## SECTION 6: WHAT COUNTS AS DONE

At the end of every task, produce this checklist. All items must be checked
before you report the task as complete. The build must pass with zero errors
and zero TypeScript errors.
Task completion checklist
Build
tsc --noEmit passes with zero errors
next build completes with zero errors
Lighthouse CI passes: all survivor routes under 200kb FCP on 2G throttle
Schema
schema.prisma matches PRD Section 10 exactly
@@unique([sessionToken]) exists on Report
@relation exists on ConsentRecord.campId
@relation exists on AnonymousSessionToken.campId
GIN index migration file exists at prisma/migrations/001_add_gin_index.sql
REFERRAL_FAILED exists in PreWrittenStatus enum
Consent enforcement
API rejects report submissions with no matching ConsentRecord
ipHash is null if user abandons before confirming consent
No data exists in the DB for an abandoned session
Survivor safety
Panic exit button is position:fixed, min 44×44px, visible at 360px width
Panic exit calls window.location.replace, not push
Panic exit clears React context, sessionStorage, and IndexedDB unsent queue
Panic exit does NOT delete already-submitted reports
Reference code absent from sessionStorage and browser history after session ends
Reference code in IndexedDB for offline submissions only; cleared on sync
Audio upload
Audio is captured as WebM/Opus at 32kbps
Recordings under 3 seconds are rejected client-side before any server call
Audio uploads directly to S3 via presigned URL (not through Next.js API)
Upload uses 256kb chunks with 30s timeout and 3 retries per chunk
audioFileKey is written to Report only after all chunks confirmed
Multi-tenancy
Every Prisma query in route handlers includes a campId filter
middleware.ts enforces campId scope on every authenticated route
No case worker API response contains SurvivorIdentity or SurvivorContact data
AI pipeline
Whisper times out after 30 seconds; failure sets transcriptionStatus = FAILED
Transcription retry runs every 15 minutes, max 3 attempts
GPT-4o mini classification prompt includes perpetrator-relationship instruction
No status called READY exists anywhere in the codebase
aiClassificationStatus = COMPLETE on success; ReportStatus stays NEW
UNCLASSIFIED reports surface at top of inbox with manual review flag
Accessibility
All interactive elements 44×44px minimum
All risk badges and flags have both color and text/icon label
All text passes 4.5:1 contrast check
All survivor flow icons play audio label on tap
AuditLog
Every mutation writes to AuditLog before returning a success response
AuditLog.metadata is validated by Zod schema in lib/audit.ts
No route handler calls Prisma to write AuditLog directly
Scheduled deletion
Cron runs at 02:00 UTC targeting /api/cron/delete-expired-reports
Cron endpoint requires shared secret header; rejects without it
Deletion sequence: S3 audio deleted first, then DB records
If S3 deletion fails, DB deletion is skipped and error is logged
Each deletion is logged with action REPORT_AUTO_DELETED
Escalation
Child protection flag unassigned for 1 hour triggers alert
High-risk unassigned for 2 hours triggers alert
High-risk unassigned for 6 hours triggers external UNFPA alert
childProtectionFlag is set at report creation time in the API, not client
Page weight and assets
No external icon font libraries loaded anywhere
No third-party scripts in any survivor flow route
All images are WebP with explicit width and height
Audio UI components are lazy-loaded
Phase scope
No WebSocket code exists in the codebase
No iOS Safari-specific code exists in the codebase
No USSD code exists in the codebase
No automated referral routing code exists in the codebase
No AI case summary code exists in the codebase
No billing or license key code exists in the codebase
No GBVIMS integration code exists in the codebase
Survivor safety rating
Rating prompt does NOT appear on the submission confirmation screen
Rating prompt appears only on the in-app status check screen

---

## SECTION 7: WHAT TO DO WHEN UNSURE

Follow these steps in order. Do not skip to step 3.

**Step 1 — Re-read the PRD section that covers the feature you are building.**
The answer is there most of the time.

**Step 2 — Check Section 3 of this file.** If the question is about a rule,
the answer is in Section 3.

**Step 3 — If the answer is not in the PRD or this file**, add a comment
using this exact format and stop:

```ts
// TODO(OQ-N): [Describe what you need to know].
// See PRD Section 14, Open Question N.
// Do not proceed past this point without a human decision.
```

Replace N with the open question number from PRD Section 14. If the
question is genuinely new and has no OQ number, use `OQ-NEW`.

**What you must never do when unsure:**

- Never invent a feature that is not in the PRD.
- Never add a Phase 2 or Phase 3 feature as a "head start".
- Never write placeholder business logic that bypasses a safety rule
  "temporarily". A bypassed safety rule is a broken rule.
- Never write spaghetti code across multiple files to make something work
  quickly. Write it correctly or write a TODO and stop.
- Never change the schema to make a feature easier to build. The schema is
  locked to PRD Section 10.
- Never assume that because something is common practice it is permitted
  here. This product handles GBV disclosures. The stakes are physical safety.
  When in doubt, protect the survivor.