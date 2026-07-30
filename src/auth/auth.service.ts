import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

interface JwtRefreshPayload {
  sub: string;
  email: string;
  roles: string[];
  churchId: string;
  jti?: string;
}

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
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

    const { ...fullUserData } = user;

    return {
      tokens,
      user: {
        ...fullUserData,
        roles,
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

    // Fast O(1) lookup using jti token ID
    let matchingToken = null;
    if (payload.jti) {
      const tokenRecord = await this.prisma.refreshToken.findUnique({
        where: { id: payload.jti },
      });
      if (
        tokenRecord &&
        !tokenRecord.isRevoked &&
        tokenRecord.expiresAt > new Date() &&
        tokenRecord.userId === userId
      ) {
        const isMatch = await bcrypt.compare(
          refreshTokenDto.refreshToken,
          tokenRecord.tokenHash,
        );
        if (isMatch) {
          matchingToken = tokenRecord;
        }
      }
    } else {
      // Fallback for legacy tokens without jti
      const activeTokens = await this.prisma.refreshToken.findMany({
        where: {
          userId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
      });
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

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new UnauthorizedException(
        'New password must be different from current password',
      );
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(userId, newPasswordHash);

    return { message: 'Password changed successfully. Please log in again.' };
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

    const tokenId = crypto.randomUUID();
    const accessPayload = { sub: userId, email, roles, churchId };
    const refreshPayload = {
      sub: userId,
      email,
      roles,
      churchId,
      jti: tokenId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn as unknown as number,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as unknown as number,
      }),
    ]);

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(refreshExpiresIn),
    );

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
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
