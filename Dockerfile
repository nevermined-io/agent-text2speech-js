FROM node:18-alpine
LABEL maintainer="Nevermined <root@nevermined.io>"

WORKDIR /agent

RUN apk add --no-cache autoconf automake alpine-sdk bash

COPY package.json ./
COPY yarn.lock ./

COPY src ./src
COPY package.json ./
COPY tsconfig* ./


RUN yarn
RUN yarn build
RUN mkdir dist

ENTRYPOINT ["yarn", "start"]
