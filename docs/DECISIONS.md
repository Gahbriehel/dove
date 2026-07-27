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