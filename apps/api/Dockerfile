FROM node:22-bookworm-slim AS base
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN pnpm install --frozen-lockfile --filter @tajriba/api... --ignore-scripts && cd apps/api && DATABASE_URL=postgresql://x@x/x npx prisma generate
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @tajriba/shared build && cd apps/api && npx nest build

FROM build AS run
ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 4000
# Apply migrations, seed the demo world (idempotent), start.
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node --transpile-only prisma/seed.ts && node dist/main.js"]
