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
| `followUpNotes` | String? | Free text notes from the pastoral/follow-up team |
| `lastFollowUpAt` | DateTime? | When the person was last contacted |
| `followUpStatus` | Enum? | `PENDING \| IN_PROGRESS \| CONVERTED \| INACTIVE` (defaults to PENDING for visitors, null for non-visitors) |

The `profileToken` pattern mirrors `Registration.token` — already proven in Phase 1.

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