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
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { buildCsv, csvFilename, sendCsv } from '../common/utils/csv.util';
import { CreateTeamDto } from './dto/create-team.dto';
import { QueryTeamDto } from './dto/query-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Team created successfully')
  @ApiOperation({ summary: 'Create a new team for an event' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async create(@Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto);
  }

  @Get()
  @ResponseMessage('List of teams retrieved successfully')
  @ApiOperation({
    summary: 'List teams with pagination and optional event filter',
  })
  @ApiResponse({
    status: 200,
    description: 'List of teams retrieved successfully',
  })
  async findAll(@Query() query: QueryTeamDto) {
    return this.teamsService.findAll(query);
  }

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export teams as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file of teams' })
  async exportCsv(
    @Query() query: QueryTeamDto,
    @Res() res: Response,
  ): Promise<void> {
    const teams = await this.teamsService.exportAll(query);
    const csv = buildCsv(teams, [
      { header: 'ID', value: (r) => r.id },
      { header: 'Name', value: (r) => r.name },
      { header: 'Color', value: (r) => r.color },
      { header: 'Event', value: (r) => r.event.title },
      { header: 'Members', value: (r) => r._count.registrations },
      { header: 'Scores Recorded', value: (r) => r._count.scores },
      { header: 'Created At', value: (r) => r.createdAt },
    ]);
    sendCsv(res, csvFilename('teams'), csv);
  }

  @Get(':id')
  @ResponseMessage('Team retrieved successfully')
  @ApiOperation({ summary: 'Get team details by ID' })
  @ApiResponse({ status: 200, description: 'Team retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @ResponseMessage('Team updated successfully')
  @ApiOperation({ summary: 'Update a team record' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async update(@Param('id') id: string, @Body() updateTeamDto: UpdateTeamDto) {
    return this.teamsService.update(id, updateTeamDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @ResponseMessage('Team deleted successfully')
  @ApiOperation({ summary: 'Delete a team record' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async remove(@Param('id') id: string) {
    return this.teamsService.remove(id);
  }
}
