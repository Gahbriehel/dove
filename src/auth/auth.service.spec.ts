import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersServiceMock: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    updatePassword: jest.Mock;
  };
  let jwtServiceMock: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
  };
  let configServiceMock: {
    get: jest.Mock;
  };
  let prismaMock: {
    user: {
      update: jest.Mock;
    };
    refreshToken: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    usersServiceMock = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updatePassword: jest.fn(),
    };

    jwtServiceMock = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'jwt.secret') return 'jwt-secret';
        if (key === 'jwt.expiresIn') return '1d';
        if (key === 'jwt.refreshSecret') return 'refresh-secret';
        if (key === 'jwt.refreshExpiresIn') return '7d';
        return null;
      }),
    };

    prismaMock = {
      user: {
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    const password = 'CorrectPassword123!';
    let passwordHash: string;

    beforeAll(async () => {
      passwordHash = await bcrypt.hash(password, 10);
    });

    it('should authenticate user and return tokens and user profile on valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        churchId: 'church-1',
        email: 'admin@dove.church',
        passwordHash,
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        userRoles: [{ role: { name: 'ADMIN' } }],
      };

      usersServiceMock.findByEmail.mockResolvedValue(mockUser);
      jwtServiceMock.signAsync
        .mockResolvedValueOnce('mock-access-token')
        .mockResolvedValueOnce('mock-refresh-token');

      const result = await service.login({
        email: 'admin@dove.church',
        password,
      });

      expect(result.tokens.accessToken).toBe('mock-access-token');
      expect(result.tokens.refreshToken).toBe('mock-refresh-token');
      expect(result.user.email).toBe('admin@dove.church');
      expect(result.user.roles).toEqual(['ADMIN']);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
        }),
      );
      expect(prismaMock.refreshToken.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@dove.church', password }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if user account is deactivated', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'user-inactive',
        email: 'inactive@dove.church',
        isActive: false,
        passwordHash,
      });

      await expect(
        service.login({ email: 'inactive@dove.church', password }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'admin@dove.church',
        isActive: true,
        passwordHash,
      });

      await expect(
        service.login({
          email: 'admin@dove.church',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    const rawRefreshToken = 'valid-refresh-token';
    let hashedToken: string;

    beforeAll(async () => {
      hashedToken = await bcrypt.hash(rawRefreshToken, 10);
    });

    it('should rotate refresh token and return new tokens using jti lookup', async () => {
      const payload = {
        sub: 'user-1',
        email: 'admin@dove.church',
        roles: ['ADMIN'],
        churchId: 'church-1',
        jti: 'token-uuid-1',
      };

      jwtServiceMock.verifyAsync.mockResolvedValue(payload);
      usersServiceMock.findById.mockResolvedValue({
        id: 'user-1',
        churchId: 'church-1',
        email: 'admin@dove.church',
        isActive: true,
        userRoles: [{ role: { name: 'ADMIN' } }],
      });

      prismaMock.refreshToken.findUnique.mockResolvedValue({
        id: 'token-uuid-1',
        userId: 'user-1',
        tokenHash: hashedToken,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
      });

      jwtServiceMock.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshTokens({
        refreshToken: rawRefreshToken,
      });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-uuid-1' },
        data: { isRevoked: true },
      });
      expect(prismaMock.refreshToken.create).toHaveBeenCalled();
    });

    it('should rotate refresh token using fallback list lookup when jti is absent', async () => {
      const payload = {
        sub: 'user-1',
        email: 'admin@dove.church',
        roles: ['ADMIN'],
        churchId: 'church-1',
      };

      jwtServiceMock.verifyAsync.mockResolvedValue(payload);
      usersServiceMock.findById.mockResolvedValue({
        id: 'user-1',
        churchId: 'church-1',
        email: 'admin@dove.church',
        isActive: true,
        userRoles: [{ role: { name: 'ADMIN' } }],
      });

      prismaMock.refreshToken.findMany.mockResolvedValue([
        {
          id: 'token-legacy-1',
          userId: 'user-1',
          tokenHash: hashedToken,
          isRevoked: false,
          expiresAt: new Date(Date.now() + 1000000),
        },
      ]);

      jwtServiceMock.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshTokens({
        refreshToken: rawRefreshToken,
      });

      expect(result.accessToken).toBe('new-access-token');
      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-legacy-1' },
        data: { isRevoked: true },
      });
    });

    it('should throw UnauthorizedException if token verification fails', async () => {
      jwtServiceMock.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.refreshTokens({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is deactivated or not found', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'admin@dove.church',
      });
      usersServiceMock.findById.mockResolvedValue({
        id: 'user-1',
        isActive: false,
      });

      await expect(
        service.refreshTokens({ refreshToken: rawRefreshToken }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if refresh token is revoked or expired', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'admin@dove.church',
        jti: 'token-uuid-revoked',
      });
      usersServiceMock.findById.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        userRoles: [],
      });
      prismaMock.refreshToken.findUnique.mockResolvedValue({
        id: 'token-uuid-revoked',
        userId: 'user-1',
        tokenHash: hashedToken,
        isRevoked: true,
        expiresAt: new Date(Date.now() + 1000000),
      });

      await expect(
        service.refreshTokens({ refreshToken: rawRefreshToken }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile formatted with roles and church', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@dove.church',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
        church: { id: 'church-1', name: 'Grace Chapel', slug: 'grace-chapel' },
        userRoles: [{ role: { name: 'SUPER_ADMIN' } }],
      };

      usersServiceMock.findById.mockResolvedValue(mockUser);

      const profile = await service.getProfile('user-1');
      expect(profile.id).toBe('user-1');
      expect(profile.email).toBe('admin@dove.church');
      expect(profile.roles).toEqual(['SUPER_ADMIN']);
      expect(profile.church?.name).toBe('Grace Chapel');
    });

    it('should throw NotFoundException if user profile not found', async () => {
      usersServiceMock.findById.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('changePassword', () => {
    const currentPassword = 'OldPassword123!';
    const newPassword = 'NewPassword456!';
    let currentHash: string;

    beforeAll(async () => {
      currentHash = await bcrypt.hash(currentPassword, 10);
    });

    it('should successfully update password when current password is valid', async () => {
      usersServiceMock.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: currentHash,
      });

      const result = await service.changePassword('user-1', {
        currentPassword,
        newPassword,
      });

      expect(result.message).toContain('Password changed successfully');
      expect(usersServiceMock.updatePassword).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      usersServiceMock.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('user-1', { currentPassword, newPassword }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if current password does not match', async () => {
      usersServiceMock.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: currentHash,
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'WrongCurrentPassword',
          newPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if new password is equal to current password', async () => {
      usersServiceMock.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: currentHash,
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword,
          newPassword: currentPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
