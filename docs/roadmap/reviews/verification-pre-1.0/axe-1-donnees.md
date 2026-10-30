# Vérification d’avant 1.0, axe 1 : données et scripts

Commit revu `cf48032d` (develop, 1.0.0-rc.1, 2026-10-29). Périmètre : schéma, connexion et migrations (`src/lib/server/db/`, `drizzle/`), repositories et transactions, séquence des codes-barres, seeding (`scripts/data/*.csv`, `seed.ts`), `scripts/`, et les tâches P7–P11 de l’axe : DATA-09, DATA-10, DATA-11, DATA-14. Méthode : le rapport de l’auditeur (`$A/rapport-axe-1.md`) a été repris ligne par ligne par un vérificateur qui ne l’avait pas écrit, sur sa propre instance : un worktree à `cf48032d` et un à `9df0d08c`, construits tous deux ; une base remplie par l’API de `9df0d08c` avec d’autres données inventées que celles de l’auditeur (millésime 0 sur des bouteilles en cave et bues, textes de 8 200 et 9 000 caractères en CRLF, description de 5 001 caractères, notes de 3 000 et 6 000 emoji, deux conteneurs « Cave », deux cases « Rackx », prix d’achat négatif, optimum 0), mise à jour par le build de `cf48032d` et comparée à une base neuve du même build ; sondes sur le serveur mis à jour (millésime 0, limite de 5 000 caractères, emoji, import CSV, export puis import vers la base neuve) ; migration cassée `0016_probe_broken` (une instruction valide puis une fausse) dans une copie de `drizzle/`, sur la base mise à jour et sur la base `9df0d08c` ; journal des migrations absent ; seeding de deux bases neuves depuis des CSV édités (UTF-8 avec noms vides, Latin-1) ; `pnpm db:generate` avec un `DATABASE_PATH` jetable ; `scripts/check-origin.mjs` avec des chemins hérités vers une base « réelle » inventée ; garde de DATA-11 dans une copie jetable ; 17 fichiers de test de l’axe (211 tests). Chaque verdict autre que « fait », chaque « fait » issu d’un Critique, d’un Majeur ou d’un critère, plus de la moitié des autres « fait », et le seul constat ont été rejoués. Les portes complètes sont celles du lead (`$S/p12/gates/summary.txt`).

Notations : `$S` = `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214/scratchpad`, `$A` = `$S/p12/a1` (preuves de l’auditeur), `$V` = `$S/p12/v1` (preuves du vérificateur). Les `fichier:ligne` sont ceux de `cf48032d`.

## 1. Résumé

- **Régressions : aucune.** Ni dans les 78 lignes de l’audit, ni dans ses 9 constats, ni dans les tâches P7–P11 de l’axe.
- Verdicts, 97 lignes en tout :
  - traçabilité de l’audit, 78 lignes : 73 fait, 4 fait autrement, 1 sans objet ;
  - constats de l’audit (a1 M1, m1 à m8) : 9 fait ;
  - tâches P7–P11, 10 lignes : 5 fait (les 4 critères et DATA-09/Trouvé-1), 1 fait autrement (DATA-09/Trouvé-2), 4 pas fait (les 4 « Trouvé pendant DATA-14 », qu’aucune tâche ni décision ne reprend) ;
  - total : **87 fait, 5 fait autrement, 4 pas fait, 1 sans objet, 0 partiel, 0 régressé**.
- Constats nouveaux : **0 Critique, 0 Majeur, 1 Mineur** (V1-m1, la limite de 5 000 caractères comptée en points de code par l’API et en unités UTF-16 partout ailleurs), confirmé et complété par le vérificateur.
- Essais rejoués :
  - base `9df0d08c` mise à jour jusqu’à `cf48032d` et base neuve : mêmes 17 tables, mêmes colonnes dans le même ordre, 42 index identiques (SQL compris), 13 clés étrangères avec leurs `ON DELETE`, 2 CHECK, 16 migrations, `integrity_check` ok, aucun lien cassé, mêmes lignes seedées ; seule différence, les clés `access_code` et `barcode_last_number:WINE` d’une base qui a servi ;
  - une migration cassée arrête le démarrage (code 1), nomme les migrations en attente et n’applique rien, ni sa première instruction valide ;
  - millésime 0 : plus aucun 0 en base ni à l’écran, le filtre « Sans millésime » les trouve, un 0 envoyé devient NULL ;
  - 5 000 caractères : limite tenue par l’API et la migration, sauf pour les emoji (V1-m1) ;
  - `pnpm db:generate` : « No schema changes », aucun fichier écrit, aucune base ouverte.

## 2. Traçabilité (passe 1)

### Revue 1

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R1-C1a | ~25 connexions SQLite, `data/cellar.db` en dur | Corrigé | fait | `grep -rn "new Database(" src scripts e2e` → `src/lib/server/db/connection.ts:14` seul ; `src/lib/server/paths.ts:7-12` |
| R1-C1b | Restauration par `copyFile` sur la base ouverte | Corrigé | fait | `src/lib/server/db/index.ts:59-97` (copie `.restore` :68, migration :74, fermeture :81, `renameSync` :83, suppression `-wal`/`-shm` :86, réouverture :92) ; tests `index.test.ts:58,71,86,113`, verts (`$V/vitest-data.log`) |
| R1-C1c | Migrations non rejouées après restauration | Corrigé | fait | `index.ts:74` `migrateSchema(copy)` avant la bascule ; tests « migrates a backup made by an older version » (`index.test.ts:134`) et `:166`, verts |
| R1-M1 | Aucune transaction | Corrigé | fait | 21 `transaction(` hors tests ; `backup/repository.ts:31,57`, seeding par fichier (`seed.ts`, fonction `seed`) ; tests DATA-04 ci-dessous |
| R1-M2a | Pas d’unicité sur `barcode` | Corrigé | fait | `schema.ts:232` ; index `wine_bottles_barcode_unique … WHERE barcode IS NOT NULL` identique dans la base mise à jour et la base neuve (`$V/compare-upgraded-vs-fresh.txt`) |
| R1-M2b | Séquence calculée en JS entre des `await` | Corrigé | fait | `barcode/service.ts:50-59` `takeNextBarcodes(quantity, tx)`, appelé dans la transaction de création (`bottles/service.ts:96`) |
| R1-M3a | 38 routes font du `db.*` | Corrigé | fait | aucun fichier de `src/routes` hors tests n’importe `#lib/server/db`, drizzle-orm, better-sqlite3 ni un repository ; règle `eslint.config.js:51-74` |
| R1-M3b | CRUD des presets en double | Corrigé | fait | accès unique `features/labels/repository.ts` |
| R1-M4a | 7 fonctions d’import CSV quasi identiques | Corrigé | fait | `seed.ts:81-89` (`importLookupCsv`), `:100-144`, `:157-203`, `CSV_SEEDS` `:206-226` |
| R1-M4b | Logique recopiée dans `scripts/import-*.ts` | Corrigé | fait | `git ls-files scripts` : `check-i18n*`, `check-image.sh`, `check-origin.mjs`, `release*.mjs`, `throwaway-data.mjs`, `upgrade-path.mjs`, `data/*.csv` |
| R1-M4c | `seedInitialData` et `forceSeedInitialData` en double | Corrigé | fait | `seed(db, { force })`, appelé par le wipe (`backup/repository.ts:36`) et au démarrage (`index.ts:114`) |
| R1-M4d | CSV de formats en double | Corrigé | fait | `md5 scripts/data/*.csv` : aucun doublon |
| R1-M5a | `pnpm db:seed` vide la base de dev | Corrigé | fait | `package.json:25` : seul `db:generate` |
| R1-M5b | `scripts/test-*.ts` écrivent dans la vraie base | Corrigé | fait | fichiers absents ; `src/test/setup.ts` refuse toute base hors du dossier du test |
| R1-M6a | Migrations au premier hit, erreur avalée | Corrigé | fait | `src/hooks.server.ts:33-58` (`init`, `process.exit(1)` :57) ; essai : code 1, rien d’appliqué (`$V/broken-up.log`, `$V/broken-old.log`, `$V/broken-after.txt`) |
| R1-M6b | Promesse rejetée mise en cache | Corrigé | fait | `getDb()` synchrone (`index.ts:29-37`) |
| R1-m1 | `getFilteredWineBottles` ignore ses paramètres | Corrigé | fait | absente de `src` |
| R1-m2 | Bug de `trim` dans les `create*` | Corrigé | fait | `name = z.string().trim().min(1)` (`shared/schemas/common.ts:7`) ; `findOrCreate` (`lookup-crud.ts:89-92`) |
| R1-m3 | Doublons géographiques | Corrigé | fait | `schema.ts:55,70` ; `db-errors.ts:20,29` (`duplicate_region`, `duplicate_appellation`) |
| R1-m4a | Formes de retour imbriquée et à plat | Partiel | fait | API-09 : `withLocation` ne renvoie que la forme imbriquée (`catalog/repository.ts:43-51`, `getDefinitionWithLocation` `:60`) ; action 0.11.0 affichée au démarrage (« `appellations`, `regions` and `countries` are gone », `$V/up-server.log`) |
| R1-m4b | Retours `as any` | Corrigé | fait | aucun `as any` dans `src/lib/server` ; lint vert (`$S/p12/gates/summary.txt`) |
| R1-m5 | Résolution ID ou nom, `typeId!` | Corrigé | fait | `shared/schemas/wine.ts:19-21` exige les ids |
| R1-m6 | Réglages des codes-barres lus trop souvent | Corrigé | fait | une lecture par création (`barcode/service.ts:51`) |
| R1-m7a | `availability` en texte libre | Corrigé | fait | `schema.ts:239` ; CHECK identique dans les deux bases (`$V/compare-upgraded-vs-fresh.txt`) |
| R1-m7b | Enum en double | Corrigé | fait | `src/lib/shared/bottle-availability.ts` seul |
| R1-m7c | `parentContainerId` sans FK | Corrigé | fait | `schema.ts:163-165` ; FK `SET NULL` identique dans les deux bases |
| R1-m7d | `rating` sans CHECK | Corrigé | fait | `schema.ts:114` ; CHECK identique dans les deux bases |
| R1-m7e | Aucun index sur les FK | Corrigé | fait | 11 index `*_idx` dans la base `9df0d08c`, la base mise à jour et la base neuve (`$V/idx-count.txt`) : les « 12 » de l’audit étaient une erreur de compte, comme l’a vu l’auditeur |
| R1-m7f | Pas d’`ON DELETE` | Corrigé | fait | `SET NULL` `schema.ts:102,219` ; mêmes actions dans les deux bases |
| R1-m8a | Backfill rejoué à chaque démarrage | Corrigé | fait | `drizzle/0005_label_preset_spacing.sql` ; `migrations.test.ts:159` |
| R1-m8b | `runSchemaMigrations` au nom trompeur | Partiel | fait | DATA-14 : `src/lib/server/db/seed.ts` et `seed.test.ts` ; chaque `describe` de `migrations.test.ts` (`:34` à `:989`) teste une migration SQL, ses trois `seed(` ne servent qu’à préparer celle des préréglages (`:688,693`) |
| R1-m9 | `PRAGMA foreign_keys=OFF` sans effet | Corrigé | fait | `connection.ts:59` avant la transaction de Drizzle, garde `:134-156` ; tests `connection.test.ts:104-174`, verts |
| R1-m10 | Imports inutilisés | Corrigé | fait | lint et knip verts (`$S/p12/gates/summary.txt`) |
| R1-m11 | Code d’accès seedé à 1234 | Corrigé | fait | `DEFAULT_SETTINGS` sans `access_code` (`seed.ts:349-358`) ; base neuve : jeton d’installation (`$V/fresh-server.log`) |
| R1-m12 | Seeding lent hors transaction | Corrigé | fait | une transaction par fichier (`seed.ts`, `seed`) ; base neuve prête, migrations comprises, en moins de 2 s (`$V/fresh-server.log`) |
| R1-m13a | `wine_images_schema.sql` mort | Corrigé | fait | `git ls-files '*.sql'` : seulement `drizzle/` |
| R1-m13b | `scripts/migrate-wine-*.ts` morts | Corrigé | fait | absents de `git ls-files scripts` |
| R1-m13c | `scripts/import-wine-data.ts` | Corrigé | fait | absent |
| R1-m13d | `scripts/db-setup.ts` | Corrigé | fait | absent |
| R1-m14 | CSV en trois exemplaires | Corrigé | fait | `.gitignore:32` `/csv-imports/` ; `git ls-files '*.csv'` : `scripts/data/` et deux fixtures de test voulues (`src/test/label_presets-0.8.0.csv`, `-0.10.0.csv`) |

### Revue 7

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R7-C2 | Connexions multiples, ni WAL ni `busy_timeout` | Corrigé | fait | `connection.ts:17-26` ; `journal_mode = wal` dans les trois bases (`$V/idx-count.txt`) |
| R7-M1 | Healthcheck vert sur un schéma cassé | Corrigé | fait | migration cassée : sortie en code 1 avant l’écoute, rien sur le port 4518 (`$V/broken-up.log`, `$V/broken-old.log`) |

### Revue 3

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R3-M9 | Vingt connexions dans les routes CRUD | Corrigé | fait | `createLookupCrud` (`features/shared/lookup-crud.ts`) sur le `db` partagé ; aucune route n’importe la base |

### DATA-01

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DATA-01 | Un seul `new Database`, chemins lus dans l’environnement | Corrigé | fait | voir R1-C1a ; test « opens on first use, not when its module loads » (`index.test.ts:269`) |
| DATA-01/Trouvé-1a | 21 modules ouvrent leur connexion | Corrigé | fait | voir R1-C1a |
| DATA-01/Trouvé-1b | `handle` et routes admin non testables | Corrigé | fait | `src/hooks.server.test.ts` ; 24 `src/routes/api/admin/**/server.test.ts` |
| DATA-01/Trouvé-1c | `memory-db.ts` recopie `migrateSchema` | Corrigé | fait | absent ; `src/test/database.ts:3-12` réutilise `openDatabase` et `migrateSchema` |
| DATA-01/Trouvé-2a | Temporaires de l’import/export CSV dans `./data` | Corrigé | fait | `csv-import/parse.ts` parse en mémoire ; temporaires sous `DATA_DIR` |
| DATA-01/Trouvé-2b | `useScratchWorkDir()` à retirer | Corrigé | fait | aucune occurrence ; `src/test/scratch.ts` |
| DATA-01/Reste-1 | README-Docker : `data/cellar.db` en dur | Non fait | fait | DOC-03 : `README-Docker.md:243,257` lisent `DATABASE_PATH`, puis `DATA_DIR` |
| DATA-01/Reste-2 | Lien symbolique ou fichier monté seul | Non fait | fait | DOC-03 : `README-Docker.md:301-309` |
| DATA-01/Reste-3 | WAL sur partage réseau | Non fait | fait | DOC-03 : `README-Docker.md:311` (NFS, SMB) |

### DATA-02

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DATA-02 | Migration cassée : démarrage empêché, message clair | Corrigé | fait | essai du vérificateur : `0016_probe_broken` (un `CREATE TABLE` valide, puis un `UPDATE` sur une colonne absente) ; « Database migration failed, nothing was applied (pending migrations: 0016_probe_broken): … no such column: no_such_column », code 1, `__drizzle_migrations` inchangée (16 lignes), table `probe_v1` absente ; sur la base `9df0d08c`, les 8 migrations en attente nommées, 9 lignes inchangées, les 5 millésimes 0 intacts (`$V/broken-up.log`, `$V/broken-old.log`, `$V/broken-before.txt`, `$V/broken-after.txt`) ; test `connection.test.ts:28` |
| DATA-02/Trouvé-1a | Migrations au premier hit au-delà du healthcheck | Corrigé | fait | tout tourne dans `init` avant l’écoute ; `Dockerfile:80` `--start-period=40s` (décision « Healthcheck et racine (UI-04) ») |
| DATA-02/Trouvé-1b | `exitUnlessDirsWritable()` avant l’ouverture | Corrigé | fait | `index.ts:33` |
| DATA-02/Trouvé-1c | Échec seulement journalisé | Corrigé | fait | `hooks.server.ts:51-58` |
| DATA-02/Reste-1 | `vite dev` s’arrête au premier appel | Non fait | fait autrement | décision « Limites acceptées (audit d’avant 1.0) » (« `vite dev` s’arrête au premier appel quand une migration est cassée »), reprise par « Tâches de l’audit d’avant 1.0 (P9, P10, P11) » (« a1 DATA-02/Reste-1 ») |

### DATA-03

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DATA-03 | La migration passe sur une base de production | Corrigé | fait | base `9df0d08c` aux données sales (deux « Cave », deux « Rackx », prix négatif, textes longs, millésime 0) migrée de 0009 à 0015 sans erreur, `integrity_check` ok, 0 lien cassé (`$V/compare-upgraded-vs-fresh.txt`, `$V/upgraded-rows.txt`, `$V/up-server.log`) ; tests `migrations.test.ts:243` |
| DATA-03/Reste-1 | `foreign_key_check` complet à chaque démarrage | Non fait | fait | DATA-14 : `connection.ts:52-54` sort avant le garde sans migration en attente ; test « checks the foreign keys only when a migration is pending » (`connection.test.ts:50`) |

### DATA-04

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DATA-04 | Une insertion qui échoue laisse la base inchangée | Corrigé | fait | tests présents : `import-json/server.test.ts:518`, `wipe-database/server.test.ts:48`, `bottles/server.test.ts:64`, `storage-containers/[id]/server.test.ts:84,191`, `import-csv/server.test.ts:251` ; suite verte (`$S/p12/gates/summary.txt`) |

### DATA-06

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DATA-06 | 2 × 6 bouteilles simultanées → 12 codes distincts | Corrigé | fait | test « gives distinct barcodes to two creations sent at the same time » (`src/routes/api/bottles/server.test.ts:169`), vert (`$V/vitest-data.log`) |
| DATA-06/Trouvé-1 | Préfixe vide : un code manuel à 10 chiffres déplace la séquence | Partiel | fait autrement | décision « Limites acceptées (audit d’avant 1.0) » (« `9999999999` épuise la séquence ») ; `barcode/repository.ts:95-107` |
| DATA-06/Trouvé-2 | Anciens codes à 13 caractères | Corrigé | fait | `barcode/repository.ts:95-107` ; test « continues after the highest old code » (`bottles/service.test.ts:319`), vert |
| DATA-06/Trouvé-2-limites | `CV2025…` → 409 ; EAN-13 manuel | Écart décidé | fait autrement | décision « Anciens codes-barres (BUG-01, DATA-06) » |

### DATA-07

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DATA-07 | CSV sans doublon, `scripts/` réduit, seeding correct | Corrigé | fait | 6 CSV sous `scripts/data/` ; base neuve : 5 types, 5 couleurs, 19 classifications, 6 formats, 449 appellations, 28 préréglages (`$V/fresh-server.log`) |
| DATA-07/Trouvé-1 | `.claude/settings.local.json` et un PDF suivis | Corrigé | fait | `git ls-files .claude '*.pdf'` vide |
| DATA-07/Trouvé-2 | Ne pas combiner `latin1` et `trim` | Corrigé | fait | `decodeCsv` (`seed.ts:37-43`), sans encodage ni `trim` dans csv-parse ; trim à la main (`:113-115`) |
| DATA-07/Trouvé-3 | `static/uploads` dans `build/` | Corrigé | fait | `vite.config.test.ts:55`, vert (`$V/vitest-data.log`) |
| DATA-07/Trouvé-4a | `docker-setup.sh` : instructions fausses | Corrigé | fait | script supprimé par DOC-03 : plus d’instruction fausse |
| DATA-07/Trouvé-4b | Commentaire du compose faux | Corrigé | fait | `docker-compose.yml:28` |
| DATA-07/Trouvé-4c | « no trailing slash » | Corrigé | fait | absent de `docker-compose.yml` et `.env.example` |
| DATA-07/Trouvé-4d | `container_name: wine-cellar` | Sans objet | sans objet | toujours voulu, `docker-compose.yml:7` |
| DATA-07/Trouvé-4e | `.claude/` dans les archives | Corrigé | fait | non suivi par git |
| DATA-07/Trouvé-5a | `appellations.csv` sans en-tête | Corrigé | fait | `isAppellationsHeader` (`seed.ts:92-97,109`) ; test `seed.test.ts:61` |
| DATA-07/Reste-1 | 0004 et une chaîne entamée à la main | Non fait | fait autrement | décision « Limites acceptées (audit d’avant 1.0) » (« La migration 0004 ne répare qu’en partie… ») |
| DATA-07/Reste-2 | `appellations.csv` lu en latin1 | Non fait | fait | DATA-14 : fichier livré en UTF-8, mêmes octets que celui de `9df0d08c` réencodé (`$V/appellations-cmp.log`) ; essai : copie UTF-8 éditée → « Côtes du Rhône », copie Latin-1 → « Côte-Rôtie », « Mâcon-Villages » (`$V/seed-rows.txt`) ; copie non modifiée de l’ancien fichier remplacée au démarrage (« Replaced the outdated appellations.csv », `$V/up-server.log`) |
| DATA-07/Reste-3 | Wrapper d’adapter-node sans test | Non fait | fait | DATA-14 : `vite.config.test.ts:55` |

### BUG-11

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-11 | Base neuve sans « Pays/Région/Appellation » | Corrigé | fait | base neuve : 0 pays `Pays`/`Country`, 0 région `Région`, 0 appellation `Appellation%` (requête sur `$V/fresh-snapshot.db`) ; tests `seed.test.ts:53`, `migrations.test.ts:34` |

### Constats de l’audit (a1)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| a1 M1 | Millésime 0 lu de deux façons | Majeur | fait | DATA-09, voir § DATA-09 |
| a1 m1 | Deux cases de même nom confondues par l’export CSV | Mineur | fait | UI-12 : 0013 et 0014 ; base `9df0d08c` mise à jour : conteneurs `Cave`, `Cave (2)`, `Rack`, cases `Cave1`, `Cave2`, `Cave (2)1`, `Rackx`, `Rackx (2)` (`$V/upgraded-rows.txt`) ; export avec `containerName` (`$V/export-wineBottles.csv`) ; export puis import dans la base neuve : chaque bouteille revient dans sa case (`$V/roundtrip-cases.log`) |
| a1 m2 | Seeding de noms vides | Mineur | fait | DATA-14 : `seed.ts:61-70` ; essai : « wine_types.csv: line 3 skipped, no name », « appellations.csv: line 3 skipped, no region, appellation », lignes 4 et 5 de même, aucun nom vide en base (`$V/seed-utf8-server.log`, `$V/seed-rows.txt`) |
| a1 m3 | `check-origin.mjs` peut migrer la base du développeur | Mineur | fait | REL-05 : `scripts/check-origin.mjs:38-40` + `scripts/throwaway-data.mjs:10-17` ; essai avec `DATA_DIR`, `DATABASE_PATH`, `UPLOADS_DIR`, `CSV_IMPORTS_DIR` hérités vers une base inventée : 6 « ok », code 0, SHA-1 inchangé, aucun fichier ajouté (`$V/check-origin.log`) |
| a1 m4 | Pas de garde CI schéma/migrations | Mineur | fait | `.github/workflows/ci.yml:42-45` ; `pnpm db:generate` : « No schema changes », `git status` vide, aucune base créée (`$V/db-generate.log`) |
| a1 m5 | Le message ne nomme pas la migration | Mineur | fait | DATA-14 : `connection.ts:71-73` ; essai, voir DATA-02 |
| a1 m6 | Copies de migrations des tests jamais supprimées | Mineur | fait | DEP-06 : `src/test/database.ts:29` (`scratchFolder`) ; 17 fichiers de test lancés : 3 388 `cellar-migrations-*` dans le dossier temporaire avant comme après (restes d’avant la correction) (`$V/tmp-migrations-before.txt`, `$V/tmp-migrations-after.txt`) |
| a1 m7 | Requêtes géographiques et `timestamps()` recopiés | Mineur | fait | DATA-14 : `backup/repository.ts:81,83` reprennent `regionsWithCountry`/`appellationsWithRegion` ; `$defaultFn` `schema.ts:27,33` ; `timestamps()` seulement dans `access-code.test.ts` ; plus de `createdAt: now` hors tests |
| a1 m8 | Replis morts `'Unknown'`, `'Standard'` | Mineur | fait | API-09 : jointures internes `catalog/repository.ts:30-34` ; seuls `'Unknown error'` restent (`images/service.ts:266,344`), des messages d’erreur |

### Points restés ouverts de l’audit (§ 4)

Tous ont leur verdict ci-dessus : DATA-01/Reste-1 à 3 (fait), DATA-02/Reste-1 (fait autrement), DATA-03/Reste-1 (fait), DATA-07/Reste-1 (fait autrement), DATA-07/Reste-2 et Reste-3 (fait), R1-m4a et R1-m8b (fait), DATA-06/Trouvé-1 (fait autrement), a1 m2, m5, m7, m8 (fait).

### DATA-09 · Millésime 0 lu comme « sans millésime »

| Point | Verdict | Preuve |
|---|---|---|
| Critère : base au millésime 0 mise à jour, plus aucun « 0 » affiché, le filtre « Sans millésime » les trouve ; un millésime 0 enregistré donne une bouteille sans millésime | fait | base `9df0d08c` (5 bouteilles à 0, dont une bue) mise à jour : `vintage` NULL (`$V/upgraded-rows.txt`) ; `winesByDecade` sans décennie 0 (`$V/probe.log`) ; aucune plage « 0-AAAA » sur `/wines`, aucun « Delta 0 », « Epsilon 0 », « Gamma 0 » sur `/cellar-history`, `/admin/data/bottles`, `/out-of-cellar`, `/statistics` ; `GET /api/barcode/export-all` : millésime vide ; `/wines?vintage=no_vintage` affiche Cava Delta et Clos Epsilon, pas Domaine Gamma dont la seule bouteille sans millésime est bue (`$V/vintage-filter.log`). Écrire 0 : `POST /api/bottles`, `PATCH` 2001 → 0, form action `/wines?/createBottles`, ligne d’import CSV : NULL (`$V/probe.log` ; V0-POST, V0-PATCH, V0-FORM, CSV-V0). Code `drizzle/0010_vintage_zero_as_null.sql`, `shared/schemas/bottle.ts:20-24`. L’optimum 0 reste 0 (`WINE000010`), voulu |
| Trouvé-1 : tests « faux » `!vintage`, `\|\|` inutiles | fait | rattaché à une tâche P9 (`tasks.mjs:1377`, « DATA-09/1 ») ; `git grep` à `cf48032d` : plus aucun ; le seul `!filter.vintage` (`src/routes/admin/data/bottles/+page.svelte:36`) teste le filtre, pas le millésime ; `wine-filters.ts:51-56` compare à `null` |
| Trouvé-2 : le PDF n’imprime que le code | fait autrement | décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) » : DATA-09/2 parmi « ce qui est accepté ou seulement informatif » |

### DATA-10 · Limite de 5 000 caractères

| Point | Verdict | Preuve |
|---|---|---|
| Critère : plus de 5 000 caractères refusés par l’API, impossibles à taper, limite montrée ; base plus ancienne mise à jour, textes coupés à 5 000, autres champs inchangés | fait | base `9df0d08c` : note de 8 998 caractères et description de 8 200 en CRLF → 5 000, LF seulement ; description de 5 001 sans CRLF → 5 000 ; note courte en CRLF → LF ; millésime, case, prix, `updated_at` inchangés (`$V/upgraded-rows.txt`). API : note de 5 001 → 422 `invalid_body` ; 5 000 → 201 ; 4 998 + CRLF + 1 → 201, 5 000 après LF ; `addedNote` sur une note de 5 000 → 422 `notes_too_long` ; description de 5 001 → 422, de 5 000 → 201 ; import CSV d’une note de 6 000 → 5 000 (`$V/probe.log`). Formulaires : `LongTextarea.svelte:26` (`maxlength`), compteur `:30-35` (lecture du code ; captures à la charge des axes UI). Les emoji font exception : voir V1-m1 |

DATA-10 n’a ni « Trouvé pendant » ni « Reste ».

### DATA-11 · La base sous `src/lib/server`

| Point | Verdict | Preuve |
|---|---|---|
| Critère : `src/lib/db/` n’existe plus ; un composant qui importe la base fait échouer `pnpm build` (« server-only ») ; `db:generate` ne crée rien ; portes vertes | fait | `src/lib/db` absent ; copie jetable du worktree, import de `#lib/server/db/index.js` ajouté à `src/lib/components/layout/ErrorMessage.svelte` (`$V/dk11-edit.diff`) : `vite build` sort en code 1, « SvelteKit error: server_only_import … Cannot import `#lib/server/db/index.ts` into code that runs in the browser » (`$V/dk11-build.log`) ; `$V/db-generate.log` ; `$S/p12/gates/summary.txt` |

DATA-11 n’a ni « Trouvé pendant » ni « Reste ».

### DATA-14 · Données, seeding et migrations : restes de l’audit

| Point | Verdict | Preuve |
|---|---|---|
| Critère : ligne de noms vides sautée et signalée ; UTF-8 → « Côtes » ; migration cassée qui nomme les migrations en attente ; `db:generate` vide après `$defaultFn` ; plus de `createdAt: now, updatedAt: now` recopié | fait | `$V/seed-utf8-server.log`, `$V/seed-rows.txt` ; `$V/broken-old.log` (8 migrations en attente nommées) ; `$V/db-generate.log` ; `git grep "createdAt: now"` vide hors tests, le seul `createdAt:` écrit hors schéma est l’import JSON (`json-import.ts:107`) |
| Trouvé-1 : `vite.config.test.ts` pourrait reprendre `scratchFolder` | pas fait | `vite.config.test.ts:16-19` garde son propre nettoyage ; aucune tâche ni décision |
| Trouvé-2 : paramètre `out` d’`adapterWithoutUploads` utile au seul test | pas fait | `vite.config.ts:26-29` ; aucune tâche ni décision |
| Trouvé-3 : journal de migrations absent → erreur brute | pas fait | `connection.ts:86-90` ; essai : « Cellar cannot start: … Error: ENOENT: no such file or directory, open 'drizzle/meta/_journal.json' », code 1 (`$V/no-journal.log`) ; à `9df0d08c`, c’était `migrate` de Drizzle qui lisait le journal (`src/lib/db/connection.ts:56` de ce commit) ; l’image livre `drizzle/` ; aucune tâche ni décision |
| Trouvé-4 : export CSV en jointure interne | pas fait | `geography/repository.ts:17,34-35` ; point informatif (n’écarte que des lignes d’une base modifiée à la main), qu’aucune décision n’accepte ni ne classe |

## 3. Nouveaux constats (passe 2)

Vérifié sans constat par le vérificateur :
- base `9df0d08c` mise à jour et base neuve identiques (`$V/compare-upgraded-vs-fresh.txt`) : tables, colonnes et leur ordre, types, défauts, 42 index avec leur SQL, 13 FK et leurs actions, 2 CHECK, journal de 16 migrations, lignes seedées (449 chaînes pays/région/appellation, 28 préréglages identiques hors id et dates) ;
- migrations 0009 à 0015 jouées ensemble sur des données sales : doublons renommés sans bouteille déplacée, prix négatif retiré avec « Purchase price -7 removed in the Cellar upgrade: prices are 0 or more. » dans les notes, `updated_at` des bouteilles et des vins non touché par 0010 et 0011 (`$V/upgraded-rows.txt`) ;
- échec de migration : tout est annulé, y compris l’instruction valide qui précède l’erreur dans la même migration (`probe_v1` absente, `$V/broken-after.txt`) ;
- `PATCH` d’un champ sans rapport sur une bouteille dont la note dépasse 5 000 unités : 200 (`changesFor`, `bottles/service.ts:59-72`, ne reprend les notes que si on les envoie) ;
- copie Latin-1 de `appellations.csv` lue correctement (`$V/seed-rows.txt`).

### Régressions

Aucune.

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

**V1-m1. Les 5 000 caractères comptés de deux façons : l’API accepte une note que son propre PATCH refuse ensuite et que l’export puis l’import CSV coupent sans le dire**
- Ce qui se passe :
  - `POST /api/bottles`, `POST /api/definitions` et tout champ `longText` comptent en points de code : zod 4.6.7 mesure ainsi `.max()` (`node_modules/zod/v4/core/checks.js:272-273`, « Strings are measured in Unicode code points, not UTF-16 units »). Une note de 2 600 emoji (5 200 unités UTF-16) est acceptée (201), et une de 5 000 emoji (10 000 unités) aussi.
  - Le contrôle `notes_too_long` de `updateBottles` compte les unités UTF-16 (`fields.notes?.length`). Un `PATCH /api/bottles/{id}` qui renvoie la note telle quelle reçoit 422 `notes_too_long`, avec « The note does not fit after the notes of 1 bottle(s) » alors qu’aucune note n’est ajoutée ; `docs/API.md` ne liste pas ce 422 pour `PATCH /api/bottles/{id}` (ajouté par le vérificateur). Une note de consommation (`addedNote: "ok"`) est refusée de même.
  - L’import CSV et l’import JSON coupent à 5 000 unités UTF-16 (`.slice`). Un export CSV puis un import ramènent la note de 2 600 emoji à 2 500, et celle de 5 000 emoji à 2 500 (la moitié perdue), sans ligne dans le compte rendu.
  - Le formulaire compte aussi en unités UTF-16 (`maxlength`, compteur `value.length`). Le commentaire de `LongTextarea.svelte:9-10` dit pourtant qu’il « takes no more characters than the API does », et celui de la migration 0011 que « the app counts UTF-16 units ».
  - Attendu : une seule mesure pour l’API, le PATCH, les imports et le formulaire (par exemple un `refine` sur `.length` dans `longText`, comme le navigateur), ou une documentation qui dise que l’API compte en points de code.
- Décision : « Longueur des textes (DATA-10) » accepte qu’un texte coupé par la mise à jour, qui compte un emoji pour un caractère, doive être raccourci avant d’être réenregistré. Elle ne couvre ni une note neuve que l’API accepte et que son PATCH refuse, ni la perte silencieuse lors d’un aller-retour CSV d’une note écrite en 1.0.
- Reproduction (serveur `cf48032d`, session ouverte) :
  1. `POST /api/bottles {definitionId, formatId, notes: "🍷".repeat(2600)}` → 201, 5 200 unités.
  2. `PATCH /api/bottles/{id} {notes: <la même note>}` → 422 `notes_too_long`.
  3. `PATCH /api/bottles {ids:[id], changes:{}, addedNote:"ok"}` → 422 `notes_too_long`.
  4. `POST /api/admin/export-csv` de toutes les tables, puis `POST /api/admin/import-csv` dans une base neuve : 5 200 → 5 000 unités ; une note de 5 000 emoji : 10 000 → 5 000.
- Preuves : auditeur `$A/probe-texts.log`, `$A/probe-emoji.log`, `$A/roundtrip.log`, `$A/zod-emoji-4.6.5.log`, `$A/zod-emoji-4.6.7.log` ; vérificateur `$V/probe.mjs`, `$V/probe.log` (« POST notes 2600 emoji … 201 stored units 5200 », « PATCH /{id} same notes -> 422 notes_too_long », « POST notes 5000 emoji (10000 units) -> 201 », « EMOJI-5000: notes units 10000 -> 5000 »), `$V/export-wineBottles.csv`.
- `fichier:ligne` : `src/lib/shared/schemas/common.ts:53-57` (`longText`, via `optionalText` `:17-24`) ; `src/lib/server/features/bottles/service.ts:135-145` ; `src/lib/server/features/shared/imported-rows.ts:155-162` ; `src/lib/components/forms/LongTextarea.svelte:9-10,26,32` ; `drizzle/0011_long_texts_to_5000_characters.sql:6-8` ; `docs/API.md:777-795`.
- Régression : non. Présent depuis DATA-10 (contrôle `.length` ajouté par `2e2d18cc`, 2026-10-18) : zod 4.6.5, installé à `9df0d08c` et à `fa32bc58`, comptait déjà en points de code (`codePointLength` présent dans son `checks.js`), et le lockfile de `fa32bc58` épingle `zod@4.6.5`. Seuls l’API et les scripts sont touchés : le formulaire ne laisse pas taper plus de 5 000 unités.

## 4. Déjà connus

- « Trouvé pendant DATA-14 » (`tasks.mjs:1677`) : les quatre points sont toujours vrais à `cf48032d` et rattachés à aucune tâche (verdict « pas fait » au § DATA-14, pas des constats).
- Décision « Limites acceptées (audit d’avant 1.0) » : code manuel de 10 chiffres sous un préfixe vide, 0004 partielle, arrêt de `vite dev` sur une migration cassée.
- Décision « Longueur des textes (DATA-10) » : emoji compté 1 en base et 2 ou plus dans l’app pour un texte coupé à la mise à jour (base mise à jour : `WINE000009`, 6 000 emoji coupés à 5 000 points de code, soit 10 000 unités ; `WINE000008`, 3 000 emoji non coupés, soit 6 000 unités ; `$V/upgraded-rows.txt`). C’est la partie couverte de V1-m1.
- Décision « Noms de rangement uniques (UI-12) » : unicité à l’identique, « Cave » et « cave » coexistent, l’import CSV prend le premier.
- Décision « Prix négatifs (UI-06) » : prix retiré par la migration 0015 avec une ligne dans les notes.
- « Trouvé pendant API-09 » : sur une base modifiée à la main avec des références cassées, les vins quittent les listes (jointures internes).
- Pour mémoire, rapporté par l’auditeur, non rejoué : la migration 0011 garde un saut de ligne final quand la coupe tombe dessus, l’import le retire (`trim`), 5 000 devient 4 999 après un aller-retour CSV.

## 5. Corrections du vérificateur

- DATA-09, critère : verdict inchangé (fait), preuve remplacée. L’auditeur citait `/wines?vintage=none` ; la valeur du filtre « Sans millésime » est `no_vintage` (`src/lib/utils/wine-filters.ts:17,77`), et `none` retombe sur « pas de filtre » (`.catch('')`) : la page montre alors tous les vins (`$V/vintage-filter.log`). Rejoué avec `?vintage=no_vintage` : seuls les vins qui ont une bouteille en cave sans millésime.
- DATA-10, critère : l’auditeur notait « fait (voir V1-m1 pour les emoji) » ; même verdict, écrit « fait » avec le renvoi à V1-m1 dans la preuve.
- DATA-14/Trouvé-4 : l’auditeur notait « pas fait (constat) » ; écrit « pas fait », mot de verdict exact, avec la mention « point informatif ».
- V1-m1 : confirmé, sévérité Mineur gardée. Complété : une note de 5 000 emoji (10 000 unités) est aussi acceptée et perd la moitié de sa longueur à l’aller-retour CSV ; `docs/API.md` ne liste pas `422 notes_too_long` pour `PATCH /api/bottles/{id}`, que l’endpoint renvoie. Titre ramené à « deux façons » : il n’y a que deux mesures, points de code (zod, SQLite) et unités UTF-16 (service, imports, formulaire).
- DATA-14/Trouvé-3 : précisé par un essai (`$V/no-journal.log`) et par le code de `9df0d08c`, où le journal était lu par Drizzle. Verdict inchangé.
- Aucun constat rejeté, aucun ajouté hors V1-m1.

## 6. Désaccords

Aucun. Les verdicts, le constat et sa sévérité, et la réponse « non » à « Régression » sont les mêmes que ceux de l’auditeur ; les corrections ci-dessus portent sur des preuves et des mots, pas sur le fond.

## 7. Renvois

- `docs/roadmap/status.json:125-140` : `audit-T1` à `audit-T16` sont tous « todo » (16 lignes), avec des notes qui renvoient à des tâches faites (DATA-12, DATA-14…) → lead ou axe 7.
- `server.js` : `PORT=` vide fait planter le démarrage (`RangeError [ERR_SOCKET_BAD_PORT] … Received type string ('')`) au lieu de prendre le port par défaut. Rencontré par l’auditeur (`$A/mistake/`) et, par la même erreur de shell, par le vérificateur (`$V/mistake-empty-port/-server.log`) → axe 7.
- Restauration d’une sauvegarde d’une version plus récente : `migrateSchema` ne trouve rien en attente (`connection.ts:91-92`) et ne la refuse pas lui-même ; le refus revient au contrôle de version de la restauration (`backup/restore.ts`), non vérifié ici → axe 3.
