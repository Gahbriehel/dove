import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesService } from '../roles/roles.service';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Roles('SUPER_ADMIN')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new admin user (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    const roleName = dto.role ?? 'ADMIN';
    const role = await this.rolesService.findByName(roleName);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.createUser({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      churchId: userChurchId,
      roleIds: role ? [role.id] : [],
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
}
