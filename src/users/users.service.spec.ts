import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { ActiveUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    user: {
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      user: {
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('remove', () => {
    const adminUser: ActiveUserData = {
      sub: 'admin-1',
      email: 'admin@example.com',
      roles: ['ADMIN'],
      churchId: 'church-1',
    };

    const superAdminUser: ActiveUserData = {
      sub: 'superadmin-1',
      email: 'superadmin@example.com',
      roles: ['SUPER_ADMIN'],
      churchId: 'church-1',
    };

    it('should throw BadRequestException if user tries to delete themselves', async () => {
      await expect(service.remove('admin-1', adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if user to delete is not found', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.remove('target-1', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if Admin tries to delete Super Admin', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'target-superadmin',
        churchId: 'church-1',
        userRoles: [{ role: { id: 'r1', name: 'SUPER_ADMIN' } }],
      });

      await expect(
        service.remove('target-superadmin', adminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Super Admin to delete a Super Admin user', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'target-superadmin',
        churchId: 'church-1',
        userRoles: [{ role: { id: 'r1', name: 'SUPER_ADMIN' } }],
      });
      prismaMock.user.delete.mockResolvedValue({ id: 'target-superadmin' });

      const result = await service.remove('target-superadmin', superAdminUser);
      expect(result).toEqual({ message: 'User deleted successfully' });
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: 'target-superadmin' },
      });
    });

    it('should allow Admin to delete a standard Admin / User', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'target-user',
        churchId: 'church-1',
        userRoles: [{ role: { id: 'r2', name: 'ADMIN' } }],
      });
      prismaMock.user.delete.mockResolvedValue({ id: 'target-user' });

      const result = await service.remove('target-user', adminUser);
      expect(result).toEqual({ message: 'User deleted successfully' });
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: 'target-user' },
      });
    });
  });
});
