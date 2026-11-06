# Scripture of the Week and Scripture of the Year: Admin Implementation Guide (Olive)

This guide covers the implementation of the **Scripture** management screens in Olive (`apps/admin`), backed by Dove's `/api/v1/scriptures` API.

**Access Level:** `ADMIN` and `SUPER_ADMIN` only (`COORDINATOR` and members cannot access or modify scriptures).

---

## 1. Overview & Architecture

Scriptures are short, inspiring passages displayed prominently at the top of the member PWA home page under a **This week** / **This year** switch.

### Key Rules
- **Kinds:** `WEEK` and `YEAR`. Both kinds share the exact same fields, screens, and data shape.
- **Audit & History:** Scriptures are never overwritten. Staff create new records for new cycles, retaining a complete audit log of past scriptures.
- **What is "Current":** The latest published record of that kind whose `startsOn` calendar date is today or earlier (in church timezone `Africa/Lagos`).
- **Tie Breaking:** When multiple records have the same `startsOn`, the newest by `createdAt` wins.
- **Public Access:** `GET /api/v1/scriptures/current` is public (cached for 60 seconds with `Cache-Control: public, max-age=60`).
- **Null Safety:** When no eligible record exists for a kind, `data.week` or `data.year` is `null` (not an error). The member PWA hides the tab, or the entire card if both are `null`.

---

## 2. API Endpoints Reference

Base URL: `/api/v1/scriptures`  
Admin Header: `Authorization: Bearer <staff_jwt>`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/scriptures/current?churchId={id}` | Public | Returns current `{ week, year }` scriptures (or null) |
| `GET` | `/scriptures?kind={WEEK\|YEAR}&status={DRAFT\|PUBLISHED}&page=1&limit=20` | Admin | List scriptures with pagination and `isCurrent` boolean |
| `POST` | `/scriptures` | Admin | Create scripture (church inferred from token) |
| `PATCH` | `/scriptures/:id` | Admin | Update scripture fields (except `kind`) |
| `DELETE` | `/scriptures/:id` | Admin | Hard delete a scripture record |

---

## 3. Data Shapes & TypeScript Interfaces

### Public Response Shape (`GET /scriptures/current`)

```typescript
export interface PublicScripture {
  id: string;
  kind: 'WEEK' | 'YEAR';
  text: string;           // Plain text (no HTML or Markdown; quotes are applied by the UI)
  reference: string;      // e.g. "Exodus 33:19"
  translation: string | null; // e.g. "NKJV"
  givenBy: string | null; // e.g. "Rev. Deji Olabode"
  startsOn: string;       // "YYYY-MM-DD" in Africa/Lagos
}

export interface CurrentScripturesResponse {
  success: boolean;
  message: string;
  data: {
    week: PublicScripture | null;
    year: PublicScripture | null;
  };
  timestamp: string;
}
```

### Admin Item Shape (`GET /scriptures`)

```typescript
export type ScriptureStatus = 'DRAFT' | 'PUBLISHED';

export interface AdminScriptureItem extends PublicScripture {
  status: ScriptureStatus;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;     // true if GET /scriptures/current returns this record
}

export interface ScriptureListResponse {
  success: boolean;
  message: string;
  data: {
    items: AdminScriptureItem[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
  timestamp: string;
}
```

---

## 4. Olive Screen Specification

### 4.1 Navigation & Placement
- Add a new menu item **Scripture** in Olive's left sidebar, positioned directly next to **Confessions**.
- Restricted to users with `ADMIN` or `SUPER_ADMIN` roles.

### 4.2 Tab Layout
Two main tabs matching the member PWA:
1. **This week** (`kind=WEEK`)
2. **This year** (`kind=YEAR`)

Each tab groups items retrieved from `GET /scriptures?kind=...` into three sections:
1. **Live now:** The single card where `isCurrent === true`.
2. **Scheduled:** Records with `status === 'PUBLISHED'` and `startsOn > today(Africa/Lagos)`.
3. **Past / Drafts:** Past records (`startsOn <= today` and not current) as well as drafts.

### 4.3 Empty States
If a tab has no records:
- **This week:** *"Nothing is showing for this week yet. Members won't see a scripture until you add one."*
- **This year:** *"Nothing is showing for this year yet. Members won't see a scripture until you add one."*
- CTA button: **Add Scripture**.

### 4.4 Add / Edit Form
- **Kind:** Locked to the active tab (`WEEK` or `YEAR`). Note: once created, `kind` cannot be changed via `PATCH`.
- **Text:** Multi-line text area, 1–1500 characters. Line endings are normalized to `\n` by Dove. Plain text only (do not wrap in quotes; preview displays them).
- **Reference:** Text input, 1–100 characters (e.g. `Exodus 33:19`).
- **Translation:** Text input (max 20 characters). Defaults to `"NKJV"` and remembered in `localStorage` across entries. Empty string is saved as `null`.
- **Given By:** Text input (max 100 characters, optional). Minister who gave the word (e.g. `Rev. Deji Olabode`).
- **Starts On:** Date picker formatted as `YYYY-MM-DD`.
  - For **This year**: Defaults to today's date in `Africa/Lagos`.
  - For **This week**: Defaults to the coming Monday in `Africa/Lagos` (or today if today is Monday).
- **Status:** Toggle between `Draft` (`DRAFT`) and `Published` (`PUBLISHED`).

### 4.5 Live Preview
Display a side-by-side or stacked card preview matching the member PWA style:
- Soft background container with subtle border and rounded corners.
- Scripture text wrapped in quotation marks.
- Reference and translation (e.g. `Exodus 33:19 (NKJV)`).
- `givenBy` line underneath the reference when present.

### 4.6 Publishing Warnings
- When saving/publishing a record whose `startsOn` is today or earlier (`startsOn <= today(Africa/Lagos)`):
  - Show a modal or inline warning:
    > *"Publishing this will immediately replace the live scripture for [This week / This year]. Live scripture '[Reference]' will no longer be current."*
  - Requires explicit confirmation to proceed.

### 4.7 Delete Confirmation
- Action button on each row/card.
- Confirmation modal stating:
  > *"Are you sure you want to delete this scripture? This action cannot be undone."*
- If deleting a record where `isCurrent === true`:
  > *"Warning: This is the live scripture currently displayed to members. Deleting it will restore the previous published scripture as live."*
