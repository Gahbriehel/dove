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
import { CreateScriptureDto } from './dto/create-scripture.dto';
import { QueryScripturesDto } from './dto/query-scriptures.dto';
import { UpdateScriptureDto } from './dto/update-scripture.dto';
import { ScripturesService } from './scriptures.service';

@ApiTags('Scriptures')
@Controller('scriptures')
export class ScripturesController {
  constructor(private readonly scripturesService: ScripturesService) {}

  @Public()
  @Get('current')
  @ResponseMessage('Current scriptures retrieved successfully')
  @ApiOperation({
    summary:
      'Get current Scripture of the Week and Scripture of the Year (Public)',
  })
  @ApiResponse({
    status: 200,
    description: 'Current scriptures retrieved successfully',
  })
  async getCurrent(
    @Query('churchId') churchId: string | undefined,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: ActiveUserData,
  ) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return this.scripturesService.getCurrentScriptures(churchId, user);
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Scriptures retrieved successfully')
  @ApiOperation({
    summary: 'List all scriptures with filtering and pagination (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Scriptures retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Query() query: QueryScripturesDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.scripturesService.findAll(query, user);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Scripture created successfully')
  @ApiOperation({
    summary: 'Create a new scripture (Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Scripture created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() dto: CreateScriptureDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.scripturesService.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Scripture updated successfully')
  @ApiOperation({
    summary: 'Update an existing scripture (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Scripture updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Scripture not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateScriptureDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.scripturesService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Scripture deleted successfully')
  @ApiOperation({
    summary: 'Delete a scripture (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Scripture deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Scripture not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: ActiveUserData) {
    return this.scripturesService.remove(id, user);
  }
}
