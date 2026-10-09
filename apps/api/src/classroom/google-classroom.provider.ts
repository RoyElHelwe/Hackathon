import { auth as googleAuth, classroom, classroom_v1 } from '@googleapis/classroom';
import { config } from '../config';
import {
  ClassroomAuthError,
  classroomCourse,
  ClassroomLessonItem,
  ClassroomCourse,
  classroomPerson,
  ClassroomPerson,
  ClassroomProvider,
  CourseWorkInput,
  LessonMaterial,
  TeacherCredentials,
} from './classroom.provider';

export function isInvalidGrant(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const data = (e as { response?: { data?: { error?: string } } })?.response?.data;
  return msg.includes('invalid_grant') || data?.error === 'invalid_grant';
}

/** 403 because the token lacks a scope we now need (teacher connected before new scopes were added). */
export function isInsufficientScope(e: unknown): boolean {
  const err = e as { status?: number; code?: number | string; response?: { status?: number; data?: unknown } };
  const status = err?.status ?? err?.response?.status ?? (typeof err?.code === 'number' ? err.code : undefined);
  if (status !== 403) return false;
  const msg = e instanceof Error ? e.message : '';
  const body = JSON.stringify(err?.response?.data ?? '');
  return /insufficient/i.test(msg) || /insufficient/i.test(body) || body.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT');
}

/** Classroom does not return a Drive file's MIME type; infer it from the editor URL or file extension for icons. */
export function guessDriveMime(link: string, title: string): string | null {
  if (link.includes('/document/')) return 'application/vnd.google-apps.document';
  if (link.includes('/presentation/')) return 'application/vnd.google-apps.presentation';
  if (link.includes('/spreadsheets/')) return 'application/vnd.google-apps.spreadsheet';
  if (link.includes('/forms/')) return 'application/vnd.google-apps.form';
  if (link.includes('/drawings/')) return 'application/vnd.google-apps.drawing';
  const ext = title.toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1];
  const byExt: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    mp4: 'video/mp4',
    txt: 'text/plain',
  };
  return (ext && byExt[ext]) || null;
}

export function mapMaterials(list: classroom_v1.Schema$Material[] | undefined): LessonMaterial[] {
  const out: LessonMaterial[] = [];
  for (const m of list ?? []) {
    const d = m.driveFile?.driveFile;
    if (d?.id) {
      const url = d.alternateLink ?? `https://drive.google.com/open?id=${d.id}`;
      const title = d.title ?? 'File';
      out.push({ type: 'drive', id: d.id, title, url, mimeType: guessDriveMime(url, title), thumbnailUrl: d.thumbnailUrl ?? null });
    } else if (m.youtubeVideo?.id) {
      const y = m.youtubeVideo;
      out.push({
        type: 'youtube',
        id: y.id!,
        title: y.title ?? 'Video',
        url: y.alternateLink ?? `https://www.youtube.com/watch?v=${y.id}`,
        thumbnailUrl: y.thumbnailUrl ?? null,
      });
    } else if (m.link?.url) {
      out.push({ type: 'link', title: m.link.title || m.link.url, url: m.link.url, thumbnailUrl: m.link.thumbnailUrl ?? null });
    } else if (m.form?.formUrl) {
      out.push({ type: 'form', title: m.form.title ?? 'Form', url: m.form.formUrl, thumbnailUrl: m.form.thumbnailUrl ?? null });
    }
  }
  return out;
}

/** Real Google Classroom API using the teacher's offline refresh token. */
export class GoogleClassroomProvider implements ClassroomProvider {
  readonly kind = 'google' as const;

  private api(t: TeacherCredentials): classroom_v1.Classroom {
    if (!t.refreshToken) throw new ClassroomAuthError('Google Classroom is not connected');
    const auth = new googleAuth.OAuth2(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_REDIRECT_URI);
    auth.setCredentials({ refresh_token: t.refreshToken });
    return classroom({ version: 'v1', auth });
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (isInvalidGrant(e)) throw new ClassroomAuthError();
      if (isInsufficientScope(e)) throw new ClassroomAuthError('Google Classroom needs new permissions');
      throw e;
    }
  }

  async listCourses(t: TeacherCredentials): Promise<ClassroomCourse[]> {
    const api = this.api(t);
    const out: ClassroomCourse[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.call(() => api.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 100, pageToken }));
      for (const c of res.data.courses ?? []) out.push(classroomCourse.parse({ id: c.id, name: c.name, section: c.section }));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return out;
  }

  private person(p: { userId?: string | null; profile?: classroom_v1.Schema$UserProfile }): ClassroomPerson {
    return classroomPerson.parse({
      userId: p.userId ?? p.profile?.id,
      name: p.profile?.name?.fullName ?? 'Student',
      email: p.profile?.emailAddress ?? null,
      photoUrl: p.profile?.photoUrl ? (p.profile.photoUrl.startsWith('//') ? `https:${p.profile.photoUrl}` : p.profile.photoUrl) : null,
    });
  }

  async listStudents(t: TeacherCredentials, courseId: string) {
    const api = this.api(t);
    const out: ClassroomPerson[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.call(() => api.courses.students.list({ courseId, pageSize: 100, pageToken }));
      for (const s of res.data.students ?? []) out.push(this.person(s));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return out;
  }

  async listTeachers(t: TeacherCredentials, courseId: string) {
    const api = this.api(t);
    const res = await this.call(() => api.courses.teachers.list({ courseId, pageSize: 100 }));
    return (res.data.teachers ?? []).map((x) => this.person(x));
  }

  async createCourseWork(t: TeacherCredentials, courseId: string, input: CourseWorkInput) {
    const api = this.api(t);
    const due = input.dueAt
      ? {
          dueDate: { year: input.dueAt.getUTCFullYear(), month: input.dueAt.getUTCMonth() + 1, day: input.dueAt.getUTCDate() },
          dueTime: { hours: input.dueAt.getUTCHours(), minutes: input.dueAt.getUTCMinutes() },
        }
      : {};
    const res = await this.call(() =>
      api.courses.courseWork.create({
        courseId,
        requestBody: {
          title: input.title,
          description: input.description,
          workType: 'ASSIGNMENT',
          state: 'PUBLISHED',
          maxPoints: 100,
          materials: [{ link: { url: input.link, title: input.title } }],
          ...due,
        },
      }),
    );
    if (!res.data.id) throw new Error('Classroom did not return a coursework id');
    return { id: res.data.id };
  }

  async patchGrade(t: TeacherCredentials, courseId: string, courseWorkId: string, studentGoogleId: string, grade: number) {
    const api = this.api(t);
    const list = await this.call(() =>
      api.courses.courseWork.studentSubmissions.list({ courseId, courseWorkId, userId: studentGoogleId }),
    );
    const sub = list.data.studentSubmissions?.[0];
    if (!sub?.id) throw new Error('Student submission not found in Classroom');
    await this.call(() =>
      api.courses.courseWork.studentSubmissions.patch({
        courseId,
        courseWorkId,
        id: sub.id!,
        updateMask: 'draftGrade,assignedGrade',
        requestBody: { draftGrade: grade, assignedGrade: grade },
      }),
    );
  }

  async listLessons(t: TeacherCredentials, courseId: string): Promise<ClassroomLessonItem[]> {
    const api = this.api(t);
    const out: ClassroomLessonItem[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.call(() =>
        api.courses.courseWorkMaterials.list({ courseId, courseWorkMaterialStates: ['PUBLISHED'], pageSize: 100, pageToken }),
      );
      for (const m of res.data.courseWorkMaterial ?? []) {
        if (!m.id) continue;
        out.push({
          id: m.id,
          kind: 'MATERIAL',
          title: m.title ?? '',
          description: m.description ?? '',
          materials: mapMaterials(m.materials),
          alternateLink: m.alternateLink ?? null,
          creationTime: m.creationTime ?? m.updateTime ?? new Date().toISOString(),
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    pageToken = undefined;
    do {
      const res = await this.call(() => api.courses.courseWork.list({ courseId, courseWorkStates: ['PUBLISHED'], pageSize: 100, pageToken }));
      for (const w of res.data.courseWork ?? []) {
        if (!w.id) continue;
        out.push({
          id: w.id,
          kind: 'ASSIGNMENT',
          title: w.title ?? '',
          description: w.description ?? '',
          materials: mapMaterials(w.materials),
          alternateLink: w.alternateLink ?? null,
          creationTime: w.creationTime ?? w.updateTime ?? new Date().toISOString(),
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return out;
  }
}
