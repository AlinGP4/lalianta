FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/app ./app
COPY --from=builder /app/Backend ./Backend
COPY --from=builder /app/TPV ./TPV
COPY --from=builder /app/styles.css ./styles.css
COPY --from=builder /app/middleware.js ./middleware.js
EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000"]
