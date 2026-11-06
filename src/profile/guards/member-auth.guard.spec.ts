import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MemberSessionService } from '../member-session.service';
import { MemberAuthGuard, MemberJwtPayload } from './member-auth.guard';

describe('MemberAuthGuard', () => {
  let guard: MemberAuthGuard;
  let jwtServiceMock: {
    verifyAsync: jest.Mock;
  };
  let configServiceMock: {
    get: jest.Mock;
  };
  let sessionService: MemberSessionService;

  beforeEach(() => {
    jwtServiceMock = {
      verifyAsync: jest.fn(),
    };
    configServiceMock = {
      get: jest.fn().mockReturnValue('test-secret'),
    };
    sessionService = new MemberSessionService();
    guard = new MemberAuthGuard(
      jwtServiceMock as unknown as JwtService,
      configServiceMock as unknown as ConfigService,
      sessionService,
    );
  });

  interface MockRequest {
    headers: Record<string, string>;
    member?: MemberJwtPayload;
    user?: MemberJwtPayload;
    rawToken?: string;
  }

  const createMockContext = (headers: Record<string, string>) => {
    const request: MockRequest = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const ctx = createMockContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new UnauthorizedException('Authentication token is required'),
    );
  });

  it('throws UnauthorizedException when Authorization header format is not Bearer', async () => {
    const ctx = createMockContext({ authorization: 'Basic xyz' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new UnauthorizedException('Invalid authorization header format'),
    );
  });

  it('throws UnauthorizedException when token verification fails', async () => {
    jwtServiceMock.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const ctx = createMockContext({ authorization: 'Bearer invalid.token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired token'),
    );
  });

  it('throws UnauthorizedException when token is not a member token', async () => {
    jwtServiceMock.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      churchId: 'church-1',
      // Missing type: 'MEMBER' and aud: 'dove:member'
    });
    const ctx = createMockContext({ authorization: 'Bearer staff.token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new UnauthorizedException('Invalid member token'),
    );
  });

  it('throws UnauthorizedException when token has been revoked', async () => {
    const payload = {
      sub: 'person-1',
      churchId: 'church-1',
      type: 'MEMBER',
      aud: 'dove:member',
      jti: 'token-jti-123',
    };
    jwtServiceMock.verifyAsync.mockResolvedValue(payload);
    sessionService.revoke('token-jti-123', Date.now() + 60000);

    const ctx = createMockContext({ authorization: 'Bearer valid.token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new UnauthorizedException('Session has been revoked'),
    );
  });

  it('attaches member payload and rawToken to request on success', async () => {
    const payload = {
      sub: 'person-1',
      churchId: 'church-1',
      type: 'MEMBER',
      aud: 'dove:member',
      jti: 'token-jti-456',
    };
    jwtServiceMock.verifyAsync.mockResolvedValue(payload);

    const request: MockRequest = {
      headers: { authorization: 'Bearer valid.member.token' },
    };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(request.member).toEqual(payload);
    expect(request.rawToken).toBe('valid.member.token');
  });
});
