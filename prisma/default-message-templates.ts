import { CheckInReason, OutreachPurpose } from '@prisma/client';

export interface DefaultMessageTemplate {
  purpose: OutreachPurpose;
  checkInReason: CheckInReason | null;
  name: string;
  body: string;
}

export const DEFAULT_MESSAGE_TEMPLATES: DefaultMessageTemplate[] = [
  {
    purpose: OutreachPurpose.BIRTHDAY,
    checkInReason: null,
    name: 'Birthday – blessing',
    body: "Happy birthday {{firstName}}! 🎉 I'm {{adminName}} from {{churchName}}. We thank God for your life and pray this new year brings you joy, good health and His abundant grace. Have a blessed day! 🎂",
  },
  {
    purpose: OutreachPurpose.BIRTHDAY,
    checkInReason: null,
    name: 'Birthday – church family',
    body: "Hi {{firstName}}, it's {{adminName}} from {{churchName}}. Happy birthday! 🥳 The whole church family celebrates you today. May God's favour go with you all through this new year.",
  },
  {
    purpose: OutreachPurpose.BIRTHDAY,
    checkInReason: null,
    name: 'Birthday – grateful',
    body: "Happy birthday, {{firstName}}! 🎂 {{adminName}} here from {{churchName}}. We're so grateful to have you with us. Wishing you a wonderful day and a year full of God's blessings.",
  },
  {
    purpose: OutreachPurpose.VISITOR_FOLLOW_UP,
    checkInReason: null,
    name: 'Visitor – thank you',
    body: "Hi {{firstName}}, I'm {{adminName}} from {{churchName}}. Thank you so much for worshipping with us! It was a joy to have you. How are you doing? We'd love to see you again this Sunday.",
  },
  {
    purpose: OutreachPurpose.VISITOR_FOLLOW_UP,
    checkInReason: null,
    name: 'Visitor – prayer',
    body: "Hello {{firstName}}! It's {{adminName}} from {{churchName}}. Just wanted to say thank you for visiting. If there's anything we can pray with you about, please feel free to reply here. 🙏",
  },
  {
    purpose: OutreachPurpose.PASTORAL_CHECK_IN,
    checkInReason: CheckInReason.ABSENTEEISM,
    name: 'Missed you',
    body: "Hi {{firstName}}, it's {{adminName}} from {{churchName}}. We've missed you! Just checking in, how are you doing? 😊",
  },
  {
    purpose: OutreachPurpose.PASTORAL_CHECK_IN,
    checkInReason: CheckInReason.ABSENTEEISM,
    name: "Making sure you're okay",
    body: "Hello {{firstName}}, {{adminName}} here from {{churchName}}. We haven't seen you in a little while and wanted to make sure you're okay. We're thinking of you!",
  },
  {
    purpose: OutreachPurpose.PASTORAL_CHECK_IN,
    checkInReason: CheckInReason.ILLNESS,
    name: 'Get well',
    body: "Hi {{firstName}}, it's {{adminName}} from {{churchName}}. We heard you haven't been feeling well. We're praying for your quick recovery. Is there anything we can do for you? 🙏",
  },
  {
    purpose: OutreachPurpose.PASTORAL_CHECK_IN,
    checkInReason: CheckInReason.BEREAVEMENT,
    name: 'Condolence',
    body: "Dear {{firstName}}, it's {{adminName}} from {{churchName}}. We're so sorry for your loss. Please know the church family is standing with you in prayer. We're here for you, any time.",
  },
  {
    purpose: OutreachPurpose.PASTORAL_CHECK_IN,
    checkInReason: CheckInReason.WORKER_WELFARE,
    name: 'Worker welfare',
    body: 'Hi {{firstName}}, {{adminName}} here from {{churchName}}. Thank you for all you do in the house of God. Just checking in on you, how are you keeping?',
  },
  {
    purpose: OutreachPurpose.PASTORAL_CHECK_IN,
    checkInReason: CheckInReason.DISCIPLESHIP,
    name: 'Discipleship',
    body: "Hi {{firstName}}, it's {{adminName}} from {{churchName}}. I wanted to check in on how you're growing in your walk with God. Do you have some time this week to talk?",
  },
  {
    purpose: OutreachPurpose.PASTORAL_CHECK_IN,
    checkInReason: CheckInReason.FAMILY_SUPPORT,
    name: 'Family support',
    body: "Hi {{firstName}}, it's {{adminName}} from {{churchName}}. We've been thinking of you and your family. How is everyone doing? We're here if you need anything.",
  },
  {
    purpose: OutreachPurpose.PASTORAL_CHECK_IN,
    checkInReason: null,
    name: 'General check-in',
    body: "Hi {{firstName}}, it's {{adminName}} from {{churchName}}. Just checking in to see how you're doing. We appreciate you! 😊",
  },
  {
    purpose: OutreachPurpose.PROFILE_LINK,
    checkInReason: null,
    name: 'Profile link',
    body: "Hi {{firstName}}, it's {{adminName}} from {{churchName}}. Here is your link to set up your profile: {{profileLink}}",
  },
];
