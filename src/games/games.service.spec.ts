import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { GamesService } from './games.service';

describe('GamesService', () => {
  let service: GamesService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    event: {
      findFirst: jest.Mock;
    };
    game: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      event: {
        findFirst: jest.fn(),
      },
      game: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
  });

  describe('create', () => {
    it('should create a game for an event in church with maxScore', async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: 'event-1',
        churchId: 'church-1',
      });
      prismaMock.game.create.mockResolvedValue({
        id: 'game-1',
        eventId: 'event-1',
        name: 'Bible Trivia',
        description: 'Youth Bible Quiz',
        maxScore: 100,
      });

      const result = await service.create(
        {
          eventId: 'event-1',
          name: 'Bible Trivia',
          description: 'Youth Bible Quiz',
          maxScore: 100,
        },
        'church-1',
      );

      expect(result.id).toBe('game-1');
      expect(result.maxScore).toBe(100);
      expect(prismaMock.event.findFirst).toHaveBeenCalledWith({
        where: { id: 'event-1', churchId: 'church-1' },
      });
      expect(prismaMock.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            eventId: 'event-1',
            name: 'Bible Trivia',
            description: 'Youth Bible Quiz',
            maxScore: 100,
          },
        }),
      );
    });

    it('should throw NotFoundException if event is not found in church', async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ eventId: 'event-other', name: 'Trivia' }, 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of games scoped to church', async () => {
      const mockGames = [
        {
          id: 'game-1',
          name: 'Bible Trivia',
          maxScore: 100,
          event: { id: 'event-1', title: 'Youth Camp' },
          scores: [],
          _count: { scores: 0 },
        },
      ];

      prismaMock.game.findMany.mockResolvedValue(mockGames);
      prismaMock.game.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 10, search: 'Bible' },
        'church-1',
      );

      expect(result.items).toEqual(mockGames);
      expect(result.meta.total).toBe(1);
      expect(prismaMock.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('exportAll', () => {
    it('should return games for CSV export', async () => {
      const mockGames = [
        {
          id: 'game-1',
          name: 'Bible Trivia',
          event: { title: 'Camp' },
          _count: { scores: 0 },
        },
      ];

      prismaMock.game.findMany.mockResolvedValue(mockGames);

      const result = await service.exportAll({}, 'church-1');
      expect(result).toEqual(mockGames);
    });
  });

  describe('findOne', () => {
    it('should return game details if present in church', async () => {
      const mockGame = {
        id: 'game-1',
        name: 'Bible Trivia',
        event: { id: 'event-1', title: 'Youth Camp' },
        scores: [],
      };

      prismaMock.game.findFirst.mockResolvedValue(mockGame);

      const result = await service.findOne('game-1', 'church-1');
      expect(result).toEqual(mockGame);
      expect(prismaMock.game.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'game-1', event: { churchId: 'church-1' } },
        }),
      );
    });

    it('should throw NotFoundException if game does not exist in church', async () => {
      prismaMock.game.findFirst.mockResolvedValue(null);

      await expect(service.findOne('game-unknown', 'church-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update game successfully', async () => {
      const mockGame = {
        id: 'game-1',
        name: 'Bible Trivia',
        maxScore: 100,
      };

      prismaMock.game.findFirst.mockResolvedValue(mockGame);
      prismaMock.game.update.mockResolvedValue({
        ...mockGame,
        maxScore: 150,
      });

      const result = await service.update(
        'game-1',
        { maxScore: 150 },
        'church-1',
      );

      expect(result.maxScore).toBe(150);
      expect(prismaMock.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'game-1' },
          data: { maxScore: 150 },
        }),
      );
    });

    it('should validate new event existence if eventId is being updated', async () => {
      const mockGame = { id: 'game-1' };
      prismaMock.game.findFirst.mockResolvedValue(mockGame);
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.update('game-1', { eventId: 'event-missing' }, 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete game after verifying existence in church', async () => {
      prismaMock.game.findFirst.mockResolvedValue({ id: 'game-1' });
      prismaMock.game.delete.mockResolvedValue({ id: 'game-1' });

      const result = await service.remove('game-1', 'church-1');
      expect(result).toEqual({
        message: 'Game with ID "game-1" deleted successfully',
      });
      expect(prismaMock.game.delete).toHaveBeenCalledWith({
        where: { id: 'game-1' },
      });
    });

    it('should throw NotFoundException if game not found', async () => {
      prismaMock.game.findFirst.mockResolvedValue(null);

      await expect(service.remove('game-missing', 'church-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
