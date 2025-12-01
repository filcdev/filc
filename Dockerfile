FROM oven/bun:1.3.3 AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

RUN bun run build

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/src/database/migrations ./src/database/migrations
COPY --from=prerelease /usr/src/app/build ./build

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "--bun", "run", "build/index.js" ]
