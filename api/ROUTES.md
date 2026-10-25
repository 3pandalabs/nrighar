# nrighar-api routes

Base URL: `NEXT_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL` (e.g. `https://api.nrighar.3pandalabs.com`, `http://localhost:8080` in dev).

Auth: `Authorization: Bearer <accessToken>` header. Access tokens expire in 15 minutes — callers must catch 401s and call `POST /auth/refresh`, then retry once.

All error responses: `{ "error": "<code>" }` with a matching HTTP status. A resource that exists but isn't yours (or a share that isn't claimed) returns **404**, never 403 — don't rely on 403 to distinguish "forbidden" from "doesn't exist".

## Auth

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/auth/signup` | none | `{ email, password, role: 'owner'\|'tenant' }` | `201 { accessToken, refreshToken, user: { id, email, role } }` |
| POST | `/auth/login` | none | `{ email, password }` | `200 { accessToken, refreshToken, user }` or `401 { error: 'invalid_credentials' }` |
| POST | `/auth/refresh` | none | `{ refreshToken }` | `200 { accessToken, refreshToken }` (rotated — old refreshToken is now invalid) |
| POST | `/auth/logout` | none | `{ refreshToken }` | `204` |
| GET | `/auth/me` | required | — | `200 { id, email, role }` |
| POST | `/auth/forgot-password` | none | `{ email }` | `204` **always** — same response whether or not the address has an account, and whether or not the mailer is configured. Deliberate: anything else is an account-enumeration oracle. Mails a single-use link to `${WEB_ORIGIN}/reset-password?token=…`, valid 60 minutes, and invalidates any previously-issued token for that user. |
| POST | `/auth/reset-password` | none | `{ token, password }` (min 8) | `204`, or `400 { error: 'invalid_or_expired_token' }`. Burns the token (single-use) and deletes **every** session for that user, so all other devices are signed out. |

`role` on signup defaults to `'owner'` if omitted. Tenant signup also creates an empty `tenant_profiles` row — call `PATCH /tenant-profile` right after to fill it in (mirrors the old app's post-signup profile completion step).

## Profile (self, owner or tenant)

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/profile` | required | — |
| PATCH | `/profile` | required | any of `{ displayName, countryOfResidence, preferredCurrency, upiVpa, upiName }` |

## Properties / Tenants / Leases / Rent payments / Documents (owner-scoped)

Standard REST, all `requireAuth`, all implicitly scoped to the caller as owner. A property/tenant/lease/document belonging to another owner 404s.

- `GET|POST /properties`, `GET|PATCH|DELETE /properties/:id`
  body: `{ nickname, addressLine1, addressLine2?, city, state, pincode, propertyType?: 'apartment'|'independent_house'|'villa'|'plot'|'commercial', bedrooms? (BHK count), notes? }`
- `GET|POST /tenants`, `GET|PATCH|DELETE /tenants/:id`
  body: `{ fullName, phone?, email?, kycStatus?: 'pending'|'submitted'|'verified', notes? }`
- `GET|POST /leases`, `GET|PATCH|DELETE /leases/:id`
  body: `{ propertyId, tenantId, rentAmount, depositAmount?, startDate, endDate?, rentDueDay?, status?: 'active'|'ended' }`. `propertyId`/`tenantId` must belong to the caller (404 otherwise). Only one `active` lease per property — a second active lease on the same property returns `409 { error: 'conflict' }`.
- `GET /rent-payments`, `PUT /rent-payments` (upsert by `leaseId`+`periodYear`+`periodMonth`), `DELETE /rent-payments/:id`
  body: `{ leaseId, periodYear, periodMonth, amountDue, amountPaid?, paidOn?, method?, status?, notes? }`
- `GET|POST /documents`, `DELETE /documents/:id`
  body: `{ propertyId?, leaseId?, docType?, title, storagePath }` — `storagePath` must be a key you already have upload rights to (see Storage below).
- `GET|POST /properties/:id/photos`, `DELETE /properties/:id/photos/:photoId`
  body: `{ storagePath, caption? }`. Max 20 photos per property (`409 { error: 'conflict' }` beyond that). `storagePath` must sit under the caller's own `<userId>/` R2 prefix — re-checked server-side, not trusted. GET returns each row plus a freshly presigned `url`. DELETE removes the R2 object as well as the row (unlike `/documents/:id`, which orphans the object).
- `GET /documents/:id/kyc-verification` — latest automated KYC extraction/verification result for a `docType: 'kyc'` document (`null` until the async check finishes). See KYC verification below.

## Tenant self (role must be `tenant`)

| Method | Path | Body |
|---|---|---|
| GET/PATCH | `/tenant-profile` | `{ fullName?, phone?, email?, currentCity?, employer? }` — `kycStatus` is **not** settable here; see KYC verification below |
| GET/POST | `/tenant-documents` | `{ docType?, title, storagePath }` |
| DELETE | `/tenant-documents/:id` | — |
| GET | `/tenant-documents/:id/kyc-verification` | latest automated KYC result, `null` until it finishes |

## Cross-owner shared reads (requires a claimed `profile_shares`)

| Method | Path |
|---|---|
| GET | `/tenant-profiles/by-owner/:tenantUserId` |
| GET | `/tenant-documents/by-owner/:tenantUserId` |

404 if no claimed share exists between the caller (as owner) and that tenant — including right after a revoke.

## Pay links (UPI "I've paid" flow)

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/pay-links` | owner | — list all your pay links; optional `?leaseId=` filter |
| POST | `/leases/:leaseId/pay-links` | owner | `{ periodYear, periodMonth, amountDue }` — upserts by period |
| GET | `/pay-links/:token` | **none** | — returns `{ amountDue, periodYear, periodMonth, propertyNickname, propertyCity, tenantName, ownerUpiVpa, ownerUpiName, claimedPaidAt }` |
| POST | `/pay-links/:token/open` | **none** | — idempotent, `204` |
| POST | `/pay-links/:token/claim-paid` | **none** | — idempotent, `204` |

`:token` is the pay-link's `id` (unguessable UUID) — this is the entire trust model, same as the old Supabase RPCs.

## Intake links (owner invites a tenant to self-register)

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/intake-links` | owner | — list all your intake links |
| POST | `/intake-links` | owner | `{ propertyId? }` — expires in 14 days |
| GET | `/intake-links/:token` | **none** | `{ status, expired, ownerName, propertyNickname, propertyCity }` |
| POST | `/intake-links/:token/accept` | tenant | — consumes the link, creates a claimed share to the inviting owner |
| DELETE | `/intake-links/:id` | owner | — id, not token-in-URL sense (same field); 204 |
| POST | `/tenant-intake/:token` | **none**, `multipart/form-data` | fields `token`, `full_name`, `phone?`, `email?`, up to 6 `files` (jpg/jpeg/png/webp/pdf/xml/zip, ≤10MB each) — for a tenant who does **not** want to create an account; writes directly into the owner's document set |

## Profile shares (tenant-controlled sharing)

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/profile-shares` | tenant | — list all shares you've created (open/claimed/revoked) |
| POST | `/profile-shares` | tenant | — mints a reusable `'open'` share, id is the token |
| GET | `/profile-shares/:token/preview` | required | `{ status, fullName, currentCity, kycStatus }` — no documents |
| POST | `/profile-shares/:token/claim` | owner | — binds the share to the caller, backfills/creates the owner's `tenants` record via the same dedup logic as intake-accept |
| POST | `/profile-shares/:id/revoke` | tenant (must own the share) | — cuts the owner's read access on the next request |

## Property listings & applications (marketplace)

An owner opens a **listing** on one of their properties to invite competing tenant applications; any `tenant`-role user can browse open listings and submit an offer. This is separate from the existing 1:1 intake-link/profile-share tenant flow — a property can have at most one `open` listing at a time (a second `POST /listings` on the same property returns `409 { error: 'conflict' }`).

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET/POST | `/listings` | owner | `{ propertyId, baseRentAsk, minLeaseMonths? }` | list/open your own listings |
| PATCH | `/listings/:id` | owner | — | closes the listing (`status: 'closed'`) |
| GET | `/listings/browse` | tenant | — | public-safe fields: `{ id, title, city, state, pincode, propertyType, bedrooms, baseRentAsk, minLeaseMonths, createdAt, coverPhotoUrl, photoCount }` — no address line/owner details, and no `propertyId` or raw storage key (the key starts with the owner's user id). `coverPhotoUrl` is a presigned R2 URL for the property's first photo (`null` if it has none), minted per request and valid ~10 minutes — render it, never cache or store it. Optional query filters, all AND'd together: `?state=`/`?city=` (case-insensitive exact match), `?pincode=` (exact match), `?bedrooms=` (exact match), `?minRent=`/`?maxRent=` (bound `baseRentAsk`), `?minLeaseMonths=` (matches listings whose own minimum is `<=` this, or unset) |
| POST | `/listings/:id/applications` | tenant | `{ proposedRent, moveInDate, monthlyIncome?, profileHighlights? }` | `submit_property_application` — `rentVariancePct` is always computed server-side from the listing's `baseRentAsk`, never trusted from the client. One active (`under_review`/`kyc_requested`) application per applicant per listing — re-applying after rejection/withdrawal is fine, stacking offers isn't (`409`). |
| GET | `/listings/:id/photos` | tenant | — | full gallery for one listing: `[{ id, caption, sortOrder, createdAt, url }]`. Served **only while the listing is `open`** — closing it makes the photos unreachable. This is the one path where a caller reads an R2 key outside their own prefix, so the open-listing check here is the entire authz boundary; `/storage/presign-download` would (correctly) reject these keys. |
| GET | `/applications` | tenant | — | your own applications across every listing, for status tracking |
| GET | `/listings/:id/applications` | owner | — | `get_property_applications` — side-by-side comparison ordered by `proposedRent` desc, plus `marketSignals: { offerVolume, highestProposedRent, averageProposedRent, earliestMoveInDate }`. Each applicant row includes `rentVariancePct`, `incomeToRentRatio` (null if `monthlyIncome` wasn't given), `creditScoreRange` (always `null` — no credit-bureau integration exists), and display fields from `tenant_profiles` (`applicantFullName`, `applicantCurrentCity`, `applicantEmployer`, `applicantKycStatus`). |
| POST | `/applications/:id/request-kyc` | owner | — | `trigger_tenant_kyc_flow` — moves the application to `kyc_requested` and mints an `intake_links` row (same table the owner-invite flow uses), returned as `intakeLink`. **No SMS/email is actually sent** — no notification provider is wired up in this codebase; the caller is expected to build `/join/<intakeLink.id>` and show/copy it, same as the existing "invite a tenant" UI does. Other applicants on the listing are untouched (`under_review`). |
| PATCH | `/applications/:id` | owner | `{ status: 'approved'\|'rejected' }` | final decision — does **not** auto-create a lease; use `POST /leases` afterward |
| GET/POST | `/applications/:id/messages` | owner or applicant | `{ body }` (post only) | async message thread on one application — not real-time, messages appear on next fetch. Either participant (the listing's owner or the application's `applicantUserId`) can read/post; anyone else 404s. Row shape: `{ id, applicationId, senderUserId, senderRole: 'owner'\|'tenant', body, createdAt }` |

**Fair Housing note**: nothing in this schema captures protected-class data (race, gender, religion, familial status) — the comparison view's ordering and every derived signal (`rentVariancePct`, `incomeToRentRatio`, move-in alignment, KYC status) is strictly financial/timeline/verification. `applicantFullName`/`applicantCurrentCity`/`applicantEmployer` are display-only and never feed sorting or filtering.

## KYC verification (automated, async)

Any `docType: 'kyc'` document created via `POST /documents`, `POST /tenant-documents`, or `POST /tenant-intake/:token` triggers a Temporal child workflow (`kycVerificationWorkflow`) that reads the file, extracts PAN/Aadhaar/passport fields with a vision-capable Claude model, and writes one `kyc_verifications` row. It runs *after* the create request already returned, so poll the `kyc-verification` GET route rather than expecting a result inline.

`kyc_verifications.status`: `manual_review` (needs a human look — quality issue, missing field, or no official-provider check configured yet), `rejected` (not a recognizable PAN/Aadhaar/passport), `verified` (extraction clean AND an official provider check passed — currently unreachable, see below), `failed` (extraction itself errored, e.g. `ANTHROPIC_API_KEY` unset on the worker).

Aadhaar numbers are masked to `XXXX-XXXX-<last 4 digits>` before the row is ever written — the full 12-digit number never reaches this table or any API response.

`verified` only ever gets set automatically by this pipeline, never by a tenant PATCHing their own `kycStatus` — that field was removed from `PATCH /tenant-profile`'s accepted body for this reason. Owners can still manually set a tenant's `kycStatus` via `PATCH /tenants/:id`.

Official government/aggregator verification (NSDL/Protean for PAN, a licensed AUA/KUA or aggregator for Aadhaar, Passport Seva for passports) is stubbed out (`src/lib/kyc/officialVerify.ts`, all return `not_configured`) pending real provider credentials — until then, every successfully-extracted document lands in `manual_review`, not `verified`.

## Identity KYC (PAN / Aadhaar OTP, aggregator-backed)

Distinct from the document pipeline above. That one reads an uploaded *scan* with a vision model and calls nothing external. This one verifies a *number the person types* against a government source through a licensed aggregator, and every call costs money — which is what shapes the whole design.

**Provider**: set `IDENTITY_KYC_PROVIDER` (`surepass` | `none`, default `none`). Swappable by env var; the adapter is the only provider-aware file (`src/lib/identity/surepass.ts`). With nothing configured, checks return a `not_configured` row — **nothing in this codebase can produce a `verified` result without a real provider answering**, the same stance as `officialVerify.ts`.

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/identity/pan` | tenant | `{ panNumber }` | verifies your own PAN; 6/hr per caller |
| POST | `/identity/aadhaar/otp` | tenant | `{ aadhaarNumber }` | triggers the UIDAI OTP; 4/hr per caller + a 60/hr global ceiling. Returns `{ sessionId, numberMasked, expiresAt, reused, alreadyVerified }` |
| POST | `/identity/aadhaar/verify` | tenant | `{ sessionId, otp }` | exchanges the OTP; 10/hr per caller, **3 attempts per session** |
| GET | `/identity/verifications` | tenant | — | your own checks, newest first |
| POST | `/tenants/:id/identity/pan` | owner | `{ panNumber }` | verify a tenant record you hold |
| GET | `/tenants/:id/identity-verifications` | owner | — | checks on that tenant record, **plus** checks the linked tenant-user ran on themselves — the latter only while they hold a claimed profile share with you, gated by the same `hasClaimedShare` predicate as every other cross-owner read. A revoke cuts this on the next request, like it cuts the rest. |

There is **no owner-initiated Aadhaar route**, deliberately: the OTP goes to the tenant's own phone, so a landlord-driven flow would either not work or would mean the landlord handling someone else's OTP. The tenant runs it themselves and a linked landlord sees the result.

`identity_verifications.status`: `verified` · `name_mismatch` (the number is real, the registered name doesn't match our record) · `not_found` (well-formed but no such record upstream) · `failed` (provider error) · `not_configured`.

**Name matching** compares the government-registered name against *our own* record — `tenants.full_name` for an owner-initiated check, or the linked landlord's record for a tenant self-check, falling back to `tenant_profiles.full_name` only when no landlord record exists (matching a self-entered name against a self-entered number would verify nothing). Scoring is order-insensitive and tolerant of initials and of a middle name present on one side only ("Rajesh Sharma" vs "Rajesh Kumar Sharma" scores 0.9 and passes; "Sharma" vs "Rajesh Kumar Sharma" scores 0.8 and doesn't). Threshold 0.85; below it the row is `name_mismatch` for a human to decide — never auto-rejected and never auto-verified.

**Numbers are never stored.** Each row keeps `number_masked` (`ABCDE****F` / `XXXX-XXXX-1234`) and `number_fingerprint`, an HMAC-SHA256 under a server-held key. HMAC rather than a plain hash because both keyspaces are small enough (10^12 Aadhaar, ~10^9 PAN) that an unkeyed digest is reversible on a laptop. Nor do raw numbers enter a **workflow argument** — Temporal persists those in event history — so routes AES-256-GCM seal them first and only the activity, running in the worker, can open them (`src/lib/providers/sealed.ts`).

**Cost controls**, cheapest gate first:

1. **Format + checksum, free.** PAN shape *and* holder-type character; Aadhaar via the Verhoeff checksum UIDAI actually uses, which catches every single-digit typo and adjacent transposition. Exported for the clients to run on input too, but the server repeats it — a client-side guard is UX, not a spending control.
2. **Result cache.** A `verified` row for the same number *and the same subject* inside its window is returned instead of re-billing (`PAN_CACHE_DAYS`, default 180; `AADHAAR_CACHE_DAYS`, default 30). Subject-scoped on purpose: the cache saves money, it does not transfer trust between records.
3. **Live-OTP reuse.** A repeat "send OTP" within `AADHAAR_OTP_TTL_SECONDS` returns the existing session (`reused: true`) rather than buying another SMS. This absorbs the "I didn't get the code, press it again" habit, which is otherwise the most expensive user behaviour in the flow.
4. **Per-subject cooldown**, `IDENTITY_COOLDOWN_SECONDS` (60), counted in Postgres so it holds across the API *and* the Temporal worker.
5. **Monthly cap**, `IDENTITY_KYC_MONTHLY_CAP` (500 billable calls, shared across all three identity operations — one Aadhaar verification is an OTP call plus a submit call, and counting those separately would cap nothing an operator can reason about). Exhausted → `429 { error: 'provider_quota_exceeded' }`.
6. **Billable activities run with `maximumAttempts: 1`.** Temporal's retry can't tell a free failure from a paid one; retry policy lives in `providerFetch`, which can (a connection error never reached them, a timeout may have been billed).

Every billable call in the app goes through `guardedCall` (`src/lib/providers/costGuard.ts`) and is written to `provider_calls` whether it succeeded or not — a ledger that only records successes cannot bound spend. Postgres, not Redis: this stack has no Redis, and a counter shared between the API and worker processes needs to be out-of-process anyway.

New error codes: `invalid_pan`/`invalid_aadhaar` (400), `otp_verification_failed` (400), `otp_session_unusable` (409 — covers wrong owner, expired, consumed, and attempts-exhausted with one response), `provider_cooldown`/`provider_quota_exceeded` (429), `identity_not_configured`/`provider_unavailable` (503).

## e-Sign lease agreements

**Provider**: `ESIGN_PROVIDER` (`leegality` | `none`). Aadhaar OTP e-Sign under IT Act s.3A, sequential signers — landlord first, then the tenant.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/leases/:id/agreement` | owner | renders the PDF, stores it in R2, creates a `draft`. **Free** — nothing external is called |
| GET | `/leases/:id/agreement` | owner | `{ agreement, signers, downloadUrl }` — presigned, 10 min, signed copy if there is one |
| POST | `/lease-agreements/:id/send` | owner | creates the **paid** e-Sign transaction and invites the landlord |
| GET | `/lease-agreements/:id/sign-url/:role` | owner or the linked tenant-user | mints a fresh signing link (provider links expire); 404 if you aren't that signer |
| POST | `/webhooks/esign` | **none** — HMAC | provider callback; `202` |

Generation is split from sending on purpose: the landlord reads the draft before anything is billed, and a deployment with no e-Sign vendor still gets a usable document to print and sign on paper.

At most one live agreement per lease (`draft`/`sent`/`partially_signed`), enforced by a partial unique index. Status: `draft` → `sent` → `partially_signed` → `completed`, or `declined`/`expired`/`failed`. `completed` is set by `storeSignedDocument`, **not** by the callback — an agreement isn't complete until the signed PDF is actually in our bucket, and marking it complete on a callback alone would leave a "completed" agreement with no document behind it.

`lease_agreements.terms` freezes the lease/property/party values the PDF was rendered from; the lease row stays editable, but a signed agreement must keep saying what was signed. `content_hash` is the SHA-256 of the unsigned bytes, which is what makes "tamper-proof" checkable rather than decorative.

Both PDFs live in the existing private `nrighar-documents` bucket under the owner's own `<userId>/agreements/<leaseId>/` prefix, so every existing storage authz rule applies unchanged. On completion the signed copy is also inserted into `documents` as `docType: 'agreement'`, so it surfaces where owners already look.

**Webhook security.** Signature verification is the *only* authentication on `/webhooks/esign`, and its effect is to mark a lease as legally signed — so the route installs its own buffer-mode JSON parser (in its own encapsulated Fastify scope) and HMACs the **raw bytes**; re-serializing a parsed object would not reproduce the provider's exact bytes. A missing `LEEGALITY_WEBHOOK_SECRET` **fails every delivery closed**. That is a real operational hazard — signatures complete and RentVault never hears — and still correct: the alternative is an endpoint anyone can POST a "completed" event to. Deliveries are deduped on `esign_webhook_events (provider, event_id)` via insert-then-check (not select-then-insert, which races), and handled in a detached workflow so the provider gets its `202` immediately.

**Two separate budgets, not one.** `ESIGN_MONTHLY_CAP` (200) counts only `esign.create` — i.e. new agreements sent for signature, which is what an operator would assume the number means. Re-issuing a signing link (`esign.refresh_url`, triggered every time a signer reopens the page) and downloading the signed PDF (`esign.download`, bounded 1:1 by create) draw on a separate, generous `ESIGN_LINK_MONTHLY_CAP` (2000). Sharing one budget was the original design and was wrong in a way that only shows up in use: two signers reopening a link a few times each turned a 200-call cap into ~25 agreements, and let a signer clicking around exhaust the budget that stops us minting new paid documents. Budgets are assigned per operation in `lib/providers/costGuard.ts`, and the operation name is a union type — a new paid call nobody added to that map fails to compile rather than running uncapped.

**Stamp duty is not handled.** The generator produces the instrument; it does not e-stamp it. Duty is a state matter and an unstamped agreement is admissible only on paying the duty plus a penalty, so the PDF carries an explicit note saying so rather than implying otherwise. Providers sell e-stamping as a separate paid item — wiring it in is a per-state commercial decision.

> **The signature-request and completion emails do not send in production** — see the Email section below. The provider mails the invitee itself, so signing still works; our own nudge doesn't arrive.

## Utility bills (BBPS)

**Provider**: `BBPS_PROVIDER` (`setu` | `none`). Read-only — this tracks bills, it does not pay them.

| Method | Path | Auth | Body |
|---|---|---|---|
| GET/POST | `/utility-accounts` | owner | `{ propertyId, category, billerId, billerName?, consumerNumber, nickname? }`; `?propertyId=` filter on GET |
| PATCH/DELETE | `/utility-accounts/:id` | owner | any of the above plus `{ active }` |
| GET | `/utility-bills` | owner | — `?accountId=` filter |
| POST | `/utility-accounts/:id/fetch` | owner | manual "check now"; 10/hr per caller, and subject to the same cooldown and cap as the cron |

`category`: `electricity` · `water` · `gas` · `broadband` · `dth` · `mobile` · `maintenance` · `other`. Consumer numbers are masked (`****1234`) in every response and email.

**Polling costs two provider calls per account per month**, and the cron frequency is decoupled from that:

- **`nrighar-utility-bill-cycle`** — 1st of the month, 04:30 UTC. Every active account, one call each. This discovers the month's bill.
- **`nrighar-utility-bill-due-check`** — daily 05:00 UTC, but gated on each account's `next_fetch_after`, which the cycle fetch set to *that bill's* due date. So it selects nothing and spends nothing on the ~28 days when no account is due, and buys exactly one confirmation on the day one is. Better than a fixed twice-monthly cron, which would confirm on the wrong day for every biller whose due date isn't the 15th and cost the same two calls.
- **`nrighar-utility-bill-alerts`** — daily 06:00 UTC. **Zero provider calls**: it reads the status the last fetch recorded and mails the landlord about anything `UNPAID` past its due date, backing off 3 days between alerts and capping at 4 per bill. Separate schedule from the fetches on purpose — the thing that costs money and the thing that costs nothing shouldn't share a failure mode.

Bills upsert on `(account_id, bill_period_key)` — the biller's bill number, else the billing month — so the due-date confirmation updates the row (typically `UNPAID` → `PAID`) instead of creating a duplicate. An account that fails 3 times in a row stops being polled and waits for a human; editing its `billerId`/`consumerNumber` clears the counter. A failed fetch still pushes `next_fetch_after` out, so a wrong consumer number can't be re-charged every sweep.

Status is `PAID` / `UNPAID` / `UNKNOWN`, and **`UNKNOWN` is never alerted on**. Telling an NRI landlord their tenant hasn't paid when we don't actually know costs them a phone call to India and some trust; being quiet when unsure is the cheaper mistake.

> **Overdue alert emails do not send in production** — see the Email section below. This is the whole point of the feature, so it is the highest-value thing to fix in that gap.

Note: schedules are created idempotently at worker boot and **editing a cron expression here does not update an already-created schedule** — delete it (`temporal schedule delete --schedule-id <id>`) and let the next boot recreate it. Same caveat as the session-purge schedule.

## Storage (Cloudflare R2)

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/storage/presign-upload` | required | `{ key }` — `key` must start with `${yourUserId}/`; returns `{ url }`, a presigned PUT, 5 min TTL |
| POST | `/storage/presign-download` | required | `{ key }` — allowed if it's your own key, or a tenant's key you hold a claimed share for; returns `{ url }`, a presigned GET, 10 min TTL |

Upload flow: `POST /storage/presign-upload` → browser `PUT`s the file directly to the returned URL → `POST /documents` (or `/tenant-documents`) with `storagePath: key` to record the metadata row. This mirrors the old two-step Supabase Storage upload pattern.

Delete flow: `DELETE /documents/:id` and `DELETE /tenant-documents/:id` now also best-effort delete the underlying R2 object (if that fails, the metadata row is still removed and a warning is logged — matches the old app's two-step, non-atomic storage-then-metadata delete).

Property photos use the same two-step upload, under `<userId>/properties/<propertyId>/<uuid>-<filename>` so an object's purpose is readable from the key alone. Reads are the exception to the prefix rule above: a tenant browsing the marketplace has neither their own prefix nor a claimed share, so `/listings/browse` and `/listings/:id/photos` presign those keys themselves after checking the listing is open. `/storage/presign-download` still refuses them, deliberately — those two routes are the only way in.

## Contact

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/contact` | **none** | `{ name, email, message }` (≤120 / ≤320 / ≤4000 chars) | `204`, `429 { error: 'rate_limited' }`, or `503 { error: 'mailer_unavailable' }` |

Relays a Contact-page message to `SUPPORT_EMAIL` through the shared org mailer gateway. Nothing is persisted — the mail is the record, and a table of unauthenticated free text would be one more store to secure and purge for no gain.

Unlike `/auth/forgot-password`, an unconfigured/unreachable mailer here is **not** swallowed: the message would simply vanish, and telling the sender "sent" when nobody will ever read it is the worse failure.

**Rate limited, two layers** (`src/plugins/rateLimit.ts`), both in-process and therefore per-container — they'd need a shared store if `nrighar-api` is ever scaled past one replica:

- **5 per hour per caller.** The caller is identified by the `X-Client-IP` header, falling back to `req.ip`. The web frontend must send that header, because it calls this route from a Server Action over `INTERNAL_API_URL` — a DNS-only hostname that never traverses Cloudflare's proxy, so there is no `CF-Connecting-IP` and `req.ip` is the Worker's egress address, identical for every visitor. Without the header the whole site shares one budget. The header is a hint for separating honest traffic, **not** a trusted identity: the origin firewall admits all Cloudflare IP ranges, so anyone with a Worker can reach `api-internal` and rotate the value per request.
- **40 per hour globally**, counted across every caller and key. This is the layer that actually bounds the damage, since layer 1 is spoofable. Rejections don't consume from this budget, so a caller who is over their own limit can't drain the shared one.

Accepted trade-off: a determined sender can burn the global budget and make the contact form unavailable to real users until the window rolls over. For a route whose failure mode is flooding the single support inbox, capping the flood beats keeping the form up.

Still no CAPTCHA — Turnstile is the obvious next step if this ever attracts targeted abuse rather than incidental spam.

## Email (shared org gateway)

> **KNOWN GAP, DEFERRED 2026-07-29 — no RentVault email actually sends in production.**
> The gateway's only verified Resend sending domain is `rsvpvault.3pandalabs.com`
> (the free plan verifies exactly one), and `nrighar` has no address on it, so
> every send returns `no_sender_configured` (503). Password-reset mail and the
> Contact relay are therefore dead in production today — the code paths are
> correct and tested, they just have nowhere to send from.
>
> `/auth/forgot-password` still answers `204` regardless, by design: it must not
> reveal whether an address has an account, and it deliberately degrades rather
> than failing when the mailer is unavailable. So this gap is **silent** from
> the outside — the endpoint looks healthy and no mail arrives.
>
> Fixing it is a domain decision, not a config tweak. Either give `nrighar` an
> address on `rsvpvault.3pandalabs.com` (accepting that RentVault password
> resets would arrive from a domain named after a different product — the exact
> signature of a phishing attempt), or verify a neutral domain and cut both apps
> over. On the free plan adding a domain **evicts** the current one, so that
> cutover has an outage window if sequenced wrong: verify first, switch second.

All outbound mail goes through the `3pandalabs/mailer` Cloudflare Worker (`POST ${MAILER_URL}/send`, bearer `MAILER_TOKEN`, `app: "nrighar"`), never to a provider directly — so no Cloudflare API token exists anywhere in this app's environment. Templates live in `src/lib/emails/`; the gateway is a dumb transport that renders nothing.

`MAILER_URL`/`MAILER_TOKEN` are deliberately **not** required at boot, same as `METRICS_TOKEN`: this app ran without any email at all until password reset landed, and a missing mailer secret must degrade rather than refuse to start and take rent collection down with it.

Both are needed by the **Temporal worker** container, not just the API — the sends happen inside activities, which execute there.
