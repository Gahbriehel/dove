import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { MemberJwtPayload } from '../guards/member-auth.guard';

export type ActiveMemberData = MemberJwtPayload;

export const CurrentMember = createParamDecorator(
  (data: keyof ActiveMemberData | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<
        Request & { member?: ActiveMemberData; user?: ActiveMemberData }
      >();
    const member = request.member || request.user;

    return data ? member?.[data] : member;
  },
);
