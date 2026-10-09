import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type SessionKind = 'STUDY' | 'EXAM';

/** Append-only action log for study sessions and exam rooms (the "recorded actions" timeline). */
@Injectable()
export class SessionLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(kind: SessionKind, refId: string, userId: string | null, type: string, payload: Record<string, unknown> = {}) {
    await this.prisma.sessionEvent
      .create({ data: { kind, refId, userId, type, payload: payload as Prisma.InputJsonValue } })
      .catch(() => undefined);
  }

  list(kind: SessionKind, refId: string) {
    return this.prisma.sessionEvent.findMany({ where: { kind, refId }, orderBy: { at: 'asc' }, take: 2000 });
  }
}
