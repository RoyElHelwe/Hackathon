import { execSync } from 'node:child_process';
import path from 'node:path';

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://tajriba:tajriba@localhost:5432/tajriba_test';
  execSync('npx prisma migrate deploy', { cwd: path.join(__dirname, '..'), env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}
