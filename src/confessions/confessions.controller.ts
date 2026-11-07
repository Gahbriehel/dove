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
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  CurrentUser,
  type ActiveUserData,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ConfessionsService } from './confessions.service';
import { CreateConfessionDto } from './dto/create-confession.dto';
import { QueryConfessionsDto } from './dto/query-confessions.dto';
import { ReorderConfessionsDto } from './dto/reorder-confessions.dto';
import { UpdateConfessionDto } from './dto/update-confession.dto';
import { UpdateConfessionRemindersDto } from './dto/confession-reminders.dto';

@ApiTags('Confessions')
@Controller('confessions')
export class ConfessionsController {
  constructor(private readonly confessionsService: ConfessionsService) {}

  @Public()
  @Get()
  @ResponseMessage('Confessions retrieved successfully')
  @ApiOperation({
    summary: 'List published confessions (Admins also get drafts)',
  })
  @ApiResponse({
    status: 200,
    description: 'Confessions retrieved successfully',
  })
  async findAll(
    @Query() query: QueryConfessionsDto,
    @CurrentUser() user?: ActiveUserData,
  ) {
    return this.confessionsService.findAll(query, user);
  }

  @Public()
  @Get('categories')
  @ResponseMessage('Categories retrieved successfully')
  @ApiOperation({
    summary: 'Distinct categories of published confessions',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  async findCategories(
    @Query('churchId') churchId: string | undefined,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: ActiveUserData,
  ) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return this.confessionsService.findCategories(churchId, user);
  }

  @Patch('reorder')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Confessions reordered successfully')
  @ApiOperation({
    summary: 'Set the order of confessions (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Confessions reordered successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid reorder list' })
  async reorder(
    @Body() dto: ReorderConfessionsDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.confessionsService.reorder(dto, user);
  }

  @Public()
  @Get(':idOrSlug')
  @ResponseMessage('Confession retrieved successfully')
  @ApiOperation({
    summary: 'Get one confession with body, audio and neighbours',
  })
  @ApiResponse({
    status: 200,
    description: 'Confession retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Confession not found' })
  async findOne(
    @Param('idOrSlug') idOrSlug: string,
    @Query('churchId') churchId: string | undefined,
    @CurrentUser() user?: ActiveUserData,
  ) {
    return this.confessionsService.findOne(idOrSlug, churchId, user);
  }

  @Public()
  @Post(':id/listen')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Count one listen (Public, throttled ~20/min/IP)',
  })
  @ApiResponse({ status: 204, description: 'Listen counted' })
  @ApiResponse({ status: 404, description: 'Confession not found' })
  async recordListen(@Param('id') id: string) {
    await this.confessionsService.recordListen(id);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Confession created successfully')
  @ApiOperation({
    summary: 'Create a new confession (Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Confession created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Slug already taken' })
  async create(
    @Body() dto: CreateConfessionDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.confessionsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Confession updated successfully')
  @ApiOperation({
    summary: 'Update confession details or status (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Confession updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Confession not found' })
  @ApiResponse({ status: 409, description: 'Slug already taken' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateConfessionDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.confessionsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Confession deleted successfully')
  @ApiOperation({
    summary: 'Hard delete confession and audio files (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Confession deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Confession not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: ActiveUserData) {
    return this.confessionsService.remove(id, user);
  }

  @Put(':id/audio/:voice')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ResponseMessage('Audio uploaded successfully')
  @ApiOperation({
    summary:
      'Upload or replace MP3 audio for female or male voice (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Audio uploaded successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid audio file' })
  @ApiResponse({ status: 404, description: 'Confession not found' })
  async uploadAudio(
    @Param('id') id: string,
    @Param('voice') voice: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.confessionsService.uploadAudio(id, voice, file, user);
  }

  @Get(':id/reminders')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Confession reminders retrieved successfully')
  @ApiOperation({
    summary: 'List reminders for a confession (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Confession reminders retrieved successfully',
  })
  async getReminders(
    @Param('id') id: string,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.confessionsService.getReminders(id, user);
  }

  @Put(':id/reminders')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Confession reminders updated successfully')
  @ApiOperation({
    summary: 'Replace all reminders for a confession (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Confession reminders updated successfully',
  })
  async updateReminders(
    @Param('id') id: string,
    @Body() dto: UpdateConfessionRemindersDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.confessionsService.updateReminders(id, dto, user);
  }

  @Delete(':id/audio/:voice')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Audio deleted successfully')
  @ApiOperation({
    summary: 'Remove audio file for female or male voice (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Audio deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Audio or confession not found' })
  async removeAudio(
    @Param('id') id: string,
    @Param('voice') voice: string,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.confessionsService.removeAudio(id, voice, user);
  }
}
