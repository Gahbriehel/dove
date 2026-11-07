import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  CurrentUser,
  type ActiveUserData,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { EndpointDto } from './dto/endpoint.dto';
import { SubscribeDto } from './dto/subscribe.dto';
import { UpdateTopicsDto } from './dto/topics.dto';
import { PushTickService } from './push-tick.service';
import { PushService } from './push.service';

@ApiTags('Push Notifications')
@Controller('push')
export class PushController {
  constructor(
    private readonly pushService: PushService,
    private readonly pushTickService: PushTickService,
  ) {}

  @Public()
  @Post('subscribe')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Subscribed successfully')
  @ApiOperation({
    summary:
      'Register or refresh a device Web Push subscription (Public, throttled)',
  })
  @ApiResponse({
    status: 201,
    description: 'Subscribed successfully',
  })
  async subscribe(@Body() dto: SubscribeDto, @Req() req: Request) {
    return this.pushService.subscribe(dto, req);
  }

  @Public()
  @Post('unsubscribe')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Unsubscribed successfully')
  @ApiOperation({
    summary: 'Remove a device Web Push subscription (Public, throttled)',
  })
  @ApiResponse({
    status: 200,
    description: 'Unsubscribed successfully',
  })
  async unsubscribe(@Body() dto: EndpointDto) {
    return this.pushService.unsubscribe(dto);
  }

  @Public()
  @Patch('topics')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Topics updated successfully')
  @ApiOperation({
    summary: "Change a device's subscribed topics (Public, throttled)",
  })
  @ApiResponse({
    status: 200,
    description: 'Topics updated successfully',
  })
  async updateTopics(@Body() dto: UpdateTopicsDto) {
    return this.pushService.updateTopics(dto);
  }

  @Public()
  @Post('test-self')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Test notification sent successfully')
  @ApiOperation({
    summary: 'Send a test push to the calling device only (Public, max 3/hour)',
  })
  @ApiResponse({
    status: 200,
    description: 'Test push sent',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many test requests (max 3/hour)',
  })
  async testSelf(@Body() dto: EndpointDto) {
    return this.pushService.testSelf(dto);
  }

  @Public()
  @SkipThrottle()
  @Post('tick')
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage('Tick processed successfully')
  @ApiOperation({
    summary: 'Send everything that is due (Protected by Bearer Cron secret)',
  })
  @ApiResponse({
    status: 202,
    description: 'Tick claimed candidates accepted',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized cron secret',
  })
  async tick(@Headers('authorization') authHeader?: string) {
    this.pushTickService.verifyCronSecret(authHeader);
    return this.pushTickService.processTick();
  }

  @Get('log')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Notification log retrieved successfully')
  @ApiOperation({
    summary:
      'Recent push notification log and subscriber counts by topic (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification log retrieved',
  })
  async getLog(@CurrentUser() user: ActiveUserData) {
    return this.pushService.getLog(user.churchId);
  }
}
