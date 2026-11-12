# Architecture Decisions

## ADR-001

Decision:
Participants do not require accounts during Phase 1.

Reason:
Reduce registration friction.

Future:
Accounts will be linked to existing People records.

---

## ADR-002

Decision:
Person is the central entity.

Reason:
Allows long-term relationship management.

---

## ADR-003

Decision:
Authentication exists only for administrators.

Reason:
Simpler MVP with fewer user-facing barriers.

---

## ADR-004

Decision:
Use Prisma with MySQL.

Reason:
Type safety, migrations, excellent NestJS integration.


## ADR-005

Title

Single Church Deployment

Status

Accepted

Decision

Phase 1 will operate as a single-church deployment.

One Church record is seeded during installation.

All Users, People and Events belong to this Church.

Clients never provide church_id.

The backend infers ownership from the authenticated administrator.

Reason

Maintains correct ownership relationships while avoiding unnecessary Church management features during the MVP.

Consequences

Positive

- No nullable foreign keys.
- No fake church IDs.
- Clean migration path to multi-tenancy.
- Accurate ownership from day one.

Future

Phase 4 introduces Church CRUD without requiring schema redesign.

## ADR-006

Title

Member Messaging: Email + Manual WhatsApp, No SMS

Status

Accepted

Decision

The secure profile link is sent by email only.

SMS is not used.

Birthday, visitor follow-up and pastoral care messages are sent by staff from the church WhatsApp Business number using click-to-chat links. Dove composes the message from editable templates, logs it, and records whether it was sent.

Birthday emails remain available alongside WhatsApp greetings.

Reason

SMS carries per-message cost and sender-ID registration overhead, and alphanumeric sender IDs cannot receive replies.

Pastoral messages need to be personal and two-way.

Click-to-chat has no per-message cost and needs no Meta business verification or template approval.

Consequences

Positive

- Near-zero messaging cost.
- Replies reach a shared church inbox with continuity across staff changes.
- Templates keep messages personal (member name, admin name) and varied.

Negative

- Sending is manual; Dove cannot confirm delivery, only what staff confirm.
- One church WhatsApp account supports at most four linked devices.

Future

WhatsApp Cloud API automation (e.g. automated reminders) and PWA push notifications can be added behind the same template and outreach log model.

See `docs/PHASE2_MESSAGING_AND_PROFILE_IMPLEMENTATION.md`.

---

## ADR-007

Title

Member PIN Authentication & Decoupled Trust Boundaries

Status

Accepted

Decision

1. Member credentials (`Person.pinHash`) and Staff/Admin credentials (`User.passwordHash`) remain strictly separate:
   - Staff/Admin authenticate into Olive via `POST /api/v1/auth/login` using email and strong password.
   - Members authenticate into the PWA via `POST /api/v1/profile/login` using phone/email and a 4-digit PIN.
   - Even if a church member is also a staff administrator, their 4-digit PIN never grants administrative access to Olive or sensitive church data.
2. During member onboarding via magic link, PIN setup is an explicit step between profile completion and the celebration screen:
   - Collected in `ProfileFlow` before final save.
   - Submitted in a single atomic request via `PATCH /profile/:token` with `pin?: string`.
3. 4-Digit PIN Security, Lockout & Denylist:
   - 5 consecutive failed PIN attempts lock the account for 15 minutes (`pinLockedUntil`, code: `PIN_LOCKED`, returns `lockedUntil`).
   - Incorrect attempts return `INVALID_PIN` with `attemptsRemaining`.
   - Weak PINs (repeated digits like `1111`, ascending/descending runs like `1234`/`4321`, or common PINs `1212`, `1122`, `2580`, `0852`, `1004`, `6969`) are rejected with `400` and code `PIN_TOO_WEAK`.
   - Forgot PIN triggers existing magic link flow (`POST /profile/claim`), allowing members to reset their PIN upon opening the link.
   - In-app PIN change/setting supported via `PUT /api/v1/profile/me/pin` with `{ currentPin?, newPin }`.
4. Member Session & Revocation:
   - Access tokens have a 30-day lifetime issued with `aud: 'dove:member'` and `type: 'MEMBER'`.
   - `GET /api/v1/profile/me` re-issues a renewed token for a sliding session window.
   - `POST /api/v1/profile/logout` revokes the session token (`jti`).
   - Abuse protection: `POST /api/v1/profile/login` is throttled per IP (15 requests/min) and per account. Phone numbers match both domestic `0803...` and E.164 `+234803...` formats.
5. Membership IDs:
   - Retained and reserved strictly for `MEMBER`, `WORKER`, `LEADER`, and `PASTOR` (excluding `VISITOR`).

---

## ADR-008

Title

Family Links and Unique Contact Details

Status

Accepted

Decision

1. Identity & Contact Uniqueness:
   - Every individual is an independent `Person` record. No "dependent" concept or shared account.
   - `Person.email` and `Person.phone` are strictly unique per church (`@@unique([churchId, email])`, `@@unique([churchId, phone])`) when present (both fields nullable).
   - Emails are trimmed and lower-cased on every write. Phones are normalized to E.164 (`normalizePhoneOrThrow`). Blank strings coerce to `null`.
   - Contact detail required: creating a person (admin create in Olive, member relative addition, self-registration) requires at least one of email or phone; missing both returns 400 `CONTACT_REQUIRED`. Admin updates may not clear both.
   - Collision privacy: taken email or phone returns HTTP 409 `{ "success": false, "message": "This email or phone number is already registered.", "code": "CONTACT_ALREADY_REGISTERED" }`, revealing neither which field matched nor who owns it. Prisma P2002 constraint violations map to the same response.
   - `POST /profile/claim` maintains a generic 200 response. If an unknown email arrives with a phone taken by another person, the visitor record is created without the phone.

2. Family Relationships:
   - Stored once per link in `PersonRelationship` (`RelationshipType`: `SPOUSE`, `PARENT`, `CHILD`, `SIBLING`, `OTHER`). Inverse relationship types are computed dynamically when queried from the other party (`PARENT` <-> `CHILD`, `SPOUSE` and `SIBLING` remain identical, `OTHER` keeps its free-text note).
   - Foreign key deletion cascades remove only the relationship link row, never the relative's person record.
   - Self-links and bidirectional duplicates `(a, b)` / `(b, a)` are rejected.
   - Ownership: records created by relatives cannot be edited by the creator. Only the person themselves can edit their details after claiming their profile (or staff with existing rights in Olive).

3. Claiming & Outreach for Phone-Only Relatives:
   - Phone-only relatives are invited via WhatsApp click-to-chat links:
     - Members can request a prefilled WhatsApp link for relatives they added via `POST /profile/me/relatives/:personId/claim-link`.
     - Staff in Olive can send a claim link via `POST /outreach/whatsapp` with purpose `PROFILE_LINK`.
   - WhatsApp claim links use a 48-hour single-use token (`PROFILE_WHATSAPP_LINK_TTL_MS`), while email claim links remain 30 minutes.
   - `POST /outreach/whatsapp/preview` displays placeholder `[profile link]` without issuing a token.
   - `POST /outreach/whatsapp` issues the live 48-hour token for the `whatsappUrl`, but redacts the token in DB storage by recording `[profile link]` in the message body.
   - Rate limiting: 10 relative creations/day per member; 3 claim links/day per target relative.


