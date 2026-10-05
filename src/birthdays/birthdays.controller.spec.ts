import { Test, TestingModule } from '@nestjs/testing';
import { BirthdaysController } from './birthdays.controller';
import { BirthdaysService } from './birthdays.service';
import { BirthdayStatusFilter } from './dto/query-birthday.dto';

describe('BirthdaysController', () => {
  let controller: BirthdaysController;
  let serviceMock: {
    sendBirthdayGreeting: jest.Mock;
    getBirthdays: jest.Mock;
    getBirthdayAnalytics: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      sendBirthdayGreeting: jest.fn(),
      getBirthdays: jest.fn(),
      getBirthdayAnalytics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BirthdaysController],
      providers: [
        {
          provide: BirthdaysService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<BirthdaysController>(BirthdaysController);
  });

  describe('sendGreeting', () => {
    it('should delegate sending birthday greeting to service', async () => {
      const dto = {
        personId: 'person-1',
        subject: 'Happy Birthday!',
        message: 'Wishing you all the best!',
        imageUrl: '/public/uploads/card.png',
      };
      const expectedResponse = {
        message: 'Birthday greeting successfully sent',
        greeting: { id: 'g-1' },
      };

      serviceMock.sendBirthdayGreeting.mockResolvedValue(expectedResponse);

      const result = await controller.sendGreeting(dto, 'user-1', 'church-1');

      expect(serviceMock.sendBirthdayGreeting).toHaveBeenCalledWith(
        dto,
        'user-1',
        'church-1',
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getBirthdays', () => {
    it('should retrieve list of birthdays with query params', async () => {
      const query = {
        year: 2026,
        month: 10,
        status: BirthdayStatusFilter.PENDING,
      };
      const expectedResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      };

      serviceMock.getBirthdays.mockResolvedValue(expectedResponse);

      const result = await controller.getBirthdays(query, 'church-1');

      expect(serviceMock.getBirthdays).toHaveBeenCalledWith(query, 'church-1');
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getAnalytics', () => {
    it('should retrieve birthday analytics', async () => {
      const query = { year: 2026 };
      const expectedResponse = {
        year: 2026,
        totalBirthdays: 50,
        completedCount: 30,
        pendingCount: 15,
        missedCount: 5,
        handlingRate: 60,
        monthlyBreakdown: [],
      };

      serviceMock.getBirthdayAnalytics.mockResolvedValue(expectedResponse);

      const result = await controller.getAnalytics(query, 'church-1');

      expect(serviceMock.getBirthdayAnalytics).toHaveBeenCalledWith(
        query,
        'church-1',
      );
      expect(result).toEqual(expectedResponse);
    });
  });
});
