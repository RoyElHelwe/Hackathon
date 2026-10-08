import { Injectable } from '@nestjs/common';
import { MasteryState, unlockedTopics } from '@tajriba/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface TopicWithPrereqs {
  id: string;
  key: string;
  subjectId: string;
  prerequisites: { prerequisiteId: string }[];
}

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mastery state per topic for a student. Progress is per student × topic (not per class),
   * so changing class never loses progress. Missing rows are derived from prerequisites.
   */
  async states(studentId: string, topics: TopicWithPrereqs[]): Promise<Map<string, { state: MasteryState; bestScore: number; attempts: number }>> {
    const rows = await this.prisma.topicProgress.findMany({ where: { studentId } });
    const byTopic = new Map(rows.map((r) => [r.topicId, r]));
    const mastered = new Set(rows.filter((r) => r.state === 'MASTERED').map((r) => r.topicId));
    const out = new Map<string, { state: MasteryState; bestScore: number; attempts: number }>();
    for (const t of topics) {
      const row = byTopic.get(t.id);
      let state: MasteryState;
      if (row && row.state !== 'LOCKED') state = row.state;
      else state = t.prerequisites.every((p) => mastered.has(p.prerequisiteId)) ? 'AVAILABLE' : 'LOCKED';
      out.set(t.id, { state, bestScore: row?.bestScore ?? 0, attempts: row?.attempts ?? 0 });
    }
    return out;
  }

  async markInProgress(studentId: string, topicId: string) {
    const row = await this.prisma.topicProgress.findUnique({ where: { studentId_topicId: { studentId, topicId } } });
    if (row?.state === 'MASTERED' || row?.state === 'IN_PROGRESS') return;
    await this.prisma.topicProgress.upsert({
      where: { studentId_topicId: { studentId, topicId } },
      update: { state: 'IN_PROGRESS' },
      create: { studentId, topicId, state: 'IN_PROGRESS' },
    });
  }

  async recordAttempt(studentId: string, topicId: string) {
    await this.prisma.topicProgress.upsert({
      where: { studentId_topicId: { studentId, topicId } },
      update: { attempts: { increment: 1 } },
      create: { studentId, topicId, state: 'IN_PROGRESS', attempts: 1 },
    });
  }

  /** Marks a topic MASTERED and unlocks dependents whose prerequisites are now all mastered. Returns unlocked topic ids. */
  async master(studentId: string, topicId: string, score: number): Promise<string[]> {
    const row = await this.prisma.topicProgress.findUnique({ where: { studentId_topicId: { studentId, topicId } } });
    await this.prisma.topicProgress.upsert({
      where: { studentId_topicId: { studentId, topicId } },
      update: { state: 'MASTERED', bestScore: Math.max(row?.bestScore ?? 0, score), masteredAt: row?.masteredAt ?? new Date() },
      create: { studentId, topicId, state: 'MASTERED', bestScore: score, attempts: 1, masteredAt: new Date() },
    });
    const dependents = await this.prisma.topicPrerequisite.findMany({ where: { prerequisiteId: topicId }, select: { topicId: true } });
    if (!dependents.length) return [];
    const topics = await this.prisma.topic.findMany({
      where: { id: { in: dependents.map((d) => d.topicId) } },
      include: { prerequisites: true },
    });
    const all = await this.prisma.topicProgress.findMany({ where: { studentId } });
    const mastered = new Set(all.filter((r) => r.state === 'MASTERED').map((r) => r.topicId));
    const unlocked = unlockedTopics(
      topics.map((t) => ({ id: t.id, prerequisiteIds: t.prerequisites.map((p) => p.prerequisiteId) })),
      mastered,
    );
    const newlyUnlocked: string[] = [];
    for (const id of unlocked) {
      const existing = all.find((r) => r.topicId === id);
      if (existing && existing.state !== 'LOCKED') continue;
      await this.prisma.topicProgress.upsert({
        where: { studentId_topicId: { studentId, topicId: id } },
        update: { state: 'AVAILABLE' },
        create: { studentId, topicId: id, state: 'AVAILABLE' },
      });
      newlyUnlocked.push(id);
    }
    return newlyUnlocked;
  }
}
