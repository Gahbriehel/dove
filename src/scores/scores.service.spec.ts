import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ScoresService } from './scores.service';

describe('ScoresService', () => {
  let service: ScoresService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    game: {
      findFirst: jest.Mock;
    };
    team: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    score: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
    event: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      game: {
        findFirst: jest.fn(),
      },
      team: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      score: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      event: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoresService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ScoresService>(ScoresService);
  });

  describe('recordScore', () => {
    it('should record score when game and team belong to the same event', async () => {
      prismaMock.game.findFirst.mockResolvedValue({
        id: 'game-1',
        eventId: 'event-1',
        name: 'Bible Quiz',
        maxScore: 100,
      });
      prismaMock.team.findFirst.mockResolvedValue({
        id: 'team-1',
        eventId: 'event-1',
        name: 'Red Lions',
      });
      prismaMock.score.findFirst.mockResolvedValue(null);
      prismaMock.score.create.mockResolvedValue({
        id: 'score-1',
        gameId: 'game-1',
        teamId: 'team-1',
        points: 85,
        notes: 'Great answers',
      });

      const result = await service.recordScore(
        {
          gameId: 'game-1',
          teamId: 'team-1',
          points: 85,
          notes: 'Great answers',
        },
        'church-1',
      );

      expect(result.message).toBe('Score recorded successfully');
      expect(result.score.points).toBe(85);
      expect(prismaMock.score.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            gameId: 'game-1',
            teamId: 'team-1',
            points: 85,
            notes: 'Great answers',
          },
        }),
      );
    });

    it('should throw NotFoundException if game is not found in church', async () => {
      prismaMock.game.findFirst.mockResolvedValue(null);

      await expect(
        service.recordScore(
          { gameId: 'game-missing', teamId: 'team-1', points: 50 },
          'church-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if team is not found in church', async () => {
      prismaMock.game.findFirst.mockResolvedValue({
        id: 'game-1',
        eventId: 'event-1',
      });
      prismaMock.team.findFirst.mockResolvedValue(null);

      await expect(
        service.recordScore(
          { gameId: 'game-1', teamId: 'team-missing', points: 50 },
          'church-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if game and team belong to different events', async () => {
      prismaMock.game.findFirst.mockResolvedValue({
        id: 'game-1',
        eventId: 'event-1',
        name: 'Quiz',
      });
      prismaMock.team.findFirst.mockResolvedValue({
        id: 'team-2',
        eventId: 'event-2',
        name: 'Blue Eagles',
      });

      await expect(
        service.recordScore(
          { gameId: 'game-1', teamId: 'team-2', points: 50 },
          'church-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if a score already exists for team in game', async () => {
      prismaMock.game.findFirst.mockResolvedValue({
        id: 'game-1',
        eventId: 'event-1',
        name: 'Quiz',
      });
      prismaMock.team.findFirst.mockResolvedValue({
        id: 'team-1',
        eventId: 'event-1',
        name: 'Red Lions',
      });
      prismaMock.score.findFirst.mockResolvedValue({
        id: 'existing-score-id',
      });

      await expect(
        service.recordScore(
          { gameId: 'game-1', teamId: 'team-1', points: 50 },
          'church-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if points exceed maxScore', async () => {
      prismaMock.game.findFirst.mockResolvedValue({
        id: 'game-1',
        eventId: 'event-1',
        name: 'Quiz',
        maxScore: 50,
      });
      prismaMock.team.findFirst.mockResolvedValue({
        id: 'team-1',
        eventId: 'event-1',
        name: 'Red Lions',
      });
      prismaMock.score.findFirst.mockResolvedValue(null);

      await expect(
        service.recordScore(
          { gameId: 'game-1', teamId: 'team-1', points: 75 },
          'church-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateScore', () => {
    it('should update score record points and notes', async () => {
      prismaMock.score.findFirst.mockResolvedValue({
        id: 'score-1',
        gameId: 'game-1',
        teamId: 'team-1',
        points: 50,
      });
      prismaMock.game.findFirst.mockResolvedValue({
        id: 'game-1',
        eventId: 'event-1',
        maxScore: 100,
        name: 'Quiz',
      });
      prismaMock.team.findFirst.mockResolvedValue({
        id: 'team-1',
        eventId: 'event-1',
        name: 'Red Lions',
      });
      prismaMock.score.update.mockResolvedValue({
        id: 'score-1',
        points: 70,
        notes: 'Bonus round',
      });

      const result = await service.updateScore(
        'score-1',
        { points: 70, notes: 'Bonus round' },
        'church-1',
      );

      expect(result.message).toBe('Score updated successfully');
      expect(result.score.points).toBe(70);
      expect(prismaMock.score.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'score-1' },
          data: {
            gameId: 'game-1',
            teamId: 'team-1',
            points: 70,
            notes: 'Bonus round',
          },
        }),
      );
    });

    it('should throw NotFoundException if score is not found', async () => {
      prismaMock.score.findFirst.mockResolvedValue(null);

      await expect(
        service.updateScore('score-missing', { points: 60 }, 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if updated points exceed game maxScore', async () => {
      prismaMock.score.findFirst.mockResolvedValue({
        id: 'score-1',
        gameId: 'game-1',
        teamId: 'team-1',
        points: 50,
      });
      prismaMock.game.findFirst.mockResolvedValue({
        id: 'game-1',
        eventId: 'event-1',
        maxScore: 50,
        name: 'Quiz',
      });
      prismaMock.team.findFirst.mockResolvedValue({
        id: 'team-1',
        eventId: 'event-1',
        name: 'Red Lions',
      });

      await expect(
        service.updateScore('score-1', { points: 60 }, 'church-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('clearGameScores', () => {
    it('should clear all score records for a game in church', async () => {
      prismaMock.game.findFirst.mockResolvedValue({
        id: 'game-1',
        name: 'Quiz',
      });
      prismaMock.score.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.clearGameScores('game-1', 'church-1');
      expect(result.clearedCount).toBe(5);
      expect(prismaMock.score.deleteMany).toHaveBeenCalledWith({
        where: { gameId: 'game-1' },
      });
    });

    it('should throw NotFoundException if game not found in church', async () => {
      prismaMock.game.findFirst.mockResolvedValue(null);

      await expect(
        service.clearGameScores('game-missing', 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLeaderboard', () => {
    it('should calculate leaderboard and return teams sorted descending by totalScore', async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: 'event-1',
        title: 'Youth Camp 2026',
      });

      prismaMock.team.findMany.mockResolvedValue([
        {
          id: 'team-1',
          name: 'Team Alpha',
          color: '#FF0000',
          scores: [{ points: 20 }, { points: 30 }],
          _count: { registrations: 12 },
        },
        {
          id: 'team-2',
          name: 'Team Omega',
          color: '#0000FF',
          scores: [{ points: 50 }, { points: 40 }],
          _count: { registrations: 15 },
        },
      ]);

      const result = await service.getLeaderboard('event-1', 'church-1');

      expect(result.eventId).toBe('event-1');
      expect(result.eventTitle).toBe('Youth Camp 2026');
      expect(result.leaderboard).toHaveLength(2);
      // Team Omega (90 pts) should be ranked 1st before Team Alpha (50 pts)
      expect(result.leaderboard[0].teamName).toBe('Team Omega');
      expect(result.leaderboard[0].totalScore).toBe(90);
      expect(result.leaderboard[0].memberCount).toBe(15);
      expect(result.leaderboard[1].teamName).toBe('Team Alpha');
      expect(result.leaderboard[1].totalScore).toBe(50);
      expect(result.leaderboard[1].memberCount).toBe(12);
    });

    it('should throw NotFoundException if event is not found in church', async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.getLeaderboard('event-missing', 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
