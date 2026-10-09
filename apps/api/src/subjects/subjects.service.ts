import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { CurriculumService, VisibleTopic } from '../courses/curriculum.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';

const pickName = (n: unknown) => ((n as { en?: string })?.en ?? '');

/** Vertical gap between stacked skill groups (legacy topics, then each course's lesson skills). */
const GROUP_GAP = 200;

/** Stacks each group of skills (legacy map, then each course) under the previous one so they never overlap. */
function stackLayout(topics: VisibleTopic[]) {
  const groups = new Map<string, VisibleTopic[]>();
  for (const t of topics) {
    const k = t.courseId ?? '';
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const pos = new Map<string, { x: number; y: number }>();
  let cursor = 0;
  for (const list of groups.values()) {
    const minY = Math.min(...list.map((t) => t.posY));
    const maxY = Math.max(...list.map((t) => t.posY));
    for (const t of list) pos.set(t.id, { x: t.posX, y: t.posY - minY + cursor });
    cursor += maxY - minY + GROUP_GAP;
  }
  return pos;
}

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly progress: ProgressService,
    private readonly curriculum: CurriculumService,
  ) {}

  /**
   * Subjects the actor works with, each with the number of *visible* skills. Students: their sections' subjects;
   * parents: their children's; teachers: subjects with skills in their sections; directors: in the school.
   * `studentId` (teacher/parent/director looking at one student) → that student's subjects.
   */
  async list(a: AuthContext, studentId?: string) {
    const actor = await this.actors.actor(a);
    let rows: Awaited<ReturnType<CurriculumService['subjectsForClasses']>>;
    if (studentId) {
      const classIds = await this.curriculum.activeClassIds(studentId);
      await this.actors.assert(a, 'read', 'progress', { ownerId: studentId, ownerClassIds: classIds });
      rows = await this.curriculum.subjectsForClasses(classIds);
    } else if (actor.role === 'STUDENT') rows = await this.curriculum.subjectsForClasses(actor.classIdsEnrolled ?? []);
    else if (actor.role === 'PARENT') rows = await this.curriculum.subjectsForClasses(actor.childClassIds ?? []);
    else {
      const classIds =
        actor.role === 'TEACHER'
          ? (actor.classIdsTaught ?? [])
          : (await this.prisma.class.findMany({ where: { schoolId: actor.schoolId }, select: { id: true } })).map((c) => c.id);
      rows = (await this.curriculum.subjectsForClasses(classIds)).filter((r) => r.topicCount > 0);
    }
    return rows
      .sort((x, y) => pickName(x.subject.name).localeCompare(pickName(y.subject.name)))
      .map(({ subject: s, topicCount }) => ({ id: s.id, key: s.key, name: s.name, color: s.color, icon: s.icon, topicCount }));
  }

  /** Skill graph of one subject: the target student's visible skills with mastery states, edges and their missions. */
  async graph(a: AuthContext, key: string, studentId?: string) {
    const targetId = studentId || a.userId;
    const classIds = await this.curriculum.activeClassIds(targetId);
    const actor = await this.actors.assert(a, 'read', 'progress', { ownerId: targetId, ownerClassIds: classIds });
    const subject = await this.prisma.subject.findFirst({ where: { key, schoolId: actor.schoolId } });
    if (!subject) throw new NotFoundException();
    const topics = (await this.curriculum.topicsForClasses(classIds)).filter((t) => t.subjectId === subject.id);
    const visible = new Set(topics.map((t) => t.id));
    const layout = stackLayout(topics);
    const states = await this.progress.states(targetId, topics);
    const missions = topics.length
      ? await this.prisma.mission.findMany({
          where: { topicId: { in: topics.map((t) => t.id) }, status: 'APPROVED', classId: { in: classIds }, audience: { not: 'FAMILY' } },
          include: { submissions: { where: { studentId: targetId }, orderBy: { startedAt: 'desc' }, take: 1 } },
          orderBy: { createdAt: 'asc' },
        })
      : [];
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
          position: layout.get(t.id)!,
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
      edges: topics.flatMap((t) =>
        t.prerequisites.filter((p) => visible.has(p.prerequisiteId)).map((p) => ({ id: `${p.prerequisiteId}->${t.id}`, source: p.prerequisiteId, target: t.id })),
      ),
    };
  }
}
