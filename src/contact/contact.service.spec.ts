import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  let service: ContactService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    church: {
      findUnique: jest.Mock;
    };
    contactSubmission: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('default-church-id'),
      church: {
        findUnique: jest.fn(),
      },
      contactSubmission: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
  });

  describe('create', () => {
    it('should create a prayer request successfully with valid category and custom ID', async () => {
      prismaMock.contactSubmission.create.mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          createdAt: new Date(),
        }),
      );

      const dto = {
        type: 'prayer',
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: '+234 802 3308 877',
        category: 'Healing & Health',
        message: "Please pray for my mother's recovery.",
        isPrivate: true,
      };

      const result = await service.create(dto);

      expect(prismaMock.getDefaultChurchId).toHaveBeenCalled();
      expect(result.id).toMatch(/^contact_[a-f0-9]{12}$/);
      expect(result.churchId).toBe('default-church-id');
      expect(result.type).toBe('prayer');
      expect(result.name).toBe('Jane Doe');
      expect(result.email).toBe('jane.doe@example.com');
      expect(result.phone).toBe('+234 802 3308 877');
      expect(result.category).toBe('Healing & Health');
      expect(result.message).toBe("Please pray for my mother's recovery.");
      expect(result.isPrivate).toBe(true);
    });

    it('should default isPrivate to false for prayer requests when omitted', async () => {
      prismaMock.contactSubmission.create.mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          createdAt: new Date(),
        }),
      );

      const dto = {
        type: 'prayer',
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        category: 'General Prayer',
        message: 'Normal prayer',
      };

      const result = await service.create(dto);

      expect(result.isPrivate).toBe(false);
    });

    it('should create an inquiry request successfully, normalizing isPrivate to false', async () => {
      prismaMock.contactSubmission.create.mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          createdAt: new Date(),
        }),
      );

      const dto = {
        type: 'inquiry',
        name: 'John Doe',
        email: 'john.doe@example.com',
        category: 'Visiting This Sunday',
        message: 'Where is the main entrance?',
        isPrivate: true, // Should be normalized to false
      };

      const result = await service.create(dto);

      expect(result.type).toBe('inquiry');
      expect(result.isPrivate).toBe(false);
    });

    it('should resolve the church by tenantSlug when provided', async () => {
      prismaMock.church.findUnique.mockResolvedValue({
        id: 'tenant-church-id',
        slug: 'grace-church',
      });

      prismaMock.contactSubmission.create.mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          createdAt: new Date(),
        }),
      );

      const dto = {
        type: 'inquiry',
        name: 'John Doe',
        email: 'john.doe@example.com',
        category: 'Volunteering',
        message: 'How can I volunteer?',
      };

      const result = await service.create(dto, 'grace-church');

      expect(prismaMock.church.findUnique).toHaveBeenCalledWith({
        where: { slug: 'grace-church' },
      });
      expect(result.churchId).toBe('tenant-church-id');
    });

    it('should throw NotFoundException if church slug is not found', async () => {
      prismaMock.church.findUnique.mockResolvedValue(null);

      const dto = {
        type: 'inquiry',
        name: 'John Doe',
        email: 'john.doe@example.com',
        category: 'Volunteering',
        message: 'How can I volunteer?',
      };

      await expect(service.create(dto, 'unknown-church')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if category is invalid for prayer requests', async () => {
      const dto = {
        type: 'prayer',
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        category: 'Invalid Category',
        message: 'A prayer request',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if category is invalid for inquiries', async () => {
      const dto = {
        type: 'inquiry',
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        category: 'Healing & Health', // valid for prayer, not inquiry
        message: 'An inquiry',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return contact submissions filtered for normal ADMIN', async () => {
      const mockSubmissions = [
        { id: '1', churchId: 'church-a', type: 'prayer', name: 'Jane' },
      ];
      prismaMock.contactSubmission.findMany.mockResolvedValue(mockSubmissions);
      prismaMock.contactSubmission.count.mockResolvedValue(1);

      const query = { page: 1, limit: 10 };
      const user = {
        sub: 'u1',
        email: 'a@a.com',
        roles: ['ADMIN'],
        churchId: 'church-a',
      };

      const result = await service.findAll(query, user);

      expect(prismaMock.contactSubmission.findMany).toHaveBeenCalledWith({
        where: { churchId: 'church-a' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result.items).toEqual(mockSubmissions);
      expect(result.meta.total).toBe(1);
    });

    it('should permit SUPER_ADMIN to query across all churches', async () => {
      prismaMock.contactSubmission.findMany.mockResolvedValue([]);
      prismaMock.contactSubmission.count.mockResolvedValue(0);

      const query = { page: 1, limit: 10 };
      const user = {
        sub: 'u1',
        email: 'sa@a.com',
        roles: ['SUPER_ADMIN'],
        churchId: 'church-a',
      };

      await service.findAll(query, user);

      expect(prismaMock.contactSubmission.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should query a specific church for SUPER_ADMIN when churchId is provided', async () => {
      prismaMock.contactSubmission.findMany.mockResolvedValue([]);
      prismaMock.contactSubmission.count.mockResolvedValue(0);

      const query = { page: 1, limit: 10, churchId: 'church-b' };
      const user = {
        sub: 'u1',
        email: 'sa@a.com',
        roles: ['SUPER_ADMIN'],
        churchId: 'church-a',
      };

      await service.findAll(query, user);

      expect(prismaMock.contactSubmission.findMany).toHaveBeenCalledWith({
        where: { churchId: 'church-b' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });
  });

  describe('findOne', () => {
    it('should return contact submission if churchId matches normal ADMIN', async () => {
      const mockSubmission = {
        id: 'contact-1',
        churchId: 'church-a',
        type: 'prayer',
      };
      prismaMock.contactSubmission.findUnique.mockResolvedValue(mockSubmission);

      const user = {
        sub: 'u1',
        email: 'a@a.com',
        roles: ['ADMIN'],
        churchId: 'church-a',
      };
      const result = await service.findOne('contact-1', user);

      expect(result).toEqual(mockSubmission);
    });

    it('should throw NotFoundException if churchId does not match normal ADMIN', async () => {
      const mockSubmission = {
        id: 'contact-1',
        churchId: 'church-other',
        type: 'prayer',
      };
      prismaMock.contactSubmission.findUnique.mockResolvedValue(mockSubmission);

      const user = {
        sub: 'u1',
        email: 'a@a.com',
        roles: ['ADMIN'],
        churchId: 'church-a',
      };
      await expect(service.findOne('contact-1', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return contact submission for SUPER_ADMIN regardless of churchId', async () => {
      const mockSubmission = {
        id: 'contact-1',
        churchId: 'church-other',
        type: 'prayer',
      };
      prismaMock.contactSubmission.findUnique.mockResolvedValue(mockSubmission);

      const user = {
        sub: 'u1',
        email: 'sa@a.com',
        roles: ['SUPER_ADMIN'],
        churchId: 'church-a',
      };
      const result = await service.findOne('contact-1', user);

      expect(result).toEqual(mockSubmission);
    });
  });
});
