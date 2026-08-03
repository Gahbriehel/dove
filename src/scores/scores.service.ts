import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordScoreDto } from './dto/record-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';

@Injectable()
export class ScoresService {
  constructor(private readonly prisma: PrismaService) {}

  async recordScore(recordScoreDto: RecordScoreDto) {
    const { gameId, teamId, points, notes } = recordScoreDto;

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });
    if (!team) {
      throw new NotFoundException(`Team with ID "${teamId}" not found`);
    }

    if (game.eventId !== team.eventId) {
      throw new BadRequestException(
        'The specified game and team belong to different events',
      );
    }

    const existingScore = await this.prisma.score.findFirst({
      where: { gameId, teamId },
    });
    if (existingScore) {
      throw new ConflictException(
        `A score record already exists for team "${team.name}" in game "${game.name}". Use PATCH /scores/${existingScore.id} to update the score.`,
      );
    }

    if (game.maxScore && points > game.maxScore) {
      throw new BadRequestException(
        `Points (${points}) exceeds maximum allowed score (${game.maxScore}) for game "${game.name}"`,
      );
    }

    const score = await this.prisma.score.create({
      data: {
        gameId,
        teamId,
        points,
        notes,
      },
      include: {
        game: { select: { id: true, name: true } },
        team: { select: { id: true, name: true, color: true } },
      },
    });

    return {
      message: 'Score recorded successfully',
      score,
    };
  }

  async updateScore(id: string, updateScoreDto: UpdateScoreDto) {
    const existingScore = await this.prisma.score.findUnique({
      where: { id },
      include: { game: true, team: true },
    });
    if (!existingScore) {
      throw new NotFoundException(`Score record with ID "${id}" not found`);
    }

    const gameId = updateScoreDto.gameId ?? existingScore.gameId;
    const teamId = updateScoreDto.teamId ?? existingScore.teamId;

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });
    if (!team) {
      throw new NotFoundException(`Team with ID "${teamId}" not found`);
    }

    if (game.eventId !== team.eventId) {
      throw new BadRequestException(
        'The specified game and team belong to different events',
      );
    }

    const newPoints =
      updateScoreDto.points !== undefined
        ? updateScoreDto.points
        : existingScore.points;

    if (game.maxScore && newPoints > game.maxScore) {
      throw new BadRequestException(
        `Points (${newPoints}) exceeds maximum allowed score (${game.maxScore}) for game "${game.name}"`,
      );
    }

    const updatedScore = await this.prisma.score.update({
      where: { id },
      data: {
        gameId,
        teamId,
        points: newPoints,
        ...(updateScoreDto.notes !== undefined && {
          notes: updateScoreDto.notes,
        }),
      },
      include: {
        game: { select: { id: true, name: true } },
        team: { select: { id: true, name: true, color: true } },
      },
    });

    return {
      message: 'Score updated successfully',
      score: updatedScore,
    };
  }

  async clearGameScores(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }

    const { count } = await this.prisma.score.deleteMany({
      where: { gameId },
    });

    return {
      message: `Successfully cleared all scores for game "${game.name}"`,
      clearedCount: count,
    };
  }

  async getLeaderboard(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    const teams = await this.prisma.team.findMany({
      where: { eventId },
      include: {
        scores: {
          select: {
            points: true,
          },
        },
        _count: {
          select: { registrations: true },
        },
      },
    });

    const leaderboard = teams.map((team) => {
      const totalScore = team.scores.reduce(
        (sum, score) => sum + score.points,
        0,
      );
      return {
        teamId: team.id,
        teamName: team.name,
        color: team.color,
        totalScore,
        memberCount: team._count.registrations,
      };
    });

    // Sort descending by totalScore
    leaderboard.sort((a, b) => b.totalScore - a.totalScore);

    return {
      eventId: event.id,
      eventTitle: event.title,
      leaderboard,
    };
  }
}
