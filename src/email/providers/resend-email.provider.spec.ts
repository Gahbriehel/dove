jest.mock('../utils/sanitize-html.util', () => ({
  isHtmlContent: (val: string) => /<\/?[a-z][\s\S]*>/i.test(val),
  sanitizeEmailHtml: (html: string) => html,
}));

jest.mock('@react-email/render', () => ({
  render: (
    element: import('react').ReactElement,
    options?: { plainText?: boolean },
  ): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderToStaticMarkup } = require('react-dom/server') as {
      renderToStaticMarkup: (el: import('react').ReactElement) => string;
    };
    const html = renderToStaticMarkup(element);
    return Promise.resolve(
      options?.plainText ? html.replace(/<[^>]+>/g, ' ') : html,
    );
  },
}));

const batchSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ batch: { send: batchSend } })),
}));

import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomEmailData } from '../interfaces/email-service.interface';
import { ResendEmailProvider } from './resend-email.provider';

describe('ResendEmailProvider.sendBatchCustomBroadcast', () => {
  let provider: ResendEmailProvider;

  const prismaMock = { emailSendLog: { create: jest.fn() } };
  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'resend.apiKey') return 're_test';
      if (key === 'resend.from') return 'info@abwog.org';
      return undefined;
    }),
  };

  const item = (overrides: Partial<CustomEmailData> = {}): CustomEmailData => ({
    recipientEmail: 'alice@example.com',
    recipientName: 'Alice Smith',
    subject: 'Announcement',
    message: '<p>Hello</p>',
    churchName: 'Dove Church',
    ...overrides,
  });

  const sentPayloads = () =>
    (
      batchSend.mock.calls[0] as [
        Array<{ headers?: Record<string, string>; html: string }>,
      ]
    )[0];

  beforeEach(() => {
    jest.clearAllMocks();
    batchSend.mockResolvedValue({ data: { data: [{ id: 'email-1' }] } });
    provider = new ResendEmailProvider(
      configMock as unknown as ConfigService,
      prismaMock as unknown as PrismaService,
    );
  });

  it('adds one-click List-Unsubscribe headers and a footer link when unsubscribeUrl is set', async () => {
    const url = 'https://api.abwog.org/api/v1/email/unsubscribe/abc';

    await provider.sendBatchCustomBroadcast([item({ unsubscribeUrl: url })]);

    const [payload] = sentPayloads();
    expect(payload.headers).toEqual(
      expect.objectContaining({
        'List-Unsubscribe': `<${url}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }),
    );
    expect(payload.html).toContain(`href="${url}"`);
  });

  it('sends no unsubscribe headers or link when unsubscribeUrl is absent', async () => {
    await provider.sendBatchCustomBroadcast([item()]);

    const [payload] = sentPayloads();
    expect(payload.headers).not.toHaveProperty('List-Unsubscribe');
    expect(payload.headers).not.toHaveProperty('List-Unsubscribe-Post');
    expect(payload.html).not.toContain('Unsubscribe');
  });

  it('does not add unsubscribe to birthday greetings even if a URL is passed', async () => {
    await provider.sendBatchCustomBroadcast([
      item({
        emailType: 'BIRTHDAY_GREETING',
        unsubscribeUrl: 'https://api.abwog.org/api/v1/email/unsubscribe/abc',
      }),
    ]);

    const [payload] = sentPayloads();
    expect(payload.html).not.toContain('Unsubscribe');
  });
});
