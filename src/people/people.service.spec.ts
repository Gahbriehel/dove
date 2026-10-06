import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Gender, MembershipStatus } from '@prisma/client';
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
          dateOfBirth: new Date('1995-05-15'),
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
});
