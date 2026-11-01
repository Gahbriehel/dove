import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CheckInStatus,
  FollowUpStatus,
  Gender,
  MembershipStatus,
} from '@prisma/client';
import { callArg } from '../common/testing/mock.util';
import { PrismaService } from '../prisma/prisma.service';
import { PeopleService } from './people.service';

describe('PeopleService', () => {
  let service: PeopleService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    church: {
      findUnique: jest.Mock;
    };
    person: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    emailSendLog: { findMany: jest.Mock };
    birthdayGreeting: { findMany: jest.Mock };
    outreachMessage: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      church: {
        findUnique: jest.fn(),
      },
      person: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      emailSendLog: { findMany: jest.fn().mockResolvedValue([]) },
      birthdayGreeting: { findMany: jest.fn().mockResolvedValue([]) },
      outreachMessage: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeopleService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<PeopleService>(PeopleService);
  });

  describe('create', () => {
    it('should create a person with churchId inferred and format dateOfBirth', async () => {
      prismaMock.church.findUnique.mockResolvedValue({ id: 'church-1' });
      prismaMock.person.create.mockResolvedValue({
        id: 'person-1',
        churchId: 'church-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        gender: Gender.MALE,
        dateOfBirth: new Date('1995-05-15'),
        membershipStatus: MembershipStatus.VISITOR,
      });

      const result = await service.create(
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          gender: Gender.MALE,
          dateOfBirth: '1995-05-15',
        },
        'church-1',
      );

      expect(result.id).toBe('person-1');
      expect(result.firstName).toBe('John');
      expect(prismaMock.church.findUnique).toHaveBeenCalledWith({
        where: { id: 'church-1' },
      });
      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          gender: Gender.MALE,
          churchId: 'church-1',
          membershipStatus: MembershipStatus.VISITOR,
          followUpStatus: FollowUpStatus.PENDING,
          dateOfBirth: new Date('1995-05-15'),
        },
      });
    });

    it('should create a non-visitor with followUpStatus null when not specified', async () => {
      prismaMock.church.findUnique.mockResolvedValue({ id: 'church-1' });
      prismaMock.person.create.mockResolvedValue({
        id: 'person-2',
        churchId: 'church-1',
        firstName: 'Jane',
        lastName: 'Member',
        membershipStatus: MembershipStatus.MEMBER,
        followUpStatus: null,
      });

      const result = await service.create(
        {
          firstName: 'Jane',
          lastName: 'Member',
          membershipStatus: MembershipStatus.MEMBER,
        },
        'church-1',
      );

      expect(result.id).toBe('person-2');
      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          firstName: 'Jane',
          lastName: 'Member',
          churchId: 'church-1',
          membershipStatus: MembershipStatus.MEMBER,
          followUpStatus: null,
          dateOfBirth: null,
        },
      });
    });

    it('should throw NotFoundException if church does not exist', async () => {
      prismaMock.church.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { firstName: 'John', lastName: 'Doe' },
          'non-existent-church',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated people with enriched registration/attendance counts and demographic stats', async () => {
      const mockPerson = {
        id: 'person-1',
        firstName: 'John',
        lastName: 'Doe',
        membershipStatus: MembershipStatus.MEMBER,
        gender: Gender.MALE,
        church: { id: 'church-1', name: 'Grace Church', slug: 'grace' },
        registrations: [
          {
            id: 'reg-1',
            attendance: { id: 'att-1', checkedInAt: new Date() },
          },
          {
            id: 'reg-2',
            attendance: null,
          },
        ],
      };

      prismaMock.person.findMany.mockResolvedValue([mockPerson]);
      prismaMock.person.count
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(0) // visitors
        .mockResolvedValueOnce(1) // members
        .mockResolvedValueOnce(0) // workers
        .mockResolvedValueOnce(0) // leaders
        .mockResolvedValueOnce(0) // pastors
        .mockResolvedValueOnce(1) // male
        .mockResolvedValueOnce(0) // female
        .mockResolvedValueOnce(0) // other
        .mockResolvedValueOnce(0); // unspecified

      const result = await service.findAll(
        { page: 1, limit: 10, search: 'John' },
        'church-1',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].eventsRegisteredCount).toBe(2);
      expect(result.items[0].eventsAttendedCount).toBe(1);
      expect(result.meta.total).toBe(1);
      expect(result.stats.membership.members).toBe(1);
      expect(result.stats.gender.male).toBe(1);
    });

    it('should filter by hasPendingCheckIn = true', async () => {
      prismaMock.person.findMany.mockResolvedValue([]);
      for (let i = 0; i < 11; i++) {
        prismaMock.person.count.mockResolvedValueOnce(0);
      }

      await service.findAll({ hasPendingCheckIn: true }, 'church-1');

      expect(prismaMock.person.findMany).toHaveBeenCalledTimes(1);
      const firstCall = prismaMock.person.findMany.mock.calls[0] as [
        {
          where: {
            churchId: string;
            pastoralCheckIns?: { some?: { status: CheckInStatus } };
          };
        },
      ];
      expect(firstCall[0].where.churchId).toBe('church-1');
      expect(firstCall[0].where.pastoralCheckIns).toEqual({
        some: { status: CheckInStatus.SCHEDULED },
      });
    });

    it('should filter by hasPendingCheckIn = false', async () => {
      prismaMock.person.findMany.mockResolvedValue([]);
      for (let i = 0; i < 11; i++) {
        prismaMock.person.count.mockResolvedValueOnce(0);
      }

      await service.findAll({ hasPendingCheckIn: false }, 'church-1');

      expect(prismaMock.person.findMany).toHaveBeenCalledTimes(1);
      const secondCall = prismaMock.person.findMany.mock.calls[0] as [
        {
          where: {
            churchId: string;
            pastoralCheckIns?: { none?: { status: CheckInStatus } };
          };
        },
      ];
      expect(secondCall[0].where.churchId).toBe('church-1');
      expect(secondCall[0].where.pastoralCheckIns).toEqual({
        none: { status: CheckInStatus.SCHEDULED },
      });
    });
  });

  describe('exportAll', () => {
    it('should return all people for CSV export with registration counts', async () => {
      const mockPerson = {
        id: 'person-1',
        firstName: 'John',
        lastName: 'Doe',
        registrations: [{ attendance: { id: 'att-1' } }],
      };

      prismaMock.person.findMany.mockResolvedValue([mockPerson]);

      const result = await service.exportAll({}, 'church-1');

      expect(result).toHaveLength(1);
      expect(result[0].eventsRegisteredCount).toBe(1);
      expect(result[0].eventsAttendedCount).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return single person with enriched registration/attendance history', async () => {
      const mockPerson = {
        id: 'person-1',
        firstName: 'Jane',
        lastName: 'Doe',
        church: { id: 'church-1', name: 'Grace Church', slug: 'grace' },
        registrations: [
          {
            id: 'reg-1',
            event: { id: 'ev-1', title: 'Camp' },
            attendance: { id: 'att-1' },
          },
        ],
      };

      prismaMock.person.findFirst.mockResolvedValue(mockPerson);

      const result = await service.findOne('person-1', 'church-1');

      expect(result.id).toBe('person-1');
      expect(result.eventsRegisteredCount).toBe(1);
      expect(result.eventsAttendedCount).toBe(1);
      expect(prismaMock.person.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'person-1', churchId: 'church-1' },
        }),
      );
    });

    it('should throw NotFoundException if person is not found in church', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);

      await expect(service.findOne('missing-id', 'church-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update person details and format dateOfBirth', async () => {
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      prismaMock.person.update.mockResolvedValue({
        id: 'person-1',
        firstName: 'Johnny',
        dateOfBirth: new Date('1990-01-01'),
      });

      const result = await service.update(
        'person-1',
        { firstName: 'Johnny', dateOfBirth: '1990-01-01' },
        'church-1',
      );

      expect(result.firstName).toBe('Johnny');
      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: 'person-1' },
        data: {
          firstName: 'Johnny',
          dateOfBirth: new Date('1990-01-01'),
        },
      });
    });

    it('should clear PENDING followUpStatus when updating to a non-visitor membership status without explicit followUpStatus', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        membershipStatus: MembershipStatus.VISITOR,
        followUpStatus: FollowUpStatus.PENDING,
      });
      prismaMock.person.update.mockResolvedValue({
        id: 'person-1',
        membershipStatus: MembershipStatus.MEMBER,
        followUpStatus: null,
      });

      await service.update(
        'person-1',
        { membershipStatus: MembershipStatus.MEMBER },
        'church-1',
      );

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: 'person-1' },
        data: {
          membershipStatus: MembershipStatus.MEMBER,
          followUpStatus: null,
        },
      });
    });
  });

  describe('update emailOptOut', () => {
    it('should re-subscribe an unsubscribed person and clear emailOptOutAt', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        emailOptOut: true,
        emailOptOutAt: new Date('2026-10-31'),
      });
      prismaMock.person.update.mockResolvedValue({ id: 'person-1' });

      await service.update('person-1', { emailOptOut: false }, 'church-1');

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: 'person-1' },
        data: { emailOptOut: false, emailOptOutAt: null },
      });
    });

    it('should manually opt a person out and stamp emailOptOutAt', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        emailOptOut: false,
      });
      prismaMock.person.update.mockResolvedValue({ id: 'person-1' });

      await service.update('person-1', { emailOptOut: true }, 'church-1');

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: 'person-1' },
        data: { emailOptOut: true, emailOptOutAt: expect.any(Date) as Date },
      });
    });

    it('should leave the opt-out timestamp untouched when the value is unchanged', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        emailOptOut: true,
      });
      prismaMock.person.update.mockResolvedValue({ id: 'person-1' });

      await service.update(
        'person-1',
        { emailOptOut: true, firstName: 'Johnny' },
        'church-1',
      );

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: 'person-1' },
        data: { firstName: 'Johnny' },
      });
    });
  });

  describe('remove', () => {
    it('should delete person after verifying existence', async () => {
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      prismaMock.person.delete.mockResolvedValue({ id: 'person-1' });

      const result = await service.remove('person-1', 'church-1');

      expect(result).toEqual({
        message: 'Person with ID "person-1" deleted successfully',
      });
      expect(prismaMock.person.delete).toHaveBeenCalledWith({
        where: { id: 'person-1' },
      });
    });
  });

  describe('promote', () => {
    it('should promote a person to member and convert follow-up status', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        membershipStatus: MembershipStatus.VISITOR,
        followUpStatus: FollowUpStatus.PENDING,
        email: 'john@example.com',
        phone: null,
      });
      prismaMock.person.update.mockResolvedValue({
        id: 'person-1',
        membershipStatus: MembershipStatus.MEMBER,
        followUpStatus: FollowUpStatus.CONVERTED,
      });

      const result = await service.promote(
        'person-1',
        { membershipStatus: MembershipStatus.MEMBER },
        'church-1',
      );

      expect(result.membershipStatus).toBe(MembershipStatus.MEMBER);
      expect(prismaMock.person.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'person-1' },
          data: {
            membershipStatus: MembershipStatus.MEMBER,
            followUpStatus: FollowUpStatus.CONVERTED,
          },
        }),
      );
    });

    it('should throw BadRequestException if person has neither email nor phone', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        membershipStatus: MembershipStatus.VISITOR,
        email: null,
        phone: '',
      });

      await expect(
        service.promote(
          'person-1',
          { membershipStatus: MembershipStatus.MEMBER },
          'church-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if promotion is downward or equal rank', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        membershipStatus: MembershipStatus.WORKER,
        email: 'worker@example.com',
        phone: null,
      });

      await expect(
        service.promote(
          'person-1',
          { membershipStatus: MembershipStatus.MEMBER },
          'church-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if person not found', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);

      await expect(
        service.promote(
          'person-missing',
          { membershipStatus: MembershipStatus.MEMBER },
          'church-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('phone numbers', () => {
    it('stores a created phone number in E.164', async () => {
      prismaMock.church.findUnique.mockResolvedValue({ id: 'church-1' });
      prismaMock.person.create.mockResolvedValue({ id: 'person-1' });

      await service.create(
        { firstName: 'A', lastName: 'B', phone: '0803 456 7890' },
        'church-1',
      );

      expect(callArg(prismaMock.person.create, 0).data.phone).toBe(
        '+2348034567890',
      );
    });

    it('rejects an invalid phone number on create', async () => {
      prismaMock.church.findUnique.mockResolvedValue({ id: 'church-1' });

      await expect(
        service.create(
          { firstName: 'A', lastName: 'B', phone: '12345' },
          'church-1',
        ),
      ).rejects.toThrow('Please enter a valid phone number');
      expect(prismaMock.person.create).not.toHaveBeenCalled();
    });

    it('normalises the phone number on update and clears it when blank', async () => {
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      prismaMock.person.update.mockResolvedValue({ id: 'person-1' });

      await service.update(
        'person-1',
        { phone: '+234 803 456 7890' },
        'church-1',
      );
      expect(callArg(prismaMock.person.update, 0).data.phone).toBe(
        '+2348034567890',
      );

      await service.update('person-1', { phone: '' }, 'church-1');
      expect(callArg(prismaMock.person.update, 1).data.phone).toBeNull();
    });

    it('rejects an invalid phone number on update', async () => {
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      await expect(
        service.update('person-1', { phone: 'abc' }, 'church-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.person.update).not.toHaveBeenCalled();
    });
  });

  describe('update whatsappOptOut', () => {
    it('opts a person out and stamps whatsappOptOutAt', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        whatsappOptOut: false,
      });
      prismaMock.person.update.mockResolvedValue({ id: 'person-1' });

      await service.update('person-1', { whatsappOptOut: true }, 'church-1');

      const data = callArg(prismaMock.person.update, 0).data;
      expect(data.whatsappOptOut).toBe(true);
      expect(data.whatsappOptOutAt).toBeInstanceOf(Date);
    });

    it('clears whatsappOptOutAt when re-subscribing', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        whatsappOptOut: true,
        whatsappOptOutAt: new Date(),
      });
      prismaMock.person.update.mockResolvedValue({ id: 'person-1' });

      await service.update('person-1', { whatsappOptOut: false }, 'church-1');

      const data = callArg(prismaMock.person.update, 0).data;
      expect(data.whatsappOptOut).toBe(false);
      expect(data.whatsappOptOutAt).toBeNull();
    });

    it('leaves the timestamp alone when the value is unchanged', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        whatsappOptOut: true,
      });
      prismaMock.person.update.mockResolvedValue({ id: 'person-1' });

      await service.update('person-1', { whatsappOptOut: true }, 'church-1');

      const data = callArg(prismaMock.person.update, 0).data;
      expect(data.whatsappOptOutAt).toBeUndefined();
    });
  });

  describe('getMessages', () => {
    const sender = { id: 'u-1', firstName: 'Grace', displayName: null };

    it('merges email, greetings and outreach newest first', async () => {
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      prismaMock.emailSendLog.findMany.mockResolvedValue([
        {
          id: 'e-1',
          emailType: 'CUSTOM_BROADCAST',
          createdAt: new Date('2026-10-10T10:00:00Z'),
          sentByUserId: 'u-1',
          subject: 'Service update',
        },
      ]);
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'u-1', firstName: 'Grace', displayName: 'Sis. Grace' },
      ]);
      prismaMock.outreachMessage.findMany.mockResolvedValue([
        {
          id: 'o-1',
          channel: 'WHATSAPP',
          purpose: 'PASTORAL_CHECK_IN',
          openedAt: new Date('2026-10-12T10:00:00Z'),
          sentByUserId: 'u-1',
          sentBy: sender,
          status: 'CONFIRMED_SENT',
          body: 'x'.repeat(200),
        },
      ]);

      const result = await service.getMessages('person-1', {}, 'church-1');

      expect(result.items.map((i) => i.refId)).toEqual(['o-1', 'e-1']);
      expect(result.items[0]).toMatchObject({
        type: 'WHATSAPP',
        status: 'CONFIRMED_SENT',
        by: { id: 'u-1', name: 'Grace' },
      });
      expect(result.items[0].preview).toHaveLength(141);
      expect(result.items[1].by).toEqual({ id: 'u-1', name: 'Sis. Grace' });
      expect(result.meta.total).toBe(2);
    });

    it('does not list an email birthday greeting twice', async () => {
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      prismaMock.emailSendLog.findMany.mockResolvedValue([
        {
          id: 'e-1',
          emailType: 'BIRTHDAY_GREETING',
          createdAt: new Date('2026-10-15T08:00:01Z'),
          sentByUserId: null,
          subject: 'Happy Birthday',
        },
      ]);
      prismaMock.birthdayGreeting.findMany.mockResolvedValue([
        {
          id: 'g-1',
          createdAt: new Date('2026-10-15T08:00:00Z'),
          sentByUserId: 'u-1',
          sentBy: sender,
          subject: 'Happy Birthday',
          message: 'Hi',
        },
      ]);

      const result = await service.getMessages('person-1', {}, 'church-1');
      expect(result.items.map((i) => i.refId)).toEqual(['e-1']);
    });

    it('keeps a birthday email that predates send logging', async () => {
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      prismaMock.birthdayGreeting.findMany.mockResolvedValue([
        {
          id: 'g-1',
          createdAt: new Date('2026-10-05T08:00:00Z'),
          sentByUserId: 'u-1',
          sentBy: sender,
          subject: null,
          message: '<p>Happy <b>birthday</b></p>',
        },
      ]);

      const result = await service.getMessages('person-1', {}, 'church-1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].preview).toBe('Happy birthday');
    });

    it('paginates the merged timeline', async () => {
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      prismaMock.outreachMessage.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          id: `o-${i}`,
          channel: 'WHATSAPP',
          purpose: 'BIRTHDAY',
          openedAt: new Date(2026, 9, i + 1),
          sentByUserId: 'u-1',
          sentBy: sender,
          status: 'OPENED',
          body: 'hi',
        })),
      );

      const result = await service.getMessages(
        'person-1',
        { page: 2, limit: 2 },
        'church-1',
      );

      expect(result.items.map((i) => i.refId)).toEqual(['o-2', 'o-1']);
      expect(result.meta).toEqual({
        total: 5,
        page: 2,
        limit: 2,
        totalPages: 3,
      });
    });

    it('returns 404 for a person in another church', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);
      await expect(
        service.getMessages('nope', {}, 'church-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
