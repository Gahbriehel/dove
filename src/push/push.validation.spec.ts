import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ConfessionReminderItemDto,
  UpdateConfessionRemindersDto,
} from '../confessions/dto/confession-reminders.dto';
import { PutNightPrayerDto } from './dto/night-prayer.dto';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';
import { SubscribeDto } from './dto/subscribe.dto';

describe('Push & Night Prayer Validation DTOs', () => {
  describe('SubscribeDto', () => {
    it('accepts valid https endpoint and valid topics', async () => {
      const dto = plainToInstance(SubscribeDto, {
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc123xyz',
          keys: {
            p256dh: 'p256-sample-key',
            auth: 'auth-sample-secret',
          },
        },
        topics: ['night-prayer', 'confessions'],
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects non-https endpoint', async () => {
      const dto = plainToInstance(SubscribeDto, {
        subscription: {
          endpoint: 'http://insecure.endpoint.com/push',
          keys: {
            p256dh: 'p256',
            auth: 'auth',
          },
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const subErrors = errors.find((e) => e.property === 'subscription');
      expect(subErrors).toBeDefined();
    });

    it('rejects endpoint exceeding 1024 characters', async () => {
      const longEndpoint = 'https://example.com/' + 'a'.repeat(1020);
      const dto = plainToInstance(SubscribeDto, {
        subscription: {
          endpoint: longEndpoint,
          keys: {
            p256dh: 'p256',
            auth: 'auth',
          },
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid topic name', async () => {
      const dto = plainToInstance(SubscribeDto, {
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
          keys: {
            p256dh: 'p256',
            auth: 'auth',
          },
        },
        topics: ['invalid-topic'],
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('PutNightPrayerDto', () => {
    it('accepts valid night prayer settings', async () => {
      const dto = plainToInstance(PutNightPrayerDto, {
        title: 'Night Prayer',
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        timeOfDay: '22:00',
        durationMin: 60,
        joinOpensMinBefore: 10,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        reminderOffsetsMin: [60],
        isActive: true,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects non-Google Meet URL', async () => {
      const dto = plainToInstance(PutNightPrayerDto, {
        title: 'Night Prayer',
        meetUrl: 'https://zoom.us/j/123456789',
        timeOfDay: '22:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'meetUrl')).toBe(true);
    });

    it('rejects invalid timeOfDay format', async () => {
      const dto = plainToInstance(PutNightPrayerDto, {
        title: 'Night Prayer',
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        timeOfDay: '25:99',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'timeOfDay')).toBe(true);
    });

    it('rejects empty daysOfWeek list (must use isActive: false instead)', async () => {
      const dto = plainToInstance(PutNightPrayerDto, {
        title: 'Night Prayer',
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        timeOfDay: '22:00',
        daysOfWeek: [],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'daysOfWeek')).toBe(true);
    });

    it('rejects duplicate days in daysOfWeek', async () => {
      const dto = plainToInstance(PutNightPrayerDto, {
        title: 'Night Prayer',
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        timeOfDay: '22:00',
        daysOfWeek: [1, 1, 2],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'daysOfWeek')).toBe(true);
    });

    it('rejects reminderOffsetsMin with more than 3 values', async () => {
      const dto = plainToInstance(PutNightPrayerDto, {
        title: 'Night Prayer',
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        timeOfDay: '22:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        reminderOffsetsMin: [15, 30, 60, 120],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reminderOffsetsMin')).toBe(
        true,
      );
    });

    it('rejects reminder offset below 5 minutes or above 720 minutes', async () => {
      const dtoLow = plainToInstance(PutNightPrayerDto, {
        title: 'Night Prayer',
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        timeOfDay: '22:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        reminderOffsetsMin: [2], // < 5
      });
      const errorsLow = await validate(dtoLow);
      expect(errorsLow.some((e) => e.property === 'reminderOffsetsMin')).toBe(
        true,
      );

      const dtoHigh = plainToInstance(PutNightPrayerDto, {
        title: 'Night Prayer',
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        timeOfDay: '22:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        reminderOffsetsMin: [800], // > 720
      });
      const errorsHigh = await validate(dtoHigh);
      expect(errorsHigh.some((e) => e.property === 'reminderOffsetsMin')).toBe(
        true,
      );
    });
  });

  describe('ConfessionRemindersDto', () => {
    it('accepts valid confession reminders', async () => {
      const dto = plainToInstance(UpdateConfessionRemindersDto, {
        reminders: [
          {
            timeOfDay: '06:30',
            daysOfWeek: [1, 2, 3, 4, 5],
            startsOn: '2026-11-01',
            endsOn: '2026-11-30',
            message: 'Morning declaration',
          },
        ],
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects endsOn before startsOn', async () => {
      const item = plainToInstance(ConfessionReminderItemDto, {
        timeOfDay: '06:30',
        startsOn: '2026-11-20',
        endsOn: '2026-11-10', // before startsOn!
      });

      const errors = await validate(item);
      expect(errors.some((e) => e.property === 'endsOn')).toBe(true);
    });

    it('rejects more than 6 reminders per confession', async () => {
      const reminders = Array.from({ length: 7 }, (_, i) => ({
        timeOfDay: `0${i}:00`,
      }));

      const dto = plainToInstance(UpdateConfessionRemindersDto, { reminders });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reminders')).toBe(true);
    });
  });

  describe('UpdateNotificationSettingsDto', () => {
    it('accepts valid scriptureSendTime and encouragement slots', async () => {
      const dto = plainToInstance(UpdateNotificationSettingsDto, {
        scriptureSendTime: '07:00',
        encouragementSlots: [
          { day: 2, time: '12:30' },
          { day: 5, time: '18:00' },
        ],
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects more than 14 encouragement slots', async () => {
      const slots = Array.from({ length: 15 }, () => ({
        day: 1,
        time: '12:00',
      }));

      const dto = plainToInstance(UpdateNotificationSettingsDto, {
        encouragementSlots: slots,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'encouragementSlots')).toBe(
        true,
      );
    });
  });
});
