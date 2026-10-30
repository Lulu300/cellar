# Releasing

Versions follow SemVer and start at 1.0.0, the first public release: a patch version never needs a manual action, a major version is only for an action that concerns every user and without which Cellar does not work, and a conditional action (for your own scripts, for the cron backup mode…) goes in a minor version. In practice, the version after a final release is at least its next minor version (see [Version of develop](#version-of-develop)); a patch version only fixes a release whose images are already published, before `develop` moves on (see [When the workflow fails](#when-the-workflow-fails)).

A release is a git tag. Pushing it runs `.github/workflows/release.yml`. It first runs `.github/workflows/ci.yml` on the tagged commit, its `verify` job (migrations matching `schema.ts`, type-check, lint, tests, translation check, knip, build, and the `ORIGIN` check of the built server), its `image` job (the Docker image must become healthy) and its `e2e` job (the end-to-end journeys), then checks the release, builds the Docker image for amd64 and arm64, each on a runner of that platform, starts each one and waits until it is healthy before pushing it, tags the two as one multi-platform image, and creates the GitHub release. Pushes without a tag publish nothing. `ci.yml` also runs on every pull request and every push to `develop`, without publishing anything.

| Tag           | Tagged on | Docker tags              | GitHub release |
| ------------- | --------- | ------------------------ | -------------- |
| `vX.Y.Z-rc.N` | `develop` | `dev`, `X.Y.Z-rc.N`      | pre-release    |
| `vX.Y.Z`      | `main`    | `latest`, `X.Y.Z`, `X.Y` | release        |

## Version of develop

Between two tags, `develop` carries the number of the next release candidate, so that a build of `develop`, such as one made from a Git checkout, never claims to be a published version. Cellar records its version in the database when it starts, and an older version refuses to start on that database: a build that called itself the last release would let that release start again on a database that newer migrations have changed.

After each tag, `develop` moves to the next rc number: `1.1.0-rc.2` after `1.1.0-rc.1`, and `1.2.0-rc.0` after `1.1.0`, with a new entry for `1.2.0` at the top of `releases.json`, since a build needs an entry for its version. The first tagged rc of a version is `rc.1`. The number of `develop` is a floor: the next version may get a higher number (rename its entry when you prepare its first rc), never a lower one, which a database opened by a build of `develop` would refuse. After `1.1.0`, a release with fixes only is therefore `1.2.0`, not `1.1.1`.

A build of `develop` counts as a release candidate of its version: once a database has run one, the actions added to that version later are shown neither by newer builds nor by the release (see `actions` below).

## releases.json

`releases.json` holds one entry per version, newest first. The release notes, `CHANGELOG.md`, `UPGRADING.md` and `scripts/upgrade-path.mjs` all read it, and so does the upgrade check that Cellar runs at startup (`src/lib/server/upgrade.ts`), which bundles it into the build: it refuses to start past a skipped mandatory stop, and lists the actions in its log and in the Admin page. The rules they share (version order, an rc counting as its final version, the steps and stops between two versions) live in `src/lib/server/releases.js`.

```json
{
  "version": "1.1.0",
  "summary": "What this version brings, in a few sentences of Markdown.",
  "mandatoryStop": false,
  "actions": ["One manual step the user must take when upgrading to 1.1.0, in Markdown."]
}
```

- `actions`: add the action in the same change as the commit that requires it, which also carries a `BREAKING CHANGE:` footer. Put it in the entry of the next version, creating the entry at the top if needed. A version with actions must be a minor or major version, as described at the top; nothing enforces this, so check it when choosing the version. Write actions for users, and use absolute links: relative links break in the GitHub release notes. The Admin page stores each action by its version and its position in the list: add a new action only at the end of its list, and never remove or reorder an action of a published version (reword it in place instead). Actions are shown in the Admin page with a subset of Markdown: `code`, **bold** and absolute links; anything else shows as typed.

  The release check fails when a version contains a breaking commit (`BREAKING CHANGE:` footer or `type!:`) but has no action at all. It works per version, not per commit: once a version has one action, further breaking commits pass. Whoever adds a breaking commit must add or update its action by hand. Once a release candidate of a version has shipped, avoid adding actions to that version: rc users would never see them, because an rc counts as its final version. If it cannot be avoided, announce the new action in the final release's summary. Builds of `develop` carry the rc number of the next version all along, so they only show the actions that existed when a database first ran that version: whoever builds `develop` reads the actions of each release in its release notes.

- `mandatoryStop`: `true` when users must install and start this version before upgrading past it, for example because it runs a data migration that later versions no longer contain. A configuration change, like a new environment variable, is not a stop: it can be done when upgrading straight to a later version.
- `summary`: required. When you create an entry early, write what you know; complete it just before the release.

`CHANGELOG.md` and `UPGRADING.md` are generated: never edit them. Each changelog section holds the summary, the upgrade actions and the changes since the previous final version, which git-cliff (`cliff.toml`) builds from the Conventional Commits. The GitHub release notes are the same section. A release candidate covers everything since the previous final version too.

`node scripts/upgrade-path.mjs <from> <to>` prints the actions and mandatory stops between two versions. `<to>` must have an entry in `releases.json`; a release candidate counts as its final version.

## First public release: v1.0.0

1.0.0 is the first public release: it has no previous version, so no entry of `releases.json` and no tag come before it. Since `scripts/release.mjs` compares a version with the tag of the one before it, the release notes and the changelog section of 1.0.0 hold its summary and its upgrade actions, without a list of changes, and its release check finds no earlier commit to look for breaking changes in.

There is no `main` branch before 1.0.0 either: in step 2 of [Final release](#final-release), create it from the release commit with `git switch -c main` instead of `git switch main` and `git merge --ff-only develop`.

## Release candidate

1. On an up-to-date `develop`, complete the entry of `X.Y.Z` in `releases.json`.
2. Set the version and regenerate the files, then review the diff:
   ```bash
   node scripts/release.mjs prepare X.Y.Z-rc.N
   ```
3. Run the commands CI runs before the build (`pnpm db:generate`, which must add nothing to `drizzle/`, then `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm i18n:check` and `pnpm knip`), then commit everything as `chore(release): X.Y.Z-rc.N`. The changelog leaves out this commit; with any other message, the release check reports `CHANGELOG.md` as out of date.
4. Push `develop` and wait for its CI run to pass, its `verify`, `image` and `e2e` jobs all. Then run the check the workflow runs, tag and push the tag:
   ```bash
   git push origin develop
   gh run list --commit "$(git rev-parse HEAD)"   # the CI run; note its ID (empty for a few seconds)
   gh run watch <run-id> --exit-status
   node scripts/release.mjs check vX.Y.Z-rc.N
   git tag -a vX.Y.Z-rc.N -m "X.Y.Z-rc.N"
   git push origin vX.Y.Z-rc.N
   ```
5. Once the release workflow has passed, so that a failed release can still be tagged again with the same version, and before merging anything else into `develop`, move `develop` to the next rc number (see [Version of develop](#version-of-develop)): set `version` to `X.Y.Z-rc.<N+1>` in `package.json`, commit it alone as `chore(release): start X.Y.Z-rc.<N+1>`, and push `develop`. It cannot go in the release commit, which must carry the version of its tag.

## Final release

1. On `develop`, prepare `X.Y.Z` as above and commit it as `chore(release): X.Y.Z`.
2. Push `develop` and wait for its CI run to pass, its `verify`, `image` and `e2e` jobs all. Then fast-forward `main` to that commit, check, tag and push:
   ```bash
   git push origin develop
   # Wait for the CI run with gh run list and gh run watch, as for a release candidate
   git switch main
   git merge --ff-only develop
   git push origin main
   node scripts/release.mjs check vX.Y.Z
   git tag -a vX.Y.Z -m "X.Y.Z"
   git push origin vX.Y.Z
   git switch develop
   ```
3. Once the release workflow has passed, and before merging anything else into `develop`, start the next minor version on `develop`: set `version` to `X.<Y+1>.0-rc.0` in `package.json`, add an entry for `X.<Y+1>.0` at the top of `releases.json` with a first summary line, commit both as `chore(release): start X.<Y+1>.0-rc.0`, and push `develop`.

## When the workflow fails

If any job before `release` fails, nothing was published: the builds push their images without a tag, and only the `release` job tags them, once both are built. When the failure comes from the code, delete the tag (`git push origin :refs/tags/vX.Y.Z-rc.N` and `git tag -d vX.Y.Z-rc.N`), fix the problem, prepare and commit again, and push the tag again.

If any step, `verify` included, fails for an outside reason (registry, network, GitHub, or a job stopped by its time limit), re-run the workflow: it pushes the same image tags again. "Re-run failed jobs" is enough: it re-runs only the failed or cancelled jobs and the ones after them, and reuses the image of a platform whose build passed. If the `release` job then fails on an empty digest, use "Re-run all jobs". A re-run cannot fix a failure in the code or the Dockerfile, since it builds the same commit. If nothing was published yet, delete the tag, fix, and tag the fixed commit with the same version, as above. If the image tags were already pushed by the `release` job, publish the fix as a new rc or a new patch version instead, before `develop` moves to the next rc number.

Re-running the workflow of an older release moves `:dev` or `:latest` back to that release's image.
