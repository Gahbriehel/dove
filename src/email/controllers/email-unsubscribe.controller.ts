import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyUnsubscribeToken } from '../utils/unsubscribe-token.util';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const page = (title: string, body: string): string => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#f8fafc;margin:0;padding:48px 16px;color:#0f172a}
.card{max-width:440px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;text-align:center}
h1{font-size:20px;margin:0 0 12px}p{font-size:15px;line-height:1.5;color:#334155;margin:0 0 20px}
button{background:#2563eb;color:#fff;border:0;border-radius:6px;padding:12px 24px;font-size:15px;font-weight:700;cursor:pointer}
</style></head><body><div class="card">${body}</div></body></html>`;

/**
 * Public unsubscribe endpoints for broadcast emails. GET only renders a
 * confirmation page (mail scanners and link previewers fetch GET URLs, so it
 * must never change state); POST performs the opt-out and is also the target
 * of the RFC 8058 `List-Unsubscribe-Post` one-click request.
 */
@ApiExcludeController()
@Controller('email/unsubscribe')
export class EmailUnsubscribeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get(':token')
  async confirm(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const person = await this.resolvePerson(token);
    if (!person) {
      res.status(HttpStatus.BAD_REQUEST).type('html').send(this.invalidPage());
      return;
    }

    const churchName = escapeHtml(person.church?.name || 'this church');
    res.type('html').send(
      page(
        'Unsubscribe',
        `<h1>Unsubscribe from ${churchName} emails?</h1>
<p>You will no longer receive announcements and broadcast emails at this address.</p>
<form method="post"><button type="submit">Unsubscribe</button></form>`,
      ),
    );
  }

  @Public()
  @Post(':token')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const person = await this.resolvePerson(token);
    if (!person) {
      res.status(HttpStatus.BAD_REQUEST).type('html').send(this.invalidPage());
      return;
    }

    if (!person.emailOptOut) {
      await this.prisma.person.update({
        where: { id: person.id },
        data: { emailOptOut: true, emailOptOutAt: new Date() },
      });
    }

    const churchName = escapeHtml(person.church?.name || 'this church');
    res.type('html').send(
      page(
        'Unsubscribed',
        `<h1>You have been unsubscribed</h1>
<p>You will no longer receive broadcast emails from ${churchName}. If this was a mistake, please contact the church office.</p>`,
      ),
    );
  }

  private async resolvePerson(token: string) {
    const secret = this.configService.get<string>('jwt.secret');
    if (!secret) return null;

    const personId = verifyUnsubscribeToken(token, secret);
    if (!personId) return null;

    return this.prisma.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        emailOptOut: true,
        church: { select: { name: true } },
      },
    });
  }

  private invalidPage(): string {
    return page(
      'Link not valid',
      `<h1>This link is not valid</h1>
<p>The unsubscribe link is invalid or no longer applies. Please contact the church office to be removed from the list.</p>`,
    );
  }
}
