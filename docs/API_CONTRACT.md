# API Contract

Version

v1

Base URL

/api/v1

---

# Authentication

POST /auth/login

Returns

- access token
- refresh token
- user profile

---

GET /auth/profile

Returns authenticated user.

---

# Events

GET /events

List published events.

---

GET /events/:id

Single event.

---

POST /events

Create event.

Admin only.

---

PATCH /events/:id

Update event.

---

DELETE /events/:id

Delete event.

---

# Registration

POST /events/:id/register

Public endpoint.

Flow

- Find existing Person
- Create Person if necessary
- Create Registration
- Assign Team
- Generate QR
- Return confirmation

---

GET /registrations

Admin only.

---

GET /registrations/:id

Admin only.

---

# Attendance

POST /attendance/checkin

Input

QR Token

Returns

Attendee

Team

Attendance status

---

# Teams

GET /events/:id/teams

POST /teams/assign

PATCH /teams/:id

---

# Games

POST /games

PATCH /games/:id

GET /games/:id

---

# Scores

POST /scores

Record score for a team in a game. Returns 409 Conflict if a score already exists for the team in that game (use PATCH to update).

PATCH /scores/:id

Update points, notes, or game/team assignment of an existing score record.

DELETE /scores/game/:gameId

Clear all score records associated with a specific game.

GET /leaderboard/:eventId

Returns teams sorted by total points.

---

# People

GET /people

Admin only. Lists all people records enriched with registration history, attendance history, `eventsRegisteredCount`, and `eventsAttendedCount`. (Phase 2 will add department memberships).

GET /people/:id

Admin only. Retrieves single person details with complete event registration and attendance history.

---

# Users

POST /users

Super Admin only. Creates a new admin user and automatically dispatches a welcome email containing their initial login credentials (plain-text temporary password) with instructions to change password upon initial login.

---

# Contact

POST /contact
POST /churches/:tenantSlug/contact

Public endpoint to submit a contact form for prayer requests or general inquiries.

---

GET /contact/submissions

Admin and Super Admin only. List contact submissions with pagination, search, and filtering.

---

GET /contact/submissions/:id

Admin and Super Admin only. Retrieves single contact submission details.

---

DELETE /contact/submissions/:id

Admin and Super Admin only. Deletes a contact submission.

---

# Phase 2 Upcoming API Extensions (Preview)

- GET /departments & GET /departments/:id
- People & Profile endpoints (GET /people, GET /auth/profile) will include assigned `departments` array for administrative & member UI views.

---

# Self-Service Profile Link

Public endpoints (no auth).

POST /profile/claim

Body: `{ email?, phone?, churchSlug? }`. Links are emailed only. A phone number only matches an existing person who has an email on file; an unknown phone creates nothing. An unknown email creates a `VISITOR` named "New Visitor" with `namesConfirmed: false`. Always returns `200` with the same generic message. Per-email limit (1 per 60 s, 5 per hour) returns that same `200` and sends nothing. Per-IP limit (60 per 10 min) returns `429`.

GET /profile/:token

Returns `person` (now including `namesConfirmed`), `church` (now including `shortName` and `whatsappNumber`) and `availableDepartments`. First open sets `profileTokenOpenedAt`.

PATCH /profile/:token

Saves the profile and consumes the token. Accepted if the token has not expired, or if it was opened before expiry and the save is within 30 minutes of opening. Sets `namesConfirmed: true`. `VISITOR`/`MEMBER` have departments cleared. When the person has a PIN after the save, returns `accessToken` alongside `person`.

Errors (`400`, body includes `code`):

| `code` | When |
|---|---|
| `PROFILE_LINK_INVALID` | Unknown or already-used token |
| `PROFILE_LINK_EXPIRED` | Token expired (and, for `PATCH`, outside the grace window) |
| `NAMES_REQUIRED` | `PATCH` while `namesConfirmed` is false and `firstName`/`lastName` is missing |
| `DEPARTMENT_REQUIRED` | `WORKER` with no departments, when the church has at least one department |
| `PIN_TOO_WEAK` | PIN is repeated digits, ascending/descending runs, or common denylist |

The link base URL comes from the `PROFILE_URL` env var (falls back to `APP_URL/profile`). Profile tokens are redacted from server logs (`/profile/:token`).

---

# Member Session & PIN Endpoints

POST /profile/login

Body: `{ identifier: string, pin: string, churchSlug?: string }`
Authenticates a member using email or phone number and a 4-digit PIN. Resolves both domestic `0803...` and E.164 `+234803...` phone numbers to the same record. Rate limited to 15 requests per minute per IP (429) and locked after 5 consecutive failed attempts for 15 minutes (403, `PIN_LOCKED` with `lockedUntil`). Returns `{ message, accessToken, person, church }`.

GET /profile/me

Header: `Authorization: Bearer <accessToken>`
Validates member session. Returns `{ person, church, accessToken }`. The returned `accessToken` is re-issued for a sliding 30-day session window. Returns 401 if token is missing, invalid, expired or revoked.

PUT /profile/me/pin

Header: `Authorization: Bearer <accessToken>`
Body: `{ currentPin?: string, newPin: string }`
Allows member to set or change their 4-digit PIN. `currentPin` is required only if `person.hasPin` is true. Wrong current PIN counts toward the 5-attempt lockout (401 `INVALID_PIN` with `attemptsRemaining`; 403 `PIN_LOCKED` with `lockedUntil`). Rejects weak PINs with 400 `PIN_TOO_WEAK`. Success resets failed attempts and lockout.

POST /profile/logout

Header: `Authorization: Bearer <accessToken>`
Revokes the member session so the token cannot be reused. Returns 200 `{ message: 'Logged out successfully' }`.

---

# Phone Numbers

Every phone number written through the API is stored in E.164 (`+2348034567890`). Nigerian numbers may be typed as `0803…`, `803…`, `+234 803…` or `234803…`. An invalid number returns `400` with `Please enter a valid phone number`. Public endpoints (registration, profile claim) do not block on a bad number: it is dropped and a warning is logged.

---

# Church and Admin Identity

PATCH /settings/church accepts two new fields, and GET returns both:

- `shortName` (max 50): the name used in messages. Falls back to the full name.
- `whatsappNumber`: the church WhatsApp number, normalised to E.164. Send an empty string to clear.

GET /settings/profile and PATCH /settings/profile accept and return `displayName` (max 100). Messages are signed with `displayName`, falling back to `firstName`.

---

# Message Templates

Roles: `GET` for SUPER_ADMIN, ADMIN, COORDINATOR. Writes for SUPER_ADMIN, ADMIN.

GET /message-templates?channel=&purpose=&checkInReason=&includeInactive=

POST /message-templates

PATCH /message-templates/:id

DELETE /message-templates/:id

Templates already used in an outreach record are deactivated instead of deleted. The response says which happened (`deleted` / `deactivated`).

POST /message-templates/preview

Body `{ "body": "..." }`. Returns `{ body, unknownPlaceholders }` rendered with sample values.

Allowed placeholders (case and spacing are ignored): `{{firstName}}`, `{{adminName}}`, `{{churchName}}`. Saving a template with any other placeholder returns `400` listing the bad tokens. `body` is limited to 1,000 characters. `checkInReason` is only allowed when `purpose` is `PASTORAL_CHECK_IN`.

---

# WhatsApp Outreach

Roles: SUPER_ADMIN, ADMIN, COORDINATOR.

POST /outreach/whatsapp/preview

Body: `{ personId, purpose, checkInId?, templateId? }`. Saves nothing. Returns `person`, `toPhone`, `whatsappDigits`, `template`, `alternatives`, `body`, `lastOutreach` and `warnings`.

When `templateId` is omitted a template is chosen: active templates for the purpose, preferring the check-in's reason, skipping the one last used for this person, then random.

Warning codes: `NO_PHONE`, `INVALID_PHONE`, `WHATSAPP_OPT_OUT`, `NO_TEMPLATE`, `ALREADY_GREETED_THIS_YEAR`, `CONTACTED_RECENTLY`.

Errors (`400` with `code`): `PERSON_NOT_IN_CHURCH`, `CHECK_IN_PERSON_MISMATCH`, `TEMPLATE_NOT_FOUND`.

POST /outreach/whatsapp

Body: `{ personId, purpose, checkInId?, templateId?, body }` (`body` 1 to 1,000 characters, stored as sent). Records the message as `OPENED`. Returns `409` with `code` `NO_PHONE`, `INVALID_PHONE` or `WHATSAPP_OPT_OUT`.

PATCH /outreach/:id/confirm

Body: `{ sent: boolean }`. Only the user who opened it, or an ADMIN / SUPER_ADMIN, can confirm.

- `sent: false`: status `NOT_SENT`.
- `sent: true`: status `CONFIRMED_SENT` and, in one transaction, `person.lastFollowUpAt` is set. `VISITOR_FOLLOW_UP` moves a `PENDING` follow-up to `IN_PROGRESS`. `BIRTHDAY` records a WhatsApp `BirthdayGreeting`. `PASTORAL_CHECK_IN` does not complete the check-in; use `PATCH /check-ins/:id`.
- Confirming twice changes nothing. A confirmed message cannot be changed to not sent (`409`).

GET /outreach?personId=&purpose=&status=&sentByUserId=&from=&to=&page=&limit=

Paginated log: `{ items, meta }`.

GET /outreach/today?limit=

Calculated on request in Africa/Lagos time. Returns `{ birthdays, checkIns, visitorFollowUps, unconfirmed }`, each `{ total, items }` and capped at `limit` (default 20).

- `birthdays`: birthdays today with no WhatsApp greeting this year, with an `emailGreeted` flag.
- `checkIns`: scheduled check-ins due by the end of today, those assigned to the caller first.
- `visitorFollowUps`: visitors with a pending follow-up, at least 2 days old, with no confirmed message in the last 7 days.
- `unconfirmed`: the caller's `OPENED` messages older than 15 minutes.

GET /people/:id/messages?page=&limit=

One timeline of emails, birthday greetings and WhatsApp messages, newest first: `{ type, purpose, at, by, status, preview, refId }`.

PATCH /people/:id accepts `whatsappOptOut` (like `emailOptOut`; `whatsappOptOutAt` is maintained automatically).

---

# Birthdays by channel

`GET /birthdays` keeps `greeting` as the email greeting and adds `whatsappGreeting` and `greetedChannels`. The `status` filter still means email. Add `greeted=any|email|whatsapp|none` to filter by channel. `GET /birthdays/analytics` adds `whatsappSent` and `anyChannelSent` to the totals and to each month.

---

# Email Bounces

GET /email-bounces

Admin & Super Admin only. Returns active (unresolved) email delivery failures and bounce alerts.

---

GET /email-bounces/analytics

Admin & Super Admin only. Retrieves bounce rates, delivery rate, resolution rates, event type breakdowns, monthly trends, and top failing domains.
Query Parameters: `year` (optional number), `month` (optional 1-12), `emailType` (optional string), `recipientType` (optional string).

---

GET /email-bounces/export

Admin & Super Admin only. Exports email bounce alerts as a downloadable CSV file.

---

PATCH /email-bounces/:id/resolve

Admin & Super Admin only. Marks an email bounce alert as resolved.

---

POST /email-bounces/:id/remediate

Admin & Super Admin only. Corrects the bounced email address on the Person / User record, resets their email status to `DELIVERABLE`, marks the bounce alert as resolved, and optionally resends the original email with original context.