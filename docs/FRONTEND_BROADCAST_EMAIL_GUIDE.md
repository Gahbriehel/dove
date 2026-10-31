# Broadcast Email Frontend Guide — People Batch Email & Unsubscribe

This guide covers the **Compose Email** screen for admins: sending one message to a filtered group of people via `POST /email/people/batch`, and how **unsubscribe** affects it.

**Roles**: `SUPER_ADMIN`, `ADMIN`, `COORDINATOR`. Auth, base URL and church context work as described in [FRONTEND_ADMIN_GUIDE.md](./FRONTEND_ADMIN_GUIDE.md#1-authentication--base-setup).

---

## 1. Endpoint

### `POST /email/people/batch`

Sends the same message to everyone matching the filters. People are skipped automatically when they have **no email address** or have **unsubscribed**.

#### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `subject` | `string` | Yes | Subject line. Supports placeholders. |
| `message` | `string` | Yes | Plain text (a blank line starts a new paragraph) **or** rich-text HTML from an editor like Quill. HTML is sanitized server-side. Supports placeholders. |
| `heading` | `string` | No | Banner title. Falls back to the subject. |
| `imageUrl` | `string` | No | Flyer image. Absolute URL, or a path such as `/public/uploads/x.jpg` (the server prefixes the app URL). |
| `ctaLabel` | `string` | No | Button text. Needs `ctaUrl` as well. |
| `ctaUrl` | `string` (URL) | No | Button link. Needs `ctaLabel` as well. |
| `personIds` | `UUID[]` | No | Only these people. |
| `membershipStatus` | `VISITOR \| MEMBER \| WORKER \| LEADER \| PASTOR` | No | Filter by status. |
| `search` | `string` | No | Matches first name, last name, email or phone. |

Filters combine (AND). With no filters, **every person in the church** is targeted.

The email always uses the styled layout. Recipients automatically get an **Unsubscribe link in the footer** and a one-click unsubscribe option in their mail app. The frontend sends nothing extra for this.

#### Placeholders

Use these in `subject`, `heading`, `message`, `ctaLabel` and `ctaUrl`:

`{{firstName}}`, `{{lastName}}`, `{{fullName}}`, `{{email}}`, `{{churchName}}`

An unknown placeholder is left as typed, for example `{{foo}}`, so validate in the UI.

#### Example

```http
POST /api/v1/email/people/batch
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "subject": "Join Us for Our November Thanksgiving Service",
  "heading": "Come Let Us Give Thanks to the Lord!",
  "message": "<p>Dear {{firstName}},</p><p>Join us this Sunday...</p>",
  "membershipStatus": "MEMBER"
}
```

#### Response `200 OK`

```json
{
  "success": true,
  "message": "Batch email sent to people successfully",
  "data": {
    "message": "Batch email processing completed. 116 sent successfully out of 118 valid recipients. 2 skipped (unsubscribed).",
    "results": {
      "totalTargeted": 118,
      "totalWithEmail": 118,
      "totalSent": 116,
      "totalFailed": 2,
      "totalOptedOut": 2,
      "failedRecipients": [
        { "recipient": "bad@example.com", "reason": "Error sending to recipient" }
      ]
    }
  },
  "timestamp": "2026-10-31T17:05:45.000Z"
}
```

| Field | Meaning |
|---|---|
| `totalTargeted` | People who actually went into the send (after skipping no-email and unsubscribed people) |
| `totalWithEmail` | Of those, people with a usable email address |
| `totalSent` / `totalFailed` | Accepted by the mail provider / rejected |
| `totalOptedOut` | People skipped because they unsubscribed. **Present only when greater than 0.** |
| `failedRecipients` | Per-recipient failure reasons |

`totalSent` means **accepted for delivery**, not delivered. Later bounces appear in the email logs and bounce analytics.

#### Errors

| Status | When |
|---|---|
| `400` | Validation failed (empty `subject` or `message`, invalid `ctaUrl`, bad UUID) **or** no people match the filters |
| `401` / `403` | Missing token / role not allowed |

---

## 2. Unsubscribe

### What recipients see

- A small **"Unsubscribe"** link at the bottom of every broadcast email.
- Gmail and Yahoo also show their own **Unsubscribe** button next to the sender name. It works in one click and needs no page.
- Clicking the footer link opens a simple page served by the API: *"Unsubscribe from {church} emails?"* with a button. After confirming, they see *"You have been unsubscribed."*

No frontend work is needed for these pages. They are server-rendered by the API.

### What it affects

| Email | Affected by unsubscribe? |
|---|---|
| Broadcast to people (`POST /email/people/batch`) | **Yes**. Unsubscribed people are skipped. |
| Registration confirmations, check-in passes, admin welcome, birthday greetings, single sends, registrant emails | **No**. They are unchanged. |

### Person fields

Person objects returned by the people endpoints now include:

| Field | Type | Meaning |
|---|---|---|
| `emailOptOut` | `boolean` | `true` if the person unsubscribed from broadcasts |
| `emailOptOutAt` | `string \| null` | ISO timestamp of when they unsubscribed |

### Suggested UI

- **People list / profile**: show an **"Unsubscribed"** badge when `emailOptOut` is `true`, with the date as a tooltip.
- **Compose screen**: when the admin picks a recipient group, add a note such as *"People who have unsubscribed will be skipped."*
- **After sending**: if `results.totalOptedOut` is present, show it, for example *"2 people were skipped because they unsubscribed."*

### Not available yet

- **There is no way for an admin to re-subscribe someone.** `emailOptOut` is not editable through `PATCH /people/:id`. Don't show a toggle for it. If the church needs this, the backend needs a small addition first.
- **Unsubscribe applies per person, across all broadcast emails.** There are no topic preferences.

---

## 3. Uploading a flyer (optional)

Upload first, then pass the returned URL as `imageUrl`.

### `POST /uploads/image`

`multipart/form-data` with a single `file` field. JPEG, PNG or WEBP, **max 3 MB**.

```json
{ "success": true, "message": "Image uploaded successfully", "data": { "url": "https://api.abwog.org/public/uploads/1793466239836-4607516.jpg" } }
```

Validate size and type in the browser before uploading, because the server rejects anything else with `400`.

---

## 4. Suggested compose UI

1. **Recipients**: membership status dropdown, search box, or a multi-select of people. Show a live count by calling `GET /people` with the same filters and reading `meta.total`. That count includes people with no email address and people who have unsubscribed, so the number actually sent can be lower.
2. **Subject** and **Heading** inputs.
3. **Message** editor. Rich text is fine (see the pitfall below about pasting).
4. **Flyer** upload, and **CTA** label and URL (optional).
5. **Preview** and **Send**.

**Confirm before sending.** This is a bulk, irreversible action. Show a dialog with the recipient count: *"Send to about 120 people?"*. Disable the Send button while the request is in flight to avoid double sends.

**After sending**, show `data.message`. If `totalFailed > 0`, offer an expandable list from `failedRecipients`.

---

## 5. Pitfalls

- **Pasting from Word, Google Docs or websites** can insert non-breaking spaces (`&nbsp;`) between every word. The email then renders text that cannot wrap, which hurts mobile reading. Strip them client-side on paste, or paste as plain text.
- **`ctaLabel` without `ctaUrl` (or the reverse)** renders no CTA at all.
- **Placeholders are not validated.** A typo such as `{{firstname}}` is sent as-is to every recipient. Suggest the supported tokens in the editor.
- **Duplicate sends**: there is no server-side idempotency. Guard the Send button.
- **Large audiences**: the server sends in batches of 60. The request can take several seconds for hundreds of recipients, so show a progress state and use a generous client timeout.
- **Inbox placement**: Gmail may still file bulk mail under *Promotions* at first. It improves as recipients engage with mail from the church. Asking members to add the sender to their contacts helps.

---

## 6. TypeScript types

```ts
export type MembershipStatus = 'VISITOR' | 'MEMBER' | 'WORKER' | 'LEADER' | 'PASTOR';

export interface SendBatchPeopleEmailRequest {
  subject: string;
  message: string;
  heading?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  personIds?: string[];
  membershipStatus?: MembershipStatus;
  search?: string;
}

export interface BatchEmailResults {
  totalTargeted: number;
  totalWithEmail: number;
  totalSent: number;
  totalFailed: number;
  /** Present only when at least one person was skipped for having unsubscribed. */
  totalOptedOut?: number;
  failedRecipients: Array<{ recipient: string; reason: string }>;
}

export interface SendBatchPeopleEmailResponse {
  success: boolean;
  message: string;
  data: { message: string; results: BatchEmailResults };
  timestamp: string;
}

// Added to the Person object returned by the people endpoints
export interface PersonEmailPreferences {
  emailOptOut: boolean;
  emailOptOutAt: string | null;
}
```
