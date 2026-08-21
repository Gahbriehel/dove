import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationStatus } from '@prisma/client';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationsService } from './registrations.service';

describe('RegistrationsService', () => {
  let service: RegistrationsService;

  const txMock = {
    person: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    registration: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
    },
  };

  const prismaMock = {
    event: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) =>
      cb(txMock),
    ),
  };

  const emailServiceMock = {
    sendRegistrationConfirmation: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: EMAIL_SERVICE,
          useValue: emailServiceMock,
        },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
  });

  describe('register - capacity enforcement', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    const mockEvent = {
      id: 'event-1',
      churchId: 'church-1',
      title: 'Camp 2026',
      startDate: futureDate,
      endDate: futureDate,
      capacity: 5,
      church: {
        name: 'Grace Church',
        email: 'info@grace.org',
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should allow registration when event capacity is not reached', async () => {
      prismaMock.event.findUnique.mockResolvedValue(mockEvent);
      txMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        email: 'test@example.com',
      });
      txMock.registration.findUnique.mockResolvedValue(null);
      txMock.registration.count.mockResolvedValue(4); // 4 active registrations, capacity is 5
      txMock.team.findMany.mockResolvedValue([
        {
          id: 'team-1',
          name: 'Red Team',
          color: 'red',
          createdAt: new Date(),
          _count: { registrations: 2 },
        },
      ]);
      txMock.registration.create.mockResolvedValue({
        id: 'reg-1',
        registrationNumber: 'REG-123',
        token: 'token-123',
        status: RegistrationStatus.CONFIRMED,
      });

      const result = await service.register('event-1', {
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
      });

      expect(result.message).toEqual('Registration successful');
      expect(txMock.registration.count).toHaveBeenCalledWith({
        where: {
          eventId: 'event-1',
          status: { not: RegistrationStatus.CANCELLED },
        },
      });
    });

    it('should throw BadRequestException when event capacity is reached', async () => {
      prismaMock.event.findUnique.mockResolvedValue(mockEvent);
      txMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        email: 'test@example.com',
      });
      txMock.registration.findUnique.mockResolvedValue(null);
      txMock.registration.count.mockResolvedValue(5); // 5 active registrations, capacity is 5

      await expect(
        service.register('event-1', {
          firstName: 'John',
          lastName: 'Doe',
          email: 'test@example.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow registration when capacity is null (unlimited)', async () => {
      prismaMock.event.findUnique.mockResolvedValue({
        ...mockEvent,
        capacity: null,
      });
      txMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        email: 'test@example.com',
      });
      txMock.registration.findUnique.mockResolvedValue(null);
      txMock.team.findMany.mockResolvedValue([
        {
          id: 'team-1',
          name: 'Red Team',
          color: 'red',
          createdAt: new Date(),
          _count: { registrations: 100 },
        },
      ]);
      txMock.registration.create.mockResolvedValue({
        id: 'reg-1',
        registrationNumber: 'REG-123',
        token: 'token-123',
        status: RegistrationStatus.CONFIRMED,
      });

      const result = await service.register('event-1', {
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
      });

      expect(result.message).toEqual('Registration successful');
      expect(txMock.registration.count).not.toHaveBeenCalled();
    });
  });
});
