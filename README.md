# Cellar

Cellar is a self-hosted wine cellar manager. It runs as a Docker container, for example on a home NAS, and is meant for a home network or a VPN: do not expose it directly to the Internet.

- **Install:** [Docker installation](README-Docker.md#quick-start)
- **Upgrade:** read [UPGRADING.md](UPGRADING.md) for every version between yours and the new one, then follow [Updating](README-Docker.md#updating). [CHANGELOG.md](CHANGELOG.md) lists the changes of each version.

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

Start the built server with `ORIGIN=http://localhost:3000 BODY_SIZE_LIMIT=512M node server.js`. `node build` alone ignores `ORIGIN`, so every save would fail with 403. Without `BODY_SIZE_LIMIT`, which the Docker image sets to `512M`, the server refuses any request body over 512 KB with 413, such as a backup to restore, a ZIP to import or an image to upload.

After a change to `src/lib/server/db/schema.ts`, create a migration with `pnpm db:generate`.

Contributors and coding agents follow [AGENTS.md](AGENTS.md): conventions, branches, tests and review. [RELEASING.md](RELEASING.md) describes how versions are published.
