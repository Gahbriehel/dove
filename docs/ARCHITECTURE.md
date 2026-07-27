# Project Philosophy

This project is intentionally designed as a Church Events Platform that can evolve into a Church Management System.

Important Principles

- A Person is the central entity.

- Every event creates or enriches a Person.

- Registrations belong to People.

- People may later become Members.

- Members may later activate Accounts.

- Authentication belongs only to Admin users during MVP.

- Keep modules independent.

- Business logic belongs inside services.

- Controllers should be thin.

- Prisma should own all persistence logic.

- Never duplicate business rules.

- Prefer composition over inheritance.

- Every feature should be extensible without breaking the API.

Current MVP Goal

Successfully manage a Youth Conference.

Everything else belongs to future phases.


# Architecture Update: Resolve Phase 1 Church Ownership Blocker

Read the `/docs` directory before making any changes. Treat the documentation as the source of truth.

## Background

While implementing the Phase 1 backend, you identified a blocker:

* `people`, `events`, and `users` correctly require a `church_id`.
* However, the application currently seeds only Roles and the Super Admin.
* There is no Church record.
* There is no Church CRUD API.
* Therefore, creating People or Events is impossible because there is no valid `church_id`.

This observation is correct.

However, the proposed solution should **not** be to remove the `church_id` relationship or make it optional.

## Architectural Decision

Phase 1 is **not** a multi-tenant application.

Phase 1 is a **single-church deployment**.

The system is being built for one church (our church) and the Youth Conference is the first event that church will organize.

The `churches` table is **not** a future feature—it is part of the application's configuration.

Church CRUD and multi-church support are Phase 4 features.

## Required Changes

### 1. Seed a Default Church

Update the seed process to create one Church record before any other data.

Example:

* Church
* Roles
* Super Admin User

The Super Admin user should belong to this Church.

### 2. Associate Existing Data

Ensure all seeded Users belong to the seeded Church.

Future People and Events created through the API should also belong to this Church.

### 3. Keep Foreign Keys Required

Do **not**:

* Remove `church_id`
* Make `church_id` nullable
* Generate random church IDs
* Remove Church relationships from the schema

The relationship is intentional and should remain mandatory.

### 4. No Church CRUD

Do **not** build:

* Church Controller
* Church Service
* Church CRUD APIs
* Church Management UI

These belong to Phase 4.

The seeded Church acts as the application's owner during Phase 1.

### 5. Automatic Assignment

During Phase 1, the backend should automatically associate new resources with the seeded Church.

Examples:

* New Person → seeded Church
* New Event → seeded Church
* New User → seeded Church

No client request should need to provide `church_id`.

The authenticated admin already belongs to a church, and that ownership should be inferred by the backend.

## Important Design Principle

This project is intentionally designed to evolve into a Church Management Platform.

Every Person in the system belongs to a Church from the moment they first register.

A visitor who attends the Youth Conference may later become:

* Member
* Worker
* Leader

The same Person record will be retained throughout their lifecycle.

For this reason, every Person, Event, and User must always belong to a Church.

## Deliverables

Update:

* Prisma schema (if necessary)
* Seed script
* Services that currently require manual `church_id`
* API logic so ownership is inferred instead of supplied by the client

Do not modify any other architecture.

Do not introduce additional features.

The goal is only to resolve the ownership blocker while preserving the long-term architecture.
