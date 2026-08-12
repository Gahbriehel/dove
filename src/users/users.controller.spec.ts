import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { ActiveUserData } from '../common/decorators/current-user.decorator';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersServiceMock: {
    remove: jest.Mock;
    createUser: jest.Mock;
  };
  let rolesServiceMock: {
    findByName: jest.Mock;
  };
  let emailServiceMock: {
    sendAdminWelcome: jest.Mock;
  };
  let prismaMock: {
    church: {
      findUnique: jest.Mock;
    };
  };
  let configServiceMock: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    usersServiceMock = {
      remove: jest.fn(),
      createUser: jest.fn(),
    };
    rolesServiceMock = {
      findByName: jest.fn(),
    };
    emailServiceMock = {
      sendAdminWelcome: jest.fn().mockResolvedValue(undefined),
    };
    prismaMock = {
      church: {
        findUnique: jest.fn(),
      },
    };
    configServiceMock = {
      get: jest.fn(),
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
          useValue: rolesServiceMock,
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: EMAIL_SERVICE,
          useValue: emailServiceMock,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('create', () => {
    it('should create user and dispatch welcome email with churchName and loginUrl', async () => {
      rolesServiceMock.findByName.mockResolvedValue({
        id: 'role-admin',
        name: 'ADMIN',
      });
      usersServiceMock.createUser.mockResolvedValue({
        id: 'user-1',
        email: 'newadmin@church.org',
        churchId: 'church-123',
      });
      prismaMock.church.findUnique.mockResolvedValue({
        id: 'church-123',
        name: 'Grace Community Church',
      });
      configServiceMock.get.mockReturnValue('http://localhost:3000/login');

      const dto = {
        email: 'newadmin@church.org',
        password: 'TempPassword123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await controller.create(dto, 'church-123');

      expect(result).toHaveProperty('message', 'User created successfully');
      expect(emailServiceMock.sendAdminWelcome).toHaveBeenCalledWith({
        recipientEmail: 'newadmin@church.org',
        recipientName: 'John Doe',
        temporaryPassword: 'TempPassword123',
        churchName: 'Grace Community Church',
        loginUrl: 'http://localhost:3000/login',
      });
    });
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
