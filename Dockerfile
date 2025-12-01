FROM oven/bun:1.3.3 AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY ./src/database/migrations ./src/database/migrations

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "--bun", "run", "src/index.ts" ]
