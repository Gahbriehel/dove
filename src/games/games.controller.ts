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
import { CreateGameDto } from './dto/create-game.dto';
import { QueryGameDto } from './dto/query-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GamesService } from './games.service';

@ApiTags('Games')
@ApiBearerAuth()
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Game created successfully')
  @ApiOperation({ summary: 'Create a new game for an event' })
  @ApiResponse({ status: 201, description: 'Game created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async create(@Body() createGameDto: CreateGameDto) {
    return this.gamesService.create(createGameDto);
  }

  @Get()
  @ResponseMessage('List of games retrieved successfully')
  @ApiOperation({
    summary: 'List games with pagination and optional event filter',
  })
  @ApiResponse({
    status: 200,
    description: 'List of games retrieved successfully',
  })
  async findAll(@Query() query: QueryGameDto) {
    return this.gamesService.findAll(query);
  }

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export games as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file of games' })
  async exportCsv(
    @Query() query: QueryGameDto,
    @Res() res: Response,
  ): Promise<void> {
    const games = await this.gamesService.exportAll(query);
    const csv = buildCsv(games, [
      { header: 'ID', value: (r) => r.id },
      { header: 'Name', value: (r) => r.name },
      { header: 'Description', value: (r) => r.description },
      { header: 'Max Score', value: (r) => r.maxScore },
      { header: 'Event', value: (r) => r.event.title },
      { header: 'Scores Recorded', value: (r) => r._count.scores },
      { header: 'Created At', value: (r) => r.createdAt },
    ]);
    sendCsv(res, csvFilename('games'), csv);
  }

  @Get(':id')
  @ResponseMessage('Game retrieved successfully')
  @ApiOperation({ summary: 'Get game details by ID' })
  @ApiResponse({ status: 200, description: 'Game retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async findOne(@Param('id') id: string) {
    return this.gamesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @ResponseMessage('Game updated successfully')
  @ApiOperation({ summary: 'Update a game record' })
  @ApiResponse({ status: 200, description: 'Game updated successfully' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async update(@Param('id') id: string, @Body() updateGameDto: UpdateGameDto) {
    return this.gamesService.update(id, updateGameDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @ResponseMessage('Game deleted successfully')
  @ApiOperation({ summary: 'Delete a game record' })
  @ApiResponse({ status: 200, description: 'Game deleted successfully' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async remove(@Param('id') id: string) {
    return this.gamesService.remove(id);
  }
}
