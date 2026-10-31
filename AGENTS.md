# AGENTS.md

Cellar is a self-hosted wine cellar manager. It runs as a Docker container on a home NAS.

Stack: SvelteKit 3 (adapter-node), Svelte 5, SQLite through better-sqlite3 and Drizzle, Tailwind 4 with shadcn-svelte, Paraglide JS (en and fr).

## Commands

Use pnpm 10 (`npx -y pnpm@10 …` if it is not installed) and Node 24. `packageManager` in `package.json` pins the exact pnpm version.

- `pnpm install --frozen-lockfile`: install dependencies.
- `pnpm dev`: start the dev server.
- `pnpm check`: type-check the project.
- `pnpm test`: run the tests once (Vitest).
- `pnpm test:e2e`: run the end-to-end journeys (Playwright) in Chromium, against the built app (`pnpm build` first) on a new empty data folder. `pnpm exec playwright install chromium` downloads the browser once.
- `pnpm lint`: check formatting (Prettier) and lint (ESLint). Warnings are tolerated, errors are not.
- `pnpm format`: format the code with Prettier.
- `pnpm build`: build the production server, then `node server.js` starts it.
- `pnpm i18n:check`: compare the message keys used in `src/` with both locale files. It fails on a missing, duplicate, single-locale or unused key, and on a key it cannot read: write `m['key']` with the key spelled out, never built from a template. It also fails on a value that is not text (a nested object or a number in a locale file), on a plural made by hand, on the same text under two keys (`SAME_TEXT_ALLOWED` in `scripts/check-i18n.mjs` lists the exceptions), on a text with `...` instead of …, in either locale, on a French text with `'` or `"` instead of ’ and « », and on text written in a component, including three dots shown between tags, in a text attribute or in a literal the page shows, and the text of `alert`, `confirm` and `prompt`.
- `pnpm knip`: list the unused files, exports and dependencies (`knip.config.ts`). It fails on any finding.
- `pnpm openapi`: write `docs/openapi.json` again, the OpenAPI description of the API that `src/lib/server/openapi.ts` makes from the zod schemas, after changing a route or a request schema; `pnpm test` fails while the file is out of date. A new route needs its entry in `operations`.
- `pnpm db:generate`: create a migration in `drizzle/` after a change to `src/lib/server/db/schema.ts`. Migrations run automatically when the server starts, which stops if one fails. Never edit a committed migration.

## Map

- `vite.config.ts`: Vite and SvelteKit configuration (there is no `svelte.config.js`).
- `server.js`: starts the built app, applies the `ORIGIN` variable, which adapter-node no longer reads, and sends the headers that forbid framing on every answer.
- `src/routes/`: pages, and the API under `src/routes/api/` (admin endpoints in `api/admin/`).
- `src/hooks.server.ts`: CSRF check, migrations, backup scheduler.
- `src/lib/server/`: server-only code. Put new server code here.
  - `features/<domain>/{repository,service}.ts`: data access and business rules. Routes call a feature's modules, never its repository, and never reach the database themselves (`db/`, drizzle-orm, better-sqlite3; type imports aside); a lint rule enforces it.
  - `db/`: the schema, the connection, the migrations and the seeding.
  - `http/`: request parsing (`parseBody`, `parseFormData`), `apiHandler` and the API errors.
- `src/lib/shared/schemas/`: the zod schemas of the API, shared with the forms.
- `src/lib/components/`: UI components, in folders, never at its root.
  - Domain folders: `wines/`, `bottles/`, `storage/`, `barcode/`, `statistics/`, `preferences/`, `admin/`. A component used by several domains goes where its main use is, or to `forms/` or `layout/` when it is generic.
  - `forms/`: the forms, their fields and controls; `layout/`: app-wide pieces (dialogs, toasts, navigation); `table/`: list sorting and pagination.
  - `ui/`: only what the shadcn-svelte CLI writes. Hand-written components go in the folders above.
- `src/lib/i18n/locales/{en,fr}.json`: every user-facing string, as flat ICU messages with dotted keys. Paraglide JS compiles them into `src/lib/paraglide/` (git-ignored; `project.inlang/` holds its settings); components call `m['admin.edit']()` from `#lib/paraglide/messages.js`. The language comes from the `cellar_locale` cookie, then the browser's languages, then English; `getLocale()` from `#lib/paraglide/runtime.js` reads it, on the server too.
- `docs/roadmap/ROADMAP.md`: the refactoring roadmap, in French on purpose. It is generated from `tasks.mjs` and `status.json` by `build.mjs`: edit `tasks.mjs`, never the `.md`. Its "Décisions prises" section binds all work. For a roadmap task, also read its entry and its sources; line numbers date from the audit. `node docs/roadmap/build.mjs` regenerates the `.md` and writes the read-only tracker page, `docs/roadmap/roadmap.html` (git-ignored). `status.json` holds the task states: `node docs/roadmap/status.mjs <id> <state> [note]` changes one state and reruns the build.

## Code

1. **Simplest solution first.** Look for the simplest design that fully solves the problem, even when the problem is complex.
2. **Readability beats brevity.** Short code is good only when it stays clear.
3. **No duplication, no dead code.** Reuse existing helpers. When two places do the same thing, extract one function. Delete code you make unused.
4. **No speculative code.** Build what the task needs now. A small generalisation is fine when it removes duplication today.
5. **Stay in scope.** Remove duplication in the code you add or touch. Report anything else instead of fixing it in the same change.
6. **Follow the surrounding style, not its known flaws.**
   - New components use Svelte 5 runes and `.svelte.ts` state, not `svelte/store`.
   - A small edit to a Svelte 4 component keeps its syntax, because Svelte forbids mixing the two. Migrate a component only when you rewrite it whole.
   - Import from `src/lib` through `#lib`, with the file extension (`#lib/server/db/index.js`, `#lib/utils/url.js`).
   - Use the shared `db` from `#lib/server/db/index.js`, never a new `Database(...)`.
   - Comments explain _why_, not _what_.
7. **English everywhere** except `docs/roadmap/`: identifiers, comments, docs and commits. User-facing text goes through i18n: add each key to both JSON files, after checking that it doesn't already exist. A text that several pages share has one key, in `common.*`.
8. **Validate every input on the server.** Never render database values as HTML.
9. **Logs.** Server code (`src/lib/server/`, `*.server.ts`, `+server.ts`) writes to the container's logs with `console`; detail that only helps debugging goes through `debugLogger` (`#lib/server/debug.js`), off unless `DEBUG` names it. Browser code never uses `console`, which lint refuses: it tells the user with a toast or a message on the page.

## Tests

Test behaviour that matters: business rules, security checks, and every bug you fix (with a test that fails before the fix). Don't test trivial code or framework behaviour.

- Tests sit next to the code as `*.test.ts`. Import `describe`, `it`, `expect` and `vi` from `vitest`.
- `src/test/setup.ts` points `DATA_DIR`, `DATABASE_PATH`, `UPLOADS_DIR` and `CSV_IMPORTS_DIR` to a temporary folder for each test file, migrates its database from `drizzle/`, and makes opening any SQLite file outside that folder throw `Test opened <file>`: tests never touch `data/`. Shared helpers live in `src/test/`.
- The end-to-end journeys sit in `e2e/` as `*.spec.ts`: 3 or 4 journeys across several screens, no more. `e2e/server.mjs` starts the built app for them, on port 4421 with its own data folder in the system's temporary folder, removed when the run ends.
- A bug that a test reveals outside your task gets `it.fails` with a comment naming its roadmap task, never an assertion of the wrong behaviour.

## Git

- `main` only receives releases. `develop` is the integration branch.
- Every change goes on its own branch from `develop`: `p<phase>/<task-id>` for roadmap tasks (e.g. `p0/sec-02`), otherwise `feat/…`, `fix/…` or `docs/…`.
- Commits:
  - Small, atomic [Conventional Commits](https://www.conventionalcommits.org). Run `pnpm check` and `pnpm lint` before each commit.
  - Add a `BREAKING CHANGE:` footer when upgrading needs a manual action, and describe that action in the version's entry of `releases.json` (see `RELEASING.md`).
- Merging is done by the lead, only when the maintainer delegated merges for the task:
  1. rebase on `develop` and re-run check and build;
  2. mark the task done in a last commit on the branch: `node docs/roadmap/status.mjs <id> done "<commit range>"`, then commit `docs/roadmap/` (`docs(roadmap): …`);
  3. `git merge --ff-only`;
  4. delete the branch and the worktree.

  Otherwise, stop at the rebased branch and report. No merge commits.

- Push only `develop`, and only after a merge you were allowed to make. Never push `main` or tags; releases are tags created with the maintainer, following `RELEASING.md`.
- CI (`.github/workflows/ci.yml`) runs a check that `drizzle/` matches `schema.ts` (`pnpm db:generate` must add nothing), check, lint, test, i18n check, knip, build and a check that the built app applies `ORIGIN` and answers `/` (`scripts/check-origin.mjs`); a second job builds the Docker image and waits until it is healthy (`scripts/check-image.sh`, which release.yml also runs before it pushes an image), and a third runs `pnpm test:e2e`. It runs on every pull request and every push to `develop`. A failed `pnpm test:e2e` keeps its traces and report as the run's `playwright-report` artifact. After pushing, check that the run passes; if it fails, fix `develop` before anything else, and never tag a red commit.
- Dependencies:
  - pnpm only. Commit `pnpm-lock.yaml` with any `package.json` change.
  - Only versions published at least 7 days ago are installed (`pnpm-workspace.yaml`). Never bypass this without the maintainer.
  - A version range starts at the installed version (`^5.57.1`, not `^5.0.0`), so the declared minimum is the tested one.
  - GitHub Actions are pinned to a full commit SHA, with the version in a comment (`uses: actions/checkout@<sha> # v7.0.1`), because a tag can be moved. To update one, pick a release published at least 7 days ago (`gh release view <tag> -R <owner>/<repo> --json publishedAt`), get its commit with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`, and change the SHA and the comment together, in every workflow that uses it.
  - The `node` base image of the `Dockerfile` is pinned the same way, by its full tag and digest (`node:24.x.y-alpine3.zz@sha256:…`), and updated under the same rule: pick a tag pushed at least 7 days ago (`tag_last_pushed` at `https://hub.docker.com/v2/repositories/library/node/tags/<tag>`, which gives its `digest` too), then check it with `docker buildx imagetools inspect node:<tag>@<digest>`.
  - Packages imported by server code (`*.server.ts`, `src/lib/server`) and native modules stay in `dependencies`. Packages used only by components or at build time go in `devDependencies`, even when SSR uses them: adapter-node bundles them into `build/`, and only `dependencies` reach the Docker image. Exceptions: `@sveltejs/kit` stays in `devDependencies` (adapter-node bundles it) and zod is in `dependencies` for API-01.

## Agent workflow

- **One lead agent per task, in its own git worktree.** The lead owns the result. It may split the work across sub-agents, each given a small, focused context, to keep them accurate.
- **No `git stash`.** All worktrees share one stash stack, so parallel agents can pop each other's entries. Set work aside with a temporary WIP commit instead.
- **Independent review.** When a piece of work is finished, the lead starts a fresh sub-agent that did not write it.
  - The reviewer gets the task, its acceptance criterion and the diff, but not the lead's reasoning. It does not edit.
  - It critiques correctness, simplicity, duplication, conventions and tests.
  - The lead fixes each finding or rejects it with a reason. If the fixes changed behaviour, it asks for one more review, then reports whatever remains.
- **Definition of done:**
  - the acceptance criterion is proven with real evidence;
  - `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm i18n:check`, `pnpm knip`, `pnpm build` and then `pnpm test:e2e` pass;
  - every review finding is fixed, or rejected with a reason in the report.
- **Report.** The lead ends with a summary: branch, what changed, evidence, open points.
- **Safety:**
  - Never touch real data (`docker-data/`, `data/`). The data paths are relative to the working directory by default (`data/cellar.db`; `src/lib/server/paths.ts` lists the variables that move them), so run the app only from a worktree, where `data/` starts empty.
  - `drizzle-kit push`, `pull` and `studio` open `DATABASE_PATH` (`data/cellar.db` by default): run them only from a worktree, with a scratch `DATABASE_PATH`.
  - With `node server.js`, set `ORIGIN=http://localhost:3000`, otherwise browser writes get 403.
  - Stop every server you start: `node server.js` may ignore SIGTERM, so check that it is gone.
