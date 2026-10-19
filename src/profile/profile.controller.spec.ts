import { Test, TestingModule } from '@nestjs/testing';
import { MembershipStatus } from '@prisma/client';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

describe('ProfileController', () => {
  let controller: ProfileController;
  let serviceMock: {
    claim: jest.Mock;
    getByToken: jest.Mock;
    updateByToken: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      claim: jest.fn(),
      getByToken: jest.fn(),
      updateByToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: ProfileService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call claim', async () => {
    serviceMock.claim.mockResolvedValue({ message: 'Sent' });
    const dto = { email: 'test@example.com' };
    const result = await controller.claim(dto);
    expect(serviceMock.claim).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ message: 'Sent' });
  });

  it('should call getByToken', async () => {
    serviceMock.getByToken.mockResolvedValue({
      person: { id: 'p-1', firstName: 'John' },
      availableDepartments: [],
    });
    const result = await controller.getByToken('token-123');
    expect(serviceMock.getByToken).toHaveBeenCalledWith('token-123');
    expect(result.person.firstName).toBe('John');
  });

  it('should call updateByToken', async () => {
    serviceMock.updateByToken.mockResolvedValue({
      message: 'Updated',
      person: { id: 'p-1', membershipStatus: MembershipStatus.MEMBER },
    });
    const dto = {
      firstName: 'Jane',
      membershipStatus: MembershipStatus.MEMBER,
    };
    const result = await controller.updateByToken('token-123', dto);
    expect(serviceMock.updateByToken).toHaveBeenCalledWith('token-123', dto);
    expect(result.person.membershipStatus).toBe(MembershipStatus.MEMBER);
  });
});
