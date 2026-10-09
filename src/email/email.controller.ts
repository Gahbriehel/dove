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
import { EmailLogListResponseDto } from './dto/email-log-response.dto';
import { QueryEmailLogsDto } from './dto/query-email-logs.dto';
import { SendBatchPeopleEmailDto } from './dto/send-batch-people-email.dto';
import { SendBatchRegistrantsEmailDto } from './dto/send-batch-registrants-email.dto';
import { SendPersonEmailDto } from './dto/send-person-email.dto';
import { SendRegistrantEmailDto } from './dto/send-registrant-email.dto';
import { EmailService } from './email.service';

@ApiTags('Email')
@ApiBearerAuth()
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('logs')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email logs retrieved successfully')
  @ApiOperation({
    summary:
      'Get unified paginated log of all sent emails across all modules with recipient and delivery details',
  })
  @ApiResponse({
    status: 200,
    description: 'Email logs retrieved successfully',
    type: EmailLogListResponseDto,
  })
  async getEmailLogs(
    @Query() query: QueryEmailLogsDto,
    @CurrentUser('churchId') userChurchId: string,
  ): Promise<EmailLogListResponseDto> {
    return this.emailService.getEmailLogs(query, userChurchId);
  }

  @Post('people/single')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email sent to person successfully')
  @ApiOperation({ summary: 'Send a custom email to an individual person' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({
    status: 400,
    description: 'Person has no valid email address',
  })
  @ApiResponse({ status: 404, description: 'Person not found' })
  async sendToPerson(
    @Body() dto: SendPersonEmailDto,
    @CurrentUser('churchId') userChurchId: string,
    @CurrentUser('sub') sentByUserId: string,
  ) {
    return this.emailService.sendToPerson(dto, userChurchId, sentByUserId);
  }

  @Post('people/batch')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Batch email sent to people successfully')
  @ApiOperation({
    summary:
      'Send custom broadcast email to a batch of people (filtered by status, search, or ID array)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Batch email process completed, returns delivery status metrics',
  })
  @ApiResponse({
    status: 400,
    description: 'No matching people found with valid email addresses',
  })
  async sendToPeopleBatch(
    @Body() dto: SendBatchPeopleEmailDto,
    @CurrentUser('churchId') userChurchId: string,
    @CurrentUser('sub') sentByUserId: string,
  ) {
    return this.emailService.sendToPeopleBatch(dto, userChurchId, sentByUserId);
  }

  @Post('registrants/single')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email sent to registrant successfully')
  @ApiOperation({
    summary:
      'Send a custom email or ticket reminder to an individual event registrant',
  })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({
    status: 400,
    description: 'Registrant person has no valid email address',
  })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async sendToRegistrant(
    @Body() dto: SendRegistrantEmailDto,
    @CurrentUser('churchId') userChurchId: string,
    @CurrentUser('sub') sentByUserId: string,
  ) {
    return this.emailService.sendToRegistrant(dto, userChurchId, sentByUserId);
  }

  @Post('registrants/batch')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Batch email sent to registrants successfully')
  @ApiOperation({
    summary:
      'Send custom broadcast email to a batch of event registrants (filtered by eventId, status, teamId, search, or ID array)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Batch email process completed, returns delivery status metrics',
  })
  @ApiResponse({
    status: 400,
    description: 'No matching registrants found with valid email addresses',
  })
  async sendToRegistrantsBatch(
    @Body() dto: SendBatchRegistrantsEmailDto,
    @CurrentUser('churchId') userChurchId: string,
    @CurrentUser('sub') sentByUserId: string,
  ) {
    return this.emailService.sendToRegistrantsBatch(
      dto,
      userChurchId,
      sentByUserId,
    );
  }
}
