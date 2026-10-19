import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentsService } from './departments.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    church: {
      findUnique: jest.Mock;
    };
    department: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    person: {
      findFirst: jest.Mock;
    };
    departmentMembership: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      church: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'church-1', name: 'Test Church' }),
      },
      department: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      person: {
        findFirst: jest.fn(),
      },
      departmentMembership: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  describe('create', () => {
    it('should create a department successfully', async () => {
      prismaMock.department.findUnique.mockResolvedValue(null);
      prismaMock.department.create.mockResolvedValue({
        id: 'dept-1',
        name: 'Choir',
        description: 'Music ministry',
        churchId: 'church-1',
      });

      const result = await service.create({
        name: 'Choir',
        description: 'Music ministry',
      });

      expect(result.id).toBe('dept-1');
      expect(prismaMock.department.create).toHaveBeenCalledWith({
        data: {
          name: 'Choir',
          description: 'Music ministry',
          churchId: 'church-1',
        },
        include: {
          _count: { select: { members: true } },
        },
      });
    });

    it('should throw ConflictException if department name already exists', async () => {
      prismaMock.department.findUnique.mockResolvedValue({
        id: 'existing-dept',
      });

      await expect(service.create({ name: 'Choir' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if church is not found', async () => {
      prismaMock.church.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Choir', churchId: 'unknown-church' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated departments', async () => {
      const items = [{ id: 'dept-1', name: 'Choir', _count: { members: 5 } }];
      prismaMock.department.findMany.mockResolvedValue(items);
      prismaMock.department.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.items).toEqual(items);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return department when found', async () => {
      const dept = { id: 'dept-1', name: 'Choir', members: [] };
      prismaMock.department.findFirst.mockResolvedValue(dept);

      const result = await service.findOne('dept-1');

      expect(result).toEqual(dept);
    });

    it('should throw NotFoundException when department not found', async () => {
      prismaMock.department.findFirst.mockResolvedValue(null);

      await expect(service.findOne('dept-unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update department', async () => {
      prismaMock.department.findFirst.mockResolvedValue({
        id: 'dept-1',
        name: 'Choir',
        churchId: 'church-1',
      });
      prismaMock.department.update.mockResolvedValue({
        id: 'dept-1',
        name: 'Worship Choir',
      });

      const result = await service.update('dept-1', { name: 'Worship Choir' });

      expect(result.name).toBe('Worship Choir');
    });

    it('should throw ConflictException if updating to an existing name', async () => {
      prismaMock.department.findFirst.mockResolvedValue({
        id: 'dept-1',
        name: 'Choir',
        churchId: 'church-1',
      });
      prismaMock.department.findUnique.mockResolvedValue({
        id: 'dept-2',
        name: 'Media',
      });

      await expect(service.update('dept-1', { name: 'Media' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should delete department successfully', async () => {
      prismaMock.department.findFirst.mockResolvedValue({
        id: 'dept-1',
        churchId: 'church-1',
      });
      prismaMock.department.delete.mockResolvedValue({ id: 'dept-1' });

      const result = await service.remove('dept-1');

      expect(result.message).toContain('deleted successfully');
    });
  });

  describe('addMember', () => {
    it('should assign a person to a department', async () => {
      prismaMock.department.findFirst.mockResolvedValue({ id: 'dept-1' });
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      prismaMock.departmentMembership.upsert.mockResolvedValue({
        id: 'membership-1',
        personId: 'person-1',
        departmentId: 'dept-1',
        role: 'Lead',
      });

      const result = await service.addMember('dept-1', {
        personId: 'person-1',
        role: 'Lead',
      });

      expect(result.role).toBe('Lead');
    });

    it('should throw NotFoundException if department does not exist', async () => {
      prismaMock.department.findFirst.mockResolvedValue(null);

      await expect(
        service.addMember('dept-1', { personId: 'person-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if person does not exist', async () => {
      prismaMock.department.findFirst.mockResolvedValue({ id: 'dept-1' });
      prismaMock.person.findFirst.mockResolvedValue(null);

      await expect(
        service.addMember('dept-1', { personId: 'person-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember', () => {
    it('should remove member from department', async () => {
      prismaMock.department.findFirst.mockResolvedValue({ id: 'dept-1' });
      prismaMock.departmentMembership.findUnique.mockResolvedValue({
        id: 'membership-1',
      });
      prismaMock.departmentMembership.delete.mockResolvedValue({});

      const result = await service.removeMember('dept-1', 'person-1');

      expect(result.message).toContain('removed from department successfully');
    });

    it('should throw NotFoundException if membership not found', async () => {
      prismaMock.department.findFirst.mockResolvedValue({ id: 'dept-1' });
      prismaMock.departmentMembership.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('dept-1', 'person-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
