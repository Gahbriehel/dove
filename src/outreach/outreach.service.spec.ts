/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { callArg, MockModel } from '../common/testing/mock.util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CheckInReason,
  FollowUpStatus,
  MessageChannel,
  OutreachPurpose,
  OutreachStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OutreachService } from './outreach.service';

const admin = {
  sub: 'user-1',
  email: 'a@x.org',
  roles: ['COORDINATOR'],
  churchId: 'church-1',
};

const person = {
  id: 'person-1',
  firstName: 'Sarah',
  lastName: 'Adeyemi',
  phone: '+2348034567890',
  whatsappOptOut: false,
  dateOfBirth: null as Date | null,
};

const template = (
  id: string,
  name: string,
  checkInReason: CheckInReason | null = null,
) => ({
  id,
  name,
  checkInReason,
  body: "Hi {{firstName}}, it's {{adminName}} from {{churchName}}.",
});

describe('OutreachService', () => {
  let service: OutreachService;
  let prisma: {
    getDefaultChurchId: jest.Mock;
    church: MockModel;
    user: MockModel;
    person: MockModel;
    pastoralCheckIn: MockModel;
    messageTemplate: MockModel;
    outreachMessage: MockModel;
    birthdayGreeting: MockModel;
    $transaction: jest.Mock;
  };
  let tx: {
    outreachMessage: MockModel;
    person: MockModel;
    birthdayGreeting: MockModel;
  };

  beforeEach(async () => {
    tx = {
      outreachMessage: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn(),
      },
      person: { update: jest.fn(), updateMany: jest.fn() },
      birthdayGreeting: { upsert: jest.fn() },
    };
    prisma = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      church: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          name: 'Abiding Word',
          shortName: 'Amazing Grace',
        }),
      },
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ firstName: 'John', displayName: 'Pastor John' }),
      },
      person: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      pastoralCheckIn: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      messageTemplate: { findFirst: jest.fn(), findMany: jest.fn() },
      outreachMessage: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      birthdayGreeting: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };

    const module = await Test.createTestingModule({
      providers: [
        OutreachService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(OutreachService);
  });

  describe('preview', () => {
    beforeEach(() => {
      prisma.person.findFirst.mockResolvedValue(person);
      prisma.messageTemplate.findMany.mockResolvedValue([
        template('t1', 'One'),
        template('t2', 'Two'),
      ]);
    });

    it('renders the message and returns the WhatsApp digits', async () => {
      const result = await service.preview(
        { personId: 'person-1', purpose: OutreachPurpose.VISITOR_FOLLOW_UP },
        admin,
      );

      expect(result.body).toBe(
        "Hi Sarah, it's Pastor John from Amazing Grace.",
      );
      expect(result.toPhone).toBe('+2348034567890');
      expect(result.whatsappDigits).toBe('2348034567890');
      expect(result.warnings).toEqual([]);
    });

    it('does not save anything', async () => {
      await service.preview(
        { personId: 'person-1', purpose: OutreachPurpose.BIRTHDAY },
        admin,
      );
      expect(prisma.outreachMessage.create).not.toHaveBeenCalled();
    });

    it('skips the template last used for this person', async () => {
      prisma.outreachMessage.findFirst.mockResolvedValue({
        templateId: 't1',
        openedAt: new Date(),
        purpose: OutreachPurpose.BIRTHDAY,
        sentBy: { firstName: 'Grace', displayName: null },
      });

      const result = await service.preview(
        { personId: 'person-1', purpose: OutreachPurpose.BIRTHDAY },
        admin,
      );

      expect(result.template?.id).toBe('t2');
      expect(result.alternatives.map((a) => a.id)).toEqual(['t1']);
      expect(result.lastOutreach?.by).toBe('Grace');
    });

    it('prefers templates for the check-in reason', async () => {
      prisma.pastoralCheckIn.findFirst.mockResolvedValue({ id: 'ci-1' });
      prisma.pastoralCheckIn.findUnique.mockResolvedValue({
        reason: CheckInReason.ILLNESS,
      });
      prisma.messageTemplate.findMany.mockResolvedValue([
        template('generic', 'General'),
        template('sick', 'Get well', CheckInReason.ILLNESS),
      ]);

      const result = await service.preview(
        {
          personId: 'person-1',
          purpose: OutreachPurpose.PASTORAL_CHECK_IN,
          checkInId: 'ci-1',
        },
        admin,
      );

      expect(result.template?.id).toBe('sick');
    });

    it('warns when there is no template', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      const result = await service.preview(
        { personId: 'person-1', purpose: OutreachPurpose.BIRTHDAY },
        admin,
      );
      expect(result.warnings).toContain('NO_TEMPLATE');
      expect(result.body).toBeNull();
    });

    it('warns about phone and opt-out problems', async () => {
      prisma.person.findFirst.mockResolvedValue({
        ...person,
        phone: null,
        whatsappOptOut: true,
      });
      const result = await service.preview(
        { personId: 'person-1', purpose: OutreachPurpose.BIRTHDAY },
        admin,
      );
      expect(result.warnings).toEqual(
        expect.arrayContaining(['NO_PHONE', 'WHATSAPP_OPT_OUT']),
      );

      prisma.person.findFirst.mockResolvedValue({ ...person, phone: '12' });
      const invalid = await service.preview(
        { personId: 'person-1', purpose: OutreachPurpose.BIRTHDAY },
        admin,
      );
      expect(invalid.warnings).toContain('INVALID_PHONE');
      expect(invalid.toPhone).toBeNull();
    });

    it('warns when already greeted this year and when contacted recently', async () => {
      prisma.birthdayGreeting.count.mockResolvedValue(1);
      prisma.outreachMessage.count.mockResolvedValue(1);

      const result = await service.preview(
        { personId: 'person-1', purpose: OutreachPurpose.BIRTHDAY },
        admin,
      );

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          'ALREADY_GREETED_THIS_YEAR',
          'CONTACTED_RECENTLY',
        ]),
      );
    });

    it('rejects a person from another church', async () => {
      prisma.person.findFirst.mockResolvedValue(null);
      await expect(
        service.preview(
          { personId: 'other', purpose: OutreachPurpose.BIRTHDAY },
          admin,
        ),
      ).rejects.toMatchObject({
        response: { code: 'PERSON_NOT_IN_CHURCH' },
      });
    });

    it("rejects a check-in that is not the person's", async () => {
      prisma.pastoralCheckIn.findFirst.mockResolvedValue(null);
      await expect(
        service.preview(
          {
            personId: 'person-1',
            purpose: OutreachPurpose.PASTORAL_CHECK_IN,
            checkInId: 'ci-x',
          },
          admin,
        ),
      ).rejects.toMatchObject({
        response: { code: 'CHECK_IN_PERSON_MISMATCH' },
      });
    });

    it('handles PROFILE_LINK: renders [profile link] without generating token', async () => {
      prisma.person.findFirst.mockResolvedValue(person);
      prisma.messageTemplate.findMany.mockResolvedValue([
        {
          id: 'tpl-profile',
          name: 'Profile Link',
          checkInReason: null,
          body: 'Hello {{firstName}}, set up your profile here: {{profileLink}}',
        },
      ]);

      const result = await service.preview(
        { personId: 'person-1', purpose: OutreachPurpose.PROFILE_LINK },
        admin,
      );

      expect(result.body).toBe(
        'Hello Sarah, set up your profile here: [profile link]',
      );
      expect(prisma.person.update).not.toHaveBeenCalled();
    });
  });

  describe('open', () => {
    const dto = {
      personId: 'person-1',
      purpose: OutreachPurpose.VISITOR_FOLLOW_UP,
      body: 'Hello Sarah',
    };

    it('records the message as OPENED with the normalised phone', async () => {
      prisma.person.findFirst.mockResolvedValue({
        ...person,
        phone: '08034567890',
      });
      prisma.outreachMessage.create.mockResolvedValue({ id: 'o-1' });

      await service.open(dto, admin);

      expect(callArg(prisma.outreachMessage.create).data).toMatchObject({
        churchId: 'church-1',
        personId: 'person-1',
        sentByUserId: 'user-1',
        channel: MessageChannel.WHATSAPP,
        toPhone: '+2348034567890',
        body: 'Hello Sarah',
        birthdayYear: null,
      });
    });

    it('fills in the birthday year for birthday messages', async () => {
      prisma.person.findFirst.mockResolvedValue({
        ...person,
        dateOfBirth: new Date('1990-12-31T00:00:00.000Z'),
      });
      prisma.outreachMessage.create.mockResolvedValue({ id: 'o-1' });

      await service.open({ ...dto, purpose: OutreachPurpose.BIRTHDAY }, admin);

      const data = callArg(prisma.outreachMessage.create, 0).data;
      expect(typeof data.birthdayYear).toBe('number');
    });

    it('returns 409 when the person has no valid phone', async () => {
      prisma.person.findFirst.mockResolvedValue({ ...person, phone: null });
      await expect(service.open(dto, admin)).rejects.toBeInstanceOf(
        ConflictException,
      );

      prisma.person.findFirst.mockResolvedValue({ ...person, phone: '12' });
      await expect(service.open(dto, admin)).rejects.toMatchObject({
        response: { code: 'INVALID_PHONE' },
      });
    });

    it('returns 409 when the person opted out of WhatsApp', async () => {
      prisma.person.findFirst.mockResolvedValue({
        ...person,
        whatsappOptOut: true,
      });
      await expect(service.open(dto, admin)).rejects.toMatchObject({
        response: { code: 'WHATSAPP_OPT_OUT' },
      });
      expect(prisma.outreachMessage.create).not.toHaveBeenCalled();
    });

    it('rejects a template from another church', async () => {
      prisma.person.findFirst.mockResolvedValue(person);
      prisma.messageTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.open({ ...dto, templateId: 'tpl-x' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns 409 ALREADY_CLAIMED when sending PROFILE_LINK to person with pinHash', async () => {
      prisma.person.findFirst.mockResolvedValue({
        ...person,
        pinHash: 'claimed-pin',
      });

      await expect(
        service.open(
          {
            personId: 'person-1',
            purpose: OutreachPurpose.PROFILE_LINK,
            body: 'Hello Sarah [profile link]',
          },
          admin,
        ),
      ).rejects.toMatchObject({
        response: { code: 'ALREADY_CLAIMED' },
      });
    });

    it('generates 48-hour profile token, replaces [profile link] in whatsappUrl, and stores [profile link] in body', async () => {
      prisma.person.findFirst.mockResolvedValue({
        ...person,
        pinHash: null,
      });
      prisma.person.update.mockResolvedValue({});
      prisma.outreachMessage.create.mockResolvedValue({ id: 'o-profile-1' });

      const result = await service.open(
        {
          personId: 'person-1',
          purpose: OutreachPurpose.PROFILE_LINK,
          body: 'Hello Sarah, your link: [profile link]',
        },
        admin,
      );

      expect(prisma.person.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'person-1' },
          data: expect.objectContaining({
            profileToken: expect.any(String),
            profileTokenExpiresAt: expect.any(Date),
            profileTokenOpenedAt: null,
          }),
        }),
      );

      // Verify stored body in DB has [profile link], not the token
      expect(prisma.outreachMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          body: 'Hello Sarah, your link: [profile link]',
          purpose: OutreachPurpose.PROFILE_LINK,
        }),
      });

      // Verify whatsappUrl contains real profile URL with the generated token
      expect(result.whatsappUrl).toContain('https://wa.me/2348034567890?text=');
      expect(decodeURIComponent(result.whatsappUrl)).toMatch(
        /Hello Sarah, your link: http:\/\/localhost:3000\/profile\/[a-f0-9]{64}/,
      );
    });
  });

  describe('confirm', () => {
    const opened = (purpose: OutreachPurpose, extra = {}) => ({
      id: 'o-1',
      churchId: 'church-1',
      personId: 'person-1',
      sentByUserId: 'user-1',
      purpose,
      status: OutreachStatus.OPENED,
      birthdayYear: null,
      body: 'Happy birthday!',
      ...extra,
    });

    beforeEach(() => {
      tx.outreachMessage.findUniqueOrThrow.mockResolvedValue({
        id: 'o-1',
        status: OutreachStatus.CONFIRMED_SENT,
      });
    });

    it('marks NOT_SENT without other changes', async () => {
      prisma.outreachMessage.findFirst.mockResolvedValue(
        opened(OutreachPurpose.BIRTHDAY),
      );
      await service.confirm('o-1', { sent: false }, admin);

      expect(prisma.outreachMessage.update).toHaveBeenCalledWith({
        where: { id: 'o-1' },
        data: { status: OutreachStatus.NOT_SENT },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('sets lastFollowUpAt and moves a pending visitor to IN_PROGRESS', async () => {
      prisma.outreachMessage.findFirst.mockResolvedValue(
        opened(OutreachPurpose.VISITOR_FOLLOW_UP),
      );
      await service.confirm('o-1', { sent: true }, admin);

      const update = callArg<{
        where: unknown;
        data: { lastFollowUpAt: Date };
      }>(tx.person.update);
      expect(update.where).toEqual({ id: 'person-1' });
      expect(update.data.lastFollowUpAt).toBeInstanceOf(Date);
      expect(tx.person.updateMany).toHaveBeenCalledWith({
        where: { id: 'person-1', followUpStatus: FollowUpStatus.PENDING },
        data: { followUpStatus: FollowUpStatus.IN_PROGRESS },
      });
      expect(tx.birthdayGreeting.upsert).not.toHaveBeenCalled();
    });

    it('creates a WhatsApp BirthdayGreeting for a birthday', async () => {
      prisma.outreachMessage.findFirst.mockResolvedValue(
        opened(OutreachPurpose.BIRTHDAY, { birthdayYear: 2026 }),
      );
      await service.confirm('o-1', { sent: true }, admin);

      const upsert = callArg<{ where: unknown; create: unknown }>(
        tx.birthdayGreeting.upsert,
      );
      expect(upsert.where).toEqual({
        unique_person_year_channel_greeting: {
          personId: 'person-1',
          year: 2026,
          channel: MessageChannel.WHATSAPP,
        },
      });
      expect(upsert.create).toMatchObject({
        channel: MessageChannel.WHATSAPP,
        year: 2026,
        message: 'Happy birthday!',
      });
      expect(tx.person.updateMany).not.toHaveBeenCalled();
    });

    it('does not complete the pastoral check-in automatically', async () => {
      prisma.outreachMessage.findFirst.mockResolvedValue(
        opened(OutreachPurpose.PASTORAL_CHECK_IN, { checkInId: 'ci-1' }),
      );
      await service.confirm('o-1', { sent: true }, admin);

      expect(tx.person.update).toHaveBeenCalled();
      expect(tx.person.updateMany).not.toHaveBeenCalled();
      expect(tx.birthdayGreeting.upsert).not.toHaveBeenCalled();
    });

    it('is idempotent when already confirmed', async () => {
      prisma.outreachMessage.findFirst.mockResolvedValue(
        opened(OutreachPurpose.BIRTHDAY, {
          status: OutreachStatus.CONFIRMED_SENT,
        }),
      );
      await service.confirm('o-1', { sent: true }, admin);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('applies no side effects when a concurrent confirm won the race', async () => {
      prisma.outreachMessage.findFirst.mockResolvedValue(
        opened(OutreachPurpose.BIRTHDAY, { birthdayYear: 2026 }),
      );
      tx.outreachMessage.updateMany.mockResolvedValue({ count: 0 });
      await service.confirm('o-1', { sent: true }, admin);
      expect(tx.person.update).not.toHaveBeenCalled();
    });

    it('refuses to un-send a confirmed message', async () => {
      prisma.outreachMessage.findFirst.mockResolvedValue(
        opened(OutreachPurpose.BIRTHDAY, {
          status: OutreachStatus.CONFIRMED_SENT,
        }),
      );
      await expect(
        service.confirm('o-1', { sent: false }, admin),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lets only the sender or an admin confirm', async () => {
      prisma.outreachMessage.findFirst.mockResolvedValue(
        opened(OutreachPurpose.BIRTHDAY, { sentByUserId: 'someone-else' }),
      );

      await expect(
        service.confirm('o-1', { sent: false }, admin),
      ).rejects.toBeInstanceOf(ForbiddenException);

      prisma.outreachMessage.update.mockResolvedValue({ id: 'o-1' });

      await expect(
        service.confirm('o-1', { sent: false }, { ...admin, roles: ['ADMIN'] }),
      ).resolves.toBeDefined();
    });

    it('returns 404 for an unknown message', async () => {
      prisma.outreachMessage.findFirst.mockResolvedValue(null);
      await expect(
        service.confirm('nope', { sent: true }, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('applies filters and paginates', async () => {
      prisma.outreachMessage.findMany.mockResolvedValue([{ id: 'o-1' }]);
      prisma.outreachMessage.count.mockResolvedValue(45);

      const result = await service.findAll(
        {
          personId: 'person-1',
          status: OutreachStatus.CONFIRMED_SENT,
          from: '2026-10-01',
          page: 2,
          limit: 20,
        },
        admin,
      );

      expect(prisma.outreachMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            churchId: 'church-1',
            personId: 'person-1',
            status: OutreachStatus.CONFIRMED_SENT,
            openedAt: { gte: new Date('2026-10-01') },
          },
          skip: 20,
          take: 20,
        }),
      );
      expect(result.meta).toEqual({
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3,
      });
    });
  });

  describe('today', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-15T10:00:00.000Z'));
      prisma.person.findMany.mockResolvedValue([]);
      prisma.person.count.mockResolvedValue(0);
    });

    afterEach(() => jest.useRealTimers());

    it('lists birthdays today that have no WhatsApp greeting yet', async () => {
      const celebrant = (id: string) => ({
        id,
        firstName: id,
        lastName: 'X',
        phone: '+2348034567890',
        whatsappOptOut: false,
        dateOfBirth: new Date('1990-10-15T00:00:00.000Z'),
      });
      prisma.person.findMany
        .mockResolvedValueOnce([
          celebrant('greeted'),
          celebrant('pending'),
          {
            ...celebrant('other-day'),
            dateOfBirth: new Date('1990-10-16T00:00:00.000Z'),
          },
        ])
        .mockResolvedValue([]);
      prisma.birthdayGreeting.findMany.mockResolvedValue([
        { personId: 'greeted', channel: MessageChannel.WHATSAPP },
        { personId: 'pending', channel: MessageChannel.EMAIL },
      ]);

      const result = await service.today({ limit: 20 }, admin);

      expect(result.birthdays.total).toBe(1);
      expect(result.birthdays.items[0]).toMatchObject({
        personId: 'pending',
        turningAge: 36,
        emailGreeted: true,
      });
    });

    it('uses the Lagos calendar day for birthdays', async () => {
      jest.setSystemTime(new Date('2026-10-14T23:30:00.000Z'));
      prisma.person.findMany
        .mockResolvedValueOnce([
          {
            id: 'p',
            firstName: 'P',
            lastName: 'X',
            phone: null,
            whatsappOptOut: false,
            dateOfBirth: new Date('1990-10-15T00:00:00.000Z'),
          },
        ])
        .mockResolvedValue([]);

      const result = await service.today({ limit: 20 }, admin);
      expect(result.birthdays.total).toBe(1);
    });

    it('lists check-ins due by the end of the Lagos day, mine first', async () => {
      prisma.pastoralCheckIn.count.mockResolvedValue(2);
      prisma.pastoralCheckIn.findMany
        .mockResolvedValueOnce([{ id: 'mine' }])
        .mockResolvedValueOnce([{ id: 'other' }]);

      const result = await service.today({ limit: 20 }, admin);

      expect(result.checkIns.items.map((c: { id: string }) => c.id)).toEqual([
        'mine',
        'other',
      ]);
      expect(callArg(prisma.pastoralCheckIn.findMany, 0).where).toEqual(
        expect.objectContaining({
          assignedToId: 'user-1',
          scheduledFor: { lte: new Date('2026-10-15T22:59:59.999Z') },
        }),
      );
    });

    it('applies the visitor age and cooldown rules', async () => {
      await service.today({ limit: 20 }, admin);

      const { where } = callArg<{
        where: {
          followUpStatus: FollowUpStatus;
          createdAt: { lte: Date };
          outreachMessages: { none: { confirmedAt: { gte: Date } } };
        };
      }>(prisma.person.count);
      expect(where.followUpStatus).toBe(FollowUpStatus.PENDING);
      expect(where.createdAt.lte).toEqual(new Date('2026-10-13T10:00:00.000Z'));
      expect(where.outreachMessages.none.confirmedAt.gte).toEqual(
        new Date('2026-10-08T10:00:00.000Z'),
      );
    });

    it('lists my OPENED messages older than 15 minutes', async () => {
      await service.today({ limit: 20 }, admin);

      const where = callArg(prisma.outreachMessage.count, 0).where;
      expect(where).toEqual({
        churchId: 'church-1',
        sentByUserId: 'user-1',
        status: OutreachStatus.OPENED,
        openedAt: { lt: new Date('2026-10-15T09:45:00.000Z') },
      });
    });
  });
});
