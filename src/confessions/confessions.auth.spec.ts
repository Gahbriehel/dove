import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { type ActiveUserData } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('Confessions Authorization and Guard Enforcement', () => {
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  function createMockContext(
    user: ActiveUserData | undefined,
    requiredRoles?: string[],
  ): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  describe('RolesGuard for ADMIN / SUPER_ADMIN write endpoints', () => {
    const requiredRoles = ['ADMIN', 'SUPER_ADMIN'];

    it('allows ADMIN caller', () => {
      const context = createMockContext(
        {
          sub: 'admin-1',
          email: 'admin@church.org',
          roles: ['ADMIN'],
          churchId: 'church-1',
        },
        requiredRoles,
      );
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('allows SUPER_ADMIN caller', () => {
      const context = createMockContext(
        {
          sub: 'sa-1',
          email: 'sa@church.org',
          roles: ['SUPER_ADMIN'],
          churchId: 'church-1',
        },
        requiredRoles,
      );
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('rejects COORDINATOR caller with 403 Forbidden', () => {
      const context = createMockContext(
        {
          sub: 'coord-1',
          email: 'coord@church.org',
          roles: ['COORDINATOR'],
          churchId: 'church-1',
        },
        requiredRoles,
      );
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('rejects anonymous caller with 403 Forbidden if user is missing', () => {
      const context = createMockContext(undefined, requiredRoles);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('JwtStrategy Member Token Rejection', () => {
    let jwtStrategy: JwtStrategy;
    const configServiceMock = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    const prismaServiceMock = {
      user: { update: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;

    beforeEach(() => {
      jwtStrategy = new JwtStrategy(configServiceMock, prismaServiceMock);
    });

    it('rejects member token with type: "member" with 401 Unauthorized', () => {
      expect(() =>
        jwtStrategy.validate({
          sub: 'member-1',
          email: 'member@test.com',
          roles: [],
          churchId: 'church-1',
          type: 'member',
        }),
      ).toThrow(UnauthorizedException);
    });

    it('rejects member token with type: "MEMBER" with 401 Unauthorized', () => {
      expect(() =>
        jwtStrategy.validate({
          sub: 'member-1',
          email: 'member@test.com',
          roles: [],
          churchId: 'church-1',
          type: 'MEMBER',
        }),
      ).toThrow(UnauthorizedException);
    });

    it('rejects member token with aud: "dove:member" with 401 Unauthorized', () => {
      expect(() =>
        jwtStrategy.validate({
          sub: 'member-1',
          email: 'member@test.com',
          roles: [],
          churchId: 'church-1',
          aud: 'dove:member',
        }),
      ).toThrow(UnauthorizedException);
    });

    it('accepts valid staff payload', () => {
      const result = jwtStrategy.validate({
        sub: 'staff-1',
        email: 'staff@church.org',
        roles: ['ADMIN'],
        churchId: 'church-1',
      });
      expect(result).toEqual({
        sub: 'staff-1',
        email: 'staff@church.org',
        roles: ['ADMIN'],
        churchId: 'church-1',
      });
    });
  });
});
