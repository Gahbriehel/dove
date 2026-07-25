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

Represents a church using the platform.

Relationships

- One Church has many Users
- One Church has many People
- One Church has many Events

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

Future Relationships

- Departments
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