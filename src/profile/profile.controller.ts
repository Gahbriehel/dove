import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
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
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Profile claim requested')
  @ApiOperation({
    summary: 'Request a magic link to claim or update your church profile',
    description:
      'Submits an email (or a phone number matching a person with an email on file). A single-use 30-minute link is emailed. An unknown email creates a visitor record; an unknown phone creates nothing. Rate limited per email (1/60 s, 5/hour; excess requests get the same generic 200) and per IP (429).',
  })
  @ApiResponse({
    status: 200,
    description: 'Magic link dispatched if contact information exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Neither email nor phone was provided',
  })
  @ApiResponse({ status: 429, description: 'Too many requests from this IP' })
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
    description:
      "Link is invalid or expired. Body includes `code`: 'PROFILE_LINK_INVALID' or 'PROFILE_LINK_EXPIRED'",
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
    description:
      "Invalid input, invalid/expired token, or invalid department ID. `code` may be 'PROFILE_LINK_INVALID', 'PROFILE_LINK_EXPIRED', 'NAMES_REQUIRED' or 'DEPARTMENT_REQUIRED'",
  })
  async updateByToken(
    @Param('token') token: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.profileService.updateByToken(token, updateProfileDto);
  }
}
