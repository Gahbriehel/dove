import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MembershipStatus } from '@prisma/client';
import { MemberSessionService } from './member-session.service';
import { MemberAuthGuard, MemberJwtPayload } from './guards/member-auth.guard';
import { ActiveMemberData } from './decorators/current-member.decorator';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

describe('ProfileController', () => {
  let controller: ProfileController;
  let serviceMock: {
    claim: jest.Mock;
    getByToken: jest.Mock;
    updateByToken: jest.Mock;
    login: jest.Mock;
    getMe: jest.Mock;
    changePin: jest.Mock;
    logout: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      claim: jest.fn(),
      getByToken: jest.fn(),
      updateByToken: jest.fn(),
      login: jest.fn(),
      getMe: jest.fn(),
      changePin: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
      controllers: [ProfileController],
      providers: [
        {
          provide: ProfileService,
          useValue: serviceMock,
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        MemberSessionService,
        MemberAuthGuard,
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
    const result = (await controller.updateByToken('token-123', dto)) as {
      person: { membershipStatus: MembershipStatus };
    };
    expect(serviceMock.updateByToken).toHaveBeenCalledWith('token-123', dto);
    expect(result.person.membershipStatus).toBe(MembershipStatus.MEMBER);
  });

  it('should call login', async () => {
    serviceMock.login.mockResolvedValue({
      message: 'Login successful',
      accessToken: 'jwt-token',
      person: { id: 'p-1', firstName: 'Jane' },
    });
    const dto = {
      identifier: 'jane@example.com',
      pin: '1234',
    };
    const result = await controller.login(dto);
    expect(serviceMock.login).toHaveBeenCalledWith(dto);
    expect(result.accessToken).toBe('jwt-token');
  });

  it('should call getMe', async () => {
    serviceMock.getMe.mockResolvedValue({
      person: { id: 'p-1', firstName: 'Jane' },
      church: { id: 'church-1', name: 'Amazing Grace' },
    });
    const member: ActiveMemberData = { sub: 'p-1', churchId: 'church-1' };
    const result = await controller.getMe(member);
    expect(serviceMock.getMe).toHaveBeenCalledWith('p-1');
    expect(result.person.id).toBe('p-1');
  });

  it('should call changePin', async () => {
    serviceMock.changePin.mockResolvedValue({
      message: 'PIN updated successfully',
    });
    const member: ActiveMemberData = { sub: 'p-1', churchId: 'church-1' };
    const dto = { currentPin: '2846', newPin: '8137' };
    const result = await controller.changePin(member, dto);
    expect(serviceMock.changePin).toHaveBeenCalledWith('p-1', dto);
    expect(result.message).toBe('PIN updated successfully');
  });

  it('should call logout', async () => {
    serviceMock.logout.mockResolvedValue({
      message: 'Logged out successfully',
    });
    const req: { member: MemberJwtPayload; rawToken: string } = {
      member: { sub: 'p-1', churchId: 'church-1', jti: 'jti-1' },
      rawToken: 'token-xyz',
    };
    const result = await controller.logout(req);
    expect(serviceMock.logout).toHaveBeenCalledWith(req.member, 'token-xyz');
    expect(result.message).toBe('Logged out successfully');
  });
});
