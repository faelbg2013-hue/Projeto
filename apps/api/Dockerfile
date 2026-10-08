# API production image. Build compiles TypeScript and generates Prisma Client.
# Runtime starts the compiled process only: no watch, no seed, no migrate dev.

FROM node:22-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages packages
COPY apps/api apps/api
COPY prisma prisma

# Generate does not connect. This value is not a credential and is not copied to the runtime image.
ENV DATABASE_URL=mysql://build:build@127.0.0.1:3306/build

RUN pnpm install --frozen-lockfile

# pnpm 10 refuses deploy unless workspace packages are injected. --legacy keeps the
# existing copy of built workspace packages into the runtime image.
RUN pnpm --filter @ravion/types build \
  && pnpm --filter @ravion/validation build \
  && pnpm exec prisma generate \
  && pnpm --filter @ravion/api build \
  && pnpm --filter @ravion/api deploy --prod --legacy /out \
  && mkdir -p /out/dist /out/node_modules/@ravion/types /out/node_modules/@ravion/validation \
  && cp -a apps/api/dist/. /out/dist/ \
  && rm -rf /out/node_modules/@ravion/types /out/node_modules/@ravion/validation \
  && mkdir -p /out/node_modules/@ravion \
  && cp -aL packages/types /out/node_modules/@ravion/types \
  && cp -aL packages/validation /out/node_modules/@ravion/validation \
  && cp -a prisma /out/prisma \
  && node -e "const fs=require('fs'); const client=fs.realpathSync('/app/node_modules/@prisma/client'); const gen=fs.realpathSync('/app/node_modules/.prisma'); fs.rmSync('/out/node_modules/@prisma/client',{recursive:true,force:true}); fs.rmSync('/out/node_modules/.prisma',{recursive:true,force:true}); fs.cpSync(client,'/out/node_modules/@prisma/client',{recursive:true,dereference:true}); fs.cpSync(gen,'/out/node_modules/.prisma',{recursive:true,dereference:true});" \
  && cd /out \
  && node -e "require('@ravion/types'); require('@ravion/validation'); require('@prisma/client'); require('argon2')"

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build --chown=node:node /out /app

USER node

ENV NODE_ENV=production
ENV PORT=43111

EXPOSE 43111

CMD ["node", "dist/main.js"]
