import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { ResendWebhookPayloadDto } from '../dto/resend-webhook.dto';
import { EmailBounceService } from '../services/email-bounce.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class ResendWebhookController {
  private readonly logger = new Logger(ResendWebhookController.name);

  constructor(
    private readonly emailBounceService: EmailBounceService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle incoming Resend email bounce & delivery webhooks',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid Svix webhook signature' })
  async handleResendWebhook(
    @Body() payload: ResendWebhookPayloadDto,
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ) {
    const webhookSecret = this.configService.get<string>(
      'RESEND_WEBHOOK_SECRET',
    );

    // If secret is configured, perform signature verification
    if (webhookSecret && webhookSecret.trim() !== '') {
      if (!svixId || !svixTimestamp || !svixSignature) {
        this.logger.error(
          'Missing Svix signature headers in Resend webhook request',
        );
        throw new UnauthorizedException('Missing webhook signature headers');
      }

      const isValid = this.verifySvixSignature(
        webhookSecret,
        svixId,
        svixTimestamp,
        payload,
        svixSignature,
      );

      if (!isValid) {
        this.logger.error('Invalid Svix signature in Resend webhook payload');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    this.logger.log(`Received Resend webhook event: ${payload.type}`);
    return this.emailBounceService.handleWebhookPayload(payload);
  }

  private verifySvixSignature(
    secret: string,
    msgId: string,
    msgTimestamp: string,
    payload: unknown,
    signatureHeader: string,
  ): boolean {
    try {
      const formattedSecret = secret.startsWith('whsec_')
        ? secret.substring(6)
        : secret;
      const secretBytes = Buffer.from(formattedSecret, 'base64');

      const bodyString =
        typeof payload === 'string' ? payload : JSON.stringify(payload);
      const toSign = `${msgId}.${msgTimestamp}.${bodyString}`;

      const computedHmac = crypto
        .createHmac('sha256', secretBytes)
        .update(toSign)
        .digest('base64');

      const passedSignatures = signatureHeader.split(' ');
      for (const sig of passedSignatures) {
        const [version, signature] = sig.split(',');
        if (version === 'v1' && signature === computedHmac) {
          return true;
        }
      }
      return false;
    } catch (err) {
      this.logger.error(
        `Error verifying Svix signature: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
