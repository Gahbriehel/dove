export const OUTREACH_BODY_MAX_LENGTH = 1000;

/** A confirmed message within this many days raises CONTACTED_RECENTLY. */
export const RECENT_CONTACT_DAYS = 3;

/** An OPENED message older than this is treated as unconfirmed. */
export const UNCONFIRMED_AFTER_MINUTES = 15;

/** Visitors appear in the follow-up list once they are at least this old. */
export const VISITOR_FOLLOW_UP_MIN_AGE_DAYS = 2;

/** Visitors with a confirmed message this recently are left off the list. */
export const VISITOR_FOLLOW_UP_COOLDOWN_DAYS = 7;

export const TODAY_DEFAULT_LIMIT = 20;
export const TODAY_MAX_LIMIT = 100;

export const OutreachWarning = {
  NO_PHONE: 'NO_PHONE',
  INVALID_PHONE: 'INVALID_PHONE',
  WHATSAPP_OPT_OUT: 'WHATSAPP_OPT_OUT',
  NO_TEMPLATE: 'NO_TEMPLATE',
  ALREADY_GREETED_THIS_YEAR: 'ALREADY_GREETED_THIS_YEAR',
  CONTACTED_RECENTLY: 'CONTACTED_RECENTLY',
} as const;

export type OutreachWarningCode =
  (typeof OutreachWarning)[keyof typeof OutreachWarning];
