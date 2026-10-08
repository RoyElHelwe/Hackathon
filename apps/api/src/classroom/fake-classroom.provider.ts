import fixtures from './fixtures/courses.json';
import {
  ClassroomAuthError,
  ClassroomCourse,
  ClassroomLessonItem,
  ClassroomPerson,
  ClassroomProvider,
  CourseWorkInput,
  TeacherCredentials,
} from './classroom.provider';

interface FixtureCourse {
  id: string;
  name: string;
  section: string;
  gradeLevel?: number;
  teacherGoogleIds: string[];
  teachers: ClassroomPerson[];
  students: ClassroomPerson[];
  /** published posts (materials + assignments); mutable in tests */
  lessons?: ClassroomLessonItem[];
}

export interface GradeCall {
  courseId: string;
  courseWorkId: string;
  studentGoogleId: string;
  grade: number;
}

/**
 * Fixture-backed Classroom used in tests and as a demo fallback (CLASSROOM_PROVIDER=fake).
 * Rosters and lessons are mutable in memory so tests can add/remove students and posts.
 */
export class FakeClassroomProvider implements ClassroomProvider {
  readonly kind = 'fake' as const;
  courses: FixtureCourse[] = structuredClone((fixtures as { courses: FixtureCourse[] }).courses);
  courseWork: { id: string; courseId: string; input: CourseWorkInput }[] = [];
  gradeCalls: GradeCall[] = [];
  /** googleIds whose token should fail with invalid_grant */
  revoked = new Set<string>();
  failGrades = false;

  reset() {
    this.courses = structuredClone((fixtures as { courses: FixtureCourse[] }).courses);
    this.courseWork = [];
    this.gradeCalls = [];
    this.revoked.clear();
    this.failGrades = false;
  }

  private check(t: TeacherCredentials) {
    if (this.revoked.has(t.googleId)) throw new ClassroomAuthError();
  }

  private course(id: string): FixtureCourse {
    const c = this.courses.find((x) => x.id === id);
    if (!c) throw new Error(`Unknown course ${id}`);
    return c;
  }

  async listCourses(t: TeacherCredentials): Promise<ClassroomCourse[]> {
    this.check(t);
    const own = this.courses.filter((c) => c.teacherGoogleIds.includes(t.googleId));
    const list = own.length ? own : this.courses.filter((c) => c.teacherGoogleIds.includes('*'));
    return list.map((c) => ({ id: c.id, name: c.name, section: c.section, gradeLevel: c.gradeLevel, studentCount: c.students.length }));
  }

  async listStudents(t: TeacherCredentials, courseId: string) {
    this.check(t);
    return this.course(courseId).students;
  }

  async listTeachers(t: TeacherCredentials, courseId: string) {
    this.check(t);
    return this.course(courseId).teachers;
  }

  async createCourseWork(t: TeacherCredentials, courseId: string, input: CourseWorkInput) {
    this.check(t);
    const id = `fake-cw-${this.courseWork.length + 1}-${Date.now()}`;
    this.courseWork.push({ id, courseId, input });
    return { id };
  }

  async listLessons(t: TeacherCredentials, courseId: string): Promise<ClassroomLessonItem[]> {
    this.check(t);
    const own = this.courseWork
      .filter((w) => w.courseId === courseId)
      .map((w) => ({
        id: w.id,
        kind: 'ASSIGNMENT' as const,
        title: w.input.title,
        description: w.input.description,
        materials: [{ type: 'link' as const, title: w.input.title, url: w.input.link }],
        alternateLink: null,
        creationTime: new Date().toISOString(),
      }));
    return [...structuredClone(this.course(courseId).lessons ?? []), ...own];
  }

  async patchGrade(t: TeacherCredentials, courseId: string, courseWorkId: string, studentGoogleId: string, grade: number) {
    this.check(t);
    if (this.failGrades) throw new Error('Classroom unavailable');
    this.gradeCalls.push({ courseId, courseWorkId, studentGoogleId, grade });
  }
}
