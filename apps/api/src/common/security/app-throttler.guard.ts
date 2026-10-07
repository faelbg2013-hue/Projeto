import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.path.startsWith('/api/docs')) {
      return true;
    }

    return super.shouldSkip(context);
  }

  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: Parameters<ThrottlerGuard['throwThrottlingException']>[1],
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    const seconds = Math.max(1, Math.ceil(detail.timeToBlockExpire));
    this.setResponseHeader(res, 'Retry-After', seconds);
    await super.throwThrottlingException(context, detail);
  }
}
