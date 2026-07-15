FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/.output ./.output
# .output doesn't bundle better-sqlite3's native binding; it locates the
# compiled .node file via require('bindings'), so both transitive deps
# must be present in the runtime node_modules too.
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build /app/node_modules/bindings ./node_modules/bindings
COPY --from=build /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY scripts ./scripts
ENV NUXT_DATA_DIR=/data
ENV PORT=3000
EXPOSE 3000
VOLUME /data
CMD ["node", ".output/server/index.mjs"]
