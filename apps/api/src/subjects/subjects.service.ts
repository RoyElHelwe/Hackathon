import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly progress: ProgressService,
  ) {}

  async list() {
    const subjects = await this.prisma.subject.findMany({ include: { _count: { select: { topics: true } } }, orderBy: { key: 'asc' } });
    const order = ['math', 'physics', 'chemistry', 'biology', 'history', 'languages'];
    return subjects
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((s) => ({ id: s.id, key: s.key, name: s.name, color: s.color, icon: s.icon, topicCount: s._count.topics }));
  }

  async enrolledClassIds(studentId: string) {
    const e = await this.prisma.enrollment.findMany({ where: { studentId, status: 'ACTIVE' } });
    return e.map((x) => x.classId);
  }

  /** Skill graph: nodes with mastery states for a student + edges + the student's missions per topic. */
  async graph(a: AuthContext, key: string, studentId?: string) {
    const targetId = studentId || a.userId;
    const classIds = await this.enrolledClassIds(targetId);
    await this.actors.assert(a, 'read', 'progress', { ownerId: targetId, ownerClassIds: classIds });
    const subject = await this.prisma.subject.findUnique({ where: { key } });
    if (!subject) throw new NotFoundException();
    const topics = await this.prisma.topic.findMany({ where: { subjectId: subject.id }, include: { prerequisites: true }, orderBy: { posY: 'asc' } });
    const states = await this.progress.states(targetId, topics);
    const missions = await this.prisma.mission.findMany({
      where: { topicId: { in: topics.map((t) => t.id) }, status: 'APPROVED', classId: { in: classIds }, audience: { not: 'FAMILY' } },
      include: { submissions: { where: { studentId: targetId }, orderBy: { startedAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      subject: { id: subject.id, key: subject.key, name: subject.name, color: subject.color, icon: subject.icon },
      studentId: targetId,
      nodes: topics.map((t) => {
        const s = states.get(t.id)!;
        return {
          id: t.id,
          key: t.key,
          name: t.name,
          description: t.description,
          icon: t.icon,
          gradeLevel: t.gradeLevel,
          position: { x: t.posX, y: t.posY },
          state: s.state,
          bestScore: s.bestScore,
          missions: missions
            .filter((m) => m.topicId === t.id)
            .map((m) => ({
              id: m.id,
              title: m.title,
              difficulty: m.difficulty,
              xpReward: m.xpReward,
              estimatedMin: m.estimatedMin,
              submissionStatus: m.submissions[0]?.status ?? null,
              submissionId: m.submissions[0]?.id ?? null,
            })),
        };
      }),
      edges: topics.flatMap((t) => t.prerequisites.map((p) => ({ id: `${p.prerequisiteId}->${t.id}`, source: p.prerequisiteId, target: t.id }))),
    };
  }
}
