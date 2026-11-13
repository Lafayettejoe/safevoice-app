<!-- .agents/rules/coding-standards.md -->

# Coding Standards — SafeVoice

## Source of truth
SafeVoice PRD v2.0 (July 2026) and AGENTS.md.
Every rule below traces to a requirement in those documents.
If a rule here conflicts with the PRD, the PRD wins. Flag the conflict.
Do not resolve it silently.

---

## Language and type safety

- Use **TypeScript strict mode** on every file. `strict: true` is set in
`tsconfig.json`. Do not change it.
- Never use `any`. If a type is genuinely unknown, use `unknown` and narrow
it with a type guard. If you find yourself writing `as SomeType` without
a comment explaining why, you are suppressing a type error, not fixing it.
- Never suppress TypeScript errors with `@ts-ignore` or `@ts-expect-error`
unless the comment explains the exact reason and links to an upstream issue.
- All Prisma queries use the generated typed client. Never construct a raw
query string except for the single GIN index migration in
`prisma/migrations/001_add_gin_index.sql`.

---

## Module exports

- Use **named exports** for all functions, types, and constants in `lib/`,
`hooks/`, and `components/`.
- Default exports are permitted **only** in `app/**/page.tsx`,
`app/**/layout.tsx`, and `app/**/route.ts` where Next.js requires them.
- Never re-export a default as a named export to work around this.

---

## Layering — where logic lives

This rule is structural. Breaking it makes the code untestable.
An untestable safety function is a failed safety function.

Route handler → validates input (Zod) → calls one lib/ function
→ writes AuditLog via lib/audit.ts
→ returns typed response envelope

- Route handlers do **not** contain business logic.
- Route handlers do **not** call Prisma directly except through a lib/ function.
- Route handlers do **not** call OpenAI, S3, or any external service directly.
- `lib/` functions do **not** import from `app/`, `components/`, or `hooks/`.
- `components/` do **not** import from `app/api/`.

If a feature requires logic that does not fit this model, create a new
`lib/` module before touching the route handler.

---

## Input validation

- Every API route validates its request body and query parameters with **Zod**
before any other code runs.
- The Zod schema lives in the same file as the route handler or in a
co-located `schema.ts` file.
- Validation failure returns HTTP 400 with the standard error envelope.
- Never trust client-provided data downstream of the Zod parse step.

---

## Response envelope

All API responses use this exact shape. No exceptions.

```ts
// Success
{ success: true, data: T }

// Failure
{ success: false, error: { code: string, message: string } }
```

- `code` is a machine-readable string in SCREAMING_SNAKE_CASE.
Example: `SESSION_TOKEN_EXPIRED`, `CONSENT_RECORD_MISSING`.
- `message` is a human-readable string. It must not include survivor data,
internal stack traces, or database field names.
- Never return HTTP 200 for a failed operation.
- Use 400 for client errors, 401 for unauthenticated, 403 for unauthorized,
422 for validation failure, 500 for unexpected server errors.

---

## Function naming

- Name every function as a descriptive verb phrase:
`createReport`, `flagChildProtection`, `triggerEscalation`,
`encryptIdentityPayload`, `generatePseudonymId`, `markTokenUsed`,
`scheduleReportDeletion`, `validateAuditMetadata`.
- Never name a function `handle`, `process`, `do`, or `run` without a
noun that says what is being handled, processed, done, or run.

---

## React and Next.js components

- Use **server components by default**. Only add `'use client'` when the
component genuinely requires browser APIs: `MediaRecorder`, `IndexedDB`,
`window`, `navigator`, event listeners.
- Do not add `'use client'` to a component just because it uses state.
Use the pattern of a server component rendering a client leaf instead.
- Never import a server-only module (`lib/crypto.ts`, `lib/audit.ts`,
Prisma client) into a client component. Mark server-only files with
the `server-only` package import.

---

## Comments and TODOs

- Comments explain **why**, not what. If the code cannot explain itself,
rewrite the code.
- The only permitted TODO format is:

// TODO(OQ-N): [what you need to know]. See PRD Section 14, OQ-N.
// Do not proceed without a human decision.

Replace N with the open question number. Use OQ-NEW for genuinely new gaps.
- Never write a TODO that bypasses a safety rule "temporarily".
A bypassed safety rule is a broken safety rule.

---

## Environment variables

- Every secret — API keys, encryption keys, database URLs, cron shared
secrets — lives in environment variables.
- Never hardcode a secret, a model name, a bucket name, or a service URL
in application code.
- Every variable used in code must be listed in `.env.example` with a
description and no value.
- Access variables through a typed `lib/env.ts` module that validates
their presence at startup. If a required variable is missing, the
application must refuse to start.

---

## What counts as a coding standards failure

A task fails under these standards even if the feature works:
- `any` type used anywhere
- Business logic in a route handler
- External service called directly from a route handler
- AuditLog written directly from a route handler (must go through lib/audit.ts)
- API response that does not match the standard envelope
- `'use client'` added without a browser API justification
- Server-only module imported into a client component
- Secret hardcoded in source code
- TODO comment that does not follow the OQ format
markdown
<!-- .agents/rules/database-schema.md -->

# Database Schema Rules — SafeVoice

## Source of truth
The canonical schema is in PRD Section 10. The file at `prisma/schema.prisma`
must match it exactly. This rules file adds the implementation constraints
the PRD states but does not repeat in the schema file itself.

---

## The schema is locked

Do not add models, remove models, rename fields, change enum values, or
alter index definitions without a documented change request from the product
owner. If you think the schema needs a change to implement a feature, stop
and flag it. Do not act on that opinion.

---

## campId relation on every table

Every model in the schema that stores user or camp-specific data must have:
1. A `campId String` field.
2. A `camp Camp @relation(fields: [campId], references: [id])` relation.

This is not optional. The following models had this relation missing in an
earlier version and were corrected in the PRD v2 review:
- `ConsentRecord` — must have `camp Camp @relation(...)`
- `AnonymousSessionToken` — must have `camp Camp @relation(...)`

If you add a new model that stores per-camp data, it must follow the same
pattern before the migration runs.

---

## Constraints that must exist

Model
Constraint
Why
`Report`
`@@unique([sessionToken])`
Prevents two reports from a single anonymous token
`Report`
`@@index([campId, status])`
Dashboard inbox query performance
`Report`
`@@index([childProtectionFlag])`
Escalation query performance
`Report`
`@@index([scheduledDeletionAt])`
Nightly deletion cron query
`AnonymousSessionToken`
`@@index([token])`
Token lookup on every submission
`ConsentRecord`
`@@unique([sessionToken])`
One consent record per session
`RiskOverride`
`@@index([createdAt])`
Monthly bias audit queries


Do not remove these constraints. Do not rename the indexed fields.

---

## GIN index migration

The `Report.incidentTypes` field is a PostgreSQL enum array. Prisma cannot
add a GIN index through the schema file. You must create it manually.

The file `prisma/migrations/001_add_gin_index.sql` must exist and must
contain:

```sql
CREATE INDEX IF NOT EXISTS report_incident_types_gin
ON "Report"
USING GIN ("incidentTypes");
```

Run this migration after the first `prisma migrate deploy`. If this index
does not exist, filtering by incident type (FR-034) performs a full table
scan. At production volume, that query will time out.

---

## Enum values that must exist

Enum
Required value
Consequence if missing
`PreWrittenStatus`
`REFERRAL_FAILED`
Survivors see "referral made" when it failed
`ReportStatus`
`NEW`, `IN_PROGRESS`, `REFERRED`, `CLOSED`
No `READY` value — it does not exist
`AiClassStatus`
`UNCLASSIFIED`
UNCLASSIFIED reports cannot be surfaced correctly
`Language`
`ENGLISH`, `HAUSA`, `YORUBA`, `IGBO`, `PIDGIN`
No other values in MVP


Do not add `READY` to `ReportStatus`. It was removed in the PRD v2 review
and must not reappear.

---

## Fields that must never exist

Field
Reason
Any GPS / coordinates field on any model
SafeVoice must never store survivor location (Assumption 25)
Any free-text field on `ReportStatusUpdate`
Case workers may only use pre-written status options (FR-026)
`publicUrl` on any audio-related field
Audio is always accessed via signed URLs (PRD Section 07)


---

## Encrypted fields

The following fields must be encrypted at the **application layer** using
AES-256-GCM before being written to the database. Prisma stores them as
`String`. The encryption and decryption logic lives exclusively in
`lib/crypto.ts`.

Model
Field
Content
`SurvivorIdentity`
`identityPayload`
JSON with name, contact channel, contact detail
`SurvivorContact`
`contactPayload`
Survivor's contact detail


The encryption key comes from the secrets manager only. It is never
hardcoded. It is never logged. It is never returned in any API response.

---

## scheduledDeletionAt

`Report.scheduledDeletionAt` is set at report creation time.
Formula: `submittedAt + 24 months`.

This field is never updated after creation. The only way to prevent deletion
is to set `deletionHeld = true`. Case workers can set this flag. The nightly
cron skips reports where `deletionHeld` is true.

Do not change the retention period without a product owner decision and a
PRD update.

---

## audioFileKey

`Report.audioFileKey` stores the S3 object key only. It is never a public
URL. It is never a presigned URL. It is a key that the server uses to
generate a short-lived signed URL on authenticated request.

This field must be `null` until all upload chunks are confirmed received
by S3. Never set it to a partial key.

---

## Deletion order

When the nightly cron deletes a report:

1. Delete the S3 audio file using `audioFileKey`.
2. Confirm S3 deletion succeeded.
3. If S3 deletion fails, log the failure and stop. Do not delete the DB row.
4. If S3 deletion succeeds, delete in this order:
- `EscalationLog` where `reportId` matches
- `RiskOverride` where `reportId` matches
- `ReportStatusUpdate` where `reportId` matches
- `Referral` where `reportId` matches
- `SurvivorIdentity` where `reportId` matches
- `SurvivorContact` where `reportId` matches
- `ConsentRecord` where `sessionToken` matches the report's `sessionToken`
- `Report` row
5. Write one `AuditLog` entry with action `REPORT_AUTO_DELETED` after all
deletes complete.

Breaking this order means an audio file containing a GBV disclosure persists
in S3 after its retention period. That is an NDPA 2023 compliance failure.

---

## AuditLog is append-only

Never write an `UPDATE` or `DELETE` statement targeting the `AuditLog`
table. It is a permanent immutable record. If an audit entry is wrong,
write a correction entry — do not delete or modify the original.

---

## What counts as a database schema failure

A task fails even if the code runs:
- `campId` field exists on a model without a Prisma `@relation`
- `@@unique([sessionToken])` missing from `Report`
- `REFERRAL_FAILED` missing from `PreWrittenStatus` enum
- `READY` present in `ReportStatus` enum
- GIN index migration file does not exist
- `scheduledDeletionAt` not set at report creation
- `audioFileKey` set before all S3 chunks confirmed
- Any GPS / coordinates field exists on any model
- `SurvivorIdentity.identityPayload` written without AES-256-GCM encryption
- DB row deleted before S3 audio file confirmed deleted
- Any `UPDATE` or `DELETE` on `AuditLog`
markdown
<!-- .agents/rules/design-system-rule.md -->

# Design System Rules — SafeVoice

## Who these rules protect

The survivor reporting flow is used by women under threat, on a borrowed
phone, in under 15 minutes, on a 2G connection. Every design rule below
exists because breaking it either prevents the survivor from completing a
report or reveals that she filed one.

---

## Styling — Tailwind CSS only

- Use **Tailwind CSS utility classes** for all styling in the application.
- Do not use CSS-in-JS libraries (styled-components, Emotion, Stitches, etc.).
- Do not write `.css` files except for a single global reset in
`app/globals.css`. All component styles are utility classes.
- Do not use inline `style` attributes except for computed values that
Tailwind cannot express (e.g., a dynamically calculated pixel offset).
In that case, add a comment explaining why.

---

## Icons — SVG only

- All icons must be **inline SVG** or pulled from an **SVG sprite**.
- Never load an external icon font library (Font Awesome, Material Icons,
Heroicons from a CDN, etc.). Icon fonts add 40–200kb to the bundle.
On a 2G connection, that alone can push the survivor flow over the 200kb
FCP budget and prevent the page from loading.
- SVG files live in `public/icons/`. Import them as React components using
the Next.js SVG import pattern.
- Every SVG icon in the survivor flow must have a descriptive `aria-label`
attribute.

---

## Images — WebP with explicit dimensions

- All new images must be in **WebP format**.
- Every `<img>` and `<Image>` (Next.js) element must have explicit `width`
and `height` attributes or equivalent props.
- Never use an image without dimensions. Missing dimensions cause layout
shift, which counts against Core Web Vitals and may cause the Lighthouse
CI check to fail.
- Use the Next.js `<Image>` component for all images. Never use a plain
`<img>` tag for new images.

---

## Page weight budget — survivor flow

Every route in the survivor reporting flow must pass this check on every
build:

Metric
Limit
First Contentful Paint payload
Under 200kb
Assets included
HTML + CSS + JS + images
Assets excluded
Audio file uploads (separate network operation)


Lighthouse CI runs with **2G throttling** on every build. The build fails
if any survivor route exceeds the budget.

The case worker dashboard and admin panel are exempt from this budget, but
should still be kept lean.

---

## Third-party scripts — banned in survivor flow

- Never load any third-party script (analytics, error tracking, chat widgets,
A/B testing, CDN-hosted libraries) in any route inside `app/(survivor)/`.
- Third-party scripts are permitted only inside `app/(caseworker)/` and
`app/(admin)/`.
- If a third-party script is needed for the whole application (e.g., error
monitoring), load it conditionally and check the route group before
initialising it.

---

## Audio UI components — lazy loaded

- All audio recording and playback components must be **lazy loaded**.
- They must not be part of the initial JS bundle for any survivor route.
- Use `React.lazy()` and `Suspense` or Next.js dynamic imports with
`{ ssr: false }`.
- The initial page load must work without the audio component having loaded.
The audio button appears only after the lazy import resolves.

---

## Tap targets — minimum 44×44px

- Every interactive element in the entire application — buttons, links,
inputs, icons, selects — must have a minimum tap target of **44×44px**.
- This applies to the visual element plus any invisible padding used to
extend the target area.
- The **panic exit button** is the highest priority. It must be at minimum
44×44px. It must never be partially covered by another element.

---

## Panic exit button — fixed position, always visible

- The panic exit button must use `position: fixed` (Tailwind: `fixed`).
- It must be visible on viewports as small as **360px wide** without
scrolling.
- No other element may overlap it with a higher `z-index`.
- Place it at the bottom-right of the viewport.
- It must render on **every page** inside `app/(survivor)/`.
- It is rendered in the survivor layout (`app/(survivor)/layout.tsx`) so
it cannot be accidentally omitted from a single page.

---

## Color — never the sole signal

- Never use color as the only way to convey information.
- Every risk tag must have both a color fill and a text label
(`HIGH`, `MEDIUM`, `LOW`).
- Every status badge must include both color and a text or icon label.
- Every error state must include both a color and a text description or icon.
- This rule exists for accessibility (colorblind users) and also because
the survivor flow must remain clear in poor screen lighting conditions
common in IDP camp environments.

---

## Contrast ratio — minimum 4.5:1

- All text in the application must meet a **minimum contrast ratio of 4.5:1**
against its background.
- Use a contrast checker before committing any new color combination.
- This applies to placeholder text, labels, captions, and helper text —
not only body copy.

---

## Audio labels in survivor flow — tap only

- Every icon in the survivor reporting flow that a survivor may interact with
must play an **audio label in the survivor's selected language** when tapped.
- Audio labels trigger on the `onClick` / `onTouchStart` event. Not on hover.
Hover does not exist on touch devices.
- The audio label files live in `public/audio/{lang}/`. They are pre-recorded
by native speakers.
- If an audio file for a given language has not been approved and placed in
`public/audio/{lang}/`, that language must not be enabled in the survivor
flow even if the UI strings are translated. The `localisation.md` rules
file governs the language enable gate.

---

## Language selector — first screen only

- The language selection screen is the **first screen** a survivor sees,
before any other UI element except the language options themselves.
- Once a language is selected, every subsequent screen — including all error
messages, audio prompts, and status messages — must be in that language.
- Never fall back to English silently for a survivor who has selected a
different language. If a translation is missing, display a prominent
warning and block the language from being selectable until the translation
is complete.

---

## Minimum font size

- All text in the survivor reporting flow must be at minimum **16px**
(1rem). Mobile browsers zoom automatically below this size, which breaks
the layout.
- The case worker dashboard may use smaller text where necessary (minimum
12px / 0.75rem) but labels on data-dense tables must remain readable.

---

## What counts as a design system failure

A task fails even if the feature appears to work:
- Any survivor route exceeds the 200kb FCP budget on 2G Lighthouse check
- An external icon font library is loaded anywhere in the application
- A third-party script loads in any route inside `app/(survivor)/`
- The panic exit button is not in `position: fixed` or is coverable by
another element
- The panic exit button is below 44×44px
- Any icon in the survivor flow does not trigger an audio label on tap
- Color is the only differentiator for any risk tag, status badge, or error
- Any text fails the 4.5:1 contrast check
- An audio UI component is not lazy-loaded
- An image uses a format other than WebP or is missing width/height
markdown
<!-- .agents/rules/git-conventions.md -->

# Git Conventions — SafeVoice

## Why this file exists

SafeVoice handles GBV disclosures from survivors. A secret committed to
git history is permanent even after deletion. Phase 2 code committed to
the Phase 1 branch ships to production. These are not style issues.
They are safety and scope failures.

---

## Absolute prohibitions — breaking these means the task failed

### No secrets in commits

- Never commit any of the following to any branch:
- API keys (OpenAI, AWS, SMS gateway)
- Encryption keys or secrets
- Database connection strings
- JWT signing secrets
- Cron shared secret header values
- `.env` files that contain real values
- If a secret is accidentally committed, treat it as compromised immediately.
Rotate the secret before doing anything else. Then remove it from history.
- All secrets live in `.env`. The `.env` file is in `.gitignore` and must
never leave it.
- `.env.example` contains every variable name with a description and no value.
It is committed. It is the documentation.

### No Phase 2 work on Phase 1 branches

- Any feature from the PRD Section 03 Non-Goals list is Phase 2 or later.
That includes: WebSockets, USSD, SMS reporting channel, automated referral
routing, iOS Safari support, AI case summaries, GBVIMS integration,
Kanuri/Fulfulde languages, billing infrastructure, native app code.
- If you are on `main` or any `phase-1/*` branch, you must not commit code
for any of these features, even as a stub, a placeholder, or a TODO
implementation.
- Phase 2 work lives on `phase-2/*` branches. It never merges to `main`
until the Phase 1 condition-to-advance criteria are met (PRD Section 13).

---

## Branch naming

main Production. Phase 1 only.
phase-1/feature/{short-name} Feature branches for Phase 1 work.
phase-1/fix/{short-name} Bug fix branches for Phase 1.
phase-1/chore/{short-name} Non-feature work: deps, config, migrations.
phase-2/{feature-name} Phase 2 work only. Never merges to main in Phase 1.
hotfix/{short-name} Emergency fixes to main only.

Examples:

phase-1/feature/panic-exit
phase-1/feature/consent-screen
phase-1/fix/offline-sync-race-condition
phase-1/chore/gin-index-migration
phase-2/websocket-dashboard
hotfix/session-token-expiry-edge-case

---

## Commit message format

Use **Conventional Commits** format. This is required, not recommended.
It allows automated traceability from a security regression back to the
commit that introduced it.

<type>(<scope>): <description>

[optional body]

[optional footer: refs, breaking changes]

**Types:**

Type
When to use
`feat`
A new feature from the PRD
`fix`
A bug fix
`sec`
A security-specific change
`chore`
Dependency updates, config, migrations
`test`
Adding or fixing tests
`docs`
Documentation only
`refactor`
Code change that is not a feat or fix


**Scopes:** Use the name of the module, route group, or lib file affected.
Examples: `consent`, `panic-exit`, `audit`, `ai-pipeline`, `offline-sync`,
`caseworker-inbox`, `cron`.

**Examples:**

feat(consent): write ConsentRecord before activating session token
sec(audit): add Zod validation to AuditLog metadata field
fix(offline-sync): clear audio blob from IndexedDB on successful sync
chore(schema): add GIN index migration for incidentTypes array
feat(escalation): trigger 1-hour alert for child protection unassigned reports

---

## Pull requests

- Every PR must reference the PRD requirement number(s) it implements.
Example: "Implements FR-012, FR-013 (panic exit mechanism)."
- PRs that touch `lib/crypto.ts`, `lib/audit.ts`, `lib/session.ts`, or
the Prisma schema must be reviewed by the product owner before merging,
even in solo development. Leave a comment confirming this.
- PRs must not exceed 400 lines of changed code unless implementing a
single atomic PRD requirement that genuinely requires it. If a PR is
larger, split it.
- Never merge a PR that has a failing Lighthouse CI check on any survivor
route.
- Never merge a PR that has TypeScript errors.
- Never merge a PR that has a failing test.

---

## What to do if you accidentally commit a secret

1. Stop all other work immediately.
2. Rotate the compromised secret in the service that issued it.
3. Force-push a rewritten history that removes the commit containing the
secret (if the repo is private and the commit has not been fetched by
others). If others have fetched it, the secret must be considered
permanently exposed regardless of history rewriting.
4. Update `.gitignore` and `.env.example` to prevent recurrence.
5. Notify the product owner with the exact commit hash, the type of secret
exposed, and confirmation that the secret has been rotated.

---

## What counts as a git conventions failure
- A secret of any kind appears in any commit on any branch
- Phase 2 code appears on `main` or a `phase-1/*` branch
- A commit message does not follow the Conventional Commits format
- A PR merges with a failing TypeScript check
- A PR merges with a failing Lighthouse CI check on a survivor route
- A PR that touches security-critical lib files has no product owner
review comment
markdown
<!-- .agents/rules/security.md -->

# Security Rules — SafeVoice

## Context

SafeVoice stores GBV disclosures from survivors in active danger.
A security failure here is not a service outage. It is potential physical
harm to a real person. Every rule in this file is a hard requirement.
Breaking any of them means the task has failed even if the feature works.

---

## Secrets management

- Every API key, encryption key, database URL, JWT secret, cron shared
secret, and S3 credential lives in environment variables only.
- Never hardcode any secret in source code, configuration files, comments,
or test fixtures.
- Secrets are accessed through `lib/env.ts`, which validates their presence
at startup. If a required variable is missing at startup, the application
must refuse to start and log which variable is missing.
- The encryption key for `SurvivorIdentity.identityPayload` and
`SurvivorContact.contactPayload` is stored in a secrets manager (AWS
Secrets Manager or equivalent). It is never in `.env` on a production
system. It is fetched at runtime.
- `.env` is in `.gitignore` and must never be committed. `.env.example`
is committed and lists every variable name with a description and no value.

---

## Data in transit

- All HTTP traffic uses **TLS 1.3**. Configure `next.config.ts` to redirect
HTTP to HTTPS. Set the following headers on every response:

Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: geolocation=(), microphone=(self), camera=()
Content-Security-Policy: [see CSP section below]

- `microphone=(self)` is required because the survivor flow uses the
MediaRecorder API. No other origin may access the microphone through
this application.
- `geolocation=()` blocks all geolocation access. SafeVoice must never
request or store location data (Assumption 25).

---

## Content Security Policy

Apply the following CSP to all routes inside `app/(survivor)/`. It is the
strictest policy the survivor flow can tolerate.

default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
media-src 'self' blob:;
connect-src 'self' https://*.amazonaws.com;
font-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';

- `connect-src` includes `amazonaws.com` for the direct-to-S3 audio upload.
- `unsafe-inline` in `style-src` is required for Tailwind's inline purge
behaviour. Do not add `unsafe-eval`.
- The case worker dashboard may have a relaxed `connect-src` to include
monitoring services, but must not relax `script-src`.

---

## Authentication

### Case workers and administrators

- Authenticate using **JWT**. The JWT is short-lived (max 8 hours).
- The signing secret is an environment variable. Minimum 256 bits of entropy.
- JWTs are stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies.
Never in `localStorage` or `sessionStorage`.
- The JWT payload includes: `userId`, `campId`, `role`. No survivor data
is ever in a JWT payload.
- Every case worker and admin route handler verifies the JWT in
`middleware.ts`. Route handlers do not verify auth independently.
- On every request, check that the `campId` in the JWT matches the
`campId` of the resource being accessed. A case worker with a valid
JWT for Camp A must not access resources from Camp B.

### Survivors (anonymous session tokens)

- Generate a fresh anonymous session token on **every page load** of the
survivor URL. (FR-03A)
- Tokens are signed with a secret distinct from the JWT signing secret.
- Tokens expire after **30 minutes**.
- Tokens are valid for **exactly one report submission**. When a report
is created, mark the token as `usedAt = now()` in `AnonymousSessionToken`.
Reject any second use of the same token with HTTP 409.
- Tokens are stored in `sessionStorage` only. They are never in a cookie,
never in a URL, and never in `localStorage`.
- Rate limit the submission endpoint to **5 requests per token**. Return
HTTP 429 on excess.

---

## S3 and audio files

- All S3 buckets must have **Block All Public Access** enabled.
- No audio file is ever accessible via a public URL.
- Audio files are accessed only via **signed, time-limited S3 URLs**
generated server-side on authenticated request. The signed URL expiry
must not exceed **15 minutes**.
- Never pass an S3 object key to the client as a usable URL. Pass a
route path that the server uses to generate and proxy the signed URL.
- Server-side encryption for all S3 objects must be **AES-256** (SSE-S3
or SSE-KMS). Configure this in the S3 bucket policy, not relying on
per-upload headers.

---

## Application-layer encryption

- `SurvivorIdentity.identityPayload` and `SurvivorContact.contactPayload`
are encrypted with **AES-256-GCM** before being written to the database.
- The encryption and decryption functions live exclusively in `lib/crypto.ts`.
- No other file in the codebase may perform encryption or decryption.
- The encryption key is fetched from the secrets manager at runtime.
It is never logged, never returned in any API response, never stored
in the database.
- The `SurvivorIdentity` table is never queried through the standard
case worker API routes. There is no join between `Report` and
`SurvivorIdentity` in any Prisma query accessible to the `CASE_WORKER`
role.

---

## API security

- All mutations (POST, PATCH, DELETE) require a valid CSRF token or are
restricted to `SameSite=Strict` cookies, which provide equivalent
protection for same-origin requests.
- Every mutation is written to the **immutable AuditLog** before the route
returns a success response. (See `lib/audit.ts`.)
- The `AuditLog.metadata` field is validated by a Zod schema in
`lib/audit.ts` before every write. The schema must explicitly forbid any
key that references survivor identity data. This is enforced centrally,
not per route handler.
- All API routes implement **rate limiting**:
- Anonymous submission endpoint: 5 requests per session token.
- Case worker routes: 100 requests per minute per JWT.
- Admin routes: 50 requests per minute per JWT.
- Cron endpoint: 1 request per minute; must carry a shared secret header.

---

## Cron endpoint security

- The nightly deletion cron targets `/api/cron/delete-expired-reports`.
- This route must validate a `x-cron-secret` header against an environment
variable on every request.
- Return HTTP 401 if the header is absent or incorrect.
- Never expose this endpoint without the secret check. An unauthenticated
call to this endpoint could trigger mass deletion.

---

## Panic exit security

- The panic exit calls `window.location.replace(decoyUrl)`, not
`window.location.push` or `router.push`.
- `replace()` removes SafeVoice from the browser's session history, so
the back button cannot return to it.
- Before navigation, the panic exit must:
1. Clear all React form state.
2. Clear `sessionStorage`.
3. Delete the unsubmitted report queue entry and audio blob from
IndexedDB.
- It must **not** delete a report that has already been successfully
submitted.
- The decoy URL is configurable per camp by the administrator. It must
be validated server-side when saved (must be a valid HTTPS URL). The
default is a public weather service.

---

## Data the system must never store

Data
Reason
GPS coordinates or location
Assumption 25; physical safety of survivor
Survivor identity without explicit opt-in
FR-016
ipHash before consent confirmed
PRD Section 07 — Consent and Data Handling
Unencrypted identity payload in DB
PRD Section 07 — Application-layer encryption
AI risk rationale in API responses
PRD Section 06 — Stage 3
Free-text case worker messages to survivors
FR-026
Session token in localStorage or cookie
Anonymous token rules above


---

## Before go-live

A penetration test must be completed before the product collects any
survivor data. The agent cannot run a penetration test, but it is
responsible for ensuring the security posture is correct so the test
can pass. Specifically:

- No dependency with a known critical CVE ships to production. Run
`npm audit` and resolve critical findings before each release.
- All security headers are set and verifiable via an automated header
check (e.g., Security Headers scanner).
- The shared secret for the cron endpoint is rotated from the default
value before production deployment.

---

## What counts as a security failure

A task fails even if the feature works:
- A secret of any kind is hardcoded in source code
- `localStorage` or a non-`httpOnly` cookie stores an auth token
- A case worker API route returns `SurvivorIdentity` or `SurvivorContact` data
- An S3 audio file is accessible via a public URL
- `SurvivorIdentity.identityPayload` is written without AES-256-GCM encryption
- `geolocation` permission is requested or granted by the application
- The cron endpoint accepts a request without the shared secret header
- The session token is valid after 30 minutes or after one use
- An AuditLog entry is written without Zod metadata validation
- Any required security header is missing from a response
markdown
<!-- .agents/rules/ai-pipeline.md -->

# AI Pipeline Rules — SafeVoice

## Services used

Task
Model
Wrapper
Audio transcription
OpenAI Whisper large-v3
`lib/ai/transcribe.ts`
Risk classification
OpenAI GPT-4o mini
`lib/ai/classify.ts`


Do not change either model. Do not call either service from anywhere except
the designated wrapper function. These wrappers are the only place in the
codebase that may import the OpenAI SDK.

---

## Architecture rule

Neither wrapper is called directly from a route handler. The call chain is:

Route handler → lib/report.ts (or equivalent) → lib/ai/transcribe.ts
→ lib/ai/classify.ts

If you find yourself importing `lib/ai/transcribe.ts` inside an
`app/api/*/route.ts`, stop and restructure.

---

## Stage 1: Audio capture

- Audio is captured in **WebM/Opus at 32kbps** using the MediaRecorder API.
- Maximum recording duration: **3 minutes**.
- If the recording is **under 3 seconds**, reject it on the client before
any data is sent to the server. Show a retry prompt in the survivor's
selected language. Never send a sub-3-second recording to the API.
- Audio is uploaded **directly to S3** via a presigned URL from
`/api/audio-upload-url`. It is never proxied through the Next.js API.
- Upload uses **256kb chunks** with a **30-second timeout** and **3 retries**
per chunk.
- `Report.audioFileKey` is set **only after all chunks are confirmed** by S3.
- `Report.audioSyncComplete` is set to `true` only after S3 confirms the
complete file.

---

## Stage 2: Transcription (Whisper large-v3)

- Call Whisper with the `language` parameter set to the language the
survivor selected in FR-005.
- For Nigerian Pidgin, use the `en` language parameter. Whisper has no
dedicated Pidgin model.
- Timeout: **30 seconds**. If Whisper does not respond in 30 seconds,
treat it as a failure.
- On failure:
1. Set `transcriptionStatus = FAILED`.
2. Keep the audio file in S3.
3. Show the case worker the raw audio with the message
"transcription unavailable, please listen to recording."
4. Enqueue a retry job. Retry every **15 minutes**. Maximum **3 attempts**.
5. After 3 failed attempts, do not retry automatically. The case worker
listens to the audio directly.
- On success: set `transcriptionStatus = COMPLETE`, write `transcriptText`.
- Never block the case worker from acting on a report because transcription
has not completed. The raw audio is always available.

---

## Stage 3: Risk classification (GPT-4o mini)

### Output format

The model must return this exact JSON structure and no other content:

```json
{
"riskLevel": "high" | "medium" | "low",
"rationale": "string"
}
```

Parse the response strictly. If the response is not valid JSON or does not
match this schema, treat it as a classification failure.

### Classification criteria

Embed these criteria in the system prompt. Do not change them without a
PRD update:

Level
Criteria
HIGH
Ongoing threat; perpetrator has current access to survivor; report involves a minor; sexual violence with physical injury; survivor indicates immediate danger
MEDIUM
Incident within 7 days; perpetrator is known to survivor; sexual violence without immediate ongoing threat
LOW
Incident more than 7 days ago; perpetrator unknown or not in camp; economic or emotional abuse without physical threat


### The perpetrator relationship rule

The system prompt must include this instruction verbatim:

> "Do not treat the survivor's relationship to the perpetrator (spouse,
> family member, employer, or any other relationship) as a factor that
> reduces the risk level. The relationship does not make violence less
> serious."

This instruction must survive every prompt update. If you update the prompt,
verify this sentence is still present before committing.

### On completion

- Set `aiClassificationStatus = COMPLETE`.
- Write `aiRiskLevel` and `aiRiskRationale` to the Report.
- Leave `ReportStatus = NEW`. Do not change it.
- There is no status called `READY`. It does not exist. Do not create it.

### On failure

- Set `aiClassificationStatus = UNCLASSIFIED`.
- Surface the report at the **top of the case worker inbox** with the
message: "AI classification unavailable. Please review and set risk
level manually."
- The case worker must set `humanRiskLevel` manually before the report
can be assigned to a referral partner.
- Never prevent the case worker from accessing the report because
classification failed.

### rationale field

- `aiRiskRationale` is stored for audit purposes only.
- It must never appear in any API response.
- It must never be displayed to survivors, case workers, or administrators.
- The Zod schema for case worker API responses must explicitly exclude
`aiRiskRationale`.

---

## Stage 4: Dashboard delivery

- The case worker dashboard polls for new reports every **30 seconds**.
- The polling endpoint is a lightweight GET that returns the count and
list of NEW reports for the authenticated case worker's camp, ordered
by `aiRiskLevel DESC` then `submittedAt ASC`.
- Do not implement WebSockets. WebSocket push is Phase 2.
- HIGH-risk reports and UNCLASSIFIED reports must always appear above
MEDIUM and LOW reports regardless of submission time.
- Reports with `childProtectionFlag = true` appear at the very top,
above all other risk levels.

---

## Cross-language parity test

Before enabling any language in production:

1. Submit identical incident descriptions — same type, same timing, same
threat level — translated into all five MVP languages.
2. Record the risk level the model returns for each language.
3. If any two languages produce different risk levels for the same incident,
investigate the cause before enabling that language.
4. Log the parity test results with a timestamp in the bias review record.
5. Repeat this test after every change to the classification prompt or model.

A language that has not passed the parity test must not be selectable in
the survivor flow, even if its UI strings and audio prompts are ready.

---

## Human override

- Case workers can override the AI risk level at any time using
`humanRiskLevel`.
- When set, `humanRiskLevel` takes precedence over `aiRiskLevel` in all
dashboard displays and escalation calculations.
- Every override writes a `RiskOverride` record with: `originalRisk`,
`overriddenTo`, `reason`, `caseWorkerId`, `createdAt`.
- The reason field is required. The API must reject an override with an
empty reason.
- Override logs are reviewed monthly for bias patterns.

---

## What counts as an AI pipeline failure

A task fails even if the feature appears to work:
- Whisper or GPT-4o mini is called from a route handler directly
- Whisper timeout is not set to 30 seconds
- Classification retry does not run every 15 minutes for max 3 attempts
- The perpetrator-relationship instruction is absent from the GPT-4o mini
system prompt
- `READY` appears anywhere in the codebase as a ReportStatus value
- `aiRiskRationale` appears in any API response
- A HIGH-risk or UNCLASSIFIED report is not at the top of the inbox
- A language is enabled in production without a parity test passing
- A risk override is accepted with an empty reason field
- Case worker is blocked from accessing a report because AI failed
markdown
<!-- .agents/rules/offline-sync.md -->

# Offline Sync Rules — SafeVoice

## Why this file exists

The survivor reporting flow must work after one initial load with zero
connectivity. A queued report that silently disappears is a direct safety
failure — the survivor believes she has filed a report, but no case worker
ever sees it.

---

## What the service worker caches

On first load, the service worker must pre-cache:

- All routes inside `app/(survivor)/`
- All audio prompt files in `public/audio/`
- All SVG icon files in `public/icons/`
- The Tailwind CSS bundle for the survivor flow
- The main JS bundle for the survivor flow

The case worker dashboard and admin panel do **not** require offline
caching. Do not pre-cache them.

---

## What IndexedDB stores

Two types of data are stored in IndexedDB during a survivor's session:

Key prefix
Content
Cleared when
`report:pending:{token}`
Serialised report metadata (JSON)
Sync confirmed by server
`audio:pending:{token}`
Audio blob (binary)
S3 upload confirmed
`refcode:{token}`
Reference code string
Sync confirmed OR panic exit


Never store any other survivor data in IndexedDB.

---

## Sync sequence — order is mandatory

When connectivity is detected, the service worker must process the queue
in this exact order:

1. **Upload the audio blob** to S3 using the chunked presigned URL strategy.
2. **Confirm S3 upload** (all chunks acknowledged).
3. **Delete `audio:pending:{token}`** from IndexedDB.
4. **Submit the report metadata** to the API (POST to `/api/report`).
5. **Confirm the API accepted the report** (HTTP 201).
6. **Delete `report:pending:{token}`** and `refcode:{token}` from IndexedDB.

Never submit the report metadata before the audio upload is confirmed.
If the metadata reaches the server before the audio, the case worker sees
a report with `audioFileKey = null` and no audio to listen to. That is an
incomplete record.

---

## Connectivity detection

- Use both the `online` event and the `navigator.onLine` property.
- Do not rely on `navigator.onLine` alone. It returns true when connected
to a local network with no internet access.
- After detecting the `online` event, make a lightweight HEAD request to
a known endpoint (`/api/health`) to confirm actual server reachability
before starting the sync.
- If the health check fails, wait 30 seconds and retry. Use exponential
backoff: 30s, 60s, 120s, then every 5 minutes.

---

## Sync retry — report metadata

- Maximum **3 attempts** before giving up.
- Backoff: attempt 1 immediate, attempt 2 after 60 seconds, attempt 3
after 5 minutes.
- After 3 failed attempts:
1. Leave the data in IndexedDB (do not delete it).
2. Show the survivor a message in their selected language:
"Your report could not be sent. Please speak with a community health
worker and show them your reference code."
3. Do not clear the reference code from IndexedDB until the survivor
explicitly dismisses the message or the panic exit fires.

---

## Sync retry — audio upload

- Use the same chunked upload strategy as online submissions.
- **256kb chunks**, **30-second timeout per chunk**, **3 retries per chunk**.
- If all chunk retries fail, the audio upload as a whole has failed.
- After audio upload failure, do not attempt the metadata submission.
The report cannot be created without `audioFileKey`.
- Log the failure to the local IndexedDB state so the sync can resume on
the next connectivity event.

---

## Reference code — offline window

- For **online submissions**, the reference code is displayed on the
confirmation screen. It is never written to IndexedDB, sessionStorage,
or browser history.
- For **offline submissions**, the reference code is stored in IndexedDB
under `refcode:{token}` until sync completes.
- After sync completes, `refcode:{token}` is deleted from IndexedDB.
- The panic exit deletes `refcode:{token}` immediately, regardless of sync
status.
- Community safety briefings must advise survivors that on a shared device,
a reference code may be readable in IndexedDB between offline submission
and sync completion. The application cannot prevent this.

---

## Panic exit and IndexedDB

When the panic exit fires:

1. Delete `report:pending:{token}` from IndexedDB (if it exists and has
not been submitted).
2. Delete `audio:pending:{token}` from IndexedDB (if it exists and has
not been uploaded).
3. Delete `refcode:{token}` from IndexedDB.
4. Then call `window.location.replace(decoyUrl)`.

Do not delete data for a report that has already been successfully submitted.
`audioSyncComplete = true` and the report existing in the database are the
signals that submission is complete.

---

## Sync status UI

- While a report is queued in IndexedDB and not yet synced, the survivor
must see a visible status indicator.
- The indicator must be in the survivor's selected language.
- It must convey: "Your report is saved and will be sent when you have
a connection."
- The indicator must not require the survivor to take any action.
- The indicator must not show technical information (IndexedDB, sync,
API errors). Show only the human-readable status.

---

## Case worker dashboard — no offline requirement

- The case worker dashboard does not require offline support in MVP.
- Do not add a service worker cache for case worker routes.
- If the case worker loses connectivity, the dashboard shows a connection
error. This is acceptable behaviour for MVP.

---

## What counts as an offline sync failure

A task fails even if the feature appears to work:
- Report metadata submitted to the API before audio upload is confirmed
- IndexedDB `report:pending` entry deleted before server confirms HTTP 201
- Reference code written to sessionStorage or localStorage for offline
submissions
- Reference code not deleted from IndexedDB after successful sync
- Panic exit does not delete IndexedDB pending entries
- Survivor sees no status indicator while a report is queued
- Sync is attempted without a health check confirming real connectivity
- Audio blob not stored in IndexedDB for offline submissions
markdown
<!-- .agents/rules/localisation.md -->

# Localisation Rules — SafeVoice

## MVP languages

SafeVoice supports exactly five languages in Phase 1:

Code
Language
Priority
`en`
English
Case workers and administrators
`ha`
Hausa
Primary survivor language (northeast pilot)
`pcm`
Nigerian Pidgin
Primary survivor language (northeast pilot)
`yo`
Yoruba
May be phased to month 3–4 if budget requires
`ig`
Igbo
May be phased to month 3–4 if budget requires


Do not add any other language. Kanuri and Fulfulde are Phase 2.
If asked to add a language not on this list, reference OQ-7 and stop.

---

## Language enable gate

A language must meet **all three conditions** before it can be selectable
in the survivor flow:

1. **UI strings** — all text in the survivor flow is translated and merged.
2. **Audio prompts** — all audio prompt files are recorded by a native
speaker, reviewed by a GBV-sensitive translator, and placed in
`public/audio/{lang}/`.
3. **AI parity test** — the cross-language classification parity test has
passed for this language (see `ai-pipeline.md`).

If any condition is not met, the language option must not appear on the
language selector screen. Disable it in the language configuration file,
not by removing it from the codebase.

---

## Language configuration file

Maintain a single language configuration file at `lib/languages.ts`:

```ts
export const LANGUAGES = {
en: { enabled: true, audioReady: true, parityTestPassed: true },
ha: { enabled: true, audioReady: true, parityTestPassed: true },
pcm: { enabled: false, audioReady: false, parityTestPassed: false },
yo: { enabled: false, audioReady: false, parityTestPassed: false },
ig: { enabled: false, audioReady: false, parityTestPassed: false },
} as const;
```

The language selector screen reads from this configuration. It only renders
languages where `enabled: true`. Updating this file is the only way to
enable a language. Never conditionally render a language option in component
code based on environment variables or feature flags.

---

## Audio prompt files

- All audio prompts live in `public/audio/{lang}/`.
- Each language directory must contain a file for every prompt in the
survivor flow. If a file is missing, the build must fail.
- Filename convention: `{screen}-{element}.mp3` or `.ogg`.
Example: `consent-confirm-button.mp3`, `report-microphone-hold.mp3`.
- Audio files are served as static assets. They are pre-cached by the
service worker on first load.
- Never generate audio prompts programmatically (TTS). All prompts are
pre-recorded by native speakers.

---

## Audio labels on tap

- In the survivor flow, every icon that a survivor interacts with must
play its audio label when tapped.
- The audio label plays the file from `public/audio/{lang}/{element}.mp3`
where `{lang}` is the survivor's selected language.
- The audio plays on `onClick` / `onTouchStart`. Not on hover.
- The `LanguageAudio` shared component handles this behaviour. Never
implement audio-on-tap inline in a page component.

---

## Nigerian Pidgin — transcription limitation

- Whisper large-v3 has no dedicated Pidgin model.
- For Pidgin, call Whisper with `language: 'en'`.
- Transcription quality will be lower than for other languages.
- Pidgin must not be enabled in the survivor flow until transcription
quality has been validated by native speakers (OQ-2).
- When Pidgin is enabled, the case worker inbox must display a visible
note on Pidgin-originated reports: "This report was recorded in Nigerian
Pidgin. AI transcription quality may be lower. Please listen to the audio
recording."

---

## Translation scope — survivor flow only

Translations are required for the survivor flow: `app/(survivor)/`.

The case worker dashboard and admin panel are English only. Do not translate
them. Do not use a translation library in those route groups.

---

## Translation file format

Use a flat JSON structure per language:

```json
// public/locales/ha.json
{
"consent.title": "Yarda",
"consent.body": "...",
"consent.confirm": "Na yarda",
"report.microphone.hold": "Riƙe don yin magana",
"error.recording.too_short": "Rikodin yana da gajere. Da fatan a sake gwadawa."
}
```

- Every key that exists in `en.json` must exist in every other enabled
language file. The build must fail if a key is missing in any enabled
language.
- Never use the English string as a fallback for a missing translation
in the survivor flow. If a translation is missing, it means the language
is not ready to be enabled.

---

## Camp default language

Camp administrators can set a default language for their camp (FR-044).
When a survivor opens the app, the default language loads immediately
without requiring them to select one.

- This setting is stored in `Camp.defaultLanguage`.
- The language selector is still shown so the survivor can change it.
- If the camp default language is not in the enabled language list,
fall back to English and log a warning.

---

## What counts as a localisation failure

A task fails even if the UI renders:
- A language is selectable in the survivor flow without all three enable
conditions met (UI strings, audio prompts, parity test)
- An audio label does not play in the survivor's selected language
- An error message appears in English for a survivor who selected a
different language
- A translation key exists in `en.json` but is missing in an enabled
language file
- Audio prompts are generated by TTS instead of pre-recorded by a human
- Nigerian Pidgin reports do not show a transcription quality warning
in the case worker inbox
- The `LANGUAGES` config is modified outside of `lib/languages.ts`
markdown
<!-- .agents/rules/accessibility.md -->

# Accessibility Rules — SafeVoice

## Standard

SafeVoice must meet **WCAG 2.1 Level AA**. This is a hard requirement,
not a target. The survivor reporting flow serves women who may have low
literacy and are using a borrowed phone under stress. Accessibility failures
are usability failures for this exact population.

---

## Tap targets — minimum 44×44px

- Every interactive element across the entire application — buttons, links,
icon buttons, checkboxes, radio inputs, toggles — must have a minimum
tap target of **44×44px**.
- Extend the tap target with padding if the visual element is smaller.
Use Tailwind's `p-*` utilities or a wrapping element.
- The panic exit button must be 44×44px minimum. It must never be smaller.
It must never be partially obscured by another element.
- Run automated tap target checks as part of the Lighthouse CI pipeline.

---

## Color — never the sole signal

- Never use color as the only indicator of state or meaning.
- Every risk tag (`HIGH`, `MEDIUM`, `LOW`) must have:
- A background or border color.
- A text label in the same element.
- Every status badge must include color plus text or icon.
- Every error state must include color plus text description.
- Every success state must include color plus a checkmark or text.

---

## Contrast ratio — 4.5:1 minimum

- All text — body, labels, captions, placeholder text, helper text — must
meet a minimum contrast ratio of **4.5:1** against its background.
- Large text (18px bold or 24px regular) may use 3:1 minimum.
- Non-text UI elements (icons, borders, focus rings) must meet 3:1 minimum.
- Use a contrast checker tool before committing any new color pair.
- Do not use Tailwind's default gray palette for text on white without
verifying the contrast ratio. `text-gray-400` on white fails 4.5:1.

---

## Focus management

- Every interactive element must have a visible focus ring when focused
via keyboard.
- Never use `outline: none` or `outline: 0` without replacing it with a
custom focus indicator that meets the 3:1 contrast requirement.
- In the survivor reporting flow, focus must move logically through the
page in reading order.
- When a modal or overlay opens, focus must move to the first interactive
element inside it.
- When a modal or overlay closes, focus must return to the element that
triggered it.

---

## Labels and form inputs

- Every form input must have a visible `<label>` element associated via
`htmlFor` / `id`.
- Never use placeholder text as a substitute for a label.
- Placeholder text may supplement a label but must not be the sole label.
- Error messages for form inputs must be associated with the input using
`aria-describedby`.
- Required fields must be marked with `aria-required="true"` and a visible
indicator (not color alone).

---

## Audio prompts — survivor flow

- Every icon the survivor interacts with must have an audio label in their
selected language (see `localisation.md` for implementation rules).
- Icons that are decorative only (not interactive) must have
`aria-hidden="true"`.
- Interactive icons must have an `aria-label` attribute in addition to
the audio label.

---

## Images and icons

- All informational images must have a descriptive `alt` attribute.
- Decorative images must have `alt=""`.
- SVG icons used as interactive elements must have `role="img"` and an
`aria-label`.
- SVG icons that are decorative must have `aria-hidden="true"`.

---

## Reading order and semantic HTML

- Use semantic HTML elements: `<button>` for buttons, `<nav>` for navigation,
`<main>` for main content, `<header>`, `<footer>`, `<section>`,
`<article>` where appropriate.
- Never use a `<div>` as a button. Never use a `<span>` as a link.
- Heading levels must not skip. `<h1>` → `<h2>` → `<h3>`. Never jump
from `<h1>` to `<h3>`.
- The survivor flow has one `<h1>` per page that describes the current step.

---

## Screen reader announcements

- Use `aria-live="polite"` for status updates that appear without a page
reload (sync status, upload progress, success messages).
- Use `aria-live="assertive"` only for critical alerts (sync failure after
3 attempts, recording error).
- Never use `aria-live="assertive"` for non-critical information. It
interrupts screen reader users.

---

## Keyboard navigation — case worker dashboard

- The case worker dashboard must be fully operable by keyboard.
- Tab order must follow the visual reading order.
- Data tables must support keyboard navigation: `Tab` to enter the table,
arrow keys to navigate cells.
- All actions available by click must also be available by keyboard shortcut
or by navigating to the element and pressing `Enter` or `Space`.

---

## Lighthouse CI accessibility gate

- Run Lighthouse CI with the accessibility audit on every build for all
survivor routes.
- The accessibility score must be **90 or above** (out of 100).
- Do not merge a PR that drops the accessibility score below 90 on any
survivor route.
- A score of 90 is a floor, not a target. Aim for 100.

---

## What counts as an accessibility failure

A task fails even if the feature works visually:
- Any interactive element is below 44×44px
- Color is the sole indicator for any risk tag, status badge, or error
- Any text fails the 4.5:1 contrast check
- Any input lacks a visible, programmatically associated label
- A `<div>` or `<span>` is used as a button or link
- Focus disappears or moves illogically when a modal opens or closes
- An interactive SVG icon lacks an `aria-label`
- The Lighthouse accessibility score drops below 90 on any survivor route
- `outline: none` is used without a replacement focus indicator
markdown
<!-- .agents/rules/data-retention.md -->

# Data Retention Rules — SafeVoice

## Legal basis

SafeVoice operates under the Nigeria Data Protection Act 2023 (NDPA 2023).
The product owner is the data controller. The 24-month retention period and
the deletion sequence described in this file are commitments made to
survivors and to regulatory compliance. Breaking them is not a code style
issue. It is a legal and ethical failure.

---

## Retention period

- Reports are retained for **24 months** from `submittedAt`.
- `scheduledDeletionAt` is set at report creation time:
`scheduledDeletionAt = submittedAt + 24 months`.
- This field is never updated after creation.
- Never change the retention period in code without a product owner decision
and a PRD update.

---

## Deletion hold

- A case worker can set `Report.deletionHeld = true` to prevent auto-deletion
of an active case.
- The nightly cron skips any report where `deletionHeld = true`.
- A report with `deletionHeld = true` is never auto-deleted regardless of
how old it is.
- The case worker must explicitly release the hold by setting
`deletionHeld = false`. The cron will then delete it on the next nightly
run after `scheduledDeletionAt` has passed.

---

## Nightly deletion cron

- Runs at **02:00 UTC** every night.
- Targets `/api/cron/delete-expired-reports`.
- Protected by `x-cron-secret` header. Rejects without it.
- Queries: `WHERE scheduledDeletionAt <= now() AND deletionHeld = false`.

---

## Deletion sequence — mandatory order

For each report matched by the cron query, execute in this exact order:

**Step 1: Delete the S3 audio file.**

DELETE s3://{bucket}/{audioFileKey}

Confirm S3 returns a success response.

**Step 2: If S3 deletion fails:**
- Log the failure with the `reportId` and `audioFileKey`.
- Stop. Do not delete any database records.
- The cron will retry on the next nightly run.

**Step 3: If S3 deletion succeeds, delete database records in this order:**
1. `EscalationLog` where `reportId` matches
2. `RiskOverride` where `reportId` matches
3. `ReportStatusUpdate` where `reportId` matches
4. `Referral` where `reportId` matches
5. `SurvivorIdentity` where `reportId` matches
6. `SurvivorContact` where `reportId` matches
7. `ConsentRecord` where `sessionToken` matches `Report.sessionToken`
8. `Report` row

**Step 4: Write an AuditLog entry:**
```ts
{
action: 'REPORT_AUTO_DELETED',
entityType: 'Report',
entityId: report.id,
metadata: { scheduledDeletionAt: report.scheduledDeletionAt }
}
```

Deleting the database row before the S3 file is confirmed deleted means a
survivor's GBV disclosure audio file sits in S3 indefinitely with no
mechanism to clean it up. That is a retention compliance failure.

---

## Consent records

- `ConsentRecord` is deleted as part of the report deletion sequence above
(step 7).
- A `ConsentRecord` with no matching `Report` (because the survivor withdrew
before submitting) is deleted after **7 days**.
- Add this to the nightly cron: query `ConsentRecord WHERE createdAt <=
now() - 7 days AND` no matching `Report.sessionToken` exists.

---

## Survivor identity and contact data

- `SurvivorIdentity` and `SurvivorContact` records are deleted as part of
the report deletion sequence (steps 5 and 6).
- These tables must never be queried for aggregate analytics. They contain
encrypted personal data.
- The only permitted use of these tables is: decryption for explicit
authorised access (not in MVP) and deletion.

---

## No GPS data — ever

- SafeVoice must never collect, store, or log the GPS coordinates of a
survivor.
- Do not call the Geolocation API.
- Do not add latitude, longitude, or coordinates fields to any model.
- The `Permissions-Policy: geolocation=()` header blocks this at the
browser level. The application must not call the API either.

---

## ipHash — consent-only collection

- `ConsentRecord.ipHash` is populated **only after** the survivor taps the
consent confirmation button.
- It is stored in hashed form (SHA-256 of the raw IP).
- It is used only for abuse prevention auditing.
- It is deleted with the `ConsentRecord` as described above.
- It must never be used to identify a survivor or to link reports.

---

## Data minimisation

Collect only what the PRD requires. If a feature can be implemented without
storing a piece of data, do not store it.

Data
Permitted to store
Not permitted
Incident types
As enum array
As free-text
Timing
As enum (day/night, recency band)
As exact date/time
Age
As age band enum
As exact age or birth date
Audio recording
As S3 key
As base64 in DB
Survivor identity
Encrypted, opt-in only
Unencrypted, default
Survivor location
Never
GPS coordinates
Case worker IP
Never
Any form


---

## What counts as a data retention failure

A task fails even if the code runs:

- `scheduledDeletionAt` not set at report creation
- DB record deleted before S3 audio confirmed deleted
- Any database record skipped in the deletion sequence
- `deletionHeld` logic not implemented (expired reports always deleted
regardless of active case status)
- `ConsentRecord` not included in the deletion sequence
- GPS coordinates stored anywhere in any model
- `ipHash` populated before consent is confirmed
- Unencrypted identity payload written to `SurvivorIdentity`
- AuditLog entry not written after each auto-deletion
- Cron endpoint accessible without the shared secret header

<!-- .agents/rules/design-system-rule.md -->

# Design System Rules — SafeVoice

## Source of truth

The canonical token values live in the SafeVoice design system JSON file.
This rules file translates those tokens into implementation orders.
If a value here conflicts with the JSON, the JSON wins. Flag the conflict
and do not resolve it silently.

All tokens are declared as CSS custom properties on `:root` in
`app/globals.css`. Component code reads tokens only through `var(--*)`.
Never write a raw colour value in a component file.

---

## Known issue — dark mode tokens are broken

Several dark mode token values in the design system JSON are incorrectly
set to `hsl(300, 100%, 50%)` (pure magenta). This is a generation artefact.
The affected tokens are:

- `background-color` and `surface-color`
- `surface-dim-color` and `surface-bright-color`
- `surface-container-lowest-color`, `surface-container-color`,
`surface-container-high-color`, `surface-container-highest-color`
- All four error role tokens: `error-color`, `on-error-color`,
`error-container-color`, `on-error-container-color`

**Do not implement dark mode until every token in this list is corrected.**
Do not use `hsl(300, 100%, 50%)` anywhere in the application. If you
encounter it while reading the design system file, stop and flag it.

Dark mode tokens that are correctly defined and safe to use are marked
in the colour section below.

---

## CSS custom property names

Map every JSON key to a CSS custom property using this exact convention:
the JSON key becomes the variable name with a `--` prefix.

```css
/* Example: JSON "primary-color": "hsl(141, 79%, 85%)" → */
--primary-color: hsl(141, 79%, 85%);
```

Declare all tokens in `app/globals.css` inside a single `:root {}` block
for light mode and a single `[data-theme="dark"] {}` block for dark mode.
Never declare tokens inside a component file. Never use `@media (prefers-color-scheme)` as the sole mechanism — it must follow the `data-theme` attribute so the user can override it.

---

## Colour roles and usage rules

### Primary — `--primary-color: hsl(141, 79%, 85%)`

This is a very light mint green. It has low contrast against white.

- Use it as a **tonal fill** only: selected states, chip backgrounds,
focus ring tints, highlight overlays.
- Never use `--primary-color` as a text colour. It fails WCAG 4.5:1
against white backgrounds.
- The correct text-on-primary fill is `--on-primary-color: hsl(0, 0%, 100%)`
when the surface is dark enough. For text on a light primary fill, use
`--on-primary-container-color: hsl(151, 55%, 20%)`.

### Secondary — `--secondary-color: hsl(143, 100%, 22%)`

This is a rich, deep forest green. It is the **primary action colour**.

- Use it for: primary buttons, filled CTAs, links, active navigation
indicators, progress bars.
- `--on-secondary-color: hsl(0, 0%, 100%)` — the only foreground colour
permitted on a secondary fill. Never put dark text on this background.
- This colour passes WCAG AA against white. It is safe for text and filled
controls.

### Tertiary — `--tertiary-color: hsl(147, 29%, 32%)`

This is a muted olive-green. It is the **supporting tone colour**.

- Use it for: secondary icon fills, supporting text labels, inactive tab
indicators, field borders on focus, helper text.
- `--on-tertiary-color: hsl(0, 0%, 100%)` — foreground when the surface
is filled with tertiary.
- This colour passes WCAG AA against white. Safe for text.

### Container variants

Container colours are lighter, tonal variants used as backgrounds when
you need a coloured surface that still hosts readable body text.

Token
Value
Pair with
`--primary-container-color`
`hsl(141, 41%, 72%)`
`--on-primary-container-color: hsl(151, 55%, 20%)`
`--secondary-container-color`
`hsl(134, 71%, 60%)`
`--on-secondary-container-color: hsl(142, 100%, 16%)`
`--tertiary-container-color`
`hsl(142, 36%, 72%)`
`--on-tertiary-container-color: hsl(149, 42%, 22%)`


Never swap a container colour with its on-container pair. Never put
`--on-secondary-color` (white) on `--secondary-container-color` — white on
a mid-brightness green fails contrast. Use the `on-*-container` values.

### Error — `--error-color: hsl(1, 67%, 54%)`

- Use for: destructive action buttons, inline validation errors,
alert banners, delete confirmations.
- `--on-error-color: hsl(0, 0%, 100%)` — white on error fill.
- `--error-container-color: hsl(4, 100%, 84%)` — light pink tint for
error banners and passive error states. Pair with
`--on-error-container-color: hsl(353, 97%, 29%)`.
- In the survivor reporting flow, minimise use of error red. A survivor
under stress reading a red error message may interpret it as danger to
them personally, not a form validation issue. Prefer inline guidance over
alarming colour.

### Background and surface

--background-color: hsl(120, 63%, 97%) /* page canvas — barely-there green white /
--surface-color: hsl(120, 63%, 97%) / same value — use background for page,
surface for card and panel backgrounds /
--on-background-color: hsl(133, 18%, 10%) / all body text /
--on-surface-color: hsl(133, 18%, 10%) / same — primary text on any surface */

The background is not pure white. It has a faint green tint matching the
primary hue. Never replace it with `#ffffff` or `hsl(0, 0%, 100%)`.

### Surface containers (light → heavy)

Use these for layered surfaces. Lower numbers sit closer to the canvas.

Token
Value
Use
`--surface-container-lowest-color`
`hsl(0, 0%, 100%)`
Modal, popover, floating card
`--surface-container-low-color`
`hsl(120, 36%, 95%)`
Card on canvas
`--surface-container-color`
`hsl(120, 28%, 92%)`
Default container
`--surface-container-high-color`
`hsl(125, 22%, 90%)`
Nested container
`--surface-container-highest-color`
`hsl(120, 16%, 88%)`
Deepest container, dividers


### Surface variant

`--surface-variant-color: hsl(30, 7%, 89%)` — a warm off-white.
Use for: input field fills, chip backgrounds, code blocks.
`--on-surface-variant-color: hsl(120, 1%, 28%)` — dark gray text on this surface.

### Outline

--outline-color: hsl(60, 1%, 46%) /* default border, input rings /
--outline-variant-color: hsl(40, 3%, 77%) / subtle dividers, separator lines */

### Inverse surface (for tooltips and toasts)

--inverse-surface-color: hsl(138, 11%, 18%) /* dark greenish-gray /
--inverse-on-surface-color: hsl(120, 33%, 94%) / light text on inverse surface /
--inverse-primary-color: hsl(141, 41%, 72%) / primary accent on inverse surface */

---

## Dark mode — safe tokens only

Only use the following dark mode tokens. Tokens marked BROKEN must not be
used and must be fixed in the design system JSON before dark mode launches.

```css
[data-theme="dark"] {
/* ✓ Safe — use these */
--primary-color:              hsl(141, 79%, 85%);
--on-primary-color:           hsl(155, 100%, 11%);
--primary-container-color:    hsl(151, 55%, 20%);
--on-primary-container-color: hsl(141, 67%, 82%);

--secondary-color:              hsl(134, 71%, 60%);
--on-secondary-color:           hsl(139, 100%, 11%);
--secondary-container-color:    hsl(142, 100%, 16%);
--on-secondary-container-color: hsl(131, 99%, 72%);

--tertiary-color:              hsl(142, 36%, 72%);
--on-tertiary-color:           hsl(155, 90%, 12%);
--tertiary-container-color:    hsl(149, 42%, 22%);
--on-tertiary-container-color: hsl(141, 60%, 83%);

--on-background-color:    hsl(120, 16%, 88%);
--on-surface-color:       hsl(120, 16%, 88%);
--surface-variant-color:  hsl(120, 1%, 28%);
--on-surface-variant-color: hsl(40, 3%, 77%);
--outline-color:          hsl(60, 1%, 56%);
--outline-variant-color:  hsl(120, 1%, 28%);
--surface-container-low-color: hsl(133, 18%, 10%);
--inverse-surface-color:    hsl(120, 16%, 88%);
--inverse-on-surface-color: hsl(138, 11%, 18%);
--inverse-primary-color:    hsl(148, 36%, 30%);

/* ✗ BROKEN — do not use until fixed */
/* background-color, surface-color, surface-dim-color,
surface-bright-color, all surface-container-* except low,
all error role tokens — currently hsl(300,100%,50%) */
}
```

---

## Typography

All three font family roles use **Inter**. Set them together in one declaration
and never override them per-component.

```css
:root {
--font-family-sans:    'Inter', system-ui, sans-serif;
--font-family-display: 'Inter', system-ui, sans-serif;
--font-family-mono:    'Inter', ui-monospace, monospace;
}
```

Load Inter via Google Fonts or a self-hosted variable font. Never use a
fallback sans like Arial as the primary font — it changes the rendered
spacing and breaks the type scale.

### Type scale

Use these exact values. Never introduce an off-scale font size.

Token
Value
Use
`--font-size-xs`
`0.640rem`
Captions, timestamps, badge labels
`--font-size-sm`
`0.800rem`
Helper text, secondary labels, metadata
`--font-size-base`
`1.000rem`
Body copy, form inputs, default UI text
`--font-size-lg`
`1.250rem`
Section labels, card titles
`--font-size-xl`
`1.563rem`
Page subheadings, modal titles
`--font-size-2xl`
`1.953rem`
Page headings (h2)
`--font-size-3xl`
`2.441rem`
Page title (h1)
`--font-size-4xl`
`3.052rem`
Hero headings
`--font-size-5xl` and above
`3.815rem+`
Reserved for landing or marketing surfaces only


The survivor reporting flow must use a minimum of `--font-size-base`
(1rem / 16px) for all visible text. Never go below 1rem in any screen
a survivor reads.

### Font weights

Token
Value
Use
`--font-weight-light`
300
Decorative only — never for body or UI text
`--font-weight-regular`
400
All body text and default UI
`--font-weight-medium`
500
Labels, navigation, buttons
`--font-weight-semibold`
600
Section headings, card titles
`--font-weight-bold`
700
Page headings, alert titles
`--font-weight-extrabold`
800
Hero headings only


Never use 300 for any text a survivor must read. Low-weight text at small
sizes fails legibility under poor lighting, which is common in IDP camps.

### Line height

Token
Value
Use
`--line-height-none`
1
Single-line headings, display text
`--line-height-tight`
1.25
Compact UI labels, short headings
`--line-height-snug`
1.375
Card body text
`--line-height-normal`
1.5
Default body copy
`--line-height-relaxed`
1.625
Long-form text, consent notices
`--line-height-loose`
2
Spaced-out UI (use sparingly)


Set consent screen body text to `--line-height-relaxed`. A survivor
reading a consent notice needs breathing room between lines.

### Letter spacing

Use `--letter-spacing-normal` (0em) for all body text. The tight values
(`tighter`, `tight`) are for large display headings only. The wide values
(`wide`, `wider`, `widest`) are for short all-caps labels only. Never
apply wide letter spacing to body copy or survivor-facing instructions.

---

## Spacing

Use the spacing scale for all margins, paddings, and gaps.
Never use arbitrary pixel values outside this scale.

Token
Value
Common use
`--spacing-1`
`0.25rem`
Icon-to-label gap
`--spacing-2`
`0.5rem`
Inline padding for small elements
`--spacing-3`
`0.75rem`
Small component internal padding
`--spacing-4`
`1rem`
Default component padding
`--spacing-6`
`1.5rem`
Section vertical gap
`--spacing-8`
`2rem`
Card padding, large component gap
`--spacing-12`
`3rem`
Between major sections
`--spacing-16`
`4rem`
Page-level vertical rhythm


The panic exit button must have a minimum of `--spacing-3` (0.75rem) of
padding on all sides beyond its visual boundary, to prevent accidental
adjacent taps. Set `--spacing-px` (1px) as the minimum border width.

---

## Border radius

Token
Value
Use
`--radius-none`
`0`
Tables, horizontal dividers
`--radius-xs`
`0.125rem`
Subtle chip corners
`--radius-sm`
`0.25rem`
Input fields, small badges
`--radius-md`
`0.5rem`
Buttons, form controls
`--radius-lg`
`0.75rem`
Cards, panels
`--radius-xl`
`1rem`
Modals, large cards
`--radius-2xl`
`1.5rem`
Feature cards
`--radius-3xl`
`2rem`
Full-bleed sheet panels
`--radius-full`
`9999px`
Pills, avatar rings, toggle tracks


Default to `--radius-md` for interactive controls and `--radius-lg` for
cards. Do not mix multiple radius values within a single component.

---

## Shadows and elevation

### Functional shadows

Use these for depth and separation. Never use shadows as decoration.

Token
Value
Use
`--shadow-xs`
`0 1px 2px rgba(0,0,0,0.05)`
Subtle lift: buttons, chips
`--shadow-sm`
`0 1px 3px + 0 1px 2px`
Input focus lift
`--shadow-md`
`0 4px 6px + 0 2px 4px`
Floating cards
`--shadow-lg`
`0 10px 15px + 0 4px 6px`
Panels, sidebars
`--shadow-xl`
`0 20px 25px + 0 8px 10px`
Modals, dialogs
`--shadow-2xl`
`0 25px 50px rgba(0,0,0,0.15)`
Full-page overlays
`--shadow-inner`
`inset 0 2px 4px rgba(0,0,0,0.05)`
Pressed states, inset fields


### Glow shadows — restricted use

The design system defines four glow shadows. They are reserved for
specific semantic purposes only. Do not repurpose them.

Token
Value
Use
`--shadow-glow-primary`
`0 0 20px hsla(256, 34%, 48%, 0.35)`
Focus ring on primary action elements
`--shadow-glow-secondary`
`0 0 20px hsla(259, 11%, 40%, 0.35)`
Focus ring on secondary elements
`--shadow-glow-tertiary`
`0 0 20px hsla(340, 21%, 41%, 0.35)`
Focus ring on tertiary elements
`--shadow-glow-error`
`0 0 20px hsla(0, 54%, 41%, 0.35)`
Focus ring on error-state inputs


Note: the glow shadow HSL values do not match the product's green palette.
They were carried over from a template. Use them only for `box-shadow` on
focus rings, where the slight hue mismatch is imperceptible. Never use a
glow shadow as a background effect or decorative element.

### Elevation scale

Use elevation tokens to choose shadow depth. Do not invent intermediate values.

Token
Value
Use
`--elevation-0`
`none`
Flat, no depth
`--elevation-1`
`shadow-sm equivalent`
Cards resting on canvas
`--elevation-2`
`shadow-md equivalent`
Sticky bars, floating FABs
`--elevation-3`
`shadow-lg equivalent`
Side drawers, panels
`--elevation-4`
`shadow-xl equivalent`
Modals, dialogs
`--elevation-5`
`shadow-2xl equivalent`
Full-screen overlays


Never apply elevation-3 or above to an element inside the survivor
reporting flow. High elevation implies urgency or interruption. The
survivor flow must feel calm and flat.

---

## Colour pairing rules

Never pair a colour with a foreground that is not its designated on-colour.
The pairings below are the only valid combinations.

Background token
Foreground token
`--primary-color`
`--on-primary-color`
`--primary-container-color`
`--on-primary-container-color`
`--secondary-color`
`--on-secondary-color`
`--secondary-container-color`
`--on-secondary-container-color`
`--tertiary-color`
`--on-tertiary-color`
`--tertiary-container-color`
`--on-tertiary-container-color`
`--error-color`
`--on-error-color`
`--error-container-color`
`--on-error-container-color`
`--background-color`
`--on-background-color`
`--surface-color`
`--on-surface-color`
`--surface-variant-color`
`--on-surface-variant-color`
`--inverse-surface-color`
`--inverse-on-surface-color`


If you need text on any surface-container variant, use
`--on-background-color` (`hsl(133, 18%, 10%)`). All surface containers
are light enough to support this foreground at WCAG AA.

---

## Rules that cannot be broken

A task fails under these design system rules even if the UI renders:
- A raw hex, HSL, or RGB colour value appears in any component file
(must use `var(--*)` instead)
- `hsl(300, 100%, 50%)` appears in any rendered UI element
- `--primary-color` is used as a text colour on a white or light surface
- Any text fails the 4.5:1 contrast ratio against its background
- Any font size below `1rem` appears in the survivor reporting flow
- `--font-weight-light` (300) is used for survivor-facing text
- Off-scale font size not in the type scale table appears in any component
- Off-scale spacing value not in the spacing token table appears in any
component
- A shadow is used decoratively rather than functionally
- Dark mode is partially implemented using known-broken magenta tokens
- A glow shadow token is used as anything other than a focus ring shadow
- A container background is paired with the wrong foreground (e.g. white
text on a light container)
markdown
<!-- .agents/rules/ai-pipeline.md -->

# AI Pipeline Rules — SafeVoice

## Provider model

SafeVoice uses two separate AI concerns: audio transcription and risk
classification. They are independent, configured separately, and served
through separate wrapper functions. Never merge them into one call or one
service.

Concern
Dedicated wrapper
Provider
Audio transcription (speech → text)
`lib/ai/transcribe.ts`
Configurable via `TRANSCRIPTION_PROVIDER` env var
Risk classification (text → risk level)
`lib/ai/classify.ts`
Configurable via `AI_PROVIDER` env var (`deepseek` or `claude`)


Neither wrapper is called from a route handler directly. All calls go
through `lib/` functions. No route handler imports the AI SDK.

---

## Transcription — `lib/ai/transcribe.ts`

Neither DeepSeek nor Claude accepts raw audio input for transcription.
The transcription provider is therefore a separate concern from the
classification provider, selected by the `TRANSCRIPTION_PROVIDER` env var.

TRANSCRIPTION_PROVIDER=whisper # Default. Recommended for Hausa and Yoruba.
TRANSCRIPTION_PROVIDER=assemblyai # Alternative with Nigerian English support.

The wrapper exports one function regardless of which provider is active:

```ts
export async function transcribeAudio(
audioKey: string,
language: Language,
): Promise<TranscriptionResult>

type TranscriptionResult = {
transcript: string;
status: 'complete' | 'failed';
durationSeconds: number;
}
```

The wrapper fetches a signed S3 URL for `audioKey`, streams the audio to
the configured transcription provider, and returns the result. The route
handler never touches audio bytes directly.

For Nigerian Pidgin (`Language.PIDGIN`), pass the provider's English
language code regardless of which transcription provider is active.
Whisper uses `'en'`. AssemblyAI uses `'en'`. No dedicated Pidgin model
exists in any currently available transcription provider.

Timeout: 30 seconds. If the provider does not respond within 30 seconds,
return `{ status: 'failed', transcript: '', durationSeconds: 0 }`.
Never throw. The caller handles the failure.

---

## Classification provider — `lib/ai/classify.ts`

The risk classification concern uses either **DeepSeek** or **Claude**,
selected by the `AI_PROVIDER` environment variable.

AI_PROVIDER=deepseek # Default
AI_PROVIDER=claude # Alternative

The wrapper exports one function. Its signature and return type do not
change regardless of which provider is active. Any route handler or lib
function that calls `classifyReport` must not know or care which provider
is running.

```ts
export async function classifyReport(
transcript: string,
language: Language,
isProxy: boolean,
): Promise<ClassificationResult>

type ClassificationResult = {
riskLevel: 'high' | 'medium' | 'low' | null;
rationale: string;
status: 'complete' | 'failed' | 'unclassified';
}
```

If classification fails for any reason, return:
```ts
{ riskLevel: null, rationale: '', status: 'unclassified' }
```
Never throw from `classifyReport`. The caller always receives a typed result.

---

## DeepSeek integration

DeepSeek exposes an OpenAI-compatible REST API. Use the `openai` npm
package pointed at DeepSeek's base URL. Do not write raw HTTP fetch calls.

```ts
import OpenAI from 'openai';

const deepseek = new OpenAI({
apiKey: process.env.DEEPSEEK_API_KEY,
baseURL: 'https://api.deepseek.com/v1',
});
```

### Model selection for DeepSeek

Task
Model
Reason
Risk classification
`deepseek-chat`
DeepSeek-V3. Fast, cheap, reliable instruction-following for constrained JSON output.
Do not use
`deepseek-reasoner`
DeepSeek-R1. Slower and more expensive than needed for a constrained classification task with a fixed schema. Reserve for future explainability features.


### DeepSeek call pattern

```ts
const response = await deepseek.chat.completions.create({
model: 'deepseek-chat',
response_format: { type: 'json_object' },
temperature: 0,
max_tokens: 256,
messages: [
{ role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
{ role: 'user',   content: buildUserMessage(transcript, language) },
],
});

const raw = response.choices[0]?.message?.content ?? '';
```

Set `temperature: 0`. This is a deterministic classification task, not a
creative one. Variance in the output is a defect, not a feature.

Set `response_format: { type: 'json_object' }`. DeepSeek supports this
OpenAI-compatible parameter. If the response is not valid JSON despite this
setting, treat it as a classification failure and return `unclassified`.

---

## Claude integration

Claude uses Anthropic's own SDK and message format. The two SDKs are not
interchangeable — do not pass a Claude response to DeepSeek parsing code
or vice versa.

```ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
apiKey: process.env.ANTHROPIC_API_KEY,
});
```

### Model selection for Claude

Task
Model
Reason
Risk classification
`claude-3-5-haiku-20241022`
Fastest and cheapest Claude model. More than sufficient for a constrained 3-class classification with a fixed output schema.
Fallback option
`claude-3-5-sonnet-20241022`
Use only if Haiku produces a measurable parity test failure on a specific language. Confirm in env var before switching.


Configure the model via env var so you can swap without a code change:

CLAUDE_MODEL=claude-3-5-haiku-20241022

### Claude call pattern

```ts
const response = await anthropic.messages.create({
model: process.env.CLAUDE_MODEL ?? 'claude-3-5-haiku-20241022',
max_tokens: 256,
system: CLASSIFICATION_SYSTEM_PROMPT,
messages: [
{ role: 'user', content: buildUserMessage(transcript, language) },
],
});

const raw = response.content[0]?.type === 'text'
? response.content[0].text
: '';
```

Claude does not support `response_format: { type: 'json_object' }`.
The system prompt must instruct the model to respond with only a JSON
object and nothing else. Parse defensively — strip any markdown fences
before `JSON.parse`. If the output is not valid JSON after stripping,
treat it as a classification failure.

---

## Shared classification rules — apply to both providers

These rules are provider-agnostic. They must hold regardless of which
provider is active. The wrapper function enforces them before and after
the provider call.

### The system prompt

`CLASSIFICATION_SYSTEM_PROMPT` is a constant defined in `lib/ai/classify.ts`.
It is the same string for both providers.

The prompt must contain all of the following. Do not remove any clause
when updating the prompt:

**1. Output format instruction**

Respond with only a valid JSON object in this exact format and nothing else:
{"riskLevel": "high" | "medium" | "low", "rationale": "string"}
Do not include markdown, backticks, or any text outside the JSON object.

**2. Classification criteria**

HIGH: Ongoing threat; perpetrator has current access to survivor;
report involves a minor; sexual violence with physical injury;
survivor indicates immediate danger.

MEDIUM: Incident within 7 days; perpetrator is known to survivor;
sexual violence without immediate ongoing threat.

LOW: Incident more than 7 days ago; perpetrator unknown or not in
the camp; economic or emotional abuse without physical threat.

**3. The perpetrator relationship rule — must be present verbatim**

Do not treat the survivor's relationship to the perpetrator (spouse,
family member, employer, or any other relationship) as a factor that
reduces the risk level. The relationship does not make violence less serious.

This sentence must survive every prompt update for both providers. After
every prompt change, verify it is still present before committing.

**4. Proxy report instruction**

If this report was filed by a proxy on behalf of the survivor, classify
using the same criteria. The proxy relationship does not change the risk
level of the incident described.

### Output parsing — shared

Parse the raw string output the same way regardless of provider:

```ts
function parseClassificationOutput(raw: string): ClassificationResult {
const cleaned = raw
.replace(/```json/g, '')
.replace(/```/g, '')
.trim();

let parsed: unknown;
try {
parsed = JSON.parse(cleaned);
} catch {
return { riskLevel: null, rationale: '', status: 'unclassified' };
}

if (
typeof parsed !== 'object' ||
parsed === null ||
!['high', 'medium', 'low'].includes((parsed as any).riskLevel)
) {
return { riskLevel: null, rationale: '', status: 'unclassified' };
}

return {
riskLevel: (parsed as any).riskLevel,
rationale: String((parsed as any).rationale ?? ''),
status: 'complete',
};
}
```

### Timeout — both providers

Set a 30-second timeout on every classification call. If the provider does
not respond in 30 seconds, return `{ status: 'unclassified', ... }`.
Do not let a slow provider block the report submission flow.

For DeepSeek (OpenAI SDK), pass `timeout: 30_000` in the client options.
For Claude (Anthropic SDK), wrap the call in `Promise.race` with a
30-second rejection.

### Retry — both providers

On a network failure or timeout, retry once after 5 seconds.
If the second attempt also fails, return `unclassified`. Do not retry more
than once — a case worker seeing `UNCLASSIFIED` in the inbox is preferable
to the report being delayed significantly.

---

## Provider switching

Switching `AI_PROVIDER` between `deepseek` and `claude` must not require
any change to calling code. The only required change is the environment
variable.

Before switching providers in any environment:

1. Run the cross-language parity test against the new provider using the
same transcripts used to baseline the current provider.
2. Confirm the parity rate meets 95% or above across all enabled languages.
3. Confirm `rationale` is never returned in any API response regardless
of provider (see RULE-07 in AGENTS.md).
4. Deploy the env var change. Monitor the `RiskOverride` table for the
first 48 hours for unusual override rates that might signal the new
provider classifying differently.

---

## Dashboard delivery — same for both providers

- The case worker dashboard polls every **30 seconds**.
- Once `aiClassificationStatus = COMPLETE`, the report is visible on the
next polling cycle.
- `ReportStatus` stays `NEW` after classification. Do not change it to
any other value as a result of AI processing.
- There is no status called `READY`. Do not add it to any enum or use it
in any code path.
- `UNCLASSIFIED` reports appear at the top of the case worker inbox above
all risk-tagged reports, flagged with "AI classification unavailable.
Please review and set risk level manually."
- `aiRiskRationale` must never appear in any API response. It is stored
in the database for bias auditing only.

---

## Human override — same for both providers

- A case worker can override any AI risk level at any time using
`humanRiskLevel`.
- `humanRiskLevel` takes precedence over `aiRiskLevel` in all dashboard
displays and escalation logic once set.
- Every override writes a `RiskOverride` record. The `reason` field is
required. The API rejects an override with an empty or whitespace-only
reason field.
- Override logs are reviewed monthly. The review examines whether any
provider produces a systematically higher override rate for a specific
language or incident type.

---

## Cross-language parity test

Before enabling any language in production, and after every prompt change
or provider switch:

1. Submit identical incident descriptions — same type, same timing, same
threat — translated into all five MVP languages.
2. Record the `riskLevel` returned for each language.
3. Any language that produces a different risk level for the same incident
must be investigated before that language is enabled.
4. Log the test results with a timestamp in the bias review record.

This test must pass for **both DeepSeek and Claude** independently.
A provider that passes the test for four languages but fails for one must
not be used until the failing language is resolved. Do not enable a
language on one provider and disable it on another — the enabled language
list must be identical for both providers.

---

## What counts as an AI pipeline failure

A task fails even if the feature appears to work:
- `classifyReport` or `transcribeAudio` is called from a route handler directly
- Either function throws instead of returning a typed `ClassificationResult`
or `TranscriptionResult`
- The classification timeout is longer than 30 seconds for either provider
- The perpetrator-relationship instruction is absent from the system prompt
- The system prompt differs between providers (it must be the same constant)
- `READY` appears anywhere as a `ReportStatus` value
- `aiRiskRationale` appears in any API response
- A language is enabled in production without a parity test passing for
the active provider
- A risk override is accepted with an empty reason field
- The case worker is blocked from accessing a report because AI failed
- Provider switching requires changes to calling code outside `lib/ai/classify.ts`
- `deepseek-reasoner` is used for classification in production
- Raw HTTP fetch calls are used instead of the provider SDK
- The `temperature` is set to anything other than `0` for classification
Two things worth flagging before you save these files.

On the design system: the glow shadow HSL values (hsla(256, 34%, 48%, 0.35) etc.) are purple and pink — they were carried over from a template and do not match your green palette. They are safe to use as focus ring shadows where the hue mismatch is invisible, but if you ever need glow shadows that match the brand, the values need to be regenerated from your actual green hue.

On the AI pipeline: DeepSeek and Claude both handle the system prompt well, but there is one practical difference you should know. DeepSeek's response_format: { type: "json_object" } parameter makes it more reliable at producing clean JSON with no markdown fences around it. Claude does not support that parameter, so Claude prompts need the explicit "respond with only a JSON object and nothing else" instruction in the system prompt and the markdown-stripping step in the parser. The rules already handle this, but it is worth knowing if you see Claude occasionally wrapping output in backtick blocks during testing.
.agents/skills/prisma-model.md
markdown
---
name: prisma-model
description: >
Load before touching schema.prisma or the migrations folder.
Trigger words: schema.prisma, Prisma model, prisma migrate, prisma generate,
migration, database model, enum, relation, constraint, campId, GIN index,
@relation, @@unique, @@index.
---

## What this skill teaches

The ordered procedure for writing a SafeVoice Prisma model, adding required
relations and constraints, running a versioned migration, and creating the raw
GIN index SQL file that Prisma cannot generate automatically.

Laws governing every decision in this skill: `database-schema.md`,
`data-retention.md`, `security.md`, PRD Section 10.

---

## Procedure

### 1. Read the full schema before writing anything

Open `prisma/schema.prisma` and read it completely.
Confirm the model you are about to create does not already exist under a
different name.
If you are modifying an existing model, write down every existing field and
relation before you change anything.
(database-schema.md § "The schema is locked")

### 2. Write the model fields

Add only the fields the PRD requires for this model.
Use these type rules:

Situation
Type to use
Plain text or ID
`String`
Encrypted content (`identityPayload`, `contactPayload`)
`String` — encryption is applied in `lib/crypto.ts`, not at the schema level
Optional field
`String?` or `Type?`
Timestamp set on creation
`DateTime @default(now())`
Timestamp set manually in code
`DateTime` with no default


Never add any field whose name contains `latitude`, `longitude`, `coordinates`,
`location`, or `gps` in any form.
(database-schema.md § "Fields that must never exist", data-retention.md
§ "No GPS ever", AGENTS.md RULE-08)

### 3. Add campId with a real @relation to every camp-scoped model

Every model that stores data for a specific IDP camp needs both lines:

```prisma
campId String
camp   Camp @relation(fields: [campId], references: [id])
```

The `String` field alone is not enough. Without `@relation`, the database does
not enforce the foreign key and Prisma queries cannot join through it.

Add the inverse side to the `Camp` model at the same time:

```prisma
model Camp {
// existing fields ...
yourNewModels YourNewModel[]
}
```

(database-schema.md § "campId relation on every table", AGENTS.md RULE-27)

### 4. Add indexes and unique constraints

Add every `@@index` the dashboard will query against. Minimum required per
model type:

```prisma
// On every camp-scoped model
@@index([campId])

// On Report — all of these are required
@@index([campId, status])
@@index([campId, aiRiskLevel])
@@index([childProtectionFlag])
@@index([scheduledDeletionAt])
@@index([submittedAt])
@@unique([sessionToken])       // hard constraint, not just an index

// On AnonymousSessionToken
@@index([token])
@@index([expiresAt])

// On RiskOverride and AuditLog
@@index([createdAt])
```

(database-schema.md § "Constraints that must exist")

### 5. Verify every enum touched in this change

Open the enum block for every enum you modified or created. Check against this
table:

Enum
Required value
Forbidden value
`PreWrittenStatus`
`REFERRAL_FAILED` must be present
—
`ReportStatus`
`NEW`, `IN_PROGRESS`, `REFERRED`, `CLOSED`
`READY` — remove if present
`AiClassStatus`
`UNCLASSIFIED` must be present
—
`Language`
`ENGLISH`, `HAUSA`, `YORUBA`, `IGBO`, `PIDGIN` only
`KANURI`, `FULFULDE` — Phase 2


(database-schema.md § "Enum values that must exist", AGENTS.md RULE-34,
RULE-44)

### 6. Confirm scheduledDeletionAt on Report

If you touched the `Report` model for any reason, confirm `scheduledDeletionAt
DateTime` is present with no `@default`. It is never set by the database. The
application sets it at creation time to `submittedAt + 24 months`.
(data-retention.md § "Every record has an expiry date")

### 7. Run prisma generate

```bash
npx prisma generate
```

Fix every type error before continuing. Do not move to step 8 if this fails.

### 8. Run a versioned migration

```bash
npx prisma migrate dev --name
```

Use a name that says what changed:

add-consent-record-camp-relation
add-unique-session-token-to-report
add-referral-failed-to-prewritten-status

Never use `prisma db push`. It discards migration history.
(AGENTS.md Section 5 coding standards — raw SQL only for GIN index)

### 9. Create the GIN index SQL file if the model has an array field

Prisma cannot generate a GIN index. If any model contains a `Type[]` array
field that the case worker dashboard filters by, you must create this file
manually.

Create a new migration directory:

```bash
mkdir prisma/migrations/$(date +%Y%m%d%H%M%S)_add_gin_index
```

Write `migration.sql` inside it:

```sql
-- GIN index for array filtering on Report.incidentTypes
-- Required: FR-034 — filter inbox by incident type
-- Prisma cannot generate this automatically.
CREATE INDEX IF NOT EXISTS report_incident_types_gin
ON "Report"
USING GIN ("incidentTypes");
```

(database-schema.md § "GIN index migration")

### 10. Verify the generated migration SQL

Open the `.sql` file Prisma generated in step 8.
Confirm:

- Table and column names match the schema (Prisma uses double-quoted
identifiers in PostgreSQL)
- The `campId` column has a `REFERENCES "Camp"("id")` foreign key constraint
- The `@@unique` constraint appears as `UNIQUE` in the SQL
- No banned field name appears anywhere in the file

---

## Code skeleton

```prisma
// prisma/schema.prisma

/// YourModel: [one sentence describing what this model stores and why]
model YourModel {
id        String   @id @default(cuid())

// --- camp isolation (required on every camp-scoped model) ---
campId    String
camp      Camp     @relation(fields: [campId], references: [id])

// --- your fields ---
// Plain strings:       someField  String
// Optional strings:    someField  String?
// Encrypted strings:   payload    String   // AES-256-GCM in lib/crypto.ts
// Never:               latitude   Float    // GPS banned — AGENTS.md RULE-08

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

// --- indexes ---
@@index([campId])
// add additional @@index lines for every field the dashboard queries by
}

// Also add the inverse relation to Camp:
// model Camp {
//   ...
//   yourModels YourModel[]
// }
```

```sql
-- prisma/migrations/{timestamp}_add_gin_index/migration.sql
-- Only create this file if the model has a Type[] array field.

CREATE INDEX IF NOT EXISTS report_incident_types_gin
ON "Report"
USING GIN ("incidentTypes");
```

---

## Traps

**Adding `campId String` without `@relation`.**
The field looks correct but the database has no foreign key. ConsentRecord and
AnonymousSessionToken both had this bug in the first schema version.
(database-schema.md § "campId relation on every table")

**Using `prisma db push`.**
This fast-pushes the schema without creating a migration file. Future
developers cannot replay the schema history. Always use `prisma migrate dev`.

**Forgetting the GIN index SQL file.**
Prisma silently produces no error. The index simply does not exist. Filtering
by `incidentTypes` runs a full table scan at production volume.

**Writing `READY` in the `ReportStatus` enum.**
It does not exist in the design. If it appears in any context — old code,
another agent's suggestion, a comment — remove it.
(AGENTS.md RULE-34, database-schema.md § "Enum values that must exist")

**Omitting `@@unique([sessionToken])` from `Report`.**
Without this, a race condition allows two reports from one anonymous token.
(database-schema.md § "Constraints that must exist")

**Setting a `@default` on `scheduledDeletionAt`.**
The deletion date must be calculated in application code from the actual
`submittedAt` value. A database default cannot do this correctly.

---

## Verify before done

- [ ] Every new model has `campId String` AND `camp Camp @relation(...)`
- [ ] The inverse relation is added to the `Camp` model
- [ ] `@@unique([sessionToken])` exists on `Report`
- [ ] No field name contains `latitude`, `longitude`, `coordinates`, `location`, or `gps`
- [ ] `REFERRAL_FAILED` is in `PreWrittenStatus`
- [ ] `READY` is not in `ReportStatus`
- [ ] `npx prisma generate` exits with zero errors
- [ ] `npx prisma migrate dev` produces a migration `.sql` file
- [ ] The migration SQL file contains the expected foreign key and unique constraints
- [ ] If an array field exists: `prisma/migrations/{ts}_add_gin_index/migration.sql` is present
- [ ] `scheduledDeletionAt` on `Report` has no `@default` value
**Tests to write:**
- Attempt to create two `Report` rows with the same `sessionToken` → expect unique constraint error
- Attempt to create a new model row with a `campId` that does not exist → expect foreign key error
- Query `Report` filtering by `incidentTypes` → confirm query plan uses the GIN index (check with `EXPLAIN`)
.agents/skills/api-route.md
markdown
---
name: api-route
description: >
Load before creating any route.ts file under app/api/.
Trigger words: route.ts, API route, route handler, endpoint, POST, GET,
PATCH, DELETE, /api/, Next.js route, server action, HTTP handler.
---

## What this skill teaches

The sequential build procedure for a SafeVoice Next.js App Router route
handler: Zod input validation → authentication and campId extraction → single
lib/ function call → AuditLog write → typed response envelope.

Laws governing every decision in this skill: `coding-standards.md`,
`security.md`, `database-schema.md`, AGENTS.md Section 3 (RULE-28 through
RULE-32).

---

## Procedure

### 1. Create the file at the correct path

All API routes live under `app/api/`. Follow the folder layout in
AGENTS.md Section 4:

app/api/consent/route.ts
app/api/report/route.ts
app/api/audio-upload-url/route.ts
app/api/caseworker/inbox/route.ts
app/api/admin/partners/route.ts
app/api/cron/delete-expired-reports/route.ts

Do not put business logic in the route file. The route file is thin.
(coding-standards.md § "Route handlers are thin")

### 2. Identify the auth type

Decide which of these three types applies:

Route type
Auth mechanism
Case worker or admin mutation
JWT in `httpOnly` cookie
Survivor report submission
Anonymous session token from `sessionStorage`
Nightly cron job
`x-cron-secret` header


(security.md § "Authentication", AGENTS.md RULE-28, RULE-29, RULE-43)

### 3. Write the Zod schema for request input

Write the Zod schema before writing the handler function. Put it in the same
file or in a co-located `schema.ts`.

```ts
import { z } from 'zod';

const RequestSchema = z.object({
// define every expected field with its type and constraints
});
```

Include enum validation for any SafeVoice enum field:

```ts
import { IncidentType } from '@prisma/client';
incidentTypes: z.array(z.nativeEnum(IncidentType)).min(1),
```

(coding-standards.md § "Input validation")

### 4. Parse the request body and reject on failure

Parse at the very top of the handler, before any other logic:

```ts
const body = await request.json().catch(() => null);
const parsed = RequestSchema.safeParse(body);
if (!parsed.success) {
return Response.json(
{ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
{ status: 400 }
);
}
```

(coding-standards.md § "Input validation", § "Response envelope")

### 5. Verify authentication

**For JWT routes:** call the middleware check or extract from the cookie. If
the JWT is missing or invalid, return 401 immediately.

**For anonymous session token routes:** call `lib/session.ts` to validate the
token. Check that it is not expired and not already used. If invalid, return
401.

**For cron routes:** check the `x-cron-secret` header against the environment
variable. If missing or wrong, return 401 immediately.

(security.md § "Authentication", AGENTS.md RULE-28, RULE-29, RULE-43)

### 6. Extract campId and scope every query

For JWT routes: extract `campId` from the verified JWT payload.
For anonymous routes: extract `campId` from the validated session token record
in `AnonymousSessionToken`.

Pass `campId` explicitly to the lib/ function. The lib/ function must include
`campId` in every Prisma `where` clause.

Never trust a `campId` sent in the request body.
(AGENTS.md RULE-26, security.md § "API security")

### 7. Call exactly one lib/ function

The route handler calls one function from `lib/`. It does not call Prisma
directly. It does not call OpenAI or S3 directly.

```ts
const result = await createReport(parsed.data, campId);
```

If the work requires calling multiple lib/ functions in sequence, create a new
orchestrating function in `lib/` and call that single orchestrator from the
route.
(coding-standards.md § "Route handlers are thin", § "Layering")

### 8. Write the AuditLog entry before returning

Call `lib/audit.ts` before the return statement. Pass the action string and
metadata. The metadata schema in `lib/audit.ts` will reject any key that
references survivor identity fields.

```ts
await writeAuditLog({
userId,
action: 'REPORT_CREATED',
entityType: 'Report',
entityId: result.id,
metadata: { campId, submittedViaProxy: parsed.data.submittedViaProxy },
});
```

Never write the AuditLog after the return. If the response is sent first and
the audit write then fails, there is no record of the mutation.
(AGENTS.md RULE-31, coding-standards.md § "AuditLog")

### 9. Return the standard response envelope

Every response from every route uses the same shape:

```ts
// Success
return Response.json({ success: true, data: result }, { status: 201 });

// Failure
return Response.json(
{ success: false, error: { code: 'REPORT_CREATION_FAILED', message: '...' } },
{ status: 500 }
);
```

Use 400 for client errors, 401 for auth failure, 403 for wrong camp, 422 for
validation failure, 500 for unexpected errors.
Never return HTTP 200 for a failure.
(coding-standards.md § "Response envelope")

### 10. Apply rate limiting

Add rate limiting as the first check after authentication:

- Anonymous submission endpoint: 5 requests per session token
- Case worker routes: 100 requests per minute per JWT
- Admin routes: 50 requests per minute per JWT
- Cron endpoint: 1 request per minute

Return HTTP 429 when the limit is exceeded.
(security.md § "API security — rate limiting", AGENTS.md RULE-30)

---

## Code skeleton

```ts
// app/api/[your-route]/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyJwt } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { yourLibFunction } from '@/lib/your-module';

// ── 1. Zod schema ─────────────────────────────────────────────
const RequestSchema = z.object({
fieldName: z.string().min(1),
// add fields here
});

// ── 2. Handler ────────────────────────────────────────────────
export async function POST(request: NextRequest) {

// Step 3 – validate input
const body = await request.json().catch(() => null);
const parsed = RequestSchema.safeParse(body);
if (!parsed.success) {
return Response.json(
{ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
{ status: 400 }
);
}

// Step 4 – verify auth and extract campId
const auth = await verifyJwt(request); // throws or returns { userId, campId, role }
if (!auth) {
return Response.json(
{ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } },
{ status: 401 }
);
}
const { userId, campId } = auth;

// Step 5 – call one lib/ function
const result = await yourLibFunction(parsed.data, campId);

// Step 6 – write AuditLog BEFORE return
await writeAuditLog({
userId,
action: 'YOUR_ACTION',
entityType: 'YourModel',
entityId: result.id,
metadata: { campId },
});

// Step 7 – return standard envelope
return Response.json({ success: true, data: result }, { status: 201 });
}
```

```ts
// Anonymous session token route (survivor submission)
export async function POST(request: NextRequest) {
// Step 1 – check rate limit (5 per token)
// Step 2 – validate session token from header
const token = request.headers.get('x-session-token');
const session = await validateAndMarkSessionToken(token); // lib/session.ts
if (!session) {
return Response.json(
{ success: false, error: { code: 'SESSION_TOKEN_INVALID', message: 'Token expired or already used' } },
{ status: 401 }
);
}
const { campId } = session;
// ... rest of procedure
}
```

```ts
// Cron route
export async function POST(request: NextRequest) {
const secret = request.headers.get('x-cron-secret');
if (secret !== process.env.CRON_SECRET) {
return Response.json(
{ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } },
{ status: 401 }
);
}
// No campId scoping — cron operates across all camps
const result = await runNightlyDeletion(); // lib/deletion.ts
return Response.json({ success: true, data: result });
}
```

---

## Traps

**Calling Prisma directly inside the route handler.**
Move the Prisma call into a `lib/` function. The route calls the lib function.
(coding-standards.md § "Layering")

**Calling an AI service or S3 directly inside the route handler.**
Same rule. Every external service call belongs in `lib/ai/` or `lib/` modules.

**Writing the AuditLog after the return statement.**
The return exits the function. The audit write never executes.

**Trusting `campId` from the request body.**
Extract `campId` only from the verified JWT or the session token record.
A user can send any campId in a request body.

**Returning `{ success: true }` for a failed operation.**
Every failure returns a non-200 status code alongside `success: false`.

**Skipping Zod validation on query parameters.**
Query parameters are user input. Validate them with Zod just like the request
body. They arrive as strings; coerce and validate before use.

**Forgetting rate limiting on the anonymous submission endpoint.**
An attacker without credentials can hammer this endpoint. 5 requests per token
is the maximum.
(security.md § "API security")

---

## Verify before done

- [ ] Route file is under `app/api/` in the correct subfolder
- [ ] Zod schema validates every input field before any other logic runs
- [ ] Auth is verified before campId is extracted
- [ ] campId comes from the JWT or session token — never from the request body
- [ ] The handler calls exactly one lib/ function (create a new lib orchestrator if more than one is needed)
- [ ] `writeAuditLog` is called before the `return` statement
- [ ] Every response — success and failure — uses the standard envelope shape
- [ ] HTTP status codes are correct (400 client error, 401 auth, 403 wrong camp, 422 validation, 500 server error)
- [ ] Rate limiting is applied for the route's auth type
- [ ] Cron routes check `x-cron-secret` as the very first thing
**Tests to write:**
- Send a request with a missing required field → expect 400 with `VALIDATION_ERROR`
- Send a request with a valid JWT but a `campId` in the body for a different camp → expect the query to return zero results for that other camp (campId from JWT, not body)
- Send a request with an expired session token → expect 401
- Call the cron route without `x-cron-secret` → expect 401
- Confirm the AuditLog row exists after a successful mutation
.agents/skills/survivor-component.md
markdown
---
name: survivor-component
description: >
Load before creating any file inside app/(survivor)/.
Trigger words: survivor flow, consent screen, language selector, age selector,
incident type, audio recorder, panic exit, confirmation screen, status check,
reporting flow, app/(survivor), survivor component, survivor page.
---

## What this skill teaches

The ordered build and verification sequence for a SafeVoice survivor-facing
component: server-vs-client decision → design system tokens → 44px tap targets
→ ARIA labels → audio labels on tap → lazy audio → no third-party scripts → SVG
icons → WebP images → sub-200kb FCP check → contrast check.

Laws governing every decision in this skill: `design-system-rule.md`,
`accessibility.md`, `coding-standards.md`, `offline-sync.md`, AGENTS.md
Section 3 (RULE-17 through RULE-25).

---

## Procedure

### 1. Decide server component or client component

Ask: does this component directly use any of these browser APIs?

- `MediaRecorder` or Web Audio API
- `IndexedDB`
- `window` or `navigator`
- `sessionStorage`
- `addEventListener` on DOM events

If no: write a server component. Do not add `'use client'`.
If yes: add `'use client'` and write a one-line comment explaining which
browser API requires it.

If you are adding interactive state but no browser API (e.g. a toggle), use
the server-component-with-client-leaf pattern: the server component renders
layout and data; a small child component marked `'use client'` handles the
interaction.
(coding-standards.md § "React and Next.js components")

### 2. Apply design system tokens for every colour, spacing, and size value

Every colour in the component must come from a CSS variable. No raw hex codes,
HSL values, or RGB values in component files.

```tsx
// Correct
style={{ backgroundColor: 'var(--secondary-color)' }}
className="bg-[var(--secondary-color)]"

// Wrong — never do this
style={{ backgroundColor: '#1A7A44' }}
style={{ backgroundColor: 'hsl(143, 100%, 22%)' }}
```

Use only the approved colour pairings from `design-system-rule.md`:

Background token
Only permitted foreground
`--secondary-color`
`--on-secondary-color` (white)
`--primary-container-color`
`--on-primary-container-color`
`--error-color`
`--on-error-color` (white)
`--background-color`
`--on-background-color`


Use only spacing values from the scale (spacing-1 through spacing-96). No
arbitrary pixel values.
(design-system-rule.md § "Colour roles", § "The spacing rules")

### 3. Set 44×44px minimum on every interactive element

Every `<button>`, `<a>`, icon button, checkbox, radio, and toggle must have a
minimum tap target of 44×44px. Apply padding beyond the visual size if needed.

```tsx

{/* visual content */}

```

The panic exit button is in `app/(survivor)/layout.tsx`. Do not add it to
individual page components. Confirm it is present and has minimum 44×44px.
(accessibility.md § "Tap targets", AGENTS.md RULE-14)

### 4. Add aria-label to every icon

Every icon the survivor interacts with must have a descriptive `aria-label`
in English (the underlying HTML layer). This is separate from the audio label.

```tsx

```

Decorative icons that convey no information use `aria-hidden="true"`.
(accessibility.md § "Images and icons")

### 5. Wire audio labels to tap — not hover

Every icon the survivor can interact with must play an audio prompt in their
selected language when tapped. Use the shared `LanguageAudio` component.

```tsx
import { LanguageAudio } from '@/components/shared/LanguageAudio';

```

`LanguageAudio` plays the audio file from `public/audio/{lang}/{promptKey}.mp3`
on `onClick`. It must never be triggered on `onMouseEnter`.
(accessibility.md § "Audio prompts", localisation.md § "Audio labels on tap",
AGENTS.md RULE-25)

### 6. Lazy-load any audio recording or playback component

Import audio components using Next.js dynamic imports with `ssr: false`.

```tsx
import dynamic from 'next/dynamic';

const AudioRecorder = dynamic(
() => import('@/components/survivor/AudioRecorder'),
{ ssr: false, loading: () =>  }
);
```

The `AudioRecorder` component must not be part of the initial JS bundle.
(AGENTS.md RULE-21, design-system-rule.md § "Audio UI components")

### 7. Allow no third-party script imports

Check every import at the top of the file. No import may resolve to a
third-party analytics, tracking, monitoring, or UI-enhancement library.

Allowed: imports from `@/components`, `@/lib`, `@/hooks`, `react`,
`next`, `@prisma/client`, `zod`, Tailwind classes.
Not allowed: any analytics, error tracking, chat widget, CDN-hosted library,
or A/B testing tool.
(AGENTS.md RULE-19)

### 8. Use SVG icons only

Never import from an icon font package (`react-icons` packages that use font
glyphs, Font Awesome, Material Icons from a CDN).
Import SVG icons as React components from `public/icons/` or use inline SVG.
(AGENTS.md RULE-18, design-system-rule.md § "Icons")

### 9. Use WebP images with explicit dimensions

```tsx
// Correct

// Wrong

```

Use the Next.js `<Image>` component. Never use a plain `<img>` tag for new
images.
(AGENTS.md RULE-20, design-system-rule.md § "Images")

### 10. Measure the page weight contribution

After the component is built, run Lighthouse CI with 2G throttling:

```bash
npx lighthouse http://localhost:3000/\[survivor-route\] \
--throttling-method=simulate \
--throttling.downloadThroughputKbps=256 \
--output=json
```

The First Contentful Paint payload (HTML + CSS + JS + images combined) for any
survivor route must be under 200kb. The audio upload pipeline is excluded from
this budget.

If the route exceeds 200kb, audit the JS bundle for eager imports that can be
lazy-loaded.
(AGENTS.md RULE-17, design-system-rule.md § "Page weight budget")

### 11. Check contrast for every text element

Every text element in the component must achieve 4.5:1 contrast against its
background. Use the CSS variable colour pairs in step 2. If you introduced any
custom colour, check it with a contrast checker.
(accessibility.md § "Contrast ratio", AGENTS.md RULE-24)

---

## Code skeleton

```tsx
// app/(survivor)/[screen]/page.tsx — server component (default)
// No 'use client' — this component does not use browser APIs

import { LanguageAudio } from '@/components/shared/LanguageAudio';
import dynamic from 'next/dynamic';

// Lazy-load any audio component
const AudioRecorder = dynamic(
() => import('@/components/survivor/AudioRecorder'),
{ ssr: false }
);

export default function ScreenPage() {
return (

    {/\* page title \*/}  
  

  {/\* Interactive icon with 44px target \+ aria-label \+ audio label \*/}  
    
    {/\* SVG icon, not icon font \*/}  

);
}
```

```tsx
// Client component — only when browser API is required
'use client';
// Reason: uses MediaRecorder API for voice recording

import { useState } from 'react';
import { LanguageAudio } from '@/components/shared/LanguageAudio';

export function RecordingStep() {
const [isRecording, setIsRecording] = useState(false);

return (
<button
onClick={() => setIsRecording(r => !r)}
onMouseEnter={undefined}   // never use hover for audio
className="min-h-[44px] min-w-[44px] p-4 rounded-full"
style={{
backgroundColor: 'var(--secondary-color)',
color: 'var(--on-secondary-color)',
}}
aria-label={isRecording ? 'Stop recording' : 'Start recording'}
aria-pressed={isRecording}
>

);
}
```

---

## Traps

**Adding `'use client'` because the component uses `useState`.**
Server components can render client leaf components. Move the state into a
small client child and keep the page as a server component.

**Writing a raw hex or HSL colour value in the component.**
Every colour must be a CSS variable. One raw value breaks the design system.

**Setting a tap target to 40px.**
4px below the 44px minimum. Add `min-h-[44px] min-w-[44px]` to every
interactive element.

**Triggering audio on `onMouseEnter`.**
Touch devices have no hover. The audio will never play for survivors on
smartphones.

**Eagerly importing `AudioRecorder`.**
It adds significant KB to the initial bundle. Always import it with
`dynamic(..., { ssr: false })`.

**Importing from an icon font package.**
Check the package.json of any icon library you are about to import. If it
ships a font file, do not use it.

**Adding a third-party analytics import.**
Even `import analytics from 'some-analytics'` in a component that is part of
the survivor flow fails this rule. Move it to the caseworker layout if it is
needed at all.

---

## Verify before done

- [ ] `'use client'` is present only if the component directly uses a browser API, with a comment explaining which one
- [ ] Every colour value is a CSS variable — no raw hex, RGB, or HSL
- [ ] Every interactive element is at minimum 44×44px
- [ ] Every interactive icon has `aria-label` on its parent element
- [ ] Every icon that is purely decorative has `aria-hidden="true"`
- [ ] `LanguageAudio` is wired to `onClick`, not `onMouseEnter`
- [ ] No audio component is eagerly imported (all use `dynamic(..., { ssr: false })`)
- [ ] No third-party library is imported anywhere in the component tree
- [ ] All icons are SVG — no icon font imports
- [ ] All images use the Next.js `<Image>` component with `width`, `height`, and WebP `src`
- [ ] Lighthouse CI on 2G: FCP payload is under 200kb for the route
- [ ] All text achieves 4.5:1 contrast against its background
**Tests to write:**
- Lighthouse CI assertion: survivor route FCP payload < 200kb on 2G throttle
- Axe or jest-axe accessibility scan: zero violations on the rendered component
- Tap target test: every `button` and `a` element has `offsetWidth >= 44` and `offsetHeight >= 44`
- Audio label test: clicking each interactive icon triggers the audio play handler
.agents/skills/caseworker-component.md
markdown
---
name: caseworker-component
description: >
Load before creating any file inside app/(caseworker)/ or app/(admin)/.
Trigger words: case worker dashboard, caseworker component, admin panel,
inbox, report detail, risk override, referral assignment, risk badge,
aggregate stats, partner config, escalation contacts, app/(caseworker),
app/(admin), dashboard table, dashboard modal.
---

## What this skill teaches

The ordered build and verification sequence for a SafeVoice case worker or
admin dashboard component: server-vs-client decision → semantic HTML structure
→ table ARIA → keyboard Tab order → focus management → risk badge colour+label
→ contrast check → keyboard activation.

Laws governing every decision in this skill: `accessibility.md`,
`design-system-rule.md`, `coding-standards.md`, AGENTS.md RULE-23, RULE-24,
RULE-26.

---

## Procedure

### 1. Decide server component or client component

Most dashboard data-fetch views should be server components.
Use server components for: fetching and displaying report lists, reading partner
config, showing aggregate statistics.

Use `'use client'` only for: modals with internal open/close state, forms with
controlled inputs, components that poll for new data.

For complex dashboard features: write a server component that fetches data and
passes it to a `'use client'` child that handles interaction.
(coding-standards.md § "React and Next.js components")

### 2. Use semantic HTML elements

Every dashboard element must use the correct HTML element:

Purpose
Element to use
Never use
Tabular data
`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`
`<div>` grid for tables
Main navigation
`<nav>`
`<div>` with click handlers
Page content area
`<main>`
`<div id="main">`
Sidebar
`<aside>`
`<div class="sidebar">`
Section with heading
`<section>`
unlabelled `<div>`
Headings
`<h1>` → `<h2>` → `<h3>` in order
`<h1>` followed by `<h3>`


(accessibility.md § "Reading order and semantic HTML")

### 3. Add ARIA roles and headers to data tables

Every data table in the dashboard must have column headers with `scope`:

```tsx

  Reference Code  
  Risk Level  
  Submitted  
  Actions  
  


{reports.map(report \=\> (  
    
    {report.referenceCode}  
    {/\* ... \*/}  
    
))}  

```

If using a component library table, confirm it renders native `<table>` HTML,
not `<div role="table">`.
(accessibility.md § "Reading order and semantic HTML", § "Keyboard navigation")

### 4. Set keyboard Tab order

The Tab key must move focus through interactive elements in the same order a
sighted user would read the page: left to right, top to bottom.

Never use `tabIndex` values greater than 0. These disrupt the natural Tab
order for keyboard users.

Use `tabIndex={0}` only on non-interactive elements that need to be
keyboard-reachable (rare). Use `tabIndex={-1}` to make elements programmatically
focusable without putting them in the Tab sequence.
(accessibility.md § "Keyboard navigation")

### 5. Implement focus management on modals and overlays

When a modal or overlay opens:
1. Move focus to the first interactive element inside the modal.
2. Trap focus inside the modal while it is open (Tab and Shift+Tab cycle within).
3. When the modal closes, return focus to the element that triggered it.

```tsx
'use client';
import { useRef, useEffect } from 'react';

export function RiskOverrideModal({ onClose, triggerRef }: Props) {
const firstInputRef = useRef(null);

useEffect(() => {
firstInputRef.current?.focus();             // move focus in on open
return () => triggerRef.current?.focus();   // return focus on close
}, [triggerRef]);

return (

  Override Risk Level  
    
  Cancel  

);
}
```

(accessibility.md § "Focus management")

### 6. Risk badges must have colour AND text label

A risk badge cannot use colour as the only signal. Every badge must include
both a colour fill and a text label. Never a coloured dot alone.

```tsx
// Correct — colour + text
function RiskBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
const styles = {
HIGH:   { bg: 'var(--error-color)',       fg: 'var(--on-error-color)' },
MEDIUM: { bg: 'var(--tertiary-color)',    fg: 'var(--on-tertiary-color)' },
LOW:    { bg: 'var(--secondary-container-color)', fg: 'var(--on-secondary-container-color)' },
};
return (

  {level}  {/\* text label always present \*/}  

);
}

// Wrong — colour only

```

Apply the same rule to status badges (`REFERRAL_FAILED` etc.) and child
protection flags.
(AGENTS.md RULE-23, accessibility.md § "Color — never the sole signal")

### 7. Check 4.5:1 contrast for all text

Every text element in the dashboard must achieve 4.5:1 contrast against its
background. The muted grey `--muted` variable (`#5A6270`) on a white background
is the boundary case — verify it before using it for anything other than
secondary labels.
(accessibility.md § "Contrast ratio", AGENTS.md RULE-24)

### 8. Verify keyboard activation for every interactive element

Every action available by mouse click must be activatable by keyboard.
Buttons activate on `Enter` and `Space` by default. Confirm `<div>` or `<span>`
with `onClick` handlers are not used anywhere — replace them with `<button>`.

Test by tabbing to the element and pressing `Enter`. If nothing happens, the
element is keyboard-inaccessible.
(accessibility.md § "Keyboard navigation — case worker dashboard")

### 9. Screen reader live regions for async updates

When new reports appear in the inbox after the 30-second polling cycle, announce
it to screen reader users:

```tsx

{newReportCount > 0 && `${newReportCount} new report${newReportCount > 1 ? 's' : ''} in inbox`}

```

Use `aria-live="assertive"` only for critical failures (sync error, auth
expiry). Not for routine updates.
(accessibility.md § "Screen reader announcements")

---

## Code skeleton

```tsx
// app/(caseworker)/inbox/page.tsx — server component
import { getInboxReports } from '@/lib/caseworker';
import { RiskBadge } from '@/components/caseworker/RiskBadge';
import { InboxActions } from '@/components/caseworker/InboxActions'; // 'use client' child

export default async function InboxPage() {
const reports = await getInboxReports(); // scoped to campId in lib/

return (

  Report Inbox  
    
      
        
        Reference  
        Risk  
        Submitted  
        Actions  
        
      
      
      {reports.map(report \=\> (  
          
          {report.referenceCode}  
            
          {report.submittedAt.toLocaleString()}  
            
          
      ))}  

);
}
```

```tsx
// components/caseworker/RiskBadge.tsx
// Colour + text label — never colour alone (AGENTS.md RULE-23)

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCLASSIFIED';

const RISK_STYLES: Record = {
HIGH:         { bg: 'var(--error-color)',                     fg: 'var(--on-error-color)' },
MEDIUM:       { bg: 'var(--tertiary-color)',                  fg: 'var(--on-tertiary-color)' },
LOW:          { bg: 'var(--secondary-container-color)',       fg: 'var(--on-secondary-container-color)' },
UNCLASSIFIED: { bg: 'var(--surface-variant-color)',           fg: 'var(--on-surface-variant-color)' },
};

export function RiskBadge({ level }: { level: RiskLevel | null }) {
const safe = level ?? 'UNCLASSIFIED';
const { bg, fg } = RISK_STYLES[safe];
return (

  {safe}  

);
}
```

```tsx
// components/caseworker/RiskOverrideModal.tsx
'use client';
// Reason: manages open/close state and focus for the override dialog.

import { useRef, useEffect, RefObject } from 'react';

interface Props {
reportId: string;
onClose: () => void;
triggerRef: RefObject;
}

export function RiskOverrideModal({ reportId, onClose, triggerRef }: Props) {
const firstInputRef = useRef(null);

useEffect(() => {
firstInputRef.current?.focus();
return () => { triggerRef.current?.focus(); };  // return focus on unmount
}, [triggerRef]);

return (

  Override Risk Level

  New risk level  
    
    HIGH  
    MEDIUM  
    LOW  
  

  Reason (required)  
  

  Cancel  
  Save override  

);
}
```

---

## Traps

**Using a `<div>` as a table row or cell.**
`<div role="row">` is not equivalent to `<tr>` for keyboard navigation.
Use native `<table>` elements.

**Modal that does not return focus on close.**
The user's keyboard cursor is now stranded at the top of the page.
Always call `triggerRef.current?.focus()` when the modal unmounts.

**Risk badge with colour fill and no text.**
A colourblind case worker cannot distinguish HIGH from LOW. Text label is
mandatory alongside colour.

**Setting `tabIndex={2}` or any value above 0.**
Positive tabIndex values override the natural document order, causing
unpredictable Tab behaviour for keyboard users.

**Making the entire dashboard page `'use client'`.**
Fetching data in a server component and passing it to a small client leaf is
faster, simpler, and avoids sending the Prisma client or other server-only
code to the browser.

**Forgetting `aria-live` on the polling update region.**
Screen reader users get no indication that new reports have appeared after the
30-second polling cycle.

---

## Verify before done

- [ ] Page component is a server component unless it directly uses a browser API
- [ ] All tabular data uses native `<table>`, `<thead>`, `<th scope="col">`, `<tbody>`, `<tr>`, `<td>`
- [ ] No `tabIndex` values above 0 anywhere in the component tree
- [ ] Modal open: focus moves to first interactive element inside the modal
- [ ] Modal close: focus returns to the element that triggered the modal
- [ ] Every risk badge, status badge, and flag shows both colour and text
- [ ] Every `<button>` activates on `Enter` key press
- [ ] No `<div>` or `<span>` has an `onClick` handler without also being a `<button>`
- [ ] All text achieves 4.5:1 contrast
- [ ] `aria-live="polite"` region exists for async inbox updates
- [ ] `aiRiskRationale` does not appear in any rendered output (AGENTS.md RULE-07)
**Tests to write:**
- Keyboard navigation test: Tab through the inbox table — confirm all action buttons are reachable
- Focus management test: open the risk override modal → confirm `document.activeElement` is inside the modal; close it → confirm focus returned to trigger
- jest-axe scan: zero accessibility violations on the rendered dashboard
- Risk badge test: render `<RiskBadge level="HIGH" />` → confirm it renders both a coloured background and the text "HIGH"
.agents/skills/offline-feature.md
markdown
---
name: offline-feature
description: >
Load before modifying service-worker.ts or any IndexedDB logic.
Trigger words: offline, IndexedDB, service worker, background sync, PWA,
offline queue, sync, precache, offline support, useOfflineQueue, no internet,
offline-first, connectivity.
---

## What this skill teaches

The ordered implementation sequence for making a survivor-flow feature work
offline: service worker precache update → IndexedDB key definition → local
save in the submit handler → audio-first sync handler → connectivity
health-check → retry backoff → UI status indicator → panic exit wiring.

Laws governing every decision in this skill: `offline-sync.md`, PRD Section 07
(PWA and Offline Sync), AGENTS.md RULE-10, RULE-11, RULE-15, RULE-16,
PRD FR-014, FR-015, FR-019, FR-021A.

---

## Procedure

### 1. Add the new route to the service worker precache list

Open `workers/service-worker.ts`.
Add the new survivor route URL to the `precacheEntries` array so it is
downloaded on first visit and available offline.

```ts
// workers/service-worker.ts
precacheAndRoute([
{ url: '/report', revision: null },
{ url: '/consent', revision: null },
{ url: '/your-new-route', revision: null },  // add this line
// audio prompts and icons are precached separately
]);
```

Also confirm `public/audio/{lang}/` files for all enabled languages are in
the precache manifest.
(offline-sync.md § "What the service worker caches")

### 2. Define IndexedDB key constants

Open `hooks/useOfflineQueue.ts`.
Add key constants for the new feature. Use the established prefix scheme:

```ts
// hooks/useOfflineQueue.ts
export const IDB_KEYS = {
REPORT_PENDING: (token: string) => `report:pending:${token}`,
AUDIO_PENDING:  (token: string) => `audio:pending:${token}`,
REFCODE:        (token: string) => `refcode:${token}`,
} as const;
```

Do not invent new top-level key schemes. All offline data uses these three
prefixes.
(offline-sync.md § "What IndexedDB stores")

### 3. Save to IndexedDB in the submit handler — before calling the API

In the component's submit handler, save both the audio blob and the report
metadata to IndexedDB before any network call:

```ts
async function handleSubmit(formData: ReportFormData, audioBlob: Blob) {
const token = getSessionToken(); // from sessionStorage

// Save audio first
await idb.set(IDB_KEYS.AUDIO_PENDING(token), audioBlob);
// Save metadata second
await idb.set(IDB_KEYS.REPORT_PENDING(token), JSON.stringify(formData));
// Save reference code for later retrieval
await idb.set(IDB_KEYS.REFCODE(token), formData.referenceCode);

// Now attempt online submission
if (navigator.onLine) {
await triggerSync();
}
// If offline: the service worker's background sync fires when connectivity returns
}
```

Both the audio blob AND the metadata must be in IndexedDB before the function
returns. If the device loses power after this point, the data is recoverable.
(offline-sync.md § "How a report is saved while offline")

### 4. Write the sync handler — audio upload first, always

In the service worker sync registration, the handler must follow the exact
sequence from `offline-sync.md`. Audio upload is always first:

```ts
// workers/service-worker.ts — sync handler
self.addEventListener('sync', (event: SyncEvent) => {
if (event.tag === 'report-sync') {
event.waitUntil(syncPendingReport());
}
});

async function syncPendingReport() {
const tokens = await getPendingTokens(); // query IDB for report:pending:* keys

for (const token of tokens) {
// Step 1: upload audio
const audioBlob = await idb.get(IDB_KEYS.AUDIO_PENDING(token));
if (!audioBlob) continue;

const uploadOk \= await uploadAudioToS3(audioBlob, token); // uses chunked upload  
if (\!uploadOk) {  
  await scheduleRetry(token);  
  continue;  // do NOT proceed to metadata submission  
}

// Step 2: delete audio from IDB only after S3 confirms  
await idb.delete(IDB\_KEYS.AUDIO\_PENDING(token));

// Step 3: submit metadata  
const metadata \= await idb.get(IDB\_KEYS.REPORT\_PENDING(token));  
const submitOk \= await submitReportMetadata(JSON.parse(metadata), token);  
if (\!submitOk) {  
  await scheduleRetry(token);  
  continue;  
}

// Step 4: clean up IDB only after server returns 201  
await idb.delete(IDB\_KEYS.REPORT\_PENDING(token));  
await idb.delete(IDB\_KEYS.REFCODE(token));  

}
}
```

Never submit metadata before audio upload is confirmed. Never delete IDB
entries before the server returns HTTP 201.
(offline-sync.md § "The sync sequence", AGENTS.md RULE-10, RULE-11)

### 5. Add the connectivity health-check before every sync attempt

Do not trust `navigator.onLine` alone. Send a HEAD request to `/api/health`
before starting the sync:

```ts
async function isServerReachable(): Promise {
try {
const res = await fetch('/api/health', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
return res.ok;
} catch {
return false;
}
}

// In syncPendingReport:
if (!(await isServerReachable())) {
await scheduleRetry(token);
return;
}
```

(offline-sync.md § "Connectivity detection")

### 6. Implement retry backoff

Track the attempt count per token in IDB. Apply exponential backoff:

```ts
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000]; // attempt 1, 2, 3
const MAX_ATTEMPTS = 3;

async function scheduleRetry(token: string) {
const attempts = await getAttemptCount(token);
if (attempts >= MAX_ATTEMPTS) {
await markSyncFailed(token);
return;
}
await incrementAttemptCount(token);
const delay = RETRY_DELAYS_MS[attempts] ?? 300_000; // 5 min after 3rd attempt
setTimeout(() => triggerSync(), delay);
}
```

(offline-sync.md § "Sync retry")

### 7. Show the UI status indicator while the report is queued

While `IDB_KEYS.REPORT_PENDING(token)` exists and is not yet synced, the
survivor must see a visible status in their selected language:

```tsx
// components/survivor/OfflineSyncStatus.tsx
'use client';
// Reason: reads from IndexedDB which is a browser API

export function OfflineSyncStatus({ token }: { token: string }) {
const [isPending, setIsPending] = useState(false);

useEffect(() => {
idb.get(IDB_KEYS.REPORT_PENDING(token)).then(v => setIsPending(!!v));
}, [token]);

if (!isPending) return null;

return (

  {t('sync.pending')} {/\* translated string \*/}  

);
}
```

Show the message: "Your report is saved and will be sent when you have a
connection." Do not show technical details.
(offline-sync.md § "Sync status UI", PRD FR-015)

### 8. Show the health-worker fallback message after 3 failed attempts

After the third sync failure, display the fallback in the survivor's language:

```ts
async function markSyncFailed(token: string) {
// Set a flag in IDB so the UI can show the message
await idb.set(`sync:failed:${token}`, true);
// Do NOT delete the queued report — it stays for manual recovery
}
```

Message to show: "Your report could not be sent. Please speak with a community
health worker and show them your reference code."
(offline-sync.md § "What happens if sync fails 3 times", PRD FR-019)

### 9. Wire the new IDB keys to the panic exit handler

Open `components/shared/PanicExitButton.tsx`.
Add the new `IDB_KEYS.AUDIO_PENDING(token)` and `IDB_KEYS.REPORT_PENDING(token)`
to the list of IndexedDB entries the panic exit clears:

```ts
async function handlePanicExit() {
// 1. Clear React form state (done by caller)
// 2. Clear sessionStorage
sessionStorage.clear();
// 3. Clear IndexedDB pending entries
await idb.delete(IDB_KEYS.REPORT_PENDING(currentToken));
await idb.delete(IDB_KEYS.AUDIO_PENDING(currentToken));
await idb.delete(IDB_KEYS.REFCODE(currentToken));
// 4. Navigate away — no back button return
window.location.replace(decoyUrl);
}
```

Do not delete IDB entries for reports that are already submitted
(`audioSyncComplete === true` in the server).
(AGENTS.md RULE-15, RULE-16, PRD FR-021A)

---

## Code skeleton

```ts
// hooks/useOfflineQueue.ts — key constants
export const IDB_KEYS = {
REPORT_PENDING: (token: string) => `report:pending:${token}`,
AUDIO_PENDING:  (token: string) => `audio:pending:${token}`,
REFCODE:        (token: string) => `refcode:${token}`,
SYNC_FAILED:    (token: string) => `sync:failed:${token}`,
ATTEMPT_COUNT:  (token: string) => `sync:attempts:${token}`,
} as const;
```

```ts
// Sync sequence in service worker (simplified)
async function syncPendingReport(token: string) {
if (!(await isServerReachable())) { await scheduleRetry(token); return; }

const blob = await idb.get(IDB_KEYS.AUDIO_PENDING(token));
if (!blob) return;

const uploaded = await uploadAudioInChunks(blob, token); // 256kb chunks, 30s timeout, 3 retries
if (!uploaded) { await scheduleRetry(token); return; }

await idb.delete(IDB_KEYS.AUDIO_PENDING(token));

const metadata = JSON.parse(await idb.get(IDB_KEYS.REPORT_PENDING(token)));
const submitted = await postReport(metadata, token);    // expect HTTP 201
if (!submitted) { await scheduleRetry(token); return; }

await idb.delete(IDB_KEYS.REPORT_PENDING(token));
await idb.delete(IDB_KEYS.REFCODE(token));
}
```

---

## Traps

**Saving metadata to IndexedDB but not the audio blob.**
When sync fires, there is no audio to upload. The API receives a report with
no `audioFileKey`. The case worker has no audio to listen to.

**Calling `isServerReachable()` and then immediately trusting `navigator.onLine`.**
Use only the result of the HEAD request to `/api/health`. `navigator.onLine`
can be true on a local network with no internet.

**Submitting metadata before the audio upload is confirmed.**
The API stores the report with `audioFileKey: null`. The case worker cannot
listen to the recording.
(AGENTS.md RULE-11)

**Deleting IDB entries before the server returns HTTP 201.**
A network failure after the POST is sent but before the 201 arrives means the
data is gone from the device and the server does not have it either.

**Not adding new IDB keys to the panic exit handler.**
The panic exit button in `layout.tsx` clears a fixed list of IDB keys. If you
add a new feature with a new IDB key and do not register it there, pressing the
panic exit leaves data on the device.

**Forgetting to add the new route to the service worker precache.**
The route is reachable online but not cached. When the survivor loses
connectivity mid-flow, the screen fails to load.

---

## Verify before done

- [ ] New survivor route URL is in the service worker precache list
- [ ] IndexedDB keys follow the `report:pending:`, `audio:pending:`, `refcode:` prefix scheme
- [ ] Audio blob is written to IndexedDB in the submit handler before any network call
- [ ] Metadata is written to IndexedDB in the submit handler before any network call
- [ ] Sync handler uploads audio before submitting metadata — in that order
- [ ] Sync handler checks server reachability with a HEAD request before starting
- [ ] IDB entries are deleted only after the server confirms HTTP 201
- [ ] Retry uses delays of 30s, 60s, 120s with a maximum of 3 attempts
- [ ] After 3 failures: health-worker fallback message shown, queued data not deleted
- [ ] UI status indicator appears when `report:pending:{token}` exists in IDB
- [ ] Panic exit handler clears all IDB keys for the current token
- [ ] Panic exit does not clear entries for an already-submitted report
**Tests to write:**
- Simulate offline → submit form → confirm `report:pending:{token}` and `audio:pending:{token}` exist in IDB
- Simulate offline → submit → come online → confirm IDB entries are deleted after sync
- Confirm sync handler calls audio upload before metadata POST (check call order in test)
- Trigger panic exit with a pending report → confirm IDB entries are cleared; confirm previously submitted reports are unaffected
- Simulate 3 consecutive sync failures → confirm health-worker message is shown and IDB data is retained
.agents/skills/add-language.md
markdown
---
name: add-language
description: >
Load before making any language-related change to the schema, config,
or translation files.
Trigger words: new language, Language enum, add language, Yoruba, Igbo,
Hausa, Pidgin, Kanuri, Fulfulde, translation, localisation, add locale,
public/locales, public/audio, languages.ts, audio prompt, locale file.
---

## What this skill teaches

The ordered end-to-end sequence for adding a language to SafeVoice: schema
enum → migration → `languages.ts` with `enabled: false` → translation JSON
seeded from en.json → audio directory and files → parity test → three-gate
check → set `enabled: true`.

Laws governing every decision in this skill: `localisation.md`,
`database-schema.md`, `ai-pipeline.md`, AGENTS.md RULE-44 (Phase scope),
PRD Section 07 (Language support).

---

## Procedure

### 1. Verify the language is in scope for the current phase

Check the Phase scope table before writing any code:

Language
Phase
`ENGLISH`, `HAUSA`, `YORUBA`, `IGBO`, `PIDGIN`
Phase 1 MVP — permitted
`KANURI`, `FULFULDE`
Phase 2 — not permitted in MVP code


If the language is Phase 2, stop. Do not proceed.
(AGENTS.md RULE-44, localisation.md § "MVP languages")

### 2. Add the language value to the Language enum in schema.prisma

Open `prisma/schema.prisma` and locate the `Language` enum.
Add the new language value:

```prisma
enum Language {
ENGLISH
HAUSA
YORUBA
IGBO
PIDGIN        // add the new value here
// KANURI     // Phase 2 — do not uncomment in MVP
// FULFULDE   // Phase 2 — do not uncomment in MVP
}
```

(database-schema.md § "Enum values that must exist")

### 3. Run the Prisma migration

```bash
npx prisma generate
npx prisma migrate dev --name add-{language-code}-to-language-enum
```

Confirm the migration SQL file contains an `ALTER TYPE "Language" ADD VALUE`
statement. If it does not, the enum change was not detected — check that you
saved the schema file before running the command.
(prisma-model.md skill, Step 8)

### 4. Add the language to lib/languages.ts with all gates set to false

```ts
// lib/languages.ts
export const LANGUAGES = {
en:  { enabled: true,  audioReady: true,  parityTestPassed: true  },
ha:  { enabled: true,  audioReady: true,  parityTestPassed: true  },
// Add the new language with all gates false:
pcm: { enabled: false, audioReady: false, parityTestPassed: false },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;
```

Do not set any gate to `true` at this step. The language is not available to
survivors until all three gates are true.
(localisation.md § "The three-check gate", § "Language configuration file")

### 5. Seed the translation JSON from en.json

Copy every key from `public/locales/en.json` into a new file at
`public/locales/{lang-code}.json`.

```bash
cp public/locales/en.json public/locales/pcm.json
```

Do not leave any English values in the new file. Replace every value with the
correct translation. An English value in a Pidgin file is a bug, not a fallback.
(localisation.md § "Translation file format", § "What happens if a translation is incomplete")

### 6. Verify every key is translated

After filling the translations, run the key completeness check:

```bash
node scripts/check-locale-keys.js --lang pcm
```

This script compares `public/locales/pcm.json` against `public/locales/en.json`
and reports any missing keys. Fix every missing key before continuing. A single
missing key means the language cannot go live.
(localisation.md § "What happens if a translation is incomplete")

### 7. Create the audio directory and add all prompt files

```bash
mkdir public/audio/pcm
```

Copy the filenames from `public/audio/en/` and record one audio prompt per
file with a native speaker:

```bash
ls public/audio/en/
# consent-confirm-button.mp3
# report-microphone-hold.mp3
# report-age-selector.mp3
# ... etc.
```

Every file that exists in `public/audio/en/` must have a matching file in
`public/audio/{lang}/`. Missing audio files mean missing audio labels for
survivors.
(localisation.md § "Audio prompt files")

### 8. Add the Pidgin transcription quality warning if the language is Pidgin

If the language being added is `pcm` (Nigerian Pidgin), add a translation key
for the case worker inbox warning:

```json
// public/locales/en.json — add this key
{
"caseworker.report.pidginTranscriptionWarning": "This report was recorded in Nigerian Pidgin. AI transcription quality may be lower. Please also listen to the audio recording."
}
```

Add the same key (with English text — this is a case worker message, not a
survivor message) to every enabled language locale file.

Wire this warning into the report detail component for any report where
`report.language === 'PIDGIN'`.
(localisation.md § "Nigerian Pidgin — transcription limitation",
ai-pipeline.md § "Nigerian Pidgin")

### 9. Run the ai-parity-test skill

Load and execute `ai-parity-test.md` now.
The parity test must confirm that the new language achieves 100% agreement
with the English baseline on all 9 test cases.
If the test fails for any case, do not proceed to step 10. Investigate the
cause (prompt translation quality, AI model limitation, or ambiguous test case)
and retest.
(localisation.md § "The three-check gate" — gate 3,
ai-pipeline.md § "Cross-language parity test", AGENTS.md RULE-36)

### 10. Set gates to true only after all three are verified

After:
- Step 6 confirms zero missing translation keys
- Step 7 confirms all audio files are present and reviewed by a native speaker
- Step 9 confirms the parity test passes on all 9 test cases

Set the gates in `lib/languages.ts`:

```ts
pcm: { enabled: true, audioReady: true, parityTestPassed: true },
```

Do not set `enabled: true` without `audioReady: true` AND `parityTestPassed:
true` both being true in the same commit.
(localisation.md § "The three-check gate")

---

## Code skeleton

```ts
// lib/languages.ts — full file showing two enabled languages and one being added

export const LANGUAGES = {
en: {
label: 'English',
whisperCode: 'en',
enabled: true,
audioReady: true,
parityTestPassed: true,
},
ha: {
label: 'Hausa',
whisperCode: 'ha',
enabled: true,
audioReady: true,
parityTestPassed: true,
},
pcm: {
label: 'Nigerian Pidgin',
whisperCode: 'en',       // Whisper has no Pidgin model — use English
enabled: false,          // set true only after all three gates pass
audioReady: false,
parityTestPassed: false,
},
} as const;

export type LanguageCode = keyof typeof LANGUAGES;
export type EnabledLanguageCode = {
[K in LanguageCode]: typeof LANGUAGES[K]['enabled'] extends true ? K : never
}[LanguageCode];
```

```json
// public/locales/pcm.json — structure (values in Pidgin)
{
"consent.title": "...",
"consent.body": "...",
"consent.confirm": "...",
"report.microphone.hold": "...",
"report.ageBand.under15": "...",
"error.recording.too_short": "..."
// every key from en.json must be present
}
```

```bash
# scripts/check-locale-keys.js — run after translation is complete
node -e "
const en  = require('./public/locales/en.json');
const tgt = require('./public/locales/pcm.json');
const missing = Object.keys(en).filter(k => !(k in tgt));
if (missing.length) { console.error('Missing keys:', missing); process.exit(1); }
console.log('All keys present');
"
```

---

## Traps

**Setting `enabled: true` before all three gates are true.**
Survivors see the language option and select it. Missing audio labels, missing
translations, or biased risk classification — all are live problems at that
point.

**Running `prisma generate` without `prisma migrate dev` after the enum change.**
The TypeScript types update but the database does not. Any attempt to save a
record with the new language value fails at runtime with a Prisma type error.

**Not running migrate before adding the translation file.**
If a record is saved with `Language.PIDGIN` before the migration runs, the
database rejects it. The order is: migrate first, then everything else.

**Adding a key to `en.json` without adding it to every other enabled language
file.**
Any enabled language with a missing key renders a missing or English text to
a survivor who cannot read English.

**Using text-to-speech audio prompts.**
The localisation rules require native-speaker recordings. A synthesised voice
may sound unnatural or use incorrect dialect pronunciation, reducing trust.
(localisation.md § "Audio prompts — real human voices")

**Forgetting the Pidgin transcription warning on the case worker report detail.**
Case workers see a confident AI transcript and do not know it may contain
errors. The warning is required for every report where `language === PIDGIN`.

---

## Verify before done

- [ ] Language is Phase 1 scope (not Kanuri or Fulfulde)
- [ ] Language value added to `Language` enum in `schema.prisma`
- [ ] `npx prisma generate` exits with zero errors
- [ ] `npx prisma migrate dev` produces a migration file containing `ALTER TYPE` or equivalent
- [ ] `lib/languages.ts` has the new language with `enabled: false` initially
- [ ] `public/locales/{lang}.json` exists and contains every key from `en.json`
- [ ] `scripts/check-locale-keys.js` exits with zero missing keys
- [ ] `public/audio/{lang}/` directory exists with one file per entry in `public/audio/en/`
- [ ] Audio files reviewed and approved by a native speaker
- [ ] `ai-parity-test.md` skill executed — all 9 test cases pass
- [ ] For Pidgin only: case worker report detail shows transcription quality warning
- [ ] `lib/languages.ts` updated to `enabled: true, audioReady: true, parityTestPassed: true` in the same commit
**Tests to write:**
- Language selector test: confirm only languages with `enabled: true` appear in the UI
- Translation completeness test: `en.json` keys minus `{lang}.json` keys === empty set
- Whisper code test for Pidgin: confirm `classifyReport` is called with `whisperCode: 'en'` for Pidgin reports
- Prisma type test: save a record with `Language.PIDGIN` — expect success after migration, failure before
.agents/skills/ai-parity-test.md
markdown
---
name: ai-parity-test
description: >
Load before enabling any language in languages.ts, before changing the
classification system prompt, and before switching AI providers.
Trigger words: parity test, classifyReport, classification prompt, bias
review, DeepSeek, Claude, provider switch, language enable, risk parity,
ai-parity-test, cross-language test, bias audit.
---

## What this skill teaches

The ordered procedure for preparing a fixed test corpus, submitting it through
`classifyReport()` for all enabled languages, comparing outputs against the
English baseline, and logging the result to the bias review record.

Laws governing every decision in this skill: `ai-pipeline.md`
§ "Cross-language parity test", AGENTS.md RULE-36, PRD Section 11
(cross-language parity rate metric), `localisation.md` § "The three-check
gate".

---

## Procedure

### 1. Load the fixed test corpus from the repository

The test corpus is a fixed file committed to the repository at
`tests/parity/corpus.json`. Do not write new test descriptions for each test
run. Always use the same corpus so results are comparable across runs.

If the file does not exist yet, create it now following the schema in
Step 2. Commit it before running the test.

### 2. Verify the corpus covers all three risk levels

The corpus must contain a minimum of 3 descriptions per risk level:
9 descriptions total — 3 HIGH, 3 MEDIUM, 3 LOW.

Each description must:
- Be written in English first
- Match exactly one risk level using the criteria from `ai-pipeline.md`
§ "Classification criteria"
- Not mention the survivor's relationship to the perpetrator as a
risk-determining factor (test that the perpetrator-relationship rule holds)

```json
// tests/parity/corpus.json
{
"version": 1,
"descriptions": [
{
"id": "H-01",
"expectedRisk": "HIGH",
"en": "The perpetrator lives in the same section of the camp and approached the survivor again this morning."
},
{
"id": "H-02",
"expectedRisk": "HIGH",
"en": "The survivor is 14 years old. The incident happened three days ago."
},
{
"id": "H-03",
"expectedRisk": "HIGH",
"en": "The survivor says she is in immediate danger and cannot leave her shelter."
},
{
"id": "M-01",
"expectedRisk": "MEDIUM",
"en": "The incident happened four days ago. The perpetrator is known to the survivor and lives nearby."
},
{
"id": "M-02",
"expectedRisk": "MEDIUM",
"en": "Sexual violence was reported. The incident occurred six days ago. No current physical threat was mentioned."
},
{
"id": "M-03",
"expectedRisk": "MEDIUM",
"en": "The survivor knows who did this and sees them regularly in the camp. The incident was recent."
},
{
"id": "L-01",
"expectedRisk": "LOW",
"en": "The incident occurred approximately five months ago. The perpetrator has left the camp."
},
{
"id": "L-02",
"expectedRisk": "LOW",
"en": "Economic abuse was described. No physical threat. The incident was a long time ago."
},
{
"id": "L-03",
"expectedRisk": "LOW",
"en": "Emotional abuse was reported. The survivor does not know the perpetrator. The incident happened months ago."
}
]
}
```

(ai-pipeline.md § "Classification criteria")

### 3. Prepare translations of each description for every enabled language

Each description in the corpus must have a translated version for every
currently enabled language in `lib/languages.ts`.

Translations must preserve the exact incident details. Do not add, remove, or
reframe any fact during translation. The only change is the language.

For Pidgin: the translation represents what a Whisper-transcribed Pidgin
recording would look like as text — not literary Pidgin, but the kind of text
Whisper produces when transcribing spoken Pidgin.

Add the translations to the corpus file:

```json
{
"id": "H-01",
"expectedRisk": "HIGH",
"en":  "The perpetrator lives in the same section ...",
"ha":  "[Hausa translation]",
"pcm": "[Pidgin translation as Whisper would transcribe it]",
"yo":  "[Yoruba translation]",
"ig":  "[Igbo translation]"
}
```

### 4. Call classifyReport() for every description in every enabled language

Import and call `classifyReport` from `lib/ai/classify.ts`. Do not call the AI
provider API directly.

```ts
import { classifyReport } from '@/lib/ai/classify';
import { LANGUAGES } from '@/lib/languages';
import corpus from './corpus.json';

type ParityResult = {
id:           string;
expectedRisk: string;
results:      Record; // lang code → riskLevel
baseline:     string | null;                 // English output
passed:       boolean;
};

async function runParityTest(): Promise {
const enabledLangs = Object.entries(LANGUAGES)
.filter(([, cfg]) => cfg.enabled)
.map(([code]) => code);

const results: ParityResult[] = [];

for (const description of corpus.descriptions) {
const langResults: Record = {};

for (const lang of enabledLangs) {  
  const text \= description\[lang as keyof typeof description\] as string;  
  if (\!text) throw new Error(\`Missing translation for ${lang} on ${description.id}\`);

  const result \= await classifyReport(text, lang, false);  
  langResults\[lang\] \= result.riskLevel;  
}

const baseline \= langResults\['en'\];  
const passed \= Object.values(langResults).every(r \=\> r \=== baseline);

results.push({  
  id:           description.id,  
  expectedRisk: description.expectedRisk,  
  results:      langResults,  
  baseline,  
  passed,  
});  

}

return results;
}
```

(ai-pipeline.md § "Cross-language parity test", AGENTS.md RULE-36)

### 5. Set English as the baseline for every comparison

Compare every language's output against the English output for the same
description, not against the `expectedRisk` value and not against other
languages.

The English output is the baseline because the classification criteria were
defined in English. If English itself returns an unexpected value, that is a
separate calibration issue — investigate it but do not use `expectedRisk` as
the parity comparator.
(ai-pipeline.md § "Cross-language parity test")

### 6. Flag any divergence immediately

If any language returns a different risk level from English for any test case,
the test has failed for that language. Do not average results. A single
divergence is a failure.

```ts
const failedCases = results.filter(r => !r.passed);
if (failedCases.length > 0) {
console.error('PARITY TEST FAILED. Divergent cases:');
failedCases.forEach(c => console.error(c.id, c.results));
// Do NOT proceed to enable the language
}
```

(ai-pipeline.md § "Cross-language parity test", AGENTS.md RULE-36)

### 7. Build the results table

Format the results as a table for the log entry:

```ts
function buildResultsTable(results: ParityResult[], enabledLangs: string[]): string {
const header = ['ID', 'Expected', ...enabledLangs, 'Pass'].join(' | ');
const rows = results.map(r => {
const langCols = enabledLangs.map(l => r.results[l] ?? 'NULL');
return [r.id, r.expectedRisk, ...langCols, r.passed ? 'PASS' : 'FAIL'].join(' | ');
});
return [header, ...rows].join('\n');
}
```

### 8. Append the log entry to the bias review record

Write the log to `logs/bias-review.log`. Always append — never overwrite.

```ts
import { appendFileSync } from 'fs';

function logParityResult(
results: ParityResult[],
enabledLangs: string[],
trigger: string    // 'language-enable' | 'prompt-change' | 'provider-switch'
) {
const passed = results.every(r => r.passed);
const entry = `
=== PARITY TEST ${new Date().toISOString()} ===
Trigger: ${trigger}
Provider: ${process.env.AI_PROVIDER ?? 'not set'}
Languages tested: ${enabledLangs.join(', ')}
Result: ${passed ? 'PASS' : 'FAIL'}
Divergent cases: ${results.filter(r => !r.passed).map(r => r.id).join(', ') || 'none'}

${buildResultsTable(results, enabledLangs)}

`;
appendFileSync('logs/bias-review.log', entry, 'utf8');
}
```

(ai-pipeline.md § "Bias Mitigation — log with timestamp")

### 9. Report the outcome

**If all 9 test cases pass:**
Return `{ passed: true, language: langCode }` to the caller (typically the
`add-language.md` skill at Step 9).
The caller may now set `parityTestPassed: true` in `lib/languages.ts`.

**If any test case fails:**
Return `{ passed: false, failedCases: [...] }`.
Do not proceed with language enablement.
Investigate: is the translation of that description correct? Is the AI model
applying the perpetrator-relationship bias? Is the test description itself
ambiguous?
Retest after the fix. A new log entry is written for each run.

---

## Code skeleton

```ts
// tests/parity/run-parity-test.ts
import { classifyReport }     from '@/lib/ai/classify';
import { LANGUAGES }          from '@/lib/languages';
import { appendFileSync }     from 'fs';
import corpus                 from './corpus.json';

async function main() {
const trigger = process.argv[2] ?? 'manual';

const enabledLangs = (Object.entries(LANGUAGES) as [string, { enabled: boolean }][])
.filter(([, cfg]) => cfg.enabled)
.map(([code]) => code);

const results = [];

for (const desc of corpus.descriptions) {
const langResults: Record = {};

for (const lang of enabledLangs) {  
  const text \= (desc as Record)\[lang\];  
  if (\!text) throw new Error(\`Missing translation: ${lang} / ${desc.id}\`);  
  const r \= await classifyReport(text, lang, false);  
  langResults\[lang\] \= r.riskLevel;  
}

const baseline \= langResults\['en'\];  
const passed   \= Object.values(langResults).every(v \=\> v \=== baseline);  
results.push({ id: desc.id, expectedRisk: desc.expectedRisk, results: langResults, baseline, passed });  

}

// Build log entry
const allPassed = results.every(r => r.passed);
const header    = ['ID', 'Expected', ...enabledLangs, 'Pass'].join('\t');
const rows      = results.map(r =>
[r.id, r.expectedRisk, ...enabledLangs.map(l => r.results[l] ?? 'NULL'), r.passed ? 'PASS' : 'FAIL'].join('\t')
);

const logEntry = [
`=== PARITY TEST ${new Date().toISOString()} ===`,
`Trigger: ${trigger}`,
`Provider: ${process.env.AI_PROVIDER ?? 'not set'}`,
`Result: ${allPassed ? 'PASS — all ${results.length} cases match English baseline' : 'FAIL'}`,
'',
header,
...rows,
'',
].join('\n');

appendFileSync('logs/bias-review.log', logEntry, 'utf8');

if (!allPassed) {
console.error('Parity test FAILED. See logs/bias-review.log.');
process.exit(1);
}

console.log('Parity test PASSED.');
}

main().catch(e => { console.error(e); process.exit(1); });
```

```bash
# Run from the repo root:
npx tsx tests/parity/run-parity-test.ts language-enable
npx tsx tests/parity/run-parity-test.ts prompt-change
npx tsx tests/parity/run-parity-test.ts provider-switch
```

---

## Traps

**Comparing languages against each other instead of against English.**
If Hausa and Yoruba both return MEDIUM for a MEDIUM case, they agree — but
both might be wrong compared to English. Always set English as the single
baseline.

**Using a different test corpus for each run.**
If the descriptions change between runs, the results are not comparable. The
corpus is committed to version control and never changed during a test run.

**Varying the description content between language translations.**
If the Hausa translation adds detail the English version does not contain, the
AI may classify differently. The only variable between languages is the
language itself.

**Logging `PASS` when 8 of 9 cases match.**
The threshold is 100% agreement on all 9 cases. Partial agreement is a
failure. One divergent case in a HIGH risk scenario could mean a life-threatening
case is classified as MEDIUM for speakers of that language.
(AGENTS.md RULE-36)

**Overwriting the bias review log instead of appending.**
The log is a permanent audit record. Every run must be appended. Overwriting
destroys the evidence of previous tests and their results.

**Running the test before all translations in the corpus are complete.**
If `corpus.json` is missing the translation for a language, the test throws.
Fill all translations for all enabled languages before running.

**Calling the AI provider API directly instead of through `classifyReport()`.**
The test must use the same code path that production uses. Calling the provider
directly bypasses the timeout logic, the response parsing, and the
`unclassified` fallback — giving results that do not reflect real behaviour.

---

## Verify before done

- [ ] `tests/parity/corpus.json` is committed to the repository and unchanged since the last run
- [ ] Corpus has exactly 3 HIGH, 3 MEDIUM, and 3 LOW descriptions (minimum 9 total)
- [ ] Every enabled language in `lib/languages.ts` has a translation for every corpus entry
- [ ] `classifyReport()` from `lib/ai/classify.ts` is used — not a direct API call
- [ ] English output is used as the baseline for all comparisons
- [ ] Every one of the 9 test cases returns the same risk level as the English baseline
- [ ] `logs/bias-review.log` contains a new appended entry with: timestamp, trigger, provider, result, and the full results table
- [ ] The script exits with code 0 on pass, code 1 on failure
- [ ] If triggered by `add-language.md`: `parityTestPassed: true` is set in `lib/languages.ts` only after this script exits with code 0

**Tests to write:**
- Unit test `classifyReport` mock: confirm the parity script calls `classifyReport` once per language per corpus entry
- Log append test: run the script twice → confirm `bias-review.log` contains two `===` entries, not one (append, not overwrite)
- Failure exit test: mock one language to return a different risk level → confirm the script exits with code 1
- Corpus completeness test: missing a translation in corpus.json → confirm the scrip throws before calling any AI API
