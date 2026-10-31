# Cellar

Cellar is a self-hosted wine cellar manager. It runs as a Docker container, for example on a home NAS, and is meant for a home network or a VPN: do not expose it directly to the Internet.

- **Install:** [Installation](#installation) below; [README-Docker.md](README-Docker.md) gives every detail.
- **Upgrade:** read [UPGRADING.md](UPGRADING.md) for every version between yours and the new one, then follow [Updating](README-Docker.md#updating). [CHANGELOG.md](CHANGELOG.md) lists the changes of each version.
- **API:** your own scripts can read and change the cellar through the HTTP API that the app uses, described in [docs/API.md](https://github.com/Lulu300/cellar/blob/main/docs/API.md). The admin page links to it too. For tools, [docs/openapi.json](https://github.com/Lulu300/cellar/blob/main/docs/openapi.json) describes the same API in OpenAPI 3.1.

## Features

- **Wines and bottles:** wine definitions (producer, appellation, type, color, classification, grape varieties, rating, image) and their bottles (vintage, format, drinking year, origin, purchase date and price, current value, storage case, notes). Search and filter the list, or find a bottle by its barcode.
- **Bottle status:** a bottle is available, out of the cellar or consumed. The "Out of Cellar" page lists the bottles taken out, and the history page lists every bottle purchased and consumed.
- **Storage:** containers divided into cases, each with a capacity, and their occupancy.
- **Wine shortage:** wines with fewer available bottles than their target quantity.
- **Statistics:** collection value, bottle status, and distribution by type, color, country, producer, region and vintage.
- **Barcodes and labels:** sequential codes with a prefix, generated automatically or assigned by hand. Export a range of codes, or the bottles that have one, as CSV, and print PDF label sheets with Code 128 barcodes or QR codes, with saved label presets.
- **Scanner:** scan codes with the device camera to find a bottle, or scan, type or paste several codes to consume, take out, put back or move many bottles at once. The browser only gives the page the camera over HTTPS or on `localhost`, for example [behind a reverse proxy](README-Docker.md#behind-a-reverse-proxy); typing or pasting codes works everywhere.
- **Backups:** ZIP backups of the database and the images, on demand or on a schedule, and restore from them. Full export and import of the data with the images.
- **CSV:** export tables to CSV, import wine data from CSV, and import the matching images from a ZIP file.
- **Administration:** reference data (countries, regions, appellations, origins, wine types, colors, formats, classifications), images, and settings.
- **Access code:** anyone on the network can browse the cellar; changes and the admin pages need the access code ([details](README-Docker.md#access-code)).
- **Interface:** English and French, light and dark modes, and several color schemes.

## Installation

Cellar runs from its published image, `ghcr.io/lulu300/cellar`, with Docker and its Compose plugin. The image is public: pulling it needs no login. On the machine that will run Cellar:

1. Create a folder for Cellar, and in it a file named `docker-compose.yml`:

   ```yaml
   services:
     cellar:
       image: ghcr.io/lulu300/cellar:latest
       container_name: wine-cellar
       restart: unless-stopped
       ports:
         - '3005:3000'
       environment:
         - NODE_ENV=production
         - PORT=3000
         - HOST=0.0.0.0
         - ORIGIN=${ORIGIN:?Set ORIGIN in .env to the URL used in the browser, e.g. http://192.168.1.20:3005}
       volumes:
         - ./docker-data/data:/app/data
         - ./docker-data/uploads:/app/static/uploads
         - ./docker-data/csv-imports:/app/csv-imports
   ```

2. Next to it, create a file named `.env` that sets `ORIGIN` to the exact URL you will type in the browser: scheme, address of the machine and port `3005`. Cellar refuses changes sent from any other URL ([details](README-Docker.md#application-url-origin)).

   ```sh
   ORIGIN=http://192.168.1.20:3005
   ```

3. Create the data folders. The container runs as uid `1000`, which must own them (without `sudo`, or to run it as another user, see [Data ownership](README-Docker.md#data-ownership)):

   ```sh
   mkdir -p docker-data/data docker-data/uploads docker-data/csv-imports
   sudo chown -R 1000:1000 docker-data
   ```

4. Download the image and start Cellar in the background:

   ```sh
   docker compose pull
   docker compose up -d
   ```

5. Open the URL set in `ORIGIN`, and choose an access code. The app asks for a setup token, which the logs show:

   ```sh
   docker compose logs cellar | grep "Setup token"
   ```

[README-Docker.md](README-Docker.md) covers the rest, such as [updating](README-Docker.md#updating), serving Cellar over HTTPS [behind a reverse proxy](README-Docker.md#behind-a-reverse-proxy), and [backups](README-Docker.md#backup).

## Development

Use Node 24 and pnpm 10. `packageManager` in `package.json` pins the exact pnpm version (`npx -y pnpm@10 …` works if pnpm is not installed), and `pnpm install` refuses other Node versions.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The development server creates its database in `data/cellar.db`, relative to the working directory (`DATA_DIR` or `DATABASE_PATH` move it). To save changes, choose an access code first: the app asks for the setup token that the `pnpm dev` terminal prints.

Before a commit, run the checks that CI runs (`.github/workflows/ci.yml`), in its order:

```sh
pnpm db:generate                # CI fails if this adds a migration: commit it with schema.ts
pnpm check                      # type-check
pnpm lint                       # Prettier and ESLint (pnpm format fixes the formatting)
pnpm test                       # Vitest
pnpm i18n:check                 # translations, see below
pnpm knip                       # unused files, exports and dependencies
pnpm build                      # production server
node scripts/check-origin.mjs   # the built server applies ORIGIN, refuses cross-site writes, answers /
pnpm test:e2e                   # end-to-end journeys in Chromium, against the built server
```

`pnpm i18n:check` fails on a translation key that is missing, defined twice, in one locale only, unused or not written out (`m['key']`), on a value that is not text (a nested object or a number in a locale file), on a plural made by hand, on the same text under two keys, on text with `...` instead of …, in either locale, on French text with `'` or `"` instead of ’ and « », and on text written in a component instead of the locale files. `pnpm test:e2e` needs Chromium once: `pnpm exec playwright install chromium`. CI also builds the Docker image and waits until it is healthy (`scripts/check-image.sh <image>`).

Start the built server with `ORIGIN=http://localhost:3000 BODY_SIZE_LIMIT=512M node server.js`. `node build` alone ignores `ORIGIN`, so every save would fail with 403, and sends no header that forbids framing. Without `BODY_SIZE_LIMIT`, which the Docker image sets to `512M`, the server refuses any request body over 512 KB with 413, such as a backup to restore, a ZIP to import or an image to upload.

After a change to `src/lib/server/db/schema.ts`, create a migration with `pnpm db:generate`.

Contributors and coding agents follow [AGENTS.md](AGENTS.md): conventions, branches, tests and review. [RELEASING.md](RELEASING.md) describes how versions are published.
