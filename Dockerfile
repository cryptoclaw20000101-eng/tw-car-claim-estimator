# Next.js 16 + Node 24 + pnpm
# 為什麼用 Dockerfile: Railway Railpack 把專案誤判成 static site 找 out/, 但已拿掉 output: export
# Dockerfile 明確指定 serverful 部署 (build → start)

FROM node:24-alpine
WORKDIR /app

# 1. Install pnpm + dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 2. Build Next.js (產 .next/)
COPY . .
RUN pnpm build

# 3. Run serverful Next.js
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["pnpm", "start"]
