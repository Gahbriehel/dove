import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type ActiveUserData,
} from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';
import { NotificationSettingsService } from './notification-settings.service';

@ApiTags('Notification Settings')
@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(private readonly settingsService: NotificationSettingsService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Notification settings retrieved successfully')
  @ApiOperation({
    summary:
      'Get scripture send time and encouragement slots for church (Admin only)',
  })
  async getSettings(@CurrentUser() user: ActiveUserData) {
    return this.settingsService.getSettings(user.churchId);
  }

  @Put()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ResponseMessage('Notification settings updated successfully')
  @ApiOperation({
    summary:
      'Update scripture send time and encouragement slots for church (Admin only)',
  })
  async updateSettings(
    @Body() dto: UpdateNotificationSettingsDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.settingsService.updateSettings(user.churchId, dto);
  }
}
