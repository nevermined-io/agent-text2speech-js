FROM node:18-alpine
LABEL maintainer="Nevermined <root@nevermined.io>"

RUN apk add --no-cache autoconf automake alpine-sdk bash

COPY package.json yarn.lock ./
COPY tsconfig* ./
COPY src ./src

RUN yarn 
RUN yarn build

ENTRYPOINT [ "yarn", "run", "start:main" ]
