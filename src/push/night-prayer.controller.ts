import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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
import { PrismaService } from '../prisma/prisma.service';
import { CreateNightPrayerExceptionDto } from './dto/night-prayer-exception.dto';
import { PutNightPrayerDto } from './dto/night-prayer.dto';
import { NightPrayerService } from './night-prayer.service';

@ApiTags('Night Prayer')
@Controller('night-prayer')
export class NightPrayerController {
  constructor(
    private readonly nightPrayerService: NightPrayerService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('next')
  @ResponseMessage('Next night prayer retrieved successfully')
  @ApiOperation({
    summary: 'What the home card shows (Public, Cache-Control: no-store)',
  })
  @ApiResponse({
    status: 200,
    description: 'Next night prayer retrieved successfully',
  })
  async getNext(
    @Query('churchId') queryChurchId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    const churchId = queryChurchId || (await this.prisma.getDefaultChurchId());
    return this.nightPrayerService.getNextNightPrayer(churchId);
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Night prayer configuration retrieved successfully')
  @ApiOperation({
    summary: 'Get Night Prayer configuration for the church (Admin only)',
  })
  async getNightPrayer(@CurrentUser() user: ActiveUserData) {
    return this.nightPrayerService.getNightPrayer(user.churchId);
  }

  @Put()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Night prayer configuration saved successfully')
  @ApiOperation({
    summary:
      'Create or replace Night Prayer configuration for the church (Admin only)',
  })
  async putNightPrayer(
    @Body() dto: PutNightPrayerDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.nightPrayerService.putNightPrayer(user.churchId, dto, user.sub);
  }

  @Get('exceptions')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Night prayer exceptions retrieved successfully')
  @ApiOperation({
    summary: 'Upcoming night prayer exceptions (Admin only)',
  })
  async getExceptions(@CurrentUser() user: ActiveUserData) {
    return this.nightPrayerService.getExceptions(user.churchId);
  }

  @Post('exceptions')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Night prayer exception saved successfully')
  @ApiOperation({
    summary: 'Cancel or annotate a date for night prayer (Admin only)',
  })
  async createException(
    @Body() dto: CreateNightPrayerExceptionDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.nightPrayerService.createException(user.churchId, dto);
  }

  @Delete('exceptions/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Night prayer exception removed successfully')
  @ApiOperation({
    summary: 'Remove an exception by ID (Admin only)',
  })
  async removeException(
    @Param('id') id: string,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.nightPrayerService.removeException(id, user.churchId);
  }
}
