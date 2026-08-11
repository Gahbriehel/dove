import { Test, TestingModule } from '@nestjs/testing';
import type { ActiveUserData } from '../common/decorators/current-user.decorator';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import { RolesService } from '../roles/roles.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersServiceMock: {
    remove: jest.Mock;
  };

  beforeEach(async () => {
    usersServiceMock = {
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: RolesService,
          useValue: {},
        },
        {
          provide: EMAIL_SERVICE,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('remove', () => {
    it('should call usersService.remove with id and currentUser', async () => {
      const currentUser: ActiveUserData = {
        sub: 'admin-1',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        churchId: 'church-1',
      };

      usersServiceMock.remove.mockResolvedValue({
        message: 'User deleted successfully',
      });

      const result = await controller.remove('target-1', currentUser);
      expect(usersServiceMock.remove).toHaveBeenCalledWith(
        'target-1',
        currentUser,
      );
      expect(result).toEqual({ message: 'User deleted successfully' });
    });
  });
});
