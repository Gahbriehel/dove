import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';

describe('DepartmentsController', () => {
  let controller: DepartmentsController;
  let serviceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    addMember: jest.Mock;
    removeMember: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [
        {
          provide: DepartmentsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call create', async () => {
    serviceMock.create.mockResolvedValue({ id: 'dept-1', name: 'Choir' });
    const dto = { name: 'Choir' };
    const result = await controller.create(dto, 'church-1');
    expect(serviceMock.create).toHaveBeenCalledWith(dto, 'church-1');
    expect(result).toEqual({ id: 'dept-1', name: 'Choir' });
  });

  it('should call findAll', async () => {
    serviceMock.findAll.mockResolvedValue({ items: [], meta: { total: 0 } });
    const query = { page: 1, limit: 10 };
    const result = await controller.findAll(query, 'church-1');
    expect(serviceMock.findAll).toHaveBeenCalledWith(query, 'church-1');
    expect(result.items).toEqual([]);
  });

  it('should call findOne', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 'dept-1', name: 'Choir' });
    const result = await controller.findOne('dept-1', 'church-1');
    expect(serviceMock.findOne).toHaveBeenCalledWith('dept-1', 'church-1');
    expect(result.id).toBe('dept-1');
  });

  it('should call update', async () => {
    serviceMock.update.mockResolvedValue({ id: 'dept-1', name: 'Choir' });
    const dto = { name: 'Choir' };
    const result = await controller.update('dept-1', dto, 'church-1');
    expect(serviceMock.update).toHaveBeenCalledWith('dept-1', dto, 'church-1');
    expect(result.id).toBe('dept-1');
  });

  it('should call remove', async () => {
    serviceMock.remove.mockResolvedValue({ message: 'Deleted' });
    const result = await controller.remove('dept-1', 'church-1');
    expect(serviceMock.remove).toHaveBeenCalledWith('dept-1', 'church-1');
    expect(result.message).toBe('Deleted');
  });

  it('should call addMember', async () => {
    serviceMock.addMember.mockResolvedValue({ id: 'm-1' });
    const dto = { personId: 'p-1', role: 'Lead' };
    const result = await controller.addMember('dept-1', dto, 'church-1');
    expect(serviceMock.addMember).toHaveBeenCalledWith(
      'dept-1',
      dto,
      'church-1',
    );
    expect(result.id).toBe('m-1');
  });

  it('should call removeMember', async () => {
    serviceMock.removeMember.mockResolvedValue({ message: 'Removed' });
    const result = await controller.removeMember('dept-1', 'p-1', 'church-1');
    expect(serviceMock.removeMember).toHaveBeenCalledWith(
      'dept-1',
      'p-1',
      'church-1',
    );
    expect(result.message).toBe('Removed');
  });
});
