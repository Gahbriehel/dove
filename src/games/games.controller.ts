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
import { Roles } from '../common/decorators/roles.decorator';
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
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new game for an event' })
  @ApiResponse({ status: 201, description: 'Game created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async create(@Body() createGameDto: CreateGameDto) {
    return this.gamesService.create(createGameDto);
  }

  @Get()
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

  @Get(':id')
  @ApiOperation({ summary: 'Get game details by ID' })
  @ApiResponse({ status: 200, description: 'Game retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async findOne(@Param('id') id: string) {
    return this.gamesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a game record' })
  @ApiResponse({ status: 200, description: 'Game updated successfully' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async update(@Param('id') id: string, @Body() updateGameDto: UpdateGameDto) {
    return this.gamesService.update(id, updateGameDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a game record' })
  @ApiResponse({ status: 200, description: 'Game deleted successfully' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async remove(@Param('id') id: string) {
    return this.gamesService.remove(id);
  }
}
