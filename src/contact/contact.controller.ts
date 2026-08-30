import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  type ActiveUserData,
} from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ContactService } from './contact.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import { QueryContactSubmissionDto } from './dto/query-contact-submission.dto';

export interface CustomRequest extends Request {
  customResponseMessage?: string;
}

@ApiTags('Contact')
@Controller()
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Post(['contact', 'churches/:tenantSlug/contact'])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Submit a contact form for a prayer request or general inquiry (Public)',
  })
  @ApiResponse({
    status: 201,
    description: 'Contact submission created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or invalid category selection',
  })
  @ApiResponse({
    status: 404,
    description: 'Church tenant not found',
  })
  async submitContact(
    @Body() dto: CreateContactSubmissionDto,
    @Req() req: CustomRequest,
    @Headers('x-tenant-slug') xTenantSlug?: string,
    @Headers('x-tenant-key') xTenantKey?: string,
    @Param('tenantSlug') tenantSlug?: string,
  ) {
    const slug = tenantSlug || xTenantSlug || xTenantKey;
    const submission = await this.contactService.create(dto, slug);

    // Set the dynamic custom response message for TransformInterceptor
    req.customResponseMessage =
      dto.type === 'prayer'
        ? 'Your prayer request has been submitted successfully.'
        : 'Your inquiry has been submitted successfully.';

    return submission;
  }

  @ApiBearerAuth()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Get('contact/submissions')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Contact submissions list retrieved successfully')
  @ApiOperation({
    summary: 'List all contact submissions (Admin/Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Contact submissions list retrieved successfully',
  })
  async findAll(
    @Query() query: QueryContactSubmissionDto,
    @CurrentUser() user: ActiveUserData,
  ) {
    return this.contactService.findAll(query, user);
  }

  @ApiBearerAuth()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Get('contact/submissions/:id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Contact submission details retrieved successfully')
  @ApiOperation({
    summary:
      'Get details of a single contact submission (Admin/Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Contact submission details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Contact submission not found',
  })
  async findOne(@Param('id') id: string, @CurrentUser() user: ActiveUserData) {
    return this.contactService.findOne(id, user);
  }
}
