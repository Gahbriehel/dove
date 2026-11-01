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
import {
  CurrentUser,
  type ActiveUserData,
} from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ConfirmOutreachDto } from './dto/confirm-outreach.dto';
import { CreateOutreachDto } from './dto/create-outreach.dto';
import { PreviewOutreachDto } from './dto/preview-outreach.dto';
import { QueryOutreachDto } from './dto/query-outreach.dto';
import { QueryTodayDto } from './dto/query-today.dto';
import { OutreachService } from './outreach.service';

@ApiTags('Outreach')
@ApiBearerAuth()
@Controller('outreach')
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Post('whatsapp/preview')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Message prepared successfully')
  @ApiOperation({
    summary:
      'Write the WhatsApp message for a person. Nothing is saved; returns the text, number and any warnings.',
  })
  @ApiResponse({ status: 400, description: 'Person or check-in mismatch' })
  preview(
    @Body() dto: PreviewOutreachDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.outreachService.preview(dto, user);
  }

  @Post('whatsapp')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Outreach recorded successfully')
  @ApiOperation({
    summary: 'Record that an admin opened WhatsApp with a prepared message',
  })
  @ApiResponse({
    status: 409,
    description: 'Person has no valid phone number or opted out of WhatsApp',
  })
  open(@Body() dto: CreateOutreachDto, @CurrentUser() user: ActiveUserData) {
    return this.outreachService.open(dto, user);
  }

  @Get('today')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @ResponseMessage("Today's outreach retrieved successfully")
  @ApiOperation({
    summary:
      "Today's outreach to-do list: birthdays, due check-ins, visitors to follow up and unconfirmed messages",
  })
  today(@Query() query: QueryTodayDto, @CurrentUser() user: ActiveUserData) {
    return this.outreachService.today(query, user);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @ResponseMessage('Outreach log retrieved successfully')
  @ApiOperation({ summary: 'Paginated outreach log' })
  findAll(
    @Query() query: QueryOutreachDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.outreachService.findAll(query, user);
  }

  @Patch(':id/confirm')
  @Roles('SUPER_ADMIN', 'ADMIN', 'COORDINATOR')
  @ResponseMessage('Outreach outcome recorded successfully')
  @ApiOperation({
    summary:
      'Record whether the message was sent. Confirming applies the follow-up side effects.',
  })
  @ApiResponse({ status: 403, description: 'Not the sender or an admin' })
  @ApiResponse({ status: 404, description: 'Outreach message not found' })
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmOutreachDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.outreachService.confirm(id, dto, user);
  }
}
