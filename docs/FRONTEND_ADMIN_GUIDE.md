# Admin Frontend Integration Guide — Church Relationship Platform (Phase 2)

This guide covers all API integrations needed for the **Admin Dashboard** (`SUPER_ADMIN`, `ADMIN`, `COORDINATOR`) to manage people, membership promotions, department rosters, and visitor follow-ups.

---

## 1. Authentication & Base Setup

All Admin endpoints require a valid JWT bearer token in the `Authorization` header:

```http
Authorization: Bearer <accessToken>
```

- **Base URL**: `https://api.abwog.org/api/v1` (or `http://localhost:3000/api/v1` in dev)
- **Automatic Church Context**: The backend automatically infers `churchId` from the authenticated admin. You do **not** need to include `churchId` in request bodies.

---

## 2. People & Visitor Directory

### `GET /people`
Fetches a paginated, filterable list of congregation members and visitors with demographic and membership statistics.

#### Query Parameters
| Parameter | Type | Description |
|---|---|---|
| `search` | `string` | Search first name, last name, email, or phone |
| `membershipStatus` | `string` | `VISITOR`, `MEMBER`, `WORKER`, `LEADER`, `PASTOR` |
| `departmentId` | `UUID` | Filter people belonging to a specific department |
| `followUpStatus` | `string` | Filter visitor follow-up: `PENDING`, `IN_PROGRESS`, `CONVERTED`, `INACTIVE` (non-visitors have `null`) |
| `gender` | `string` | `MALE`, `FEMALE`, `OTHER` |
| `page` | `number` | Default: `1` |
| `limit` | `number` | Default: `10` (Max: `100`) |

#### Example Response
```json
{
  "items": [
    {
      "id": "6a96bc8e-d98c-4573-9a3b-28f0fb26e031",
      "firstName": "Emmanuel",
      "lastName": "Adeyemi",
      "email": "emmanuel@example.com",
      "phone": "+2348012345678",
      "gender": "MALE",
      "membershipStatus": "WORKER",
      "dateOfBirth": "1994-06-15T00:00:00.000Z",
      "address": "12 Faith Ave, Lagos",
      "followUpStatus": "CONVERTED",
      "followUpNotes": "Joined Choir after youth convention",
      "lastFollowUpAt": "2026-10-10T14:30:00.000Z",
      "eventsRegisteredCount": 3,
      "eventsAttendedCount": 3,
      "departments": [
        {
          "id": "3b21658e-0bdf-4993-9c88-1fa99787b411",
          "name": "Choir",
          "description": "Music & worship ministry",
          "role": "Member",
          "joinedAt": "2026-10-10T14:30:00.000Z"
        }
      ],
      "createdAt": "2026-08-01T12:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "stats": {
    "total": 120,
    "membership": {
      "visitors": 30,
      "members": 50,
      "workers": 25,
      "leaders": 10,
      "pastors": 5
    },
    "gender": {
      "male": 55,
      "female": 60,
      "other": 0,
      "unspecified": 5
    }
  }
}
```

---

### `GET /people/:id`
Retrieves a single person's full profile, assigned departments, and event history.

```json
{
  "id": "6a96bc8e-d98c-4573-9a3b-28f0fb26e031",
  "firstName": "Emmanuel",
  "lastName": "Adeyemi",
  "email": "emmanuel@example.com",
  "phone": "+2348012345678",
  "gender": "MALE",
  "membershipStatus": "WORKER",
  "dateOfBirth": "1994-06-15T00:00:00.000Z",
  "address": "12 Faith Ave, Lagos",
  "followUpStatus": "CONVERTED",
  "followUpNotes": "Joined Choir after youth convention",
  "lastFollowUpAt": "2026-10-10T14:30:00.000Z",
  "eventsRegisteredCount": 3,
  "eventsAttendedCount": 3,
  "departments": [
    {
      "id": "3b21658e-0bdf-4993-9c88-1fa99787b411",
      "name": "Choir",
      "description": "Music ministry",
      "role": "Member",
      "joinedAt": "2026-10-10T14:30:00.000Z"
    }
  ]
}
```

---

### `PATCH /people/:id`
Admin update for personal details, pastoral follow-up notes, and status overrides.

#### Request Body
```json
{
  "firstName": "Emmanuel",
  "lastName": "Adeyemi",
  "email": "emmanuel.ade@example.com",
  "phone": "+2348012345678",
  "gender": "MALE",
  "membershipStatus": "WORKER",
  "followUpStatus": "CONVERTED",
  "followUpNotes": "Spoke with Pastor. Fully engaged in ministry.",
  "lastFollowUpAt": "2026-10-19T10:00:00.000Z"
}
```

---

## 3. Membership Promotion Workflow

Admins can promote a person up the membership hierarchy using a dedicated, guarded endpoint.

### `POST /people/:id/promote`
Requires: `SUPER_ADMIN` or `ADMIN`.

#### Hierarchy Progression
$$\text{VISITOR} \longrightarrow \text{MEMBER} \longrightarrow \text{WORKER} \longrightarrow \text{LEADER} \longrightarrow \text{PASTOR}$$

#### Request Body
```json
{
  "membershipStatus": "MEMBER"
}
```

#### Enforced Business Rules
1. **Profile Completeness Guard**: The person **must** have at least an email address or a phone number. Returns `400 Bad Request` if neither is present.
2. **Upward-Only Progression**: The promote endpoint only allows upward movement (e.g. `VISITOR` to `MEMBER`). Demotions or duplicate assignments return `400 Bad Request`.
3. **Automatic Follow-up Conversion**: If the person's `followUpStatus` is currently `PENDING` or `IN_PROGRESS`, promoting them automatically updates `followUpStatus` to `CONVERTED`.

#### UI Component Suggestions
- In the Person Details view, provide a **"Promote Person"** button with a status dropdown.
- Disable the promotion option if the person lacks both email and phone, showing a tooltip: *"Add an email or phone number before promoting."*

---

## 4. Department Management (CRUD & Moderation)

The admin team can create ministries/departments, view member rosters, assign members, and remove anyone who erroneously assigned themselves.

### Endpoints Overview

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/departments` | `SUPER_ADMIN`, `ADMIN` | Create a new department |
| `GET` | `/departments` | `SUPER_ADMIN`, `ADMIN`, `COORDINATOR` | List all departments + member counts |
| `GET` | `/departments/:id` | `SUPER_ADMIN`, `ADMIN`, `COORDINATOR` | Get department details & member roster |
| `PATCH` | `/departments/:id` | `SUPER_ADMIN`, `ADMIN` | Update department name/description |
| `DELETE` | `/departments/:id` | `SUPER_ADMIN`, `ADMIN` | Delete department |
| `POST` | `/departments/:id/members` | `SUPER_ADMIN`, `ADMIN` | Assign person to department |
| `DELETE` | `/departments/:id/members/:personId` | `SUPER_ADMIN`, `ADMIN` | Remove person from department |

---

### `POST /departments`
Creates a department.
```json
// POST /departments
{
  "name": "Media & Tech",
  "description": "Sound engineering, livestreaming, and projection team"
}
```

---

### `GET /departments/:id` (Department Roster)
Returns department details and the roster of active members.

```json
{
  "id": "3b21658e-0bdf-4993-9c88-1fa99787b411",
  "name": "Media & Tech",
  "description": "Sound engineering, livestreaming, and projection team",
  "members": [
    {
      "id": "membership-uuid-1",
      "role": "Lead",
      "joinedAt": "2026-09-01T10:00:00.000Z",
      "person": {
        "id": "person-uuid-1",
        "firstName": "Samuel",
        "lastName": "Okon",
        "email": "samuel@example.com",
        "phone": "+2348000000001",
        "membershipStatus": "LEADER"
      }
    },
    {
      "id": "membership-uuid-2",
      "role": "Member",
      "joinedAt": "2026-10-01T12:00:00.000Z",
      "person": {
        "id": "person-uuid-2",
        "firstName": "Blessing",
        "lastName": "John",
        "email": "blessing@example.com",
        "phone": "+2348000000002",
        "membershipStatus": "WORKER"
      }
    }
  ],
  "_count": {
    "members": 2
  }
}
```

---

### Moderating Roster: `DELETE /departments/:id/members/:personId`
If someone claims `WORKER` and selects `Media & Tech` by mistake during self-service onboarding, the admin can remove them with one click:

```http
DELETE /departments/3b21658e-0bdf-4993-9c88-1fa99787b411/members/person-uuid-2
```
**Response (`200 OK`)**:
```json
{
  "message": "Person removed from department successfully"
}
```

---

### Manually Adding a Member: `POST /departments/:id/members`
Assigns a person to a department with an optional leadership or service role.

```json
// POST /departments/:id/members
{
  "personId": "person-uuid-3",
  "role": "Assistant Lead"
}
```

---

## 5. Visitor Tracking & Follow-up Workflow

Follow-up tracking is designed specifically for the **visitor lifecycle** — guiding new guests from first contact until they transition into active members.

### Key Business Rules & Status Behaviors
1. **Visitor-Exclusive Default**: When a `VISITOR` is registered or created, `followUpStatus` defaults to `PENDING`.
2. **Non-Visitors Are Excluded**: Non-visitors (`MEMBER`, `WORKER`, `LEADER`, `PASTOR`) have `followUpStatus: null` by default. They do not appear in the pending visitor follow-up queue.
3. **Automatic Conversion on Promotion**: When a visitor with `PENDING` or `IN_PROGRESS` is promoted via `POST /people/:id/promote`, their `followUpStatus` automatically updates to `CONVERTED`.
4. **Manual Role Updates**: If an admin changes a person's `membershipStatus` away from `VISITOR` via `PATCH /people/:id`, any lingering `PENDING` follow-up status is cleared to `null`.
5. **Single-State Storage on DB**: At the database level, `followUpStatus`, `followUpNotes`, and `lastFollowUpAt` reflect the latest touchpoint. To record multiple follow-up attempts, append date-stamped notes to the `followUpNotes` text.

### Frontend Integration & Views

#### 1. Filter Tabs in People Directory
Add status filter tabs or dropdowns in the People management interface:
* **All Visitors**: `GET /people?membershipStatus=VISITOR`
* **Pending Contact**: `GET /people?followUpStatus=PENDING` (returns visitors awaiting their first contact)
* **In Progress**: `GET /people?membershipStatus=VISITOR&followUpStatus=IN_PROGRESS`
* **Converted (Now Members)**: `GET /people?followUpStatus=CONVERTED`

#### 2. Follow-up Drawer / Modal
When an admin calls, messages, or meets a visitor, submit updates via `PATCH /people/:id`:
```json
{
  "followUpStatus": "IN_PROGRESS",
  "followUpNotes": "2026-10-15: Left voicemail.\n2026-10-19: Spoke with John. Welcomed to church, planning to attend Sunday service.",
  "lastFollowUpAt": "2026-10-19T16:30:00.000Z"
}
```

#### 3. Recommended Status Badges
| Status | Badge Color | Label | Notes |
|---|---|---|---|
| `PENDING` | Amber / Yellow | Needs Contact | Default for new visitors |
| `IN_PROGRESS` | Blue | In Contact | Active outreach underway |
| `CONVERTED` | Green | Converted | Successfully joined church family |
| `INACTIVE` | Gray | Inactive | Decided not to join / stopped attending |
| `null` | — | None | Non-visitors (members, workers, pastors) |

