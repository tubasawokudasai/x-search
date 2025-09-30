FROM node:20.19.5-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

FROM node:20.19.5-slim AS production

WORKDIR /app

COPY package.json yarn.lock ./

COPY --from=build /app/node_modules ./node_modules

COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
