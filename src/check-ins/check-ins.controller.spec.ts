import { Test, TestingModule } from '@nestjs/testing';
import { CheckInReason, CheckInStatus } from '@prisma/client';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';

describe('CheckInsController', () => {
  let controller: CheckInsController;
  let serviceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckInsController],
      providers: [
        {
          provide: CheckInsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<CheckInsController>(CheckInsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call create', async () => {
    const dto = {
      personId: 'person-1',
      reason: CheckInReason.ABSENTEEISM,
      notes: 'Missed service',
    };
    const user: ActiveUserData = {
      sub: 'user-1',
      churchId: 'church-1',
      email: 'test@example.com',
      roles: ['ADMIN'],
    };
    const expected = { id: 'checkin-1', ...dto };
    serviceMock.create.mockResolvedValue(expected);

    const result = await controller.create(dto, user);
    expect(serviceMock.create).toHaveBeenCalledWith(dto, user);
    expect(result).toEqual(expected);
  });

  it('should call findAll', async () => {
    serviceMock.findAll.mockResolvedValue({ items: [], meta: { total: 0 } });
    const query = { page: 1, limit: 10 };
    const result = await controller.findAll(query, 'church-1');
    expect(serviceMock.findAll).toHaveBeenCalledWith(query, 'church-1');
    expect(result.items).toEqual([]);
  });

  it('should call findOne', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 'checkin-1' });
    const result = await controller.findOne('checkin-1', 'church-1');
    expect(serviceMock.findOne).toHaveBeenCalledWith('checkin-1', 'church-1');
    expect(result.id).toBe('checkin-1');
  });

  it('should call update', async () => {
    const dto = {
      status: CheckInStatus.COMPLETED,
      outcome: 'Spoke with member',
    };
    serviceMock.update.mockResolvedValue({ id: 'checkin-1', ...dto });
    const result = await controller.update('checkin-1', dto, 'church-1');
    expect(serviceMock.update).toHaveBeenCalledWith(
      'checkin-1',
      dto,
      'church-1',
    );
    expect(result.status).toBe(CheckInStatus.COMPLETED);
  });

  it('should call remove', async () => {
    serviceMock.remove.mockResolvedValue({ message: 'Deleted successfully' });
    const result = await controller.remove('checkin-1', 'church-1');
    expect(serviceMock.remove).toHaveBeenCalledWith('checkin-1', 'church-1');
    expect(result.message).toBe('Deleted successfully');
  });
});
