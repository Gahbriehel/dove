# Phase 2 Scope — Church Relationship Platform

## Goal

Turn event visitors into known, connected members of the church.

Every Person who passed through Phase 1 (or any future event) can now
self-serve their own profile, be followed up by the pastoral team, and be
promoted through the membership lifecycle — all without requiring a traditional
login account.

---

## Core Problem

Phase 1 creates a `Person` record for every event registrant. Those records
are minimal — just enough to get someone checked in. Most have gaps: no gender,
no date of birth, no address.

Phase 2 closes those gaps by giving each person a way to own and enrich their
own record, and giving the church the tools to follow up and promote members.

---

## Self-Service Profile Portal

### What It Is

A public-facing web page the church can share via QR code, WhatsApp, or
a link on screen during services. Anyone can visit it — no login required.

### The Flow

```
1. Person scans QR code / opens the shared link
2. Enters their email address or phone number
3. System looks up their existing Person record:
     → Found:  generates a magic link and sends it to their email/phone
     → Not found: creates a new VISITOR Person record, then sends a magic link
4. Person clicks the link → lands on their own profile form (pre-filled)
5. They review and update: name, phone, gender, date of birth, address
6. Profile is saved to the Person record in Dove
```

### What People Can Update

- First name, last name
- Email address
- Phone number
- Gender
- Date of birth
- Address
- `membershipStatus` (`VISITOR`, `MEMBER`, `WORKER`, `LEADER`, `PASTOR`)
- Department memberships (if `WORKER`, prompt for department; optional for `LEADER` & `PASTOR`)

### What People Cannot Change

- `churchId` — always inferred from the application context
- System administration permissions — `Person` records represent congregants/attendees and are decoupled from admin `User` accounts; selecting `LEADER` or `PASTOR` never grants administrative system credentials. Admins maintain full moderation over department rosters and can adjust or remove anyone who doesn't belong.

---

## Magic Link Authentication

Member auth is tokenised and passwordless. Admin auth (JWT username+password)
remains completely separate and unchanged.

### Token Design

Two fields are added to the `Person` table:

| Field | Type | Notes |
|---|---|---|
| `profileToken` | String? unique | Stored token, consistent with `Registration.token` |
| `profileTokenExpiresAt` | DateTime? | 30-minute expiry; token is invalid after this |

The token is invalidated after use (single-use) or expiry, whichever comes first.

### Endpoints (public — no auth guard)

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/profile/claim` | Submit email/phone → find-or-create Person → send magic link |
| `GET` | `/profile/:token` | Validate token → return Person profile data |
| `PATCH` | `/profile/:token` | Validate token → save profile updates |

`POST /profile/claim` always returns `200` with a generic message regardless of
whether the email/phone matched an existing record (prevents enumeration).

---

## PWA Introduction

### Strategy

The profile portal is the front door to the church's Progressive Web App.
It is built in a separate frontend repo (`dove-app`) as a PWA from day one.

The install prompt fires at the best possible moment — right after the person
successfully saves their profile:

> "Your profile is set up. Install the Dove app to stay connected with your church."

This approach avoids the worst-practice of prompting on first page load and
ties the install to a moment of genuine value.

### Repos

| Repo | Purpose |
|---|---|
| `dove` | NestJS backend API (this repo) |
| `dove-app` | Next.js PWA frontend (new repo) |

### Phase 2 PWA Scope (`dove-app`)

- PWA manifest and service worker (offline-capable shell)
- `/profile` — claim page (email/phone entry)
- `/profile/[token]` — profile form (pre-filled, editable)
- Install prompt component (fires on profile save success)

### Phase 3 PWA Growth

The same installed app expands to include:
Devotionals, Sermons, Giving, Prayer Requests, Notifications, Calendar.

No reinstallation is needed. The PWA shell simply gains new routes.

### Auth Evolution

| Phase | Member Auth Mechanism |
|---|---|
| Phase 2 | Short-lived magic link token (30 min, single-use) |
| Phase 3 | Same `POST /profile/claim` flow issues a persistent JWT stored in the PWA |

No redesign is required at the transition — the claim endpoint gains an optional
`persistent=true` flag (or equivalent) to switch token behaviour.

---

## Visitor → Member Promotion

Admins promote a person's `membershipStatus`; people cannot promote themselves.

### Endpoint

```
POST /people/:id/promote
Body: { membershipStatus: "MEMBER" | "WORKER" | "LEADER" }
```

### Rules

- The person must currently hold a lower status than the target (no demotions via this endpoint)
- The person must have at least one contact field populated (email or phone) before
  being promoted — prevents promoting anonymous ghost records
- Returns `400` with a clear message if the profile is incomplete

### Bulk Promotion (Optional)

```
POST /people/bulk-promote
Body: { ids: ["uuid1", "uuid2"], membershipStatus: "MEMBER" }
```

Useful for promoting a cohort of known regulars after a service or campaign.

---

## Visitor Tracking & Follow-up

Three fields are added to `Person` (no new table required):

| Field | Type | Notes |
|---|---|---|
| `followUpNotes` | String? | Free text — pastoral notes visible only to admins |
| `lastFollowUpAt` | DateTime? | Timestamp of last pastoral contact |
| `followUpStatus` | Enum? | Nullable; defaults to `PENDING` for visitors, `null` for non-visitors |

### FollowUpStatus Enum

| Value | Meaning |
|---|---|
| `PENDING` | Visitor has not been contacted yet (default for visitors) |
| `IN_PROGRESS` | Follow-up has started |
| `CONVERTED` | Visitor has become a member |
| `INACTIVE` | No further follow-up needed |

These fields are admin-only — not exposed via the public profile endpoints. Non-visitors (Members, Workers, Leaders, Pastors) have `null` for `followUpStatus` unless explicitly set or converted from a visitor.

---

## Department Management

### What It Is

Ministries and serving units within the church. A person can belong to
one or more departments.

### Schema

**Department**

| Field | Notes |
|---|---|
| `id` | UUID |
| `churchId` | FK → Church |
| `name` | e.g. "Choir", "Media", "Ushers" |
| `description` | Optional |

**DepartmentMembership** (join table)

| Field | Notes |
|---|---|
| `id` | UUID |
| `personId` | FK → Person |
| `departmentId` | FK → Department |
| `role` | Optional — e.g. "Head", "Member" |
| `joinedAt` | DateTime |

### API

Department memberships are surfaced on `GET /people/:id` and
`GET /profile/:token` so both admin views and the member's own
profile reflect their ministry involvement.

---

## Email Campaigns

Targeted email broadcasts to filtered segments of People.

Examples:
- All visitors from the Youth Conference
- All members with `followUpStatus = PENDING`
- All people with birthdays this month

Delivered via the existing Resend integration.

---

## Weekly Attendance

Track Sunday service attendance per Person, separate from event attendance.

Allows the pastoral team to monitor regularity and flag anyone who has gone
quiet — a key input to the follow-up workflow.

---

## What Is Out of Scope for Phase 2

- Member access to admin system credentials (remains admin only)
- Giving / financial records
- Devotionals, sermons, prayer requests (Phase 3)
- Multi-church support (Phase 4)
- Push notifications (Phase 3)

---

## Success Criteria

- A church member can scan a QR code and update their own profile in under 2 minutes
- An admin can view all visitors with incomplete profiles and filter by follow-up status
- An admin can promote a visitor to member in one action
- The profile page prompts and successfully installs the PWA on a mobile device
- All Phase 2 backend changes are non-breaking to Phase 1 API consumers
