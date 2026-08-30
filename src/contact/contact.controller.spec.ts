import { Test, TestingModule } from '@nestjs/testing';
import { ContactController, CustomRequest } from './contact.controller';
import { ContactService } from './contact.service';

describe('ContactController', () => {
  let controller: ContactController;
  let serviceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [
        {
          provide: ContactService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<ContactController>(ContactController);
  });

  it('should call ContactService.create and assign customResponseMessage on the request object for prayer requests', async () => {
    const dto = {
      type: 'prayer',
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      category: 'Healing & Health',
      message: 'Please pray.',
    };

    const expectedSubmission = {
      id: 'contact_123',
      ...dto,
      createdAt: new Date(),
    };

    serviceMock.create.mockResolvedValue(expectedSubmission);

    const mockReq = {
      customResponseMessage: undefined,
    } as unknown as CustomRequest;

    const result = await controller.submitContact(
      dto,
      mockReq,
      undefined,
      undefined,
      undefined,
    );

    expect(serviceMock.create).toHaveBeenCalledWith(dto, undefined);
    expect(mockReq.customResponseMessage).toBe(
      'Your prayer request has been submitted successfully.',
    );
    expect(result).toBe(expectedSubmission);
  });

  it('should call ContactService.create and assign customResponseMessage on the request object for inquiries', async () => {
    const dto = {
      type: 'inquiry',
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      category: 'Visiting This Sunday',
      message: 'What time is the service?',
    };

    const expectedSubmission = {
      id: 'contact_123',
      ...dto,
      createdAt: new Date(),
    };

    serviceMock.create.mockResolvedValue(expectedSubmission);

    const mockReq = {
      customResponseMessage: undefined,
    } as unknown as CustomRequest;

    const result = await controller.submitContact(
      dto,
      mockReq,
      undefined,
      undefined,
      undefined,
    );

    expect(serviceMock.create).toHaveBeenCalledWith(dto, undefined);
    expect(mockReq.customResponseMessage).toBe(
      'Your inquiry has been submitted successfully.',
    );
    expect(result).toBe(expectedSubmission);
  });

  it('should extract tenantSlug from Param', async () => {
    const dto = {
      type: 'prayer',
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      category: 'Healing & Health',
      message: 'Please pray.',
    };

    const mockReq = {
      customResponseMessage: undefined,
    } as unknown as CustomRequest;

    await controller.submitContact(
      dto,
      mockReq,
      undefined,
      undefined,
      'grace-church',
    );

    expect(serviceMock.create).toHaveBeenCalledWith(dto, 'grace-church');
  });

  it('should extract tenantSlug from headers in order of precedence: param > x-tenant-slug > x-tenant-key', async () => {
    const dto = {
      type: 'prayer',
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      category: 'Healing & Health',
      message: 'Please pray.',
    };

    const mockReq = {
      customResponseMessage: undefined,
    } as unknown as CustomRequest;

    // Param takes precedence over headers
    await controller.submitContact(
      dto,
      mockReq,
      'slug-header',
      'key-header',
      'param-slug',
    );
    expect(serviceMock.create).toHaveBeenCalledWith(dto, 'param-slug');

    // X-Tenant-Slug takes precedence over X-Tenant-Key when param is missing
    await controller.submitContact(
      dto,
      mockReq,
      'slug-header',
      'key-header',
      undefined,
    );
    expect(serviceMock.create).toHaveBeenCalledWith(dto, 'slug-header');

    // X-Tenant-Key falls back when param and x-tenant-slug are missing
    await controller.submitContact(
      dto,
      mockReq,
      undefined,
      'key-header',
      undefined,
    );
    expect(serviceMock.create).toHaveBeenCalledWith(dto, 'key-header');
  });

  describe('findAll', () => {
    it('should call ContactService.findAll with query parameters and user', async () => {
      const mockResult = {
        items: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      serviceMock.findAll.mockResolvedValue(mockResult);

      const query = { page: 1, limit: 10 };
      const user = {
        sub: 'u1',
        email: 'a@a.com',
        roles: ['ADMIN'],
        churchId: 'church-a',
      };

      const result = await controller.findAll(query, user);

      expect(serviceMock.findAll).toHaveBeenCalledWith(query, user);
      expect(result).toBe(mockResult);
    });
  });

  describe('findOne', () => {
    it('should call ContactService.findOne with id and user', async () => {
      const mockSubmission = {
        id: 'contact-1',
        churchId: 'church-a',
        type: 'prayer',
      };
      serviceMock.findOne.mockResolvedValue(mockSubmission);

      const user = {
        sub: 'u1',
        email: 'a@a.com',
        roles: ['ADMIN'],
        churchId: 'church-a',
      };
      const result = await controller.findOne('contact-1', user);

      expect(serviceMock.findOne).toHaveBeenCalledWith('contact-1', user);
      expect(result).toBe(mockSubmission);
    });
  });
});
