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

GET /leaderboard/:eventId

Returns

Teams sorted by total points.