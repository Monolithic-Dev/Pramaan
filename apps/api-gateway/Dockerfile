FROM node:20-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/api-gateway ./apps/api-gateway
RUN pnpm install --frozen-lockfile --filter @pramaan/api-gateway...
RUN pnpm --filter @pramaan/api-gateway build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api-gateway/dist ./dist
COPY --from=build /repo/apps/api-gateway/node_modules ./node_modules
COPY --from=build /repo/apps/api-gateway/package.json ./package.json
EXPOSE 8080
CMD ["node", "dist/index.js"]
