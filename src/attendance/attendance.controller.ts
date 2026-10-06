import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { buildCsv, csvFilename, sendCsv } from '../common/utils/csv.util';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('checkin')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR', 'REGISTRATION_DESK')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Check-in successful')
  @ApiOperation({ summary: 'Check in an attendee via QR token (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Check-in successful, returns attendee & team details',
  })
  @ApiResponse({
    status: 400,
    description: 'Attendee has already checked in',
  })
  @ApiResponse({
    status: 404,
    description: 'Invalid registration token',
  })
  async checkIn(
    @Body() checkInDto: CheckInDto,
    @CurrentUser('sub') adminUserId?: string,
    @CurrentUser('churchId') userChurchId?: string,
  ) {
    return this.attendanceService.checkIn(
      checkInDto,
      adminUserId,
      userChurchId,
    );
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR', 'REGISTRATION_DESK')
  @ResponseMessage('Attendance records retrieved successfully')
  @ApiOperation({
    summary: 'List attendance check-in records with filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'List of attendance check-in records',
  })
  async findAll(
    @Query() query: QueryAttendanceDto,
    @CurrentUser('churchId') userChurchId?: string,
  ) {
    return this.attendanceService.findAll(query, userChurchId);
  }

  @Get('export')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR', 'REGISTRATION_DESK')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export attendance check-in log as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file of attendance records' })
  async exportCsv(
    @Query() query: QueryAttendanceDto,
    @CurrentUser('churchId') userChurchId: string,
    @Res() res: Response,
  ): Promise<void> {
    const attendance = await this.attendanceService.exportAll(
      query,
      userChurchId,
    );
    const csv = buildCsv(attendance, [
      { header: 'Attendance ID', value: (r) => r.id },
      {
        header: 'Registration #',
        value: (r) => r.registration.registrationNumber,
      },
      {
        header: 'First Name',
        value: (r) => r.registration.person.firstName,
      },
      {
        header: 'Last Name',
        value: (r) => r.registration.person.lastName,
      },
      {
        header: 'Email',
        value: (r) => r.registration.person.email || '',
      },
      {
        header: 'Phone',
        value: (r) => r.registration.person.phone || '',
      },
      {
        header: 'Event',
        value: (r) => r.registration.event.title,
      },
      {
        header: 'Team',
        value: (r) => r.registration.team?.name || 'Unassigned',
      },
      { header: 'Checked In At', value: (r) => r.checkedInAt },
      { header: 'Checked In By', value: (r) => r.checkedInBy || '' },
    ]);
    sendCsv(res, csvFilename('attendance'), csv);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR', 'REGISTRATION_DESK')
  @ResponseMessage('Check-in undone successfully')
  @ApiOperation({
    summary: 'Undo an accidental check-in and revert registration to confirmed',
  })
  @ApiResponse({
    status: 200,
    description: 'Check-in record removed and registration status reverted',
  })
  @ApiResponse({
    status: 404,
    description: 'Attendance record not found',
  })
  async undoCheckIn(
    @Param('id') id: string,
    @CurrentUser('churchId') userChurchId?: string,
  ) {
    return this.attendanceService.undoCheckIn(id, userChurchId);
  }
}
