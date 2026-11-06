import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { MemberSessionService } from '../member-session.service';

export interface MemberJwtPayload {
  sub: string;
  churchId: string;
  email?: string | null;
  phone?: string | null;
  membershipStatus?: string | null;
  aud?: string;
  type?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedMemberRequest extends Request {
  member: MemberJwtPayload;
  user?: MemberJwtPayload;
  rawToken: string;
}

@Injectable()
export class MemberAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: MemberSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedMemberRequest>();
    const authHeader = request.headers?.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Authentication token is required');
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const secret = this.configService.get<string>('jwt.secret');

    let payload: MemberJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<MemberJwtPayload>(token, {
        secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (
      payload.type !== 'MEMBER' ||
      payload.aud !== 'dove:member' ||
      !payload.sub ||
      !payload.churchId
    ) {
      throw new UnauthorizedException('Invalid member token');
    }

    if (this.sessionService.isRevoked(payload.jti, token)) {
      throw new UnauthorizedException('Session has been revoked');
    }

    request.member = payload;
    request.user = payload;
    request.rawToken = token;

    return true;
  }
}
