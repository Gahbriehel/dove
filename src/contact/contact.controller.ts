import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ContactService } from './contact.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';

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
}
