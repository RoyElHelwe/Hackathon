import { z } from 'zod';

export interface TeacherCredentials {
  userId: string;
  googleId: string;
  /** decrypted refresh token, null if the teacher never connected Classroom */
  refreshToken: string | null;
}

export const classroomCourse = z.object({
  id: z.string(),
  name: z.string(),
  section: z.string().nullish(),
  gradeLevel: z.number().nullish(),
  studentCount: z.number().nullish(),
});
export type ClassroomCourse = z.infer<typeof classroomCourse>;

export const classroomPerson = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string().nullish(),
  photoUrl: z.string().nullish(),
});
export type ClassroomPerson = z.infer<typeof classroomPerson>;

export interface CourseWorkInput {
  title: string;
  description: string;
  dueAt?: Date | null;
  link: string;
}

/** Raised when the teacher's Google token is expired or revoked (invalid_grant). */
export class ClassroomAuthError extends Error {
  constructor(message = 'Google Classroom access expired') {
    super(message);
  }
}

export interface ClassroomProvider {
  readonly kind: 'google' | 'fake';
  listCourses(t: TeacherCredentials): Promise<ClassroomCourse[]>;
  listStudents(t: TeacherCredentials, courseId: string): Promise<ClassroomPerson[]>;
  listTeachers(t: TeacherCredentials, courseId: string): Promise<ClassroomPerson[]>;
  createCourseWork(t: TeacherCredentials, courseId: string, input: CourseWorkInput): Promise<{ id: string }>;
  patchGrade(t: TeacherCredentials, courseId: string, courseWorkId: string, studentGoogleId: string, grade: number): Promise<void>;
}

export const CLASSROOM_PROVIDER = Symbol('CLASSROOM_PROVIDER');
