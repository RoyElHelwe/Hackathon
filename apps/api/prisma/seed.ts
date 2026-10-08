import { createPrismaClient } from '../src/prisma/prisma.service';
import { seed } from '../src/seed/seed';

async function main() {
  const prisma = createPrismaClient();
  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
