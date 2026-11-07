import { Test, TestingModule } from '@nestjs/testing';
import { EncouragementsController } from './encouragements.controller';
import { EncouragementsService } from './encouragements.service';

describe('EncouragementsController', () => {
  let controller: EncouragementsController;
  let serviceMock: {
    findAll: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const user = {
    churchId: 'church-1',
    sub: 'u1',
    email: 'e',
    roles: ['ADMIN'],
  };

  beforeEach(async () => {
    serviceMock = {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'enc-1' }),
      findOne: jest.fn().mockResolvedValue({ id: 'enc-1' }),
      update: jest.fn().mockResolvedValue({ id: 'enc-1' }),
      remove: jest.fn().mockResolvedValue({ message: 'Deleted' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EncouragementsController],
      providers: [{ provide: EncouragementsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<EncouragementsController>(EncouragementsController);
  });

  it('delegates findAll, create, findOne, update, and remove to service', async () => {
    await controller.findAll(user);
    expect(serviceMock.findAll).toHaveBeenCalledWith('church-1');

    await controller.create({ text: 'Hello' }, user);
    expect(serviceMock.create).toHaveBeenCalledWith('church-1', {
      text: 'Hello',
    });

    await controller.findOne('enc-1', user);
    expect(serviceMock.findOne).toHaveBeenCalledWith('enc-1', 'church-1');

    await controller.update('enc-1', { text: 'Updated' }, user);
    expect(serviceMock.update).toHaveBeenCalledWith('enc-1', 'church-1', {
      text: 'Updated',
    });

    await controller.remove('enc-1', user);
    expect(serviceMock.remove).toHaveBeenCalledWith('enc-1', 'church-1');
  });
});
