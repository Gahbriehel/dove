# Entity Relationship Design (Phase 1)

## Purpose

This document defines the database structure for Phase 1 (Church Events Platform).

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

Future Relationships (Phase 2+)

- Departments & Department Memberships (People belong to one or more Departments; returned in GET /people and profile endpoints)
- Giving
- Attendance
- Small Groups

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

# Future Tables (Not MVP)

Accounts

Departments

Department Members

Prayer Requests

Messages

Devotionals

Offerings

Service Attendance

Notifications

Audit Logs