# Product Roadmap

---

## Phase 1 — Church Events Platform ✅

Goal

Successfully manage the Youth Conference.

Modules

- Authentication
- Events
- Registration
- Teams
- QR Check-in
- Attendance
- Games
- Leaderboard

---

## Phase 2 — Church Relationship Platform 🚧

Goal

Turn event visitors into known, connected members of the church.

Every Person who passed through Phase 1 (or any future event) can now
self-serve their own profile, be followed up by the team, and be promoted
through the membership lifecycle — all without requiring a traditional login.

### Key Decisions

**Self-Service Profile Portal (public)**

The church shares a single QR code or link. Anyone can scan it, enter their
email or phone number, and receive a magic link to create or update their own
Person record. No password required.

This is the public front door to the church's digital relationship with each member.

**Magic Link Auth**

Authentication for members is tokenised and passwordless:

1. Person visits the public profile page
2. Submits their email or phone
3. Receives a short-lived magic link via email/SMS
4. Clicks the link → lands on their pre-filled profile form
5. Reviews and updates their details

Admin authentication (JWT with username + password) remains separate and unchanged.

**PWA Introduction via the Profile Page**

The profile portal is built as a Progressive Web App (PWA) — a separate frontend
repo (`dove-app`) that consumes the Dove API.

The profile completion screen is the moment the install prompt fires:

> "Your profile is saved — install the Dove app to stay connected with your church."

This makes the profile flow the natural on-ramp to the full PWA. Once installed,
the same app grows to host Phase 3 features (devotionals, sermons, giving, etc.)
without any reinstallation.

**Visitor → Member Promotion**

Admins can promote a Person's `membershipStatus` from `VISITOR` to `MEMBER`
(and beyond). The promotion endpoint enforces business rules — a Person cannot be
promoted without a minimum viable profile (at least email or phone on record).

Members do not promote themselves; that remains an admin action.

### Modules

- **Public Profile Portal** — self-service create/update via magic link
- **Member Profiles** — enriched with gender, DOB, address, department memberships & history
- **Visitor → Member Promotion** — admin-controlled promotion endpoint with profile completeness guard
- **Visitor Tracking & Follow-up** — follow-up notes, status, and last-contacted timestamp on Person
- **Department Management** — People assigned to Departments; surfaced in GET /people and profile endpoints
- **Email Campaigns** — broadcast emails to filtered segments of People
- **Weekly Attendance** — track Sunday service attendance per Person

### Backend Changes (Dove)

- `ProfileModule` — 3 public endpoints: claim, fetch, update (no auth guard)
- `profileToken` + `profileTokenExpiresAt` fields on `Person`
- `POST /people/:id/promote` — guarded promotion endpoint
- Follow-up fields on `Person`: `followUpNotes`, `lastFollowUpAt`, `followUpStatus`
- `FollowUpStatus` enum: `PENDING | IN_PROGRESS | CONVERTED | INACTIVE`
- Department schema + `DepartmentModule`

### Frontend (dove-app — new repo)

- PWA scaffold (Next.js + next-pwa, or Vite + vite-plugin-pwa)
- `/profile` — magic link claim page (email/phone entry + "send me a link")
- `/profile/[token]` — pre-filled profile form, editable by the person
- Install prompt component (fires after successful profile save)
- Offline-capable shell

---

## Phase 3 — Church Lifestyle Platform

Goal

Give every member a rich daily connection to the church through the installed PWA.

The same PWA installed during Phase 2 profile onboarding now unlocks:

Modules

- Daily Devotional
- Sermons
- Giving
- Prayer Requests
- Push Notifications
- Calendar
- Service Scheduling

Auth in Phase 3 evolves the magic link into a longer-lived session stored in the PWA
(no redesign — the same `POST /profile/claim` flow issues a persistent JWT instead of
a short-lived token).

---

## Phase 4 — Church Operating System

Modules

- Multiple Churches
- Finance
- Asset Management
- Workforce Management
- Analytics
- Reporting