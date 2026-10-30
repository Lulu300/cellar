# Audit d'avant 1.0, axe 1 : données et scripts

Commit audité `9df0d08c` (develop, 2026-10-16). Périmètre : schéma, connexion et migrations (`src/lib/db/`, `drizzle/`), repositories et transactions, séquence des codes-barres, seeding, `scripts/`. Méthode : lecture du code, puis l'app lancée depuis un worktree détaché avec des données inventées : migration cassée `0009_broken` ajoutée à une copie de `drizzle/` pour voir le démarrage échouer, base migrée de 0000 à 0008 comparée à une base créée par `drizzle-kit push`, `drizzle-kit generate` sur une base jetable, sondes Vitest, `scripts/check-origin.mjs` lancé sur une base inventée. Chaque constat a été revu par un second agent, qui l'a rejoué dans son propre worktree pour tenter de le réfuter. Le rédacteur a vérifié par lecture du code le point signalé par un autre axe et les emplacements du millésime 0.

## 1. Résumé

La couche de données relevée par la revue 1 a disparu : une seule connexion (`src/lib/db/connection.ts:12`), des chemins lus dans l'environnement, WAL et `busy_timeout`, des migrations qui tournent avant l'écoute et arrêtent le processus quand elles échouent, des transactions autour de chaque écriture multiple, une séquence de codes-barres prise dans la transaction de création, des contraintes et des index alignés sur `schema.ts`. Sur 78 lignes de traçabilité, 65 sont corrigées. Ce qui reste ouvert est surtout de la documentation d'exploitation (README-Docker : chemin en dur, lien symbolique, WAL sur partage réseau) et des restes du seeding (lecture en latin1, migration 0004). La passe 2 trouve un Majeur : le millésime 0 laissé par l'ancien import CSV, que la moitié de l'interface lit comme « sans millésime » et l'autre comme l'an 0. Ce que 0 veut dire est à décider par le mainteneur. Elle trouve aussi huit Mineurs, dont deux cases de même nom que l'export CSV confond (m1) et un script de CI qui peut migrer la base du développeur (m3).

## 2. Traçabilité (passe 1)

78 lignes : 65 Corrigé, 3 Partiel, 8 Non fait, 1 Sans objet, 1 Écart décidé. Le vérificateur a contrôlé 51 lignes : les 13 qui ne sont pas corrigées, les « Corrigé » issus d'un Critique, d'un Majeur ou d'un critère, et un échantillon des autres. Il n'a changé aucun verdict et n'a ajouté aucune ligne. DATA-04 n'a ni « Trouvé » ni « Reste ».

### Revue 1

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R1-C1a | ~25 connexions SQLite, `data/cellar.db` en dur ~30 fois | Corrigé | `grep -rn "new Database" src` → `src/lib/db/connection.ts:12` seul ; chemins dans `src/lib/server/paths.ts:7-12` (`DATA_DIR`, `DATABASE_PATH`, `UPLOADS_DIR`, `CSV_IMPORTS_DIR`) |
| R1-C1b | Restauration : `copyFile` par-dessus la base ouverte | Corrigé | `src/lib/db/index.ts:45-82` : copie vers `.restore`, fermeture, `renameSync`, suppression de `-wal`/`-shm`, réouverture ; tests `index.test.ts` « leaves the live database whole and served when the copy fails halfway », « reopens the live database when the swap fails », « does not let a WAL file left by the replaced database reach the new one » |
| R1-C1c | Migrations non rejouées après restauration | Corrigé | `index.ts:57-59` migre la copie avant la bascule ; test « migrates a backup made by an older version » (`index.test.ts:114`) |
| R1-M1 | Aucune transaction (conteneur, N bouteilles, seeding, wipe, imports) | Corrigé | 20 `transaction(` hors tests (`storage/service.ts:195`, `bottles/service.ts:56-70`, `migrations.ts:289`, `backup/repository.ts:28,54`, `csv-import/service.ts:76`) ; voir DATA-04 |
| R1-M2a | Pas d'unicité sur `barcode` | Corrigé | `schema.ts:208-210` ; base migrée : index `wine_bottles_barcode_unique` partiel (`WHERE barcode IS NOT NULL`) |
| R1-M2b | Séquence calculée en JS entre plusieurs `await` | Corrigé | `barcode/service.ts:47-56` : `takeNextBarcodes` dans la transaction de création, compteur par préfixe ; voir DATA-06 |
| R1-M3a | 38 routes font du `db.*` | Corrigé | aucune route n'importe `#lib/db/index` ; règle `no-restricted-imports` (`eslint.config.js:56-81`) interdit aux routes db, drizzle, better-sqlite3 et les repositories |
| R1-M3b | CRUD des presets en double entre `services.ts` et les routes | Corrigé | `services.ts` supprimé ; accès unique dans `features/labels/repository.ts:8-38` |
| R1-M4a | 7 fonctions d'import CSV quasi identiques | Corrigé | `importLookupCsv` générique, `importAppellationsCsv`, `importLabelPresetsCsv`, table `CSV_SEEDS` (`migrations.ts:66-78,210-230`) |
| R1-M4b | Logique recopiée dans `scripts/import-*.ts` | Corrigé | `git ls-files scripts` : `check-i18n.mjs`, `check-origin.mjs`, `release*.mjs`, `upgrade-path.mjs`, `data/*.csv` |
| R1-M4c | `seedInitialData` et `forceSeedInitialData` en double | Corrigé | `seed(db, { force })` (`migrations.ts:276`), utilisé par le wipe (`backup/repository.ts:33`) |
| R1-M4d | `wine_formats.csv` et `wine_bottle_formats.csv` identiques | Corrigé | seul `wine_formats.csv` reste ; `md5` des 6 CSV : aucun doublon |
| R1-M5a | `pnpm db:seed` vide la base de dev réelle | Corrigé | `package.json` ne garde que `db:generate` |
| R1-M5b | `scripts/test-*.ts` écrivent dans la vraie base | Corrigé | fichiers supprimés ; `src/test/setup.ts:34-46` refuse toute base hors du dossier temporaire |
| R1-M6a | Migrations au premier hit, erreur avalée | Corrigé | `hooks.server.ts:27-57` (`init`, `process.exit(1)`) ; essai réel avec `0009_broken` : code de sortie 1, « ❌ Cellar cannot start … duplicate column name: vintage », `__drizzle_migrations` inchangée |
| R1-M6b | Promesse rejetée mise en cache | Corrigé | `getDb()` synchrone (`index.ts:15-23`) |
| R1-m1 | `getFilteredWineBottles` ignore ses paramètres | Corrigé | fonction absente de `src` |
| R1-m2 | Bug de `trim` dans les `create*` | Corrigé | `name = z.string().trim().min(1)` (`shared/schemas/common.ts:7`) ; `findOrCreate` cherche le nom trimé (`lookup-crud.ts:86-106`) |
| R1-m3 | Doublons géographiques possibles | Corrigé | index uniques `regions_country_id_name_unique`, `appellations_region_id_name_unique` (`schema.ts:39,54`) ; 409 `duplicate_region`/`duplicate_appellation` (`db-errors.ts:20-37`) |
| R1-m4a | Formes de retour incohérentes (imbriqué et à plat) | Partiel | `catalog/repository.ts:70-81` renvoie la forme imbriquée et aussi `appellations`, `regions`, `countries` à plat ; un seul appelant (`catalog/service.ts:84`), aucun code de `src` ne lit les champs à plat ; seul le JSON de `GET /api/definitions/{id}` les porte |
| R1-m4b | Retours `as any` | Corrigé | aucun `as any` dans `src/lib/server` ni `src/lib/db` ; `no-explicit-any` en erreur (décision UI-03) |
| R1-m5 | Résolution ID ou nom en double, `typeId!` | Corrigé | `wineDefinitionSchema` exige les IDs (`shared/schemas/wine.ts:19-21`) ; décision « Action de mise à jour 0.7.0 » |
| R1-m6 | Réglages des codes-barres lus trop souvent | Corrigé | une lecture par création (`barcode/service.ts:48`) |
| R1-m7a | `availability` en texte libre | Corrigé | `$type<BottleAvailability>()` et `CHECK(availability IN (…))` (`schema.ts:198-201,215`), présent dans la base migrée |
| R1-m7b | Enum `BottleAvailability` en double | Corrigé | une définition, `src/lib/shared/bottle-availability.ts:2-9` |
| R1-m7c | `parentContainerId` sans FK | Corrigé | `schema.ts:147-150` ; base migrée : FK vers `storage_containers.id`, `ON DELETE SET NULL` |
| R1-m7d | `rating` sans `CHECK` | Corrigé | `CHECK(rating BETWEEN 1 AND 5)` (`schema.ts:98`, migration 0006) |
| R1-m7e | Aucun index sur les FK | Corrigé | 12 index `*_idx` dans la base migrée ; `regions.country_id` et `appellations.region_id` couverts par les index uniques composites |
| R1-m7f | Pas d'`ON DELETE` : supprimer un vin avec bouteilles → 500 | Corrigé | `SET NULL` sur case et image (`schema.ts:86,194-196`) ; vin utilisé → 409 `in_use` (`catalog/service.ts:114-129`) |
| R1-m8a | Backfill `migrateLabelPresetSpacing` rejoué à chaque démarrage | Corrigé | devenu `drizzle/0005_label_preset_spacing.sql` ; tests « migration filling the spacing of the label presets » |
| R1-m8b | `runSchemaMigrations` porte un nom trompeur | Partiel | la fonction n'existe plus, mais `src/lib/db/migrations.ts` ne contient que le seeding (`seed`, `SeedingError`) : le nom trompeur est passé au fichier, et `migrations.test.ts` mêle seeding et migrations SQL |
| R1-m9 | `PRAGMA foreign_keys=OFF` sans effet dans 0002 | Corrigé | `connection.ts:47-72` coupe les FK avant la transaction de Drizzle, avec un garde qui annule tout si un lien casse ; tests `connection.test.ts` « foreign keys » |
| R1-m10 | Imports inutilisés dans `migrations.ts` | Corrigé | tous utilisés ; `pnpm lint` et `pnpm knip` passent (`gates.log`) |
| R1-m11 | Code d'accès en clair seedé à 1234 | Corrigé | `DEFAULT_SETTINGS` sans `access_code` (`migrations.ts:319-328`) ; base neuve : jeton d'installation dans les logs |
| R1-m12 | Seeding lent, ~2 700 requêtes hors transaction | Corrigé | une transaction par fichier (`migrations.ts:287-298`) ; base neuve prête en 0,47 s (migrations, 449 appellations, 28 presets) |
| R1-m13a | `wine_images_schema.sql` mort | Corrigé | `git ls-files '*.sql'` : seulement `drizzle/` |
| R1-m13b | `scripts/migrate-wine-*.ts` morts | Corrigé | supprimés |
| R1-m13c | `scripts/import-wine-data.ts` plante | Corrigé | supprimé |
| R1-m13d | `scripts/db-setup.ts` insère des colonnes disparues | Corrigé | supprimé |
| R1-m14 | CSV en trois exemplaires (`csv-imports/` commité, `appellations.csv` à la racine) | Corrigé | `.gitignore:25-26` ignore `/csv-imports/` ; `git ls-files '*.csv'` : seulement `scripts/data/` |

### Revue 7

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R7-C2 | 21+ connexions, chemins en dur, ni WAL ni `busy_timeout` | Corrigé | une connexion (R1-C1a) ; `journal_mode = WAL`, `busy_timeout = 5000`, `foreign_keys = ON` (`connection.ts:15-20`) |
| R7-M1 | Migrations à la première requête, healthcheck vert sur un schéma cassé | Corrigé | migration cassée : sortie en code 1 avant l'écoute (essai réel, voir R1-M6a) |

### Revue 3

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R3-M9 | Vingt connexions séparées dans les routes CRUD | Corrigé | routes servies par `createLookupCrud` (`features/shared/lookup-crud.ts`), sur le `db` partagé ; aucune route n'importe la base |

### DATA-01

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DATA-01 | Un seul `new Database` dans `src`, chemins lus dans l'environnement | Corrigé | `connection.ts:12` seul, tests compris ; `paths.ts:7-12` ; `pnpm build` ne crée pas `data/` ; test « opens on first use, not when its module loads » (`index.test.ts:249`) |
| DATA-01/Trouvé-1a | 21 modules ouvrent leur connexion | Corrigé | voir R1-C1a |
| DATA-01/Trouvé-1b | `handle` et les routes admin non testables | Corrigé | `src/hooks.server.test.ts` ; 13 `src/routes/api/admin/*/server.test.ts` |
| DATA-01/Trouvé-1c | `src/test/memory-db.ts` recopie `migrateSchema` | Corrigé | fichier supprimé ; `src/test/database.ts` réutilise `openDatabase` et `migrateSchema` |
| DATA-01/Trouvé-2a | Import et export CSV écrivent leurs temporaires dans `./data` | Corrigé | l'import CSV parse en mémoire (`csv-import/parse.ts:11-20`) ; temporaires sous `DATA_DIR` seulement (`images/service.ts:243`, `json-import.ts:162`, `backup/service.ts:255`) |
| DATA-01/Trouvé-2b | `useScratchWorkDir()` à retirer | Corrigé | `src/test/work-dir.ts` absent, aucune occurrence |
| DATA-01/Reste-1 | README-Docker : réinitialisation du code d'accès avec `data/cellar.db` en dur | Non fait | `README-Docker.md:236,248` : `require("better-sqlite3")("data/cellar.db")`, alors que `:291-292` documente `DATABASE_PATH` |
| DATA-01/Reste-2 | Rien ne dit qu'un `DATABASE_PATH` en lien symbolique ou un fichier monté seul casse la restauration | Non fait | aucune mention dans `README*.md` ni `UPGRADING.md` ; `renameSync` inchangé (`index.ts:68`) |
| DATA-01/Reste-3 | WAL déconseillé sur un partage réseau (NFS, SMB), non documenté | Non fait | `grep -n "NFS\|SMB" README*.md` vide ; `README-Docker.md:424-426` ne parle du WAL que pour les copies |

### DATA-02

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DATA-02 | Une migration cassée empêche le démarrage avec un message clair | Corrigé | essai réel avec `0009_broken` : code 1, message qui cite l'instruction et la raison de SQLite, rien d'appliqué ; test « quotes the failing statement and its reason, and applies none of the migrations » (`connection.test.ts:25`). Le nom du fichier manque au message : voir m5 |
| DATA-02/Trouvé-1a | Migrations et seeding à la première requête dépassent le délai du healthcheck | Corrigé | tout tourne dans `init`, avant l'écoute ; prêt en 0,47 s sur base neuve ; `--start-period=5s` (`Dockerfile:70`) |
| DATA-02/Trouvé-1b | Garder `exitUnlessDirsWritable()` avant l'ouverture de la base | Corrigé | `src/lib/db/index.ts:19` |
| DATA-02/Trouvé-1c | Migration en échec seulement journalisée, conteneur en apparence sain | Corrigé | `hooks.server.ts:43-52` |
| DATA-02/Reste-1 | `vite dev` s'arrête au premier appel quand une migration est cassée | Non fait | `hooks.server.ts:51` : `process.exit(1)` sans cas pour le dev ; peut-être voulu, aucune décision ne le dit |

### DATA-03

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DATA-03 | La migration passe sur une copie de la base de production | Corrigé | copie de production interdite à l'audit ; base neuve migrée de 0000 à 0008 sans erreur ; tests `migrations.test.ts:439-712` « migration adding the constraints and indexes » sur des données sales (régions en double, codes partagés, statuts inconnus, notes hors bornes, parents orphelins) |
| DATA-03/Reste-1 | Le garde des FK lance un `foreign_key_check` complet à chaque démarrage | Non fait | `connection.ts:55` appelle `refuseBrokenForeignKeys` avant chaque `migrate`, et `:88-90,104-107` lance `pragma_foreign_key_check` même sans migration en attente ; coût négligeable à ce volume |

### DATA-04

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DATA-04 | Une insertion qui échoue au milieu laisse la base inchangée, pour chaque opération | Corrigé | `failWrites` (`src/test/failing-write.ts`) ; tests « changes nothing, images included, when a row cannot be inserted » (import JSON), « changes nothing when the default data cannot be inserted again » (wipe), « creates no bottle when one bottle cannot be inserted », « changes nothing when a new case cannot be inserted », « keeps the cases when the container cannot be deleted », « imports nothing from any of the files when a row cannot be inserted » (CSV) ; `restore-label-presets` supprimé (décision « Endpoints et CSRF (API-06) ») |

### DATA-06

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DATA-06 | 2 créations simultanées de 6 bouteilles → 12 codes distincts | Corrigé | test « gives distinct barcodes to two creations sent at the same time » (`src/routes/api/bottles/server.test.ts:141`, `PAR00000001` à `PAR00000012`) |
| DATA-06/Trouvé-1 | Préfixe vide : tous les codes numériques comptent, codes manuels compris | Partiel | ne comptent plus que les codes de 10 chiffres, ou de 13 dont le numéro tient dans le format (`barcode/repository.ts:91-110`) ; un code manuel à 10 chiffres déplace toujours la séquence (`9999999999` → 409). La décision « Anciens codes-barres » ne couvre que les codes à 13 chiffres ; ce reste n'est accepté que par l'entrée « Fait » de DATA-06. Il ne peut guère être corrigé : `getNextBarcodeNumber` lit les codes présents exprès, et un tel code a la forme d'un code généré |
| DATA-06/Trouvé-2 | Anciens codes à 13 caractères : la numérotation repart à 1 | Corrigé | `barcode/repository.ts:95-106` ; tests « continues after the highest old code » (`bottles/service.test.ts:319`) et suivants (`:341`, `:357`, `:364`) |
| DATA-06/Trouvé-2-limites | `CV2025…` lu avec le préfixe `CV` → 409 ; EAN-13 manuel qui saute des numéros | Écart décidé | décision « Anciens codes-barres (BUG-01, DATA-06) », et « Ces deux limites sont acceptées (décision du 2026-10-11) » dans l'entrée DATA-06 |

### DATA-07

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DATA-07 | Plus de CSV en double dans git, `scripts/` réduit à l'utile, seeding correct sur base vide | Corrigé | 6 CSV sous `scripts/data/`, sans doublon ; `scripts/` : 5 `.mjs` utilisés par la CI ou la release ; base vide : « appellations.csv: 449 appellations added … ✅ Default data seeded » |
| DATA-07/Trouvé-1 | `.claude/settings.local.json` et `test-labels.pdf` suivis par git | Corrigé | `git ls-files .claude '*.pdf'` vide |
| DATA-07/Trouvé-2 | Ne pas combiner `latin1` et `trim: true` (csv-parse 7) | Corrigé | `migrations.ts:92-97` sans option `trim`, trim à la main (`:105-107`) |
| DATA-07/Trouvé-3 | `pnpm build` embarque `static/uploads` dans `build/` | Corrigé | `vite.config.ts:28-37` retire `uploads/` ; après le build : pas de `build/client/uploads` |
| DATA-07/Trouvé-4a | `docker-setup.sh` : CSV à déposer dans `csv-imports`, `docker-compose` | Corrigé | `docker-setup.sh:25-35` : `docker compose`, `csv-imports` décrit comme recevant les listes par défaut |
| DATA-07/Trouvé-4b | Commentaire du compose « CSV files for initial import » faux | Corrigé | `docker-compose.yml:28` « Default reference lists (wine types, appellations...), editable » |
| DATA-07/Trouvé-4c | « no trailing slash » inutile | Corrigé | absent de `docker-compose.yml` et `.env.example` |
| DATA-07/Trouvé-4d | `container_name: wine-cellar` fixe | Sans objet | gardé exprès (entrée DATA-07, « Gardé : … même port 3005 ») ; `docker-compose.yml:7` |
| DATA-07/Trouvé-4e | `.claude/settings.local.json` dans chaque archive source | Corrigé | plus suivi par git, donc absent de `git archive` |
| DATA-07/Trouvé-5a | Un `appellations.csv` sans en-tête perd sa première ligne | Corrigé | `isAppellationsHeader` (`migrations.ts:81-88,101`) ; test « imports the first line of an appellations.csv without a header line » (`migrations.test.ts:79`) |
| DATA-07/Reste-1 | 0004 laisse une chaîne Pays/Région/Appellation entamée à la main | Non fait | `drizzle/0004_remove_csv_header_appellation.sql` inchangée depuis 08166d6d (accepté dans l'entrée : « effet minime ») |
| DATA-07/Reste-2 | `appellations.csv` lu en latin1 : une copie UTF-8 donne « CÃ´tes » | Non fait | `migrations.ts:94` `readCsvRecords(filename, 'latin1', …)` ; le BOM n'est toléré que pour reconnaître l'en-tête (`:83`) |
| DATA-07/Reste-3 | Le wrapper d'adapter-node de `vite.config.ts` dépend d'adapter-node 6, sans test | Non fait | aucun test ne lit `vite.config.ts` ni ne vérifie l'absence de `build/client/uploads` |

### BUG-11

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-11 | Base neuve sans « Pays/Région/Appellation » ; base existante nettoyée si la chaîne est inutilisée | Corrigé | base neuve : aucune ligne `Pays`, `Région`, `Appellation%` ; tests `migrations.test.ts:71` et `:230-353` (0004 : supprimée si inutilisée, gardée sinon, idempotente) |

## 3. Nouveaux constats (passe 2)

Vérifié sans constat :
- `schema.ts` et les migrations décrivent la même base : une base créée par le migrateur (0000 à 0008) et une base créée par `drizzle-kit push` ont les mêmes index, uniques, index partiel, FK, `ON DELETE` et `CHECK` (`PRAGMA table_xinfo`, `index_list`, `foreign_key_list`). Seul l'ordre des colonnes ajoutées par `ALTER TABLE` diffère (`label_presets`, `storage_cases`).
- `drizzle-kit generate` répond « No schema changes, nothing to migrate » ; les `when` du journal sont croissants.
- Aucune fonction exportée des repositories sans appelant de production. Les écritures multiples encore hors transaction ne font qu'une requête (décision « Services par domaine »), ou écrivent un fichier et une ligne (images, voir axe 3).

### Critique

Aucun.

### Majeur

**M1. Millésime 0 : la moitié de l'interface le lit comme « sans millésime », l'autre comme l'an 0 (décision du mainteneur)**
- Où :
  - Validation : `src/lib/shared/schemas/bottle.ts:11-16` accepte 0 ; le commentaire `:7-8` justifie la borne lâche par les bouteilles importées.
  - Origine des 0 : `drizzle/0002` a rendu `vintage` nullable sans convertir les 0 ; `drizzle/0006_constraints_and_indexes.sql:46` convertit la note 0 en NULL, pas le millésime 0.
  - Lecture : voir le tableau du scénario.
- Origine : jusqu'à la 0.6.0 incluse, l'import CSV écrivait 0 pour un millésime vide. `git grep -n 'set to 0 as default' v0.1.0 -- src` et la même commande sur `v0.6.0` trouvent `src/routes/api/admin/import-csv/+server.ts` (lignes 353 et 416) ; sur `v0.7.0` la recherche est vide (`git log -S` : retrait dans 6ff01d09, 2026-10-13). L'export CSV de la 0.6.0 écrivait le millésime tel quel : un aller-retour export puis import changeait aussi des NULL en 0. Toute installation qui a importé un CSV avec des millésimes vides avant la 0.7.0 a donc des 0. Le banc de fin de P6 en compte 81 dans la plus ancienne sauvegarde de l'installation de test, et pose la question pour cet audit (`ROADMAP.md:1177`).
- Scénario : une base qui contient des bouteilles au millésime 0, mise à jour en 0.7.0.

  | Endroit | Code | Ce que l'utilisateur voit |
  |---|---|---|
  | Filtre « Sans millésime » des vins | `src/lib/utils/wine-filters.ts:46` (`!bottle.vintage`) | trouvées : 0 = sans millésime |
  | Filtre par plage | `wine-filters.ts:50` (`!!vintage`) | exclues d'une plage « 0 à 2020 » |
  | Page du vin | `src/routes/wines/[id]/+page.svelte:474,678` (`vintage \|\| N/A`) | « N/A » |
  | Hors cave, résultats de recherche | `src/routes/out-of-cellar/+page.svelte:247,255`, `src/lib/components/WineListView.svelte:559` | rien |
  | Carte de vin | `src/lib/utils/wine-group-sort.ts:31` (`!= null`) | « Millésime : 0-2018 » |
  | Tri « millésime le plus ancien » | `wine-group-sort.ts:56` | ces vins en tête |
  | Historique, tableau des bouteilles | `src/lib/components/bottles/BottleTable.svelte:142,153` (`??`) | « Prod alpha 0 », colonne « 0 » |
  | Statistiques | `src/lib/server/features/bottles/repository.ts:346,358` (`isNotNull` seulement) | décennie « 0s » / « Années 0 », millésime 0 dans `winesByVintage` |
  | Export CSV des codes-barres | `src/lib/server/features/barcode/service.ts:196` | « 0 » (la 0.1.0 écrivait vide) |
  | Admin : libellés, filtre des bouteilles | `src/lib/components/admin/wine-labels.ts:8`, `src/routes/admin/data/bottles/+page.svelte:40` | « Château X 0 », option « 0 » |

  Attendu : une seule lecture de 0 partout.
- Correction proposée : décision du mainteneur d'abord, sur ce que veut dire 0. Proposition : 0 veut dire « sans millésime ».
  - Migration `0009` : `UPDATE wine_bottles SET vintage = NULL WHERE vintage = 0`, comme 0006 l'a fait pour la note 0. Sans action de mise à jour : une phrase dans les notes de version suffit. Tous les endroits du tableau traitent déjà NULL comme « sans millésime ».
  - Puis, au choix du mainteneur, empêcher un nouveau 0 : relever la borne basse à 1, ou transformer 0 en `null` à la validation. Cela rouvre la décision « Formulaires de vin et de bouteille (UI-06) », qui fixe « millésime 0-9999 ». Une fois la migration passée, la crainte de `bottle.ts:7-8` (une bouteille importée bloquée par la borne) ne s'applique plus au 0. Garder 0 accepté laisserait l'import CSV et l'API en créer de nouveaux.
  - Si le mainteneur décide au contraire que 0 est une vraie année, il faut corriger le filtre « Sans millésime », le filtre par plage, la page du vin, le hors cave et la recherche.
- Preuve :
  - Sonde Vitest du vérificateur, deux bouteilles à 0 et une à 2015 : `decades [{"decade":0,"count":2},{"decade":2010,"count":1}]`, `range {"oldest":0,"newest":2015}`, `no_vintage true`, `range 0..2020 on 0s false`. Sonde de l'auditeur : `schema accepts 0: true`, `label: "X 0"`, `csv export vintages: [ 0, 0, 2015 ]`.
  - Rejoué dans l'app par l'axe 5 (vérificateur de a5b-front) : une bouteille au millésime 0 donne « Millésime : 0-2018 » sur la carte de `/wines`.
  - Rejoué dans l'app par l'axe 6 (a6b-pages, ligne UI-04/Trouvé-3) : « Prod alpha 0 » dans `/cellar-history`, `winesByDecade:[{decade:0,count:2}]` sur `/statistics`.
  - Emplacements relus par le rédacteur sur `9df0d08c`.
- Vérification : Confirmé, corrigé. Le vérificateur a élargi l'origine (import CSV jusqu'à la 0.6.0, pas seulement les bases d'avant décembre 2025) et retiré de la correction `optimum = 0`, sans source : l'ancien import ne mettait 0 que dans `vintage`. Sévérité : Majeur, comme l'auditeur et son vérificateur. Le vérificateur de l'axe 5 proposait Mineur en ne regardant que le filtre ; le défaut complet est un affichage faux dans des écrans courants (cartes, tri, statistiques, export) pour toute installation qui a importé un CSV avant la 0.7.0, donc un chemin de mise à jour.

### Mineur

**m1. Rien n'empêche deux cases du même nom, que l'export CSV des bouteilles confond**
- Où : `src/lib/db/schema.ts:142-173` (ni `storage_containers.name` ni `(container_id, name)` uniques) ; `src/lib/shared/schemas/storage.ts:5,18` (suffixes non dédoublonnés) ; export `src/lib/server/features/backup/repository.ts:179` (seulement `storageCaseName`) ; import `src/lib/server/features/csv-import/tables.ts:66` et `referenceIndex.ts:49-50` (« the first of rows of the same name »)
- Scénario : deux conteneurs « A », ou deux suffixes « 1 » dans le même conteneur. La page stockage montre deux « A1 ». Après un export CSV puis un import, toutes les bouteilles des deux « A1 » vont dans la première, dont la capacité peut faire refuser des lignes. Attendu : un nom de case unique, au moins dans son conteneur, et un export qui désigne la case sans ambiguïté.
- Correction proposée : refuser (409) un nom de conteneur déjà pris et des suffixes en double dans `containerSchema` et `newContainerSchema` ; ajouter `containerName` aux lignes de bouteilles du CSV. Un index unique `(container_id, name)` demande une migration qui répare les doublons existants : la règle de réparation (renommer, fusionner) est à choisir par le mainteneur, comme pour 0006.
- Preuve : sonde `createContainer({ name: 'A', cases: ['1','1'] })` puis `createContainer({ name: 'A', cases: ['1'] })` : les deux réussissent, trois cases `A1` (`[ 'A1', 'A1', 'A1' ]`).
- Vérification : Confirmé. Défauts voisins traités ailleurs : noms de cases rendus ambigus par la concaténation conteneur + suffixe (axe 6, m19) et cases rapprochées par leur nom seul à l'import CSV (axe 3, API-04/Reste-1). Ajouter `containerName` à l'export sert aussi ces deux cas.

**m2. Le seeding insère des noms vides venus d'un CSV édité, que l'API refuserait**
- Où : `src/lib/db/migrations.ts:70-74` (`importLookupCsv`) et `:104-149` (`importAppellationsCsv`) ; `skip_empty_lines` (`:50`) ne saute pas une ligne faite d'espaces
- Scénario : l'utilisateur édite `docker-data/csv-imports/wine_types.csv` (documenté dans README-Docker) et laisse une ligne d'espaces. Au premier démarrage ou après « Effacer toutes les données », un type sans nom apparaît dans les listes ; l'API ne l'aurait jamais créé (`name` exige un caractère, `shared/schemas/common.ts:7`). Attendu : la ligne est sautée et signalée, comme à l'import CSV (décision « Lignes incomplètes de l'import CSV (DATA-04) »).
- Correction proposée : dans les deux importeurs, sauter avec un `console.warn` toute ligne dont un nom trimé est vide.
- Preuve : sonde avec `wine_types.csv` = `name\nStill\n  \nSparkling` et `appellations.csv` contenant `France;;` et `France;Loire;  ` : `types: [{"t":""},{"t":"Sparkling"},{"t":"Still"}]`, `regions: [{"n":""},{"n":"Loire"}]`, `appellations: [{"n":""},{"n":""}]`. Les fichiers livrés n'ont aucune valeur vide (`awk`).
- Vérification : Confirmé.

**m3. `scripts/check-origin.mjs` peut ouvrir et migrer la base du développeur**
- Où : `scripts/check-origin.mjs:5` (« never opens the developer's data/cellar.db ») et `:36` (`env: { ...process.env, ORIGIN, PORT, HOST }`)
- Scénario : seul le dossier de travail est temporaire ; `DATA_DIR`, `DATABASE_PATH`, `UPLOADS_DIR` et `CSV_IMPORTS_DIR` sont hérités, et `README.md:32` et `README-Docker.md:289-292` invitent à les définir. Un développeur qui a exporté `DATABASE_PATH` vers sa vraie base hors Docker lance `node scripts/check-origin.mjs` : le serveur ouvre ce fichier, le passe en WAL, le migre, le seede et y écrit `app_version`. Une installation plus ancienne refuse ensuite de démarrer sur cette base (décision « Contrôle de mise à niveau (REL-02) »). Attendu : la vérification n'ouvre que son dossier temporaire, comme le promet son commentaire.
- Correction proposée : passer explicitement les quatre variables vers des sous-dossiers de `cwd` dans l'`env` du `spawn`.
- Preuve : rejoué par le vérificateur sur une base inventée `real.db` (une seule table `mine`) : `DATABASE_PATH=…/real.db node scripts/check-origin.mjs 4730` → 5 « ok », code 0 ; la base passe de 8 Ko à 258 Ko, `journal_mode = wal`, toutes les tables de Cellar, `__drizzle_migrations`, `app_settings.app_version = '0.7.0'`, à côté de `mine`.
- Vérification : Confirmé. Mineur maintenu : il faut que le développeur ait exporté `DATABASE_PATH`.

**m4. Aucune garde de la CI contre un `schema.ts` qui diverge de `drizzle/`**
- Où : `.github/workflows/ci.yml:36-61` (check, lint, test, i18n, knip, build, check-origin ; pas de `db:generate`)
- Scénario : un index, un `CHECK` ou un `ON DELETE` ajouté dans `schema.ts` sans `pnpm db:generate` passe toute la CI, puisque les tests migrent depuis `drizzle/` (`src/test/setup.ts:26-30`). La version publiée n'a la contrainte dans aucune base. `release.mjs` ne vérifie que CHANGELOG et UPGRADING.
- Correction proposée : une étape de CI `pnpm db:generate && git diff --exit-code drizzle/` (`generate` n'ouvre aucune base, `drizzle.config.ts:9`).
- Preuve : aujourd'hui `db:generate` répond « No schema changes » ; rien dans `ci.yml` ne le lance.
- Vérification : Confirmé.

**m5. Le message d'une migration en échec ne nomme pas la migration**
- Où : `src/lib/db/connection.ts:57-65`
- Scénario : une migration échoue au démarrage. Les logs donnent « ❌ Cellar cannot start: the database could not be prepared. Error: Database migration failed, nothing was applied: … duplicate column name: vintage » : l'instruction SQL et la raison de SQLite, pas le fichier `0009_broken`. L'entrée « Fait » de DATA-02 (`ROADMAP.md:802`) annonce pourtant un arrêt « en nommant la migration ». Pour le support, il faut retrouver la migration à partir de l'instruction. Attendu : le nom du fichier dans le message, ou une entrée « Fait » exacte.
- Correction proposée : la plus simple est de corriger la phrase de `tasks.mjs` (« en citant l'instruction et la raison de SQLite »). Pour nommer la migration : Drizzle ne dit pas laquelle a échoué, mais toutes sont annulées ensemble ; le message peut lister les migrations en attente (entrées du journal `drizzle/meta/_journal.json` plus récentes que la dernière ligne de `__drizzle_migrations`).
- Preuve : le message n'est fait que de `error.message` et de ses causes (`connection.ts:59-64`). Rejoué par le vérificateur : `0009_broken` ajoutée à une copie de `drizzle/`, `node server.js` sort en code 1 avec ce message, sans le nom du fichier, et `__drizzle_migrations` reste vide.
- Vérification : Confirmé (signalé par a1-data hors périmètre, vérifié par le rédacteur ; rejoué par v-a1-data).

**m6. Les copies de migrations faites par les tests ne sont jamais supprimées**
- Où : `src/test/database.ts:30` (`mkdtempSync(path.join(tmpdir(), 'cellar-migrations-'))`, sans `rmSync` ni `afterAll`), appelé par `migrationsBefore` et `migrationsWith`
- Scénario : chaque `pnpm test` laisse des copies de `drizzle/` dans le dossier temporaire du système ; elles s'accumulent sur les postes de dev et les runners. `setup.ts:20-22` nettoie pourtant son propre dossier.
- Correction proposée : créer ces copies dans le dossier temporaire du fichier de test (`path.dirname(process.env.DATA_DIR!)`), que `setup.ts` supprime déjà.
- Preuve : `ls -d $TMPDIR/cellar-migrations-* | wc -l` → 2025 dossiers, 314,8 Mo (`du -sk`) sur la machine de l'audit.
- Vérification : Confirmé, corrigé : 13 sites d'appel, dont 5 dans des `beforeEach`/`beforeAll` de `migrations.test.ts` et un helper appelé plusieurs fois (`upgrade.test.ts:47`), et non « 20 appels » ; le nombre de dossiers par exécution varie.

**m7. Requêtes de régions et d'appellations, et `timestamps()`, recopiées entre domaines**
- Où : `src/lib/server/features/backup/repository.ts:77-104` (régions et appellations de l'export CSV) reprend `regionsWithCountry` et `appellationsWithRegion` (`geography/repository.ts:6-36`), avec `leftJoin` au lieu d'`innerJoin` ; deux `timestamps()`, `src/lib/db/migrations.ts:53-56` et `catalog/repository.ts:18-21` (qui fournit aussi l'`id`)
- Scénario : une colonne ajoutée à la liste des régions (admin, API) doit l'être aussi à la main dans l'export CSV.
- Correction proposée : construire l'export avec `regionsWithCountry(db)` et `appellationsWithRegion(db)` ; un seul helper d'horodatage dans `src/lib/db/`. Le CSV ne change pas : `LEFT_OUT_COLUMNS` (`backup/service.ts:146-150`) retire de toute façon `countryId` et `regionId`.
- Preuve : mêmes colonnes sélectionnées (`id, name, countryId, countryName, createdAt, updatedAt` pour les régions).
- Vérification : Confirmé, corrigé : la liste des `const now = new Date()` est retirée (voir section 5).

**m8. Replis morts pour des références `NOT NULL`**
- Où : `src/lib/server/features/bottles/repository.ts:67` (`formatName ?? 'Unknown'`), `:91`, `:97-98`, `:188` (`'Standard'`) ; `catalog/repository.ts:52-53` ; `catalog/service.ts:68-70` (`'Unknown Region'`)
- Scénario : rien de visible aujourd'hui. `format_id`, `type_id`, `color_id` et `appellation_id` sont `NOT NULL` avec FK appliquées (`schema.ts:73-82,186-188`), et 0006 refuse toute migration qui casserait un lien. Un lecteur croit que des bouteilles sans format existent, et le même format manquant s'appellerait « Unknown » dans une liste et « Standard » dans l'autre.
- Correction proposée : `innerJoin` et suppression des replis, ou un seul repli traduit si le cas doit rester. À faire après m2.
- Preuve : `formatName` n'est appelé qu'après l'insertion, sous une FK : `?? 'Unknown'` ne sert jamais.
- Vérification : Confirmé, corrigé : les replis `||` (`wine_types?.type || 'Unknown'`, `wine_formats?.name || 'Standard'`, `|| 'Unknown Region'`) attrapent aussi un nom vide, que le seeding peut créer (m2) ; ils ne sont morts qu'une fois m2 corrigé.

## 4. Points restés ouverts de la passe 1

- Documentation d'exploitation (README-Docker) :
  - DATA-01/Reste-1 : la réinitialisation du code d'accès ouvre `data/cellar.db` en dur (`README-Docker.md:236,248`) au lieu de `DATABASE_PATH` ;
  - DATA-01/Reste-2 : dire qu'un `DATABASE_PATH` en lien symbolique ou un fichier monté seul casse la restauration (`renameSync`) ;
  - DATA-01/Reste-3 : déconseiller le WAL sur un partage réseau (NFS, SMB).
- Démarrage et migrations, avec m5 :
  - DATA-02/Reste-1 : `vite dev` s'arrête au premier appel quand une migration est cassée ; à garder (et le dire) ou à adoucir en dev, décision du mainteneur ;
  - DATA-03/Reste-1 : `foreign_key_check` complet à chaque démarrage, même sans migration en attente ; ne le lancer que s'il y a une migration à appliquer.
- Seeding et listes par défaut, avec m2 et m8 :
  - DATA-07/Reste-2 : `appellations.csv` lu en latin1, une copie UTF-8 donne « CÃ´tes » ;
  - DATA-07/Reste-1 : 0004 laisse une chaîne Pays/Région/Appellation entamée à la main (accepté dans l'entrée DATA-07 ; à inscrire dans les décisions ou à fermer).
- Build : DATA-07/Reste-3, un test qui vérifie que `build/client/uploads` n'existe pas, pour attraper un changement d'adapter-node.
- Nettoyage du code de données, avec m7 :
  - R1-m4a (Partiel) : retirer les champs à plat de `getDefinitionWithLocation` ; ils ne restent que dans le JSON de `GET /api/definitions/{id}`, donc à traiter avec la liste des endpoints de l'axe 2 ;
  - R1-m8b (Partiel) : renommer `src/lib/db/migrations.ts` (seeding seulement) en `seed.ts`, et séparer ses tests de ceux des migrations SQL.
- Séquence des codes-barres : DATA-06/Trouvé-1 (Partiel), un code manuel à 10 chiffres sous un préfixe vide déplace la séquence. Pas de correction simple ; proposer au mainteneur d'inscrire cette limite dans la décision « Anciens codes-barres ».

## 5. Constats écartés

Aucun constat de l'auditeur n'a été réfuté en entier. Parties retirées par le vérificateur :
- m7 (N8 de l'auditeur) : la liste des `const now = new Date()` en ligne (`bottles`, `storage`, `images`, `labels`, `settings`, `lookup-crud`). Sur les 14 lignes, plusieurs calculent des expirations ou des noms de fichier (`session.ts:96`, `access-code.ts:155`, `backup/service.ts:199`) : une ligne idiomatique, pas une copie à factoriser.
- M1 (N1 de l'auditeur) : la migration de `optimum = 0` en NULL. Aucune source : l'ancien import CSV ne mettait 0 que dans `vintage`.
- N2 de l'auditeur (renvoyé à l'axe 6) : le scénario « codes manuels qui commencent par le préfixe ». Ces codes sont conformes au commentaire de la fonction (`barcode/service.ts:209`) ; seule la casse est un défaut.

## 6. Renvois

- Statistiques et export « codes du préfixe » comparés avec `LIKE`, insensible à la casse (N2 de l'auditeur, `barcode/repository.ts:115-124,162-164`) : voir axe 6, m1.
- Statistiques par région groupées par nom seul ; deux régions homonymes de pays différents fusionnent (`bottles/repository.ts:334`) : voir axe 6, m15.
- Prix d'achat et valeur négatifs acceptés (`src/lib/shared/schemas/bottle.ts:18-21`) et comptés dans les sommes des statistiques : voir axe 5, m4.
- Dossiers temporaires laissés par un arrêt brutal ; `.gitignore:18-24` n'ignore pas `data/temp-extract-*/` ni `data/temp-zip-import-*/` : voir axe 3, DATA-05/Reste-1.
- `renameImage` renomme le fichier avant la ligne ; un échec laisse le fichier renommé sans ligne (`src/lib/server/features/images/service.ts:89-91`) : voir axe 3, R3-m12.
- Millésime 0 vu par d'autres axes (axe 6, ligne UI-04/Trouvé-3 ; axe 5, filtre « sans millésime ») : traité ici, M1. Le cadre vide de « Millésimes récents » quand seuls des millésimes anciens ou 0 existent reste à l'axe 6, m8.
