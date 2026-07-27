import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface ActiveUserData {
  sub: string;
  email: string;
  roles: string[];
  churchId: string;
}

interface RequestWithUser extends Request {
  user?: ActiveUserData;
}

export const CurrentUser = createParamDecorator(
  (data: keyof ActiveUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
