import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ActiveUserData } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  churchId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private lastActiveUpdates = new Map<string, number>();

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): ActiveUserData {
    if (!payload.sub || !payload.email || !payload.churchId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const userId = payload.sub;
    const now = Date.now();
    const lastUpdate = this.lastActiveUpdates.get(userId) || 0;

    // Throttle database updates to once every 1 minute (60,000 ms)
    if (now - lastUpdate > 60000) {
      this.lastActiveUpdates.set(userId, now);
      // Perform database update asynchronously
      this.prisma.user
        .update({
          where: { id: userId },
          data: { lastActive: new Date(now) },
        })
        .catch((err) => {
          console.error(`Failed to update lastActive for user ${userId}:`, err);
        });
    }

    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
      churchId: payload.churchId,
    };
  }
}
