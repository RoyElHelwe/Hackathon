import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Action, Resource } from '@tajriba/shared';
import type { RequestWithAuth, AuthContext } from './auth-context';

export const IS_PUBLIC = 'isPublic';
export const POLICY = 'policy';

/** No authentication required. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface PolicyMeta {
  action: Action;
  resource: Resource;
}

/** Declares the coarse policy of an endpoint. Object-level checks happen in services via `can()`. */
export const Can = (action: Action, resource: Resource) => SetMetadata(POLICY, { action, resource } satisfies PolicyMeta);

export const Auth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  return ctx.switchToHttp().getRequest<RequestWithAuth>().auth!;
});
