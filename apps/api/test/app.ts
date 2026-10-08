import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { CLASSROOM_PROVIDER } from '../src/classroom/classroom.provider';
import { FakeClassroomProvider } from '../src/classroom/fake-classroom.provider';
import { SESSION_COOKIE } from '../src/common/auth-context';
import { PrismaService } from '../src/prisma/prisma.service';
import { seed } from '../src/seed/seed';

export interface TestCtx {
  app: INestApplication;
  prisma: PrismaService;
  fake: FakeClassroomProvider;
  jwt: JwtService;
  http: () => ReturnType<typeof request>;
  /** cookie header for a user id */
  cookieFor: (userId: string, mid?: string) => string;
  /** cookie header for a seeded dev handle */
  as: (handle: string) => Promise<string>;
}

export async function resetDb(prisma: PrismaService) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
}

export async function createTestApp(opts: { seed?: boolean } = { seed: true }): Promise<TestCtx> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  const fake = app.get(CLASSROOM_PROVIDER) as FakeClassroomProvider;
  const jwt = app.get(JwtService);
  await resetDb(prisma);
  fake.reset();
  if (opts.seed !== false) await seed(prisma, { quiet: true });
  const cookieFor = (userId: string, mid?: string) => `${SESSION_COOKIE}=${jwt.sign({ sub: userId, mid })}`;
  return {
    app,
    prisma,
    fake,
    jwt,
    http: () => request(app.getHttpServer()),
    cookieFor,
    as: async (handle: string) => {
      const u = await prisma.user.findUniqueOrThrow({ where: { devHandle: handle } });
      return cookieFor(u.id);
    },
  };
}
