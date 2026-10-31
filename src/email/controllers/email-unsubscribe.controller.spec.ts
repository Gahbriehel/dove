import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { signUnsubscribeToken } from '../utils/unsubscribe-token.util';
import { EmailUnsubscribeController } from './email-unsubscribe.controller';

describe('EmailUnsubscribeController', () => {
  let controller: EmailUnsubscribeController;

  const prismaMock = {
    person: { findUnique: jest.fn(), update: jest.fn() },
  };
  const configMock = {
    get: jest.fn((key: string) =>
      key === 'jwt.secret' ? 'secret' : undefined,
    ),
  };

  const makeRes = () => {
    const status = jest.fn().mockReturnThis();
    const send = jest.fn().mockReturnThis();
    const res = {
      status,
      type: jest.fn().mockReturnThis(),
      send,
    } as unknown as Response;
    const html = (): string => (send.mock.calls[0] as [string])[0];
    return { res, status, html };
  };

  const token = signUnsubscribeToken('person-1', 'secret');

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailUnsubscribeController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    controller = module.get(EmailUnsubscribeController);
  });

  it('GET renders a confirmation page and does not change state', async () => {
    prismaMock.person.findUnique.mockResolvedValue({
      id: 'person-1',
      emailOptOut: false,
      church: { name: 'Dove <Church>' },
    });
    const { res, html } = makeRes();

    await controller.confirm(token, res);

    expect(prismaMock.person.update).not.toHaveBeenCalled();
    expect(html()).toContain('<form method="post">');
    expect(html()).toContain('Dove &lt;Church&gt;');
  });

  it('POST opts the person out', async () => {
    prismaMock.person.findUnique.mockResolvedValue({
      id: 'person-1',
      emailOptOut: false,
      church: { name: 'Dove Church' },
    });
    const { res, html } = makeRes();

    await controller.unsubscribe(token, res);

    expect(prismaMock.person.update).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { emailOptOut: true, emailOptOutAt: expect.any(Date) as Date },
    });
    expect(html()).toContain('You have been unsubscribed');
  });

  it('POST is idempotent for an already opted-out person', async () => {
    prismaMock.person.findUnique.mockResolvedValue({
      id: 'person-1',
      emailOptOut: true,
      church: null,
    });
    const { res, html } = makeRes();

    await controller.unsubscribe(token, res);

    expect(prismaMock.person.update).not.toHaveBeenCalled();
    expect(html()).toContain('You have been unsubscribed');
  });

  it('rejects an invalid token with 400 and never touches the database', async () => {
    const { res, status } = makeRes();

    await controller.unsubscribe('person-1.forged', res);

    expect(status).toHaveBeenCalledWith(400);
    expect(prismaMock.person.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.person.update).not.toHaveBeenCalled();
  });

  it('rejects a validly signed token for a person that no longer exists', async () => {
    prismaMock.person.findUnique.mockResolvedValue(null);
    const { res, status } = makeRes();

    await controller.unsubscribe(token, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(prismaMock.person.update).not.toHaveBeenCalled();
  });
});
