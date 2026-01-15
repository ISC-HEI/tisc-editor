FROM node:20-alpine

RUN apk add --no-cache curl bash

WORKDIR /app

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

COPY package.json bun.lock ./
RUN bun install

COPY . .

EXPOSE 3000

CMD ["bun", "dev"]
