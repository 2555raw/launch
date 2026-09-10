# Serves the static desk. Railway (or any host) builds this folder as the
# context, so there is nothing to install and no build step to run.
FROM caddy:2.8-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY . /srv

EXPOSE 8080
