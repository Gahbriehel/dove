import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import type { IEmailService } from '../email/interfaces/email-service.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
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

    const now = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActive: now },
    });

    const { ...fullUserData } = user;
    fullUserData.lastActive = now;

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

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
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
      lastActive: user.lastActive,
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

  async forgotPassword(dto: ForgotPasswordDto) {
    // Always return the same response so account existence is not revealed.
    const genericResponse = {
      message:
        'If an account exists for that email, a password reset link has been sent.',
    };

    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      return genericResponse;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Invalidate any earlier unused links, then issue a new one
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const baseUrl =
      this.configService.get<string>('RESET_PASSWORD_URL') ||
      `${this.configService.get<string>('APP_URL') || 'http://localhost:3000'}/reset-password`;
    const resetUrl = `${baseUrl}?token=${rawToken}`;

    try {
      await this.emailService.sendCustomBroadcast({
        recipientEmail: user.email,
        recipientName: `${user.firstName} ${user.lastName}`.trim(),
        subject: 'Reset your password',
        heading: 'Reset your password',
        message:
          'We received a request to reset your password. This link expires in 1 hour. If you did not request this, you can safely ignore this email.',
        ctaLabel: 'Reset password',
        ctaUrl: resetUrl,
        churchName: user.church?.name,
        emailType: 'PASSWORD_RESET',
        churchId: user.churchId,
        userId: user.id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${user.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(record.userId, newPasswordHash);
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId },
    });

    return { message: 'Password reset successfully. Please log in.' };
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
