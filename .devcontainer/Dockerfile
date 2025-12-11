FROM oven/bun:1.3.4-alpine

# Config Bun
ENV PATH="~/.bun/bin:${PATH}"
RUN ln -s /usr/local/bin/bun /usr/local/bin/node

# Update packages
RUN apk update

# Add some useful packages
RUN apk add git bash curl

USER bun