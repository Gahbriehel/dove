import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { firstValueFrom, isObservable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      const request = context.switchToHttp().getRequest<Request>();
      const authHeader = request?.headers?.authorization;
      if (
        authHeader &&
        typeof authHeader === 'string' &&
        authHeader.startsWith('Bearer ')
      ) {
        try {
          const result = super.canActivate(context);
          if (result instanceof Promise) {
            await result;
          } else if (isObservable(result)) {
            await firstValueFrom(result);
          }
        } catch {
          // Token is invalid or expired on a public endpoint; proceed as unauthenticated
        }
      }
      return true;
    }

    const result = super.canActivate(context);
    if (result instanceof Promise) {
      return await result;
    } else if (isObservable(result)) {
      return await firstValueFrom(result);
    }
    return result;
  }
}
