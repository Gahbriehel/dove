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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RecordScoreDto } from './dto/record-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { ScoresService } from './scores.service';

@ApiTags('Scores & Leaderboard')
@Controller()
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  @Post('scores')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record score for a team in a game (Admin only)' })
  @ApiResponse({ status: 201, description: 'Score recorded successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid points or game/team mismatch',
  })
  @ApiResponse({ status: 409, description: 'Score already exists for team' })
  @ApiResponse({ status: 404, description: 'Game or Team not found' })
  async recordScore(@Body() recordScoreDto: RecordScoreDto) {
    return this.scoresService.recordScore(recordScoreDto);
  }

  @Patch('scores/:id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a score record (Admin only)' })
  @ApiResponse({ status: 200, description: 'Score updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid points or game/team mismatch',
  })
  @ApiResponse({ status: 404, description: 'Score record not found' })
  async updateScore(
    @Param('id') id: string,
    @Body() updateScoreDto: UpdateScoreDto,
  ) {
    return this.scoresService.updateScore(id, updateScoreDto);
  }

  @Delete('scores/game/:gameId')
  @Roles('ADMIN', 'SUPER_ADMIN', 'COORDINATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear all scores for a game (Admin only)' })
  @ApiResponse({ status: 200, description: 'All game scores cleared' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async clearGameScores(@Param('gameId') gameId: string) {
    return this.scoresService.clearGameScores(gameId);
  }

  @Public()
  @Get('leaderboard/:eventId')
  @ApiOperation({ summary: 'Get team leaderboard for an event (Public)' })
  @ApiResponse({
    status: 200,
    description:
      'Leaderboard retrieved successfully, teams sorted descending by total score',
  })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getLeaderboard(@Param('eventId') eventId: string) {
    return this.scoresService.getLeaderboard(eventId);
  }
}
