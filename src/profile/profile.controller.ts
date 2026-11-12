import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ClaimProfileDto } from './dto/claim-profile.dto';
import { CreateRelativeDto } from './dto/create-relative.dto';
import { MemberLoginDto } from './dto/member-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePinDto } from './dto/change-pin.dto';
import { MemberAuthGuard } from './guards/member-auth.guard';
import type { MemberJwtPayload } from './guards/member-auth.guard';
import { CurrentMember } from './decorators/current-member.decorator';
import type { ActiveMemberData } from './decorators/current-member.decorator';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@Public()
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post('claim')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 10 * 60 * 1000 } })
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

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Member login successful')
  @ApiOperation({
    summary: 'Log in to member PWA using phone/email and 4-digit PIN',
    description:
      'Authenticates church member/worker using their phone number or email and 4-digit PIN. Returns a member session token. Rate limited per IP (429) and locked after 5 failed attempts per account.',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({
    status: 400,
    description: 'No PIN set (code: NO_PIN_SET) or invalid input',
  })
  @ApiResponse({
    status: 401,
    description:
      'Invalid credentials or incorrect PIN (code: INVALID_CREDENTIALS or INVALID_PIN)',
  })
  @ApiResponse({
    status: 403,
    description:
      'Account locked due to too many failed attempts (code: PIN_LOCKED)',
  })
  @ApiResponse({ status: 429, description: 'Too many requests from this IP' })
  async login(@Body() memberLoginDto: MemberLoginDto) {
    return this.profileService.login(memberLoginDto);
  }

  @Get('me')
  @UseGuards(MemberAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Member profile retrieved successfully')
  @ApiOperation({
    summary: 'Validate member session and retrieve profile and church context',
    description:
      'Returns current person and church info for the authenticated member. Also returns a refreshed accessToken for sliding sessions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Member profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, expired or revoked accessToken',
  })
  async getMe(@CurrentMember() member: ActiveMemberData) {
    return this.profileService.getMe(member.sub);
  }

  @Put('me/pin')
  @UseGuards(MemberAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('PIN updated successfully')
  @ApiOperation({
    summary: 'Set or update member login PIN',
    description:
      'Sets a new 4-digit login PIN. Requires currentPin when a PIN is already configured; resets lockout on success. Rejects weak PINs with 400 PIN_TOO_WEAK.',
  })
  @ApiResponse({ status: 200, description: 'PIN updated successfully' })
  @ApiResponse({
    status: 400,
    description:
      'Weak PIN (code: PIN_TOO_WEAK) or missing current PIN (code: CURRENT_PIN_REQUIRED)',
  })
  @ApiResponse({
    status: 401,
    description: 'Incorrect current PIN (code: INVALID_PIN) or unauthorized',
  })
  @ApiResponse({
    status: 403,
    description:
      'Account locked due to too many failed attempts (code: PIN_LOCKED)',
  })
  async changePin(
    @CurrentMember() member: ActiveMemberData,
    @Body() changePinDto: ChangePinDto,
  ) {
    return this.profileService.changePin(member.sub, changePinDto);
  }

  @Post('logout')
  @UseGuards(MemberAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged out successfully')
  @ApiOperation({
    summary: 'Revoke the current member session',
    description: 'Revokes the authenticated member access token.',
  })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @Req()
    req: {
      member: MemberJwtPayload;
      rawToken?: string;
    },
  ) {
    return this.profileService.logout(req.member, req.rawToken);
  }

  @Post('me/relatives')
  @UseGuards(MemberAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Relative added successfully')
  @ApiOperation({
    summary: 'Add a new relative',
    description:
      'Creates a new person record and links them to the signed-in member. Requires email or phone.',
  })
  @ApiResponse({ status: 201, description: 'Relative added successfully' })
  @ApiResponse({
    status: 400,
    description:
      'Missing contact details (code: CONTACT_REQUIRED) or invalid input',
  })
  @ApiResponse({
    status: 409,
    description:
      'Email or phone already registered (code: CONTACT_ALREADY_REGISTERED)',
  })
  async addRelative(
    @CurrentMember() member: ActiveMemberData,
    @Body() dto: CreateRelativeDto,
  ) {
    return this.profileService.addRelative(member.sub, member.churchId, dto);
  }

  @Get('me/relatives')
  @UseGuards(MemberAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Relatives retrieved successfully')
  @ApiOperation({
    summary: 'List my linked relatives',
    description: 'Returns linked family members in both directions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Relatives retrieved successfully',
  })
  async listRelatives(@CurrentMember() member: ActiveMemberData) {
    return this.profileService.listMyRelatives(member.sub, member.churchId);
  }

  @Delete('me/relatives/:relationshipId')
  @UseGuards(MemberAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Relationship removed successfully')
  @ApiOperation({
    summary: 'Remove a family link',
    description:
      'Removes a relationship link between the member and a relative. Allowed for either party.',
  })
  @ApiResponse({
    status: 200,
    description: 'Relationship removed successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Relationship not found' })
  async deleteRelative(
    @CurrentMember() member: ActiveMemberData,
    @Param('relationshipId') relationshipId: string,
  ) {
    return this.profileService.deleteMyRelative(
      member.sub,
      member.churchId,
      relationshipId,
    );
  }

  @Post('me/relatives/:personId/claim-link')
  @UseGuards(MemberAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Claim link generated successfully')
  @ApiOperation({
    summary: 'Generate WhatsApp claim link for a created relative',
    description:
      'Issues a single-use 48-hour profile token and prefilled WhatsApp URL to send to an unclaimed relative with a phone number.',
  })
  @ApiResponse({
    status: 200,
    description: 'Claim link generated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Not the member who created this relative (code: NOT_CREATOR)',
  })
  @ApiResponse({
    status: 409,
    description:
      'Already claimed (code: ALREADY_CLAIMED) or no phone (code: NO_PHONE)',
  })
  async createRelativeClaimLink(
    @CurrentMember() member: ActiveMemberData,
    @Param('personId') personId: string,
  ) {
    return this.profileService.createRelativeClaimLink(
      member.sub,
      member.churchId,
      personId,
    );
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
      'Saves profile edits, self-selected membership status (Visitor, Member, Worker, Leader, Pastor), and assigns department memberships, then invalidates the token. Returns accessToken if member has a PIN.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully and token invalidated',
  })
  @ApiResponse({
    status: 400,
    description:
      "Invalid input, invalid/expired token, weak PIN (PIN_TOO_WEAK), or invalid department ID. `code` may be 'PROFILE_LINK_INVALID', 'PROFILE_LINK_EXPIRED', 'NAMES_REQUIRED', 'DEPARTMENT_REQUIRED' or 'PIN_TOO_WEAK'",
  })
  async updateByToken(
    @Param('token') token: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.profileService.updateByToken(token, updateProfileDto);
  }
}
