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