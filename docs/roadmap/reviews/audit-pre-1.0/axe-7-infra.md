# Audit d'avant 1.0, axe 7 : infra, architecture, CI, Docker, releases et docs

Commit audité `9df0d08c` (develop, 2026-10-16). Périmètre en trois parties : Docker, CI, releases, contrôle de mise à niveau et documentation (partie A) ; outillage, dépendances, architecture transverse et qualité des tests (partie B) ; chemin de mise à jour de 0.1.0 et de 0.7.0 vers develop (partie C). Méthode : lecture du code, image Docker construite et lancée depuis une worktree détachée, `node server.js` lancé avec des données inventées, `release.mjs` et `upgrade-path.mjs` en lecture seule, `pnpm audit`, `outdated` et `why`, SHA des actions comparés aux tags publics par `git ls-remote`. Pour la partie C, deux instances (0.1.0 et 0.7.0) remplies de données inventées ont été mises à jour vers develop, hors Docker et dans Docker. Chaque constat a été revu par un second agent qui cherchait à le réfuter. Deux des points signalés par d'autres axes ont été vérifiés par le rédacteur et retenus ; le troisième (message d'échec de migration) est confié à l'axe 1.

## 1. Résumé

L'infra demandée par la revue 7 est en place. Le conteneur tourne en `node` (uid 1000), sans devDependencies ni `sqlite`, avec `BODY_SIZE_LIMIT=512M`. La CI lance check, lint, test, i18n, knip, build et check-origin, et la publication exige un tag et le job `verify`. Les 7 actions sont épinglées par SHA. Les deux mises à jour testées (0.1.0 → develop, 0.7.0 → develop) ne perdent aucune donnée, affichent les 10 actions attendues, et le retour à une version plus ancienne est refusé sans rien écrire. Sur 99 lignes de traçabilité, 76 sont corrigées.

Il ne reste aucun Critique ni Majeur. Le seul point bloquant du tag est prévu par une décision : retirer l'exception Paraglide de `pnpm-workspace.yaml` après le 2026-10-16 à 23:07 UTC (m1). Les Mineurs les plus utiles avant 1.0 sont l'image jamais démarrée avant publication (m5), l'action 0.2.0 sur le cron devenue fausse (m21) et le build de develop qui se déclare 0.7.0, ce qui désactive le refus de retour arrière entre deux versions (m22). La partie B laisse surtout du rangement : la structure par feature de la revue 7, Playwright et `src/lib/db` hors de `src/lib/server` restent à trancher.

## 2. Traçabilité (passe 1)

99 lignes : 76 Corrigé, 8 Partiel, 9 Non fait, 1 Sans objet, 5 Écart décidé.
- Revue 7 : 54 lignes (41 Corrigé, 7 Partiel, 3 Non fait, 3 Écart décidé).
- Tâches : 45 lignes (35 Corrigé, 1 Partiel, 6 Non fait, 1 Sans objet, 2 Écart décidé).

Les vérificateurs ont contrôlé toutes les lignes des parties A et B. Ils ont changé un verdict (R7-Archi-4, Partiel → Écart décidé) et ajouté deux lignes (R7-Archi-8 et R7-Archi-9). Le doublon de healthcheck, vu par les parties A et B, n'a qu'un verdict : Partiel. La partie C n'a pas de ligne de passe 1. R7-C1 est traité à l'axe 2, R7-C2 et R7-M1 à l'axe 1, R7-M7 à l'axe 5.

### Revue 7

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R7-M2a | Conteneur en root, `chmod -R 777` | Corrigé | `Dockerfile:51-55` (`chown node:node` des 3 dossiers de volume, `USER node`). Dans le conteneur : `id` → `uid=1000(node)`, PID 1 en `node`, `touch /app/build/x` → `Permission denied` |
| R7-M2b | `node_modules` complet copié dans l'image | Corrigé | `Dockerfile:31` `pnpm prune --prod` avant la copie (l. 43). Image : 0 paquet vite, typescript ou svelte ; 103 paquets, 126 Mo |
| R7-M2c | `BODY_SIZE_LIMIT` à 10 Go | Corrigé | `Dockerfile:67` `ENV BODY_SIZE_LIMIT=512M` (décision SEC-07) |
| R7-M2d | Paquet `sqlite` au runtime | Corrigé | Aucun `apk add` ; `which sqlite3` vide dans l'image |
| R7-M3 | La CI publie `:latest` sans contrôle | Corrigé | `release.yml:14-20` : `verify` (= `ci.yml`) puis `release` `needs: verify`, seulement sur tag `v*` (l. 7-9) ; `docker-publish.yml` supprimé |
| R7-M4a | Ni lint, ni format, ni tests | Corrigé | `package.json:17,20` ; gates : lint 0 erreur, Prettier OK, 110 fichiers et 976 tests ; CI `ci.yml:41-56` |
| R7-M4b | `scripts/test-*.ts` manuels | Corrigé | `ls scripts` : plus aucun `test-*` |
| R7-M4c | `scripts/` non typé | Partiel | Scripts en `.mjs`, lus par ESLint (`eslint.config.js:86-90`), mais aucun outil n'en vérifie les types : `tsconfig.json:7` n'inclut que `src`, `vite.config.ts` et `knip.config.ts` ; `drizzle.config.ts` n'est pas typé non plus |
| R7-M5a | Deux paquets d'icônes | Corrigé | Seul `@lucide/svelte` (`package.json:30`), 55 importeurs ; 0 `lucide-svelte` |
| R7-M5b | Dépendances jamais importées | Corrigé | Retirées, sauf zod, maintenant importé 24 fois ; knip à 0 |
| R7-M5c | `@internationalized/date` jamais importé | Écart décidé | Décision « Écarts acceptés (DEP-01) » : dépendance pair de bits-ui |
| R7-M5d | formsnap et superforms pour `ui/form/` seulement | Corrigé | Absents de `package.json` et du lockfile ; `ui/form` supprimé |
| R7-M5e | `@types/*` en `dependencies`, deux obsolètes | Corrigé | En devDependencies (`package.json:36-39`) ; `@types/csv-parse` et `@types/jspdf` retirés |
| R7-M6a | Deux lockfiles | Corrigé | `git ls-files` : seul `pnpm-lock.yaml` ; `packageManager: pnpm@10.34.6` |
| R7-M6b | `engine-strict` sans `engines` | Corrigé | `package.json:7-9` `"node": "24.x"`, `.npmrc`, `.nvmrc` |
| R7-m1 | `svelte.config.js` : alias `@/*`, commentaires adapter-auto | Corrigé | Fichier supprimé (DEP-03) ; aucun reste hors `docs/` |
| R7-m2 | `vite.config.ts` : `rollupOptions.external`, réglages `nanoid` | Corrigé | `vite.config.ts:44-73` sans `rollupOptions`, `optimizeDeps` ni `ssr` ; nanoid retiré |
| R7-m3 | Volumes nommés inutilisés ; healthcheck défini deux fois | Partiel | Volumes retirés (`docker-compose.yml:23-29`, bind mounts seulement). Healthcheck toujours dans `Dockerfile:70-71` (timeout 3 s, start period 5 s) et `docker-compose.yml:30-39` (10 s, 40 s), celui du compose l'emporte. La décision « Healthcheck et racine (UI-04) » ne tranche pas ce doublon |
| R7-m4 | Port 3000 ou 3005 selon le document | Corrigé | `docker-setup.sh:26` et `README-Docker.md:54` donnent 3005 ; 3000 n'apparaît que comme port du conteneur |
| R7-m5a | `utils/theme.ts` mort | Corrigé | Supprimé (UI-01) |
| R7-m5b | Flash du thème clair | Corrigé | Script inline `src/app.html:6-25` ; test `theme-colors.test.ts` « applies the colours that the app applied last » |
| R7-m5c | Palette « blue » de `theme-colors.ts` = `:root` | Non fait | `theme-colors.ts:9` = `app.css:15`, `theme-colors.ts:18-34` = `app.css:43-60` ; aucun test ne garde l'alignement |
| R7-m6 | `mockData.ts`, `lib/index.ts`, dossiers de test vides | Corrigé | Absents ; `find src -type d -empty` vide |
| R7-m7 | Deux générateurs d'ID | Corrigé | Serveur : `randomUUID` seul ; toasts : compteur commenté (`toast.svelte.ts:14`) |
| R7-m8a | `ui/` mélange shadcn et composants maison | Non fait | `ui/SearchableSelect.svelte`, `ui/LocaleDateInput.svelte`, `ui/locale-date.ts` toujours dans `ui/` |
| R7-m8b | 27 `<select>` bruts | Partiel | 12 restants (`grep -rnoE "<select\b" src --include='*.svelte'`) |
| R7-m8c | 455 classes de couleur en dur | Partiel | 395 restantes (même grep que la revue) |
| R7-m9a | `test-labels.pdf` | Corrigé | Plus versionné |
| R7-m9b | `appellations.csv` en 3 copies | Corrigé | Seuls les 6 `scripts/data/*.csv` ; `.gitignore:26` `/csv-imports/` |
| R7-m9c | `wine_images_schema.sql` | Corrigé | Absent |
| R7-m9d | `.claude/settings.local.json` versionné | Corrigé | `.gitignore:29` ; `git ls-files .claude` vide |
| R7-m9e | README du gabarit `sv`, `docs/` vide | Corrigé | `README.md` réécrit ; `docs/roadmap/` |
| R7-QW-volumes | Quick win : retirer les volumes nommés | Corrigé | `grep -n '^volumes:' docker-compose.yml` vide |
| R7-QW-port | Quick win : 3000 → 3005 | Corrigé | Voir R7-m4 |
| R7-QW-readme | Quick win : vrai README | Corrigé | `README.md:1-48` : fonctions, développement, renvois vers README-Docker, UPGRADING, AGENTS, RELEASING |
| R7-Indic | Indicateurs chiffrés | Corrigé | Tous en nette progression, voir le tableau ci-dessous |
| R7-Archi-1 | `src/lib/server/{db,auth,config,features}` | Partiel | Domaines, auth (`session.ts`) et configuration (`paths.ts`) sont là. La base reste dans `src/lib/db/`, que la garde server-only de SvelteKit ne couvre pas (`kit/src/exports/vite/utils.js:195-196`) ; seule la règle de lint des routes l'interdit, pas celle des composants. Aujourd'hui, seuls `shared/dto.ts:10` et `app.d.ts:3` l'importent, en type |
| R7-Archi-2 | `src/lib/shared/schemas/` | Corrigé | 9 fichiers de schémas, 2 tests |
| R7-Archi-3 | Composants par domaine (`lib/features/<domaine>/components`) | Partiel | Pas de `lib/features/` ; sous-dossiers `components/{admin,barcode,bottles,forms,layout,storage,table}`, mais 10 gros composants à la racine de `components/` |
| R7-Archi-4 | Lecture par `load`, écriture par form actions | Écart décidé | Lecture faite (16 `+page.server.ts`). Écritures en `fetch` vers l'API JSON hors vins et bouteilles : décisions UI-06, API-03 et UI-09 (vérificateur ; l'auditeur disait Partiel) |
| R7-Archi-5 | Stores globaux en `.svelte.ts` | Corrigé | `stores/{auth,preferences,toast}.svelte.ts` ; 0 `svelte/store` |
| R7-Archi-6 | Vitest sur une vraie base SQLite | Corrigé | `src/test/setup.ts:10-30` (base temporaire migrée), `:34-46` (refus de tout autre fichier) |
| R7-Archi-7 | Playwright pour 3 ou 4 parcours | Non fait | Aucun test de bout en bout, ni dans `package.json`, ni dans `ci.yml`, ni dans une tâche |
| R7-Archi-8 | Routes minces : zod → service → réponse (ajoutée par le vérificateur) | Corrigé | 0 `await request.json()` ; `new Database(` seulement à `connection.ts:12` ; lint des routes `eslint.config.js:50-85`. Deux écarts : m18 et m20 |
| R7-Archi-9 | `routes/api` réservé aux vrais besoins JSON (ajoutée par le vérificateur) | Écart décidé | Décisions API-03 et UI-06 : l'API JSON reste le chemin d'écriture de l'admin et des formulaires. Les GET sans appelant sont traités à l'axe 2 |
| R7-FdR-1 | Sécurité : checkOrigin, ORIGIN, cookie httpOnly, `USER node`, BODY_SIZE_LIMIT | Corrigé | `vite.config.ts:52-56`, `csrf.ts`, `docker-compose.yml:22`, `session.test.ts`, `Dockerfile:55,67` |
| R7-FdR-2 | Garde-fous et CI verify | Corrigé | `ci.yml:41-61` |
| R7-FdR-3 | Une connexion, WAL, migrations dans `init` | Corrigé | `connection.ts:12,15-24`, `hooks.server.ts:27` |
| R7-FdR-4 | Validation zod | Corrigé | 58 appels `parseBody`/`parseFormData`, 0 `request.json()` direct |
| R7-FdR-5 | Services par domaine | Corrigé | `src/lib/server/features/*/{repository,service}.ts` ; import CSV découpé (697 lignes) |
| R7-FdR-6 | Load functions | Corrigé | Voir les indicateurs |
| R7-FdR-7 | Svelte 5 complet | Corrigé | 0 composant Svelte 4, 0 `svelte/store` |
| R7-FdR-8 | Découpage UI par feature | Partiel | Plus aucun fichier au-dessus de 1000 lignes (`WineListView.svelte`, 957), mais pas d'arborescence par feature (R7-Archi-3) |
| R7-FdR-9 | Image allégée | Corrigé | `pnpm prune --prod`, plus de `sqlite` ; 410 Mo sur disque, 88,1 Mo compressés |

#### Indicateurs chiffrés, remesurés

Revue 7 au commit 556c7bb, comparée à 9df0d08c. Chiffres reproduits par le vérificateur.

| Indicateur | Revue 7 (556c7bb) | Maintenant (9df0d08c) | Mesure |
|---|---|---|---|
| Fichiers `.svelte`/`.ts`/`.js` dans `src/` | 245 (≈ 37 600 l.) | 345 hors tests (28 294 l.), plus 122 fichiers de tests et d'aides (13 493 l.) | `git ls-files src`, `wc -l`, Paraglide généré exclu |
| Erreurs / avertissements svelte-check | 0 / 0 | 0 / 0 | gates : « 0 ERRORS 0 WARNINGS » |
| Plus gros fichiers | `admin/+page.svelte` 1749, `barcode/+page.svelte` 1685, `import-csv/+server.ts` 1508 | `WineListView.svelte` 957, `wines/[id]/+page.svelte` 894, `BulkBarcodeDialog.svelte` 657, `BottleDetailsDialog.svelte` 637 | `wc -l \| sort -rn` |
| Pages / endpoints `+server.ts` | 11 / 77 | 16 / 69 | `git ls-files src/routes` |
| Load functions | 1 (triviale) | 16 `+page.server.ts`, 3 `+layout(.server).ts`, 1 `+page.ts` | idem |
| `fetch(` côté client | 132 (36 `.svelte`) + 52 (lib) | 10 (6 `.svelte`) + 8 (lib), plus le client `request()` de `#lib/api/client.ts` | grep |
| Composants Svelte 4 | 14 | 0 (0 `export let`, `$:`, `createEventDispatcher`, `on:`) | grep |
| Fichiers à runes | 44 | 116 sur 121 `.svelte` | grep |
| Fichiers qui importent `svelte/store` | 17 | 0 | grep |
| `any` | 478 (85 serveur) | 4 (`backup/repository.ts:42`, `server/releases.js:45` en JSDoc, `utils.ts:9,11` de shadcn) | grep |
| `console.log` / `console.error` | 311 / 362 | 33 / 46 ; 91 avertissements `no-console` | grep, gates |
| `await request.json()` sans validation | 50 | 0 | grep |
| `new Database(...)` dans `src/` | 25 | 1 (`src/lib/db/connection.ts:12`) | grep |
| Clés i18n absentes | 30 | 0 | `i18n:check` |
| Dépendances jamais importées | 8 | 0 | knip |
| Tests automatisés | 0 | 110 fichiers, 976 tests, 4,3 s | gates |
| `pnpm audit` | 128 (3 critiques, 55 hautes) | 1 modérée (outil de dev) ; `--prod` : 0 | voir SEC-08 |
| Désactivations en ligne | 2 `eslint-disable` | 11 `eslint-disable`, toutes justifiées ; 0 `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `svelte-ignore` | grep |

### SEC-07

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-07 | `id -u` ≠ 0, image plus légère, healthcheck OK | Corrigé | uid 1000 ; 410 Mo, 88,1 Mo compressés ; base neuve `healthy after 5s` ; commande du `HEALTHCHECK` lancée à la main → 200, code 0 |
| SEC-07/À-faire-arrêt | `docker stop` sans attendre le SIGKILL | Corrigé | `time docker stop` → 0,15 s, code 0 ; hors Docker, SIGTERM → sortie en 0,13 s (timer en `unref()`, `scheduler.ts:104-106`) |
| SEC-07/À-faire-doc | README-Docker : non-root, ports | Corrigé | `README-Docker.md:296,576-578` conformes à l'image mesurée |
| SEC-07/À-faire-action | Action de mise à jour pour le propriétaire des volumes | Corrigé | Deuxième action de 0.2.0 (`releases.json`), reprise dans `UPGRADING.md` ; rejouée en partie C |

### SEC-08

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-08 | `pnpm audit --prod` sans alerte critique ni haute | Corrigé | `pnpm audit --prod` → « No known vulnerabilities found ». Audit complet : 1 modérée, esbuild ≤ 0.24.2 par `drizzle-kit > @esbuild-kit/esm-loader` (dev). jspdf 4.2.1, drizzle-orm 0.45.3 ; PDF couvert par `api/barcode/pdf-labels/server.test.ts` |

### SEC-09

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-09 | `audit --prod` à 0 et import CSV testé | Corrigé | csv-parse `^7.0.3` ; `import-csv/server.test.ts:68` « modifies no prototype when a header is \_\_proto\_\_ » ; seeding `migrations.test.ts:71,79` |
| SEC-09/critère-b | Restauration des modèles d'étiquettes testée | Sans objet | Endpoint `restore-label-presets` supprimé (décision « Endpoints et CSRF (API-06) ») |

### SEC-10

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-10 | Aucun `uses:` externe sur un tag | Corrigé | 9 `uses:` en SHA avec la version en commentaire (`ci.yml:21,27`, `release.yml:34,42,62,65,68,77,89`) ; `git ls-remote` → les 7 SHA correspondent à leur tag ; tags v0.4.0-rc.1 à v0.7.0 publiés depuis l'épinglage (6451719f). Exécutions GitHub non lues (pas d'identifiants) |
| SEC-10/À-faire-doc | Procédure de mise à jour dans AGENTS.md | Corrigé | `AGENTS.md`, Git → Dependencies, « GitHub Actions are pinned… » |

### QA-01

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| QA-01 | `pnpm test` passe, un test par module critique | Corrigé | 976 tests. Codes-barres (`shared/barcode.test.ts`, `features/barcode/service.test.ts`), `resolveInDir` (`paths.test.ts:17-30`), `extractZip` (`zip.test.ts:75-179` : traversée, zip bomb, 10 000 entrées, deflate corrompu), `detectImageType` (`upload.test.ts:11`), 413 (`http/body.test.ts`), sessions, limite de tentatives (`login-attempts.test.ts:21-85`), scrypt et 1234 (`access-code.test.ts:28-97`) |

### QA-02

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| QA-02 | `pnpm lint` passe, formatage appliqué | Corrigé | gates : Prettier OK, « 104 problems (0 errors, 104 warnings) » ; `no-explicit-any` en erreur (décision UI-03). Configuration périmée : m15 |

### QA-04

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| QA-04 | Une PR qui casse un test ne publie pas d'image | Corrigé | Une PR ne lance que `ci.yml` (`permissions: contents: read`). La publication exige un tag et `needs: verify` (`release.yml:14-20`) |
| QA-04/Trouvé-1 | Pas de `timeout-minutes` sur `release` | Corrigé | `release.yml:24` 30 min, `ci.yml:17` 15 min, `RELEASING.md:90` |
| QA-04/Reste-1 | Runner arm64 natif au lieu de QEMU (optionnel) | Non fait | `release.yml:61-62,92` : QEMU et `platforms: linux/amd64,linux/arm64` sur `ubuntu-latest` |

### DEP-01

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DEP-01 | Un lockfile, aucune dépendance inutilisée, un paquet d'icônes | Corrigé | Voir R7-M5, R7-M6 ; knip à 0 |
| DEP-01/Trouvé-1 | Paquets du client dans l'image | Corrigé | `bits-ui`, `@lucide/svelte`, `barcode-detector`, `clsx`, `tailwind-*` en devDependencies ; `dependencies` = paquets importés par le serveur ; svelte-i18n et html5-qrcode retirés |

### DEP-02

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DEP-02 | check, test, build après les mineures | Corrigé | svelte 5.57.1, bits-ui 2.19.5, tailwindcss 4.3.3, svelte-check 4.7.6, zod 4.6.5 ; gates à 0. Parcours manuels non revérifiables |

### DEP-03

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DEP-03 | SvelteKit 3 : check, test, build ; CSRF actif | Corrigé | `@sveltejs/kit` 3.0.1, vite 8.3.2, TypeScript 6.0.3 ; `check-origin.mjs` en CI (`ci.yml:61`) |
| DEP-03/Trouvé-1 | `cookie` 0.6.0 figé | Corrigé | Seul `cookie@2.0.1` dans le lockfile |
| DEP-03/Trouvé-2 | tailwind-variants 1 et sa copie de tailwind-merge | Corrigé | tailwind-variants 3.3.1, un seul `tailwind-merge@3.7.0` |
| DEP-03/Trouvé-3 | Correctifs `@types/qrcode`, `@internationalized/date`, typescript | Corrigé | 1.5.6, 3.12.4, 6.0.3 |
| DEP-03/Reste-1 | Retirer `@sveltejs/kit@3.0.1` de l'exception | Corrigé | `pnpm-workspace.yaml:9-11` ne garde que les deux paquets Paraglide |
| DEP-03/Trouvé-4 | `server.js` dépend de `envPrefix: ""` et de l'export `server` | Corrigé (surveillé) | `vite.config.ts:29`, `server.js:43`, check-origin en CI |
| DEP-03/Trouvé-5 | Vérifier que la CLI shadcn-svelte accepte les alias `#lib` | Non fait | Aucune trace (commit, note) ; `components.json` pointe aussi `"hooks": "#lib/hooks"` vers un dossier absent |
| DEP-03/Reste-2 | `node server.js` sans `BODY_SIZE_LIMIT` garde 512 Ko | Non fait | `server.js:33-43` ne pose aucun défaut ; `README.md:44` ne cite pas la variable ; seul `README-Docker.md:561` la décrit, pour l'image |

### DEP-04

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DEP-04 | Tests de sauvegarde, restauration et import passants | Corrigé | `api/admin/restore/*.test.ts` (6), `features/backup/*.test.ts`, `import-csv` et `import-json` ; better-sqlite3 13.0.3, archiver 8.0.0, nanoid retiré |
| DEP-04/Trouvé-1 | esbuild 0.18 et 0.19 : mettre à jour plutôt qu'un override | Partiel | 0.19 parti avec svelte-i18n ; 0.18.20 reste par `drizzle-kit@0.31.11` (`pnpm why esbuild`) |
| DEP-04/Trouvé-2 | `@types/yauzl` en 2.x | Corrigé | `^3.4.0` |
| DEP-04/Trouvé-3 | `@types/better-sqlite3` en production | Écart décidé | Décision « Types en production (DEP-04) » ; `pnpm why --prod` → `drizzle-orm@0.45.3` |
| DEP-04/Reste-1 | archiver 8 et yauzl (DATA-05) | Corrigé | `package.json:72,78` |
| DEP-04/Reste-2 | esbuild 0.18 par drizzle-kit 0.31.11 | Non fait (bloqué en amont) | `npm view drizzle-kit dist-tags` → `latest: '0.31.11'`. C'est l'alerte modérée de `pnpm audit`. La décision « svelte-i18n » ne nomme que esbuild 0.19 ; la phrase de la tâche (`ROADMAP.md:714`) peut se lire comme acceptant les deux |
| DEP-04/Reste-3 | esbuild 0.19 par svelte-i18n | Corrigé | svelte-i18n absent du lockfile |
| DEP-04/Reste-4 | `@types/better-sqlite3` dans l'image | Écart décidé | Décision « Types en production (DEP-04) » |
| DEP-04/Reste-5 | Binaires better-sqlite3 de 8 plateformes (≈ 13 Mo) | Non fait | `better-sqlite3/prebuilds` (16 Mo) : darwin, win32, linux, linuxmusl, alors que l'image n'en utilise qu'un ; `deps/` (sources SQLite, 9,8 Mo) inutile à l'exécution |

### REL-01

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| REL-01 | Un tag rc publie `:dev` et une pré-version complète ; `upgrade-path 0.1.0 0.2.0` cite ORIGIN | Corrigé | `release.yml:75-104` (`dev` si `-` dans le tag, `--prerelease`) ; `release.mjs notes v0.8.0-rc.1` → résumé, `### Upgrade actions`, `### Changes` ; `upgrade-path.mjs 0.1.0 0.2.0` → « Set `ORIGIN`… » en premier |

### REL-02

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| REL-02 | v0.1.0 → dernière : actions dans les logs et l'admin ; arrêt obligatoire sauté → refus | Corrigé | Base sans version : log « upgraded from a version between 0.4.0 and 0.5.0 » et actions « (may already be done) » ; base en `9.9.9` : « cannot start… No data was changed », code 1 ; bandeau `admin/+layout.server.ts:8`. Tests `upgrade.test.ts` « records this version, and logs the actions of an upgrade from v0.1.0 for the admin », « refuses to skip a mandatory stop… ». Aucun `mandatoryStop: true` dans `releases.json`, l'arrêt n'est prouvé que par les tests |
| REL-02/Fait-P4 | Contrôle partagé par la restauration (409), version et actions gardées | Corrigé | `upgrade.ts:225-251` (`checkRestoredDatabase`, appelé à `backup/service.ts:281`), `:263-266` (`putBackUpgradeState`, appelé à `:299`) |

### DOC-01

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DOC-01 | Plus rien du modèle `sv` ; installation Docker en un clic | Corrigé | `README.md:5` → `README-Docker.md#quick-start` |
| DOC-01/Trouvé-1a | CSV déposés dans `docker-data/csv-imports/` | Corrigé | `README-Docker.md:363-370` (envoi depuis le navigateur), `:282-287` |
| DOC-01/Trouvé-1b | `git clone` d'un dépôt privé | Corrigé | `README-Docker.md:16-28` : archive de la release, ou jeton, ou clé SSH |
| DOC-01/Trouvé-1c | `docker-compose` et `docker compose` mélangés | Corrigé | Aucune commande `docker-compose ` dans README*.md ni `docker-setup.sh` |
| DOC-01/Trouvé-1d | Titre « Wine Cellar », « 1GB » | Corrigé | `README-Docker.md:1` ; `:10` « about 400 MB », conforme aux 410 Mo mesurés |
| DOC-01/Trouvé-1e | Rien sur la caméra (HTTPS ou localhost) | Corrigé | `README-Docker.md:156-161`, `README.md:16` |

### DOC-02

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DOC-02 | Chaque commande et affirmation de README-Docker vérifiée | Corrigé | Rejoués : jeton dans le log et répété à 60 s (`setup-token.ts:10`), limites de connexion (`login-attempts.ts:7-13`), dossiers NAS exclus, messages de migration et de seeding, `DEBUG=csv-import`, variables de `paths.ts:7-12`, 403 inter-sites, cron (sans `Content-Type` → 403, mauvais jeton → 401), commande du code oublié sur une base de test, uid 1000, port 3000, healthcheck. « Images tab » (`:376`) reste juste : l'admin est une barre d'onglets (`admin/+layout.svelte:29-42`) |

### Décision « Exception Paraglide (UI-10) »

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| Exception Paraglide | Bloc `minimumReleaseAgeExclude` à retirer après le 2026-10-16 23:07 UTC, avant main et la release | Non fait (pas encore dû) | `pnpm-workspace.yaml:6-11` contient encore `@inlang/paraglide-js@2.27.0` et `@inlang/sdk@4.0.0`. `date -u` pendant l'audit : 15:35, 15:48 et 16:20 UTC. Commentaire faux : m1 |

## 3. Nouveaux constats (passe 2)

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

Les constats m21 et m22, issus du banc de mise à jour, sont dans la section « Chemin de mise à jour » plus bas.

**m1. Le commentaire du bloc Paraglide de `pnpm-workspace.yaml` contredit la décision**
- Où : `pnpm-workspace.yaml:6-8`
- Scénario : le commentaire dit « exception granted … on the branch p6/ui-10 only … the lead removes this block before merging, after 23:07 UTC ». Le bloc est pourtant sur develop (e7b049ab, `git branch --contains`), comme la décision « Exception Paraglide » l'a voulu (« mergée sur develop le jour même »). Un agent qui lit le fichier croit que le bloc n'aurait jamais dû atteindre develop, et peut le retirer avant 23:07 UTC, ce qui casserait l'installation. Attendu : un commentaire conforme à la décision, et un retrait après l'heure.
- Correction proposée : rien à part. Le retrait du bloc après 23:07 UTC, prévu par la décision et bloquant pour le tag (ligne « Exception Paraglide » de la passe 1), supprime le commentaire. Dans le même commit, deux réglages au choix : ajouter `core-js` à `ignoredBuiltDependencies` (chaque install affiche « Ignored build scripts: core-js@3.45.1 », gates.log:63) ; regrouper `onlyBuiltDependencies` et `ignoredBuiltDependencies` (`package.json:63-70`) dans `pnpm-workspace.yaml`, que pnpm 11 lit, contrairement au champ `pnpm` de `package.json` (`Dockerfile:10-12`).
- Preuve : `sed -n 6,11p pnpm-workspace.yaml` ; décision « Exception Paraglide (UI-10) » (`ROADMAP.md:69`).
- Vérification : Confirmé (vu par les parties A et B et par l'axe 5, un seul constat ici).

**m2. Le résumé provisoire de 0.8.0 dit que `/` redirige côté serveur**
- Où : `releases.json:4` (entrée 0.8.0, paragraphe UI-04 : « …and `/` redirects to the wine list on the server »)
- Scénario : depuis fbfaf8a9, `src/routes/+page.ts:9` ne redirige que dans le navigateur et `+page.svelte:7` sert une page 200 avec une meta refresh (décision « Healthcheck et racine »). Un utilisateur qui lit les notes de 0.8.0 croit que `/` répond 307 ; un script ou un healthcheck écrit d'après ces notes attend une redirection. Attendu : des notes qui décrivent le comportement réel.
- Correction proposée : remplacer la phrase par « …and `/` leads to the wine list », ou la supprimer, puisque 0.7.0 répondait déjà 200.
- Preuve : `GET /` → 200 dans le conteneur et avec `node server.js` ; test `src/routes/page.test.ts` « answers on the server with a page that leads to /wines without JavaScript ». La note `ROADMAP.md:1177` dit « Pas dans les notes de version », mais la phrase de UI-04, écrite avant le correctif, est restée.
- Vérification : Confirmé (vu aussi par l'axe 5).

**m3. Le Dockerfile lance `pnpm run prepare`, dont le script ne peut pas échouer** (signalé par a7a, vérifié par le rédacteur)
- Où : `package.json:14`, `Dockerfile:24-25`
- Scénario : le script vaut `paraglide-js compile --project ./project.inlang --silent && svelte-kit sync || echo ''`. Le `|| echo ''` vient du gabarit `sv` (d9d431df) : il laisse passer l'install du Dockerfile (l. 19), qui lance `prepare` avant la copie des sources. Mais il rend aussi l'étape `RUN pnpm run prepare` (l. 25) muette : une compilation Paraglide ou un `svelte-kit sync` qui échoue sort avec le code 0. Cette étape est de plus redondante, car `vite build` (l. 28) compile les messages (`paraglideVitePlugin`, hook `buildStart`) et lance `sync.all` (`@sveltejs/kit/src/exports/vite/build/index.js:142`). Une vraie erreur n'apparaît donc qu'au build, sous un autre message. En CI, `pnpm check` relance la compilation sans repli, donc rien n'y est masqué. Attendu : une étape qui échoue quand son travail échoue, ou pas d'étape.
- Correction proposée : supprimer les lignes 24-25 du Dockerfile, puisque le build fait le même travail. Garder le `|| echo ''` de `prepare`, qui sert à l'install avant la copie des sources.
- Preuve : dans un dossier de travail sans `project.inlang`, avec les binaires de `node_modules/.bin` : `sh -c "paraglide-js compile --project ./project.inlang --silent && svelte-kit sync || echo ''"` affiche « ERROR [paraglide-js] … ENOENT … settings.json » puis `exit=0`.
- Vérification : Confirmé par le rédacteur.

**m4. `docs/roadmap/tasks.mjs` a une virgule en trop, rendue « - undefined » dans le roadmap**
- Où : `docs/roadmap/tasks.mjs:1054`, `docs/roadmap/ROADMAP.md:1331`
- Scénario : la puce sur les cases à cocher de `UpgradeBanner` se termine par `',,`. Le trou du tableau `todo` d'UI-10 est rendu par `build.mjs:76` en « - undefined », dans `ROADMAP.md` et dans la page de suivi. Aucune puce n'est perdue (diff de 12abed50). Attendu : pas de puce vide.
- Correction proposée : retirer la virgule et régénérer avec `build.mjs`. En option, faire refuser par `build.mjs` une puce `undefined`.
- Preuve : `sed -n 1054p docs/roadmap/tasks.mjs` ; `ROADMAP.md:1331` « - undefined ».
- Vérification : Confirmé (signalé par a5b, vérifié par v-a5b).

**m5. Ni la CI ni la release ne démarrent l'image avant de la publier**
- Où : `.github/workflows/ci.yml:55-61`, `.github/workflows/release.yml:88-97`, `scripts/check-origin.mjs:18-25,83-91`
- Scénario : `ci.yml` construit l'app (`pnpm build`) mais jamais le `Dockerfile`. `release.yml` construit l'image et la pousse (`push: true`) sans la lancer. Un `Dockerfile`, un `CMD` ou des droits `USER node` cassés ne se voient qu'au tag, après publication de `:latest`, et les conteneurs deviennent unhealthy ou ne démarrent plus. Attendu : une image démarrée et `healthy` avant d'être poussée.
- Correction proposée : dans `release.yml`, construire d'abord l'image amd64 avec `load: true`, la lancer et attendre `healthy`, puis lancer le build multi-arch poussé. En complément, ajouter « `GET /` → 200 » à `check-origin.mjs` : `src/routes/page.test.ts` garde déjà la page, mais pas un hook ou un layout serveur qui changerait le statut de `/`.
- Preuve : lecture des deux workflows ; `check-origin.mjs` ne sonde que `/robots.txt` et des `POST /api/bottles`. La régression « `/` en 307 → conteneur unhealthy » (corrigée par fbfaf8a9) a passé toute la CI et n'a été vue qu'au banc manuel de fin de P6 (`ROADMAP.md:1177`).
- Vérification : Confirmé, corrigé (le vérificateur a noté que `page.test.ts` garde maintenant la régression citée ; la lacune principale reste l'image jamais démarrée, et c'est la seconde correction de l'auditeur qui la ferme).

**m6. Les listes « ce que lance la CI » sont incomplètes**
- Où : `README.md:34-42`, `RELEASING.md:5` et `:59`, `AGENTS.md:18`
- Scénario : `ci.yml:40-61` lance check, lint, test, i18n:check, knip, build et `check-origin.mjs`. `README.md` (« run the checks that CI runs ») omet `pnpm knip`. `RELEASING.md:5` omet knip et check-origin, `:59` omet knip, qui tourne avant le build. `AGENTS.md:18` dit que `i18n:check` échoue sur des clés, alors que `scripts/check-i18n.mjs:3-4` échoue aussi sur un pluriel fait à la main et sur du texte en dur. À l'étape 3 d'une rc, le mainteneur lance les commandes listées, commite et pousse ; la CI échoue sur knip. Attendu : les listes complètes.
- Correction proposée : ajouter `pnpm knip` aux deux listes, citer check-origin dans `RELEASING.md:5`, compléter la description d'`i18n:check` dans `AGENTS.md` et `README.md:40`.
- Preuve : lecture comparée de `ci.yml:52-53` et des trois documents.
- Vérification : Confirmé.

**m7. `.dockerignore` envoie `.claude/` et `.omc/` dans le contexte de build**
- Où : `.dockerignore:1-64`, `Dockerfile:22` (`COPY . .`)
- Scénario : les motifs `node_modules`, `build` et `data/` ne visent que la racine, et `.claude/` et `.omc/` n'y sont pas. Depuis le checkout principal, `docker compose up -d --build` transfère les worktrees (chacune avec son `node_modules`, son `build/` et son `data/`), et `COPY . .` place leurs bases de test dans l'étage de build. Rien de cela n'atteint l'image finale. Attendu : un contexte de quelques Mo.
- Correction proposée : ajouter `.claude/`, `.omc/` et `docs/` à `.dockerignore`, ou passer à une liste blanche (`*` puis `!src`, `!static`, `!drizzle`…).
- Preuve : `du -sh .claude` → 7,7 Go pour 15 worktrees chez l'auditeur, 4,1 Go pour 8 chez le vérificateur ; depuis une worktree propre, `transferring context: 3.07MB`.
- Vérification : Confirmé.

**m8. L'image de base `node:24-alpine` n'est pas épinglée**
- Où : `Dockerfile:2` et `:34`
- Scénario : SEC-10 épingle les actions par SHA parce qu'un tag peut être déplacé, et SEC-08 impose 7 jours aux paquets npm. L'image de base, qui tourne en production, n'est couverte par aucune des deux règles. Une `node:24-alpine` publiée la veille d'un tag, ou compromise, part telle quelle dans `:latest`, et deux builds du même tag ne donnent pas la même image. Aucune décision ne couvre l'image de base.
- Correction proposée : `FROM node:24.x.y-alpine3.zz@sha256:…`, mis à jour selon la règle de SEC-10 (raison ou revue groupée, image d'au moins 7 jours), avec une ligne dans `AGENTS.md`.
- Preuve : `Dockerfile:2,34` sans version complète ni digest.
- Vérification : Confirmé.

**m9. L'avertissement ORIGIN des logs donne un exemple avec le port du conteneur**
- Où : `src/lib/server/upgrade.ts:325`
- Scénario : le log dit « such as ORIGIN=http://192.168.1.20:3000 ». Avec `docker run -p 3005:3000`, le navigateur ouvre le port de l'hôte ; l'utilisateur qui recopie l'exemple reçoit 403 à chaque écriture. Toute la doc écrit `:3005` (`README-Docker.md:42,137`, `.env.example:7`, `docker-compose.yml:19`). Avec le compose du dépôt, ORIGIN est obligatoire (`docker-compose.yml:22`), donc ce log ne sort qu'avec `docker run` ou un compose personnel.
- Correction proposée : `http://192.168.1.20:3005`, comme les autres exemples.
- Preuve : log reproduit en lançant `node server.js` sans `ORIGIN`.
- Vérification : Confirmé.

**m10. Restes de « Wine Cellar » dans le compose et un `docker-setup.sh` orphelin**
- Où : `docker-compose.yml:40-42`, `docker-setup.sh:1-35`
- Scénario : le compose garde les labels `com.docker.compose.project=wine-cellar` et `description=Wine Cellar Management Application`. `docker-setup.sh` annonce « Setting up Wine Cellar », double les étapes 2 à 4 du Quick start, et aucun document ne le cite. Sans effet fonctionnel, mais deux procédures d'installation à tenir à jour. `container_name: wine-cellar` est gardé par décision (`ROADMAP.md:920`).
- Correction proposée : retirer les deux labels, puis supprimer `docker-setup.sh` ou le citer dans le Quick start.
- Preuve : `git grep docker-setup` hors roadmap → aucun résultat.
- Vérification : Confirmé (non vérifié sans Compose : que Compose écrase lui-même le label `project` ; la correction vaut dans tous les cas).

**m11. Les dépendances optionnelles de jsPDF, faites pour le navigateur, partent dans l'image**
- Où : `Dockerfile:31` (`pnpm prune --prod`)
- Scénario : jsPDF 4.2.1 déclare `canvg`, `core-js`, `dompurify` et `html2canvas` en `optionalDependencies`. Le serveur n'utilise que `jsPDF` (`features/labels/pdf.ts:1`), et le build node (`dist/jspdf.node.min.js`) ne charge html2canvas, canvg et dompurify qu'à la demande et jamais core-js. Dans l'image : `core-js` 14,6 Mo, `html2canvas` 4,4 Mo, plus `canvg` et `dompurify`, soit plus de 20 Mo sur 126 Mo de `node_modules`.
- Correction proposée : à mesurer d'abord, par exemple `pnpm prune --prod --no-optional`, en vérifiant que better-sqlite3 et les étiquettes PDF marchent encore.
- Preuve : `du` dans l'image construite par l'auditeur ; lecture du build node de jsPDF par le vérificateur.
- Vérification : Confirmé.

**m12. kysely (6,3 Mo) part en production depuis l'ajout de Paraglide**
- Où : `pnpm-lock.yaml:22` (`drizzle-orm: … (kysely@0.28.17)`)
- Scénario : `@inlang/sdk` dépend de kysely ; depuis 7f504ca9, pnpm résout donc le pair optionnel de drizzle-orm. `pnpm prune --prod` garde les dépendances d'un paquet de production, et kysely entre dans l'image alors qu'aucun code de Cellar ne l'importe. C'est le mécanisme de `@types/better-sqlite3`, que la décision DEP-04 n'accepte que pour ce paquet et `@types/node`.
- Correction proposée : décision du mainteneur. Ajouter kysely à la décision « Types en production » (environ 6 Mo, sans effet à l'exécution), ou l'écarter par un hook `.pnpmfile.cjs`, la voie déjà refusée pour `@types/better-sqlite3`.
- Preuve : `pnpm why --prod kysely` → `kysely@0.28.17 └─┬ drizzle-orm@0.45.3 └── cellar@0.7.0 (dependencies)` ; avant 7f504ca9, le lockfile n'a pas `(kysely@…)`. Dans une worktree jetable, `pnpm install --frozen-lockfile && pnpm prune --prod` (comme `Dockerfile:19,31`) garde `kysely@0.28.17` et plus aucun paquet `@inlang`.
- Vérification : Confirmé.

**m13. `@types/node` n'est pas déclaré**
- Où : `package.json:24-61`
- Scénario : le code serveur importe `node:crypto` 14 fois et `node:fs` 11 fois, mais les types de Node n'arrivent que par `@types/{archiver,better-sqlite3,qrcode,yauzl}` et vite (`pnpm why @types/node` → 24.3.0). Une mise à jour de l'un d'eux qui change sa plage `@types/node` change en silence les types vus par `pnpm check`, ou les retire. Rien ne garantit qu'ils suivent Node 24 (`engines`).
- Correction proposée : `@types/node` en devDependency, version 24.x publiée depuis au moins 7 jours, plage `^24.x.y` à partir de la version installée.
- Preuve : `ls node_modules/@types` → `archiver better-sqlite3 qrcode yauzl`, sans `node`.
- Vérification : Confirmé.

**m14. Mises à jour correctives disponibles avant la 1.0, publiées depuis plus de 7 jours**
- Où : `package.json`
- Scénario : la 1.0.0 part avec drizzle-orm en retard d'un correctif sur le chemin de toutes les requêtes. Disponibles et éligibles : drizzle-orm 0.45.3 → 0.45.4 (production, 2026-10-08), svelte 5.57.1 → 5.57.2 (2026-10-06), vite 8.3.2 → 8.3.4 (2026-10-08), `@inlang/plugin-icu1` 1.1.1, eslint-plugin-svelte 3.23.1, typescript-eslint 8.71.1, `@lucide/svelte` 1.54.0, knip 6.41.0. À part : `@types/better-sqlite3` 7.6.13 → 9.6.0 (majeure), et TypeScript 7.0.2, écarté par DEP-03 (svelte-check).
- Correction proposée : une revue groupée avant le tag, comme la décision SEC-10 le prévoit pour les actions : changelog, une mise à jour par commit, gates. Vérifier si `@types/better-sqlite3` 9.x correspond à better-sqlite3 13.
- Preuve : `pnpm outdated` (qui suit `minimumReleaseAge`) et `npm view <paquet> time` ; `pnpm audit` ne signale rien sur ces versions.
- Vérification : Confirmé.

**m15. Configuration ESLint périmée, et aucune règle écrite pour les logs** (fusionné avec un point signalé par a7b, vérifié par le rédacteur)
- Où : `eslint.config.js:38-44`, `src/lib/server/debug.ts`
- Scénario : les règles passées en avertissement par QA-02 ne trouvent presque plus rien : `no-unused-vars` 4 (`BarcodeOverrideDialog.svelte:16`, `CsvImportDialog.svelte:20` deux fois, `shared/schemas/bottle-list.ts:4`), `require-each-key` 7, `no-useless-assignment` 1 (`ui/select/select-group.svelte:4`), `prefer-svelte-reactivity` 1 (`admin/image-selection.svelte.ts:38`), `infinite-reactive-loop` 0. Leurs commentaires parlent encore de « ~300 unused imports » et de Svelte 4. Un nouvel import inutilisé ou un `{#each}` sans clé passe la CI, noyé dans 104 avertissements dont 91 `no-console`. Pour ces 91, le commentaire dit « logging goes through console until a logger replaces it », mais aucun logger n'est prévu : `debugLogger` (`debug.ts`) n'a qu'un importeur, l'import CSV (`DEBUG=csv-import`, API-04). 62 des 91 avertissements sont dans le code serveur et sont les messages voulus des logs du conteneur (`backup/service.ts` 11, `upgrade.ts` 9, `db/migrations.ts` 9, `access-code.ts` 4…), dont plusieurs que README-Docker cite (jeton, migrations, seeding). Les 29 autres sont dans des composants et des stores du navigateur.
- Correction proposée : corriger les 13 avertissements hors `no-console` et rendre aux cinq règles leur niveau par défaut (erreur). Pour `no-console`, écrire la convention : le serveur journalise par `console` vers les logs du conteneur (règle coupée pour `src/lib/server`, `src/lib/db`, `hooks.server.ts`), `debugLogger` pour le détail activable, et `no-console` en erreur côté client après revue des 29 appels. Mettre les commentaires à jour.
- Preuve : comptes par règle et par fichier dans gates.log (104 avertissements, 0 erreur) ; `grep -rln "server/debug" src` → `features/csv-import/service.ts` seul ; `ROADMAP.md:303` (QA-02 : « `no-console` en avertissement au début ») et `:1031` (logger `debug` limité à l'import CSV).
- Vérification : Confirmé (partie ESLint par le vérificateur ; partie logs par le rédacteur).

**m16. Les scripts qui servent de contrôles en CI n'ont aucun test**
- Où : `scripts/check-i18n.mjs` (276 lignes), `scripts/release.mjs` (188 lignes), `vite.config.ts:68`
- Scénario : vitest ne lit que `src/**/*.test.ts`, et aucun test ne cite `scripts/`. Si la regex des clés (`MESSAGE`, `check-i18n.mjs:25`) cassait, toutes les clés passeraient pour inutilisées et le script échouerait, donc ce cas se signale seul. En revanche, une erreur dans la détection du texte en dur (`TEXT_ATTRIBUTE`, littéraux en prose, `:42-45`, `:187`) le ferait passer sans rien voir, et `release.mjs` n'est lancé que par `release.yml:55,58`, au tag. Seule la logique de `src/lib/server/releases.js` est testée.
- Correction proposée : exporter les fonctions d'analyse de `check-i18n.mjs` et ajouter quelques cas (clé manquante, clé construite par un gabarit, texte en dur), sous `src/` ou en élargissant `include` ; même chose pour les contrôles de `release.mjs check`.
- Preuve : `grep -rln "scripts/" src --include='*.test.ts'` vide.
- Vérification : Confirmé, corrigé (le vérificateur a restreint le scénario : une regex de clés cassée se voit d'elle-même).

**m17. L'import ZIP d'images et la route `/uploads` n'ont aucun test**
- Où : `src/lib/server/features/images/service.ts:237-295` (`importImagesZip`), `src/routes/uploads/[...path]/+server.ts`
- Scénario : `importImagesZip` ne remplace que des noms connus de la base et refuse un nom invalide (`service.ts:258-277`) ; `/uploads` fixe le Content-Type par extension avec `nosniff`. Un refactoring qui écrit un fichier inconnu, ou qui sert une image avec un autre type, passe les 976 tests.
- Correction proposée : un test de route pour `import-images-zip` (nom connu, nom inconnu, nom invalide) et un test de `GET /uploads/wines/<nom>` (en-têtes, 404 pour `..`).
- Preuve : aucun fichier de test ne cite `importImagesZip` ; `routes/api/admin/import-images-zip/` et `routes/uploads/` n'ont pas de `*.test.ts`.
- Vérification : Confirmé, corrigé. La partie « statistiques et vins en manque » du même constat est traitée à l'axe 6 ; le vérificateur y a relevé que la branche « `shortagePercentage` vaut 100 quand la cible est 0 » est du code mort (`bottles/repository.ts:463-465`).

**m18. AGENTS.md promet plus que la règle de lint des routes**
- Où : `AGENTS.md:29` (« Routes call the service only, which a lint rule enforces »), `eslint.config.js:74-80`
- Scénario : la règle n'interdit que `features/*/repository*`, comme la décision « Services par domaine (API-02) ». 9 imports de routes visent un autre module que `service.ts` : `api/admin/import-json/+server.ts:2` (`backup/json-import.js`, qui écrit la base par `replaceCellar`), `api/admin/backup-token/+server.ts:2` (`backup/token.js`, qui écrit `app_settings`), `api/admin/export-csv/+server.ts:3` (`backup/export.js`), `api/admin/{list-backups,create-backup,create-export}` et `admin/backups/+page.server.ts` (`backup/files.js`), `api/admin/backup-settings/+server.ts:3` (`backup/scheduler.js`), `api/barcode/pdf-labels/+server.ts:2` (`labels/pdf.js`). Un agent qui suit AGENTS.md à la lettre croit qu'aucune route n'écrit hors d'un `service.ts` et range la règle métier suivante au mauvais endroit.
- Correction proposée : reformuler AGENTS.md (« Routes call a feature's modules, never its repository; a lint rule enforces it »). Autre voie : réexporter ces fonctions depuis les `service.ts` de backup et labels.
- Preuve : `grep -rnE "from '#lib/server/features/[a-z-]+/[a-z-]+\.js'" src/routes | grep -v service` (hors tests).
- Vérification : Confirmé (seuls `import-json` et `backup-token` écrivent).

**m19. `{ id: randomUUID(), createdAt, updatedAt }` est recopié 11 fois**
- Où : `features/catalog/repository.ts:18-21` (helper `timestamps`, qui renvoie aussi l'id), `features/settings/repository.ts:16,37`, `features/labels/repository.ts:20`, `features/bottles/repository.ts:32`, `features/storage/repository.ts:44,55`, `features/images/repository.ts:39-42`, `features/shared/lookup-crud.ts:96-101`, `features/csv-import/pipeline.ts:171`, `server/access-code.ts:162-165`
- Scénario : une nouvelle table ou insertion oublie `updatedAt` ou réutilise un id ; l'insertion échoue sur `NOT NULL`, ou la règle diverge.
- Correction proposée : `$defaultFn(() => randomUUID())` et `$defaultFn(() => new Date())` dans `schema.ts` (défauts appliqués par Drizzle à l'exécution, sans migration), puis supprimer les copies ; à défaut, un seul helper partagé, bien nommé.
- Preuve : `grep -rn "createdAt: now, updatedAt: now" src/lib/server` ; aucun `$defaultFn` dans `src/lib/db/schema.ts`.
- Vérification : Confirmé.

**m20. La route `/uploads` lit le disque elle-même, et trois fichiers importent `fs` sans `node:`**
- Où : `src/routes/uploads/[...path]/+server.ts:2,17-38` ; `src/lib/server/zip.ts:1-4`, `src/lib/server/features/backup/json-import.ts:1-2`
- Scénario : la route tient sa propre table de types MIME et lit les fichiers par `fs/promises`, alors que le service `features/images` décide des formats acceptés (SEC-06). Un changement de formats oublie la route. Ailleurs, le serveur importe `node:fs` (11 fois) ; ces trois fichiers importent `fs`, `path` ou `stream`.
- Correction proposée : une fonction de lecture d'image dans `features/images/service.ts`, appelée par la route ; passer les trois fichiers aux imports `node:`.
- Preuve : `grep -rnE "from '(fs|path|stream|fs/promises)'" src` (hors tests) → ces trois fichiers.
- Vérification : Confirmé, corrigé (le point « `MIN_ACCESS_CODE_LENGTH` sous `utils/` » est écarté, voir section 5).

### Chemin de mise à jour 0.1.0 → develop et 0.7.0 → develop

Partie C. Deux instances remplies de données entièrement inventées, puis mises à jour vers develop (9df0d08c), hors Docker et dans Docker. Le vérificateur a relu les journaux et interrogé des copies des bases, sans relancer de serveur.

#### Ce qui est prouvé

- **Aucune perte de données.** Nombres de lignes identiques avant et après pour `wine_definitions`, `wine_bottles`, `storage_cases`, `label_presets` et `origins` (0.1.0 : 4/9/3/29/1 ; 0.7.0 : 4/10/5/29/1). Pour 0.7.0, vins et bouteilles identiques colonne par colonne. Pour 0.1.0, une seule différence, le code-barres d'une bouteille (`3760123456789` → `CAV0000008`), qui vient de la restauration d'un zip pris avant le `PUT` de ce code (le zip contient bien `CAV0000008`). Unicode (œ, €, émoji), millésime 0, bouteilles hors cave et bues, note 4,5 et code de 13 caractères intacts. Les 16 pages répondent 200 avec les noms attendus ; le prochain code-barres ne change pas (`CAV0000010`, `VIN-000014`) ; export CSV juste ; jeton cron de 0.7.0 toujours accepté.
- **Migrations et actions.** 0.1.0 → develop applique 0003 à 0008 et logue « Cellar upgraded from 0.1.0 (judged from the database migrations…) to 0.7.0 ». Le log et le bandeau admin listent **10 actions** (0.2.0 ×6, puis 0.3.0, 0.4.0, 0.5.0, 0.7.0), identiques à `node scripts/upgrade-path.mjs 0.1.0 0.7.0`. Avec develop construit en `0.8.0-rc.1` : 11 actions (+ 0.8.0). `1234` est supprimé, le jeton de configuration est imprimé, `1234` est refusé et le jeton accepté.
- **Restauration** d'une ancienne sauvegarde par develop : 200, données = contenu du zip, code d'accès, session et actions de l'instance gardés, aucune trace de `access_code1234` dans `cellar.db*`.
- **Retour arrière refusé.** develop construit en `0.8.0-rc.1`, puis v0.7.0 sur la même base : « ❌ Cellar 0.7.0 cannot start: this database comes from 0.8.0-rc.1, newer than this 0.7.0: start 0.8.0-rc.1 again, or restore a backup made before the upgrade. No data was changed. », code 1. `checkUpgrade` lit la base avant les migrations (`upgrade.ts:211-216`), donc rien n'est écrit avant le refus ; le `shasum` identique avant et après est affirmé par l'auditeur mais pas enregistré dans un fichier. Restaurer dans 0.7.0 une sauvegarde de `0.8.0-rc.1` → 409 `backup_refused`.
- **Docker, volumes appartenant à root.** L'image de develop s'arrête en listant les fichiers inaccessibles avec le lien `#data-ownership`. La commande `chown -R 1000:1000` de l'action 0.2.0, copiée telle quelle, corrige ; au redémarrage, le conteneur passe `healthy`, le jeton est dans `docker logs`, la vérification donne `ALL OK` et `docker stop` sort avec le code 0. `docker diff` ne liste aucune écriture hors des volumes (seulement les certificats injectés par OrbStack).

Observations sans constat :
- restaurer une sauvegarde d'avant 0.2.0 remet son mode `cron` sans jeton, et plus aucune sauvegarde automatique n'est planifiée : voulu par le code (`backup/service.ts:304`), traité à l'axe 3 ;
- le jeton de configuration change à chaque démarrage tant qu'aucun code n'est choisi, comme README-Docker l'annonce ;
- `UPGRADING.md` n'a pas encore de section 0.8.0, ce qui est normal (régénéré par `release.mjs prepare`) ;
- `node build` au lieu de `node server.js` : avertissement « ORIGIN is set but not applied » et 403 sur une écriture du navigateur, comme l'annonce l'action 0.5.0.

#### Rejouer le banc

Scripts et données de l'audit (hors dépôt, dans le dossier de travail de la session) : `seed010.mjs`, `seed070.mjs`, `http.mjs`, `put.mjs`, `verify.mjs`. Ports 4520 à 4529. Étapes :

```bash
# $W : checkout du dépôt ; $A : dossier de travail hors du dépôt ; $I : dossier d'une instance (data/, static/uploads/, csv-imports/)
# 0.1.0 hors du dépôt (git archive), 0.7.0 et HEAD en worktrees détachées
git -C $W archive v0.1.0 | tar -x -C $A/src-v0.1.0      # puis install --frozen-lockfile et build
git -C $W worktree add --detach $W/../audit-a7c-v0.7.0 v0.7.0
git -C $W worktree add --detach $W/../audit-a7c-HEAD HEAD

# 0.1.0 : chemins relatifs au cwd, donc un dossier d'instance ; seed, sauvegarde, arrêt (kill -9 : 0.1.0 ignore SIGTERM)
(cd $I && PORT=4520 HOST=127.0.0.1 node $A/src-v0.1.0/build &)
node seed010.mjs http://127.0.0.1:4520 ; cp -Rp $I $A/inst010-orig

# HEAD sur les mêmes dossiers ; premier code avec le jeton du log ; comparaison ; restauration ; export
(cd $W/../audit-a7c-HEAD && ORIGIN=http://localhost:4521 PORT=4521 DATA_DIR=$I/data \
  UPLOADS_DIR=$I/static/uploads CSV_IMPORTS_DIR=$I/csv-imports node server.js &)
node verify.mjs http://localhost:4521 <cookies> $A/inst010-orig/data/cellar.db

# 0.7.0 : même principe sur 4522, puis HEAD sur 4523
# Retour arrière : dans la worktree jetable seulement, package.json en 0.8.0-rc.1, build,
# démarrage sur une copie de inst070-orig, arrêt, puis v0.7.0 sur la même base ; echo $? → 1

# Docker : image de HEAD, 3 volumes nommés remplis depuis inst010-orig et passés à root,
# docker run (refus), chown de l'action 0.2.0 par alpine, docker run (healthy), docker diff
```

Chaque PID est noté et arrêté par `kill`, puis vérifié par `ps -p` ; worktrees, conteneurs, volumes et image supprimés à la fin.

**Note pour qui rejoue le banc.** v0.1.0 n'a pas de `pnpm-workspace.yaml`, et les worktrees sont sous `.claude/worktrees/` dans le dépôt principal. Lancé dans une worktree v0.1.0 imbriquée, `pnpm install` est remonté jusqu'au checkout principal : son `node_modules` a été aligné sur son propre lockfile (`+30 -31` paquets), et `prepare` y a régénéré `src/lib/paraglide/` et `.svelte-kit/` (ignorés par git). `git status` du checkout principal est resté propre et aucune donnée n'a été touchée. Il faut construire 0.1.0 depuis un `git archive` hors du dépôt, jamais dans une worktree imbriquée.

#### Constats

**m21. L'action 0.2.0 sur le mode « External Cron Job » dit deux choses fausses depuis 0.6.0**
- Où : `releases.json:55` (0.2.0, action d'index 2), recopiée dans `UPGRADING.md:31`, le log de démarrage et le bandeau admin
- Scénario : un utilisateur de 0.1.0 qui sauvegardait par cron installe develop. L'action lui dit « set **Backup Mode** to **Internal Scheduler**, then restart the container: saving the settings does not start the scheduler. Cron backups with a token are planned for a later version. » Or enregistrer les réglages relance le planificateur (`backup/service.ts:72-81`, `reschedule()` à la ligne 80), et le jeton cron existe depuis 0.6.0 (README-Docker « Automatic backups »). Suivre l'action marche et ne perd rien, mais l'utilisateur redémarre pour rien et ne sait pas que le cron est revenu : `grep -n -i cron UPGRADING.md` ne trouve que cette ligne. Attendu : une action vraie à la date de la mise à jour.
- Correction proposée : reformuler en place l'action d'index 2 de 0.2.0, ce que `RELEASING.md:25` autorise (« reword it in place ») : retirer « then restart the container: saving the settings does not start the scheduler » et remplacer « Cron backups with a token are planned for a later version » par un renvoi neutre, par exemple « From 0.6.0 on, the External Cron Job mode works again with a token: see [Automatic backups](…) ». L'index ne change pas, donc les cases déjà cochées restent valables. Pas de nouvelle action « générer un jeton » : la décision « Sauvegardes par cron (DATA-05) » l'exclut. C'est aussi la puce de DATA-05 « retirer l'action de mise à jour correspondante de la documentation si besoin » (`ROADMAP.md:866`), que l'axe 3 ne trace pas.
- Preuve : juste après `PUT /api/admin/backup-settings {"autoBackupMode":"internal",…}`, le log affiche « 📅 Next automatic backup: 10/17/2026, 5:41:04 PM » sans redémarrage ; journaux `head010.log` et `rc010.log` du banc, qui affichent l'action au démarrage.
- Vérification : Confirmé, corrigé (la correction se limite à une reformulation, à cause de la décision DATA-05).

**m22. Un build de develop se déclare 0.7.0 : pas de refus d'un retour à 0.7.0, et l'action 0.8.0 n'est pas montrée**
- Où : `package.json:4` (`"version": "0.7.0"` sur develop, qui a déjà les migrations 0007 et 0008), `vite.config.ts:61` (`__APP_VERSION__`), `src/lib/server/upgrade.ts:133` (le refus ne compare que les versions)
- Scénario : un serveur construit depuis git sur develop entre deux versions (le serveur de l'ami construit depuis git) migre la base sans enregistrer de version plus récente : 0.7.0 → develop logue « ✅ Cellar 0.7.0: same version as the last start. », avec `app_version|0.7.0` et `upgrade_actions|[]` alors que `__drizzle_migrations` contient 0007 et 0008. Revenir au tag v0.7.0 démarre sans avertir, contrairement à la décision REL-02 ; 0.7.0 écrit ensuite dans un schéma qu'il ne connaît pas (4 cases créées avec `position = 0`). develop les relit sans erreur grâce aux valeurs par défaut des colonnes et au tri de secours (`storage/repository.ts:25-29`) : aucun dégât constaté. Le bandeau ne montre pas non plus l'action 0.8.0 ; elle n'est que retardée, le premier tag 0.8.0-rc.N l'affiche. Les images publiées ne sont pas touchées : elles portent le numéro du tag (`release.mjs check`).
- Correction proposée : après chaque tag, rc ou final, passer develop au numéro de rc suivant (`X.Y.Z-rc.N+1`, ou `X.Y'.0-rc.0` après une version finale, avec son entrée provisoire dans `releases.json`, que `findRelease` exige, `releases.js:77-85`), et l'écrire dans `RELEASING.md`. `compareVersions('0.8.0-rc.0','0.7.0')` vaut 1, `VERSION_PATTERN` (`releases.js:7`) accepte `-rc.0`, et la CI ne compare pas la version (seul `release.mjs check`, au tag, `release.mjs:138`). Une détection par la table des migrations ne protégerait que les versions futures, puisque c'est l'ancienne version qui exécute le refus. Au minimum, écrire dans `RELEASING.md` qu'un build non tagué n'est protégé ni par le contrôle de version ni par le bandeau.
- Preuve : journaux `down070.log` (retour à 0.7.0 sans refus, « Listening ») et `down-rc.log` (refus avec le build `0.8.0-rc.1`) ; copie de la base après le retour : dernière migration 1791922606508 (0008), quatre cases `position = 0`.
- Vérification : Confirmé, corrigé (le vérificateur a étendu la correction à chaque tag rc : après `rc.N`, develop garde `rc.N` et le même trou existe).

## 4. Points restés ouverts de la passe 1

Regroupés en tâches proposées.

1. **Avant le tag 1.0.0 (bloquant, prévu par une décision).**
   - Exception Paraglide : retirer le bloc de `pnpm-workspace.yaml` dans un commit dédié après le 2026-10-16 23:07 UTC, vérifier `pnpm install --frozen-lockfile`, puis seulement main et le tag (Non fait, pas encore dû ; voir aussi m1).
2. **Image et exécution hors Docker.**
   - R7-m3 : un seul healthcheck, ou deux aux mêmes délais ; à trancher avec la décision « Healthcheck et racine » (Partiel).
   - DEP-04/Reste-5 : ne garder que le binaire `linuxmusl` de better-sqlite3 et retirer `deps/` dans l'image, environ 25 Mo (Non fait).
   - DEP-03/Reste-2 : `BODY_SIZE_LIMIT` par défaut dans `server.js`, ou une ligne dans `README.md:44` (Non fait).
   - QA-04/Reste-1 : runner arm64 natif au lieu de QEMU, optionnel (Non fait).
3. **Dépendances.**
   - DEP-04/Trouvé-1 et DEP-04/Reste-2 : esbuild 0.18 par drizzle-kit 0.31.11, bloqué en amont. Décision à prendre : l'accepter nommément, comme esbuild 0.19 l'a été (Partiel, Non fait).
   - DEP-03/Trouvé-5 : vérifier que la CLI shadcn-svelte accepte les alias `#lib` avant le prochain `add`, et corriger `"hooks": "#lib/hooks"` dans `components.json` (Non fait).
4. **Outillage.**
   - R7-M4c : typer `scripts/*.mjs` (JSDoc avec `checkJs`) et `drizzle.config.ts`, ou les inclure dans `tsconfig.json` (Partiel).
5. **Rangement de l'interface.**
   - R7-m5c : une seule source pour la palette « blue », ou un test d'alignement avec `app.css` (Non fait).
   - R7-m8a : sortir `SearchableSelect`, `LocaleDateInput` et `locale-date.ts` de `ui/` (Non fait).
   - R7-m8b et R7-m8c : 12 `<select>` bruts et 395 classes de couleur en dur (Partiel).
6. **Architecture cible de la revue 7 (décision à prendre : poursuivre ou abandonner).**
   - R7-Archi-1 : `src/lib/db` hors de `src/lib/server`, sans la garde server-only (Partiel).
   - R7-Archi-3 et R7-FdR-8 : composants rangés par feature (Partiel).
   - R7-Archi-7 : Playwright sur 3 ou 4 parcours, repris par aucune tâche (Non fait).

## 5. Constats écartés

- **Bandeau admin « ORIGIN manquant » visible seulement quand il a tort** (a7a N3) : écart décidé. Les faits sont exacts : sans `ORIGIN`, en http, le premier code reçoit 403 et le bandeau n'est jamais vu ; derrière un proxy TLS qui transmet `Host`, l'écriture passe et le bandeau dit « Configuration needed » à tort. Mais la décision « Contrôle de mise à niveau (REL-02) » demande cet avertissement « dans les logs et dans le bandeau de l'admin », et `missingPrerequisite` (`upgrade.ts:310-319`) l'applique. Retirer la variante du bandeau défait la décision. Question transmise au mainteneur (voir la fin).
- **L'entrée 0.8.0 ne liste en action qu'un des changements d'API** (a7c N3) : écart décidé. Les décisions « Page codes-barres (UI-08) » et « Accessibilité et langue (UI-10) » prévoient pour `pdf-labels` et `import-csv` « une phrase dans les notes de version, pas d'action de mise à jour » ; le résumé 0.8.0 contient les deux phrases.
- **`MIN_ACCESS_CODE_LENGTH` rangé sous `utils/` plutôt que `shared/`** (a7b N11, partie) : affaire de goût. AGENTS.md ne range dans `shared/` que les schémas zod, et le serveur importe déjà `#lib/utils/compare.js`.
- **Le Dockerfile copie `pnpm-workspace.yaml` après l'install** (a5b, hors périmètre) : sans effet. `minimumReleaseAge` ne filtre que la résolution, et `pnpm install --frozen-lockfile` ne résout rien. v-a5b l'a prouvé : install gelée réussie avec un `pnpm-workspace.yaml` sans exception Paraglide, alors que 2.27.0 n'avait pas 7 jours. `pnpm prune --prod` ne résout rien non plus.
- **« `shortagePercentage` vaut 100 quand la cible est 0 », règle à tester** (a7b N6, partie) : la branche ne s'exécute jamais (`HAVING count < targetQuantity`, `bottles/repository.ts:463-465`) ; retirée du test proposé (voir axe 6).

## 6. Renvois

- Endpoints sans appelant (GET publics et admin, `DELETE /api/storage-cases/{id}`), laissés « jusqu'à l'audit d'avant 1.0 » par les décisions UI-04 et UI-09 (a7b N1) : voir axe 2 (liste unique des routes ; `list-backups` sert de route témoin dans 3 tests, `DELETE` de case a 3 tests).
- Statistiques et vins en manque sans test (a7b N6, partie) : voir axe 6.
- Import ZIP d'images : contenu non vérifié, `.bmp` accepté ; route `/uploads` qui sert `.bmp` : voir axe 3.
- `PUT /api/admin/upgrade-actions` répond `{ success: true }`, comme `PUT /api/settings` : voir axe 2 (forme des réponses de succès).
- Restaurer une sauvegarde en mode cron sans jeton coupe les sauvegardes automatiques (observé au banc de mise à jour) : voir axe 3.
- Message d'échec de migration qui ne nomme pas la migration (`src/lib/db/connection.ts:58-65`, signalé par a7a) : voir axe 1.
- R7-C1 (autorisation serveur, CSRF) : voir axe 2. R7-C2 (connexions SQLite) et R7-M1 (migrations) : voir axe 1. R7-M7 (traductions) : voir axe 5.

## 7. Ce qui doit changer à la 1.0.0

Liste dressée par la partie A d'après les décisions, vérifiée point par point ; aucun oubli trouvé parmi les décisions qui citent la 1.0.0.

1. **Visibilité (REL-01).** Dépôt et paquet GHCR deviennent publics. Réécrire `README-Docker.md:8-9` (compte GitHub requis), `:16-18` (« While logged in to GitHub »), `:26-27` (jeton ou clé SSH pour cloner) et `:104-109,121-123` (`docker login` obligatoire), et envisager l'image publiée comme chemin par défaut du Quick start. Les liens `github.com/Lulu300/cellar/blob/main/README-Docker.md#…` des logs (`upgrade.ts:28`, `writable-dirs.ts:15`) et d'`UPGRADING.md` deviennent lisibles par tous. Le commentaire « private-repo minutes » de `ci.yml:16` devient caduc.
2. **Protection des branches (QA-04).** Sur `main`, refuser force-push et suppression dès que le dépôt est public.
3. **Versionnage (REL-01).** `RELEASING.md:3` (« in 0.x during the clean-up ») et `:25` (« During 0.x, a version with actions must be a minor version ») décrivent la règle 0.x. Il faut une règle 1.x (une majeure pour une action manuelle ?), à décider ; rien ne l'applique dans `release.mjs`. La section « First release: v0.1.0 » (`RELEASING.md:36-50`) devient de l'historique. La numérotation de develop entre deux tags (m22) se décide en même temps.
4. **Entrée de release.** L'entrée « 0.8.0 » de `releases.json` porte encore « (provisional entry: the version number is chosen before the release) » et la phrase fausse de m2. Si P6 sort en 1.0.0, renommer l'entrée : `release.mjs check v1.0.0-rc.1` répond aujourd'hui « Unknown version 1.0.0-rc.1: releases.json has no entry for 1.0.0 », `release.mjs prepare 1.0.0` échoue avant le test pour la même raison, et le test `upgrade.test.ts:231` « has an entry in releases.json for the version of package.json » échouerait. `check v0.8.0-rc.1` n'échoue que sur la version de `package.json` et sur CHANGELOG et UPGRADING à régénérer, ce qui est attendu.
5. **Exception Paraglide.** Retrait du bloc dans un commit dédié après 23:07 UTC, `pnpm install --frozen-lockfile`, puis seulement main et le tag.
6. **API-05.** `PUT /api/bottles/{id}` existe toujours (`src/routes/api/bottles/[id]/+server.ts:9`). S'il est retiré à la 1.0, il faut le texte d'action prévu par la décision, un pied `BREAKING CHANGE:`, et une version qui ait une action (sinon `release.mjs check` refuse).
7. **À trancher « avant 1.0 » selon les décisions.** Les GET sans appelant (UI-04) et `DELETE /api/storage-cases/{id}` (`src/routes/api/storage-cases/[id]/+server.ts:6`, UI-09), détaillés à l'axe 2. Leur retrait demande la même action de mise à jour pour les scripts.
