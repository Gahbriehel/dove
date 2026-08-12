import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import {
  CurrentUser,
  type ActiveUserData,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import type { IEmailService } from '../email/interfaces/email-service.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    const roleName = dto.role ?? 'ADMIN';
    const role = await this.rolesService.findByName(roleName);
    if (!role) {
      throw new BadRequestException(
        `Role "${roleName}" does not exist in the database. Please ensure roles are seeded.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.createUser({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      churchId: userChurchId,
      roleIds: [role.id],
    });

    const church = user.churchId
      ? await this.prisma.church.findUnique({
          where: { id: user.churchId },
        })
      : null;

    const loginUrl =
      this.configService.get<string>('LOGIN_URL') ||
      'http://localhost:3000/login';

    // Send welcome email with initial plain-text temporary password
    this.emailService
      .sendAdminWelcome({
        recipientEmail: dto.email,
        recipientName: `${dto.firstName} ${dto.lastName}`.trim(),
        temporaryPassword: dto.password,
        churchName: church?.name,
        loginUrl,
      })
      .catch((error) => {
        this.logger.error(
          `Failed to dispatch admin welcome email to ${dto.email}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

    return { message: 'User created successfully', user };
  }

  @Get()
  @ApiOperation({ summary: 'List all users (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async findAll(
    @Query() query: QueryUserDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.usersService.findAll(query, userChurchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by ID (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.usersService.findOne(id, userChurchId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a user name or activation status (Super Admin only)',
  })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    const user = await this.usersService.update(id, dto, userChurchId);
    return { message: 'User updated successfully', user };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a user (Super Admin and Admin only)',
  })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete own account' })
  @ApiResponse({
    status: 403,
    description: 'Admins cannot delete Super Admin users',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: ActiveUserData,
  ) {
    return this.usersService.remove(id, currentUser);
  }
}
