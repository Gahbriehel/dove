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
3. 4-Digit PIN Security & Lockout:
   - 5 consecutive failed PIN attempts lock the account for 15 minutes (`pinLockedUntil`, code: `PIN_LOCKED`).
   - Forgot PIN triggers existing magic link flow (`POST /profile/claim`), allowing members to reset their PIN upon opening the link.
4. Membership IDs:
   - Retained and reserved strictly for `MEMBER`, `WORKER`, `LEADER`, and `PASTOR` (excluding `VISITOR`).

