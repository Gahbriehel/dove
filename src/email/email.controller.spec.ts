import { Test, TestingModule } from '@nestjs/testing';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import {
  QueryEmailLogsDto,
  EmailLogTypeFilter,
} from './dto/query-email-logs.dto';

describe('EmailController', () => {
  let controller: EmailController;
  let emailServiceMock: {
    getEmailLogs: jest.Mock;
    sendToPerson: jest.Mock;
    sendToPeopleBatch: jest.Mock;
    sendToRegistrant: jest.Mock;
    sendToRegistrantsBatch: jest.Mock;
  };

  beforeEach(async () => {
    emailServiceMock = {
      getEmailLogs: jest.fn(),
      sendToPerson: jest.fn(),
      sendToPeopleBatch: jest.fn(),
      sendToRegistrant: jest.fn(),
      sendToRegistrantsBatch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        {
          provide: EmailService,
          useValue: emailServiceMock,
        },
      ],
    }).compile();

    controller = module.get<EmailController>(EmailController);
  });

  describe('getEmailLogs', () => {
    it('should delegate to emailService.getEmailLogs with query and churchId', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      emailServiceMock.getEmailLogs.mockResolvedValue(mockResult);

      const query: QueryEmailLogsDto = {
        page: 1,
        limit: 20,
        emailType: EmailLogTypeFilter.ALL,
      };

      const result = await controller.getEmailLogs(query, 'church-123');

      expect(emailServiceMock.getEmailLogs).toHaveBeenCalledWith(
        query,
        'church-123',
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('sendToPeopleBatch', () => {
    it('should delegate to emailService.sendToPeopleBatch with dto, churchId, and sentByUserId', async () => {
      const dto = {
        personIds: ['person-1', 'person-2'],
        subject: 'Weekly Fellowship & Community Announcement',
        heading: 'Welcome to Sunday Service',
        message: '<p>Join us this Sunday. Check out the flyer below!</p>',
        imageUrl:
          'https://api.abwog.org/public/uploads/1792601056334-762496662.jpg',
        ctaLabel: 'Read More',
        ctaUrl: 'https://example.org/news',
      };

      const mockResponse = {
        message:
          'Batch email processing completed. 2 sent successfully out of 2 valid recipients.',
        results: {
          totalTargeted: 2,
          totalWithEmail: 2,
          totalSent: 2,
          totalFailed: 0,
          failedRecipients: [],
        },
      };

      emailServiceMock.sendToPeopleBatch.mockResolvedValue(mockResponse);

      const result = await controller.sendToPeopleBatch(
        dto,
        'church-123',
        'admin-user-sub',
      );

      expect(emailServiceMock.sendToPeopleBatch).toHaveBeenCalledWith(
        dto,
        'church-123',
        'admin-user-sub',
      );
      expect(result).toBe(mockResponse);
    });
  });
});
