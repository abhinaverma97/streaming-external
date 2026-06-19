FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN apk del python3 make g++

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3 make g++
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
RUN rm -rf ./.cache 2>/dev/null; true
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/data ./data
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
RUN mkdir -p /app/.cache && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]
