# Entity Relationship Design

## Purpose

This document defines the database structure for the Dove platform, covering Phase 1 and Phase 2.

The database is intentionally designed to evolve into a complete Church Management System without requiring breaking schema changes.

---

# Core Philosophy

The central entity is **Person**.

Events, registrations, attendance, and future church modules all revolve around a Person.

A person may begin as a visitor, become a member, later become a worker, and eventually a leader—all without creating duplicate records.

---

# Entities

## Churches

Represents the owner of the platform.

Phase 1

- Exactly one Church exists.
- The Church is seeded during application setup.
- No CRUD endpoints exist.
- Every User, Person and Event belongs to this Church.

Future

Phase 4 introduces:

- Church CRUD
- Multiple Churches
- Tenant isolation

The database schema is already designed for this transition.

---

Fields added for WhatsApp outreach

| Field | Type | Purpose |
|---|---|---|
| `shortName` | String? | Name used in member-facing messages, for example "Amazing Grace". Falls back to `name`. |
| `whatsappNumber` | String? | Church WhatsApp Business number, E.164 |

---

## Users

Administrative users.

Responsible for managing the platform.

Examples

- Super Admin
- Admin
- Registration Desk
- Games Coordinator

Relationships

- Belongs to Church
- Has many Roles

---

Fields added for WhatsApp outreach

| Field | Type | Purpose |
|---|---|---|
| `displayName` | String? | Name staff sign messages with, for example "Pastor John". Falls back to `firstName`. |

---

## Roles

Defines permissions.

Examples

- Super Admin
- Admin
- Registration Desk

---

## UserRoles

Many-to-many relationship.

Users ↔ Roles

---

## People

The heart of the application.

Represents every individual known by the church.

A person may exist without ever creating an account.

Relationships

- Belongs to Church
- Has many Registrations
- Has many Department Memberships (Phase 2)

Phase 2 Fields Added

The following fields are added to `Person` in Phase 2. No existing fields are changed.

| Field | Type | Purpose |
|---|---|---|
| `profileToken` | String? | Short-lived token for magic link auth |
| `profileTokenExpiresAt` | DateTime? | Token expiry — token is invalid after this time |
| `profileTokenOpenedAt` | DateTime? | When the link was first opened; allows saving within 30 min of opening even after expiry. Reset when a new token is issued |
| `namesConfirmed` | Boolean | Default `true`. `false` for records created from an email alone (names are placeholders) until the person saves their names |
| `followUpNotes` | String? | Free text notes from the pastoral/follow-up team |
| `lastFollowUpAt` | DateTime? | When the person was last contacted |
| `followUpStatus` | Enum? | `PENDING \| IN_PROGRESS \| CONVERTED \| INACTIVE` (defaults to PENDING for visitors, null for non-visitors) |

The `profileToken` pattern mirrors `Registration.token` — already proven in Phase 1.

WhatsApp Outreach Fields Added

| Field | Type | Purpose |
|---|---|---|
| `whatsappOptOut` | Boolean | Set by an admin when someone asks not to be messaged on WhatsApp. Defaults to false. |
| `whatsappOptOutAt` | DateTime? | When the opt-out was recorded |

Unique Contact Details & PIN Authentication Fields Added

| Field | Type | Purpose |
|---|---|---|
| `email` | String? | Unique per church (`@@unique([churchId, email])`). Lower-cased and trimmed. |
| `phone` | String? | Unique per church (`@@unique([churchId, phone])`). Normalized to E.164. |
| `pinHash` | String? | Bcrypt hash of member 4-digit PIN for PWA authentication. Null when unclaimed. |
| `pinFailedAttempts` | Int | Counter for consecutive invalid PIN attempts (locks at 5). |
| `pinLockedUntil` | DateTime? | Lock expiry timestamp after 5 failed PIN attempts (15 min lockout). |

Contact requirement: every `Person` record must have at least one of `email` or `phone`.

`phone` is stored in E.164 format (`+2348034567890`). See `scripts/normalize-phones.ts` for the one-off migration of older values.

---

## Departments (Phase 2)

Represents a ministry or serving unit within the church.

Examples

- Choir
- Media
- Ushers
- Children's Ministry

Relationships

- Belongs to Church
- Has many Department Memberships

---

## DepartmentMembership (Phase 2)

Many-to-many join between People and Departments.

Contains

- `personId`
- `departmentId`
- `joinedAt`
- `role` (optional — e.g., "Head", "Member")

---

## PastoralCheckIn (Phase 2)

Ongoing pastoral care and audit history for members, workers, and leaders.

Contains

- `personId` (FK -> Person)
- `churchId` (FK -> Church)
- `createdById` (FK -> User)
- `assignedToId` (FK -> User, optional)
- `reason` (Enum: `ABSENTEEISM | ILLNESS | BEREAVEMENT | WORKER_WELFARE | DISCIPLESHIP | FAMILY_SUPPORT | GENERAL_CHECK_IN`)
- `status` (Enum: `SCHEDULED | COMPLETED | CANCELLED`)
- `scheduledFor` (DateTime, optional)
- `completedAt` (DateTime, optional)
- `notes` (Text, optional)
- `outcome` (Text, optional)

Relationships

- Belongs to Church
- Belongs to Person
- Created by User
- Optionally assigned to User

---


## Events

Represents a conference, service, retreat or meeting.

Relationships

- Belongs to Church
- Has many Registrations
- Has many Teams
- Has many Games

---

## Registrations

Connects a Person to an Event.

Contains

- registration number
- registration token
- assigned team

Relationships

- Belongs to Event
- Belongs to Person
- Belongs to Team
- Has one Attendance

---

## Teams

Belongs to an Event.

Example

- Blue
- Red
- Green
- Yellow

---

## Attendance

Represents event check-in.

Currently supports

- one attendance per registration

Designed for future expansion.

---

## Games

Belongs to Event.

Represents competitions.

---

## Scores

Stores team scores.

Belongs to

- Team
- Game

---

## BirthdayGreeting (channel per greeting)

`channel` (`EMAIL | WHATSAPP`, default `EMAIL`) was added. A person can have one greeting per year per channel: the unique key is `(personId, year, channel)`. `subject` is nullable because WhatsApp greetings have none.

---

## PersonRelationship (Phase 2)

Represents family and relational connections between two people within the same church.

| Field | Type | Purpose |
|---|---|---|
| `id` | String (UUID) | Primary key |
| `churchId` | String | Belongs to Church |
| `personId` | String | Source person describing the relationship |
| `relatedPersonId` | String | The target person linked to |
| `type` | `RelationshipType` | `SPOUSE \| PARENT \| CHILD \| SIBLING \| OTHER` |
| `note` | String? (100) | Optional free text (e.g., "cousin", "guardian" for `OTHER`) |
| `createdByPersonId` | String? | Member who created the relationship link, if member-created |
| `createdByUserId` | String? | Staff user who linked the individuals in Olive, if staff-created |
| `createdAt` | DateTime | When the link was established |

Relationships & Constraints:
- Belongs to Church (`onDelete: Cascade`)
- Belongs to Person (`personId`, `onDelete: Cascade`)
- Belongs to Related Person (`relatedPersonId`, `onDelete: Cascade`)
- Optionally tracks creator (`createdByPersonId`, `onDelete: SetNull`)
- Unique constraint: `@@unique([personId, relatedPersonId])`
- Each connection is stored once. Inverse relationship is computed at query time (`PARENT` <-> `CHILD`, `SPOUSE` and `SIBLING` remain symmetric, `OTHER` preserves its note).
- `onDelete: Cascade` ensures deleting a person removes only the relationship link row, never the related person.

---

## MessageTemplate (Phase 2)

Editable message text for staff outreach.

| Field | Type | Purpose |
|---|---|---|
| `channel` | `MessageChannel` | Defaults to `WHATSAPP` |
| `purpose` | `OutreachPurpose` | `BIRTHDAY \| VISITOR_FOLLOW_UP \| PASTORAL_CHECK_IN \| PROFILE_LINK` |
| `checkInReason` | `CheckInReason?` | Only for `PASTORAL_CHECK_IN`. Null suits any reason. |
| `name` | String | Shown in the template picker |
| `body` | Text | Up to 1,000 characters. Placeholders: `{{firstName}}`, `{{adminName}}`, `{{churchName}}`, `{{profileLink}}` |
| `isActive` | Boolean | Soft delete for templates already used in outreach |

Belongs to Church.

---

## OutreachMessage (Phase 2)

Log of WhatsApp messages staff open from Dove. `EmailSendLog` stays the log for email because it is keyed by Resend's id for bounce handling.

| Field | Type | Purpose |
|---|---|---|
| `purpose` | `OutreachPurpose` | Why the message was sent (`BIRTHDAY \| VISITOR_FOLLOW_UP \| PASTORAL_CHECK_IN \| PROFILE_LINK`) |
| `status` | `OutreachStatus` | `OPENED \| CONFIRMED_SENT \| NOT_SENT` |
| `toPhone` | String | E.164 number at the time of sending |
| `body` | Text | Final text, after any edits (for `PROFILE_LINK`, tokens are redacted to `[profile link]`) |
| `birthdayYear` | Int? | Set for birthday messages |
| `checkInId` | String? | Related pastoral check-in |
| `templateId` | String? | Template the text started from |
| `openedAt` / `confirmedAt` | DateTime | When the admin opened WhatsApp, and when they confirmed |

Belongs to Church, Person and User (sender); optionally to PastoralCheckIn and MessageTemplate.

---

# Future Tables (Phase 3+)

The following tables are not in Phase 1 or Phase 2 scope.
They are listed here to confirm the schema was designed with them in mind.

Giving / Offerings

Prayer Requests

Devotionals

Sermons

Service Attendance (distinct from event attendance)

Push Notification Logs

Audit Logs