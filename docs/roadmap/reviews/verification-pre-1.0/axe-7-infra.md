# Vérification d’avant 1.0, axe 7 : infra, CI, Docker, releases, documentation

Commit revu `cf48032d` (develop, 1.0.0-rc.1, 2026-10-29). Périmètre : Docker (Dockerfile, compose, `.dockerignore`, image), CI et release (`ci.yml`, `release.yml`, `check-image.sh`, `check-origin.mjs`, `release.mjs`), `releases.json` et contrôle de mise à niveau, documentation (README, README-Docker, RELEASING, AGENTS, `docs/API.md`), outillage, dépendances et architecture transverse, et les tâches P7–P11 de l’axe : REL-03, REL-04, QA-05, REL-05, DEP-06, DOC-03, UI-19. Méthode : le rapport de l’auditeur a7 a été repris ligne par ligne par un vérificateur qui ne l’avait pas écrit, sur sa propre instance : worktree détachée à `cf48032d`, image construite depuis elle (`cellarreview-v7:cf48032d`, arm64) et lancée sur le port 4575 avec des données inventées ; `check-image.sh` rejoué (copie qui nomme son conteneur) sur l’image saine et sur deux images cassées dérivées ; `ghcr.io/lulu300/cellar:0.12.0` (déjà présente en local) lancée sur la base ouverte par 1.0.0-rc.1 ; quelques réponses d’API de 0.11.0 sur le conteneur ; `pnpm build`, `node scripts/check-origin.mjs 4577`, `node server.js` sans `ORIGIN` sur 4578 ; sondes non suivies (créées puis supprimées) pour `no-console`, le typage de `scripts/` et la garde server-only de SvelteKit ; 10 fichiers de test (137 tests) ; `pnpm audit`, `outdated`, `why` ; avis GitHub et dates de publication (`gh api`, `npm view`) ; SHA des actions comparés aux tags par `git ls-remote` ; pieds `BREAKING CHANGE:` de `9df0d08c..cf48032d` relevés par un script à part ; `gh` en lecture seule pour les runs. Le banc de mise à jour n’a pas été relancé (il appartient à « main ») : son résultat est cité depuis `$S/p11/bench-1.0.0-rc.1/`. Chaque verdict autre que « fait », chaque « fait » issu d’un Critique, d’un Majeur, d’un contrôle de sécurité ou d’un critère, plus de la moitié des autres « fait », et les deux constats ont été rejoués. Les portes complètes sont celles du lead (`$S/p12/gates/summary.txt` : check, lint, test 1456, i18n:check, knip, build, e2e 4/4).

Notations : `$S` = `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214/scratchpad`, `$A` = `$S/p12/a7` (preuves de l’auditeur), `$V` = `$S/p12/v7` (preuves du vérificateur), `$B` = `$S/p11/bench-1.0.0-rc.1` (banc de « main »). Les `fichier:ligne` sont ceux de `cf48032d`.

## 1. Résumé

- **Régressions : aucune.** L’auditeur classait SEC-08 « régressé » ; le vérificateur le classe « fait » : le critère de SEC-08 ne vise que les paquets utilisés, et dompurify, seul paquet en alerte, n’est jamais chargé et n’est pas dans l’image (voir V7-m1 et section 6).
- Verdicts, 162 lignes distinctes :
  - traçabilité de l’audit, 99 lignes : 92 fait, 6 fait autrement, 1 sans objet ;
  - constats de l’audit (a7 m1 à m22) : 22 fait ;
  - « Ce qui doit changer à la 1.0.0 » (section 7 de l’audit, plus R3 de la synthèse), 8 lignes : 4 fait, 1 fait autrement, 1 partiel, 2 pas fait (visibilité publique et protection de `main`, prévues au tag de la 1.0.0) ;
  - tâches P7–P11, 33 lignes : 14 fait, 4 fait autrement, 2 partiel, 13 pas fait (presque tous des « Trouvé pendant » hors périmètre, qu’aucune tâche ne reprend) ;
  - total : **132 fait, 11 fait autrement, 3 partiel, 15 pas fait, 0 régressé, 1 sans objet**.
  - Les 15 « Points restés ouverts » de la section 4 de l’audit reprennent des lignes déjà comptées : 13 fait, 2 fait autrement, non recomptés.
- Constats nouveaux : **0 Critique, 0 Majeur, 2 Mineurs** (V7-m1 alerte dompurify de `pnpm audit --prod`, V7-m2 source maps du serveur dans l’image), tous deux confirmés, aucun n’est une régression.
- Essais rejoués :
  - image : `healthy` en 5 s, uid 1000, PID 1 `node server.js`, `/app/build` non inscriptible, 8 paquets de production, ni devDependencies, ni dépendances optionnelles de jsPDF, ni kysely, un seul binaire better-sqlite3, 337 Mo (0.10.0 publiée : 406 Mo), un seul healthcheck, `docker stop` en 0,21 s (code 0), rien d’écrit hors des volumes ;
  - `ORIGIN` : 201 depuis l’origine, 403 `cross_site_request` depuis une autre, 403 texte de SvelteKit pour un `DELETE` de script sans `Origin` ; `check-origin.mjs` 6/6 ;
  - `check-image.sh` : image saine → code 0 ; image qui s’arrête → code 1 ; image dont le healthcheck échoue → chemin d’échec avec le journal du healthcheck ;
  - retour arrière : 0.12.0 refuse la base de 1.0.0-rc.1 (code 1), `cellar.db` inchangé ;
  - version 1.0.0-rc.1 sur toutes les pages admin et dans Préférences, `Vary: Cookie, Accept-Language` sur `/wines` ;
  - `release.mjs check v1.0.0-rc.1` passe ; runs CI 40961826369 et Release 40962610649 de `cf48032d` verts, tous jobs ;
  - banc de « main » : 0.1.0 → 1.0.0-rc.1 et 0.12.0 → 1.0.0-rc.1, « 176 passed, 0 failed » chacun, 13 actions au log et au bandeau : l’auditeur le cite juste.

## 2. Traçabilité (passe 1)

### Revue 7

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R7-M2a | Conteneur en root, `chmod -R 777` | Corrigé | fait | `Dockerfile:61-65` ; conteneur : `uid=1000(node)`, PID 1 en `node`, `touch /app/build/x` → Permission denied, `/app/data` inscriptible (`$V/30-image-content.txt`) |
| R7-M2b | `node_modules` complet dans l’image | Corrigé | fait | `Dockerfile:33` `pnpm prune --prod --no-optional --ignore-scripts` ; image : `archiver better-sqlite3 csv-parse drizzle-orm jspdf qrcode yauzl zod` (plus `$app`, types générés par SvelteKit, 24 Ko), 82 entrées `.pnpm`, aucun vite, typescript, svelte, eslint, vitest, playwright, drizzle-kit ; seul `@types/pako`, dépendance de `fast-png` (jsPDF) (`$V/30-image-content.txt`) |
| R7-M2c | `BODY_SIZE_LIMIT` à 10 Go | Corrigé | fait | `Dockerfile:77` ; `docker image inspect` : `BODY_SIZE_LIMIT=512M` (`$V/30-image-content.txt`) |
| R7-M2d | Paquet `sqlite` au runtime | Corrigé | fait | Aucun `apk add` ; `which sqlite3` → none (`$V/30-image-content.txt`) |
| R7-M3 | La CI publie `:latest` sans contrôle | Corrigé | fait | `release.yml:10-12` (tags `v*`), `:23-30` (`verify` = `ci.yml`, `prepare` `needs: verify`), `:97-98`, `:164-165` ; pas de `docker-publish.yml` ; run 40962610649 : verify/verify, verify/image, verify/e2e, prepare, build ×2, release en succès (`$V/75-ci-runs.txt`) |
| R7-M4a | Ni lint, ni format, ni tests | Corrigé | fait | `package.json:19,23` ; `ci.yml:47-60` ; portes : lint 0 erreur 0 avertissement, 1456 tests |
| R7-M4b | `scripts/test-*.ts` manuels | Corrigé | fait | Aucun `scripts/test-*` (`$V/60-greps.txt`) |
| R7-M4c | `scripts/` non typé | Partiel | fait | `tsconfig.json:9` `scripts/*`, `:15` `drizzle.config.ts`, `checkJs` hérité de `$app/tsconfig` ; sonde : erreur de type dans `scripts/probe-v7.mjs` → `pnpm check` « 1 ERRORS » (`$V/61-probe-check-lint.txt`) |
| R7-M5a | Deux paquets d’icônes | Corrigé | fait | `package.json:33` `@lucide/svelte` ; 59 fichiers importeurs ; 0 `lucide-svelte` (`$V/60-greps.txt`) |
| R7-M5b | Dépendances jamais importées | Corrigé | fait | knip à 0 (portes) ; 8 paquets de `dependencies`, chacun importé par le serveur (`$A/50-server-imports.txt`) |
| R7-M5c | `@internationalized/date` jamais importé | Écart décidé | fait autrement | Décision « Écarts acceptés (DEP-01) » ; `package.json:32` |
| R7-M5d | formsnap et superforms | Corrigé | fait | Absents de `package.json` et du lockfile (`$A/60-greps-r7.txt`) |
| R7-M5e | `@types/*` en `dependencies` | Corrigé | fait | `package.json:40-44` en devDependencies |
| R7-M6a | Deux lockfiles | Corrigé | fait | `git ls-files` : seul `pnpm-lock.yaml` ; `package.json:6` `pnpm@10.34.6` (`$V/60-greps.txt`) |
| R7-M6b | `engine-strict` sans `engines` | Corrigé | fait | `package.json:7-9` `24.x`, `.npmrc` `engine-strict=true`, `.nvmrc` `24` (`$V/60-greps.txt`) |
| R7-m1 | `svelte.config.js`, alias `@/*` | Corrigé | fait | Fichier absent (`$V/60-greps.txt`) |
| R7-m2 | `vite.config.ts` : `rollupOptions`, nanoid | Corrigé | fait | Ni `rollupOptions`, ni `optimizeDeps`, ni nanoid (`$A/60-greps-r7.txt`) |
| R7-m3 | Healthcheck défini deux fois | Partiel | fait | `Dockerfile:80-81` seul (30 s, 10 s, 40 s, 3 essais) ; `docker-compose.yml:1-29` sans healthcheck ; `docker image inspect` : un seul `Healthcheck` (`$V/30-image-content.txt`). Décision « Healthcheck et racine (UI-04) » |
| R7-m4 | Port 3000 ou 3005 | Corrigé | fait | `docker-compose.yml:13` `3005:3000` ; `docker-setup.sh` absent |
| R7-m5a | `utils/theme.ts` mort | Corrigé | fait | Absent (`$A/60-greps-r7.txt`) |
| R7-m5b | Flash du thème clair | Corrigé | fait | Script inline de `src/app.html` (servi par le conteneur) ; `src/lib/utils/theme-colors.test.ts` passé (`$V/84-tests-subset.txt`) |
| R7-m5c | Palette « blue » = `:root` sans test | Non fait | fait | UI-16 : `src/lib/utils/theme-colors.test.ts:145` « applies the colours of %s in app.css », passé (`$V/84-tests-subset.txt`) |
| R7-m6 | `mockData.ts`, `lib/index.ts`, dossiers vides | Corrigé | fait | `find src -type d -empty` vide (`$V/60-greps.txt`) |
| R7-m7 | Deux générateurs d’ID | Corrigé | fait | `src/lib/server/db/schema.ts:27` `$defaultFn(() => randomUUID())` ; compteur des toasts (`$A`) |
| R7-m8a | `ui/` mêle shadcn et maison | Non fait | fait | UI-19 : `ui/` = badge, button, card, checkbox, dialog, input, label, select, separator, table, textarea, tous du registre shadcn-svelte |
| R7-m8b | 27 `<select>` bruts | Partiel | fait | 0 `<select` dans les `.svelte` (`$V/60-greps.txt`) |
| R7-m8c | 455 classes de couleur en dur | Partiel | fait autrement | Décision « Couleurs décoratives et statuts (UI-18) ». 104 classes hors `ui/` avec un motif plus large que celui de l’audit (blanc et noir compris ; l’auditeur en compte 89), dans les seuls fichiers que la décision garde : badges (`wine-badges.ts`), occupation (`storage.ts`, `CaseLoad`), pénurie, badge de pénurie `bg-red-700` (`+layout.svelte:109`), pastilles de `BottleCard`, bouton et légende sur photo (`ImagePicker`), vue caméra (`$V/65-colour-classes.txt`) |
| R7-m9a | `test-labels.pdf` | Corrigé | fait | Non versionné (`$A/60-greps-r7.txt`) |
| R7-m9b | `appellations.csv` en 3 copies | Corrigé | fait | Seul `scripts/data/appellations.csv` (`$A`) |
| R7-m9c | `wine_images_schema.sql` | Corrigé | fait | Absent (`$A`) |
| R7-m9d | `.claude/settings.local.json` versionné | Corrigé | fait | Non versionné (`$A`) |
| R7-m9e | README du gabarit, `docs/` vide | Corrigé | fait | `README.md:1-54` réel ; `docs/API.md`, `docs/roadmap/` |
| R7-QW-volumes | Retirer les volumes nommés | Corrigé | fait | `docker-compose.yml:23-29` bind mounts seulement, pas de `volumes:` racine |
| R7-QW-port | 3000 → 3005 | Corrigé | fait | Voir R7-m4 |
| R7-QW-readme | Vrai README | Corrigé | fait | `README.md:1-54` |
| R7-Indic | Indicateurs chiffrés | Corrigé | fait | Tableau de l’auditeur (`$A/62-indicators.txt`) ; remesurés par le vérificateur : 0 `<select`, 59 importeurs de `@lucide/svelte`, 69 `+server.ts` (68 sous `api/`), lint 0 avertissement, `pnpm audit --prod` 3 alertes (V7-m1) |
| R7-Archi-1 | `src/lib/server/{db,…}` | Partiel | fait | DATA-11 : `src/lib/server/db/`. Sonde : `src/routes/probe-v7/+page.svelte` qui importe `#lib/server/db/index.js` → `pnpm build` code 1, « Cannot import `#lib/server/db/index.ts` into code that runs in the browser » (`$V/63-server-only-guard.txt`). Décision « Architecture (revue 7) » |
| R7-Archi-2 | `src/lib/shared/schemas/` | Corrigé | fait | 12 fichiers (`$A`) |
| R7-Archi-3 | Composants par domaine | Partiel | fait | UI-19 : aucun fichier à la racine de `src/lib/components/` ; dossiers admin, barcode, bottles, forms, layout, preferences, statistics, storage, table, ui, wines = carte d’`AGENTS.md:34-37` |
| R7-Archi-4 | Lecture par `load`, écriture par form actions | Écart décidé | fait autrement | Décisions « Formulaires de vin et de bouteille (UI-06) », « Référentiels (API-03) », « Page stockage (UI-09) » |
| R7-Archi-5 | Stores en `.svelte.ts` | Corrigé | fait | `src/lib/stores/{auth,preferences,toast}.svelte.ts` ; 0 `svelte/store` (`$A`) |
| R7-Archi-6 | Vitest sur une vraie base | Corrigé | fait | `src/test/setup.ts` ; 9 fichiers de test ne laissent aucune nouvelle entrée `cellar-*` dans le dossier temporaire (3400 avant, 3400 après) (`$V/84-tests-subset.txt`) |
| R7-Archi-7 | Playwright 3 ou 4 parcours | Non fait | fait | QA-05 : `e2e/*.spec.ts` (4), portes 4/4, job `e2e` (`ci.yml:87-126`), succès au run 40961826369 (`$V/75-ci-runs.txt`) |
| R7-Archi-8 | Routes minces | Corrigé | fait | `new Database(` seulement à `src/lib/server/db/connection.ts:14` ; règle des routes d’`eslint.config.js` |
| R7-Archi-9 | `routes/api` réservé aux vrais besoins | Écart décidé | fait autrement | Décisions « Endpoints et CSRF (API-06) » et « Chargement côté serveur (UI-04) » ; `src/routes/api/api-doc.test.ts` (2 tests) passé (`$V/84-tests-subset.txt`) |
| R7-FdR-1 | Sécurité : checkOrigin, ORIGIN, cookie, `USER node`, limite | Corrigé | fait | Conteneur : 201 depuis `ORIGIN`, 403 depuis `http://evil.example` (`$V/33-container-origin-version.txt`) ; `check-origin.mjs` 6/6 (`$V/81-check-origin.txt`) ; `src/lib/server/session.ts:28` `httpOnly` ; `Dockerfile:65,77` |
| R7-FdR-2 | Garde-fous et CI verify | Corrigé | fait | `ci.yml:14-68` |
| R7-FdR-3 | Une connexion, WAL, migrations dans `init` | Corrigé | fait | `connection.ts:14,17` ; log du conteneur « Running database migrations… » avant « Listening » (`$V/32-container-logs.txt`) |
| R7-FdR-4 | Validation zod | Corrigé | fait | 55 `parseBody`/`parseFormData`, 0 `request.json()` (`$A`) ; 422 `invalid_body` rejoué sur `download-backup?file=` (`$V/38-api-0.11.0.txt`) |
| R7-FdR-5 | Services par domaine | Corrigé | fait | `src/lib/server/features/` (`$A`) |
| R7-FdR-6 | Load functions | Corrigé | fait | 16 `+page.server.ts` (`$A`) |
| R7-FdR-7 | Svelte 5 complet | Corrigé | fait | 0 `export let`, 0 `svelte/store` (`$A`) |
| R7-FdR-8 | Découpage UI par feature | Partiel | fait | Voir R7-Archi-3 |
| R7-FdR-9 | Image allégée | Corrigé | fait | 337 Mo (arm64) contre 406 Mo pour `ghcr.io/lulu300/cellar:0.10.0` (`$V/09-docker-before.txt`, `$V/30-image-content.txt`) ; `node_modules` 69 Mo |

### SEC-07

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-07 | uid ≠ 0, image plus légère, healthcheck OK | Corrigé | fait | uid 1000 ; 337 Mo ; `healthy` en 5 s (`$V/31-container-health.txt`) ; commande du `HEALTHCHECK` lancée à la main → `code=0` (`$V/34-stop-downgrade.txt`) |
| SEC-07/À-faire-arrêt | `docker stop` sans SIGKILL | Corrigé | fait | `docker stop` 0,21 s, ExitCode 0 (`$V/34-stop-downgrade.txt`) ; hors Docker, SIGTERM → PID 89303 sorti en 400 ms au plus (`$V/83-server-noorigin.log`) ; `scheduler.ts:127-128` `unref()` |
| SEC-07/À-faire-doc | README-Docker : non-root, ports | Corrigé | fait | README-Docker « Data ownership » (`:316`), « Security notes » (`:616`) |
| SEC-07/À-faire-action | Action pour le propriétaire des volumes | Corrigé | fait | Action 0.2.0 d’index 1 (`upgrade-path.mjs 0.1.0 0.2.0`, `$V/40-release-check.txt`) ; banc : volumes en root réparés (`$B/run1-0.1.0-to-1.0.0-rc.1.log`) |

### SEC-08

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-08 | `pnpm audit --prod` sans critique ni haute sur un paquet utilisé | Corrigé | fait | Critère (ROADMAP, SEC-08) : « aucune vulnérabilité critique ou haute sur un paquet utilisé ». `pnpm audit --prod` signale 1 critique, 1 haute, 1 basse, toutes sur `dompurify@3.4.16` par `.>jspdf>dompurify` (`$V/51-audit-prod.txt`). dompurify est une dépendance optionnelle de jsPDF, chargée seulement par `jsPDF.html()` (`require("dompurify")` dans le plugin html de `dist/jspdf.node.min.js`) ; le serveur importe jsPDF à un seul endroit (`src/lib/server/features/labels/pdf.ts:1`) et n’appelle jamais `.html(` ; l’image ne l’a pas (`--no-optional`) (`$V/53-dompurify-usage.txt`, `$V/30-image-content.txt`). Aucun paquet utilisé n’est en alerte. Constat V7-m1 |

### SEC-09

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-09 | Import CSV testé, csv-parse 7 | Corrigé | fait | `package.json:79` `^7.0.3` ; `src/routes/api/admin/import-csv/server.test.ts:69` « modifies no prototype when a header is __proto__ » |
| SEC-09/critère-b | Restauration des modèles d’étiquettes testée | Sans objet | sans objet | Endpoint toujours absent ; décision « Endpoints et CSRF (API-06) » |

### SEC-10

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-10 | Aucun `uses:` externe sur un tag | Corrigé | fait | 15 `uses:` externes (plus `./.github/workflows/ci.yml`), tous en SHA avec la version en commentaire ; les 7 SHA distincts = `git ls-remote` de leur tag, 7 MATCH (`$V/21-action-pins.txt`) ; chaque release publiée au moins 7 jours avant le commit qui l’épingle, par exemple setup-node 7.1.0 publiée le 2026-10-08, épinglée le 2026-10-29 (b0ecfddf) (`$V/71-pins-age.txt`) |
| SEC-10/À-faire-doc | Procédure dans AGENTS.md | Corrigé | fait | `AGENTS.md:88-89` (actions, image de base `node`) |

### QA-01

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| QA-01 | `pnpm test`, un test par module critique | Corrigé | fait | Portes : 158 fichiers, 1456 tests ; `zip.test.ts`, `http/body.test.ts`, `login-attempts.test.ts` (`$A`) |

### QA-02

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| QA-02 | `pnpm lint` passe, formatage appliqué | Corrigé | fait | Portes : Prettier OK, ESLint 0 problème ; `package.json:23` |

### QA-04

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| QA-04 | Une PR qui casse un test ne publie rien | Corrigé | fait | `ci.yml:3-11` (`contents: read`, rien publié) ; publication sur tag seulement, après `verify` (`release.yml:10-12,23-30`) |
| QA-04/Trouvé-1 | `timeout-minutes` | Corrigé | fait | `ci.yml:17,74,89` ; `release.yml:33,109,168` |
| QA-04/Reste-1 | Runner arm64 natif | Non fait | fait | `release.yml:99-106` matrice `ubuntu-24.04` / `ubuntu-24.04-arm`, sans QEMU ; job `build (arm64, ubuntu-24.04-arm)` en succès au run 40962610649 (`$V/75-ci-runs.txt`) |

### DEP-01

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DEP-01 | Un lockfile, rien d’inutilisé, un paquet d’icônes | Corrigé | fait | Voir R7-M5, R7-M6 |
| DEP-01/Trouvé-1 | Paquets du client dans l’image | Corrigé | fait | `dependencies` = les 8 paquets du serveur ; image sans bits-ui, `@lucide/svelte`, barcode-detector, tailwind (`$V/30-image-content.txt`) |

### DEP-02

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DEP-02 | check, test, build après les mineures | Corrigé | fait | svelte 5.57.2, tailwindcss 4.3.3, svelte-check 4.7.7, zod 4.6.7 installés (`$V/60-greps.txt`), bits-ui 2.20.0 (`$V/53-outdated.txt`) ; portes à 0 |

### DEP-03

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DEP-03 | SvelteKit 3, CSRF actif | Corrigé | fait | `@sveltejs/kit` 3.1.0, vite 8.3.5, TypeScript 6.0.3 (`$V/60-greps.txt`) ; `check-origin.mjs` 6/6 (`$V/81-check-origin.txt`), en CI `ci.yml:67-68` |
| DEP-03/Trouvé-1 | `cookie` 0.6.0 figé | Corrigé | fait | Seul `cookie@2.0.1` au lockfile (`$V/60-greps.txt`) |
| DEP-03/Trouvé-2 | tailwind-variants 1 | Corrigé | fait | `tailwind-variants@3.3.1`, un seul `tailwind-merge@3.7.0` (`$V/60-greps.txt`) |
| DEP-03/Trouvé-3 | Correctifs `@types/qrcode`, `@internationalized/date`, typescript | Corrigé | fait | `package.json:32` `^3.12.4` ; TypeScript 6.0.3 ; `@types/qrcode` 1.5.6 (`$A`) |
| DEP-03/Reste-1 | Retirer kit 3.0.1 de l’exception | Corrigé | fait | `pnpm-workspace.yaml:1-5` : `minimumReleaseAge` seul, aucun `minimumReleaseAgeExclude` (`$V/60-greps.txt`) |
| DEP-03/Trouvé-4 | `server.js` dépend de `envPrefix: ""` et de `server` | Corrigé (surveillé) | fait | `vite.config.ts:29`, `server.js:43` ; check-origin en CI et rejoué |
| DEP-03/Trouvé-5 | CLI shadcn et alias `#lib` | Non fait | fait | Vérifié par DEP-06 (« Fait en P10 » : la CLI tourne avec les alias et refuse de tourner sans `"hooks"`). Le retrait de `"hooks"` est la ligne DEP-06 plus bas |
| DEP-03/Reste-2 | `node server.js` sans `BODY_SIZE_LIMIT` | Non fait | fait | `README.md:50` (512 Ko sans la variable, commande avec `BODY_SIZE_LIMIT=512M`) ; pas de défaut dans `server.js`, option laissée par la tâche DOC-03 |

### DEP-04

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DEP-04 | Sauvegarde, restauration, import testés | Corrigé | fait | Portes ; better-sqlite3 13.0.3, archiver `^8.0.0` (`package.json:77`) ; banc : restauration PASS (`$B`) |
| DEP-04/Trouvé-1 | esbuild 0.18 et 0.19 | Partiel | fait autrement | Décision « Alerte esbuild 0.18 (DEP-04) » ; `pnpm why esbuild` : 0.18.20 par drizzle-kit 0.31.11 seul, plus 0.25.9 et 0.28.2 (`$V/53-outdated.txt`) |
| DEP-04/Trouvé-2 | `@types/yauzl` 2.x | Corrigé | fait | `package.json:44` `^3.4.0` |
| DEP-04/Trouvé-3 | `@types/better-sqlite3` en production | Écart décidé | fait | Plus dans l’image depuis REL-05 (aucun `@types+better-sqlite3` dans `.pnpm`, `$V/30-image-content.txt`) ; décision « Types en production (DEP-04) » mise à jour |
| DEP-04/Reste-1 | archiver 8 et yauzl | Corrigé | fait | `package.json:77,83` |
| DEP-04/Reste-2 | esbuild 0.18 par drizzle-kit | Non fait | fait autrement | Décision « Alerte esbuild 0.18 (DEP-04) » |
| DEP-04/Reste-3 | esbuild 0.19 par svelte-i18n | Corrigé | fait | Aucun esbuild 0.19 au lockfile (`$V/60-greps.txt`) |
| DEP-04/Reste-4 | `@types/better-sqlite3` dans l’image | Écart décidé | fait | Absent de l’image (voir Trouvé-3) |
| DEP-04/Reste-5 | Binaires better-sqlite3 de 8 plateformes | Non fait | fait | `Dockerfile:38-41` ; image : `prebuilds/linuxmusl-arm64.node` seul, ni `deps/` ni `src/`, 2,3 Mo (`$V/30-image-content.txt`) |

### REL-01

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| REL-01 | rc → `:dev` et pré-version ; ORIGIN dans `upgrade-path 0.1.0 0.2.0` | Corrigé | fait | `release.yml:18,93-94,196` ; run Release 40962610649 sur le tag v1.0.0-rc.1 en succès (`$V/75-ci-runs.txt`) ; `upgrade-path.mjs 0.1.0 0.2.0` : « Set `ORIGIN`… » en premier (`$V/40-release-check.txt`) |

### REL-02

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| REL-02 | v0.1.0 → dernière : actions ; retour arrière refusé | Corrigé | fait | Banc : « Cellar upgraded from 0.1.0 (judged from the database migrations…) to 1.0.0-rc.1 », 13 actions au log et au bandeau, « 176 passed, 0 failed » (`$B/run1-0.1.0-to-1.0.0-rc.1.log`). Rejoué : `ghcr.io/lulu300/cellar:0.12.0` sur la base ouverte par 1.0.0-rc.1 → « ❌ Cellar 0.12.0 cannot start: this database comes from 1.0.0-rc.1… No data was changed. », code 1, `shasum cellar.db` identique avant et après (`$V/34-stop-downgrade.txt`). Aucun `mandatoryStop: true` (`$V/43-releases-entries.txt`) |
| REL-02/Fait-P4 | Contrôle partagé par la restauration | Corrigé | fait | `src/lib/server/features/backup/service.ts:302` (`checkRestoredDatabase`), import de `putBackUpgradeState` `:28` ; banc : restauration PASS |

### DOC-01

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DOC-01 | Plus rien du modèle `sv` | Corrigé | fait | `README.md:5` → `README-Docker.md#quick-start` |
| DOC-01/Trouvé-1a | CSV dans `docker-data/csv-imports/` | Corrigé | fait | README-Docker « Importing CSV data » (`:385`) |
| DOC-01/Trouvé-1b | `git clone` d’un dépôt privé | Corrigé | fait | README-Docker « Quick start » (`:14`) ; réécriture au tag (décision « Visibilité (REL-01) ») |
| DOC-01/Trouvé-1c | `docker-compose` et `docker compose` | Corrigé | fait | Aucune commande `docker-compose ` dans README-Docker ; `docker-setup.sh` supprimé |
| DOC-01/Trouvé-1d | « Wine Cellar », « 1GB » | Corrigé | fait | `README-Docker.md:1` « Cellar with Docker » ; `:10` « about 400 MB » (image mesurée 337 Mo en arm64 : estimation haute, sans conséquence) |
| DOC-01/Trouvé-1e | Caméra (HTTPS ou localhost) | Corrigé | fait | README-Docker « Scanner camera » (`:163-168`) ; `README.md:16` |

### DOC-02

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DOC-02 | README-Docker vérifié | Corrigé | fait | Rejoué par échantillon : jeton de configuration dans `docker logs`, accepté pour le premier code (`$V/32-container-logs.txt`, `$V/33-container-origin-version.txt`) ; 403 texte « Cross-site DELETE form submissions are forbidden » pour un `DELETE` sans `Origin`, comme `README-Docker.md:159` ; « Health check » (`:607-609`, 30 s) = `docker image inspect` ; « Keep `PORT` at `3000` » (`:592`) = `Dockerfile:81` |

### Décision « Exception Paraglide (UI-10) »

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| Exception Paraglide | Retrait du bloc avant la release | Non fait (pas encore dû) | fait | Retiré (0b8318d0, décision) ; `pnpm-workspace.yaml:1-5` ; `pnpm install --frozen-lockfile` passe (`$V/00-install.log`) |

### Constats de l’audit a7 (m1 à m22)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| a7 m1 | Commentaire du bloc Paraglide | Mineur | fait | Bloc et commentaire retirés ; `pnpm-workspace.yaml:1-5` (`$V/60-greps.txt`) |
| a7 m2 | Résumé 0.8.0 : `/` redirige côté serveur | Mineur | fait | 0 occurrence dans `releases.json` ; `GET /` → 200 dans le conteneur (`$V/33-container-origin-version.txt`) ; `src/routes/+page.svelte:7` meta refresh |
| a7 m3 | `prepare` ne peut pas échouer | Mineur | fait | `package.json:14` sans `\|\| echo ''` ; plus de `RUN pnpm run prepare` ; install et prune `--ignore-scripts` (`Dockerfile:21,33`) |
| a7 m4 | « - undefined » dans le roadmap | Mineur | fait | 0 `- undefined` dans `ROADMAP.md` ; `docs/roadmap/build.mjs:20` lève « élément vide » |
| a7 m5 | Image jamais démarrée avant publication | Mineur | fait | `ci.yml:72-85`, `release.yml:137-149` avant le push `:153-162` ; `check-origin.mjs:104` exige `GET /` 200. Rejoué : image saine → « is healthy », code 0 ; image dont le `CMD` sort → « did not become healthy (state: exited unhealthy) », code 1 ; image sur `PORT=3001` → chemin d’échec avec le journal du healthcheck (ECONNREFUSED sur 3000) (`$V/35-check-image-runs.txt`, `$V/check-image-named.sh`) |
| a7 m6 | Listes « ce que lance la CI » | Mineur | fait | `README.md:34-48`, `RELEASING.md:5,67` et le paragraphe CI d’AGENTS.md = `ci.yml:42-68` + jobs `image` et `e2e` |
| a7 m7 | `.dockerignore` et `.claude/`, `.omc/` | Mineur | fait | `.dockerignore:37-41` ; contexte de build 4,83 Mo depuis une worktree avec `node_modules` (`$V/10-docker-build.log:19`) |
| a7 m8 | Image de base non épinglée | Mineur | fait | `Dockerfile:2` `node:24.22.1-alpine3.24@sha256:06d7adf3…` ; tag poussé le 2026-10-22T02:40Z avec ce digest (Docker Hub), commit 6612866e le 2026-10-29T10:56Z, soit 7 j 8 h (`$V/71-pins-age.txt`) ; `AGENTS.md:89` |
| a7 m9 | Exemple ORIGIN avec le port du conteneur | Mineur | fait | `src/lib/server/upgrade.ts:345` `:3005` ; log de `node server.js` sans `ORIGIN` (`$V/83-server-noorigin.log:19`) |
| a7 m10 | « Wine Cellar » et `docker-setup.sh` | Mineur | fait | Ni label ni « Wine Cellar » dans `docker-compose.yml` ; `docker-setup.sh` absent ; `container_name: wine-cellar` gardé (`docker-compose.yml:7`, décision citée par l’audit) |
| a7 m11 | Dépendances optionnelles de jsPDF dans l’image | Mineur | fait | Ni core-js, ni html2canvas, ni canvg, ni dompurify dans `.pnpm` de l’image (`$V/30-image-content.txt`) |
| a7 m12 | kysely en production | Mineur | fait | Absent de l’image ; décision « Types en production (DEP-04) » |
| a7 m13 | `@types/node` non déclaré | Mineur | fait | `package.json:42` `^24.19.2` |
| a7 m14 | Correctifs disponibles avant la 1.0 | Mineur | fait | DEP-06 (drizzle-orm 0.45.4, svelte 5.57.2, vite 8.3.5…) ; `pnpm outdated` : bits-ui 2.20.1 (publiée le 2026-10-22T19:01Z, 6 j 15 h au moment de la revue groupée, de01688f), TypeScript 7 et `@types/node` 26 écartés (`$V/53-outdated.txt`). La revue à refaire avant le tag : ligne DEP-06 |
| a7 m15 | ESLint périmé, convention de logs | Mineur | fait | `eslint.config.js:39` `no-console` en erreur, `:90` coupé pour le serveur ; sonde : `console.log` dans un composant → « error Unexpected console statement », code 1 (`$V/61-probe-check-lint.txt`) ; règle 9 d’AGENTS.md |
| a7 m16 | Scripts de CI sans tests | Mineur | fait | `scripts/release.test.ts`, `scripts/check-i18n.test.ts`, `vite.config.ts:68` ; passés (`$V/84-tests-subset.txt`) |
| a7 m17 | Import ZIP d’images et `/uploads` sans test | Mineur | fait | `src/routes/api/admin/import-images-zip/server.test.ts`, `src/routes/uploads/[...path]/server.test.ts`, passés (`$V/84-tests-subset.txt`) |
| a7 m18 | AGENTS.md et la règle des routes | Mineur | fait | `AGENTS.md:30` « Routes call a feature’s modules, never its repository… » |
| a7 m19 | `{ id, createdAt, updatedAt }` recopié | Mineur | fait | `schema.ts:27,33` `$defaultFn` ; les 7 `createdAt: now, updatedAt: now` restants sont tous dans des `*.test.ts` (`$V/60-greps.txt`) |
| a7 m20 | `/uploads` lit le disque, imports sans `node:` | Mineur | fait | `src/routes/uploads/[...path]/+server.ts:3,10` `readImageFile` ; aucun import `fs`/`path`/`stream` sans `node:` hors tests (`$V/60-greps.txt`) |
| a7 m21 | Action 0.2.0 sur le cron | Mineur | fait | Texte actuel de l’action 0.2.0 d’index 2 (`$V/40-release-check.txt`) ; 0 « planned for a later version », 0 « saving the settings does not start the scheduler » (`$V/60-greps.txt`) |
| a7 m22 | develop se déclare 0.7.0 | Mineur | fait | REL-03 ; `chore(release): start …` après chaque tag de `9df0d08c..cf48032d` (`$V/42-breaking-commits.txt`) ; refus de 0.12.0 (`$V/34-stop-downgrade.txt`) |

### Points restés ouverts (section 4 de l’audit)

Reprises des lignes ci-dessus, non recomptées.

| Point | Verdict | Preuve |
|---|---|---|
| 1. Exception Paraglide | fait | Ligne « Exception Paraglide » |
| 2. R7-m3 healthcheck unique | fait | R7-m3 |
| 2. DEP-04/Reste-5 binaires better-sqlite3 | fait | DEP-04/Reste-5 |
| 2. DEP-03/Reste-2 `BODY_SIZE_LIMIT` hors Docker | fait | `README.md:50` |
| 2. QA-04/Reste-1 runner arm64 | fait | `release.yml:99-106` |
| 3. esbuild 0.18 (DEP-04/Trouvé-1, Reste-2) | fait autrement | Décision « Alerte esbuild 0.18 (DEP-04) » |
| 3. DEP-03/Trouvé-5 alias shadcn | fait | DEP-03/Trouvé-5 (le retrait de `"hooks"` : ligne DEP-06) |
| 4. R7-M4c `scripts/` typés | fait | `$V/61-probe-check-lint.txt` |
| 5. R7-m5c palette | fait | `theme-colors.test.ts:145` |
| 5. R7-m8a `ui/` | fait | UI-19 |
| 5. R7-m8b `<select>` bruts | fait | 0 restant |
| 5. R7-m8c couleurs en dur | fait autrement | Décision « Couleurs décoratives et statuts (UI-18) » |
| 6. R7-Archi-1 `src/lib/db` | fait | `$V/63-server-only-guard.txt` |
| 6. R7-Archi-3 / R7-FdR-8 composants par domaine | fait | UI-19 |
| 6. R7-Archi-7 Playwright | fait | QA-05 |

### « Ce qui doit changer à la 1.0.0 » (section 7 de l’audit ; R3 de la synthèse)

| Point | Verdict | Preuve |
|---|---|---|
| 1. Visibilité : dépôt et paquet GHCR publics, README-Docker réécrit | pas fait | Prévu au tag de la 1.0.0 par les décisions « Visibilité (REL-01) » et « Avant la 1.0 (P11, P12) ». `gh api repos/Lulu300/cellar` → `private: true` (`$V/75-ci-runs.txt`) ; `README-Docker.md:9` « private until version 1.0.0 », « Using the prebuilt image » (`:93`) ; `ci.yml:16` « private-repo minutes » |
| 2. Protection de `main` | pas fait | Prévu au passage en public, décision « Protection des branches (QA-04) ». `branches/main` → `protected: false` (`$V/75-ci-runs.txt`) |
| 3. Règle 1.x et numérotation de develop | partiel | Fait : règle 1.x (`RELEASING.md:3,33`), « Version of develop » (`:12-18`), étape 5 (`:77`). Reste : `RELEASING.md:3` « in 0.x during the clean-up » et la section « First release: v0.1.0 » (`:44-58`), que l’audit disait devenue de l’historique |
| 4. Entrée de release | fait | Entrée `1.0.0` en tête de `releases.json`, sans « provisional entry », `actions: []` (`$V/43-releases-entries.txt`) ; `release.mjs check v1.0.0-rc.1` → « can be released » (`$V/40-release-check.txt`) |
| 5. Exception Paraglide | fait | Ligne « Exception Paraglide » |
| 6. API-05 : `PUT /api/bottles/{id}` | fait | `src/routes/api/bottles/[id]/+server.ts:8,12` : PATCH et DELETE seulement ; action 0.9.0 et pied `BREAKING CHANGE:` de 711ec31d (`$V/42-breaking-commits.txt`) |
| 7. GET sans appelant et `DELETE /api/storage-cases/{id}` | fait autrement | Décisions « Endpoints et CSRF (API-06) », « Chargement côté serveur (UI-04) », « Page stockage (UI-09) » : gardés et documentés ; `api-doc.test.ts` passé |
| R3. Notes de version justes (a7 m2, a7 m21, a6 m2) | fait | m2 et m21 ci-dessus ; 0 « sorted in place » dans `releases.json` (`$V/60-greps.txt`) |

Pieds `BREAKING CHANGE:` de `9df0d08c..cf48032d` contre `releases.json` (`$V/42-breaking-commits.txt`, `$V/43-releases-entries.txt`) : 12 commits. 0.9.0 : 1 (711ec31d), 1 action (`PUT /api/bottles/{id}`). 0.11.0 : 11 (a7974fc6, 14343154, e5d52fc5, 6305b54d, 75e770f4, 9b284800, b02913fb, 42846fab, 04d6926f, f84e3d91, dafbb929), une seule action qui nomme chacun d’eux (`?filename=`, réponses des PUT, `PUT /api/access-code` 204, `backup` du wipe, 201/204, prix négatifs, 404, `definition`, `appellation`, `next-barcode` 409, `/api/wines`), conforme à la décision « Actions pour les scripts de 0.11.0 ». 0.10.0, 0.12.0 et 1.0.0 : aucun pied, aucune action. L’entrée 1.0.0 (« upgrading needs no manual action ») résume UI-20 et UI-19, seuls changements depuis 0.12.0 (BUG-21 sans commit, « pas un défaut »). `package.json:4` = `1.0.0-rc.1` = tag. Rejoué sur le conteneur : `PUT /api/access-code` 204 sans corps, `PUT /api/settings` renvoie la valeur enregistrée, `download-backup?file=` 422, `POST /api/admin/upload-image` 201, `DELETE /api/admin/images` 204 (`$V/38-api-0.11.0.txt`).

### REL-03 · Numéro de version de develop

| Point | Verdict | Preuve |
|---|---|---|
| Critère : develop porte un numéro de rc, une version plus ancienne refuse sa base ; RELEASING décrit la numérotation et la règle 1.x | fait | `start 0.9.0-rc.0`, `0.9.0-rc.2`, `0.10.0-rc.0`, `0.11.0-rc.0`, `0.12.0-rc.0`, `1.0.0-rc.0` (`$V/42-breaking-commits.txt`) ; refus de 0.12.0 sur la base de 1.0.0-rc.1, code 1 (`$V/34-stop-downgrade.txt`) ; `RELEASING.md:3,12-18` ; `src/lib/server/releases.test.ts` passé (`$V/84-tests-subset.txt`) |
| Trouvé-1 : test `upgrade-actions` avec `0.9.0` | fait | `src/routes/api/admin/upgrade-actions/server.test.ts` prend `99.0.0`, passé (`$V/84-tests-subset.txt`) |
| Trouvé-2 : sauvegarde en version jamais publiée (0.7.5) acceptée | fait autrement | Décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) » : REL-03/2 accepté |
| Trouvé-3 : version seulement dans Préférences | fait | Décision « Version de Cellar (REL-03) » ; conteneur : 1.0.0-rc.1 sur `/admin/settings`, `/admin/backups`, `/admin/images`, `/admin/data/countries`, `/preferences` (`/admin/data` redirige) (`$V/33-container-origin-version.txt`) ; `src/routes/admin/+layout.svelte:25` |

### REL-04 · Notes de version justes

| Point | Verdict | Preuve |
|---|---|---|
| Critère : `releases.json` sans les deux affirmations, `release.mjs check` passe | fait | 0 « sorted in place », action 0.2.0 [2] reformulée (`$V/60-greps.txt`, `$V/40-release-check.txt`) ; `check v1.0.0-rc.1` passe ; workflow Release vert |
| Écart : redémarrage gardé pour les versions avant 0.6.0 | fait autrement | Validé par le mainteneur le 2026-10-18 (« Fait en P7 » de REL-04) ; texte « on a version before 0.6.0, restart the container afterwards » |
| Trouvé-1 : action 0.7.0 et PUT `{ success: true }` | fait | 14343154 (pied `BREAKING CHANGE:`), action 0.11.0 ; `PUT /api/settings` renvoie la valeur, `PUT /api/access-code` 204 (`$V/38-api-0.11.0.txt`) |
| Trouvé-2 : 201/204 promis par 0.7.0 | fait | e5d52fc5, décision « Codes de réponse promis en 0.7.0 (API-07, REL-04) » ; `upload-image` 201, `DELETE /api/admin/images` 204 (`$V/38-api-0.11.0.txt`) |
| Trouvé-3 : pages de release GitHub éditées | fait autrement | Décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) » : REL-04/3 informatif |

### QA-05 · Playwright

| Point | Verdict | Preuve |
|---|---|---|
| Critère : 3 ou 4 parcours qui passent en local et en CI ; un parcours cassé fait échouer la CI ; aucun fichier de `data/` ouvert | fait | 4 parcours, portes 4/4 ; job `e2e` en succès (runs 40961826369 et 40962610649, `$V/75-ci-runs.txt`) ; `pnpm test:e2e` est une étape du job (`ci.yml:114-116`), dont `release.yml:23-30` attend la réussite (lu ; `pnpm test:e2e` interdit au vérificateur) ; `e2e/server.mjs` et `scripts/throwaway-data.mjs` (`$A`) |
| Point ouvert a : serveur sur 127.0.0.1, navigateur sur localhost | fait | Portes 4/4 |
| Point ouvert b : `playwright install` a retiré d’anciens navigateurs du cache | pas fait | Informatif, rien dans le dépôt, aucune décision |

### REL-05 · Image Docker et CI

| Point | Verdict | Preuve |
|---|---|---|
| Critère : version sur toutes les pages admin ; image non `healthy` → CI et release échouent avant push ; un seul healthcheck ; `schema.ts` sans migration → CI rouge ; tailles | fait | `$V/33-container-origin-version.txt` ; `$V/35-check-image-runs.txt` (code 0 / code 1) ; `ci.yml:85`, `release.yml:148-149` avant `:153-162` ; un `Healthcheck` à l’inspect ; `ci.yml:42-45` (`pnpm db:generate` puis `git diff --exit-code drizzle/`, qui voit le `_journal.json` suivi que toute migration modifie) ; 406 Mo (0.10.0) → 337 Mo (arm64) |
| Trouvé-1 : liste CI du README | fait | DOC-03 ; `README.md:34-48` |
| Trouvé-2 : `release.yml` publie une seconde construction | pas fait | `release.yml:137-149` (build `load: true`, contrôle) puis `:153-162` (nouveau build depuis le cache, poussé) |
| Trouvé-3 : le job `image` tourne aussi pendant une release | pas fait | `release.yml:23-26` reprend `ci.yml`, dont `image` (`ci.yml:72-85`) ; « verify / image » au run 40962610649 |

### DEP-06 · Dépendances, lint et tests

| Point | Verdict | Preuve |
|---|---|---|
| Critère : lint sans avertissement, `console.log` d’un composant refusé, `check` type `scripts/`, tests de `release.mjs` et `safeUrl`, aucun `cellar-migrations-*` laissé, `Vary` sur `/wines` | fait | Portes (0 avertissement) ; sondes `$V/61-probe-check-lint.txt` ; `release.test.ts` et `src/lib/utils/url.test.ts` passés, `cellar-migrations-*` 3388 avant et après (`$V/84-tests-subset.txt`) ; `vary: Cookie, Accept-Language` sur `/wines` (`$V/33-container-origin-version.txt`) |
| `"hooks": "#lib/hooks"` de `components.json` à retirer | pas fait | `components.json:11` toujours là, `src/lib/hooks` absent ; raison dans le « Fait en P10 » de DEP-06 (la CLI refuse de tourner sans), qui n’est pas une décision |
| Revue des correctifs « à refaire avant le tag 1.0.0 » | partiel | Revue faite le 2026-10-29, à refaire avant le tag. `pnpm outdated` : bits-ui 2.20.1 (dev) ; dompurify 3.4.17, transitive, éligible depuis le 2026-10-19, corrige 1 critique et 1 haute (V7-m1) (`$V/53-outdated.txt`, `$V/53-dompurify-usage.txt`) |
| Trouvé-1 : `pnpm dlx` ignore l’âge minimal | fait | Règle écrite dans `p11-notes/agent-rules-p11.md:12` et le brief commun ; AGENTS.md (`:86`) ne cite pas `dlx` |
| Trouvé-2 : Paraglide envoie `Vary` sur l’API ; le test vérifie Paraglide | pas fait | `vary: Cookie, Accept-Language` sur `/api/settings` (`$V/33-container-origin-version.txt`) ; informatif |
| Trouvé-3 : runed attend kit 2 | pas fait | Informatif, portes vertes |

### DOC-03 · Documentation

| Point | Verdict | Preuve |
|---|---|---|
| Critère : plus de puce vide ; listes CI = `ci.yml` ; README-Docker sans `data/cellar.db` en dur, liens symboliques, WAL réseau, 403 des scripts | fait | 0 `- undefined` ; listes alignées (a7 m6) ; 0 `data/cellar.db` dans README-Docker ; `README-Docker.md:305-311` (lien symbolique, WAL, NFS/SMB), `:159` (403 texte), vérifié en direct (`$V/33-container-origin-version.txt`) |
| Trouvé-1 : la définition de « fini » d’AGENTS.md omet le contrôle des migrations et `check-origin` | pas fait | `AGENTS.md:102` |
| Trouvé-2 : passages de README-Docker et commentaire du compose qui supposent une image téléchargeable | fait autrement | Décision « Visibilité (REL-01) » : réécrits au tag ; `docker-compose.yml:3-4` |
| Trouvé-3 : en-tête de `check-i18n.mjs` incomplet | partiel | `scripts/check-i18n.mjs:1-13` complété, sauf « une valeur qui n’est pas du texte », que décrivent `AGENTS.md:19` et `README.md:48` |
| Trouvé-4 : port 3000 dans `upgrade.test.ts:351` | pas fait | `src/lib/server/upgrade.test.ts:351` `http://192.168.1.20:3000` (donnée de test) |

### UI-19 · Composants rangés par domaine

| Point | Verdict | Preuve |
|---|---|---|
| Critère : rien à la racine de `components/`, `ui/` = primitives shadcn, portes et parcours passent, diff de déplacements et d’imports | fait | `find src/lib/components -maxdepth 1 -type f` vide ; `ui/` = 11 dossiers du registre ; portes et e2e 4/4 ; diff `a5713927..f21c0d96` : renommages et imports seulement (`$A`, revu sur la liste des 10 commits de `$V`) |
| Trouvé-1 : primitives `ui/` retouchées à la main | pas fait | Informatif |
| Trouvé-2 : état `visible` de `layout/Toast.svelte` | pas fait | `src/lib/components/layout/Toast.svelte` (`$A`) |
| Trouvé-3 : store des toasts dans `src/lib/stores/` | pas fait | `src/lib/stores/toast.svelte.ts` |
| Trouvé-4 : imports relatifs sans `.js` | pas fait | 54 imports relatifs sans extension sur 258 dans `src` hors tests (`./$types` exclu), surtout `features/backup` (17) et `features/csv-import` (12) ; 1 dans `components/` (`forms/LocaleDateInput.svelte` → `./locale-date`) (`$V/64-relative-imports.txt`, `$V/relative-imports.mjs`) |
| Trouvé-5 : dépendances croisées entre dossiers | pas fait | Informatif |

## 3. Nouveaux constats (passe 2)

### Régressions

Aucune.

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

**V7-m1. `pnpm audit --prod` signale une alerte critique et une haute sur dompurify, dépendance optionnelle de jsPDF jamais chargée**
- Ce qui se passe : `pnpm audit --prod` sort en code 1 avec 3 alertes sur `dompurify@3.4.16`, chemin `.>jspdf>dompurify` : GHSA-cg2g-xh64-v4q7 (critique), GHSA-mrv2-3pqr-j5jr (haute), GHSA-c6gr-qvv4-5v3f (basse), publiées le 2026-10-22 vers 16:25 UTC, corrigées en 3.4.17 (publiée le 2026-10-12, éligible à la règle des 7 jours depuis le 2026-10-19). Rien d’exploitable : les trois visent la sortie DOM de DOMPurify ; jsPDF ne le charge que dans `jsPDF.html()`, que le serveur n’appelle pas ; l’image l’écarte (`--no-optional`). Mais l’audit d’un mainteneur ou d’un utilisateur échoue, une installation hors Docker (`pnpm install --prod`) l’installe, et la revue groupée de DEP-06 (2026-10-29), postérieure aux avis, n’a mis à jour que les dépendances directes. `pnpm audit` complet ajoute l’alerte esbuild 0.18 (décision « Alerte esbuild 0.18 (DEP-04) ») et une basse sur `deepmerge` par `@sveltejs/vite-plugin-svelte` (dev).
- Reproduction : worktree de `cf48032d`, `pnpm install --frozen-lockfile`, `pnpm audit --prod`.
- Preuves : auditeur `$A/51-audit-prod.txt`, `$A/52-audit-all.txt`, `$A/30-image-content.txt` ; vérificateur `$V/51-audit-prod.txt`, `$V/52-audit-all.txt`, `$V/53-dompurify-usage.txt` (chargement par `require("dompurify")` dans le plugin html de jsPDF, seul import serveur, dates npm, lockfile de `9df0d08c`), `$V/54-advisories.txt` (dates GitHub), `$V/30-image-content.txt`.
- Où : `pnpm-lock.yaml:1801` (`dompurify@3.4.16`), `package.json:81` (`jspdf`), `src/lib/server/features/labels/pdf.ts:1`.
- Régression : non. Même `dompurify@3.4.16` au lockfile de `9df0d08c` ; seuls les avis sont nouveaux, et le critère de SEC-08 (paquet utilisé) tient toujours.
- Vérification : confirmé, sévérité Mineur gardée (aucun chemin d’exécution, absent de l’image ; reste visible par quiconque lance l’audit). Régression changée de « oui pour le résultat du contrôle » en « non ».

**V7-m2. L’image embarque 286 source maps du serveur (6,0 Mo)**
- Ce qui se passe : `build/server` contient 286 fichiers `.map`, 6,0 Mo sur 13,2 Mo de `build/`. SvelteKit les produit par défaut pour le build SSR, et le Dockerfile copie tout `build/`. Ils ne sont pas servis (0 `.map` dans `build/client`) et Node ne les lit pas sans `--enable-source-maps` : ils ne changent que la taille de l’image (environ 2 % de 337 Mo).
- Reproduction : `docker build -t x .` puis `docker run --rm --entrypoint sh x -c 'find /app/build -name "*.map" | wc -l'`.
- Preuves : auditeur `$A/30-image-content.txt`, `$A/39-sourcemaps-older-images.txt` ; vérificateur `$V/30-image-content.txt`, `$V/39-sourcemaps.txt` (0.7.0 publiée : 179 fichiers, 5,1 Mo ; 0.12.0 : 286, 6,0 Mo ; `cf48032d` : 286, 6,0 Mo).
- Où : `Dockerfile:27,50` ; `vite.config.ts` ne règle pas `build.sourcemap`.
- Régression : non (déjà dans l’image 0.7.0, publiée avant l’audit).
- Vérification : confirmé, Mineur. Optimisation de taille plutôt que défaut : les garder sert à lire une trace avec `--enable-source-maps` ; à trancher par le mainteneur.

## 4. Déjà connus (non comptés)

- `release.yml` pousse une seconde construction depuis le cache, et le job `image` tourne aussi pendant une release : « Trouvé pendant REL-05 ».
- La définition de « fini » d’AGENTS.md omet le contrôle des migrations et `check-origin` ; en-tête de `check-i18n.mjs` ; port 3000 dans `upgrade.test.ts:351` : « Trouvé pendant DOC-03 ».
- Dépôt et paquet GHCR privés, passages de README-Docker et `ci.yml:16` qui le supposent, liens `github.com/Lulu300/cellar/blob/main/…` des logs illisibles hors du dépôt : décisions « Visibilité (REL-01) » et « Avant la 1.0 (P11, P12) », au tag.
- `main` non protégée : décision « Protection des branches (QA-04) ».
- esbuild 0.18 par drizzle-kit (alerte modérée de `pnpm audit`) : décision « Alerte esbuild 0.18 (DEP-04) ».
- Sauvegarde portant une version jamais publiée acceptée : REL-03/2, décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) ».
- Imports relatifs sans extension, état `visible` du toast, store des toasts, primitives `ui/` retouchées, dépendances croisées : « Trouvé pendant UI-19 ».
- `"hooks"` de `components.json` : « Fait en P10 » de DEP-06 (ligne « pas fait » de la passe 1).
- Revue des dépendances à refaire avant le tag 1.0.0 : prévue par DEP-06 (bits-ui 2.20.1 éligible depuis le 2026-10-29 19:01 UTC).
- `HEALTHCHECK` sur le port 3000 en dur : README-Docker dit de garder `PORT` à 3000 (`:592`).
- `@internationalized/date` : décision « Écarts acceptés (DEP-01) ».
- Chaque `pnpm install` affiche « Ignored build scripts: core-js@3.45.1 » (`$V/00-install.log:64`) : suggestion facultative de la correction d’a7 m1 (ajouter core-js à `ignoredBuiltDependencies`), non reprise ; sans effet, core-js n’est pas dans l’image.
- Basse `deepmerge` par `@sveltejs/vite-plugin-svelte` (dev, sans version corrigée) : vue avec V7-m1.

## 5. Corrections du vérificateur

- **SEC-08 : « régressé » → « fait ».** Le critère vise « un paquet utilisé » ; dompurify n’est chargé que par `jsPDF.html()`, jamais appelé, et l’image ne l’a pas. Le code n’a pas changé depuis `9df0d08c` : seule la base d’avis a changé. « régressé » suppose qu’une chose qui marchait est cassée ; ce n’est pas le cas.
- **V7-m1, champ Régression : « non pour le code ; oui pour le résultat du contrôle » → « non ».** Même raison. Sévérité Mineur gardée.
- **DEP-06, ligne `"hooks"` : « partiel » → « pas fait ».** Rien n’a été retiré ; la raison du « Fait en P10 » est un constat technique du lead, pas une décision des « Décisions prises » ni une décision datée du mainteneur, donc ni « partiel » ni « fait autrement ».
- **UI-19/Trouvé-4 : preuve corrigée.** L’auditeur compte 140 imports relatifs sans extension ; le vérificateur en compte 54 sur 258, `./$types` (convention de SvelteKit) exclu, dont 1 seul dans `components/` (`$V/64-relative-imports.txt`). Verdict inchangé (« pas fait »).
- **Pieds `BREAKING CHANGE:` : décompte corrigé.** L’auditeur compte un commit cassant pour 0.8.0 (541a0242) : il précède `9df0d08c` (`git merge-base --is-ancestor`), hors de la plage demandée. Dans `9df0d08c..cf48032d` : 12 commits, 1 pour 0.9.0 et 11 pour 0.11.0. Conclusion inchangée : chaque version cassante a son action.
- **a7 m8 : âge de l’image de base corrigé.** 7 j 8 h (tag poussé le 2026-10-22T02:40Z, commit le 2026-10-29T10:56Z), pas 7 j 9 h. Verdict inchangé.
- **« Ce qui doit changer à la 1.0.0 », points 1 et 2 : « pas fait (dû au tag) » → « pas fait ».** Le mot de verdict seul ; les décisions qui le placent au tag sont dans la preuve.
- **REL-02/Fait-P4 :** l’import de `putBackUpgradeState` est à `service.ts:28` ; la ligne d’appel `:322` citée par l’auditeur n’a pas été revérifiée.
- Aucun constat rejeté, aucun ajouté.

## 6. Désaccords

- **SEC-08 et V7-m1.** Auditeur : « régressé », car `pnpm audit --prod`, à 0 lors de l’audit, échoue depuis la publication des avis le 2026-10-22, et une installation hors Docker installe dompurify. Vérificateur : « fait », car le critère ne compte que les paquets utilisés, et dompurify n’est ni chargé par le code ni présent dans l’image ; V7-m1 reste un constat Mineur, sans régression. Les deux s’accordent sur les faits et sur la correction (passer dompurify en 3.4.17, par exemple dans la revue des dépendances d’avant le tag) ; le mainteneur tranche si un audit propre est exigé pour la 1.0.0.

## 7. Renvois

- Axe 1 : un démarrage refusé (0.12.0 sur une base de 1.0.0-rc.1) laisse un `cellar.db-wal` vide et un `cellar.db-shm` à côté de la base ; `cellar.db` est inchangé (`$A/36-downgrade-refused.txt`). Dans le run du vérificateur, ces deux fichiers existaient déjà avant l’essai, hashes identiques avant et après (`$V/34-stop-downgrade.txt`) : ni confirmé ni infirmé ici.
- Axe 2 : réponses des PUT et codes 201/204 de 0.11.0, rejoués ici seulement sur cinq routes (`$V/38-api-0.11.0.txt`) ; `POST /api/admin/upload-image` répond 201 avec `success` et `message`, comme `docs/API.md` le décrit (« `201` with `success: true`, an English `message` »).

## Nettoyage

- Conteneurs `cellarreview-v7`, `cellarreview-v7-downgrade`, `cellarreview-v7-check-*`, `cellarreview-v7-maps` supprimés ; images `cellarreview-v7:cf48032d`, `:broken-exit`, `:broken-port` supprimées ; aucun volume ni réseau créé (montages dans `$V/docker-vol`). `docker ps -a`, `docker images`, `docker volume ls`, `docker network ls` filtrés sur `cellarreview` : vides ; aucune écoute sur 4575-4579 (`$V/90-docker-cleanup.txt`). `ghcr.io/lulu300/cellar:0.12.0`, déjà présente, n’a été ni tirée ni supprimée.
- Serveurs : `node server.js` PID 89303 arrêté par SIGTERM, `ps -p 89303` → parti ; le serveur de `check-origin.mjs` (4577) est sorti avec son script, rien n’écoute sur 4577 ; aucun processus de la worktree avant sa suppression.
- Worktree `$S/p12/wt-v7` supprimée (`git worktree remove --force`), absente de `git worktree list` (`$V/91-worktree-list.txt`).
