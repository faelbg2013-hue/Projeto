# PWA production image. Vite builds the static files. Nginx serves dist only.

FROM node:22-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages packages
COPY apps/web apps/web

# Same origin. The file is created in the image build and is not a secret.
RUN printf 'VITE_API_URL=\n' > .env.production \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @ravion/ui build \
  && pnpm --filter @ravion/types build \
  && pnpm --filter @ravion/web build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY deploy/nginx/pwa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
