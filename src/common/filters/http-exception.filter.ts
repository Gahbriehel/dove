import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let extraData: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const respObj = exceptionResponse as Record<string, unknown>;
        if (typeof respObj.message === 'string') {
          message = respObj.message;
        } else if (Array.isArray(respObj.message)) {
          message = respObj.message as string[];
        }

        // Preserve any additional custom properties (e.g. registration, qrCodeDataUrl)
        const rest = { ...respObj };
        delete rest.message;
        delete rest.statusCode;
        delete rest.error;
        extraData = rest;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const targetMeta = exception.meta?.target;
        const target = Array.isArray(targetMeta)
          ? targetMeta.join(', ')
          : typeof targetMeta === 'string'
            ? targetMeta
            : 'field';
        message = `A record with this ${target} already exists.`;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Requested record was not found.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = `Database operation failed: ${exception.message}`;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled Exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error:
        exception instanceof HttpException
          ? exception.name
          : exception instanceof Prisma.PrismaClientKnownRequestError
            ? `PrismaError_${exception.code}`
            : 'InternalServerError',
      ...extraData,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
