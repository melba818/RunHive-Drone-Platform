FROM node:22-bookworm-slim AS build
WORKDIR /build
COPY apps/runos-web/package.json apps/runos-web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/runos-web ./
RUN mkdir -p public && npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=4000 HOSTNAME=0.0.0.0
WORKDIR /srv/runos/app
COPY --from=build /build/.next/standalone ./
COPY --from=build /build/.next/static ./.next/static
COPY --from=build /build/public ./public
CMD ["node", "server.js"]
