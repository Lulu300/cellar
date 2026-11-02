# Cellar with Docker

This guide runs Cellar with Docker Compose, for example on a home NAS.

## Prerequisites

- Docker with the Compose plugin: the commands below use `docker compose`.
- Free disk space for Docker: about 400 MB for the image, plus your data and its backups.
  [Building the image from source](#building-from-source) takes about 1.5 GB more (the base image
  and the build cache, which `docker builder prune` frees).

## Quick start

1. **Get the files.** Create a folder for Cellar on the server, and download `docker-compose.yml`
   and `.env.example` into it. The `main` branch holds the latest release:

   ```bash
   mkdir cellar && cd cellar
   curl -fsSLO https://raw.githubusercontent.com/Lulu300/cellar/main/docker-compose.yml
   curl -fsSLO https://raw.githubusercontent.com/Lulu300/cellar/main/.env.example
   ```

2. **Create the data directories**, owned by the user the container runs as (see
   [Data ownership](#data-ownership)):

   ```bash
   mkdir -p docker-data/data docker-data/uploads docker-data/csv-imports
   sudo chown -R 1000:1000 docker-data
   ```

3. **Set the URL of the application** (required, see [Application URL (ORIGIN)](#application-url-origin)):

   ```bash
   cp .env.example .env
   # then edit ORIGIN, e.g. ORIGIN=http://192.168.1.20:3005
   ```

4. **Download the image and start the application** in the background:

   ```bash
   docker compose pull
   docker compose up -d
   ```

   The image is public: pulling it needs no login. If `docker compose pull` fails, for example
   without Internet access, `docker compose up -d` tries to build the image instead, which fails
   in this folder with `open Dockerfile: no such file or directory`: run the pull again first. To
   build the image yourself instead, see [Building from source](#building-from-source).

5. **Open the application** at the exact URL set in `ORIGIN` (port `3005` is mapped in
   `docker-compose.yml`), and choose an access code: see [Access code](#access-code).

## Updating

Some versions need a manual action, or must be installed before any later version (a mandatory
stop). Before updating, read [UPGRADING.md](UPGRADING.md) for every version between yours and the
new one.

Cellar also checks the upgrade when it starts. It refuses to start when the update skips a mandatory
stop, and its log names the version to install first. No data is changed: put the tag of that
version in place of `latest` in `docker-compose.yml` (see [Image tags](#image-tags)), run
`docker compose pull` and `docker compose up -d`, let it start once, then put `latest` back and
update again. To return to the version you ran, put its tag there instead. Otherwise its log lists
the upgrade actions of the versions you passed, and the Admin page shows them until you tick each
one as done. Some older versions did not record themselves: Cellar then judges the version from the
database.

To update, run these commands next to `docker-compose.yml`: they download the new image and
restart the container with it. If you replaced `latest` with a version tag (see
[Image tags](#image-tags)), put the tag of the new version there first.

```bash
docker compose pull
docker compose up -d
```

A new version may also change `docker-compose.yml`. This command shows how yours differs from that
of the latest release, your own changes (port, `user:`, proxy headers) included; make the new
release's changes in yours:

```bash
curl -fsSL https://raw.githubusercontent.com/Lulu300/cellar/main/docker-compose.yml | diff docker-compose.yml -
```

A `docker-compose.yml` written from the [Installation](README.md#installation) section of the
README has no comments and no `build: .`: the diff shows them at every update, and they are not
changes to make.

The image of the previous version stays on disk: once it has lost its tag to the new one,
`docker image prune` frees it; a version tag you set yourself goes with
`docker rmi ghcr.io/lulu300/cellar:<tag>`.

## Image tags

GitHub Actions publishes an image to `ghcr.io/lulu300/cellar` for each release, for `linux/amd64`
and `linux/arm64`, with these tags:

- stable versions: `latest`, `X.Y.Z` and `X.Y`;
- release candidates, for testing only: `dev` and `X.Y.Z-rc.N`.

`docker-compose.yml` uses `latest`, the latest stable version. To stay on a version, replace
`latest` with its tag, such as `ghcr.io/lulu300/cellar:1.0.0`. Each release has
[release notes](https://github.com/Lulu300/cellar/releases), and [CHANGELOG.md](CHANGELOG.md)
lists them all.

## Building from source

Instead of pulling the image, you can build it from the source code, which needs Internet access
and the disk space given in [Prerequisites](#prerequisites). Open the
[latest release](https://github.com/Lulu300/cellar/releases/latest), download
`Source code (tar.gz)`, copy it to the server and extract it:

```bash
tar -xzf cellar-X.Y.Z.tar.gz
mv cellar-X.Y.Z cellar
cd cellar
```

Or clone the repository, whose default branch, `main`, holds the latest release:

```bash
git clone https://github.com/Lulu300/cellar.git
cd cellar
```

Follow steps 2 and 3 of the [Quick start](#quick-start) in this folder, then build the image and
start the application:

```bash
docker compose up -d --build
```

To update, with a release archive, replace the folder and move `docker-data/` and `.env` into the
new one. The move needs `sudo`: `docker-data/` belongs to the container user, and moving a folder
to another folder needs write access to it. The `&&` stop the commands at the first error, so that
nothing starts on a half-moved folder:

```bash
cd cellar && docker compose down && cd .. &&
mv cellar cellar-old &&
tar -xzf cellar-X.Y.Z.tar.gz &&
mv cellar-X.Y.Z cellar &&
sudo mv cellar-old/docker-data cellar-old/.env cellar/ &&
cd cellar && docker compose up -d --build
```

If you changed `docker-compose.yml` (port, `user:`, proxy headers), make the same changes in the
new one: `diff cellar-old/docker-compose.yml cellar/docker-compose.yml` shows them. Open Cellar
and check that your wines are there before you delete `cellar-old`. Each build takes more disk
space: `docker builder prune` and `docker image prune` free what earlier builds use. With a Git
clone, run `git pull`, then `docker compose up -d --build`.

Keep `--build`: without it, Compose starts the image built for the previous version again. The
image you build takes the name of the published one, `ghcr.io/lulu300/cellar:latest`, so
`docker compose pull` replaces it with the published image.

## Application URL (ORIGIN)

The application rejects any write request (`POST`, `PUT`, `PATCH`, `DELETE`) whose `Origin`
header does not match its own URL, with `403 Cross-site ... forbidden`. This stops a malicious
web page opened by someone on your network from modifying or wiping the cellar.

The server cannot guess its public URL on its own, so you must tell it with the `ORIGIN`
environment variable. `docker-compose.yml` reads it from a `.env` file placed next to it, and
refuses to start without it:

```bash
# .env
ORIGIN=http://192.168.1.20:3005
```

`ORIGIN` must be **exactly** the URL shown in the browser address bar when you use the app:
same scheme (`http` or `https`), same host, same port.

| You open the app at                        | `ORIGIN`                   |
| ------------------------------------------ | -------------------------- |
| `http://192.168.1.20:3005` (NAS LAN IP)    | `http://192.168.1.20:3005` |
| `http://nas.local:3005` (hostname)         | `http://nas.local:3005`    |
| `http://localhost:3005` (same machine)     | `http://localhost:3005`    |
| `https://cave.example.com` (reverse proxy) | `https://cave.example.com` |

Only one URL is accepted. If `ORIGIN` is `http://nas.local:3005` and you open
`http://192.168.1.20:3005`, pages still load but every save, import, upload or delete fails
with `403`. Pick one address, bookmark it, and use it on every device.

After changing `.env`, recreate the container: `docker compose up -d`.

Your own scripts usually send no `Origin` header. Such a write needs a `Content-Type` that is not a
form one, such as `Content-Type: application/json`: without one (a bare `curl -X DELETE`), or with
`multipart/form-data`, `application/x-www-form-urlencoded` or `text/plain`, it gets `403` with a
text such as `Cross-site DELETE form submissions are forbidden`, not Cellar's JSON error. A script
that sends `Origin` with the value of `ORIGIN` on every write, uploads included, avoids this: see
[Origin check](docs/API.md#origin-check).

### Scanner camera

Browsers only let a page use the camera over HTTPS or on `localhost`. At an address such as
`http://192.168.1.20:3005`, the barcode scanner cannot open the camera; typing or pasting codes
still works. To scan with the camera of a phone, serve Cellar over HTTPS
[behind a reverse proxy](#behind-a-reverse-proxy), and set `ORIGIN` to that `https://` URL.

### Install on a phone

Cellar can be installed on the home screen of a phone, with its own icon, and then opens full
screen, without the browser's address bar. Nothing is stored for offline use: the app still needs
the server.

- **Android (Chrome):** open Cellar, then the menu **⋮** › **Add to Home screen** › **Install**
  (**⋮** › **Install app** in older versions). Chrome only offers to install it over HTTPS: serve
  Cellar [behind a reverse proxy](#behind-a-reverse-proxy), and set `ORIGIN` to that `https://`
  URL. At an address such as `http://192.168.1.20:3005`, **⋮** › **Add to Home screen** still
  creates a shortcut, which opens Cellar in a browser tab.
- **iPhone and iPad (Safari):** open Cellar, then **Share** › **Add to Home Screen**.
- **Computer (Chrome, Edge):** the install button at the end of the address bar, over HTTPS too.

### Behind a reverse proxy

If a reverse proxy (Traefik, Caddy, nginx, Synology reverse proxy...) serves the app on a
single public URL, setting `ORIGIN` to that URL is enough.
[docs/reverse-proxy.md](docs/reverse-proxy.md) gives configurations to copy for nginx, SWAG, Caddy
and Traefik, with the upload size of a restore, the time limits and what the MCP server needs, and
says what to set in Nginx Proxy Manager and the Synology reverse proxy.

If the app must answer on several hostnames, replace the `ORIGIN` line in `docker-compose.yml`
with the headers your proxy sets, so the server rebuilds its URL from each request:

```yaml
environment:
  - PROTOCOL_HEADER=x-forwarded-proto
  - HOST_HEADER=x-forwarded-host
```

`ORIGIN` takes precedence over these headers, so leave it unset in that case. Make sure the
proxy overwrites these headers rather than passing through values sent by the client.

In this mode the container port **must only be reachable by the proxy**, and all access must
go through the proxy:

- If port `3005` stays published on the LAN, anyone who reaches it directly can send forged
  `X-Forwarded-*` and `Origin` headers that agree with each other, and a malicious page can do
  the same through DNS rebinding, which defeats the origin check.
- Direct access to `http://<NAS-IP>:3005` also breaks: without the proxy headers the server
  assumes `https`, so pages load but every write fails with `403 Cross-site ... forbidden`.

Bind the port to the loopback interface when the proxy runs on the same host:

```yaml
ports:
  - '127.0.0.1:3005:3000'
```

or remove `ports:` and attach the container to a Docker network shared only with the proxy.

## Access code

Anyone can browse the cellar; saving changes and the admin pages need the access code. Cellar is
meant for a home network or a VPN: do not expose it to the Internet without protection in front of
it, such as a VPN or authentication at the reverse proxy.

There is no default code. On first start, the app asks you to choose one, together with a setup
token that the server prints in its logs, so that only someone who can read the container logs
can claim the instance:

```bash
docker compose logs cellar | grep "Setup token"
```

With `docker run`, use `docker logs <container>`. The server logs the token when it starts, and
again at most once a minute while the app asks for the first code. It is written as `XXXX-XXXX-XXXX`, but
case, spaces and dashes do not matter. Restarting the container replaces it, and it stops working
once a code is set.

Installs upgraded from a version that still had the default code `1234` ask for a new code and the
setup token the same way; a code you had chosen keeps working. Restoring a backup keeps the access
code the instance has now, whatever code the backup was made with.

Wrong codes are limited per address (per /64 network for IPv6). No more than 5 attempts are
accepted in any minute, and mistakes add up: after 20, the address gets one more attempt every 15
minutes, the pace at which they are forgotten. A correct code clears them, and so does restarting
the container (`docker compose restart cellar`). Devices that reach Cellar with the same address
share one allowance: all the devices of a home on one IPv6 /64, or every client when a proxy, or
Docker's own port forwarding, shows them all with the same gateway address.

### Forgotten access code

The code is stored hashed, so it cannot be read back, but it can be removed. The command below
also ends every login session, so that a session someone else may hold stops working at once.
With the repository's `docker-compose.yml`, run next to it:

```bash
docker compose stop cellar
docker compose run --rm --no-deps --entrypoint node cellar -e 'const db = require("better-sqlite3")(process.env.DATABASE_PATH || (process.env.DATA_DIR || "data") + "/cellar.db"); db.prepare("DELETE FROM app_settings WHERE key = ?").run("access_code"); db.prepare("DELETE FROM sessions").run()'
docker compose start cellar
```

Then open Cellar: as on a first start, it asks for a new code and the setup token from the logs.

With your own compose file or `docker run`, stop the container and run the same command through
`docker run`, with the folder or volume your container mounts on `/app/data`, the image your
container runs (`docker inspect -f '{{.Config.Image}}' <container>`), and `--user <uid:gid>` if
you set `user:` for it. If you set `DATA_DIR` or `DATABASE_PATH`, mount the folder on the same path
as your container does and pass the variable too, such as
`-v <data>:/srv/cellar -e DATA_DIR=/srv/cellar`:

```bash
docker run --rm -v <data>:/app/data --entrypoint node <image> -e 'const db = require("better-sqlite3")(process.env.DATABASE_PATH || (process.env.DATA_DIR || "data") + "/cellar.db"); db.prepare("DELETE FROM app_settings WHERE key = ?").run("access_code"); db.prepare("DELETE FROM sessions").run()'
```

### Client addresses behind a reverse proxy

Behind a reverse proxy, every request seems to come from the proxy, so a few wrong codes typed by
one person block everyone. Optionally, tell the server which header holds the real address:

```yaml
environment:
  - ADDRESS_HEADER=x-forwarded-for
  - XFF_DEPTH=1 # number of proxies in front of the app
```

As with `PROTOCOL_HEADER` above, the container port must then only be reachable through the
proxy: a client that reaches it directly could pick any address and escape the limit, and a
login that arrives without the header fails.

## Directory structure

`docker-compose.yml` mounts these folders, next to it:

```text
docker-data/
├── data/           # Database, backups and exports
├── uploads/        # Wine images, in uploads/wines/
└── csv-imports/    # Reference data used to fill a new database
```

## Mounted volumes

- **`./docker-data/data:/app/data`** - The SQLite database (`cellar.db`), and the backups and
  exports made from the admin page or on schedule
- **`./docker-data/uploads:/app/static/uploads`** - Wine images
- **`./docker-data/csv-imports:/app/csv-imports`** - The reference data CSV files: wine types,
  colors, classifications, bottle formats, appellations (with their countries and regions) and
  label presets. Shortly after each start, Cellar copies there the default file of any that is
  missing, and replaces a copy that you never edited when a release corrects that file. It reads
  them when it creates a new database and after **Wipe All Data** (in the **Backups** tab of the
  admin page), so editing them changes what those fill in. Your own data is imported from the
  browser instead: see [Importing CSV data](#importing-csv-data-optional).

The container needs nothing else: Cellar finds these folders relative to `/app`. To keep them
elsewhere, for example when running Cellar without Docker, set `DATA_DIR` (database, backups and
exports), `UPLOADS_DIR` (images, in its `wines/` folder) or `CSV_IMPORTS_DIR`. `DATABASE_PATH`
moves the database file alone; it defaults to `cellar.db` in `DATA_DIR`.

Mount the folder that holds the database, never the database file alone, and do not make
`DATABASE_PATH` a symbolic link. SQLite keeps the latest changes in `cellar.db-wal` next to the
database, which would stay inside the container with a file mounted alone. A restore also writes
the new database next to the old one, then renames it over it: on a file mounted alone, the rename
fails and the restore with it; on a symbolic link, the restored database replaces the link, and
the file the link pointed to keeps the old data.

Keep that folder on a disk of the machine that runs Cellar, not on a network share (NFS, SMB)
mounted from another machine: Cellar runs SQLite in WAL mode, which needs shared memory and file
locks that network file systems do not provide reliably, and the database can be corrupted there.
On a NAS, `docker-data/` on the NAS's own volumes is fine.

## Data ownership

The application runs as the unprivileged `node` user (uid `1000`, gid `1000`), not as root. It
writes to all three mounted folders (shortly after each start, it copies the missing default CSV
files into `/app/csv-imports`), so they and everything in them must belong to that user.

With the folders of the repository's `docker-compose.yml`, run next to it:

```bash
sudo chown -R 1000:1000 docker-data
```

If `id -u` prints `1000` on the host, the folders you create already have the right owner.

With any other setup, named volumes included, or without `sudo` on the host, let Docker change
the owner with a small public image. Mount the same folders or volumes as your container (drop
the `-v` options of folders you do not mount):

```bash
docker run --rm \
  -v "$PWD/docker-data/data:/app/data" \
  -v "$PWD/docker-data/uploads:/app/static/uploads" \
  -v "$PWD/docker-data/csv-imports:/app/csv-imports" \
  alpine chown -R 1000:1000 /app/data /app/static/uploads /app/csv-imports
```

For a named volume, give its name as the source, for example `-v cellar-data:/app/data`
(`docker volume ls` lists them).

### Running as another user

To run the application as another account, for example the one that owns your shares on a NAS,
add `user:` to the service. Find its numbers with `id <account>` (often `1026:100` on Synology,
`99:100` on Unraid):

```yaml
services:
  cellar:
    user: '1026:100'
```

Then give the folders to that user and group: `sudo chown -R 1026:100 docker-data`, or
`-R 1026:100` instead of `-R 1000:1000` in the `docker run` command above.

With another user, store the data in folders (bind mounts), not in new named volumes: as long as
a named volume is empty, Docker gives it the owner of the image folder (`1000:1000`) each time it
is mounted, whatever `user:` says, so a `chown` does not last and the application cannot create
its database. A named volume that already holds data keeps the owner you give it.

### Symptoms and upgrades

If the application cannot write to one of the folders, or to a file or folder inside them, for
example because it belongs to root, the container stops right after starting (and, with a restart
policy such as the one in `docker-compose.yml`, keeps restarting), and `docker compose logs cellar`
names them, their owner and the `chown` to run. The first versions of Cellar ran as root, so data
created by them belongs to root: change the owner once, as above, when upgrading.

Owning the folders is not enough: a common upgraded layout has folders that belong to uid `1000`
and files inside that belong to root, and the application stops there too. The log lists a few of
these files per folder, then how many more; the `-R` of the commands above changes them all.

Files you copy into `docker-data/` yourself belong to you: change their owner the same way
afterwards, or the next start stops on them.

Folders that the NAS itself creates and owns (`@eaDir`, `#recycle`, `#snapshot`, `.snapshot`,
`lost+found`) are left out of the check: the application never writes to them.

## Initial setup

### Importing CSV data (optional)

The import reads files sent from your browser, not files on the server:

1. Open the admin page: the URL set in `ORIGIN` followed by `/admin` (e.g.
   `http://192.168.1.20:3005/admin`).
2. In the **Backups** tab, under **Backup & Restore**, choose **CSV Import** and select the CSV
   files on your computer. The dialog's **CSV File Format Guide** lists the file names and columns
   it expects.

### Adding images (optional)

Images are normally added from the wine forms. After a CSV import that names images (wine images
with their `filename`, and wines with their `imageName`), add the files with **Import Images from
ZIP** in the **Images** tab of the admin page, or copy them into `docker-data/uploads/wines/` and
give them to the container user (see [Data ownership](#data-ownership)):

```bash
mkdir -p docker-data/uploads/wines
cp your-wine-images/* docker-data/uploads/wines/
sudo chown -R 1000:1000 docker-data/uploads
```

Cellar only shows the files whose name matches an imported wine image.

**Import Images from ZIP** in the **Images** tab reads the whole ZIP into memory, and can take up
to 5 times its size: over 2 GB for a ZIP of 450 MB. **Upload Images** does the same with the images
sent at once. On a NAS with little memory, import the images in several smaller ZIPs, or upload
fewer at once: a container that runs out of memory restarts, and nothing is imported.

## Docker commands

Run them next to `docker-compose.yml`.

### Start in the background

```bash
docker compose up -d
```

With an image [built from source](#building-from-source), `docker compose up -d --build` builds it
again first.

### Stop and remove the container

```bash
docker compose down
```

The data in `docker-data/` stays.

### View logs

```bash
docker compose logs -f cellar
```

### Rebuild the image without the build cache

When you [build from source](#building-from-source):

```bash
docker compose build --no-cache
docker compose up -d
```

## Data persistence

All your data is stored in the `docker-data/` directory:

- **Database**: `cellar.db` in `docker-data/data/`. While Cellar runs, SQLite keeps the latest
  changes in `cellar.db-wal` and `cellar.db-shm` next to it, so a copy of `cellar.db` alone can miss
  them: stop Cellar first (see [Backup](#backup)), or use a backup made from the admin page.
- **Backups and exports**: `docker-data/data/cellar-backup-*.zip` and
  `docker-data/data/cellar-export-*`
- **Images**: `docker-data/uploads/wines/`

This data persists when you stop, remove or rebuild the container.

## Backup

The **Backups** tab of the admin page makes backups while Cellar runs: **Full Backup**, under
**Backup & Restore**, creates one on demand, and the automatic backup settings make them on a
schedule. Each backup is a zip holding a copy of the database and the images, kept in
`docker-data/data/`.

Restoring a backup from the admin page refuses one made by a newer version of Cellar, or by a
version older than a mandatory stop that this version passed: the message names the version to
restore it with. A restore keeps what belongs to this installation rather than to the data: the
access code, the automatic backup settings and the cron token, so that automatic backups go on as
before, the MCP token and its write option, so that the assistant keeps its access, and for each barcode prefix the higher last number given, so that new labels never repeat
a number printed since the backup. The upgrade actions of this installation stay too, and those of
the versions between the backup's and this one are added to them, marked "may already be done",
since some concern the data, such as labels to print again: tick the ones you have already taken.

A restore or an import from the admin page takes a zip of up to 2 GiB once uncompressed and 10,000
files. Cellar still writes a larger backup, which holds all the data, and warns about it: the admin
page when you create it, the logs for an automatic backup. To restore such a backup by hand, stop
the container, extract the zip, put its `cellar.db` in place of the one in `docker-data/data/`
(deleting `cellar.db-wal` and `cellar.db-shm` next to it) and the files of its `images/` folder in
`docker-data/uploads/wines/`, give them the owner that [Data ownership](#data-ownership) describes,
and start the container. The database then keeps the access code and the settings of the backup.

### Automatic backups

In the automatic backup settings, choose how often to back up and how many automatic backups to
keep; Cellar keeps that many backups and as many exports, and deletes older ones. Changes apply as
soon as you save them. The backup mode decides what starts each backup:

- **Internal Scheduler**: Cellar itself, at the chosen interval.
- **External Cron Job**: a cron job on your server, for example to back up at a fixed time of day.
  Select this mode, click **Generate token**, and copy the command that Cellar shows: the token is
  shown only once. The command looks like this:

  ```bash
  curl -fsS -X POST -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' http://192.168.1.20:3005/api/admin/auto-backup
  ```

  Use the address the server running the cron job reaches Cellar at. Keep the `Content-Type`
  header: without it, Cellar refuses the request (403). For a backup every day at 3 a.m., add this
  line to the crontab (`crontab -e`):

  ```
  0 3 * * * curl -fsS -X POST -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' http://192.168.1.20:3005/api/admin/auto-backup
  ```

  The token only starts backups. Generating a new one replaces it: update the cron job then. A
  missing or wrong token gets 401, and a request while the mode is not **External Cron Job**, or
  while automatic backups are disabled, gets 409.

### Back up the folders

To back up all the data, stop the container so that the database is not written during the copy:

```bash
docker compose stop cellar
tar -czf cellar-docker-data-$(date +%Y%m%d).tar.gz docker-data/
docker compose start cellar
```

To restore, next to `docker-compose.yml`, stop the container and move the current folder aside,
so that files added since the backup do not stay mixed in. Then extract the archive as root, so
that the files keep the owners saved in it:

```bash
docker compose stop cellar
mv docker-data docker-data-old
sudo tar -xzpf cellar-docker-data-YYYYMMDD.tar.gz
docker compose start cellar
```

## Troubleshooting

### Container won't start

- Check if host port 3005 is already in use: `netstat -an | grep 3005` (the container listens
  on 3000, which `docker-compose.yml` publishes on 3005)
- Check Docker logs: `docker compose logs cellar`
- If the logs say that Cellar cannot write to some folders or files, give them to the container
  user: see [Data ownership](#data-ownership)
- If the logs say `Invalid ORIGIN`, `ORIGIN` lacks its `http://` or `https://`; see
  [Application URL (ORIGIN)](#application-url-origin)
- If the logs say that the update skips a mandatory stop, install the version they name first,
  start it once, then install the new version again.
- If the logs say that the database comes from a newer version, the image is older than the one
  that last used the database: start that version again, or restore a backup made before the
  upgrade.
- If the logs say `Database migration failed, nothing was applied`, Cellar stops: the database is
  as the previous version left it, so that version still runs on it. Report the problem with the
  message, which names the migrations that were pending.
- If the logs say that some reference data could not be seeded, Cellar runs without the lists that
  the files it names in `csv-imports` fill (wine types, appellations…); the other files and the
  default settings are imported. Fix those files, or delete them to get the defaults back, then
  restart: the seeding runs again.

### Saving fails with "Cross-site POST ... forbidden" (403)

- The URL in the browser does not match `ORIGIN`; see [Application URL (ORIGIN)](#application-url-origin)
- Check the value seen by the container: `docker compose exec cellar printenv ORIGIN`
- In reverse-proxy mode (`PROTOCOL_HEADER`/`HOST_HEADER`), you are probably bypassing the proxy
  by opening `http://<NAS-IP>:3005` directly; go through the proxy URL instead
- From a script, send `Origin` with every write; a write with a JSON body can send
  `Content-Type: application/json` instead, an upload cannot. See
  [Application URL (ORIGIN)](#application-url-origin)

### Saving fails with "permission denied" or "readonly database"

- The data folders do not belong to the user the container runs as; see
  [Data ownership](#data-ownership). Cellar checks this when it starts, so some files changed
  owner while it was running: restart it to list them.
- Check the owners (numeric ids): `ls -lnR docker-data/ | head`

## Custom configuration

### Change the port

Edit `docker-compose.yml` and modify the ports section:

```yaml
ports:
  - '8080:3000' # Access via http://localhost:8080
```

Update `ORIGIN` in `.env` to the new port as well (e.g. `ORIGIN=http://localhost:8080`).

### Environment variables

`docker-compose.yml` sets these, in `environment:`:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - HOST=0.0.0.0
  - ORIGIN=${ORIGIN:?...} # required, see "Application URL (ORIGIN)"
```

Keep `PORT` at `3000`: the health check and the port mapping use it. Other useful variables:

- `PROTOCOL_HEADER` and `HOST_HEADER`: see [Behind a reverse proxy](#behind-a-reverse-proxy);
- `ADDRESS_HEADER` and `XFF_DEPTH`: see
  [Client addresses behind a reverse proxy](#client-addresses-behind-a-reverse-proxy);
- `BODY_SIZE_LIMIT`: the largest request the server accepts, which the image sets to `512M`,
  above the 500 MB that restore and the ZIP imports accept;
- `DEBUG=csv-import`: logs what the CSV import did with each file, and how long it took.

## Scripts and the API

Your own scripts can read and change the cellar through the HTTP API that the app uses.
[docs/API.md](docs/API.md) describes each route, and how a script logs in with the access code,
which `Origin` header it sends, the error format and the size limits.

## AI assistants (MCP)

An AI assistant can read your cellar through Cellar's MCP server: « what goes with a roast chicken
tonight? », « how many Burgundies are left? », « what did we drink this month? ». It finds wines,
shows a wine with its bottles and where they are, finds a bottle by its barcode, lists the bottles
of the whole cellar by availability and by the day they were drunk or bought, and gives the
statistics, the wines to buy again, the wishlist and the free space in storage.
[docs/API.md](docs/API.md#mcp-access) lists the tools.

When you allow changes, it can also write, as you would in the app: « I just bought six bottles of
this Chablis, put them in rack B », « we drank the 2015 Margaux tonight, with the lamb ». It adds a
wine and its bottles, marks bottles drunk with the day and a note, takes bottles out of the cellar
and puts them back in a case (which also undoes a « drunk » made by mistake), moves bottles to
another case, changes a wine (its target quantity, description, producer…), the fields of bottles
(price, value, vintage, optimum, barcode…) and their notes, rates a wine, adds wishes to the
wishlist, changes their quantity or note and removes them, and deletes bottles added by mistake, a
change it announces as one that cannot be undone. It never reaches the admin: backups, restore,
wipe, imports and the access code stay in the app. Most assistants ask you before each change;
during a restore or an import, a change is refused until it ends.

1. In Cellar, open Admin › Settings › MCP access and create the token. Copy it: it is shown once.
   It is read-only unless you allow changes there.
2. Give the assistant the address `http://<NAS-IP>:3005/mcp` (your `ORIGIN` followed by `/mcp`) and
   the header `Authorization: Bearer <token>`.

With Claude Code:

```bash
claude mcp add --transport http cellar http://192.168.1.20:3005/mcp \
  --header "Authorization: Bearer <token>"
```

A desktop app or a local-model client that takes a JSON file for its MCP servers usually reads this
form; the name of each field depends on the app (`type` may be `streamable-http`, for example), so
check its documentation:

```json
{
  "mcpServers": {
    "cellar": {
      "type": "http",
      "url": "http://192.168.1.20:3005/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

Behind a reverse proxy, the address is that of the proxy, such as
`https://cellar.example.com/mcp`, and the proxy must pass the answers of `/mcp` as they come: see
[docs/reverse-proxy.md](docs/reverse-proxy.md).

The server speaks Streamable HTTP, without sessions, in the revisions of the protocol from
2024-11-05 to 2026-07-28. An app that only starts local (stdio) servers needs a bridge to HTTP.

**Limit: local network or VPN only.** Cellar is meant for your home network, and so is its MCP
server: an assistant that runs on your network (a local model, a command-line tool, a desktop app)
reaches it, but an assistant that calls from the internet does not. Do not publish Cellar on the
internet to get there; use a VPN to your network instead.

This is why the custom connectors of the Claude apps (on the web, on a phone, and the connectors of
the desktop app) cannot reach it: they call from the internet and expect OAuth sign-in, which
Cellar does not offer. Use Claude Code, or another client that runs on your network and sends the
token header, as above; for Claude Desktop, a local bridge such as `mcp-remote` started from its
configuration file.

## Health check

The container includes a health check that requests the home page every 30 seconds. You can check
the health status with:

```bash
docker compose ps
```

## Security notes

- The application runs as the unprivileged `node` user (uid 1000) inside the container: in
  `/app`, it can only write to the mounted data folders, not to its own code
- The container only listens on port 3000, which `docker-compose.yml` publishes on host port 3005

## Support

If you encounter any issues, please check the logs first:

```bash
docker compose logs -f cellar
```

Then report it in the [issues](https://github.com/Lulu300/cellar/issues), with the version that the
admin page shows, what you did and what you saw, and the log lines around it. Never post your access
code, setup token, cron token or backups: they give access to your cellar.
