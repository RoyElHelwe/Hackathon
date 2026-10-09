import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { pickActive, SESSION_COOKIE, SessionPayload } from '../common/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { Role } from '@tajriba/shared';

export interface SocketIdentity {
  userId: string;
  name: string;
  role: Role;
  schoolId: string;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

/** Authenticates a socket handshake with the same session cookie + active membership as HTTP requests. */
@Injectable()
export class SocketAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async identify(cookieHeader: string | undefined): Promise<SocketIdentity | null> {
    const token = parseCookies(cookieHeader)[SESSION_COOKIE];
    if (!token) return null;
    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      return null;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { memberships: { include: { school: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!user) return null;
    const active = pickActive(user.memberships, payload.mid);
    if (!active) return null;
    return { userId: user.id, name: user.name, role: active.role, schoolId: active.schoolId };
  }
}
