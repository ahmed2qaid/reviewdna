FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm install --ignore-scripts && npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app /app
ENTRYPOINT ["node", "apps/cli/dist/index.js"]
CMD ["--help"]
