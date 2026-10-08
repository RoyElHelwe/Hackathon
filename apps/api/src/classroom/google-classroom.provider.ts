import { classroom_v1, google } from 'googleapis';
import { config } from '../config';
import {
  ClassroomAuthError,
  classroomCourse,
  ClassroomCourse,
  classroomPerson,
  ClassroomPerson,
  ClassroomProvider,
  CourseWorkInput,
  TeacherCredentials,
} from './classroom.provider';

function isInvalidGrant(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const data = (e as { response?: { data?: { error?: string } } })?.response?.data;
  return msg.includes('invalid_grant') || data?.error === 'invalid_grant';
}

/** Real Google Classroom API using the teacher's offline refresh token. */
export class GoogleClassroomProvider implements ClassroomProvider {
  readonly kind = 'google' as const;

  private api(t: TeacherCredentials): classroom_v1.Classroom {
    if (!t.refreshToken) throw new ClassroomAuthError('Google Classroom is not connected');
    const auth = new google.auth.OAuth2(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_REDIRECT_URI);
    auth.setCredentials({ refresh_token: t.refreshToken });
    return google.classroom({ version: 'v1', auth });
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (isInvalidGrant(e)) throw new ClassroomAuthError();
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
}
