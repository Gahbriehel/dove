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
import { CreateEventDto } from './dto/create-event.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Church not found' })
  async create(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser('churchId') userChurchId?: string,
  ) {
    return this.eventsService.create(createEventDto, userChurchId);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all events with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of events retrieved successfully',
  })
  async findAll(
    @Query() query: QueryEventDto,
    @CurrentUser('churchId') userChurchId?: string,
  ) {
    return this.eventsService.findAll(query, userChurchId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single event by ID' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('churchId') userChurchId?: string,
  ) {
    return this.eventsService.findOne(id, userChurchId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing event' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser('churchId') userChurchId?: string,
  ) {
    return this.eventsService.update(id, updateEventDto, userChurchId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an event' })
  @ApiResponse({ status: 200, description: 'Event deleted successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('churchId') userChurchId?: string,
  ) {
    return this.eventsService.remove(id, userChurchId);
  }
}
