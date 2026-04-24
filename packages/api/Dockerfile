FROM node:20-slim AS base
WORKDIR /app

# Copy root workspace files
COPY package.json ./
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN npm install --workspaces --if-present

# Copy source
COPY packages/sdk/ ./packages/sdk/
COPY packages/api/ ./packages/api/

# Build SDK
RUN npm run build -w @arcnames/sdk

# Build API
RUN npm run build -w @arcnames/api

EXPOSE 8787

ENV NODE_ENV=production

CMD ["node", "packages/api/dist/server.js"]
