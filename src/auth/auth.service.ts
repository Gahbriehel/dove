import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

interface JwtRefreshPayload {
  sub: string;
  email: string;
  roles: string[];
  churchId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      roles,
      user.churchId,
    );

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        churchId: user.churchId,
      },
    };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    let payload: JwtRefreshPayload;
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');

    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshTokenDto.refreshToken,
        {
          secret: refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = payload.sub;
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer exists or is inactive');
    }

    const activeTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    let matchingToken: RefreshToken | null = null;
    for (const tokenRecord of activeTokens) {
      const isMatch = await bcrypt.compare(
        refreshTokenDto.refreshToken,
        tokenRecord.tokenHash,
      );
      if (isMatch) {
        matchingToken = tokenRecord;
        break;
      }
    }

    if (!matchingToken) {
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    // Revoke old refresh token (refresh token rotation)
    await this.prisma.refreshToken.update({
      where: { id: matchingToken.id },
      data: { isRevoked: true },
    });

    const roles = user.userRoles.map((ur) => ur.role.name);
    return this.generateTokens(user.id, user.email, roles, user.churchId);
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles,
      church: user.church
        ? {
            id: user.church.id,
            name: user.church.name,
            slug: user.church.slug,
          }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    roles: string[],
    churchId: string,
  ) {
    const jwtSecret = this.configService.get<string>('jwt.secret');
    const jwtExpiresIn =
      this.configService.get<string>('jwt.expiresIn') || '1d';
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    const payload = { sub: userId, email, roles, churchId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn as unknown as number,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as unknown as number,
      }),
    ]);

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
