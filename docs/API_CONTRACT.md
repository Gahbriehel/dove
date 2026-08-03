# API Contract

Version

v1

Base URL

/api/v1

---

# Authentication

POST /auth/login

Returns

- access token
- refresh token
- user profile

---

GET /auth/profile

Returns authenticated user.

---

# Events

GET /events

List published events.

---

GET /events/:id

Single event.

---

POST /events

Create event.

Admin only.

---

PATCH /events/:id

Update event.

---

DELETE /events/:id

Delete event.

---

# Registration

POST /events/:id/register

Public endpoint.

Flow

- Find existing Person
- Create Person if necessary
- Create Registration
- Assign Team
- Generate QR
- Return confirmation

---

GET /registrations

Admin only.

---

GET /registrations/:id

Admin only.

---

# Attendance

POST /attendance/checkin

Input

QR Token

Returns

Attendee

Team

Attendance status

---

# Teams

GET /events/:id/teams

POST /teams/assign

PATCH /teams/:id

---

# Games

POST /games

PATCH /games/:id

GET /games/:id

---

# Scores

POST /scores

Record score for a team in a game. Returns 409 Conflict if a score already exists for the team in that game (use PATCH to update).

PATCH /scores/:id

Update points, notes, or game/team assignment of an existing score record.

DELETE /scores/game/:gameId

Clear all score records associated with a specific game.

GET /leaderboard/:eventId

Returns teams sorted by total points.

---

# People

GET /people

Admin only. Lists all people records enriched with registration history, attendance history, `eventsRegisteredCount`, and `eventsAttendedCount`. (Phase 2 will add department memberships).

GET /people/:id

Admin only. Retrieves single person details with complete event registration and attendance history.

---

# Users

POST /users

Super Admin only. Creates a new admin user and automatically dispatches a welcome email containing their initial login credentials (plain-text temporary password) with instructions to change password upon initial login.

---

# Phase 2 Upcoming API Extensions (Preview)

- GET /departments & GET /departments/:id
- People & Profile endpoints (GET /people, GET /auth/profile) will include assigned `departments` array for administrative & member UI views.