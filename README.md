# Dove

> **Church Events Platform** — A backend API for managing church events, attendee registration, teams, games, and leaderboards.

Built with [NestJS](https://nestjs.com/), [Prisma](https://www.prisma.io/), and [MySQL](https://www.mysql.com/).

---

## Overview

Dove is Phase 1 of a long-term Church Management System. Its immediate goal is to provide a production-ready platform to manage a **Youth Conference** — from event creation and public registration through to QR code check-in, team assignment, game scoring, and leaderboard tracking.

Every attendee who passes through the system becomes a **Person** record that persists beyond the event and can evolve into a Member, Worker, or Leader over time.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | NestJS 11 |
| Language | TypeScript |
| ORM | Prisma 6 |
| Database | MySQL 8 |
| Auth | JWT (Access + Refresh tokens) |
| Validation | class-validator / class-transformer |
| Docs | Swagger / OpenAPI |
| Package manager | Yarn / Bun |
| Code quality | ESLint, Prettier, Husky pre-commit hooks |

---

## Domain Model

```
Church
 ├── Users           (admin accounts — auth only)
 ├── People          (attendees / congregation members)
 └── Events
      ├── Registrations  →  Person + Team + Attendance
      ├── Teams
      └── Games
           └── Scores  →  Team
```

### Enums

| Enum | Values |
|---|---|
| `MembershipStatus` | `VISITOR`, `MEMBER`, `WORKER`, `LEADER` |
| `EventStatus` | `DRAFT`, `PUBLISHED`, `COMPLETED`, `CANCELLED` |
| `RegistrationStatus` | `PENDING`, `CONFIRMED`, `CHECKED_IN`, `CANCELLED` |
| `Gender` | `MALE`, `FEMALE`, `OTHER` |

---

## Modules

| Module | Description |
|---|---|
| `auth` | JWT login, refresh token rotation, logout |
| `users` | Admin user management |
| `people` | Attendee / congregation people database |
| `events` | Event lifecycle management |
| `teams` | Team creation and assignment |
| `games` | Game definition and score recording |
| `roles` | RBAC role management |
| `prisma` | Shared Prisma service |
| `config` | Environment configuration |
| `common` | Guards, decorators, interceptors, filters |

---

## Roles & Permissions

| Role | Capabilities |
|---|---|
| **Super Admin** | Everything |
| **Registration Desk** | View/register/check-in attendees |
| **Games Coordinator** | View attendees & teams, record scores |

---

## Prerequisites

- Node.js 20+
- MySQL 8 (or a Docker container)
- Yarn or Bun

---

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd dove
yarn install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="mysql://<DB_USER>:<DB_PASSWORD>@localhost:3306/church_events"

JWT_SECRET="<your-jwt-secret>"
JWT_EXPIRES_IN="1d"
JWT_REFRESH_SECRET="<your-jwt-refresh-secret>"
JWT_REFRESH_EXPIRES_IN="7d"

SUPER_ADMIN_EMAIL="<super-admin-email>"
SUPER_ADMIN_PASSWORD="<super-admin-password>"
```

### 3. Run the database (Docker)

```bash
docker run --name dove-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=church_events \
  -p 3306:3306 \
  -d mysql:8
```

### 4. Apply migrations and seed

```bash
# Run all pending migrations
yarn db:migrate

# Seed: Church → Roles → Super Admin
yarn db:seed
```

### 5. Start the development server

```bash
yarn start:dev
```

The API will be available at `http://localhost:3000`.  
Swagger docs: `http://localhost:3000/api`

---

## Scripts

### Application

```bash
yarn start           # Production start
yarn start:dev       # Watch mode (development)
yarn start:prod      # Run compiled dist
yarn build           # Compile TypeScript
```

### Database

```bash
yarn db:migrate      # Run migrations (dev)
yarn db:deploy       # Run migrations (production)
yarn db:generate     # Regenerate Prisma client
yarn db:seed         # Seed initial data
yarn db:studio       # Open Prisma Studio
```

### Code Quality

```bash
yarn format          # Auto-format with Prettier
yarn check-format    # Check formatting (CI)
yarn lint            # Auto-fix lint errors
yarn check-lint      # Check lint (CI)
yarn check-types     # TypeScript type check
yarn check-all       # Format + lint + types (all at once)
```

### Testing

```bash
yarn test            # Unit tests
yarn test:watch      # Watch mode
yarn test:cov        # With coverage
yarn test:e2e        # End-to-end tests
```

---

## Pre-commit Hooks

Husky enforces the following checks on every commit:

1. ✅ Prettier format check
2. ✅ ESLint lint check
3. ✅ TypeScript type check
4. ✅ Unit tests
5. ✅ Production build

A commit is blocked if any of the above fail.

---

## Architecture Principles

- **Thin controllers** — business logic lives in services only
- **Prisma owns persistence** — no raw SQL, no repository wrappers
- **Church context is inferred** — authenticated users carry their `churchId`; clients never supply it
- **Single-church deployment** — Phase 1 is not multi-tenant; the seeded Church is the application owner
- **Person is the central entity** — every event interaction creates or enriches a Person record

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for full design rationale.

---

## Roadmap

| Phase | Focus |
|---|---|
| **Phase 1** (now) | Church Events Platform — manage Youth Conference |
| **Phase 2** | Church Relationship Platform — member profiles, departments, follow-up |
| **Phase 3** | Church Lifestyle Platform — mobile app, giving, sermons, devotional |
| **Phase 4** | Church Operating System — multi-church, finance, analytics |

See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for details.

---

## Documentation

| File | Description |
|---|---|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Design philosophy and architectural decisions |
| [`docs/ERD.md`](./docs/ERD.md) | Entity relationship diagram |
| [`docs/MVP_SCOPE.md`](./docs/MVP_SCOPE.md) | What's in and out of scope for Phase 1 |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Phase-by-phase product roadmap |
| [`docs/PERMISSIONS.Md`](./docs/PERMISSIONS.Md) | Role-based access control reference |
| [`docs/CODING_STANDARDS.md`](./docs/CODING_STANDARDS.md) | Code conventions and standards |
| [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) | API contract and versioning policy |
| [`docs/DECISIONS.md`](./docs/DECISIONS.md) | Architecture decision records (ADRs) |

---

## License

Private — All rights reserved.
