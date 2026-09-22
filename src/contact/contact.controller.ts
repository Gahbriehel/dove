import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request } from 'express';
import type { Response } from 'express';
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
import { buildCsv, csvFilename, sendCsv } from '../common/utils/csv.util';
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
  @Get('contact/submissions/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Export contact submissions as CSV (Admin/Super Admin only)',
  })
  @ApiResponse({ status: 200, description: 'CSV file of contact submissions' })
  async exportCsv(
    @Query() query: QueryContactSubmissionDto,
    @CurrentUser() user: ActiveUserData,
    @Res() res: Response,
  ): Promise<void> {
    const submissions = await this.contactService.exportAll(query, user);
    const csv = buildCsv(submissions, [
      { header: 'ID', value: (r) => r.id },
      { header: 'Type', value: (r) => r.type },
      { header: 'Category', value: (r) => r.category },
      { header: 'Name', value: (r) => r.name },
      { header: 'Email', value: (r) => r.email },
      { header: 'Phone', value: (r) => r.phone },
      { header: 'Message', value: (r) => r.message },
      { header: 'Private', value: (r) => r.isPrivate },
      { header: 'Church ID', value: (r) => r.churchId },
      { header: 'Submitted At', value: (r) => r.createdAt },
    ]);
    sendCsv(res, csvFilename('contact-submissions'), csv);
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

  @ApiBearerAuth()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Delete('contact/submissions/:id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Contact submission deleted successfully')
  @ApiOperation({
    summary: 'Delete a single contact submission (Admin/Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Contact submission deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Contact submission not found',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: ActiveUserData) {
    return this.contactService.remove(id, user);
  }
}
