FROM oven/bun:1.3.6

# Config Bun
ENV PATH="~/.bun/bin:${PATH}"
RUN ln -s /usr/local/bin/bun /usr/local/bin/node

# Update packages
RUN apt-get update && apt-get upgrade -y

# Add some useful packages
RUN apt-get install -y \
    git \
    curl \
    wget \
    vim \
    htop \
    jq \
    locales


RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && \
    locale-gen
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

RUN chsh -s /bin/bash bun

USER bun
