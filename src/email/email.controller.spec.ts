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
});
