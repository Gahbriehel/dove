import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RecordScoreDto } from './dto/record-score.dto';
import { ScoresService } from './scores.service';

@ApiTags('Scores & Leaderboard')
@Controller()
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  @Post('scores')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record score for a team in a game (Admin only)' })
  @ApiResponse({ status: 201, description: 'Score recorded successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid points or game/team mismatch',
  })
  @ApiResponse({ status: 404, description: 'Game or Team not found' })
  async recordScore(@Body() recordScoreDto: RecordScoreDto) {
    return this.scoresService.recordScore(recordScoreDto);
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
