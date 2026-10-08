import { Injectable } from '@nestjs/common';
import type { NotificationType } from '@tajriba/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a notification. With a dedupeKey, repeated calls are no-ops (idempotent jobs). */
  async notify(userId: string, type: NotificationType, payload: Record<string, unknown>, dedupeKey?: string) {
    if (dedupeKey) {
      const existing = await this.prisma.notification.findUnique({ where: { dedupeKey } });
      if (existing) return existing;
    }
    try {
      return await this.prisma.notification.create({
        data: { userId, type, payload: payload as Prisma.InputJsonValue, dedupeKey },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null;
      throw e;
    }
  }

  async notifyMany(userIds: string[], type: NotificationType, payload: Record<string, unknown>, dedupePrefix?: string) {
    for (const id of userIds) await this.notify(id, type, payload, dedupePrefix ? `${dedupePrefix}:${id}` : undefined);
  }

  list(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }
}
