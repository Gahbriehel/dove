import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from './teams.service';

describe('TeamsService', () => {
  let service: TeamsService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    event: {
      findFirst: jest.Mock;
    };
    team: {
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
      team: {
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
        TeamsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  describe('create', () => {
    it('should create a team when event exists in church', async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: 'event-1',
        churchId: 'church-1',
      });
      prismaMock.team.create.mockResolvedValue({
        id: 'team-1',
        eventId: 'event-1',
        name: 'Red Lions',
        color: '#FF0000',
      });

      const result = await service.create(
        { eventId: 'event-1', name: 'Red Lions', color: '#FF0000' },
        'church-1',
      );

      expect(result.id).toBe('team-1');
      expect(result.name).toBe('Red Lions');
      expect(prismaMock.event.findFirst).toHaveBeenCalledWith({
        where: { id: 'event-1', churchId: 'church-1' },
      });
      expect(prismaMock.team.create).toHaveBeenCalledWith({
        data: {
          eventId: 'event-1',
          name: 'Red Lions',
          color: '#FF0000',
        },
      });
    });

    it('should throw NotFoundException if event does not exist in church', async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          { eventId: 'event-other', name: 'Red Lions' },
          'church-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of teams scoped to church', async () => {
      const mockTeams = [
        {
          id: 'team-1',
          name: 'Red Lions',
          color: '#FF0000',
          event: { id: 'event-1', title: 'Youth Camp' },
          _count: { registrations: 15, scores: 3 },
        },
      ];

      prismaMock.team.findMany.mockResolvedValue(mockTeams);
      prismaMock.team.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 10, search: 'Red' },
        'church-1',
      );

      expect(result.items).toEqual(mockTeams);
      expect(result.meta.total).toBe(1);
      expect(prismaMock.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('exportAll', () => {
    it('should return all teams for CSV export scoped to church', async () => {
      const mockTeams = [
        {
          id: 'team-1',
          name: 'Red Lions',
          color: '#FF0000',
          event: { id: 'event-1', title: 'Youth Camp' },
          _count: { registrations: 15, scores: 3 },
        },
      ];

      prismaMock.team.findMany.mockResolvedValue(mockTeams);

      const result = await service.exportAll({}, 'church-1');
      expect(result).toEqual(mockTeams);
      expect(prismaMock.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { event: { churchId: 'church-1' } },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return single team with details if present in church', async () => {
      const mockTeam = {
        id: 'team-1',
        name: 'Red Lions',
        event: { id: 'event-1', title: 'Youth Camp' },
        scores: [{ id: 's1', points: 10 }],
        _count: { registrations: 10 },
      };

      prismaMock.team.findFirst.mockResolvedValue(mockTeam);

      const result = await service.findOne('team-1', 'church-1');
      expect(result).toEqual(mockTeam);
      expect(prismaMock.team.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'team-1', event: { churchId: 'church-1' } },
        }),
      );
    });

    it('should throw NotFoundException if team is not in church', async () => {
      prismaMock.team.findFirst.mockResolvedValue(null);

      await expect(service.findOne('team-unknown', 'church-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update team record successfully', async () => {
      const mockTeam = {
        id: 'team-1',
        name: 'Red Lions',
        event: { id: 'event-1', title: 'Youth Camp' },
      };

      prismaMock.team.findFirst.mockResolvedValue(mockTeam);
      prismaMock.team.update.mockResolvedValue({
        ...mockTeam,
        name: 'Super Red Lions',
      });

      const result = await service.update(
        'team-1',
        { name: 'Super Red Lions' },
        'church-1',
      );

      expect(result.name).toBe('Super Red Lions');
      expect(prismaMock.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { name: 'Super Red Lions' },
      });
    });

    it('should validate new event existence if eventId is being updated', async () => {
      const mockTeam = { id: 'team-1', event: { id: 'event-1' } };
      prismaMock.team.findFirst.mockResolvedValue(mockTeam);
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.update('team-1', { eventId: 'event-other' }, 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete team record after verifying existence in church', async () => {
      prismaMock.team.findFirst.mockResolvedValue({ id: 'team-1' });
      prismaMock.team.delete.mockResolvedValue({ id: 'team-1' });

      const result = await service.remove('team-1', 'church-1');
      expect(result).toEqual({
        message: 'Team with ID "team-1" deleted successfully',
      });
      expect(prismaMock.team.delete).toHaveBeenCalledWith({
        where: { id: 'team-1' },
      });
    });

    it('should throw NotFoundException if team does not exist', async () => {
      prismaMock.team.findFirst.mockResolvedValue(null);

      await expect(service.remove('team-unknown', 'church-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
