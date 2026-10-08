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

export interface LessonMaterial {
  type: 'drive' | 'youtube' | 'link' | 'form';
  id?: string;
  title: string;
  url: string;
  mimeType?: string | null;
  thumbnailUrl?: string | null;
}

/** A published Classroom post: a Material (courseWorkMaterials) or an Assignment/question (courseWork). */
export interface ClassroomLessonItem {
  id: string;
  kind: 'MATERIAL' | 'ASSIGNMENT';
  title: string;
  description: string;
  materials: LessonMaterial[];
  alternateLink: string | null;
  /** ISO timestamp */
  creationTime: string;
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
  /** Published materials + coursework of a course. */
  listLessons(t: TeacherCredentials, courseId: string): Promise<ClassroomLessonItem[]>;
}

export const CLASSROOM_PROVIDER = Symbol('CLASSROOM_PROVIDER');
