# Revue de la couche données et des scripts (cellar)

## 1. Résumé

Le schéma Drizzle est sain : les FK sont déclarées partout, les tables de référence sont normalisées, et le journal `drizzle/` correspond exactement à `schema.ts` et à la base locale (3 entrées dans `__drizzle_migrations`, DDL réel de `wine_bottles` identique à `0002`). Le problème est autour du schéma : environ 25 connexions SQLite ouvertes indépendamment, aucune transaction dans tout le dépôt, un `services.ts` que la majorité des routes contourne, un seeding écrit en trois exemplaires, et un dossier `scripts/` surtout composé de code mort ou dangereux qui écrit dans la vraie base. Pas besoin de tout réécrire : il faut une connexion unique, des transactions, les contraintes manquantes et un découpage par domaine.

`tsc --strict` passe sans erreur sur `src/lib/db/` ; il remonte environ 45 erreurs dans `scripts/`.

## 2. Ce qui va bien

- **Un seul système de migration de schéma, cohérent.** `drizzle.config.ts`, les 3 migrations SQL, les snapshots et `schema.ts` sont alignés. `migrations.ts` ne fait que du seeding et du backfill, malgré son nom.
- **Intégrité référentielle.** Toutes les relations ont une FK, et better-sqlite3 les applique par défaut (`PRAGMA foreign_keys` = 1, vérifié).
- **Tables de référence normalisées** (types, couleurs, formats, classifications, origines) avec `UNIQUE` sur le libellé.
- **Typage dérivé du schéma** via `$inferSelect` / `$inferInsert`, pas de types écrits à la main qui divergent.
- **Pas de SQL brut dangereux.** Tout passe par l'ORM ; les `sql` template n'interpolent que des colonnes, donc pas d'injection.
- **Lectures composites en une seule requête** : `getWineBottlesWithDefinitions` fait 8 jointures, sans N+1.
- **Seeding idempotent** (vérification avant insertion) ; les CSV modifiés par l'utilisateur dans le volume sont préservés (`migrations.ts:38`).
- Un code-barre vide est stocké comme `NULL` (`services.ts:601`), ce qui rend un index unique partiel trivial à ajouter.

## 3. Problèmes

### Critique

**C1. Connexions multiples, et restauration qui écrase le fichier sous des connexions ouvertes**
- `src/lib/db/index.ts:10-17` ouvre une connexion. 20 modules de route en ouvrent chacun une autre au chargement (ex. `src/routes/api/admin/wine-colors/+server.ts:9`), et `hooks.server.ts:156,230,322,347` en ouvre encore. Le chemin `data/cellar.db` est codé en dur environ 30 fois, sans variable d'environnement.
- `src/routes/api/admin/restore/+server.ts:232` fait un `copyFile` asynchrone par-dessus `cellar.db` pendant que ces connexions sont ouvertes. Si une écriture survient pendant la copie (scan, auto-backup), le fichier peut être corrompu ; écraser une base ouverte est un cas de corruption documenté par SQLite.
- Après restauration, les migrations ne sont pas rejouées : `migrationRun` reste à `true` (`hooks.server.ts:336`). Une sauvegarde d'avant décembre 2025 contient `wine_bottles.vintage NOT NULL` : jusqu'au redémarrage, créer une bouteille sans millésime échoue.
- **Correction :** un module unique `$lib/server/db` exposant `getDb()`, `closeDb()`, `reopenDb()`, chemin lu depuis `DATABASE_PATH`, PRAGMA posés à l'ouverture. Restauration : fermer, remplacer le fichier par renommage atomique, rouvrir, appeler `migrate()`. Alternative : `sqlite.backup()` / `VACUUM INTO`.

### Majeur

**M1. Aucune transaction dans le dépôt** (grep de `transaction(` : zéro résultat)
- Scénario confirmé : `src/routes/api/storage-containers/[id]/+server.ts:79-85` supprime les casiers un par un. Si le troisième contient des bouteilles, la FK échoue : les deux premiers sont déjà supprimés et le conteneur reste, à moitié vidé.
- Même schéma dans `createMultipleWineBottles` (`services.ts:639-663`) : N inserts séparés, insertion partielle en cas d'erreur. Idem pour le seeding, le wipe et les imports.
- **Correction :** `db.transaction(tx => ...)` (synchrone avec better-sqlite3) ; les fonctions d'accès prennent un `tx` optionnel.

**M2. Codes-barres : condition de course et pas de contrainte d'unicité**
- `schema.ts:130` : `barcode` sans `UNIQUE`.
- `getNextBarcodeNumber` (`services.ts:915-937`) lit tous les codes `LIKE prefix%`, calcule le maximum en JS ; les inserts suivent après plusieurs `await`.
- Scénario : double clic sur « ajouter 6 bouteilles » → deux requêtes qui s'entrelacent → mêmes `WINE000xx` attribués deux fois. Le scan suivant (`getBottleByBarcode`, `LIMIT 1`) agit alors sur la mauvaise bouteille.
- L'unicité n'est vérifiée qu'en applicatif (`isBarcodeUnique`). La base actuelle ne contient aucun doublon (vérifié) : la contrainte peut être ajoutée tout de suite.
- **Correction :** `CREATE UNIQUE INDEX ... ON wine_bottles(barcode) WHERE barcode IS NOT NULL` ; calculer et réserver la séquence dans la même transaction, idéalement via un compteur dans `app_settings`.

**M3. `services.ts` n'est pas la couche d'accès aux données, c'en est une parmi d'autres**
- 38 fichiers de route font du `db.select/insert/update/delete` directement (27 appels dans `import-json`, 14 dans `wipe-database`, 14 dans `import-csv`).
- Le CRUD des presets d'étiquettes (`services.ts:939-984`) n'est utilisé nulle part : les routes `label-presets` le réimplémentent.
- **Correction :** voir section 4 ; les routes ne doivent plus importer `db`.

**M4. Seeding et import en trois exemplaires**
- `migrations.ts:231-635` : 7 fonctions d'import quasi identiques.
- `scripts/import-wine-data.ts` et `scripts/import-appellations.ts` reprennent la même logique.
- `seedInitialData` et `forceSeedInitialData` (`migrations.ts:131-229`) sont deux copies de ~45 lignes.
- `wine_formats.csv` et `wine_bottle_formats.csv` ont un contenu identique et alimentent la même table (`migrations.ts:596-635`).
- **Correction :** une fonction générique `importLookupCsv(table, column, file)`, plus un importeur dédié pour les appellations et un pour les presets.

**M5. Scripts qui écrivent dans la base réelle**
- `pnpm db:seed` (`scripts/db-setup.ts:19-24`) supprime toutes les bouteilles et définitions de `./data/cellar.db`, la base que l'app utilise en dev. La copie locale contient 705 bouteilles.
- Les `scripts/test-*.ts` ne sont pas des tests : aucune assertion, aucun test runner dans `package.json`. Ils insèrent des vins fictifs dans la vraie base sans nettoyer (`test-db.ts:14,30`, `test-new-quantity-system.ts`, `test-optional-fields.ts`), et ne compilent plus (champs supprimés `vintage`, `quantity`, `location`).
- **Correction :** supprimer ces scripts ; pour de vrais tests, Vitest sur une base `:memory:` migrée.

**M6. Démarrage fragile**
- Les migrations tournent au premier hit HTTP (`hooks.server.ts:336-356`), pas au boot. En cas d'échec, l'erreur est avalée et l'app sert des requêtes sur un schéma incohérent.
- `index.ts:22-27` met en cache une promesse rejetée : aucune nouvelle tentative, l'erreur est seulement journalisée à chaque requête.
- **Correction :** migrer au boot (hook `init` de `hooks.server.ts` ou script d'entrée Docker) et arrêter le processus en cas d'échec.

### Mineur

- **`getFilteredWineBottles(filters, sort)` ignore ses deux paramètres** (`services.ts:752-785`) : copier-coller de `getWineBottlesWithDefinitions` avec un tri en plus. Aucun appelant ne passe de filtres aujourd'hui, mais l'API annonce un comportement inexistant. À supprimer ou implémenter.
- **Bug de `trim`** dans `createCountry`, `createWineType`, `createWineColor`, `createWineClassification`, `createWineFormat`, `createOrigin` (`services.ts:31-45`, `133-148`, etc.) : recherche sur le nom brut, insertion sur le nom trimé. `"France "` passe la recherche, puis l'insertion de `"France"` viole `UNIQUE` → 500.
- **Doublons géographiques possibles** : pas d'unicité composite `(country_id, name)` ni `(region_id, name)` (`schema.ts:19-34`), et `createRegion` / `createAppellation` (`services.ts:61-71`, `111-121`) ne dédupliquent pas.
- **Formes de retour incohérentes** : `getWineDefinitionsWithLocation` renvoie `appellation.region.country` imbriqués (`services.ts:262`), `getWineDefinitionWithLocation` renvoie `appellations/regions/countries` à plat (`services.ts:305`). Les retours `as any` (`services.ts:398, 489, 613, 672, 705`) mentent sur le type (ajout de `type`, `color`, `format`).
- **Logique dupliquée** : la résolution « ID ou nom » de type/couleur/classification est copiée entre create et update (`services.ts:322-359` et `407-447`). `typeId!` (`services.ts:377`) laisse partir `undefined` vers la base, qui répond par une erreur `NOT NULL` au lieu d'une erreur de validation.
- **Settings code-barres lus trop souvent** : `getBarcodeSettings` fait 3 requêtes et est appelé deux fois par création (`services.ts:570` puis `:916`).
- **Schéma**
  - `availability` est un `text` libre (`schema.ts:137`), sans `$type` ni `CHECK`.
  - L'enum `BottleAvailability` existe dans `schema.ts:4` et `types.ts:133` ; celui de `schema.ts` n'est pas utilisé.
  - `parentContainerId` n'a pas de FK (`schema.ts:107`).
  - `rating` sans `CHECK 1-5` (`schema.ts:54`).
  - Aucun index sur les colonnes FK (`definition_id`, `storage_case_id`, `region_id`...) ; impact faible au volume actuel.
  - Aucune règle `ON DELETE` : `deleteWineDefinition` (`services.ts:495-498`) sur un vin qui a des bouteilles renvoie une 500 générique au lieu d'une erreur métier.
- **Backfill rejoué à chaque boot** : `migrateLabelPresetSpacing` (`migrations.ts:111-129`) s'exécute à chaque démarrage et avale les erreurs ; il aurait dû être un `UPDATE` dans `0001`. `runSchemaMigrations` (`migrations.ts:99-109`) porte un nom trompeur.
- **`PRAGMA foreign_keys=OFF` sans effet** dans `drizzle/0002_fine_nextwave.sql:1` : le migrateur exécute tout dans une transaction, où ce PRAGMA est ignoré. Sans conséquence ici, piégeux le jour où une table parente sera reconstruite.
- **Imports inutilisés** dans `migrations.ts:3-10` : `wineDefinitions`, `wineImages`, `isNotNull`, `nanoid`, `Database`.
- **Code d'accès en clair** : seedé à `'1234'` (`migrations.ts:528-531`), stocké tel quel dans `app_settings`, donc présent dans chaque sauvegarde. À hacher, ou à imposer au premier démarrage.
- **Seeding lent** : jusqu'à ~2 700 requêtes hors transaction pour les 450 lignes d'appellations, chacune avec son fsync. Lent sur un NAS.
- **Fichiers morts**
  - `wine_images_schema.sql` n'est référencé nulle part et décrit des colonnes inexistantes (`mime_type`, `size`...).
  - `scripts/migrate-wine-colors.ts` et `migrate-wine-types.ts` sont des migrations antérieures à Drizzle ; elles échoueraient aujourd'hui (colonne `color` disparue).
  - `scripts/import-wine-data.ts:184-216` appelle les fonctions sans l'argument `db` → plantage.
  - `scripts/db-setup.ts:116-121` insère `vintage` et `optimum` dans `wine_definitions`.
- **Triplication des CSV** : les trois copies sont identiques octet pour octet. Cause : `initializeCsvFiles()` (`migrations.ts:25`) copie `scripts/data/*` vers `process.cwd()/csv-imports`. En dev, cwd = racine du dépôt, donc le dossier « volume » est généré dans le repo puis commité. `appellations.csv` à la racine ne sert qu'au mode autonome de `scripts/import-appellations.ts:79`.

## 4. Refactoring structurel proposé

**Architecture cible :**

```
src/lib/server/db/
  client.ts        connexion unique, PRAGMA, chemin via env, open/close/reopen
  schema/          un fichier par agrégat (geography, catalog, cellar, storage, settings, labels)
  migrate.ts       migrate() Drizzle + seeding de référence, appelé au boot
  seed/            importLookupCsv générique + appellations + presets
src/lib/server/repositories/   accès données par agrégat (fonctions prenant db | tx)
src/lib/server/services/       règles métier (barcode, stock, import/export, restore)
src/lib/types/db.ts            types ré-exportés pour le client (import type)
```

**Étapes, dans l'ordre :**
1. Créer `client.ts` comme unique point d'accès, puis remplacer les ~25 `new Database(...)`. Mécanique.
2. Déplacer le code sous `$lib/server/` pour que SvelteKit interdise son import côté client. Aujourd'hui seuls deux `import type` depuis `$lib/db/schema` existent côté client (`routes/storage`, `routes/barcode`) : il suffit de les rediriger.
3. Migration Drizzle `0003` : index unique partiel sur `barcode`, `UNIQUE(country_id, name)` et `UNIQUE(region_id, name)`, index sur les FK, `CHECK` sur `availability`, backfill des presets en SQL, et `ON DELETE SET NULL` sur `storage_case_id` / `image_id` si c'est le comportement voulu.
4. Découper `services.ts` en repositories : geography, catalog (définitions + tables de référence), bottles, storage, settings, labels. Créer un `barcodeService` portant la séquence transactionnelle.
5. Migrer les routes vers les repositories, en commençant par les 20 routes `admin/*` qui ont leur propre connexion. Interdire `import { db }` dans `src/routes` via ESLint `no-restricted-imports`.
6. Fusionner le seeding : `seedInitialData` + `forceSeedInitialData` → `seed({ force })`, un importeur générique, une transaction par fichier.
7. Nettoyer `scripts/` : garder `db:generate` et éventuellement un `seed-demo.ts` ciblant une base séparée ; supprimer le reste.
8. Ajouter Vitest avec une fixture `:memory:` migrée ; tester d'abord codes-barres, stock et suppressions.

## 5. Quick wins

1. Ajouter l'index unique partiel sur `wine_bottles.barcode` (aucun doublon en base aujourd'hui).
2. Envelopper `createMultipleWineBottles`, la suppression de conteneur et le seeding dans `db.transaction`.
3. Corriger le `trim` des `create*` : trimer avant la recherche.
4. Supprimer `scripts/test-*.ts`, `scripts/migrate-wine-*.ts`, `wine_images_schema.sql`, `appellations.csv` à la racine, `wine_bottle_formats.csv`, et le paramètre fantôme de `getFilteredWineBottles`.
5. Ajouter `csv-imports/` au `.gitignore`, le retirer de l'index git, et lire `CSV_IMPORT_DIR` depuis l'environnement.
6. Remplacer `'data/cellar.db'` par une constante unique alimentée par `DATABASE_PATH`.
7. Faire échouer le démarrage si `ensureMigrated()` rejette.
8. Retirer les imports inutilisés de `migrations.ts` et l'enum `BottleAvailability` en double dans `schema.ts`.

**Verdict : REQUEST CHANGES** (1 critique, 6 majeurs). Le schéma tient la route ; c'est la façon d'y accéder qui pose problème.

Fichiers principaux examinés :
- src/lib/db/schema.ts
- src/lib/db/services.ts
- src/lib/db/migrations.ts
- src/lib/db/index.ts
- drizzle/
- scripts/
- src/hooks.server.ts
- src/routes/api/admin/restore/+server.ts
