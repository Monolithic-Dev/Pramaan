FROM node:20-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/worker-ai-pipeline ./apps/worker-ai-pipeline
RUN pnpm install --frozen-lockfile --filter @pramaan/worker-ai-pipeline...
RUN pnpm --filter @pramaan/worker-ai-pipeline build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/worker-ai-pipeline/dist ./dist
COPY --from=build /repo/apps/worker-ai-pipeline/node_modules ./node_modules
COPY --from=build /repo/apps/worker-ai-pipeline/package.json ./package.json
EXPOSE 8081
CMD ["node", "dist/index.js"]
