import { SetMetadata, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const AUTH_THROTTLE = 'ravion:auth-throttle';
export type AuthThrottleName = 'login' | 'register' | 'refresh';

const reflector = new Reflector();

export const AuthThrottle = (name: AuthThrottleName) => SetMetadata(AUTH_THROTTLE, name);

export function skipsAuthThrottle(name: AuthThrottleName) {
  return (context: ExecutionContext): boolean =>
    reflector.getAllAndOverride<AuthThrottleName | undefined>(AUTH_THROTTLE, [
      context.getHandler(),
      context.getClass(),
    ]) !== name;
}
