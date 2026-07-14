FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY scripts ./scripts
ENV NUXT_DATA_DIR=/data
ENV PORT=3000
EXPOSE 3000
VOLUME /data
CMD ["node", ".output/server/index.mjs"]
