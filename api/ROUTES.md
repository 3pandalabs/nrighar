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
| POST | `/contact` | **none** | `{ name, email, message }` (≤120 / ≤320 / ≤4000 chars) | `204`, or `503 { error: 'mailer_unavailable' }` |

Relays a Contact-page message to `SUPPORT_EMAIL` through the shared org mailer gateway. Nothing is persisted — the mail is the record, and a table of unauthenticated free text would be one more store to secure and purge for no gain.

Unlike `/auth/forgot-password`, an unconfigured/unreachable mailer here is **not** swallowed: the message would simply vanish, and telling the sender "sent" when nobody will ever read it is the worse failure.

**No rate limit or CAPTCHA yet** — this is a spam relay into the support inbox for anyone who finds it. It only ever mails the fixed `SUPPORT_EMAIL` (never a caller-supplied address), so the blast radius is one inbox, but a limiter belongs here before the page gets real traffic.

## Email (shared org gateway)

All outbound mail goes through the `3pandalabs/mailer` Cloudflare Worker (`POST ${MAILER_URL}/send`, bearer `MAILER_TOKEN`, `app: "nrighar"`), never to a provider directly — so no Cloudflare API token exists anywhere in this app's environment. Templates live in `src/lib/emails/`; the gateway is a dumb transport that renders nothing.

`MAILER_URL`/`MAILER_TOKEN` are deliberately **not** required at boot, same as `METRICS_TOKEN`: this app ran without any email at all until password reset landed, and a missing mailer secret must degrade rather than refuse to start and take rent collection down with it.

Both are needed by the **Temporal worker** container, not just the API — the sends happen inside activities, which execute there.
