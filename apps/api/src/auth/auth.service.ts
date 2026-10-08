import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { SESSION_COOKIE, SessionPayload } from '../common/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '../generated/prisma/client';

export const LOGIN_SCOPES = ['openid', 'email', 'profile'];
export const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.coursework.students',
];

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  oauthClient(): OAuth2Client {
    return new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_REDIRECT_URI);
  }

  googleEnabled(): boolean {
    return !!config.GOOGLE_CLIENT_ID && !!config.GOOGLE_CLIENT_SECRET;
  }

  async signState(payload: Record<string, unknown>): Promise<string> {
    return this.jwt.signAsync(payload, { expiresIn: '10m' });
  }

  async verifyState<T extends object>(state: string): Promise<T> {
    return this.jwt.verifyAsync<T>(state);
  }

  /**
   * Golden rule 1: one person = one User, identified by googleId.
   * Users pre-created by a roster import (status INVITED) are activated on first sign-in.
   */
  async upsertFromGoogle(p: GoogleProfile): Promise<User> {
    const email = p.email.toLowerCase();
    const byGoogle = await this.prisma.user.findUnique({ where: { googleId: p.googleId } });
    if (byGoogle) {
      return this.prisma.user.update({
        where: { id: byGoogle.id },
        data: { status: 'ACTIVE', name: byGoogle.status === 'INVITED' ? p.name : byGoogle.name, avatarUrl: p.avatarUrl ?? byGoogle.avatarUrl },
      });
    }
    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId: p.googleId, status: 'ACTIVE', avatarUrl: p.avatarUrl ?? byEmail.avatarUrl },
      });
    }
    return this.prisma.user.create({
      data: { googleId: p.googleId, email, name: p.name, avatarUrl: p.avatarUrl ?? null, status: 'ACTIVE' },
    });
  }

  async issue(res: Response, payload: SessionPayload): Promise<string> {
    const token = await this.jwt.signAsync(payload, { expiresIn: '30d' });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.WEB_URL.startsWith('https://'),
      path: '/',
      maxAge: 30 * 24 * 3600 * 1000,
    });
    return token;
  }

  clear(res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  /** Where each role lands after sign-in. */
  async homePath(userId: string): Promise<string> {
    const ms = await this.prisma.membership.findMany({ where: { userId, status: 'APPROVED' } });
    if (ms.length === 0) return '/onboarding';
    const roles = ms.map((m) => m.role);
    if (roles.includes('DIRECTOR') || roles.includes('ADMIN')) return '/director';
    if (roles.includes('TEACHER')) return '/teacher';
    if (roles.includes('PARENT')) return '/parent';
    return '/student';
  }
}
