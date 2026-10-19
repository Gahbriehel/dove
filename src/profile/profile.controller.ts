import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ClaimProfileDto } from './dto/claim-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@Public()
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post('claim')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Profile claim requested')
  @ApiOperation({
    summary: 'Request a magic link to claim or update your church profile',
    description:
      'Submits an email or phone number. If a matching person exists, a single-use 30-minute magic link is generated and sent. If not found, a new visitor record is created.',
  })
  @ApiResponse({
    status: 200,
    description: 'Magic link dispatched if contact information exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Neither email nor phone was provided',
  })
  async claim(@Body() claimProfileDto: ClaimProfileDto) {
    return this.profileService.claim(claimProfileDto);
  }

  @Get(':token')
  @ResponseMessage('Profile retrieved successfully')
  @ApiOperation({
    summary: 'Retrieve person profile data using a magic link token',
    description:
      'Validates the magic link token and returns the current profile, current departments, and all available church departments.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile and department roster retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Magic link is invalid or expired',
  })
  async getByToken(@Param('token') token: string) {
    return this.profileService.getByToken(token);
  }

  @Patch(':token')
  @ResponseMessage('Profile updated successfully')
  @ApiOperation({
    summary:
      'Update self-service profile and departments using magic link token',
    description:
      'Saves profile edits, self-selected membership status (Visitor, Member, Worker, Leader, Pastor), and assigns department memberships, then invalidates the token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully and token invalidated',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input, expired token, or invalid department ID',
  })
  async updateByToken(
    @Param('token') token: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.profileService.updateByToken(token, updateProfileDto);
  }
}
