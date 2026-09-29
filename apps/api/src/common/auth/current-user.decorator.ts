import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@ravion/types';
import type { RequestWithUser } from './request-auth';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
