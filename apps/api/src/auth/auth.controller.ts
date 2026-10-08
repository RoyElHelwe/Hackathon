import { BadRequestException, Body, Controller, Get, NotFoundException, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { activeRoleBody, LOCALES } from '@tajriba/shared';
import { z } from 'zod';
import { config } from '../config';
import { AuthContext } from '../common/auth-context';
import { Auth, Can, Public } from '../common/decorators';
import { encrypt } from '../common/crypto';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, CLASSROOM_SCOPES, LOGIN_SCOPES } from './auth.service';

const safeNext = (next?: string) => (next && next.startsWith('/') && !next.startsWith('//') ? next : undefined);

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('config')
  authConfig() {
    return { google: this.auth.googleEnabled(), devLogin: config.DEV_LOGIN, classroomProvider: config.CLASSROOM_PROVIDER };
  }

  @Public()
  @Get('google')
  async google(@Res() res: Response, @Query('next') next?: string) {
    if (!this.auth.googleEnabled()) return res.redirect(`${config.WEB_URL}/login?error=google_not_configured`);
    const state = await this.auth.signState({ purpose: 'login', next: safeNext(next) });
    const url = this.auth.oauthClient().generateAuthUrl({ scope: LOGIN_SCOPES, state, prompt: 'select_account' });
    return res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  async callback(@Res() res: Response, @Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string) {
    if (error || !code || !state) return res.redirect(`${config.WEB_URL}/login?error=google_cancelled`);
    let st: { purpose: 'login' | 'classroom'; next?: string; uid?: string };
    try {
      st = await this.auth.verifyState(state);
    } catch {
      return res.redirect(`${config.WEB_URL}/login?error=expired`);
    }
    const client = this.auth.oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) return res.redirect(`${config.WEB_URL}/login?error=google_failed`);
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) return res.redirect(`${config.WEB_URL}/login?error=google_failed`);

    if (st.purpose === 'classroom') {
      const user = await this.prisma.user.findUnique({ where: { id: st.uid } });
      if (!user || user.googleId !== p.sub) return res.redirect(`${config.WEB_URL}/teacher/onboarding?error=wrong_account`);
      if (tokens.refresh_token) {
        await this.prisma.user.update({ where: { id: user.id }, data: { googleRefreshToken: encrypt(tokens.refresh_token) } });
      }
      await this.prisma.class.updateMany({ where: { teachers: { some: { teacherId: user.id } } }, data: { syncError: null } });
      return res.redirect(`${config.WEB_URL}/teacher/onboarding?step=import`);
    }

    const user = await this.auth.upsertFromGoogle({ googleId: p.sub, email: p.email, name: p.name ?? p.email, avatarUrl: p.picture });
    await this.auth.issue(res, { sub: user.id });
    return res.redirect(`${config.WEB_URL}${st.next ?? (await this.auth.homePath(user.id))}`);
  }

  @Public()
  @Get('dev/users')
  async devUsers() {
    if (!config.DEV_LOGIN) throw new NotFoundException();
    const users = await this.prisma.user.findMany({
      where: { devHandle: { not: null } },
      include: { memberships: { include: { school: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => ({
      handle: u.devHandle,
      name: u.name,
      avatarUrl: u.avatarUrl,
      roles: u.memberships.map((m) => ({ role: m.role, status: m.status, school: m.school.name })),
    }));
  }

  /** One-click login for filming and tests. Disabled unless DEV_LOGIN=true. */
  @Public()
  @Get('dev')
  async dev(@Res() res: Response, @Query('as') handle?: string, @Query('next') next?: string, @Query('json') json?: string) {
    if (!config.DEV_LOGIN) throw new NotFoundException();
    if (!handle) throw new BadRequestException('Missing ?as=<handle>');
    const user = await this.prisma.user.findUnique({ where: { devHandle: handle } });
    if (!user) throw new NotFoundException(`No dev user "${handle}"`);
    await this.prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
    await this.auth.issue(res, { sub: user.id });
    const target = safeNext(next) ?? (await this.auth.homePath(user.id));
    if (json) return res.json({ ok: true, redirect: target });
    return res.redirect(`${config.WEB_URL}${target}`);
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.auth.clear(res);
    return { ok: true };
  }
}

const patchMeBody = z.object({ locale: z.enum(LOCALES).optional(), name: z.string().trim().min(1).max(80).optional() });

@Controller('me')
export class MeController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Can('read', 'self')
  @Get()
  async me(@Auth() a: AuthContext) {
    const children =
      a.active?.role === 'PARENT'
        ? await this.prisma.parentLink.findMany({
            where: { parentId: a.userId, status: 'VERIFIED' },
            include: { student: { select: { id: true, name: true, avatarUrl: true } } },
          })
        : [];
    return {
      user: {
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
        avatarUrl: a.user.avatarUrl,
        locale: a.user.locale,
        status: a.user.status,
      },
      memberships: a.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        status: m.status,
        school: { id: m.school.id, name: m.school.name, city: m.school.city, schoolCode: m.school.schoolCode },
      })),
      active: a.active ? { id: a.active.id, role: a.active.role, schoolId: a.active.schoolId, schoolName: a.active.school.name } : null,
      classroomConnected: !!a.user.googleRefreshToken,
      children: children.map((c) => c.student),
      home: await this.auth.homePath(a.userId),
    };
  }

  @Can('write', 'self')
  @Patch()
  async update(@Auth() a: AuthContext, @Body(new ZodPipe(patchMeBody)) body: z.infer<typeof patchMeBody>) {
    await this.prisma.user.update({ where: { id: a.userId }, data: body });
    return { ok: true };
  }

  @Can('write', 'self')
  @Post('active-role')
  async activeRole(
    @Auth() a: AuthContext,
    @Body(new ZodPipe(activeRoleBody)) body: { membershipId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const m = a.memberships.find((x) => x.id === body.membershipId && x.status === 'APPROVED');
    if (!m) throw new BadRequestException('That role is not available.');
    await this.auth.issue(res, { sub: a.userId, mid: m.id });
    const home = { DIRECTOR: '/director', ADMIN: '/director', TEACHER: '/teacher', PARENT: '/parent', STUDENT: '/student' }[m.role];
    return { ok: true, home };
  }
}

/** Kept here so the classroom controller can reuse the same OAuth client and state signing. */
export async function classroomAuthUrl(auth: AuthService, userId: string): Promise<string> {
  const state = await auth.signState({ purpose: 'classroom', uid: userId });
  return auth.oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: [...LOGIN_SCOPES, ...CLASSROOM_SCOPES],
    state,
  });
}
