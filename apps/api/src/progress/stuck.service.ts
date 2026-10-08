import { Injectable } from '@nestjs/common';
import { dayKey, I18nText, pickText, StuckReason, stuckReasons } from '@tajriba/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export interface StuckEntry {
  studentId: string;
  studentName: string;
  topicId: string;
  topicKey: string;
  topicName: unknown;
  reasons: StuckReason[];
}

@Injectable()
export class StuckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Stuck entries for students in a class (computed live from submissions). */
  async forClass(classId: string, now = new Date()): Promise<StuckEntry[]> {
    const enr = await this.prisma.enrollment.findMany({ where: { classId, status: 'ACTIVE' }, include: { student: true } });
    if (!enr.length) return [];
    const subs = await this.prisma.submission.findMany({
      where: { studentId: { in: enr.map((e) => e.studentId) }, mission: { classId } },
      include: { mission: { include: { topic: true } } },
    });
    const groups = new Map<string, typeof subs>();
    for (const s of subs) {
      const k = `${s.studentId}|${s.mission.topicId}`;
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    const out: StuckEntry[] = [];
    for (const [k, list] of groups) {
      const [studentId, topicId] = k.split('|');
      if (list.some((s) => s.status === 'VALIDATED')) continue;
      const retries = list.reduce((sum, s) => sum + (s.attempt - 1) + (s.status === 'RETRY' ? 1 : 0), 0);
      const inProgress = list.filter((s) => s.status === 'IN_PROGRESS');
      const hints = inProgress.reduce((sum, s) => sum + s.hintsUsed, 0);
      const since = inProgress.length ? new Date(Math.min(...inProgress.map((s) => s.startedAt.getTime()))) : null;
      const reasons = stuckReasons({ retriesOnTopic: retries, hintsWithoutSubmit: hints, inProgressSince: since, now });
      if (!reasons.length) continue;
      const student = enr.find((e) => e.studentId === studentId)!.student;
      const topic = list[0].mission.topic;
      out.push({ studentId, studentName: student.name, topicId, topicKey: topic.key, topicName: topic.name, reasons });
    }
    return out;
  }

  /** Creates STUCK_ALERT notifications for class teachers, deduplicated per student × topic per day. */
  async notifyClass(classId: string, now = new Date()) {
    const entries = await this.forClass(classId, now);
    if (!entries.length) return 0;
    const teachers = await this.prisma.classTeacher.findMany({ where: { classId } });
    let created = 0;
    for (const e of entries) {
      for (const t of teachers) {
        const n = await this.notifications.notify(
          t.teacherId,
          'STUCK_ALERT',
          { classId, studentId: e.studentId, studentName: e.studentName, topicKey: e.topicKey, topicName: pickText(e.topicName as I18nText, 'en'), reasons: e.reasons },
          `stuck:${t.teacherId}:${e.studentId}:${e.topicId}:${dayKey(now)}`,
        );
        if (n) created++;
      }
    }
    return created;
  }

  async onStudentEvent(studentId: string, classId: string | null) {
    if (classId) await this.notifyClass(classId);
    else {
      const enr = await this.prisma.enrollment.findMany({ where: { studentId, status: 'ACTIVE' } });
      for (const e of enr) await this.notifyClass(e.classId);
    }
  }

  async scanAll() {
    const classes = await this.prisma.class.findMany({ select: { id: true } });
    let total = 0;
    for (const c of classes) total += await this.notifyClass(c.id);
    return total;
  }
}
