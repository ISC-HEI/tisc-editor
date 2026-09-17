FROM oven/bun:1-alpine AS builder
WORKDIR /docs

COPY docs/package.json docs/bun.lock* ./
RUN bun install --frozen-lockfile

COPY docs .
RUN bunx docusaurus build

FROM oven/bun:1-alpine AS runner
WORKDIR /docs

RUN apk add --no-cache curl

ENV NODE_ENV=production

COPY --from=builder /docs/build ./build
COPY --from=builder /docs/package.json ./package.json
COPY --from=builder /docs/node_modules ./node_modules

EXPOSE 3001

CMD ["bunx", "docusaurus", "serve", "--host", "0.0.0.0", "--port", "3001", "--no-open"]