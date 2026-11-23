# LumaCue Show Studio, web version, in Docker (Next.js standalone server).
# USB to the base station runs in your browser (Web Serial), so the container needs no USB access.
#   docker build -f lumacue/Dockerfile -t lumacue .
#   docker run --rm -p 127.0.0.1:3000:3000 lumacue      # open http://localhost:3000 in Chrome/Edge
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY lumacue/package.json lumacue/package-lock.json ./
RUN npm ci --ignore-scripts
COPY lumacue/ ./
RUN npm run build:standalone

FROM node:22-alpine AS run
WORKDIR /app/server
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 LUMACUE_FIRMWARE_DIR=/app/firmware
COPY --from=build --chown=root:root /app/.next/standalone ./
COPY --chown=root:root firmware /app/firmware
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "server.js"]
