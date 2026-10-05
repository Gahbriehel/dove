import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { BirthdaysService } from './birthdays.service';
import {
  BirthdayAnalyticsResponseDto,
  QueryBirthdayAnalyticsDto,
} from './dto/birthday-analytics.dto';
import { BirthdayListResponseDto } from './dto/birthday-response.dto';
import { QueryBirthdayDto } from './dto/query-birthday.dto';
import { SendBirthdayGreetingDto } from './dto/send-birthday-greeting.dto';

@ApiTags('Birthdays')
@ApiBearerAuth()
@Controller('birthdays')
export class BirthdaysController {
  constructor(private readonly birthdaysService: BirthdaysService) {}

  @Post('send')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Birthday greeting sent successfully')
  @ApiOperation({
    summary:
      'Send a birthday greeting email with duplicate protection and audit logging',
  })
  @ApiResponse({
    status: 200,
    description: 'Birthday greeting sent successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Person has no valid email address or date of birth',
  })
  @ApiResponse({
    status: 404,
    description: 'Person not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Birthday greeting for this person has already been sent for the target cycle',
  })
  async sendGreeting(
    @Body() dto: SendBirthdayGreetingDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.birthdaysService.sendBirthdayGreeting(
      dto,
      userId,
      userChurchId,
    );
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Birthdays retrieved successfully')
  @ApiOperation({
    summary:
      'List member birthdays with current greeting status, sender info, and filter support',
  })
  @ApiResponse({
    status: 200,
    description: 'List of birthdays retrieved successfully',
    type: BirthdayListResponseDto,
  })
  async getBirthdays(
    @Query() query: QueryBirthdayDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.birthdaysService.getBirthdays(query, userChurchId);
  }

  @Get('analytics')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Birthday analytics retrieved successfully')
  @ApiOperation({
    summary:
      'Get birthday coverage analytics (Total, Completed, Missed, Pending, and Handling Rate %)',
  })
  @ApiResponse({
    status: 200,
    description: 'Birthday analytics retrieved successfully',
    type: BirthdayAnalyticsResponseDto,
  })
  async getAnalytics(
    @Query() query: QueryBirthdayAnalyticsDto,
    @CurrentUser('churchId') userChurchId: string,
  ) {
    return this.birthdaysService.getBirthdayAnalytics(query, userChurchId);
  }
}
