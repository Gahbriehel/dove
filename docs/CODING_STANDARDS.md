# Coding Standards

## General

Write production-quality code.

Avoid placeholders.

Avoid TODO comments unless explicitly requested.

Prefer readability over cleverness.

---

## Architecture

Follow NestJS best practices.

Controllers

- Thin
- No business logic

Services

- Own business rules

Prisma

- Own persistence

DTOs

- Validate all input

Guards

- Authentication
- Authorization

---

## Naming

Classes

PascalCase

Variables

camelCase

Enums

PascalCase

Database

snake_case

API

kebab-case

---

## Error Handling

Throw proper NestJS exceptions.

Never return raw errors.

Use descriptive messages.

---

## Validation

Always validate request payloads.

Never trust client input.

---

## Database

Use Prisma Migrations.

Never modify generated migration files manually unless necessary.

Prefer relations over duplicated fields.

Index frequently queried columns.

---

## API

Return consistent responses.

Avoid deeply nested payloads.

Use pagination where appropriate.

---

## Security

Hash passwords using bcrypt.

Never expose password hashes.

Never expose internal IDs when a public token exists.

Validate JWTs.

Use role-based authorization.

---

## Testing

Every service should be independently testable.

Business logic should not depend on controllers.

---

## Documentation

Update Swagger whenever endpoints change.

Keep README and architecture documents in sync with implementation.

---

## Project Principle

A Person is the core entity.

Everything else extends the lifecycle of a Person.