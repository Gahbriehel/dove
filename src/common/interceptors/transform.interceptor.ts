import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

export interface ResponseFormat<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ResponseFormat<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ResponseFormat<T>> {
    const customMessage = this.reflector.getAllAndOverride<string>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data: T) => {
        const req = context
          .switchToHttp()
          .getRequest<Record<string, unknown>>();
        let message = customMessage;

        if (
          !message &&
          req &&
          'customResponseMessage' in req &&
          typeof req.customResponseMessage === 'string'
        ) {
          message = req.customResponseMessage;
        }

        if (
          !message &&
          data &&
          typeof data === 'object' &&
          'message' in data &&
          typeof (data as Record<string, unknown>).message === 'string'
        ) {
          message = (data as Record<string, unknown>).message as string;
        }

        if (!message) {
          const request = context
            .switchToHttp()
            .getRequest<{ method?: string }>();
          const method = request?.method ? request.method.toUpperCase() : '';
          switch (method) {
            case 'GET':
              message = 'Data retrieved successfully';
              break;
            case 'POST':
              message = 'Resource created successfully';
              break;
            case 'PUT':
            case 'PATCH':
              message = 'Resource updated successfully';
              break;
            case 'DELETE':
              message = 'Resource deleted successfully';
              break;
            default:
              message = 'Operation successful';
              break;
          }
        }

        return {
          success: true,
          message,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
