import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { buildCsv, csvFilename, sendCsv } from '../common/utils/csv.util';
import { QueryRegistrationDto } from './dto/query-registration.dto';
import { RegisterDto } from './dto/register.dto';
import { RegistrationsService } from './registrations.service';

@ApiTags('Registrations')
@Controller()
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Public()
  @Post('events/:id/register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Registration successful')
  @ApiOperation({ summary: 'Register a person for an event (Public)' })
  @ApiResponse({
    status: 201,
    description:
      'Registration successful, returns registration details & QR code',
  })
  @ApiResponse({
    status: 400,
    description:
      'Missing required inputs (email/phone), event has ended, or event capacity is full',
  })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({
    status: 409,
    description:
      'Person is already registered for this event (returns previous registration)',
  })
  @ApiResponse({
    status: 422,
    description: 'No teams configured for event',
  })
  async register(
    @Param('id') eventId: string,
    @Body() registerDto: RegisterDto,
  ) {
    return this.registrationsService.register(eventId, registerDto);
  }

  @Get('registrations')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR', 'REGISTRATION_DESK')
  @ApiBearerAuth()
  @ResponseMessage('List of registrations retrieved successfully')
  @ApiOperation({ summary: 'List all registrations (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of registrations retrieved successfully',
  })
  async findAll(
    @Query() query: QueryRegistrationDto,
    @CurrentUser('churchId') churchId: string,
  ) {
    return this.registrationsService.findAll(query, churchId);
  }

  @Get('registrations/export')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR', 'REGISTRATION_DESK')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export registrations as CSV (Admin only)' })
  @ApiResponse({ status: 200, description: 'CSV file of registrations' })
  async exportCsv(
    @Query() query: QueryRegistrationDto,
    @CurrentUser('churchId') churchId: string,
    @Res() res: Response,
  ): Promise<void> {
    const registrations = await this.registrationsService.exportAll(
      query,
      churchId,
    );
    const csv = buildCsv(registrations, [
      { header: 'ID', value: (r) => r.id },
      { header: 'Registration Number', value: (r) => r.registrationNumber },
      { header: 'Event', value: (r) => r.event.title },
      { header: 'First Name', value: (r) => r.person.firstName },
      { header: 'Last Name', value: (r) => r.person.lastName },
      { header: 'Email', value: (r) => r.person.email },
      { header: 'Phone', value: (r) => r.person.phone },
      { header: 'Team', value: (r) => r.team?.name },
      { header: 'Status', value: (r) => r.status },
      { header: 'Checked In At', value: (r) => r.attendance?.checkedInAt },
      { header: 'Registered At', value: (r) => r.createdAt },
    ]);
    sendCsv(res, csvFilename('registrations'), csv);
  }

  @Get('registrations/:id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR', 'REGISTRATION_DESK')
  @ApiBearerAuth()
  @ResponseMessage('Registration details retrieved successfully')
  @ApiOperation({ summary: 'Get a single registration by ID (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Registration details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('churchId') churchId: string,
  ) {
    return this.registrationsService.findOne(id, churchId);
  }

  @Delete('registrations/:id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @ApiBearerAuth()
  @ResponseMessage('Registration deleted successfully')
  @ApiOperation({ summary: 'Delete a registration by ID (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Registration deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('churchId') churchId: string,
  ) {
    return this.registrationsService.remove(id, churchId);
  }
}
