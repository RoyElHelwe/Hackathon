import { Injectable } from '@nestjs/common';
import { Mission, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const json = (v: Prisma.JsonValue | null): Prisma.InputJsonValue | typeof Prisma.DbNull => (v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

/** A course mission template (classId null) → one APPROVED copy per section; all classId-based logic runs on the copies. */
export const isTemplate = (m: Pick<Mission, 'courseId' | 'classId'>) => !!m.courseId && !m.classId;

@Injectable()
export class CourseMissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async sectionIds(courseId: string): Promise<string[]> {
    const rows = await this.prisma.class.findMany({ where: { courseId }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  /** Creates the missing per-section copies of an APPROVED template. Returns only the new copies. */
  async copyToSections(template: Mission, classIds?: string[]): Promise<Mission[]> {
    if (!isTemplate(template) || template.status !== 'APPROVED') return [];
    const targets = classIds ?? (await this.sectionIds(template.courseId!));
    const existing = new Set(
      (await this.prisma.mission.findMany({ where: { parentMissionId: template.id, classId: { in: targets } }, select: { classId: true } })).map((m) => m.classId),
    );
    const created: Mission[] = [];
    for (const classId of targets) {
      if (existing.has(classId)) continue;
      const copy = await this.prisma.mission
        .create({
          data: {
            topicId: template.topicId,
            classId,
            courseId: template.courseId,
            parentMissionId: template.id,
            createdById: template.createdById,
            status: 'APPROVED',
            audience: template.audience,
            difficulty: template.difficulty,
            title: json(template.title) as Prisma.InputJsonValue,
            story: json(template.story) as Prisma.InputJsonValue,
            steps: json(template.steps) as Prisma.InputJsonValue,
            miniLesson: json(template.miniLesson) as Prisma.InputJsonValue,
            proofSpec: json(template.proofSpec) as Prisma.InputJsonValue,
            rubric: json(template.rubric) as Prisma.InputJsonValue,
            safetyNotes: json(template.safetyNotes) as Prisma.InputJsonValue,
            safetyCheck: json(template.safetyCheck),
            xpReward: template.xpReward,
            estimatedMin: template.estimatedMin,
            dueAt: template.dueAt,
            aiGenerated: template.aiGenerated,
          },
        })
        // a concurrent fan-out already created this section's copy (unique parentMissionId + classId)
        .catch((e: unknown) => {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null;
          throw e;
        });
      if (copy) created.push(copy);
    }
    return created;
  }

  /** A section that joins a course later gets copies of the course's approved missions (no Classroom post). */
  async copyApprovedTemplates(courseId: string, classId: string): Promise<number> {
    const templates = await this.prisma.mission.findMany({ where: { courseId, classId: null, status: 'APPROVED' } });
    let n = 0;
    for (const t of templates) n += (await this.copyToSections(t, [classId])).length;
    return n;
  }

  async archiveCopies(templateId: string): Promise<number> {
    const r = await this.prisma.mission.updateMany({ where: { parentMissionId: templateId, status: { not: 'ARCHIVED' } }, data: { status: 'ARCHIVED' } });
    return r.count;
  }
}
