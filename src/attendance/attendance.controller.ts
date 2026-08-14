import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('checkin')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR', 'REGISTRATION_DESK')
  @ApiBearerAuth()
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
}
