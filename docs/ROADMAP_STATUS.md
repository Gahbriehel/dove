# Roadmap Status Report

Status date: 2026-10-06  
Repository revision: `main`  
Phase 1 Status: **Completed & Verified**

## Executive Summary

Dove has reached full completion and verification for **Phase 1: Church Events Platform**. The Youth Conference workflow is implemented, verified, and hardened at the API, service, and persistence layers:

1. **Authentication & Profile**: Administrators authenticate via JWT with access and refresh tokens, refresh token rotation with UUID `jti` lookup, password management, and user active-status guards.
2. **Event Lifecycle & Capacity**: Administrators create and manage events with date validation, status transitions (`DRAFT`, `PUBLISHED`, `COMPLETED`, `CANCELLED`), capacity bounds, categories, highlights, and flyer image attachments.
3. **Public Registration**: Public participants register for events with automatic Person deduplication (by email/phone), balanced team distribution, unique registration code generation, and QR token generation.
4. **Attendance & Operational Desk Tooling**: Registration desk staff scan QR tokens to check in attendees, prevent duplicate check-ins, view searchable check-in logs (`GET /attendance`), export attendance records (`GET /attendance/export`), and safely undo accidental check-ins (`DELETE /attendance/:id`).
5. **Teams, Games & Leaderboard**: Coordinators configure teams and games (with `maxScore` rules), record and update scores, clear game scores, and view real-time public leaderboard rankings sorted descending by total score.
6. **Multi-Tenant / Church Isolation**: All sub-resources (events, people, registrations, attendance, teams, games, scores) enforce church ownership strictly via authenticated administrator context, conforming to ADR-005.
7. **Participant Data & CSV Exports**: Comprehensive streaming CSV export endpoints are implemented across registrations, people, attendance logs, teams, games, leaderboard, users, contact submissions, and email bounces.
8. **Unit Test Coverage**: Comprehensive unit test suites cover all core Phase 1 services (17 test suites, 138 passing unit tests).

---

## Evidence Snapshot

| Area | Current evidence |
|---|---|
| Application modules | 18 modules wired in `src/app.module.ts`, covering all Phase 1 domain requirements, email infrastructure, birthdays, and contact workflows. |
| Database | Prisma schema contains Church, User, Person, Event, Registration, Attendance, Team, Game, Score, EmailBounce, EmailSendLog, BirthdayGreeting, and ContactSubmission. |
| Tests | `npm test`: **17 suites passed, 138 tests passed**. |
| Type safety & Build | `npm run build`: **passed cleanly with zero errors**. |
| Tenant Isolation | Strict church boundary checks across Events, People, Registrations, Attendance, Teams, Games, and Scores. |
| Export | Full CSV export implemented across 9 core resources with UTF-8 BOM Excel compatibility. |

---

## Phase 1: Church Events Platform

### Phase 1 module matrix

| Roadmap module | Status | Implemented capabilities | Verification |
|---|---|---|---|
| **Authentication** | Completed | JWT login, access/refresh tokens, refresh token rotation with `jti` and legacy fallback, profile lookup, password change with bcrypt, active user validation, and church context. | Dedicated unit test suite (`src/auth/auth.service.spec.ts`) covering all success and error paths. |
| **Events** | Completed | Public published event listing/details, authenticated CRUD, status filtering, category, featured flags, date validation, capacity enforcement, flyer image URLs, and attendee counts. | Dedicated unit test suite (`src/events/events.service.spec.ts`) verifying CRUD, capacity constraints, and role-based status filtering. |
| **Registration** | Completed | Public `POST /api/v1/events/:id/register`, Person deduplication by email/phone, capacity enforcement, balanced team assignment, registration number format `reg[initials][hash]`, QR token generation, and confirmation email with Google Calendar/ICS. | Dedicated unit test suite (`src/registrations/registrations.service.spec.ts`) and CSV export. |
| **Teams** | Completed | Team CRUD, event association, membership counting, balanced distribution during registration, CSV export, and strict church ownership verification. | Dedicated unit test suite (`src/teams/teams.service.spec.ts`). |
| **QR Check-in** | Completed | Unique UUID QR tokens, data URL generation in registration details, PNG rendering endpoint at `/api/v1/qr/:token.png`, and authenticated check-in. | Unit tests in registration and attendance suites. |
| **Attendance & Tooling** | Completed | One-to-one Attendance persistence, staff user attribution, `CHECKED_IN` status transition, duplicate check-in rejection, check-in log listing (`GET /attendance`), CSV export (`GET /attendance/export`), and check-in reversal (`DELETE /attendance/:id`). | Dedicated unit test suite (`src/attendance/attendance.service.spec.ts`). |
| **Games** | Completed | Game CRUD, event association, max score validation, CSV export, and strict church ownership verification. | Dedicated unit test suite (`src/games/games.service.spec.ts`). |
| **Scores & Leaderboard** | Completed | Score record, score update with max score validation, game score clearing, public leaderboard aggregation sorted descending by points, team member counts, and leaderboard CSV export. | Dedicated unit test suite (`src/scores/scores.service.spec.ts`). |
| **People Database** | Completed | Person directory, membership status tracking (`VISITOR`, `MEMBER`, `WORKER`, `LEADER`), demographic aggregates (gender & membership counts), registration/attendance enrichment, and CSV export. | Dedicated unit test suite (`src/people/people.service.spec.ts`). |

---

## Phase 1 Success Criteria from `MVP_SCOPE.md`

| Success criterion | Status | Evidence |
|---|---|---|
| Create an event | **Met** | `POST /api/v1/events` with role protection and date/capacity validation. |
| Publish registration | **Met** | Public event reads and `POST /api/v1/events/:id/register`; published status enforced. |
| View registrations | **Met** | `GET /api/v1/registrations` and `GET /api/v1/registrations/:id`. |
| Assign teams | **Met** | Team CRUD plus automatic balanced assignment during registration. |
| Generate QR codes | **Met** | QR data URL in registration flows and PNG endpoint. |
| Check attendees in | **Met** | `POST /api/v1/attendance/checkin`; duplicate check-ins rejected. |
| Record game scores | **Met** | Score create/update/clear endpoints with event consistency and max-score validation. |
| Determine winning team | **Met** | Public leaderboard aggregates and sorts total score descending. |
| Export participant data | **Met** | Streaming CSV export endpoints across registrations, people, attendance, teams, games, and leaderboard (`docs/CSV_EXPORT_INTEGRATION.md`). |
| Every participant becomes a Person | **Met** | Registration transaction finds or creates a Person before creating Registration. |

---

## Phase 2: Church Relationship Platform (Future Scope)

Phase 2 capabilities are planned for subsequent iterations:
- Member Profiles enriched with department memberships and history
- Department Management CRUD and assignments
- Follow-up workflows and visitor tracking journeys
- Email Campaigns and scheduled broadcasts
- Recurring Weekly Attendance tracking