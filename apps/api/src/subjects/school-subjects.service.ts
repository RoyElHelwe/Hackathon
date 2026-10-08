import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiService } from '../ai/ai.service';
import { translateName } from '../ai/tasks';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { PrismaService } from '../prisma/prisma.service';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const enName = (n: unknown) => (n as { en?: string })?.en ?? '';

@Injectable()
export class SchoolSubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly ai: AiService,
  ) {}

  async list(a: AuthContext, schoolId: string) {
    await this.actors.assert(a, 'read', 'subject', { schoolId });
    const rows = await this.prisma.subject.findMany({
      where: { schoolId },
      include: { _count: { select: { classes: true, teachers: true } } },
    });
    return rows
      .sort((x, y) => enName(x.name).localeCompare(enName(y.name)))
      .map((s) => ({ id: s.id, key: s.key, name: s.name, color: s.color, icon: s.icon, classCount: s._count.classes, teacherCount: s._count.teachers }));
  }

  private async assertUnique(schoolId: string, name: string, exceptId?: string) {
    const all = await this.prisma.subject.findMany({ where: { schoolId }, select: { id: true, name: true } });
    const n = norm(name);
    if (all.some((s) => s.id !== exceptId && (norm(enName(s.name)) === n || norm((s.name as { ar?: string })?.ar ?? '') === n)))
      throw new ConflictException({ message: 'This subject already exists.' });
  }

  private async bilingual(name: string) {
    try {
      return await this.ai.run(translateName, { text: name.trim() });
    } catch {
      return { en: name.trim(), ar: name.trim() };
    }
  }

  async create(a: AuthContext, schoolId: string, body: { name: string; color?: string; icon?: string }) {
    await this.actors.assert(a, 'write', 'subject', { schoolId });
    await this.assertUnique(schoolId, body.name);
    const name = await this.bilingual(body.name);
    const s = await this.prisma.subject.create({
      data: { schoolId, key: `s_${randomUUID().slice(0, 12)}`, name, color: body.color ?? 'violet', icon: body.icon ?? 'book' },
    });
    return { id: s.id, key: s.key, name: s.name, color: s.color, icon: s.icon, classCount: 0, teacherCount: 0 };
  }

  private async own(schoolId: string, subjectId: string) {
    const s = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!s || s.schoolId !== schoolId) throw new NotFoundException();
    return s;
  }

  async update(a: AuthContext, schoolId: string, subjectId: string, body: { name?: string; color?: string; icon?: string }) {
    await this.actors.assert(a, 'write', 'subject', { schoolId });
    await this.own(schoolId, subjectId);
    const data: { name?: { en: string; ar: string }; color?: string; icon?: string } = { color: body.color, icon: body.icon };
    if (body.name) {
      await this.assertUnique(schoolId, body.name, subjectId);
      data.name = await this.bilingual(body.name);
    }
    const s = await this.prisma.subject.update({
      where: { id: subjectId },
      data,
      include: { _count: { select: { classes: true, teachers: true } } },
    });
    return { id: s.id, key: s.key, name: s.name, color: s.color, icon: s.icon, classCount: s._count.classes, teacherCount: s._count.teachers };
  }

  async remove(a: AuthContext, schoolId: string, subjectId: string) {
    await this.actors.assert(a, 'write', 'subject', { schoolId });
    await this.own(schoolId, subjectId);
    if (await this.prisma.class.count({ where: { subjectId } }))
      throw new ConflictException({ message: 'Classes still use this subject. Move them to another subject first.' });
    await this.prisma.subject.delete({ where: { id: subjectId } });
    return { ok: true };
  }
}
