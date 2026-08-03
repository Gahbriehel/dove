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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
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
  @ApiOperation({ summary: 'Register a person for an event (Public)' })
  @ApiResponse({
    status: 201,
    description:
      'Registration successful, returns registration details & QR code',
  })
  @ApiResponse({
    status: 400,
    description: 'Missing required inputs (email/phone)',
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
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
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

  @Get('registrations/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
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
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
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
