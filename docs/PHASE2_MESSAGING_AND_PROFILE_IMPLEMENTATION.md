# Phase 2: Profile Link Fixes & WhatsApp Outreach (Implementation Guide)

This guide covers two pieces of backend work:

- **Part A** fixes the self-service profile flow so the member PWA (`abwog-lifestyle`) can launch.
- **Part B** adds what's needed for staff to send birthday, follow-up and pastoral care messages over WhatsApp.

The matching admin UI work is in Olive (`olive/docs/whatsapp-outreach-implementation.md`).

Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) first. All existing conventions apply: thin controllers, Prisma for all persistence, the church inferred from context, and non-breaking changes for existing API consumers.

---

## 0. Decision summary (ADR-006)

| Topic | Decision |
|---|---|
| Secure profile link | **Email only.** Phone is no longer a way to request a link. |
| SMS | **Not used.** The cost and the Nigerian sender-ID registration aren't justified, and SMS sent from a sender name is one-way, which is wrong for pastoral messages. |
| Birthday, visitor follow-up and pastoral care messages | **Staff send them by hand from the church WhatsApp Business number**, via click-to-chat links (WhatsApp Web, or the WhatsApp Business app on a phone). Dove writes the message, logs it and records the outcome. No WhatsApp API, Meta verification or per-message cost. |
| Birthday emails | Kept. A person can get one birthday greeting per channel per year. |
| Message personalisation | Templates with `{{firstName}}`, `{{adminName}}` and `{{churchName}}`, with several versions per purpose, rotated so messages don't look identical. This lowers the risk of WhatsApp flagging the number for spam. |
| Church naming | Full name **"Abiding Word Of Grace Missions"**. Short name used in messages: **"Amazing Grace"**. The former name appears in the member-facing apps as **"PKA Amazing Grace Bible Church"**. |

Append this as **ADR-006** to [`DECISIONS.md`](./DECISIONS.md) (done alongside this guide). Update `PHASE2_SCOPE.md` and `ROADMAP.md` to remove "magic link via email/SMS".

---

# Part A: Profile link fixes (blocks the PWA launch)

### A1. Configurable profile link base URL **[blocker]**

`ProfileService.claim` reads `configService.get('profileUrl')`, but `src/config/configuration.ts` never defines it. As a result, links fall back to `${APP_URL}/profile/<token>`. In production `APP_URL` is `https://api.abwog.org/`, so members would be sent to the API server instead of the member app.

- Add `profileUrl: process.env.PROFILE_URL` to `configuration.ts`.
- Add `PROFILE_URL` (optional, URL) to `env.validation.ts` and `.env.example`.
- **Production value:** `PROFILE_URL="https://app.abwog.org/profile"`. The member PWA lives at `app.abwog.org`.

### A2. Machine-readable link errors **[blocker]**

`GET` and `PATCH /profile/:token` return `400` for both expired and invalid links. The PWA shows a different screen for each, so add a `code` alongside the existing message:

```ts
throw new BadRequestException({
  message: 'Magic link has expired. Please request a new one.',
  code: 'PROFILE_LINK_EXPIRED',
});
throw new BadRequestException({
  message: 'Invalid or expired magic link',
  code: 'PROFILE_LINK_INVALID',
});
```

`HttpExceptionFilter` already passes extra properties through, so the response becomes `{ success:false, statusCode:400, message, code }`. Keep the existing messages so current clients don't break.

Move token resolution into one private method, `resolveToken(token, { forUpdate })`, and use it from both endpoints so the rules can't drift apart.

### A3. No placeholder names on new records **[blocker]**

When an unknown email claims a profile, Dove creates a `VISITOR` named after the email address (e.g. "Sarah adeyemi") with the last name "Guest". The PWA would pre-fill these and greet the person by them.

- Add `Person.namesConfirmed Boolean @default(true) @map("names_confirmed")`. Existing rows stay `true`.
- In `claim`, new records are created with `namesConfirmed: false`, `firstName: 'New'`, `lastName: 'Visitor'`. Admin lists still get something readable, and the made-up email-derived name goes away.
- `GET /profile/:token` returns `person.namesConfirmed`. When it is `false`, the PWA leaves the name fields empty and greets with "Welcome!".
- `PATCH /profile/:token` sets `namesConfirmed: true`. If `namesConfirmed` is currently `false`, `firstName` and `lastName` are **required** in the request; otherwise return 400 with `code: 'NAMES_REQUIRED'`.
- When `namesConfirmed` is `false`, the link email opens with "Hello," instead of the placeholder name.
- **Only create a new person when an email is given.** If a phone-only claim matches no one, return the generic 200 and create nothing, because there would be no way to reach them.

### A4. Rate limiting on `POST /profile/claim`

There is no rate limiting today, so the endpoint can be used to flood someone's inbox. Add `@nestjs/throttler`:

| Key | Limit | When exceeded |
|---|---|---|
| Normalised email | 1 per 60 s, 5 per hour | Return the **same generic 200** and send nothing. This keeps the anti-enumeration guarantee, and the PWA's countdown already tells people to wait. |
| Client IP | 60 per 10 min | `429`. Keep this limit generous: the whole congregation shares one foyer Wi-Fi IP. |

- Use a custom throttler tracker for the email key. Set `app.set('trust proxy', 1)` if Dove sits behind a proxy, so the real client IP is used.
- If Dove runs more than one instance, use a shared store (Redis) for the counters. The in-memory store is fine for a single instance.

### A5. Grace window so members don't lose a half-filled form

Today a link opened at minute 29 and saved at minute 31 fails as expired.

- Add `Person.profileTokenOpenedAt DateTime? @map("profile_token_opened_at")`.
- `GET` sets it if it is null.
- `PATCH` accepts the token if it hasn't expired, **or** if `openedAt <= expiresAt` and `now <= openedAt + 30 min`.
- `claim` resets it to null whenever it issues a new token.
- `GET` still rejects a link opened for the first time after `expiresAt`.

### A6. Server-side department rule

`UpdateProfileDto` accepts any `departmentIds`. Mirror the PWA's rules on the server:

- `WORKER` with zero departments: 400, `code: 'DEPARTMENT_REQUIRED'`. **Only enforce this when the church has at least one department**; otherwise a Worker could never save.
- `VISITOR` or `MEMBER` with departments: clear them by treating the request as `departmentIds: []`.

### A7. Email copy

The member-facing wording must not say "magic link".

- **Subject:** `Update your details with {{churchShortName}}`
- **Heading:** `Your secure link`
- **CTA:** `Update my details`
- **Body:** mention it expires in 30 minutes and can be used once.
- `{{churchShortName}}` comes from B2, falling back to `church.name`.

### A8. Keep tokens out of logs

Request URLs that contain profile tokens are logged in three places. Redact `/profile/<token>` to `/profile/:token` in all of them:

1. **`nestjs-pino`** (`app.module.ts`): add `serializers.req` (or `customProps`) that rewrites `req.url`. Also check `autoLogging`.
2. **`LoggingInterceptor`**: log the route pattern (`req.route?.path`) instead of `req.url`.
3. **`HttpExceptionFilter`**: same change in the 500 log line.

Add a small shared `redactUrl()` in `src/common/utils/` and unit-test it.

### A9. Fields the PWA needs on `GET /profile/:token`

Add `shortName` and `whatsappNumber` to the `church` select (see B2). The PWA's success screen offers "Save our WhatsApp number".

---

# Part B: WhatsApp outreach

## B1. Store phone numbers in one format (E.164)

WhatsApp links need the full international number (`2348034567890`). Phone numbers are stored exactly as typed today (`0803…`, `+234 803…`, `234803…`).

- Add `libphonenumber-js`.
- Create `src/common/utils/phone.util.ts`:
  - `normalizePhone(raw: string, defaultCountry: CountryCode = 'NG'): string | null` returns E.164 (`+2348034567890`), or `null` if the number is invalid.
  - `toWhatsAppDigits(e164: string): string` strips the `+`.
- Apply it on every write: `PeopleService.create`/`update`, registration create (Person find-or-create), `ProfileService.claim`/`updateByToken`, `SettingsService` church phone and WhatsApp number, and the user profile phone.
- **Apply it to lookup inputs too**, so registration deduplication and profile claims match regardless of format.
- **On invalid input:** writes return 400 with a field message ("Please enter a valid phone number"). Public registration should stay forgiving: store `null` and log a warning rather than block the registration.
- **One-off migration script** `scripts/normalize-phones.ts`, run with `bun scripts/normalize-phones.ts [--apply]`:
  - Dry run by default. It prints counts of converted, already-valid, invalid (left untouched and listed) and **duplicates** (two people with the same normalised number).
  - Duplicates are reported only, never merged automatically.
  - `--apply` writes the converted values in batches.

## B2. Church and admin identity fields

**`Church`** (migration):

| Field | Type | Example |
|---|---|---|
| `shortName` | `String? @db.VarChar(50) @map("short_name")` | `Amazing Grace` |
| `whatsappNumber` | `String? @db.VarChar(20) @map("whatsapp_number")` | `+2348012345678` (E.164) |

- `UpdateChurchSettingsDto` accepts both. `whatsappNumber` goes through `normalizePhone`.
- `formatChurchResponse` returns both.

**`User`** (migration):

| Field | Type | Example |
|---|---|---|
| `displayName` | `String? @db.VarChar(100) @map("display_name")` | `Pastor John` |

- `settings/profile` read and update support it.
- Resolve `adminName` as `user.displayName?.trim() || user.firstName`.

After the deploy, set the actual values through Olive Settings:
- Church name: "Abiding Word Of Grace Missions".
- Short name: "Amazing Grace".
- WhatsApp number: the new church line.

## B3. New enums

```prisma
enum MessageChannel {
  EMAIL
  WHATSAPP
}

enum OutreachPurpose {
  BIRTHDAY
  VISITOR_FOLLOW_UP
  PASTORAL_CHECK_IN
}

enum OutreachStatus {
  OPENED          // admin opened WhatsApp with the prepared message
  CONFIRMED_SENT  // admin confirmed they sent it
  NOT_SENT        // admin said they didn't send it
}
```

## B4. Message templates

```prisma
model MessageTemplate {
  id            String          @id @default(uuid())
  churchId      String          @map("church_id")
  channel       MessageChannel  @default(WHATSAPP)
  purpose       OutreachPurpose
  checkInReason CheckInReason?  @map("check_in_reason") // only for PASTORAL_CHECK_IN; null = any reason
  name          String          @db.VarChar(100)
  body          String          @db.Text
  isActive      Boolean         @default(true) @map("is_active")
  createdById   String?         @map("created_by_id")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")

  church Church @relation(fields: [churchId], references: [id], onDelete: Cascade)

  @@index([churchId, channel, purpose, isActive])
  @@map("message_templates")
}
```

**Placeholders.** Only these are allowed:

| Placeholder | Value |
|---|---|
| `{{firstName}}` | The person's first name |
| `{{adminName}}` | The sending admin's display name, or first name if none |
| `{{churchName}}` | `church.shortName`, falling back to `church.name` |

**Rules:**
- Placeholder matching ignores case and whitespace (`{{ firstName }}` works).
- Saving a template with an unknown placeholder fails with 400 and lists the bad tokens.
- `body` is limited to 1,000 characters.
- `checkInReason` may only be set when `purpose = PASTORAL_CHECK_IN`.
- Rendering lives in `TemplateRenderer.render(body, vars)`, a pure function with its own unit tests.

**Endpoints** (`message-templates` module; `GET` for `SUPER_ADMIN, ADMIN, COORDINATOR`, writes for `SUPER_ADMIN, ADMIN`):

| Method | Route | Notes |
|---|---|---|
| GET | `/message-templates?channel=&purpose=&checkInReason=&includeInactive=` | Lists templates |
| POST | `/message-templates` | Creates a template |
| PATCH | `/message-templates/:id` | Updates a template |
| DELETE | `/message-templates/:id` | Soft delete (`isActive=false`) if the template appears in any outreach log; hard delete otherwise |
| POST | `/message-templates/preview` | `{ body }` renders with sample values (Sarah / the current admin / the church) for the live editor preview |

**Seed defaults.** Add these to `prisma/seed.ts` only when the church has no templates. Pastors will edit them in Olive.

| Purpose (reason) | Name | Body |
|---|---|---|
| BIRTHDAY | Birthday – blessing | Happy birthday {{firstName}}! 🎉 I'm {{adminName}} from {{churchName}}. We thank God for your life and pray this new year brings you joy, good health and His abundant grace. Have a blessed day! 🎂 |
| BIRTHDAY | Birthday – church family | Hi {{firstName}}, it's {{adminName}} from {{churchName}}. Happy birthday! 🥳 The whole church family celebrates you today. May God's favour go with you all through this new year. |
| BIRTHDAY | Birthday – grateful | Happy birthday, {{firstName}}! 🎂 {{adminName}} here from {{churchName}}. We're so grateful to have you with us. Wishing you a wonderful day and a year full of God's blessings. |
| VISITOR_FOLLOW_UP | Visitor – thank you | Hi {{firstName}}, I'm {{adminName}} from {{churchName}}. Thank you so much for worshipping with us! It was a joy to have you. How are you doing? We'd love to see you again this Sunday. |
| VISITOR_FOLLOW_UP | Visitor – prayer | Hello {{firstName}}! It's {{adminName}} from {{churchName}}. Just wanted to say thank you for visiting. If there's anything we can pray with you about, please feel free to reply here. 🙏 |
| PASTORAL_CHECK_IN (ABSENTEEISM) | Missed you | Hi {{firstName}}, it's {{adminName}} from {{churchName}}. We've missed you! Just checking in, how are you doing? 😊 |
| PASTORAL_CHECK_IN (ABSENTEEISM) | Making sure you're okay | Hello {{firstName}}, {{adminName}} here from {{churchName}}. We haven't seen you in a little while and wanted to make sure you're okay. We're thinking of you! |
| PASTORAL_CHECK_IN (ILLNESS) | Get well | Hi {{firstName}}, it's {{adminName}} from {{churchName}}. We heard you haven't been feeling well. We're praying for your quick recovery. Is there anything we can do for you? 🙏 |
| PASTORAL_CHECK_IN (BEREAVEMENT) | Condolence | Dear {{firstName}}, it's {{adminName}} from {{churchName}}. We're so sorry for your loss. Please know the church family is standing with you in prayer. We're here for you, any time. |
| PASTORAL_CHECK_IN (WORKER_WELFARE) | Worker welfare | Hi {{firstName}}, {{adminName}} here from {{churchName}}. Thank you for all you do in the house of God. Just checking in on you, how are you keeping? |
| PASTORAL_CHECK_IN (DISCIPLESHIP) | Discipleship | Hi {{firstName}}, it's {{adminName}} from {{churchName}}. I wanted to check in on how you're growing in your walk with God. Do you have some time this week to talk? |
| PASTORAL_CHECK_IN (FAMILY_SUPPORT) | Family support | Hi {{firstName}}, it's {{adminName}} from {{churchName}}. We've been thinking of you and your family. How is everyone doing? We're here if you need anything. |
| PASTORAL_CHECK_IN (null) | General check-in | Hi {{firstName}}, it's {{adminName}} from {{churchName}}. Just checking in to see how you're doing. We appreciate you! 😊 |

## B5. Outreach log

This table records WhatsApp outreach. **`EmailSendLog` stays as it is.** It is keyed by Resend's email id for bounce handling, and merging it now would put bounce remediation at risk. A person's message history is the two tables combined (B9).

```prisma
model OutreachMessage {
  id           String          @id @default(uuid())
  churchId     String          @map("church_id")
  personId     String          @map("person_id")
  sentByUserId String          @map("sent_by_user_id")
  channel      MessageChannel  @default(WHATSAPP)
  purpose      OutreachPurpose
  checkInId    String?         @map("check_in_id")
  birthdayYear Int?            @map("birthday_year")
  templateId   String?         @map("template_id")
  toPhone      String          @map("to_phone") @db.VarChar(20)   // E.164 at time of sending
  body         String          @db.Text                           // final text, after any edits
  status       OutreachStatus  @default(OPENED)
  openedAt     DateTime        @default(now()) @map("opened_at")
  confirmedAt  DateTime?       @map("confirmed_at")
  createdAt    DateTime        @default(now()) @map("created_at")
  updatedAt    DateTime        @updatedAt @map("updated_at")

  church   Church           @relation(fields: [churchId], references: [id], onDelete: Cascade)
  person   Person           @relation(fields: [personId], references: [id], onDelete: Cascade)
  sentBy   User             @relation("OutreachSentBy", fields: [sentByUserId], references: [id], onDelete: Restrict)
  checkIn  PastoralCheckIn? @relation(fields: [checkInId], references: [id], onDelete: SetNull)
  template MessageTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)

  @@index([churchId, createdAt])
  @@index([personId, createdAt])
  @@index([sentByUserId, status])
  @@index([purpose, status])
  @@map("outreach_messages")
}
```

## B6. WhatsApp opt-out per person

- Add to `Person`:
  - `whatsappOptOut Boolean @default(false) @map("whatsapp_opt_out")`
  - `whatsappOptOutAt DateTime? @map("whatsapp_opt_out_at")`
- Admins set it from Olive, for example when someone replies "please stop".
- Accept it in `UpdatePersonDto`, following the same pattern as `emailOptOut` (commit `19e6502`).

## B7. Outreach endpoints (`outreach` module; roles `SUPER_ADMIN, ADMIN, COORDINATOR`)

| Method | Route | Purpose |
|---|---|---|
| POST | `/outreach/whatsapp/preview` | Writes the message for a person. **Saves nothing.** |
| POST | `/outreach/whatsapp` | Records that an admin opened WhatsApp with the message (`OPENED`) |
| PATCH | `/outreach/:id/confirm` | `{ sent: boolean }` records the outcome and applies the side effects |
| GET | `/outreach` | Paginated log. Filters: `personId, purpose, status, sentByUserId, from, to` |
| GET | `/outreach/today` | Today's to-do list for the dashboard (B8) |

**`POST /outreach/whatsapp/preview`**

Request:
```json
{ "personId": "…", "purpose": "PASTORAL_CHECK_IN", "checkInId": "…", "templateId": "…optional…" }
```

Response:
```json
{
  "person": { "id": "…", "firstName": "Sarah", "lastName": "Adeyemi" },
  "toPhone": "+2348034567890",
  "whatsappDigits": "2348034567890",
  "template": { "id": "…", "name": "Missed you" },
  "alternatives": [{ "id": "…", "name": "Making sure you're okay" }],
  "body": "Hi Sarah, it's Pastor John from Amazing Grace. We've missed you! …",
  "lastOutreach": { "at": "2026-10-12T…", "by": "Sis. Grace", "purpose": "PASTORAL_CHECK_IN" },
  "warnings": []
}
```

- **Template choice** when `templateId` is omitted:
  1. Take active templates matching the purpose. For `PASTORAL_CHECK_IN`, prefer ones whose `checkInReason` matches the check-in's reason, then the generic ones (`null`).
  2. Skip the template last used for this person, if another exists.
  3. Pick at random among the rest.
- **`warnings`** (codes; Olive shows friendly text):
  - `NO_PHONE`, `INVALID_PHONE`, `WHATSAPP_OPT_OUT`, `NO_TEMPLATE` (no active template for this purpose).
  - `ALREADY_GREETED_THIS_YEAR` (BIRTHDAY with a WhatsApp greeting already recorded).
  - `CONTACTED_RECENTLY` (a confirmed outreach in the last 3 days).
- **Hard errors** (400 with `code`): person not in this church; check-in not belonging to the person.

**`POST /outreach/whatsapp`**

Request:
```json
{ "personId": "…", "purpose": "…", "checkInId": "…?", "templateId": "…?", "body": "final edited text" }
```

- Returns 409 if the person has no valid phone or has opted out.
- `body`: 1–1,000 characters, stored exactly as sent.
- `birthdayYear` is filled in using the same target-year logic as `BirthdaysService` (extract it into a shared helper).
- Returns the created record.

**`PATCH /outreach/:id/confirm`** (only the user who opened it, or an ADMIN/SUPER_ADMIN, can confirm it)

- `sent: false` → `NOT_SENT`. No other changes.
- `sent: true` → `CONFIRMED_SENT`, `confirmedAt = now()`, then in **the same transaction**:
  - `person.lastFollowUpAt = now()`.
  - `VISITOR_FOLLOW_UP`: if `followUpStatus = PENDING`, set it to `IN_PROGRESS`.
  - `BIRTHDAY`: create a `BirthdayGreeting` with `channel = WHATSAPP` for `birthdayYear` (B10).
  - `PASTORAL_CHECK_IN`: **no automatic completion.** Olive then asks "Mark this check-in complete?" using the existing `PATCH /check-ins/:id`.
- Confirming an already-confirmed record changes nothing (idempotent).

## B8. Today's outreach (no scheduled job needed)

`GET /outreach/today` is calculated when requested. Dove has no scheduler, and this avoids adding one.

Compute "today" in **Africa/Lagos** time. The current birthday code uses UTC dates; it's a 1-hour difference, but be explicit.

```json
{
  "birthdays": [ /* people whose birthday is today with no WhatsApp greeting this year; includes emailGreeted flag */ ],
  "checkIns": [ /* SCHEDULED check-ins with scheduledFor <= end of today, assigned to me first */ ],
  "visitorFollowUps": [ /* VISITORs with followUpStatus PENDING, created >= 2 days ago, no CONFIRMED_SENT outreach in 7 days */ ],
  "unconfirmed": [ /* my OPENED outreach older than 15 minutes */ ]
}
```

Each list is capped (default 20, `?limit=`), with a `total` count. The visitor rule's numbers (2 days, 7 days) are constants in one place so they're easy to change later.

A daily summary email to admins (using `@nestjs/schedule`) is **optional and deferred**. The dashboard card covers the need.

## B9. A person's message history

`GET /people/:id/messages?page=&limit=` returns one timeline merged from `EmailSendLog` (where `personId` matches), `BirthdayGreeting` and `OutreachMessage`, sorted newest first:

```json
{ "type": "EMAIL" | "WHATSAPP", "purpose": "...", "at": "...", "by": { "id": "...", "name": "..." }, "status": "...", "preview": "first 140 chars", "refId": "..." }
```

## B10. Birthday greetings per channel (non-breaking)

**Schema:**
- Add `channel MessageChannel @default(EMAIL)` to `BirthdayGreeting`.
- Change the unique constraint `unique_person_year_greeting` from `[personId, year]` to `[personId, year, channel]`.
- Make `subject` nullable, since WhatsApp greetings have none.
- Existing rows become `EMAIL` through the default.

**Service code:**
- Every `findUnique` on that unique key now includes `channel: EMAIL` in `BirthdaysService`.
- The year-target logic (if this year's email greeting is already sent, target next year) applies **per channel**.

**`GET /birthdays` response:**
- Keep `greeting` as the **email** greeting so Olive keeps working before it's updated.
- Add `whatsappGreeting` (same shape, without `subject`).
- Add `greetedChannels: ('EMAIL'|'WHATSAPP')[]`.

**Other changes:**
- The `status` filter keeps its current meaning (based on email). Add `greeted=any|email|whatsapp|none`.
- Analytics: add `whatsappSent` and `anyChannelSent` next to the existing totals.

## B11. Tests

**Unit:**
- `normalizePhone`: `0803…`, `803…`, `+234 803…`, `234803…`, landlines, too short, non-NG `+44…`.
- `TemplateRenderer`: every placeholder, case and spacing, unknown placeholders, emoji.
- Template choice and rotation.
- Outreach confirm side effects for each purpose.
- Who may confirm.
- Birthday unique constraint per channel and the year-target logic.
- Profile: token expired / invalid / grace window; `namesConfirmed` rules; WORKER department rule; email rate limit returns the generic 200; `redactUrl`.

**E2E:**
- Claim → get → patch with an unknown email: new record, `namesConfirmed: false`, then `true`.
- Preview → open → confirm for a birthday: `BirthdayGreeting(WHATSAPP)` created, `lastFollowUpAt` set.

## B12. Docs to update in this repo

| Doc | Change |
|---|---|
| `API_CONTRACT.md` | New endpoints |
| `ERD.md` | New models and fields |
| `FRONTEND_PWA_GUIDE.md` | Email-only claim, error `code`s, `namesConfirmed`, church fields |
| `FRONTEND_ADMIN_GUIDE.md` | Point to the Olive guide |
| `PHASE2_SCOPE.md` / `ROADMAP.md` | Remove SMS; add WhatsApp outreach |
| `README.md` | `PROFILE_URL` env var |
| Swagger | Decorators on every new endpoint and DTO |

---

## Suggested order & estimate

| Step | Scope | Estimate |
|---|---|---|
| 1 | Part A (A1–A9). **Ship first; it unblocks the PWA** | 1.5–2 d |
| 2 | B1 phone util, write-path changes, migration script (run as a dry run against production data early) | 1 d |
| 3 | B2, B3, B6 schema & settings | 0.5 d |
| 4 | B4 templates, renderer, seed | 1 d |
| 5 | B5, B7, B10 outreach log, endpoints, birthday per channel | 1.5 d |
| 6 | B8 today, B9 timeline, docs | 1 d |
| | **Total** | **~6.5–7 days** |
