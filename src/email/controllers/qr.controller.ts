import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import * as QRCode from 'qrcode';
import { Public } from '../../common/decorators/public.decorator';

@ApiExcludeController()
@Controller('qr')
export class QrController {
  @Public()
  @Get(':token.png')
  async getQrCode(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await QRCode.toBuffer(token, { type: 'png' });
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  }
}
