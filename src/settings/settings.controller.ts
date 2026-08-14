import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateChurchSettingsDto } from './dto/update-church-settings.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(['', 'church'])
  @ResponseMessage('Church settings retrieved successfully')
  @ApiOperation({ summary: 'Get church information / settings' })
  @ApiResponse({
    status: 200,
    description: 'Church settings retrieved successfully',
  })
  async getChurchSettings(@CurrentUser('churchId') userChurchId?: string) {
    return this.settingsService.getChurchSettings(userChurchId);
  }

  @Patch(['', 'church'])
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ResponseMessage('Church settings updated successfully')
  @ApiOperation({ summary: 'Update church information / settings' })
  @ApiResponse({
    status: 200,
    description: 'Church settings updated successfully',
  })
  async updateChurchSettings(
    @Body() dto: UpdateChurchSettingsDto,
    @CurrentUser('churchId') userChurchId?: string,
  ) {
    return this.settingsService.updateChurchSettings(dto, userChurchId);
  }

  @Put(['', 'church'])
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ResponseMessage('Church settings updated successfully')
  @ApiOperation({ summary: 'Update church information / settings (PUT)' })
  @ApiResponse({
    status: 200,
    description: 'Church settings updated successfully',
  })
  async putChurchSettings(
    @Body() dto: UpdateChurchSettingsDto,
    @CurrentUser('churchId') userChurchId?: string,
  ) {
    return this.settingsService.updateChurchSettings(dto, userChurchId);
  }

  @Get(['profile', 'me'])
  @ResponseMessage('User profile retrieved successfully')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.settingsService.getProfile(userId);
  }

  @Patch(['profile', 'me'])
  @ResponseMessage('User profile updated successfully')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or invalid current password',
  })
  @ApiResponse({ status: 409, description: 'Email address already in use' })
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.settingsService.updateProfile(userId, dto);
  }

  @Put(['profile', 'me'])
  @ResponseMessage('User profile updated successfully')
  @ApiOperation({ summary: 'Update current user profile (PUT)' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  async putProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.settingsService.updateProfile(userId, dto);
  }
}
