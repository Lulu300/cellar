# Cellar HTTP API

This document describes the HTTP API under `/api`, for people who write scripts against their own
Cellar. The pages of the app load their data on the server, then their forms and dialogs read and
change data through this API; the wine and bottle forms post to the form actions of `/wines`
instead, which are not part of this API. Some routes serve no page: they are here for scripts.

A change that requires your scripts to change is described in the release notes of its version; some
are also shown as an upgrade action in the Admin page.

The examples use `CELLAR=http://192.168.1.20:3005`: replace it with the URL you open Cellar at,
which is also the value of `ORIGIN` (see
[Application URL](../README-Docker.md#application-url-origin)).

## Conventions

- Request bodies are JSON, sent with `Content-Type: application/json`, except the uploads, which are
  `multipart/form-data` forms, or a raw zip for a restore or an import. Answers are JSON, except the
  downloads (CSV, PDF, ZIP).
- Ids are strings. Send them as the API returned them.
- In answers, dates and timestamps are ISO 8601 strings in UTC (`2026-10-17T15:06:10.000Z`). In
  request bodies, a date field takes a date string (`2026-10-17` or a full ISO timestamp) or a
  number of milliseconds since 1970; an empty string or `null` clears it.
- In request bodies, names and optional texts are trimmed, and an optional text or id that is empty
  is stored as `null`.
- A `GET` route also answers `HEAD`.
- Every answer of the app, static files and error pages included, carries
  `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`: no web page can show
  Cellar in a frame.
- The JSON examples may leave fields out: the text of each section lists them.

## Authentication

Reading is public: every `GET` outside `/api/admin` works without logging in. Every other method,
and every route under `/api/admin`, `GET` included, needs a session. A request that needs one and
has none gets `401 unauthenticated`. The [route index](#route-index) gives the rule for each route.

A script gets a session the way the login dialog does: it posts the access code to
`POST /api/access-code`, and keeps the `cellar_session` cookie of the answer.

```bash
# Log in: the answer is {"valid":true}, and the cookie goes into cookies.txt.
curl -fsS -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"code":"your access code"}' "$CELLAR/api/access-code"

# Use the session.
curl -fsS -b cookies.txt -H 'Content-Type: application/json' \
  -X PATCH -d '{"notes":"Open with the cheese"}' "$CELLAR/api/bottles/<bottle id>"

# Log out.
curl -fsS -b cookies.txt -H "Origin: $CELLAR" -X DELETE "$CELLAR/api/session"
```

- A wrong code answers `200` with `{"valid":false}` and no cookie. Wrong codes are limited per
  client address: past the limit, the answer is `429 too_many_attempts`, with a `Retry-After` header
  (see [Access code](../README-Docker.md#access-code)).
- A session lasts the session timeout set in Admin › Settings (24 hours by default, 1 to 168),
  counted from the login: a new timeout applies from the next login. The cookie is `HttpOnly` and
  `SameSite=Lax`, and `Secure` when Cellar is reached over HTTPS.
- Changing the access code ends every other session, and so does restoring a backup.
- The cron job of the automatic backups does not log in: it sends the token generated in Admin ›
  Backups as `Authorization: Bearer <token>`. That token opens
  [`POST /api/admin/auto-backup`](#post-apiadminauto-backup) only.

## Origin check

Cellar refuses write requests (`POST`, `PUT`, `PATCH`, `DELETE`) that another web site could have
sent, with two checks:

- A write whose `Origin` header differs from Cellar's URL (`ORIGIN`, or the URL that the proxy
  headers give when `ORIGIN` is not set) gets `403 cross_site_request`. A request without an
  `Origin` header passes this check.
- A write without a `Content-Type` header, or with a form one (`multipart/form-data`,
  `application/x-www-form-urlencoded` or `text/plain`), must carry an `Origin` header equal to
  Cellar's URL. Otherwise SvelteKit answers `403` with the text
  `Cross-site <METHOD> form submissions are forbidden` (as `{"message": …}` when the request sends
  `Accept: application/json`), not the error format below.

So a request sent with `Content-Type: application/json` needs no `Origin` header, even without a
body, but a form upload (`multipart/form-data`) does, and so does a `DELETE` sent without a
`Content-Type`. The simplest rule for a script: send `Origin: $CELLAR` with every write.

## Errors

Every error that a route answers has this body:

```json
{
  "error": {
    "code": "case_full",
    "message": "Case A1 would hold 13 bottles in the cellar, for a capacity of 12",
    "details": { "caseName": "A1", "capacity": 12, "bottles": 13 }
  }
}
```

- `code` is stable and meant for scripts. Each route below lists the codes it may answer besides the
  common ones.
- `message` is in English, for logs and people; it may change.
- `details` is there only for some codes, which describe it.

The common errors, which any route may answer:

| Status | Code                 | When                                                                                                                                                                |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `malformed_body`     | The body is not valid JSON, not a valid form for an upload, or could not be read to its end; or its `Content-Type` is not one the route takes.                      |
| 401    | `unauthenticated`    | The route needs a session and the request has none, or it has expired.                                                                                              |
| 403    | `cross_site_request` | The `Origin` header is not Cellar's URL (see [Origin check](#origin-check)).                                                                                        |
| 404    | `not_found`          | The id in the path, or an id the body names, does not exist; or the path matches no route.                                                                          |
| 405    | `method_not_allowed` | The route does not have this method; the `Allow` header lists those it has.                                                                                         |
| 409    | `missing_reference`  | A write points at a row that does not exist (a wine, a format, a case…).                                                                                            |
| 409    | `in_use`             | A delete is refused because other rows still use the row.                                                                                                           |
| 413    | `body_too_large`     | The body is over the limit of the route (see [Size limits](#size-limits)).                                                                                          |
| 422    | `invalid_body`       | The body breaks a rule. `details` lists each problem as `{ "path", "message" }`, where `path` is the field as a dotted path (`cases.2`), empty for the body itself. |
| 500    | `internal_error`     | An unexpected error; the server log has the details.                                                                                                                |
| 503    | `writes_held`        | A restore, a JSON import or a wipe is running. Writes are refused until it ends: retry after the `Retry-After` header (10 seconds). Reads still work.               |

A path under `/api` that matches no route answers `404 not_found`, and a method that a route does
not have answers `405 method_not_allowed`, with an `Allow` header that lists the methods it has. A
write is checked for a session first, so without one both answer `401`.

Only the `403` of SvelteKit's origin check, described above, does not use this format: it comes from
the server before Cellar's code runs.

## Size limits

| What                                                                                                                                       | Limit                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A JSON body                                                                                                                                | 1 MB                                                                                                                                                                                                                                                 |
| A wine image, `POST /api/upload/image`                                                                                                     | 20 MB for the image file; the form around it gets 64 KB more                                                                                                                                                                                         |
| A CSV import, `POST /api/admin/import-csv` (all files of the request)                                                                      | 50 MB                                                                                                                                                                                                                                                |
| A ZIP or a batch of images: `POST /api/admin/restore`, `/api/admin/import-json`, `/api/admin/import-images-zip`, `/api/admin/upload-image` | 500 MB per request; a ZIP may hold 2 GB once uncompressed; 20 MB per image for `upload-image`. A backup that restore or import-json read by its file name is not uploaded, and has only the limits of a ZIP (2 GB once uncompressed, 10,000 entries) |
| Any request (`BODY_SIZE_LIMIT`, set by the Docker image)                                                                                   | 512 MB                                                                                                                                                                                                                                               |

A body over a limit gets `413 body_too_large`, before the server reads it when the request sends a
`Content-Length` header; `upload-image` reports an image over 20 MB in its `failed` list instead.
The limit of a multipart form is that of its files and fields: the request may hold 64 KB more, for
the boundaries and headers of its parts.
Some routes also limit how many rows one request handles: their sections say so.

## Removed routes

- `PUT /api/bottles/{id}` answers `405`: it replaced every field of the bottle, so a field left
  out of the body was cleared. Use [`PATCH /api/bottles/{id}`](#patch-apibottlesid), which changes
  only the fields it is given.
- `POST /api/wines` and `GET` or `PUT /api/wines/{id}` (use `/api/definitions`),
  `GET /api/admin/auto-backup` (use `GET /api/admin/backup-settings`),
  `POST /api/admin/restore-label-presets`, `seed-manufacturer-presets` and `cleanup-csv`, and the
  reference tables under `/api/admin/<table>` (use [`/api/{table}`](#reference-tables)) are gone.

## Route index

Every route and method of the API. A test, `src/routes/api/api-doc.test.ts`, checks this table
against the routes of the code and the session rule of the server. "Session" says whether the
request needs one.

| Method | Path                               | Session                  |
| ------ | ---------------------------------- | ------------------------ |
| GET    | `/api/access-code`                 | no                       |
| POST   | `/api/access-code`                 | no                       |
| PUT    | `/api/access-code`                 | yes                      |
| POST   | `/api/admin/auto-backup`           | yes, or the backup token |
| GET    | `/api/admin/backup-settings`       | yes                      |
| PUT    | `/api/admin/backup-settings`       | yes                      |
| POST   | `/api/admin/backup-token`          | yes                      |
| GET    | `/api/admin/barcode-settings`      | yes                      |
| PUT    | `/api/admin/barcode-settings`      | yes                      |
| POST   | `/api/admin/create-backup`         | yes                      |
| POST   | `/api/admin/create-export`         | yes                      |
| DELETE | `/api/admin/delete-backup`         | yes                      |
| GET    | `/api/admin/download-backup`       | yes                      |
| POST   | `/api/admin/download-images`       | yes                      |
| POST   | `/api/admin/export-csv`            | yes                      |
| DELETE | `/api/admin/images`                | yes                      |
| GET    | `/api/admin/images`                | yes                      |
| PUT    | `/api/admin/images`                | yes                      |
| POST   | `/api/admin/import-csv`            | yes                      |
| POST   | `/api/admin/import-images-zip`     | yes                      |
| POST   | `/api/admin/import-json`           | yes                      |
| GET    | `/api/admin/label-presets`         | yes                      |
| POST   | `/api/admin/label-presets`         | yes                      |
| DELETE | `/api/admin/label-presets/{id}`    | yes                      |
| GET    | `/api/admin/label-presets/{id}`    | yes                      |
| PUT    | `/api/admin/label-presets/{id}`    | yes                      |
| GET    | `/api/admin/list-backups`          | yes                      |
| GET    | `/api/admin/next-barcode`          | yes                      |
| POST   | `/api/admin/restore`               | yes                      |
| PUT    | `/api/admin/upgrade-actions`       | yes                      |
| POST   | `/api/admin/upload-image`          | yes                      |
| GET    | `/api/admin/wine-bottles`          | yes                      |
| DELETE | `/api/admin/wine-bottles/{id}`     | yes                      |
| GET    | `/api/admin/wine-definitions`      | yes                      |
| DELETE | `/api/admin/wine-definitions/{id}` | yes                      |
| POST   | `/api/admin/wipe-database`         | yes                      |
| GET    | `/api/appellations`                | no                       |
| POST   | `/api/appellations`                | yes                      |
| DELETE | `/api/appellations/{id}`           | yes                      |
| PUT    | `/api/appellations/{id}`           | yes                      |
| POST   | `/api/barcode/csv`                 | yes                      |
| GET    | `/api/barcode/export-all`          | no                       |
| GET    | `/api/barcode/export-manual`       | no                       |
| POST   | `/api/barcode/pdf-labels`          | yes                      |
| GET    | `/api/barcode/stats`               | no                       |
| GET    | `/api/barcode/stats-manual`        | no                       |
| GET    | `/api/bottles`                     | no                       |
| PATCH  | `/api/bottles`                     | yes                      |
| POST   | `/api/bottles`                     | yes                      |
| DELETE | `/api/bottles/{id}`                | yes                      |
| PATCH  | `/api/bottles/{id}`                | yes                      |
| GET    | `/api/bottles/non-consumed`        | no                       |
| GET    | `/api/countries`                   | no                       |
| POST   | `/api/countries`                   | yes                      |
| DELETE | `/api/countries/{id}`              | yes                      |
| PUT    | `/api/countries/{id}`              | yes                      |
| GET    | `/api/definitions`                 | no                       |
| POST   | `/api/definitions`                 | yes                      |
| DELETE | `/api/definitions/{id}`            | yes                      |
| GET    | `/api/definitions/{id}`            | no                       |
| PUT    | `/api/definitions/{id}`            | yes                      |
| GET    | `/api/images`                      | no                       |
| GET    | `/api/origins`                     | no                       |
| POST   | `/api/origins`                     | yes                      |
| DELETE | `/api/origins/{id}`                | yes                      |
| PUT    | `/api/origins/{id}`                | yes                      |
| GET    | `/api/regions`                     | no                       |
| POST   | `/api/regions`                     | yes                      |
| DELETE | `/api/regions/{id}`                | yes                      |
| PUT    | `/api/regions/{id}`                | yes                      |
| DELETE | `/api/session`                     | yes                      |
| GET    | `/api/session`                     | no                       |
| GET    | `/api/settings`                    | no                       |
| PUT    | `/api/settings`                    | yes                      |
| GET    | `/api/statistics`                  | no                       |
| GET    | `/api/storage-cases`               | no                       |
| DELETE | `/api/storage-cases/{id}`          | yes                      |
| GET    | `/api/storage-cases/{id}/capacity` | no                       |
| GET    | `/api/storage-containers`          | no                       |
| POST   | `/api/storage-containers`          | yes                      |
| DELETE | `/api/storage-containers/{id}`     | yes                      |
| PUT    | `/api/storage-containers/{id}`     | yes                      |
| GET    | `/api/storage-occupancy`           | no                       |
| POST   | `/api/upload/image`                | yes                      |
| GET    | `/api/wine-classifications`        | no                       |
| POST   | `/api/wine-classifications`        | yes                      |
| DELETE | `/api/wine-classifications/{id}`   | yes                      |
| PUT    | `/api/wine-classifications/{id}`   | yes                      |
| GET    | `/api/wine-colors`                 | no                       |
| POST   | `/api/wine-colors`                 | yes                      |
| DELETE | `/api/wine-colors/{id}`            | yes                      |
| PUT    | `/api/wine-colors/{id}`            | yes                      |
| GET    | `/api/wine-formats`                | no                       |
| POST   | `/api/wine-formats`                | yes                      |
| DELETE | `/api/wine-formats/{id}`           | yes                      |
| PUT    | `/api/wine-formats/{id}`           | yes                      |
| GET    | `/api/wine-shortage`               | no                       |
| GET    | `/api/wine-types`                  | no                       |
| POST   | `/api/wine-types`                  | yes                      |
| DELETE | `/api/wine-types/{id}`             | yes                      |
| PUT    | `/api/wine-types/{id}`             | yes                      |
| GET    | `/api/wines`                       | no                       |
| GET    | `/api/wines/{id}/locations`        | no                       |

## Session and access code

The access code protects every write. Until one is set, the first person who chooses it must also
give the setup token, which only the server logs show. Attempts at a secret (a login code, a setup
token, the current code of a code change) are limited per client address, IPv6 addresses by their
`/64`: at most 5 in any 60 seconds, and about 4 an hour after a long run of mistakes. Past the
limit, the request gets `429 too_many_attempts`, with a `Retry-After` header and `details`
`{ "retryAfter": <seconds> }`, even when the secret is right. A right code clears the client's
earlier mistakes. The counts live in memory, and a restart resets them.

### `GET /api/access-code`

Tells whether an access code is set, so that a client knows whether to log in or to choose the first
code.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with `{ "exists": true }` or `{ "exists": false }`. While no code is set, the
  server also writes the setup token to its logs (at most once a minute).
- **Errors:** none besides the common ones.

### `POST /api/access-code`

Logs in with the access code, or, on a fresh install, chooses the first access code and logs in.

- **Session:** not needed.
- **Body:** a JSON object, in one of two forms. A body with a `newCode` key is read as the second
  form.
  - Login: `code`: string, required, 1-256 characters.
  - First code: `newCode`: string, required, 4-256 characters; `setupToken`: string, required, 1-64
    characters, as the server logs print it (`7KQ4-MZ2X-H9TD`). The token is compared without case,
    spaces or dashes.
- **Response:** `200` with `{ "valid": true }` and a `Set-Cookie` header for the `cellar_session`
  cookie (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when Cellar is reached over HTTPS, expiring
  after the session timeout of [`GET /api/settings`](#get-apisettings)). A wrong login code answers
  `200` with `{ "valid": false }` and no cookie; so does any login while no code is set. Choosing
  the first code also ends every other session.
- **Errors:**
  - `403 wrong_setup_token` when the setup token is wrong (first code only).
  - `409 access_code_already_set` when a first code is sent but a code is already set. This is
    checked before the attempt limit, and the attempt is not counted.
  - `429 too_many_attempts` when the client is past the attempt limit (see above), with
    `Retry-After`.
  - `422 invalid_body` also when the body is not a JSON object.

```json
{ "code": "your access code" }
```

```json
{ "newCode": "your new code", "setupToken": "7KQ4-MZ2X-H9TD" }
```

### `PUT /api/access-code`

Changes the access code. Every other session ends; the caller's session stays open.

- **Session:** required.
- **Body:** JSON:
  - `currentCode`: string, required, 1-256 characters.
  - `newCode`: string, required, 4-256 characters.
- **Response:** `204`, without a body. It is the one settings `PUT` that does not return what it
  saved: the stored value is a secret, which the API never gives back.
- **Errors:**
  - `403 wrong_access_code` when `currentCode` is wrong (403, not 401: the session is still valid).
  - `429 too_many_attempts` when the client is past the attempt limit, with `Retry-After`. Each try
    of `currentCode` counts as an attempt, as a login does.

```json
{ "currentCode": "old code", "newCode": "new code" }
```

### `GET /api/session`

Tells whether the request carries a valid session.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with `{ "authenticated": true }` or `{ "authenticated": false }`. An expired
  session counts as none.
- **Errors:** none besides the common ones.

### `DELETE /api/session`

Logs out: ends the session on the server and clears the cookie.

- **Session:** required.
- **Body:** none. As for any write without a body, send the `Origin` header.
- **Response:** `204` with no body, and a `Set-Cookie` header that clears `cellar_session`.
- **Errors:** none besides the common ones.

## Settings

### `GET /api/settings`

Reads the application settings.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with `{ "sessionTimeoutHours": 24 }`: how long a session lasts, in hours, from
  its login. It reads `24` when the setting was never saved, or holds an invalid value.
- **Errors:** none besides the common ones.

### `PUT /api/settings`

Saves the application settings.

- **Session:** required.
- **Body:** JSON:
  - `sessionTimeoutHours`: integer 1-168, required. It applies from the next login: open sessions
    keep their expiry.
- **Response:** `200` with the settings as saved, as
  [`GET /api/settings`](#get-apisettings) gives them.
- **Errors:** none besides the common ones.

```json
{ "sessionTimeoutHours": 72 }
```

## Wines

A wine (a "definition" in the API) is a wine as a label names it: its name, producer, appellation,
type and color. The bottles of the cellar each belong to one wine.

#### Wine fields

The body of `POST /api/definitions` and `PUT /api/definitions/{id}`. Fields the API does not know,
such as `id` or `createdAt`, are ignored.

- `name`: string, required, 1-500 characters.
- `producer`: string, optional, at most 500 characters.
- `appellationId`: id of an appellation, required.
- `typeId`: id of a wine type, required.
- `colorId`: id of a wine color, required.
- `classificationId`: id of a classification, optional.
- `rating`: number 1-5, optional; half points and other fractions are accepted.
- `website`: an `http://` or `https://` URL, optional, at most 2000 characters.
- `description`: string, optional, at most 5,000 characters, counted as UTF-16 units like
  JavaScript's `.length` (an emoji counts two); line breaks are stored as LF, so a CRLF counts as
  one character.
- `imageId`: id of an image (see [`POST /api/upload/image`](#post-apiuploadimage)), optional.
- `grapeVarieties`: array of strings, optional (leave it out or send `[]`; `null` answers `422`), at
  most 50 items of 1-100 characters each.
- `targetQuantity`: integer 0-10,000, optional: the number of bottles to keep in the cellar (see
  [`GET /api/wine-shortage`](#get-apiwine-shortage)).

An id that points at no row answers `409 missing_reference`.

### `GET /api/wines`

Lists every wine with its bottles, consumed ones included. The wine list of the app loads the same
entries with only the bottles still owned.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with an array, one entry per wine, in no particular order. Each entry has two
  fields:
  - `definition`: the wine, with its [wine fields](#wine-fields), `id`, `createdAt`, `updatedAt`,
    the names `type` and `color`, the nested `appellation` (with its `region`, and the region's
    `country`), and the flat names `appellationName`, `region` and `country`. `classification`,
    `website` and `description` are left out when empty.
  - `bottles`: every bottle of the wine, whatever its availability, each as
    [`GET /api/bottles`](#get-apibottles) lists it but without its wine (`definition`), which the
    entry already gives. A wine without bottles has `bottles: []`.

  In older versions, each entry also spread the fields of the wine's first bottle at its top level
  (a wine without bottles had the virtual id `def-<wine id>`), and each bottle repeated the wine in
  `definition`.

- **Errors:** none besides the common ones.

```json
[
  {
    "definition": {
      "id": "margaux",
      "name": "Château Margaux",
      "type": "Still",
      "color": "Red",
      "appellationName": "Margaux",
      "region": "Bordeaux",
      "country": "France"
    },
    "bottles": [
      { "id": "1b2a0a28-…", "vintage": 2015, "format": "Bottle", "availability": "available" },
      { "id": "6932f22d-…", "vintage": 2015, "format": "Bottle", "availability": "consumed" }
    ]
  },
  {
    "definition": { "id": "f170064d-…", "name": "Pavie" },
    "bottles": []
  }
]
```

### `GET /api/wines/{id}/locations`

Tells where the bottles of a wine are: the cases that hold its available bottles.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with `{ "definitionId", "locations", "totalBottles" }`. `locations` has one
  entry per case that holds an available bottle of the wine, in the order of the storage page:
  `container` (its name), `case` (its name), `caseId`, `count` (bottles of this wine in the case),
  `capacity`, and `totalBottlesInCase` (available bottles of any wine in the case). `totalBottles`
  is the sum of the counts. Bottles in no case, and bottles that are not `available`, are left out.
- **Errors:** `404 not_found` when the wine does not exist.

```json
{
  "definitionId": "margaux",
  "locations": [
    {
      "container": "A",
      "case": "A1",
      "caseId": "5da8a7f8-…",
      "count": 2,
      "capacity": 6,
      "totalBottlesInCase": 2
    },
    {
      "container": "A",
      "case": "A2",
      "caseId": "0c41e2b9-…",
      "count": 1,
      "capacity": 4,
      "totalBottlesInCase": 1
    }
  ],
  "totalBottles": 3
}
```

### `GET /api/definitions`

Lists every wine, without its bottles.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with an array of wines, in no particular order. Each has its
  [wine fields](#wine-fields) (empty ones as `null`, `grapeVarieties` as `[]`), `id`, `createdAt`,
  `updatedAt`, the names `type`, `color` and `classification` (`null` when none), the nested
  `appellation` (with its `region`, and the region's `country`), and the flat names
  `appellationName`, `region` and `country`.
- **Errors:** none besides the common ones.

```json
[
  {
    "id": "margaux",
    "name": "Château Margaux",
    "producer": null,
    "appellationId": "mgx",
    "typeId": "still",
    "colorId": "red",
    "classificationId": null,
    "rating": null,
    "grapeVarieties": [],
    "targetQuantity": 6,
    "type": "Still",
    "color": "Red",
    "classification": null,
    "appellation": {
      "id": "mgx",
      "name": "Margaux",
      "regionId": "bdx",
      "region": {
        "id": "bdx",
        "name": "Bordeaux",
        "countryId": "fr",
        "country": { "id": "fr", "name": "France" }
      }
    },
    "appellationName": "Margaux",
    "region": "Bordeaux",
    "country": "France",
    "createdAt": "2026-10-17T15:07:30.000Z",
    "updatedAt": "2026-10-17T15:07:30.000Z"
  }
]
```

### `POST /api/definitions`

Creates a wine.

- **Session:** required.
- **Body:** JSON, the [wine fields](#wine-fields).
- **Response:** `201` with the wine as saved: its [wine fields](#wine-fields) (empty ones as
  `null`), `id`, `createdAt` and `updatedAt`, without the names of its references.
- **Errors:** none besides the common ones.

```json
{
  "name": "Château Pavie",
  "producer": "Perse",
  "appellationId": "mgx",
  "typeId": "still",
  "colorId": "red",
  "rating": 4.5,
  "grapeVarieties": ["Merlot", "Cabernet Franc"]
}
```

### `GET /api/definitions/{id}`

Reads one wine, with the names of its references and its location.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with the wine as [`GET /api/definitions`](#get-apidefinitions) lists it,
  without the flat `appellationName`, `region` and `country`. Older versions also gave the rows of
  its location flat, as `appellations`, `regions` and `countries`: read them in `appellation`.
- **Errors:** `404 not_found` when the wine does not exist.

### `PUT /api/definitions/{id}`

Replaces every field of a wine.

- **Session:** required.
- **Body:** JSON, the [wine fields](#wine-fields). An optional field left out is cleared, as `null`
  (or `[]` for `grapeVarieties`): send the whole wine.
- **Response:** `200` with the wine as saved, as [`POST /api/definitions`](#post-apidefinitions)
  answers it.
- **Errors:** `404 not_found` when the wine does not exist.

### `DELETE /api/definitions/{id}`

Deletes a wine that has no bottles.

- **Session:** required.
- **Body:** none. Send the `Origin` header.
- **Response:** `204` with no body.
- **Errors:** `404 not_found` when the wine does not exist; `409 in_use` while bottles of the wine
  exist, consumed ones included, with `details.bottleCount`, their number.
  [`DELETE /api/admin/wine-definitions/{id}`](#delete-apiadminwine-definitionsid) deletes a wine
  with its bottles when given `?cascade=true`.

## Bottles

#### Bottle fields

The fields of a bottle in the body of `POST /api/bottles`, `PATCH /api/bottles` and
`PATCH /api/bottles/{id}`:

- `definitionId`: id of the wine, required on `POST`.
- `formatId`: id of a format (`GET /api/wine-formats`), required on `POST`.
- `originId`: id of an origin (`GET /api/origins`), optional.
- `vintage`: integer 0-9999, optional; `0` means no vintage and is stored as `null`.
- `optimum`: integer 0-9999, optional: the year the bottle is at its best.
- `purchasePrice`: number, 0 or more, optional; a negative one answers `422 invalid_body`.
- `purchaseDate`: date, optional.
- `currentValue`: number, 0 or more, optional; a negative one answers `422 invalid_body`.
- `currentValueDate`: date, optional.
- `storageCaseId`: id of a storage case, optional.
- `notes`: string, optional, at most 5,000 characters, counted as UTF-16 units like JavaScript's
  `.length` (an emoji counts two); line breaks are stored as LF, so a CRLF counts as one character.
- `barcode`: string of at most 1000 characters, or a number, optional. Stored as trimmed text; a
  blank barcode is stored as `null`. Two bottles cannot have the same barcode.
- `availability`: `available`, `out_of_cellar` or `consumed`; `available` by default on `POST`.
- `consumedDate`: date, optional.

Two rules apply on every write: a `consumed` bottle is in no case (`storageCaseId` becomes `null`),
and only a `consumed` bottle keeps a `consumedDate` (it becomes `null` otherwise). A write that
leaves a case with more `available` bottles over its capacity than before is refused with
`409 case_full`; a case already over its capacity, after an import for example, still takes the
writes that do not add to it.

A bottle in an answer has every field above, all present (`null` when empty), plus `id`,
`createdAt`, `updatedAt`, and `format`, the name of its format.

### `GET /api/bottles`

Lists every bottle, whatever its availability, with its wine, format, case and origin.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with an array of bottles, in no particular order. Each has its
  [bottle fields](#bottle-fields), and:
  - `storageCase`: the case (`id`, `name`, `capacity`, `containerId`, `position`, `createdAt`,
    `updatedAt`) with its `container` (`id`, `name`, `parentContainerId`, `createdAt`, `updatedAt`),
    or `null`;
  - `definition`: the wine, with its [wine fields](#wine-fields), `id`, `createdAt`, `updatedAt` and
    the names `type`, `color` and `classification`, but not its location;
  - `origin`: `{ "id", "name", "createdAt" }`, or `null`.
- **Errors:** none besides the common ones.

```json
[
  {
    "id": "1b2a0a28-1ead-4a9a-897f-20d663868522",
    "definitionId": "margaux",
    "vintage": 2015,
    "optimum": null,
    "formatId": "bottle",
    "format": "Bottle",
    "originId": null,
    "barcode": "CELLAR0001",
    "purchasePrice": 45,
    "purchaseDate": "2024-03-01T00:00:00.000Z",
    "storageCaseId": "5da8a7f8-…",
    "availability": "available",
    "consumedDate": null,
    "storageCase": {
      "id": "5da8a7f8-…",
      "name": "A1",
      "capacity": 6,
      "container": { "id": "0e94db48-…", "name": "A" }
    },
    "definition": {
      "id": "margaux",
      "name": "Château Margaux",
      "type": "Still",
      "color": "Red",
      "classification": null
    },
    "origin": null
  }
]
```

### `POST /api/bottles`

Creates one or more identical bottles of a wine, all or none.

- **Session:** required.
- **Body:** JSON, the [bottle fields](#bottle-fields), and:
  - `quantity`: integer 1-100, default 1: how many bottles to create.

  Fields the API does not know are ignored. A `barcode` can only be given with `quantity` 1, and
  the bottle keeps it, whatever the settings. Without one, when automatic barcodes are on (Admin ›
  Settings › Barcode Settings), each bottle gets the next barcode if it is `available`; a bottle
  created `out_of_cellar` or `consumed` gets none, and takes no number of the sequence.

- **Response:** `201` with `{ "bottles", "count" }`: the bottles created (see
  [bottle fields](#bottle-fields)) and their number.
- **Errors:**
  - `409 case_full` when the case would hold more available bottles than its capacity; `details` is
    `{ "caseName", "capacity", "bottles" }`.
  - `409 duplicate_barcode` when another bottle already has the barcode.
  - `409 barcode_range` when automatic barcodes have no number left under their prefix.
  - `409 barcode_prefix_too_long` when a bottle takes the next barcode and the configured prefix is
    longer than 6 characters (a prefix saved before prefixes were checked).
  - `422 barcode_for_one_bottle` when a barcode is given with a `quantity` over 1.

```json
{
  "definitionId": "margaux",
  "formatId": "bottle",
  "vintage": 2015,
  "purchasePrice": 45,
  "purchaseDate": "2024-03-01",
  "storageCaseId": "5da8a7f8-…",
  "quantity": 2
}
```

```json
{
  "bottles": [
    {
      "id": "1b2a0a28-…",
      "definitionId": "margaux",
      "vintage": 2015,
      "barcode": "CELLAR0001",
      "storageCaseId": "5da8a7f8-…",
      "availability": "available",
      "format": "Bottle"
    },
    {
      "id": "6932f22d-…",
      "definitionId": "margaux",
      "vintage": 2015,
      "barcode": "CELLAR0002",
      "storageCaseId": "5da8a7f8-…",
      "availability": "available",
      "format": "Bottle"
    }
  ],
  "count": 2
}
```

### `PATCH /api/bottles`

Applies the same changes to several bottles, all or none.

- **Session:** required.
- **Body:** JSON:
  - `ids`: array of 1-10,000 bottle ids, required. A repeated id counts once.
  - `changes`: object, required: any of the [bottle fields](#bottle-fields), each one given
    replacing the bottle's value; the fields left out keep theirs. `definitionId` and `formatId`
    cannot be `null`. A field the API does not know, in `changes` or beside it, answers `422`.
  - `addedNote`: string, optional, at most 5,000 characters, counted as UTF-16 units like
    JavaScript's `.length` (an emoji counts two), line breaks stored as LF: a note added to the
    notes of each bottle, on a new line after them, or as its notes when it has none; after
    the `notes` of `changes` when both are given. The app sends the note typed when consuming
    bottles this way, so that their own notes stay. A blank note adds nothing.
- **Response:** `200` with `{ "bottles": [...] }`: the bottles changed, each once, in the order of
  `ids` (see [bottle fields](#bottle-fields)).
- **Errors:**
  - `404 not_found` when some bottles do not exist; `details` is `{ "ids": [...] }`, the ids not
    found. No bottle is changed.
  - `409 case_full` when a case would hold more available bottles than its capacity; `details` as
    for `POST /api/bottles`.
  - `409 duplicate_barcode` when another bottle already has the barcode.
  - `422 barcode_for_one_bottle` when `changes` gives a barcode to more than one bottle.
  - `422 notes_too_long` when `addedNote` would make the notes of some bottles longer than 5,000
    characters, rather than cut them. `details` has `ids` (these bottles), `bottles` (their number)
    and `maximum` (5000). No bottle is changed.

```json
{
  "ids": ["1b2a0a28-…", "6932f22d-…"],
  "changes": { "availability": "consumed", "consumedDate": "2026-10-17" },
  "addedNote": "Drunk with Paul"
}
```

### `PATCH /api/bottles/{id}`

Changes some fields of one bottle.

- **Session:** required.
- **Body:** JSON: any of the [bottle fields](#bottle-fields), each one given replacing the bottle's
  value; the fields left out keep theirs. `definitionId` and `formatId` cannot be `null`. A field
  the API does not know answers `422`.
- **Response:** `200` with the bottle as saved (see [bottle fields](#bottle-fields)).
- **Errors:**
  - `404 not_found` when the bottle does not exist; `details` is `{ "ids": ["<id>"] }`.
  - `409 case_full` when its case would hold more available bottles than its capacity; `details` as
    for `POST /api/bottles`.
  - `409 duplicate_barcode` when another bottle already has the barcode.

```json
{ "notes": "Open with the cheese", "currentValue": 60, "currentValueDate": "2026-10-01" }
```

### `DELETE /api/bottles/{id}`

Deletes one bottle.

- **Session:** required.
- **Body:** none. Send the `Origin` header.
- **Response:** `204` with no body.
- **Errors:** `404 not_found` when the bottle does not exist.

### `GET /api/bottles/non-consumed`

Lists the bottles still owned (`available` or `out_of_cellar`), with what the bottle lists show of
them.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with an array, in no particular order, of bottles with these fields only:
  `id`, `vintage`, `optimum`, `formatId`, `format` (name), `purchasePrice`, `purchaseDate`,
  `currentValue`, `currentValueDate`, `originId`, `origin` (`{ "id", "name" }` or `null`),
  `barcode`, `notes`, `availability`, `definition`, the wine
  (`{ "id", "name", "producer", "appellation" }`, `appellation` being its name), and `storageCase`
  (`{ "id", "name" }` or `null`). It has no `storageCaseId` nor `consumedDate`.
- **Errors:** none besides the common ones.

```json
[
  {
    "id": "1b2a0a28-…",
    "vintage": 2015,
    "optimum": null,
    "formatId": "bottle",
    "format": "Bottle",
    "purchasePrice": 45,
    "purchaseDate": "2024-03-01T00:00:00.000Z",
    "currentValue": null,
    "currentValueDate": null,
    "originId": null,
    "origin": null,
    "barcode": "CELLAR0001",
    "notes": null,
    "availability": "available",
    "definition": {
      "id": "margaux",
      "name": "Château Margaux",
      "producer": null,
      "appellation": "Margaux"
    },
    "storageCase": { "id": "5da8a7f8-…", "name": "A1" }
  }
]
```

## Reference tables

The lists that wines and bottles pick from. They share one set of routes, with `{table}` one of:

| `{table}`              | Holds                     | Extra body field | `GET` adds                               | Filter of `GET` | A row is used by   |
| ---------------------- | ------------------------- | ---------------- | ---------------------------------------- | --------------- | ------------------ |
| `countries`            | countries                 |                  |                                          |                 | `regions`          |
| `regions`              | regions of a country      | `countryId`      | `countryName`                            | `?countryId=`   | `appellations`     |
| `appellations`         | appellations of a region  | `regionId`       | `regionName`, `countryId`, `countryName` | `?regionId=`    | `wine_definitions` |
| `wine-types`           | types (still, sparkling…) |                  |                                          |                 | `wine_definitions` |
| `wine-colors`          | colors                    |                  |                                          |                 | `wine_definitions` |
| `wine-classifications` | classifications           |                  |                                          |                 | `wine_definitions` |
| `wine-formats`         | bottle formats            |                  |                                          |                 | `bottles`          |
| `origins`              | where bottles come from   |                  |                                          |                 | `bottles`          |

A row has `id`, `name`, `createdAt` and `updatedAt` (origins have no `updatedAt`), plus the extra
body field of its table. Every table calls its name `name` in the API, wine types and colors
included. Names are unique per table, and for regions and appellations per parent: two countries may
each have a region called the same. Names are compared after trimming and without case: `Shop` and
`shop` are the same name. Rows that an earlier version stored in two cases are kept as they are.

### `GET /api/{table}`

Lists the rows of a reference table.

- **Session:** not needed.
- **Query:** `countryId=<id>` for `regions`, `regionId=<id>` for `appellations`: only the rows of
  that parent. Without it, or empty, every row. The other tables take no filter.
- **Body:** none.
- **Response:** `200` with an array of rows sorted by name (upper case before lower case), with the
  fields that the [table above](#reference-tables) gives: regions with the name of their country,
  appellations with the names of their region and country.
- **Errors:** none besides the common ones.

```json
[
  {
    "id": "mgx",
    "name": "Margaux",
    "regionId": "bdx",
    "regionName": "Bordeaux",
    "countryId": "fr",
    "countryName": "France",
    "createdAt": "2026-10-17T15:07:30.000Z",
    "updatedAt": "2026-10-17T15:07:30.000Z"
  }
]
```

### `POST /api/{table}`

Adds a row to a reference table, or finds the row that already has the name.

- **Session:** required.
- **Body:** JSON:
  - `name`: string, required, 1-500 characters.
  - `countryId` (regions) or `regionId` (appellations): id of the parent, required.
- **Response:** `201` with the new row, or `200` with the existing row when one already has this
  name, whatever its case (`france` gives `France`), under this parent for regions and
  appellations, as `GET /api/{table}` lists it.
- **Errors:** none besides the common ones (`409 missing_reference` for a parent that does not
  exist).

```json
{ "name": "Saint-Émilion", "regionId": "bdx" }
```

### `PUT /api/{table}/{id}`

Renames a row of a reference table, and for regions and appellations, sets its parent.

- **Session:** required.
- **Body:** JSON, as for [`POST /api/{table}`](#post-apitable): every field required, the parent id
  included.
- **Response:** `200` with the row as saved, as `GET /api/{table}` lists it.
- **Errors:** `404 not_found` when the row does not exist; `409 duplicate_name` when another row of
  the table has the name, whatever its case (`FRANCE` when `France` exists; a row can still change
  the case of its own name); for regions `409 duplicate_region`, for appellations
  `409 duplicate_appellation`, when another row of the same parent has it.

### `DELETE /api/{table}/{id}`

Deletes a row of a reference table that nothing uses.

- **Session:** required.
- **Body:** none. Send the `Origin` header.
- **Response:** `204` with no body.
- **Errors:** `404 not_found` when the row does not exist; `409 in_use` while rows use it, with
  `details` `{ "count", "usedBy" }`: how many, and which (the last column of the
  [table above](#reference-tables)). Only the rows that refer to it directly count: deleting a
  country counts its regions, not its wines.

```json
{
  "error": {
    "code": "in_use",
    "message": "Still used by 1 regions",
    "details": { "count": 1, "usedBy": "regions" }
  }
}
```

## Statistics and shortage

### `GET /api/statistics`

Gives the figures of the statistics page.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with an object. Unless said otherwise, a figure covers the `available` bottles
  only, and a `count` is a number of bottles:
  - `valueStats`: `totalPurchaseValue` (sum of the purchase prices), `totalCurrentValue` (sum of the
    current values), `totalHybridValue` (sum of each bottle's current value, else its purchase
    price), `avgPurchasePrice` and `avgCurrentValue` (averages over the bottles that have one,
    `null` when none does).
  - `bottlesByAvailability`: `[{ "availability", "count" }]`, over every bottle.
  - `winesByType` (`type`), `winesByColor` (`color`): `[{ <name>, "count" }]`.
  - `winesByCountry` (`country`), `winesByRegion` (`id`, `region`, and the name of its `country`),
    `topProducers` (`producer`): at most 10, largest first. Two regions of the same name in two
    countries are two rows, told apart by their `id` and `country`.
  - `winesByVintage` (`vintage`), `winesByDecade` (`decade`, such as `2010`): oldest first; bottles
    without a vintage are left out.
  - `totalStats`: `totalDefinitions` (wines), `totalBottles` (available), `totalConsumed`,
    `totalOutOfCellar`.

  Bottles whose wine has no producer are left out of `topProducers`, before the 10 largest are
  taken.

- **Errors:** none besides the common ones.

```json
{
  "valueStats": {
    "totalPurchaseValue": 50,
    "totalCurrentValue": 50,
    "totalHybridValue": 70,
    "avgPurchasePrice": 25,
    "avgCurrentValue": 50
  },
  "bottlesByAvailability": [
    { "availability": "available", "count": 2 },
    { "availability": "consumed", "count": 1 }
  ],
  "winesByType": [{ "type": "Still", "count": 2 }],
  "winesByColor": [{ "color": "Red", "count": 2 }],
  "winesByCountry": [{ "country": "France", "count": 2 }],
  "winesByRegion": [{ "id": "bdx", "region": "Bordeaux", "country": "France", "count": 2 }],
  "winesByVintage": [
    { "vintage": 2015, "count": 1 },
    { "vintage": 2018, "count": 1 }
  ],
  "winesByDecade": [{ "decade": 2010, "count": 2 }],
  "topProducers": [{ "producer": "Margaux SA", "count": 2 }],
  "totalStats": {
    "totalDefinitions": 1,
    "totalBottles": 2,
    "totalConsumed": 1,
    "totalOutOfCellar": 0
  }
}
```

### `GET /api/wine-shortage`

Lists the wines with fewer `available` bottles than their `targetQuantity`, the largest shortage
first, then by name.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with an array of wines. Wines without a `targetQuantity`, or with enough
  bottles, are left out. Each has:
  - `id`, `name`, `producer`, `targetQuantity`, `imageId`;
  - the names `appellation`, `region`, `country`, `type`, `color` and `classification` (`null` when
    none);
  - `currentCount` (available bottles) and `totalCount` (every bottle, consumed ones included);
  - `minPrice`, `maxPrice`, `avgPrice`: over the purchase prices of the bottles `available` or
    `out_of_cellar`, `null` when none has one;
  - `shortage` (`targetQuantity - currentCount`), `shortagePercentage` and `fulfillmentPercentage`
    (whole percents of the target).
- **Errors:** none besides the common ones.

```json
[
  {
    "id": "short",
    "name": "Château Pavie",
    "producer": null,
    "targetQuantity": 3,
    "imageId": null,
    "appellation": "Margaux",
    "region": "Bordeaux",
    "country": "France",
    "type": "Still",
    "color": "Red",
    "classification": null,
    "currentCount": 1,
    "totalCount": 2,
    "minPrice": 20,
    "maxPrice": 20,
    "avgPrice": 20,
    "shortage": 2,
    "shortagePercentage": 67,
    "fulfillmentPercentage": 33
  }
]
```

## Images

### `GET /api/images`

Lists the wine images, with the URL of each.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with `{ "images": [{ "id", "url" }] }`, in no particular order. `url` is a
  path on Cellar's server, such as `/uploads/wines/wine-3f1c….jpg`: prefix it with Cellar's URL to
  download the image. The file name in it is percent-encoded, as an image renamed in Admin may have
  spaces, accents, `#` or `?` in its name.
  [`GET /api/admin/images`](#get-apiadminimages) also gives the file names, sizes and dates, with a
  session.
- **Errors:** none besides the common ones.

```json
{ "images": [{ "id": "8d0e6f0a-…", "url": "/uploads/wines/wine-2b7c41d2-….jpg" }] }
```

### `POST /api/upload/image`

Uploads a wine image. To show it on a wine, put the `imageId` of the answer in the wine's `imageId`
(see [`PUT /api/definitions/{id}`](#put-apidefinitionsid)).

- **Session:** required.
- **Body:** a `multipart/form-data` form with the field `image`: the file, at most 20 MB. Send the
  `Origin` header. The format is recognised from the file's content, whatever its name or announced
  type: JPEG, PNG, WebP or GIF. The image is stored under a new name, `wine-<uuid>.<extension>`.
- **Response:** `201` with `{ "imageId", "url", "filename", "size", "type" }`: the new image's id,
  its URL path, its stored name, its size in bytes and its MIME type (`image/jpeg`, `image/png`,
  `image/webp` or `image/gif`).
- **Errors:**
  - `413 body_too_large` when the file is over 20 MB, or the whole request, as its `Content-Length`
    announces it, over 20 MB plus 64 KB.
  - `422 invalid_body` when the form has no `image` file, or when the file is not a JPEG, PNG, WebP
    or GIF image.
  - `400 malformed_body` when the body is not a valid form.

```bash
curl -fsS -b cookies.txt -H "Origin: $CELLAR" -F image=@label.jpg "$CELLAR/api/upload/image"
```

```json
{
  "imageId": "8d0e6f0a-…",
  "url": "/uploads/wines/wine-2b7c41d2-….jpg",
  "filename": "wine-2b7c41d2-….jpg",
  "size": 184311,
  "type": "image/jpeg"
}
```

## Storage

A storage container (a rack, a shelf) holds cases. Each case is named after its container: the
container's name followed by the case's suffix, so container `A` with suffixes `1` and `2` has cases
`A1` and `A2`, and suffix ` top` (with a space before it) gives `A top`. No two containers have
the same name, and no two cases of a container either: the CSV files tell a case by its container
and its name. Names are compared exactly, capitals included, so `Cellar` and `cellar` are two
containers; the CSV import, which compares names without their case, takes them as one (an accepted
limit). A case holds a number of bottles;
only the bottles whose `availability` is `available` count toward it. A bottle `out_of_cellar`
keeps its case but takes no place in it; a `consumed` bottle is in no case.

#### Container fields

The body of `POST /api/storage-containers` and `PUT /api/storage-containers/{id}`:

- `name`: string, required, trimmed, 1-500 characters, that no other container has.
- `cases`: array of strings, required, at most 500 items. The suffix of each case, in the order of
  the cases: its trailing blanks are dropped, the blanks before it are kept, and it has at most 50
  characters. The name of a case is `name` + suffix, with nothing in between. Two suffixes must
  differ; an empty suffix gives a case named like its container.
- `caseCapacities`: array, optional, default `[]`, at most 500 items. The capacity of each case, in
  the order of `cases`: an integer 1-1000, or `null`. A missing or `null` capacity is 5.

### `GET /api/storage-containers`

Lists the storage containers, without their cases.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with an array of containers in the order of the storage page (by name, the
  first `Column ` of a name ignored, without regard to case and accents): `id`, `name`,
  `parentContainerId`
  (`null` in practice: the app does not nest containers), `createdAt`, `updatedAt` (ISO 8601
  strings).
- **Errors:** none besides the common ones.

```json
[
  {
    "id": "4f0c6c51-1d0e-4a63-9b39-0f3f8a1e2b7d",
    "name": "Rack",
    "parentContainerId": null,
    "createdAt": "2026-10-17T15:06:53.000Z",
    "updatedAt": "2026-10-17T15:06:53.000Z"
  }
]
```

### `POST /api/storage-containers`

Creates a container with its cases, all or nothing.

- **Session:** required.
- **Body:** JSON, the [container fields](#container-fields).
- **Response:** `201` with `{ "container", "cases" }`: the container as
  `GET /api/storage-containers` lists it, and its cases in order, each as `GET /api/storage-cases`
  lists it.
- **Errors:** the [name conflicts](#name-conflicts).

```json
{ "name": "Rack", "cases": ["1", "2", "3"], "caseCapacities": [12, null, 6] }
```

```json
{
  "container": {
    "id": "4f0c…",
    "name": "Rack",
    "parentContainerId": null,
    "createdAt": "…",
    "updatedAt": "…"
  },
  "cases": [
    {
      "id": "9a1e…",
      "name": "Rack1",
      "capacity": 12,
      "containerId": "4f0c…",
      "position": 0,
      "createdAt": "…",
      "updatedAt": "…"
    },
    {
      "id": "b27d…",
      "name": "Rack2",
      "capacity": 5,
      "containerId": "4f0c…",
      "position": 1,
      "createdAt": "…",
      "updatedAt": "…"
    },
    {
      "id": "c3f0…",
      "name": "Rack3",
      "capacity": 6,
      "containerId": "4f0c…",
      "position": 2,
      "createdAt": "…",
      "updatedAt": "…"
    }
  ]
}
```

#### Name conflicts

- `409 duplicate_container` when another container has the name; `details` is `{ "name" }`.
- `409 duplicate_case` when two suffixes are the same; `details` is `{ "caseName", "position" }`,
  `position` being the index in `cases` of the second one.

### `PUT /api/storage-containers/{id}`

Renames a container and replaces its list of cases, all or nothing. The body lists every case of the
container, in order: a case it leaves out is deleted, a case without an id is created, and every
kept case is renamed after the container and gets its new position and capacity.

- **Session:** required.
- **Body:** JSON, the [container fields](#container-fields), plus:
  - `caseIds`: array, optional, default `[]`, at most as many items as `cases`. The id of the
    existing case at each position of `cases`, or `null` (or nothing, past the end of the array) for
    a case to create. An id may appear only once.
  - `updatedAt`: string, optional, an ISO 8601 date-time (`Z` or an offset): the `updatedAt` of the
    container as the caller read it. When given, the update is refused if the container changed
    since, so that an old copy does not delete a case that someone added in the meantime. Times are
    kept to the second: two saves within the same second are not told apart. Without it, the update
    applies whatever changed.
- **Response:** `200` with `{ "container", "cases" }`, as `POST /api/storage-containers` answers.
- **Errors:**
  - `404 not_found` when the container does not exist, or when `caseIds` holds an id that is not a
    case of this container.
  - `409 case_full` when a kept case would get a capacity below the number of available bottles it
    holds; `details` is `{ "caseName", "capacity", "bottles" }`. A case that was already over its
    capacity (after an import, say) is refused only when the change puts it further over.
  - `409 case_holds_bottles` when a case to delete still holds an available bottle; `details` is
    `{ "caseName", "bottles" }`. Bottles that left the cellar do not prevent the deletion: they lose
    their case.
  - `409 container_changed` when `updatedAt` is not the container's: it changed after the caller
    read it. `details` is `{ "updatedAt" }`, the current one. Read the container again.
  - The [name conflicts](#name-conflicts).
  - `422 invalid_body` when `caseIds` is longer than `cases` or holds an id twice, or `updatedAt` is
    not a date-time.

```json
{
  "name": "Shelf",
  "cases": ["1", "2", "3", "4"],
  "caseCapacities": [12, 5, 6, 6],
  "caseIds": ["9a1e…", "b27d…", "c3f0…", null],
  "updatedAt": "2026-10-17T15:06:53.000Z"
}
```

### `DELETE /api/storage-containers/{id}`

Deletes a container with all its cases, all or nothing.

- **Session:** required.
- **Body:** none.
- **Response:** `204` with no body. The bottles that left the cellar and were in its cases lose
  their case.
- **Errors:** `404 not_found` when the container does not exist; `409 case_holds_bottles` when one
  of its cases still holds an available bottle, with `details` `{ "caseName", "bottles" }`.

### `GET /api/storage-cases`

Lists every case of every container.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with an array of cases, in the order of the storage page: container by
  container, the containers sorted by name (the first `Column ` of a name is ignored, and the
  comparison ignores case and accents), and the cases of each container by `position` (cases with
  the same position, as after an old import, by the number that ends their name). Each case has
  `id`, `name`, `capacity`, `containerId`, `position` (from 0 in its container), `createdAt`,
  `updatedAt`. It does not say how many bottles a case holds: see `GET /api/storage-occupancy`.
- **Errors:** none besides the common ones.

```json
[
  {
    "id": "9a1e…",
    "name": "Rack1",
    "capacity": 12,
    "containerId": "4f0c…",
    "position": 0,
    "createdAt": "2026-10-17T15:06:53.000Z",
    "updatedAt": "2026-10-17T15:06:53.000Z"
  }
]
```

### `DELETE /api/storage-cases/{id}`

Deletes one case.

- **Session:** required.
- **Body:** none.
- **Response:** `204` with no body. The bottles that left the cellar and were in the case lose their
  case.
- **Errors:** `404 not_found` when the case does not exist; `409 case_holds_bottles` when the case
  still holds an available bottle, with `details` `{ "caseName", "bottles" }`.

### `GET /api/storage-cases/{id}/capacity`

Tells how full a case is, counting its available bottles only.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with `storageCase` (`id`, `name`, `capacity`), `currentCount` (available
  bottles in the case), `availableSpots` (capacity minus `currentCount`, never below 0), `isFull`
  (`currentCount` ≥ capacity) and `capacity` (the same as `storageCase.capacity`). A case can hold
  more bottles than its capacity, for example after an import.
- **Errors:** `404 not_found` when the case does not exist.

```json
{
  "storageCase": { "id": "9a1e…", "name": "Rack1", "capacity": 12 },
  "currentCount": 4,
  "availableSpots": 8,
  "isFull": false,
  "capacity": 12
}
```

### `GET /api/storage-occupancy`

Gives the number of available bottles in each case, in one call.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with an object that maps the id of each case holding at least one available
  bottle to that number. A case with no available bottle is absent.
- **Errors:** none besides the common ones.

```json
{ "9a1e…": 4, "c3f0…": 6 }
```

## Barcodes and labels

Cellar can give each new bottle a barcode: a prefix of 0-6 letters, digits or `-`, then a number
padded with zeros, 10 characters in all (`WINE000042`). The settings are under
`/api/admin/barcode-settings`. Bottles may also hold other codes, typed by hand or imported.

A generated code of a prefix starts with the prefix exactly, capitals included (`wine000042` is not
a code of `WINE`), followed by digits only, 10 characters in all, or 13 for the codes generated
before September 2025 (with an empty or digits-only prefix, a 13-character code counts only when its
number fits after the prefix in 10 characters, so that an EAN-13 typed by hand does not). A prefix
therefore shares its numbers with the longer prefixes that add digits to it: `CV10000001` is a
generated code of both `CV1` and `CV`, and `1230000002` of both `123` and the empty prefix.

The CSV files of this group have one header line and one line per code, with these columns:
`barcode,wine_name,producer,appellation,vintage,wine_type,color,location`, where `location` is the
name of the bottle's case. A field that holds a comma, a quote or a line break is quoted. Each line
ends with `\n`. A text that a spreadsheet would run as a formula gets a leading `'` and is quoted:
one that starts with `=`, `@`, a tab or a carriage return, or with `+` or `-` unless only ASCII
letters, digits and dashes follow, and one that already starts with `'` before one of these.

### `GET /api/barcode/stats`

Counts the bottles with a code of the configured prefix, and gives the number the next generated
code will get.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with `totalWithBarcode`, `nextNumber` and `prefix`.
  - With automatic barcodes on: `totalWithBarcode` is the number of bottles, of any availability,
    with a generated code of the prefix; `nextNumber` is the number of the next code, which may be
    past the last number the prefix allows (this route does not refuse it,
    `GET /api/admin/next-barcode` does).
  - With automatic barcodes off: `{ "totalWithBarcode": 0, "nextNumber": null, "prefix": "…" }`.
- **Errors:** none besides the common ones.

```json
{ "totalWithBarcode": 41, "nextNumber": 42, "prefix": "WINE" }
```

### `GET /api/barcode/stats-manual`

Counts every bottle with a barcode, whatever its prefix and whatever the settings.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with `{ "totalWithBarcode": <number> }`; bottles of any availability count.
- **Errors:** none besides the common ones.

```json
{ "totalWithBarcode": 57 }
```

### `GET /api/barcode/export-all`

Downloads a CSV file of the bottles with a generated code of the configured prefix. Despite its URL,
it does not export every bottle with a barcode (that is `GET /api/barcode/export-manual`).

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with the CSV file, `Content-Type: text/csv` and
  `Content-Disposition: attachment` with the file name
  `all_bottles_with_barcodes_<prefix>_<timestamp in ms>.csv`. One line per bottle, of any
  availability, sorted by barcode.
- **Errors:** `409 barcode_generation_off` when automatic barcodes are off; `409 nothing_to_export`
  when no bottle has a code of the prefix.

```csv
barcode,wine_name,producer,appellation,vintage,wine_type,color,location
WINE000001,Château Margaux,Château Margaux,Margaux,2015,Still,Red,Rack1
```

### `GET /api/barcode/export-manual`

Downloads a CSV file of every bottle with a barcode, whatever its prefix, whatever the settings.
Despite its URL, it is not limited to codes typed by hand.

- **Session:** not needed.
- **Body:** none.
- **Response:** `200` with the CSV file, `Content-Type: text/csv` and
  `Content-Disposition: attachment` with the file name
  `all_bottles_with_manual_barcodes_<timestamp in ms>.csv`. One line per bottle, of any
  availability, sorted by barcode.
- **Errors:** `409 nothing_to_export` when no bottle has a barcode.

### `POST /api/barcode/csv`

Downloads a CSV file of a range of generated codes, for label software. A code that a bottle already
has is filled in with its wine; the other lines hold only the code.

- **Session:** required.
- **Body:** JSON:
  - `startNumber`: integer ≥ 1, required.
  - `count`: integer 1-1000, required.
  - `prefix`: string, at most 100 characters, optional. Read only while automatic barcodes are off;
    otherwise the configured prefix is used and this field is ignored.
- **Response:** `200` with the CSV file, `Content-Type: text/csv` and
  `Content-Disposition: attachment` with the file name
  `barcodes_<prefix>_<startNumber>_<count>_<timestamp in ms>.csv`. One line per code of the range,
  in order.
- **Errors:**
  - `422 barcode_out_of_range` when the range goes past the last number the prefix allows; `details`
    is `{ "min": 1, "max" }`.
  - `422 barcode_prefix_required` when automatic barcodes are off and `prefix` is missing or empty.
  - `422 invalid_barcode_prefix` when automatic barcodes are off and `prefix` is not 0-6 letters,
    digits or `-` (over 100 characters, `422 invalid_body`).
  - `409 barcode_prefix_too_long` when automatic barcodes are on and the configured prefix is longer
    than 6 characters (a prefix saved before prefixes were checked).

```json
{ "startNumber": 1, "count": 3 }
```

```csv
barcode,wine_name,producer,appellation,vintage,wine_type,color,location
WINE000001,Château Margaux,,Margaux,2015,Still,Red,
WINE000002,Château Margaux,,Margaux,2015,Still,Red,
WINE000003,,,,,,,
```

### `POST /api/barcode/pdf-labels`

Downloads a PDF of labels for a range of generated codes, laid out on pages.

- **Session:** required.
- **Body:** JSON, the [label layout fields](#label-layout-fields) and the range of
  `POST /api/barcode/csv` (`startNumber`, `count`, `prefix`), with these differences from a preset:
  - `name` and `description` are not read.
  - `labelPadding`, `horizontalSpacing` and `verticalSpacing` are optional, default 2.
  - `codeType` is optional, default `barcode`; `showCodeValue` is optional, default `true`.
- **Response:** `200` with the PDF, `Content-Type: application/pdf` and
  `Content-Disposition: attachment` with the file name
  `labels_<prefix>_<startNumber>_<count>_<timestamp in ms>.pdf`. Labels fill each page row by row; a
  new page starts when one is full.
- **Errors:**
  - `422 barcode_out_of_range`, `422 barcode_prefix_required`, `422 invalid_barcode_prefix`,
    `409 barcode_prefix_too_long`: as for `POST /api/barcode/csv`.
  - `422 labels_do_not_fit` when not one label fits on the page with these margins; no `details`.
  - `422 label_too_small` when a label is too small for its code to be read; `details.issues` lists
    each blocking issue as `{ "code", "blocking": true, "values": { "actual", "limit" } }` (sizes in
    mm). The codes are `module_width_below_minimum` (bar width under 0.33 mm),
    `height_below_minimum` (barcode height, label height minus twice the padding and the 5 mm of
    the code value when `showCodeValue` is true, under 10 mm) and
    `qr_size_below_minimum` (QR code side under 10 mm).
  - `409 barcode_not_encodable`, with `codeType: barcode`, when the configured prefix holds a
    character that Code 128 cannot encode (a prefix saved before prefixes were checked).
  - The range and prefix are checked before the layout.

```json
{
  "startNumber": 1,
  "count": 24,
  "pageFormat": "A4",
  "labelWidth": 63.5,
  "labelHeight": 33.9,
  "marginTop": 12.9,
  "marginLeft": 7.2,
  "marginBottom": 12.9,
  "marginRight": 7.2,
  "codeType": "barcode"
}
```

With `"labelHeight": 18` instead, the barcode is 9 mm high (18 mm, minus 2 × 2 mm of padding and
5 mm for the code value), and the answer is `422`:

```json
{
  "error": {
    "code": "label_too_small",
    "message": "The labels are too small for their code: height_below_minimum",
    "details": {
      "issues": [
        { "code": "height_below_minimum", "blocking": true, "values": { "actual": 9, "limit": 10 } }
      ]
    }
  }
}
```

## Barcode settings

### `GET /api/admin/barcode-settings`

Reads the barcode settings.

- **Session:** required.
- **Body:** none.
- **Response:** `200` with `autoGeneration` (whether new bottles get a code), `prefix` and
  `startNumber`. A new installation starts with
  `{ "autoGeneration": true, "prefix": "WINE", "startNumber": 1 }`.
- **Errors:** none besides the common ones.

```json
{ "autoGeneration": true, "prefix": "WINE", "startNumber": 1 }
```

### `PUT /api/admin/barcode-settings`

Saves the three barcode settings, all or none, as given. With automatic barcodes on, the answer
tells whether the sequence will go on past the requested start number, because codes from it are
already used.

- **Session:** required.
- **Body:** JSON, every field required:
  - `autoGeneration`: boolean.
  - `prefix`: string of 0-6 letters, digits or `-` (`^[A-Za-z0-9-]{0,6}$`), checked even when
    `autoGeneration` is `false`.
  - `startNumber`: integer from 1 to the last number the prefix allows
    (`10^(10 - prefix length) - 1`: 9999 for a 6-character prefix).
- **Response:** `200` with the settings as saved, as
  [`GET /api/admin/barcode-settings`](#get-apiadminbarcode-settings) gives them, and
  `conflictInfo`. `conflictInfo` is `null` when
  `autoGeneration` is `false`; otherwise it holds `hasConflict` (whether the next code is past
  `startNumber`), `requestedStart`, `actualNext` (the number the next bottle will get) and
  `nextBarcode` (its code). The saved `startNumber` is the requested one, not `actualNext`.
- **Errors:**
  - `422 invalid_barcode_prefix` when the prefix breaks the rule above (over 100 characters,
    `422 invalid_body`).
  - `422 barcode_out_of_range` when `startNumber` is past the last number of the prefix; `details`
    is `{ "min": 1, "max" }`.
  - `409 barcode_range` when automatic barcodes are on and the prefix has no number left after the
    codes already given; nothing is saved.

```json
{ "autoGeneration": true, "prefix": "WINE", "startNumber": 3 }
```

```json
{
  "autoGeneration": true,
  "prefix": "WINE",
  "startNumber": 3,
  "conflictInfo": {
    "hasConflict": true,
    "requestedStart": 3,
    "actualNext": 8,
    "nextBarcode": "WINE000008"
  }
}
```

### `GET /api/admin/next-barcode`

Gives the code that the next new bottle will get, without reserving it.

- **Session:** required.
- **Body:** none.
- **Response:** `200` with `{ "barcode", "nextNumber", "prefix" }`. The next number comes after the
  last number given with this prefix (even to a bottle since deleted), after the highest generated
  code of the prefix in the cellar, and is at least `startNumber`.
- **Errors:**
  - `409 barcode_generation_off` when automatic barcodes are off.
  - `409 barcode_range` when the prefix has no number left.
  - `409 barcode_prefix_too_long` when the configured prefix is longer than 6 characters (a prefix
    saved before prefixes were checked): change it in the settings.

```json
{ "barcode": "WINE000042", "nextNumber": 42, "prefix": "WINE" }
```

## Label presets

A label preset saves a page layout for the labels of `POST /api/barcode/pdf-labels`. A preset must
print as it is saved: `POST` and `PUT` refuse a layout that the PDF route would refuse, with the
same errors.

#### Label layout fields

The body of `POST /api/admin/label-presets` and `PUT /api/admin/label-presets/{id}`; sizes are in
mm:

- `name`: string, required, trimmed, 1-500 characters, unique among presets.
- `description`: string, optional, at most 500 characters; empty or missing is saved as `null`.
- `pageFormat`: required, one of `A4`, `A3`, `Letter`, `Legal`.
- `labelWidth`, `labelHeight`: numbers, required, greater than 0, at most 500.
- `marginTop`, `marginLeft`, `marginBottom`, `marginRight`: numbers, required, 0-500.
- `labelPadding`: number, required, 0-500. The space inside each label.
- `horizontalSpacing`, `verticalSpacing`: numbers, required, 0-500. The gap between two labels.
- `codeType`: required, `barcode` (Code 128) or `qrcode`.
- `showCodeValue`: boolean, required. Prints the code under it.
- `showBorder`: boolean, optional, default `false`. Draws a light gray outline around each label.

Numbers must be JSON numbers: `"2"` is refused.

A preset as the API answers it has these fields, plus `id`, `createdAt`, `updatedAt`, and `padding`,
an older column that always holds the same value as `labelPadding`.

### `GET /api/admin/label-presets`

Lists the label presets.

- **Session:** required.
- **Body:** none.
- **Response:** `200` with an array of presets, ordered by name.
- **Errors:** none besides the common ones.

```json
[
  {
    "id": "7d2b…",
    "name": "Shelf labels",
    "description": null,
    "pageFormat": "A4",
    "labelWidth": 90,
    "labelHeight": 30,
    "marginTop": 10,
    "marginLeft": 10,
    "marginBottom": 10,
    "marginRight": 10,
    "padding": 2,
    "labelPadding": 2,
    "horizontalSpacing": 2,
    "verticalSpacing": 2,
    "codeType": "barcode",
    "showCodeValue": true,
    "showBorder": false,
    "createdAt": "2026-10-17T15:06:53.000Z",
    "updatedAt": "2026-10-17T15:06:53.000Z"
  }
]
```

### `POST /api/admin/label-presets`

Creates a label preset.

- **Session:** required.
- **Body:** JSON, the [label layout fields](#label-layout-fields).
- **Response:** `201` with the preset.
- **Errors:**
  - `409 duplicate_name` when another preset has this name.
  - `422 labels_do_not_fit` when not one label fits on the page with these margins; no `details`.
  - `422 label_too_small` when a label is too small for its code to be read; `details.issues` lists
    each blocking issue, as for [`POST /api/barcode/pdf-labels`](#post-apibarcodepdf-labels)
    (`module_width_below_minimum`, `height_below_minimum`, `qr_size_below_minimum`).
  - Nothing is saved on an error.

```json
{
  "name": "Shelf labels",
  "pageFormat": "A4",
  "labelWidth": 90,
  "labelHeight": 30,
  "marginTop": 10,
  "marginLeft": 10,
  "marginBottom": 10,
  "marginRight": 10,
  "labelPadding": 2,
  "horizontalSpacing": 2,
  "verticalSpacing": 2,
  "codeType": "barcode",
  "showCodeValue": true
}
```

### `GET /api/admin/label-presets/{id}`

Reads one label preset.

- **Session:** required.
- **Body:** none.
- **Response:** `200` with the preset.
- **Errors:** `404 not_found` when the preset does not exist.

### `PUT /api/admin/label-presets/{id}`

Replaces every field of a label preset: a field left out takes its default, so `showBorder` goes
back to `false` and `description` to `null` when they are not sent.

- **Session:** required.
- **Body:** JSON, the [label layout fields](#label-layout-fields).
- **Response:** `200` with the preset.
- **Errors:** `404 not_found` when the preset does not exist; `409 duplicate_name` when another
  preset has this name; `422 labels_do_not_fit` or `422 label_too_small` for a layout the PDF would
  refuse, as for [`POST /api/admin/label-presets`](#post-apiadminlabel-presets). The preset is
  looked up first: a preset that does not exist gets the `404`, whatever the body holds. Nothing is
  saved on an error.

### `DELETE /api/admin/label-presets/{id}`

Deletes a label preset.

- **Session:** required.
- **Body:** none.
- **Response:** `204` with no body.
- **Errors:** `404 not_found` when the preset does not exist.

## Backups

Backups and exports are zip files kept in the data folder of the server (`DATA_DIR`). A backup holds
the database as `cellar.db` and the wine images in `images/`; an export holds the rows of every
table as `cellar-export.json` and the images in `images/`. Their names start with `cellar-backup-`
or `cellar-export-` and end with a timestamp such as `2026-10-17T15-06-10-123` (UTC) and `.zip`.

### `GET /api/admin/list-backups`

Lists the backups and exports in the data folder, newest first.

- **Session:** required.
- **Body:** none.
- **Response:** `200` with `{ "backups": [...] }`. Each file has:
  - `filename`: the name to pass to the download and delete routes.
  - `size`: in bytes.
  - `created`: the date the file was last written.
  - `type`: `manual-backup`, `manual-export`, `automatic-backup-internal`,
    `automatic-export-internal`, `automatic-backup-cron`, `automatic-export-cron`, or for the backup
    that Cellar makes first, `safety-backup-restore` (before a restore), `safety-backup-reset`
    (before a wipe) or `safety-export-import` (before a JSON import). The safety backups are not
    automatic (`isAutomatic: false`), and neither is a manual backup named `auto`, a name that
    older versions accepted.
  - `isDatabase` (a backup), `isExport` (an export), `isAutomatic`, and `isZip`, always `true`.
- **Errors:** none besides the common ones.

```json
{
  "backups": [
    {
      "filename": "cellar-backup-auto-cron-2026-10-17T03-00-00-412.zip",
      "size": 5242880,
      "created": "2026-10-17T03:00:01.000Z",
      "type": "automatic-backup-cron",
      "isDatabase": true,
      "isAutomatic": true,
      "isExport": false,
      "isZip": true
    }
  ]
}
```

### `POST /api/admin/create-backup`

Writes a backup of the database and the images in the data folder.

- **Session:** required.
- **Body:** none, or JSON:
  - `name`: string, optional, at most 150 bytes in UTF-8 (an accented letter takes 2, an emoji 4),
    trimmed. The file is then named `cellar-backup-<name>-<timestamp>.zip`, otherwise
    `cellar-backup-<timestamp>.zip`. A name that is `auto` or starts with `auto-` (reserved for
    automatic backups), that holds `/`, `\` or a control character, or that is longer, is refused.
- **Response:** `201` with `success: true`, an English `message`, the `filename` and `size`
  (bytes) of the new file, and `restorable`: `false` when the backup is larger than a restore
  accepts (2 GiB uncompressed or 10,000 files). Such a backup is written anyway, as it holds the
  data, and can be restored by hand (see README-Docker).
- **Errors:** `422 invalid_file_name` for a name that cannot be used.

```json
{
  "success": true,
  "message": "Database backup with images created successfully",
  "filename": "cellar-backup-before-move-2026-10-17T15-06-10-123.zip",
  "size": 5242880,
  "restorable": true
}
```

### `POST /api/admin/create-export`

Writes an export of every table, as JSON, with the images, in the data folder. The JSON import reads
it back.

- **Session:** required.
- **Body:** none, or JSON `{ "name": … }`, with the same rules as for
  [`POST /api/admin/create-backup`](#post-apiadmincreate-backup). The file is named
  `cellar-export-<name>-<timestamp>.zip`, or `cellar-export-<timestamp>.zip`.
- **Response:** `201` with `success: true`, an English `message`, `files.zip` (the `filename` and
  `size` of the new file), `recordCount`, the number of rows exported, and `restorable`: `false`
  when the export is larger than an import accepts (2 GiB uncompressed or 10,000 files), which
  cannot then import it.
- **Errors:** `422 invalid_file_name` for a name that cannot be used.

```json
{
  "success": true,
  "message": "Full export with JSON and images created successfully",
  "files": { "zip": { "filename": "cellar-export-2026-10-17T15-06-10-123.zip", "size": 4194304 } },
  "recordCount": 1834,
  "restorable": true
}
```

### `GET /api/admin/download-backup`

Downloads a backup or an export.

- **Session:** required.
- **Query:** `filename`: the name of the file, as `GET /api/admin/list-backups` gives it, as the
  other backup routes take it. Older versions took `file`, which now answers `422`.
- **Body:** none.
- **Response:** `200` with the zip, `Content-Type: application/zip`, its `Content-Length`, and
  `Content-Disposition: attachment` with its name (in `filename*` too, for names outside ASCII).
- **Errors:** `422 invalid_body` when `filename` is missing or is not the name of a backup or an
  export (`cellar-backup-…zip` or `cellar-export-…zip`, without a path); `404 not_found` when there
  is no such file.

```bash
curl -fsS -b cookies.txt -OJ "$CELLAR/api/admin/download-backup?filename=cellar-backup-2026-10-17T15-06-10-123.zip"
```

### `DELETE /api/admin/delete-backup`

Deletes a backup or an export from the data folder.

- **Session:** required.
- **Body:** JSON:
  - `filename`: string, required: the name of the file, as `GET /api/admin/list-backups` gives it.
- **Response:** `204` with no body.
- **Errors:** `422 invalid_body` when `filename` is not the name of a backup or an export
  (`cellar-backup-…zip` or `cellar-export-…zip`, without a path); `404 not_found` when there is no
  such file.

```json
{ "filename": "cellar-backup-2026-10-17T15-06-10-123.zip" }
```

#### The zip of a restore or an import

`POST /api/admin/restore` and `POST /api/admin/import-json` take their zip in one of two ways,
chosen by the `Content-Type` of the request:

- **A file of the list**, as JSON (`Content-Type: application/json`):
  `{ "filename": "cellar-backup-2026-10-17T15-06-10-123.zip" }`, the `filename` that
  [`GET /api/admin/list-backups`](#get-apiadminlist-backups) gives, as for
  [`DELETE /api/admin/delete-backup`](#delete-apiadmindelete-backup). The server reads the file
  where it is: nothing is uploaded, the 500 MB limit does not apply, and the file stays in the list.
  Errors:
  - `422 invalid_body` when `filename` is missing, or is not the name of a backup or an export
    (`cellar-backup-…zip` or `cellar-export-…zip`, without a path);
  - `404 not_found` when there is no such file;
  - `400 malformed_body` for a body that is not JSON, `413 body_too_large` for one over 1 MB.
- **An upload**, as the raw body (`Content-Type: application/zip`): the bytes of the zip, at most
  500 MB, which the server writes to disk as they arrive. Errors:
  - `413 body_too_large` before anything is read when `Content-Length` announces more than 500 MB,
    and as soon as the body passes 500 MB when the request sends no `Content-Length`; what was
    written is removed;
  - `400 malformed_body` when the body cannot be read to its end, for example when the client goes
    away;
  - an empty body is not a zip: it gets the `422` of the route (`invalid_backup` with
    `unreadable_zip`, or `invalid_export` with `unreadable`).

Any other `Content-Type`, the `multipart/form-data` form that older versions took included,
gets `400 malformed_body` (or SvelteKit's `403` for a form sent without an `Origin` header). Neither
way needs an `Origin` header (see [Origin check](#origin-check)).

```bash
# A backup of the list
curl -fsS -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"filename":"cellar-backup-2026-10-17T15-06-10-123.zip"}' "$CELLAR/api/admin/restore"

# A zip from this computer
curl -fsS -b cookies.txt -H 'Content-Type: application/zip' \
  --data-binary @cellar-backup-2026-10-17T15-06-10-123.zip "$CELLAR/api/admin/restore"
```

### `POST /api/admin/restore`

Replaces the database with that of a backup zip, copies its images into the image folder over the
files of the same name, and deletes the files of the image folder, hidden ones aside, that no image
of the restored database names, even those that are not images. The current data, images
included, is first saved in a pre-restore backup.

- **Session:** required.
- **Body:** the backup zip, by its file name or as an upload: see
  [The zip of a restore or an import](#the-zip-of-a-restore-or-an-import). It must hold `cellar.db`;
  its images in `images/` are restored too.
- **Response:** `200` with:
  - `success: true` and an English `message`.
  - `restored`: `{ "database": true, "images": <whether at least one image was copied> }`, `images`
    being `false` when the copy failed (see `imagesCopyFailed`). Only the JPEG, PNG, WebP and GIF
    images of `images/` are copied.
  - `imagesCopyFailed`: `true` when the database was restored but its images could not be copied;
    the pre-restore backup still holds the former images.
  - `backup`: the name of the pre-restore backup, `cellar-backup-pre-restore-<timestamp>.zip`.
- What stays as it was: the access code, the automatic backup settings and the backup token, and
  the upgrade actions. The upgrade actions of the versions between the backup's and this one are
  added to the list, with `mayBeDone: true`, unless it holds them already. Every session but the
  caller's ends.
- Each barcode prefix keeps the higher of its last numbers given, that of the backup and that of
  the current data, so that no number printed since the backup is given again.
- The database of a backup from an earlier version is upgraded as the server upgrades its own:
  when the backup predates these changes, the line breaks of notes and descriptions become LF, a
  note or a description of more than 5,000 characters is cut to 5,000 characters, and a negative
  purchase price or current value is removed and written into the bottle's notes.
- While the restore runs, other writes get `503 writes_held`.
- **Errors:**
  - `422 invalid_backup` when the file is not a backup this version can restore. `details` has
    `problem` (`unreadable_zip`, `no_database`, `not_sqlite`, `damaged`, `not_cellar`,
    `no_migrations` or `unknown_version`), `reason` (English), and `version` for `unknown_version`.
    A backup of the list that is refused stays in the list.
  - The errors of [the zip](#the-zip-of-a-restore-or-an-import): `400`, `404`, `413` and
    `422 invalid_body`.
  - `409 backup_refused` for a backup from a newer version, or from before a mandatory upgrade stop
    that this version passed. `details` is `{ "kind": "newer", "backupVersion", "currentVersion" }`
    or `{ "kind": "mandatory_stop", "backupVersion", "orOlder", "stopVersion", "currentVersion" }`.
  - `500 pre_restore_backup_failed` when the current data could not be backed up: nothing was
    restored.
  - `503 writes_held` when another restore, a JSON import or a wipe is running.
  - The data is not touched before the checks behind `invalid_backup` and `backup_refused` pass.

```json
{
  "success": true,
  "message": "Database and images restored successfully from ZIP file. Images were restored.",
  "restored": { "database": true, "images": true },
  "imagesCopyFailed": false,
  "backup": "cellar-backup-pre-restore-2026-10-17T15-10-02-871.zip"
}
```

### `POST /api/admin/import-json`

Replaces every row of the cellar with those of an export zip, after saving the current data in a
pre-import export.

- **Session:** required.
- **Body:** the export zip, as [`POST /api/admin/create-export`](#post-apiadmincreate-export) writes
  it, by its file name or as an upload: see
  [The zip of a restore or an import](#the-zip-of-a-restore-or-an-import). Its JSON file must have a
  `data` object with the rows of all 13 tables of an export (`countries`, `regions`, `appellations`,
  `wineClassifications`, `wineTypes`, `wineColors`, `wineFormats`, `origins`, `storageContainers`,
  `storageCases`, `wineImages`, `wineDefinitions`, `wineBottles`); its images in `images/` are
  copied too.
- **Response:** `200` with:
  - `success: true` and an English `message`.
  - `recordCount`: the number of rows imported.
  - `exportedAt` and `version`: those the export records.
  - `restored`: `{ "database": true, "images": <whether images were copied> }`.
  - `imagesCopyFailed`: `true` when the rows were imported but the images could not be copied.
  - `backup`: the name of the pre-import export, `cellar-export-pre-import-<timestamp>.zip`.
- The import is all or nothing: a refused row leaves the data as it was. Settings, sessions and
  label presets are not part of an export and stay. The line breaks of notes and descriptions become
  LF, and a note or a description of more than 5,000 characters, from an export of an older
  version, is cut to 5,000 characters, as the upgrade cuts those of the database. A negative
  purchase price or current value is removed and written into the bottle's notes, as the upgrade of
  an older database does. While the import runs, other writes get `503 writes_held`.
- **Errors:**
  - `422 invalid_export` when the file is not an export this version can import. `details` has
    `problem` (`unreadable`, `incomplete` with `tables`, the missing ones as one comma-separated
    string, or `invalid_row` with `table`, `row`, numbered from 1, and `problems`, as in the
    `errors` of the CSV import) and `reason` (English).
  - `422 export_refused` when the database refuses a row. `details` has `rule` (`duplicate_region`,
    `duplicate_appellation`, `duplicate_barcode`, `duplicate_container`, `duplicate_case`,
    `missing_reference` or `other`) and `reason`. An export made by an older version can hold
    containers, or cases of a container, of the same name: restore a backup zip instead, which the
    upgrade repairs.
  - `500 pre_import_backup_failed` when the current data could not be exported first: nothing was
    imported.
  - `500 internal_error` when the server cannot extract the export, such as on a full disk:
    nothing was imported.
  - The errors of [the zip](#the-zip-of-a-restore-or-an-import): `400`, `404`, `413` and
    `422 invalid_body`. An export of the list that is refused stays in the list.
  - `503 writes_held` when a restore, another import or a wipe is running.

```json
{
  "success": true,
  "message": "JSON import completed successfully. 1834 records imported. Previous data exported as backup. Images were also restored.",
  "recordCount": 1834,
  "exportedAt": "2026-10-17T15:06:10.123Z",
  "version": "1.0",
  "restored": { "database": true, "images": true },
  "imagesCopyFailed": false,
  "backup": "cellar-export-pre-import-2026-10-17T15-12-40-005.zip"
}
```

### `POST /api/admin/wipe-database`

Deletes every wine, bottle, image (row and file), storage container and case, and every reference
list, then inserts the default data again, after a backup. Settings, label presets and sessions
stay.

- **Session:** required.
- **Body:** none.
- While the backup and the wipe run, other writes get `503 writes_held`.
- **Response:** `200` with `{ "backup" }`: the file name of the backup made first,
  `cellar-backup-pre-reset-<timestamp>.zip`, as a restore and a JSON import give theirs.
- **Errors:** `503 writes_held` when a restore, a JSON import or another wipe is running.
  `500 wipe_failed` when the default data cannot be inserted: nothing was changed.
  `details` has `files` (the CSV files at fault, as one comma-separated string), `fixable` (whether
  they are copies in the `csv-imports` folder, which can be fixed or deleted), `folder` and
  `reason`.

```json
{ "backup": "cellar-backup-pre-reset-2026-10-17T15-20-00-000.zip" }
```

## Automatic backups

### `GET /api/admin/backup-settings`

Reads the settings of the automatic backups.

- **Session:** required.
- **Body:** none.
- **Response:** `200` with:
  - `autoBackupEnabled`: boolean.
  - `autoBackupInterval`: hours between two backups, 1 to 168 (default 24).
  - `autoBackupKeepCount`: how many automatic backups, and as many automatic exports, are kept (1 to
    50, default 7).
  - `autoBackupMode`: `internal` (the server plans the backups) or `cron` (an external cron job
    calls [`POST /api/admin/auto-backup`](#post-apiadminauto-backup)).
  - `lastAutoBackup`: the date of the last automatic backup, or `""` before the first.
  - `hasBackupToken`: whether a backup token exists. The token itself is never shown again.
- **Errors:** none besides the common ones.

```json
{
  "autoBackupEnabled": true,
  "autoBackupInterval": 24,
  "autoBackupKeepCount": 7,
  "lastAutoBackup": "2026-10-17T03:00:00.412Z",
  "autoBackupMode": "cron",
  "hasBackupToken": true
}
```

### `PUT /api/admin/backup-settings`

Saves the settings of the automatic backups. The next backup is planned with them at once.

- **Session:** required.
- **Body:** JSON:
  - `autoBackupEnabled`: boolean, required.
  - `autoBackupInterval`: integer 1-168, required.
  - `autoBackupKeepCount`: integer 1-50, required.
  - `autoBackupMode`: `internal` or `cron`, optional: left out, the stored mode stays.
- **Response:** `200` with the settings as saved, as
  [`GET /api/admin/backup-settings`](#get-apiadminbackup-settings) gives them.
- **Errors:** none besides the common ones.

```json
{
  "autoBackupEnabled": true,
  "autoBackupInterval": 24,
  "autoBackupKeepCount": 7,
  "autoBackupMode": "cron"
}
```

### `POST /api/admin/backup-token`

Creates the token of the cron job, which replaces the earlier one, and returns it. It is shown this
once: only its hash is stored.

- **Session:** required.
- **Body:** none.
- **Response:** `200` with `{ "token": "<43 characters>" }`.
- **Errors:** none besides the common ones.

```json
{ "token": "q3J0c2V4YW1wbGUtdG9rZW4tbm90LWEtcmVhbC1vbmU" }
```

### `POST /api/admin/auto-backup`

Writes an automatic backup and an automatic export, then deletes the oldest automatic ones beyond
the number to keep. It is the route of the external cron job.

- **Session:** required, or the backup token from
  [`POST /api/admin/backup-token`](#post-apiadminbackup-token) as `Authorization: Bearer <token>`.
  The token opens this route only. The request has no body: send `Content-Type: application/json` or
  an `Origin` header (see [Origin check](#origin-check)).
- **Body:** none.
- **Response:** `200` with `success: true`, an English `message`, `files` (the names of the `backup`
  and the `export` written, `cellar-backup-auto-cron-<timestamp>.zip` and
  `cellar-export-auto-cron-<timestamp>.zip`) and `timestamp`, the date of the request.
- **Errors:** `409 cron_backups_disabled` unless automatic backups are enabled in the `cron` mode;
  nothing is written then. A missing or wrong token gets `401 unauthenticated`.

```bash
curl -fsS -X POST -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' \
  "$CELLAR/api/admin/auto-backup"
```

```json
{
  "success": true,
  "message": "Automatic backup and export completed successfully",
  "files": {
    "backup": "cellar-backup-auto-cron-2026-10-17T03-00-00-412.zip",
    "export": "cellar-export-auto-cron-2026-10-17T03-00-00-412.zip"
  },
  "timestamp": "2026-10-17T03:00:00.410Z"
}
```

## CSV import and export

The CSV files have one file per table, named after it. The table names are `countries`, `regions`,
`appellations`, `wineClassifications`, `wineTypes`, `wineColors`, `wineFormats`, `origins`,
`storageContainers`, `storageCases`, `wineImages`, `wineDefinitions` and `wineBottles`. The first
line holds the column names. A file gives no ids: a row refers to another by its name (the
`countryName` of a region, the `wineName` of a bottle…).

### `POST /api/admin/export-csv`

Answers the rows of the tables asked for as CSV text, one file per table. Nothing is written on the
server.

- **Session:** required.
- **Body:** JSON:
  - `tables`: array of table names, at least one, required.
  - `customName`: string, optional, at most 150 bytes in UTF-8, trimmed: put in the file names.
  - `delimiter`: string of 1 to 5 characters, default `,`.
- **Response:** `200` with `success: true`, an English `message`, and:
  - `files`: one per table that has rows, in the order asked: `filename`
    (`cellar-export-[<customName>-]<table>-<YYYY-MM-DDTHH-MM>.csv`), `csv` (the content, lines
    separated by `\n`), `recordCount`. A table without rows gives no file.
  - `totalRecords` and `exportedAt`.
- The columns are those of the table, without ids and timestamps, with the names of the rows they
  refer to (`storageContainers` keeps an empty `parentContainerId` column). The bottles give their
  case as `containerName` and `storageCaseName`, since two containers may have cases of the same
  name.
  `POST /api/admin/import-csv` reads them back. A text that a spreadsheet would run as a formula
  gets a leading `'` and is quoted, as in the [barcode CSV files](#barcodes-and-labels); the import
  removes it.
- **Errors:** `422 invalid_body` for an unknown table name; `422 invalid_file_name` for a
  `customName` that holds `/`, `\` or a control character, or that is longer than 150 bytes; `409 nothing_to_export` when none of the
  tables has rows.

```json
{
  "success": true,
  "message": "CSV export completed successfully",
  "files": [
    {
      "filename": "cellar-export-countries-2026-10-17T15-06.csv",
      "csv": "name\nFrance\nItaly",
      "recordCount": 2
    }
  ],
  "totalRecords": 2,
  "exportedAt": "2026-10-17T15:06:10.123Z"
}
```

### `POST /api/admin/import-csv`

Imports the rows of CSV files, table by table. Rows already in the cellar are skipped, and rows that
lack a value or break a rule are reported; the other rows are imported. The line breaks of notes and
descriptions become LF, and a note or a description of more than 5,000 characters, as an export of
an older version may hold, is cut to 5,000 characters. A negative purchase price or current value,
which an older version may have stored, is removed and written into the bottle's notes.

Names are compared without their case. A region is named within its country, an appellation within
its region, and a case within its container: a file that gives the parent next to the name, as the
exports do (`countryName` in the appellations, `regionName` in the wines, `containerName` in the
bottles), finds the row under that parent, and a regions, appellations or cases file adds a row of
the same name under another parent. Container and case names are unique only as typed: two
containers whose names differ only by their capitals, or two such cases of a container, are taken as
the first of them (an accepted limit). A row named under a parent
that does not have it is reported with `unknown_reference`, its `name` followed by the parent's in
parentheses (`Porto (Algarve)`). Without the parent, the first row of the name is taken.

A wine row is already in the cellar when the cellar had a wine of the same name, producer,
appellation, classification, type and colour before the import, whatever its other columns, or when
an earlier row of the import that was imported has the same values, whatever their case. Otherwise,
rows that share these columns but differ in another one, such as the rating, each add a wine; a
bottle row that names such a wine is reported with `several_wines`, in this import or a later one,
since the bottle file cannot tell these wines apart.

A case row without `position`, added to a container that already has cases, goes after them. In a
container that had none, the cases without `position` keep the order of the versions that did not
export it: by the number that ends their name.

- **Session:** required.
- **Body:** multipart form, at most 50 MB in all:
  - `files`: one or more files, each named `….csv`. The table of a file is the table name that ends
    last in its name, so `countries.csv` and the files of
    [`POST /api/admin/export-csv`](#post-apiadminexport-csv) both work. Files are imported in an
    order where each table comes after those it refers to.
  - `delimiter`: 1 to 5 characters, default `,`.
  - `overrideAllBarcodes`: `true` or `false` (also `1`/`0`, `yes`/`no`, `on`/`off`), default
    `false`. With automatic barcodes on, `true` gives every imported bottle a new barcode, even
    those the file gives, and adds every bottle row without looking for bottles already in the
    cellar.
  - `dryRun`: same values, default `false`. `true` answers the report without writing anything.
- **Response:** `200` with:
  - `success: true`, `dryRun`, and an English `message`.
  - `results`: one report per file, with `table` (the table that its name names, or `null`),
    `file` (its name), `totalRows`, `successfulImports`, `skippedImports`, `failedImports`,
    `errors` and `skipped`. `errors` and `skipped` list the first 1,000 rows of their kind;
    `failedImports` and `skippedImports` count them all.
    - `errors[]`: `{ "row", "problems": [...] }`, the row numbered from 1 under the header. Each
      problem has a `code`: `missing` or `invalid` with `column`; `unknown_reference` with `column`
      and `name`; `unknown_wine` or `several_wines` with `name`; `case_full` with `name` and
      `capacity`; `uneven_row` with `values` and `columns`, for a row with more or fewer values
      than the header has columns. A file left out whole is reported as row 0, with `no_table`
      (its name names no table) or `not_csv` (with `line` when known).
    - `skipped[]`: `{ "row", "reason" }`, where `reason.code` is `same_name` (with `name`),
      `same_barcode` (with `barcode`) or `same_bottle`.
  - `summary`: `totalImported`, `totalSkipped`, `totalFailed`, `filesProcessed`.
- **Errors:** `422 invalid_body` when there is no file or a file is not named `….csv`;
  `409 import_row_refused` when the database refuses a row: nothing from any file is imported then,
  and `details` has `file` and `row`; `409 barcode_range` when the automatic barcodes run out;
  `409 barcode_prefix_too_long` when a bottle takes the next barcode and the configured prefix is
  longer than 6 characters (a prefix saved before prefixes were checked).

```bash
curl -fsS -b cookies.txt -H "Origin: $CELLAR" \
  -F 'files=@countries.csv' -F 'files=@wineBottles.csv' -F 'dryRun=true' \
  "$CELLAR/api/admin/import-csv"
```

```json
{
  "success": true,
  "dryRun": true,
  "message": "CSV import checked, nothing written: 2 records imported, 1 already in the cellar, 1 failed.",
  "results": [
    {
      "table": "countries",
      "file": "countries.csv",
      "totalRows": 4,
      "successfulImports": 2,
      "skippedImports": 1,
      "failedImports": 1,
      "errors": [{ "row": 4, "problems": [{ "code": "missing", "column": "name" }] }],
      "skipped": [{ "row": 1, "reason": { "code": "same_name", "name": "France" } }]
    }
  ],
  "summary": { "totalImported": 2, "totalSkipped": 1, "totalFailed": 1, "filesProcessed": 1 }
}
```

## Data

### `GET /api/admin/wine-definitions`

Lists every wine with the names of what it refers to, by producer then name.

- **Session:** required.
- **Body:** none.
- **Response:** `200` with an array of wines. Each has the columns of the wine (`id`, `name`,
  `producer`, `appellationId`, `classificationId`, `typeId`, `colorId`, `rating`, `website`,
  `description`, `imageId`, `grapeVarieties`, `targetQuantity`, `createdAt`, `updatedAt`) and the
  names `appellationName`, `regionId`, `regionName`, `countryId`, `countryName`,
  `classificationName` (`null` without a classification), `typeName` and `colorName`.
- **Errors:** none besides the common ones.

```json
[
  {
    "id": "c1f4…",
    "name": "Château Margaux",
    "producer": "Château Margaux",
    "appellationId": "a7d2…",
    "appellationName": "Margaux",
    "regionId": "r3b9…",
    "regionName": "Bordeaux",
    "countryId": "fr01…",
    "countryName": "France",
    "classificationId": null,
    "classificationName": null,
    "typeId": "t1…",
    "typeName": "Still",
    "colorId": "c2…",
    "colorName": "Red",
    "rating": 5,
    "website": null,
    "description": null,
    "imageId": null,
    "grapeVarieties": ["Cabernet Sauvignon", "Merlot"],
    "targetQuantity": 6,
    "createdAt": "2026-10-01T09:00:00.000Z",
    "updatedAt": "2026-10-01T09:00:00.000Z"
  }
]
```

### `DELETE /api/admin/wine-definitions/{id}`

Deletes a wine, and with `cascade=true` its bottles too.

- **Session:** required.
- **Query:** `cascade=true` deletes the bottles of the wine with it; any other value, or none, does
  not.
- **Body:** none.
- **Response:** `204`, without a body.
- **Errors:** `404 not_found` when the wine does not exist; `409 in_use` without `cascade=true` when
  the wine has bottles, with `details.bottleCount`. Nothing is deleted on an error.

### `GET /api/admin/wine-bottles`

Lists every bottle, consumed ones included, newest first, with the names of what it refers to.

- **Session:** required.
- **Body:** none.
- **Response:** `200` with an array of bottles. Each has `id`, `definitionId`, `wineName`,
  `producer`, `appellationName`, `regionName`, `countryName`, `typeName`, `colorName`, `vintage`,
  `optimum`, `originId`, `originName`, `formatId`, `formatName`, `barcode`, `purchasePrice`,
  `purchaseDate`, `currentValue`, `currentValueDate`, `storageCaseId`, `storageCaseName`, `notes`,
  `availability` (`available`, `out_of_cellar` or `consumed`), `consumedDate`, `createdAt` and
  `updatedAt`.
- **Errors:** none besides the common ones.

```json
[
  {
    "id": "b8e1…",
    "definitionId": "c1f4…",
    "wineName": "Château Margaux",
    "producer": "Château Margaux",
    "appellationName": "Margaux",
    "regionName": "Bordeaux",
    "countryName": "France",
    "typeName": "Still",
    "colorName": "Red",
    "vintage": 2015,
    "optimum": 2030,
    "originId": null,
    "originName": null,
    "formatId": "f75…",
    "formatName": "Bottle",
    "barcode": "CEL-000042",
    "purchasePrice": 450,
    "purchaseDate": "2024-05-02T00:00:00.000Z",
    "currentValue": null,
    "currentValueDate": null,
    "storageCaseId": "k12…",
    "storageCaseName": "A1",
    "notes": null,
    "availability": "available",
    "consumedDate": null,
    "createdAt": "2026-10-01T09:00:00.000Z",
    "updatedAt": "2026-10-01T09:00:00.000Z"
  }
]
```

### `DELETE /api/admin/wine-bottles/{id}`

Deletes a bottle, as [`DELETE /api/bottles/{id}`](#delete-apibottlesid) does, which the admin page
calls.

- **Session:** required.
- **Body:** none.
- **Response:** `204` with no body.
- **Errors:** `404 not_found` when the bottle does not exist.

## Images

### `GET /api/admin/images`

Lists every wine image with the size and date of its file, and the wines that use it, newest file
first.

- **Session:** required.
- **Body:** none.
- **Response:** `200` with `images` and `count`. Each image has `id`, `filename`, `path` (the URL
  folder, `/uploads/wines/`), `url` (where the image is served), `size` (bytes, `0` when the file is
  missing), `lastModified` (the date of the file, or of the row when the file is missing),
  `createdAt`, `updatedAt`, and `wines`, the wines that use it, each `{ "id", "name", "producer" }`
  (empty when none does).
- **Errors:** none besides the common ones.

```json
{
  "images": [
    {
      "id": "9a0e…",
      "filename": "wine-5b1c….jpg",
      "path": "/uploads/wines/",
      "size": 183422,
      "lastModified": "2026-10-12T18:22:05.000Z",
      "url": "/uploads/wines/wine-5b1c….jpg",
      "createdAt": "2026-10-12T18:22:05.000Z",
      "updatedAt": "2026-10-12T18:22:05.000Z",
      "wines": [{ "id": "c1f4…", "name": "Château Margaux", "producer": "Château Margaux" }]
    }
  ],
  "count": 1
}
```

### `PUT /api/admin/images`

Renames an image and its file, both or neither. The wines that use it keep it.

- **Session:** required.
- **Body:** JSON:
  - `imageId`: string, required.
  - `newFilename`: string, required: a plain file name of 255 bytes at most in UTF-8, without `/`,
    `\` or a control character, not starting with `.`, ending in `.jpg`, `.jpeg`, `.png`, `.gif` or
    `.webp` (any case). The extension sets the type the image is served with; the content is not
    converted.
- **Response:** `200` with the image as [`GET /api/admin/images`](#get-apiadminimages) lists it,
  under its new name, with the wines that use it in `wines`. They need no change: a wine refers to
  its image by id.
- **Errors:** `422 invalid_file_name`, with `details: { "kind": "image" }`, for a name that breaks
  these rules; `404 not_found` when the image does not exist, or its file is missing;
  `409 duplicate_name` when an image, this one included, or another file in the image folder, has
  that name.

```json
{ "imageId": "9a0e…", "newFilename": "margaux-2015.jpg" }
```

```json
{
  "id": "9a0e…",
  "filename": "margaux-2015.jpg",
  "path": "/uploads/wines/",
  "size": 183422,
  "lastModified": "2026-10-12T18:22:05.000Z",
  "url": "/uploads/wines/margaux-2015.jpg",
  "createdAt": "2026-10-12T18:22:05.000Z",
  "updatedAt": "2026-10-17T15:06:10.000Z",
  "wines": [{ "id": "c1f4…", "name": "Château Margaux", "producer": "Château Margaux" }]
}
```

### `DELETE /api/admin/images`

Deletes images, rows and files.

- **Session:** required.
- **Body:** JSON:
  - `imageIds`: array of non-empty strings, at least one, required. Ids that match no image are
    ignored.
  - `force`: boolean, default `false`. With `true`, images that wines use are removed from those
    wines, then deleted.
- **Response:** `204`, without a body.
- **Errors:** `409 in_use` without `force` when wines use some of the images: nothing is deleted,
  and `details.inUse` lists each such image as
  `{ "id", "filename", "wines": [{ "id", "name", "producer" }] }`.

```json
{ "imageIds": ["9a0e…", "4d7f…"], "force": true }
```

### `POST /api/admin/upload-image`

Saves one or more images, each under a new name. The format is recognised from the content (JPEG,
PNG, WebP or GIF), whatever the file name or type says.

- **Session:** required.
- **Body:** multipart form with one file in field `image`, or several in field `images` (`image`
  wins when both are sent). At most 500 MB for the request, and 20 MB per image, as for
  [`POST /api/upload/image`](#post-apiuploadimage).
- **Response:** `201` with `success: true`, an English `message`, and the result of each file:
  - `successful`: `{ "originalFilename", "filename", "imageId" }` for each image saved, named
    `wine-<uuid>.<extension>`.
  - `failed`: `{ "filename", "error" }` for each file refused, `error` being an English text (not an
    image of these formats, or over 20 MB). A refused file does not stop the others.
- **Errors:** `422 invalid_body` when the form has no file in `image` or
  `images`.

```bash
curl -fsS -b cookies.txt -H "Origin: $CELLAR" \
  -F 'images=@margaux.jpg' -F 'images=@notes.txt' "$CELLAR/api/admin/upload-image"
```

```json
{
  "success": true,
  "message": "Processed 2 images",
  "successful": [
    {
      "originalFilename": "margaux.jpg",
      "filename": "wine-5b1c2f0e-8d3a-4c51-9a77-0e4f6b2d9c18.jpg",
      "imageId": "9a0e…"
    }
  ],
  "failed": [{ "filename": "notes.txt", "error": "File must be a JPEG, PNG, WebP or GIF image" }]
}
```

### `POST /api/admin/download-images`

Downloads the files of some images as one zip.

- **Session:** required.
- **Body:** JSON:
  - `imageIds`: array of strings, 1 to 10,000, required.
- **Response:** `200` with the zip, `Content-Type: application/zip` and
  `Content-Disposition: attachment` with the file name `wine-images-<YYYY-MM-DD>.zip`. It holds the
  file of each image, under its name, in the order of `imageIds`; unknown ids and missing files are
  left out. Like a backup, the zip is first written to a temporary file in the data folder, which
  is removed once sent; the answer has a `Content-Length`.
- **Errors:** `404 not_found` when no id matches an image, or none of their files exists;
  `500 image_unreadable` when the file of one of them cannot be read (its permissions, say), with
  `details: { "filename" }`.

```bash
curl -fsS -b cookies.txt -H 'Content-Type: application/json' -o images.zip \
  -d '{"imageIds":["9a0e…","4d7f…"]}' "$CELLAR/api/admin/download-images"
```

### `POST /api/admin/import-images-zip`

Copies the image files of a zip into the image folder, for the images whose row exists already (the
rows of a CSV import, without their files). A file of the same name in the image folder is replaced.

- **Session:** required.
- **Body:** multipart form with field `zipFile`: a zip whose name ends with `.zip` (any case), at
  most 500 MB. Each file it holds is read by its name without folders, and recognised by its content:
  only JPEG, PNG, WebP and GIF images are copied, whatever their extension. Hidden files (`.DS_Store`)
  and the `__MACOSX/` folder that macOS adds are left out.
- **Response:** `201` with:
  - `success: true` and an English `message`.
  - `successful`, `skipped`, `errors`: counts.
  - `summary`: one `{ "filename", "status", "reason" }` per file of the zip, where `status` is
    `success` (`reason`: `image_imported_successfully`), `skipped` (`filename_not_found_in_database`:
    no image row has that name) or `error`: `invalid_filename`, `not_an_image` (not a JPEG, PNG,
    WebP or GIF image, such as a BMP), `duplicate_filename` (a file of the same name, in another
    folder of the zip, was already copied: it is not replaced), or an English text.
  - `totalProcessed`: the number of files in the zip.
- **Errors:** `422 invalid_body` when there is no `zipFile`, its name does not
  end with `.zip`, it holds no file, or it is not a readable zip.

```json
{
  "success": true,
  "message": "ZIP import completed. 1 successful, 1 skipped, 0 errors",
  "successful": 1,
  "skipped": 1,
  "errors": 0,
  "summary": [
    { "filename": "wine-5b1c….jpg", "status": "success", "reason": "image_imported_successfully" },
    { "filename": "holiday.png", "status": "skipped", "reason": "filename_not_found_in_database" }
  ],
  "totalProcessed": 2
}
```

## Upgrade actions

### `PUT /api/admin/upgrade-actions`

Ticks or unticks an action of the upgrade notice that the Admin page shows after an upgrade.

- **Session:** required.
- **Body:** JSON:
  - `version`: string, required: the version whose action it is, as in `releases.json`.
  - `index`: integer, required: the position of the action in that version's list, from 0.
  - `done`: boolean, required.
- **Response:** `200` with the action as saved: `{ "version", "index", "mayBeDone", "done" }`, where
  `mayBeDone` tells an action that the upgrade from an unknown version may have done already.
- **Errors:** `404 not_found` when the instance has no such pending action.

```json
{ "version": "1.1.0", "index": 0, "done": true }
```
