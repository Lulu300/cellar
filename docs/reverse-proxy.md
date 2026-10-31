# Cellar behind a reverse proxy

A reverse proxy serves Cellar over HTTPS, at an address such as `https://cellar.example.com`: the
barcode scanner can then use the camera, and a phone can install the app. This page gives a
configuration to copy for [nginx](#nginx), [SWAG](#swag), [Caddy](#caddy) and [Traefik](#traefik),
and says where [Nginx Proxy Manager](#nginx-proxy-manager) and the
[Synology reverse proxy](#synology-reverse-proxy) need a setting. The nginx, SWAG, Caddy and Traefik
examples were each tested in front of Cellar, with nginx 1.30, SWAG 5.8, Caddy 2.11 and Traefik 3.7:
pages, saving from a browser, a restore of 200 MB uploaded in 100 seconds, and an MCP client.

Cellar is meant for a home network or a VPN (see [Access code](../README-Docker.md#access-code)): a
proxy that serves it on your network or your VPN only is the expected use. A public certificate
does not need a public site: Let's Encrypt gives one through a DNS challenge, for a name that only
your network resolves.

## What Cellar needs from the proxy

- **HTTPS, and `ORIGIN`.** Set `ORIGIN` in Cellar's `.env` to the address of the proxy, such as
  `ORIGIN=https://cellar.example.com`, and recreate the container (`docker compose up -d`). Cellar
  then refuses any write whose `Origin` header is another address (see
  [Application URL (ORIGIN)](../README-Docker.md#application-url-origin)), so open Cellar through
  the proxy only.
- **Uploads of up to 512 MB.** A restore, a ZIP import or a batch of images sends up to 500 MB in
  one request, and a wine image up to 20 MB. Cellar refuses anything larger than 512 MB itself;
  nginx refuses anything larger than 1 MB unless you raise its limit.
- **Time.** An upload of a few hundred megabytes over Wi-Fi or a VPN takes minutes, and Cellar
  gives an upload 30 minutes at most to arrive, so 500 MB need 0.3 MB/s or more. nginx and SWAG
  receive the whole upload first, in a temporary file that needs as much free disk space, then pass
  it on at once: a slower upload gets through them. Caddy and Traefik pass it on as it comes, so a
  slower one fails with `408`; Caddy sets no limit of its own, and the Traefik example below gives
  more than these 30 minutes. Cellar answers a restore or an import only once it is done: the
  examples wait for that answer 10 minutes with nginx, 240 seconds with SWAG, and without a limit
  with Caddy and Traefik.
- **The MCP server, at `/mcp`.** An AI assistant sends its token in the `Authorization` header and
  the protocol in `Accept`, `Content-Type`, `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name`:
  the proxy passes them as they are, which all four do unless told otherwise. Every message is a
  `POST` of at most 4 MiB. A client of the 2025 revisions gets its answers as a stream
  (`text/event-stream`), and a 2026-07-28 client may keep a stream open (`subscriptions/listen`),
  with a keep-alive line every 15 seconds: the proxy must pass each piece as it comes, without
  buffering, over HTTP/1.1, and wait at least 60 seconds between two of them. MCP clients send no
  `Origin` header, so `ORIGIN` does not stop them.
- **No way around it.** Once the proxy serves Cellar, nothing else should reach the container's
  port. Either remove `ports:` from `docker-compose.yml` and put Cellar on a Docker network that it
  shares with the proxy, or, when the proxy runs on the host itself, publish the port on the
  loopback interface only:

  ```yaml
  ports:
    - '127.0.0.1:3005:3000'
  ```

All four examples send the client's address in `X-Forwarded-For`. To limit wrong access codes per
device rather than for the proxy as a whole, add `ADDRESS_HEADER=x-forwarded-for` and `XFF_DEPTH=1`
to Cellar's environment, as
[Client addresses behind a reverse proxy](../README-Docker.md#client-addresses-behind-a-reverse-proxy)
describes; only once the proxy is the only way in.

Replace `cellar.example.com` with your address in every example.

## Cellar on the proxy's Docker network

SWAG, Caddy and Traefik usually run in Docker. Put Cellar on a network that the proxy container
joins too, here one named `proxy`, created once with `docker network create proxy`. In
`docker-compose.yml`, replace the `ports:` of the `cellar` service and add the network:

```yaml
services:
  cellar:
    # ...image, environment and volumes as before, without ports:
    networks:
      - proxy

networks:
  proxy:
    external: true
```

The proxy then reaches Cellar at `cellar:3000`: the service name, on the port inside the container.
The container name, `wine-cellar` in `docker-compose.yml`, works as well.

## nginx

For nginx installed on the host, with Cellar's port published on `127.0.0.1:3005`, and a
certificate from certbot. Save it as `/etc/nginx/conf.d/cellar.conf` (or in `sites-available/`,
linked from `sites-enabled/`), then run `nginx -t` and `systemctl reload nginx`. From an nginx
container on the network of the previous section, write `server cellar:3000;` in `upstream`.

```nginx
upstream cellar {
    server 127.0.0.1:3005;
}

# Sends the http:// address to https://.
server {
    listen 80;
    listen [::]:80;
    server_name cellar.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name cellar.example.com;

    ssl_certificate /etc/letsencrypt/live/cellar.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cellar.example.com/privkey.pem;

    # A restore or a ZIP import sends up to 500 MB, and nginx stops at 1 MB by default.
    client_max_body_size 512m;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Cellar answers a restore or an import once it is done, which may take minutes.
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

    location / {
        proxy_pass http://cellar;
    }

    # MCP server: its answers are streams, passed on as they come.
    location = /mcp {
        proxy_pass http://cellar;
        proxy_buffering off;
    }
}
```

nginx passes the `Authorization` header and the other headers of the client as they are. The MCP
server also sends `X-Accel-Buffering: no` with its streams, which nginx obeys; `proxy_buffering off`
keeps them unbuffered even where a configuration ignores that header.

## SWAG

[SWAG](https://docs.linuxserver.io/general/swag) is nginx, with its certificates and its
`proxy-confs` folder. Put Cellar and SWAG on the same Docker network (see
[Cellar on the proxy's Docker network](#cellar-on-the-proxys-docker-network), with SWAG's network
in place of `proxy`), add `cellar` to the `SUBDOMAINS` of SWAG (or use a wildcard certificate), and
save this file as `/config/nginx/proxy-confs/cellar.subdomain.conf` in SWAG's config folder. Restart
SWAG (`docker restart swag`), then check its log (`docker logs swag`) for nginx errors.

```nginx
## Version 2026/10/31
# Cellar: https://github.com/Lulu300/cellar
# make sure that your cellar container is on the same Docker network as SWAG, and that $upstream_app
# below is its service or container name (cellar, or wine-cellar from Cellar's docker-compose.yml)
# make sure that your dns has a cname set for cellar
# make sure that Cellar's .env has ORIGIN=https://cellar.<your domain>, then run docker compose up -d

server {
    listen 443 ssl;
    listen [::]:443 ssl;

    server_name cellar.*;

    include /config/nginx/ssl.conf;

    # A restore or a ZIP import sends up to 500 MB; Cellar refuses more than 512 MB itself.
    client_max_body_size 512m;

    location / {
        # proxy.conf passes the headers of the client, uses HTTP/1.1 and waits 240 s for an
        # answer: enough for a restore or an import.
        include /config/nginx/proxy.conf;
        include /config/nginx/resolver.conf;
        set $upstream_app cellar;
        set $upstream_port 3000;
        set $upstream_proto http;
        proxy_pass $upstream_proto://$upstream_app:$upstream_port;
    }

    # MCP server: its answers are streams, passed on as they come.
    location = /mcp {
        include /config/nginx/proxy.conf;
        include /config/nginx/resolver.conf;
        set $upstream_app cellar;
        set $upstream_port 3000;
        set $upstream_proto http;
        proxy_pass $upstream_proto://$upstream_app:$upstream_port;

        proxy_buffering off;
    }
}
```

- `$upstream_port` is the port inside Cellar's container, `3000`, whatever port `docker-compose.yml`
  publishes. If Cellar is not on SWAG's network, use the address of the NAS and the published port
  instead: `set $upstream_app 192.168.1.20;` and `set $upstream_port 3005;`.
- Keep the `include` lines: `proxy.conf` sets `proxy_read_timeout` and the other timeouts, and
  nginx refuses to start when the same location sets one of them a second time.
- The `ldap`, `authelia`, `authentik` and `tinyauth` lines of SWAG's samples put a login page in
  front of the app. An MCP client or a script cannot get through such a page: if you add one to
  `location /`, leave `location = /mcp` without it, so that the token alone protects `/mcp`, and
  keep SWAG on your network or your VPN.

## Caddy

Caddy gets and renews the certificate on its own, redirects `http://` to `https://`, passes the
headers of the client, sets `X-Forwarded-For` and `X-Forwarded-Proto`, has no time limit for an
answer, and passes event streams as they come. In the `Caddyfile`:

```caddyfile
cellar.example.com {
	# A restore or a ZIP import sends up to 500 MB; Cellar refuses more than 512 MB itself.
	# Cellar counts in MiB: Caddy's 512MB would be 512,000,000 bytes and refuse some restores.
	request_body {
		max_size 512MiB
	}
	reverse_proxy cellar:3000
}
```

`cellar:3000` is Cellar on Caddy's Docker network; with Caddy on the host, write
`reverse_proxy 127.0.0.1:3005`. Caddy gets its certificate through ports 80 and 443, which the
internet must reach. For a name that only your network resolves, a DNS challenge needs a Caddy built
with the module of your DNS provider; or Caddy signs the certificate itself: add `tls internal` to
the block, and install Caddy's root certificate on your devices (`caddy trust`, or the `root.crt`
file from Caddy's data folder), or each browser warns.

## Traefik

Traefik reads its routes from the labels of Cellar's container. In `docker-compose.yml`, on the
`cellar` service, which joins Traefik's network:

```yaml
services:
  cellar:
    # ...image, environment and volumes as before, without ports:
    networks:
      - proxy
    labels:
      - traefik.enable=true
      - traefik.docker.network=proxy
      - traefik.http.routers.cellar.rule=Host(`cellar.example.com`)
      - traefik.http.routers.cellar.entrypoints=websecure
      - traefik.http.routers.cellar.tls.certresolver=letsencrypt
      - traefik.http.services.cellar.loadbalancer.server.port=3000

networks:
  proxy:
    external: true
```

`websecure` and `letsencrypt` are the names of the HTTPS entry point and the certificate resolver
in Traefik's own configuration: use yours. The redirect from `http://` to `https://` belongs to
that configuration too, on the HTTP entry point, as for any other app.

Traefik gives a client 60 seconds to send its whole request, body included: an upload of a few
hundred megabytes over Wi-Fi or a VPN stops halfway, with `502 Bad Gateway`. Raise that limit above the
30 minutes that Cellar itself gives an upload, on the HTTPS entry point, in Traefik's static
configuration: in the `command:` of its container,

```yaml
command:
  - --entrypoints.websecure.transport.respondingTimeouts.readTimeout=2400s
```

or, in `traefik.yml`:

```yaml
entryPoints:
  websecure:
    address: ':443'
    transport:
      respondingTimeouts:
        readTimeout: 2400s
```

`/mcp` needs no rule of its own: Traefik passes the headers of the client, does not limit the time
of an answer, and sends event streams as they come. Do not put a `buffering` middleware on Cellar's
router.

## Nginx Proxy Manager

A proxy host with scheme `http`, Cellar's address as forward hostname (`cellar` on a shared Docker
network, port `3000`, or the address of the NAS and port `3005`), and a certificate in its SSL tab
with **Force SSL**. It already allows uploads of 2000 MB and uses HTTP/1.1, and the streams of
`/mcp` pass unbuffered, since the MCP server asks for it with `X-Accel-Buffering: no`. But it waits
90 seconds for an answer: in its **Advanced** tab, add `proxy_read_timeout 600s;` and
`proxy_send_timeout 600s;`. Not replayed.

## Synology reverse proxy

In Control Panel › Login Portal › Advanced › Reverse Proxy, a rule from `HTTPS`, your hostname
and port 443 to `HTTP`, `localhost` and port 3005, with the certificate chosen in Control Panel ›
Security › Certificate. It is nginx too, so the streams of `/mcp` pass unbuffered. Not replayed,
for lack of a Synology NAS: if a large restore or import fails through it, look in the rule's
advanced settings for its timeouts.

## Check it

With `ORIGIN=https://cellar.example.com` set and the container recreated:

1. Open `https://cellar.example.com`, log in and save a change: a `403 Cross-site ... forbidden`
   means that `ORIGIN` is not the address in the address bar (see
   [Troubleshooting](../README-Docker.md#saving-fails-with-cross-site-post--forbidden-403)).
2. In Admin › Backups, restore a recent backup, or import a ZIP: a `413` from the proxy comes from
   its upload limit, a `502` or a `504` from its time limits, and a `408` from an upload that took
   more than 30 minutes.
3. Point the AI assistant at `https://cellar.example.com/mcp` (see
   [AI assistants (MCP)](../README-Docker.md#ai-assistants-mcp)), or call it with curl:

   ```bash
   curl -sS -X POST https://cellar.example.com/mcp \
     -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" -H "MCP-Protocol-Version: 2025-06-18" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

   It answers `event: message` then `data:` with the list of tools. A `401` means that the token is
   wrong, or that the proxy drops the `Authorization` header.
