export const PRAYER_CATEGORIES = [
  'Healing & Health',
  'Family & Marriage',
  'Financial Breakthrough',
  'Spiritual Growth',
  'General Prayer',
] as const;

export type PrayerCategory = (typeof PRAYER_CATEGORIES)[number];

export const INQUIRY_CATEGORIES = [
  'Directions',
  'Partnership & Giving',
  'Pastoral Counseling',
  'Baptism',
  'Child Dedication',
  'Media & Technical Support',
  'General Question',
] as const;

export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number];

export const DEFAULT_PRAYER_CATEGORY: PrayerCategory = 'General Prayer';
export const DEFAULT_INQUIRY_CATEGORY: InquiryCategory = 'General Question';

export const ALL_CONTACT_CATEGORIES = [
  ...PRAYER_CATEGORIES,
  ...INQUIRY_CATEGORIES,
] as const;

export type ContactCategory = (typeof ALL_CONTACT_CATEGORIES)[number];
