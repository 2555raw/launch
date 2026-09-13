# Static site. No build step, no runtime dependencies beyond Caddy itself.
FROM caddy:2.8-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY public /srv

# Fail the build rather than the deploy if the Caddyfile is malformed
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
