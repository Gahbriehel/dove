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
});
