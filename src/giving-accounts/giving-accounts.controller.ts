import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type ActiveUserData,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateGivingAccountDto } from './dto/create-giving-account.dto';
import { QueryGivingAccountDto } from './dto/query-giving-account.dto';
import { ReorderGivingAccountsDto } from './dto/reorder-giving-accounts.dto';
import { UpdateGivingAccountDto } from './dto/update-giving-account.dto';
import { GivingAccountsService } from './giving-accounts.service';

@ApiTags('Giving')
@Controller('giving-accounts')
export class GivingAccountsController {
  constructor(private readonly givingAccountsService: GivingAccountsService) {}

  @Public()
  @Get()
  @ResponseMessage('Giving accounts retrieved successfully')
  @ApiOperation({
    summary: 'List active giving accounts for the church (Public)',
    description:
      'Returns active accounts sorted by sortOrder and createdAt. Super Admins also receive inactive accounts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Giving accounts retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid purpose filter' })
  async findAll(
    @Query() query: QueryGivingAccountDto,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: ActiveUserData,
  ) {
    const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN') ?? false;

    if (!user) {
      res.setHeader('Cache-Control', 'public, max-age=60');
    } else if (isSuperAdmin) {
      res.setHeader('Cache-Control', 'no-store');
    }

    return this.givingAccountsService.findAll(query, user);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Giving account created successfully')
  @ApiOperation({
    summary: 'Create a new giving account (Super Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Giving account created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin required' })
  async create(
    @Body() createGivingAccountDto: CreateGivingAccountDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.givingAccountsService.create(createGivingAccountDto, user);
  }

  @Patch('reorder')
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Giving accounts reordered successfully')
  @ApiOperation({
    summary: 'Reorder giving accounts (Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Giving accounts reordered successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid IDs or IDs from another church',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin required' })
  async reorder(
    @Body() reorderDto: ReorderGivingAccountsDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.givingAccountsService.reorder(reorderDto, user);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Giving account updated successfully')
  @ApiOperation({
    summary: 'Update an existing giving account (Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Giving account updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin required' })
  @ApiResponse({ status: 404, description: 'Giving account not found' })
  async update(
    @Param('id') id: string,
    @Body() updateGivingAccountDto: UpdateGivingAccountDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.givingAccountsService.update(id, updateGivingAccountDto, user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Giving account deleted successfully')
  @ApiOperation({
    summary: 'Delete a giving account (Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Giving account deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin required' })
  @ApiResponse({ status: 404, description: 'Giving account not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: ActiveUserData) {
    return this.givingAccountsService.remove(id, user);
  }
}
