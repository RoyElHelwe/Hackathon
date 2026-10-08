import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { roleMayEver } from '@tajriba/shared';
import { PrismaService } from '../prisma/prisma.service';
import { pickActive, RequestWithAuth, SESSION_COOKIE, SessionPayload } from './auth-context';
import { IS_PUBLIC, POLICY, PolicyMeta } from './decorators';

/** Reads the session cookie and attaches `req.auth`. Never rejects on its own. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithAuth>();
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (!token) return true;
    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      return true;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { memberships: { include: { school: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!user) return true;
    const { memberships, ...rest } = user;
    req.auth = { userId: user.id, user: rest, memberships, active: pickActive(memberships, payload.mid) };
    return true;
  }
}

/** Default-deny policy guard: every route must be @Public() or declare @Can(action, resource). */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const policy = this.reflector.getAllAndOverride<PolicyMeta>(POLICY, targets);
    const req = ctx.switchToHttp().getRequest<RequestWithAuth>();
    if (!req.auth) throw new UnauthorizedException('Please sign in.');
    if (!policy) throw new ForbiddenException('No policy declared for this endpoint.');
    if (policy.resource === 'self') return true;
    const active = req.auth.active;
    if (!active) throw new ForbiddenException('Join a school first.');
    if (!roleMayEver(active.role, policy.action, policy.resource)) throw new ForbiddenException('You do not have access to this.');
    return true;
  }
}
