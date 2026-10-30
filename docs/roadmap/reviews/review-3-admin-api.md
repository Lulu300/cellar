# Revue des routes `src/routes/api/admin/` (verdict : changements nécessaires)

## 1. Résumé

Le périmètre fait environ 6 100 lignes réparties sur 43 handlers. Aucun n'a de couche de service, et les opérations de DB, de fichiers, de zip et de logique métier sont mélangées dans chaque `+server.ts`. Aucune opération destructrice n'est transactionnelle : ni import JSON, ni restauration, ni wipe, ni import CSV. Les backups copient le fichier SQLite à chaud, sans garantie de cohérence. Plusieurs validations de chemins sont contournables, et j'ai reproduit un crash du process Node avec un simple zip piégé. Pour finir, 20 routes CRUD sont quasi identiques et chacune ouvre sa propre connexion SQLite. `svelte-check` passe avec 0 erreur, mais seulement parce que tout est typé `any`.

## 2. Ce qui va bien

- **Validation des réglages :** elle est correcte dans `backup-settings/+server.ts:69-83` (bornes et enums), `barcode-settings` et `label-presets/[id]` (whitelist de `pageFormat` et `codeType`).
- **Suppressions CRUD :** elles vérifient les dépendances avant d'agir, avec un message clair. La cascade sur `wine-definitions/[id]` est opt-in (`?cascade=true`). `images` DELETE renvoie 409 et propose un `force` qui nettoie les références.
- **`upload-image` :** le nom de fichier est généré côté serveur, avec un contrôle du MIME et une limite de 10 Mo.
- **`import-images-zip` :** il utilise `path.basename` et n'accepte que les noms déjà présents en DB, donc pas de zip slip. Pour `restore` et `import-json`, yauzl 3.2.0 rejette déjà les entrées `..` (vérifié dans `node_modules/yauzl/index.js:729`).
- **`import-json` :** il pré-valide que les tables sont bien des tableaux, insère par lots de 500 et fait un backup préalable.
- **`export-csv` :** la liste des tables est filtrée par whitelist.
- **`wipe-database` :** il s'arrête si le backup préalable échoue.
- **`import-csv` :** l'ordre des dépendances est géré, les caches de lookup sont une bonne idée et le rapport par ligne (erreurs et lignes ignorées) est utile.
- **Forme des réponses :** elle est cohérente (`{ error }` avec un code HTTP) et chaque handler a son try/catch.

## 3. Problèmes

### Critique

**C0 (hors périmètre strict, mais il fixe la gravité de tout le reste). Aucune authentification côté serveur, et CSRF désactivé.**
- `api/access-code` POST se contente de renvoyer `{valid}`. Il ne crée aucune session, et aucun hook ne protège `/api/admin/*`.
- `svelte.config.js:24-26` contient `csrf.checkOrigin: false`.
- Scénario : n'importe quel site ouvert par un utilisateur du réseau local peut envoyer un POST cross-origin vers `/api/admin/wipe-database`. Ce handler ne lit même pas le body.
- Correction : réactiver `checkOrigin` et vérifier une session dans `hooks.server.ts` pour `/api/admin`.

**C1. `import-json` vide la base puis réinsère, sans transaction (`import-json/+server.ts:398-427`).**
- Les exports automatiques omettent `countries`, `regions`, `appellations`, `wineClassifications` et `storageContainers` (`hooks.server.ts:114-123`, `auto-backup/+server.ts:190-198`).
- Scénario : on importe un export automatique. Les 13 tables sont vidées, puis l'insertion de `storageCases` échoue sur la contrainte FK (les FK sont actives par défaut dans better-sqlite3, vérifié : `pragma foreign_keys = 1`). La base reste vide.
- Le backup « pre-import » est lui-même un export JSON, donc sa restauration repasse par ce même chemin fragile.
- Les images sont copiées sur disque avant toute validation (`240-257`).
- Correction : faire toutes les suppressions et insertions dans un seul `db.transaction(...)` (synchrone avec better-sqlite3), refuser un export incomplet et ne copier les images qu'après le commit.

**C2. `restore` écrase le fichier de la base vivante (`restore/+server.ts:232`).**
- `copyFile` écrit par-dessus `data/cellar.db` alors que plus de 20 connexions sont ouvertes : `$lib/db`, plus une connexion par route CRUD (voir M9).
- Rien ne valide le fichier reçu : ni en-tête SQLite, ni `integrity_check`, ni version de schéma.
- Les migrations ne sont pas relancées, car `ensureMigrated` est mémoïsé (`lib/db/index.ts:22-27`). Restaurer un backup plus ancien laisse donc un schéma obsolète jusqu'au prochain redémarrage.
- Si le backup pré-restauration échoue, la restauration continue quand même (`198-201`).
- La DB est remplacée avant la copie des images. Si la copie des images échoue, la route renvoie 500 alors que la DB a déjà changé.
- Correction :
  1. Valider le fichier extrait (ouverture en lecture seule, `PRAGMA integrity_check`, présence des tables).
  2. Faire du backup pré-restauration une condition bloquante.
  3. Fermer la connexion partagée, faire un `rename` atomique, rouvrir et relancer les migrations (ou redémarrer le process).

### Majeur

**M1. N'importe quel upload peut faire crasher le process.**
- Ni `restore/+server.ts:61-131` ni `import-json/+server.ts:110-173` n'enregistrent d'écouteur `zipfile.on('error')`.
- Reproduit : un zip contenant l'entrée `images/../../x` produit `Unhandled 'error' event`, puis exit code 1.
- Correction : ajouter l'écouteur `error` et gérer les erreurs des `readStream`.

**M2. Les backups ne sont pas cohérents.**
- Le fichier `.db` est zippé en streaming pendant que l'application peut écrire, et le journal de rollback n'est pas inclus.
- La même fonction est dupliquée 6 fois : `create-backup:8`, `wipe-database:28`, `restore:19`, `auto-backup:134`, `hooks.server.ts:58` et, pour les exports, `create-export`/`import-json`.
- Correction : prendre un instantané avec `sqlite.backup(tmpPath)` ou `VACUUM INTO`, puis zipper cet instantané.

**M3. La planification des auto-backups n'est pas fiable.**
- C'est un `setTimeout` en mémoire, armé seulement à la première requête HTTP (`hooks.server.ts:337-352`).
- `backup-settings` PUT ne reprogramme rien. Si on active les backups automatiques dans l'UI, rien ne se passe avant un redémarrage.
- La rétention compte ensemble les backups et les exports (`hooks.server.ts:244`, `auto-backup:107`) : avec `keep=7`, on garde en réalité 3 ou 4 backups.
- `POST /api/admin/auto-backup` n'est pas authentifié, et la vérification du token est un simple commentaire (`229-235`).
- Correction : un module `backupScheduler` unique, démarré au boot (`init` dans le hook), avec une méthode `reschedule()` appelée par `backup-settings`, une rétention par type et un token cron obligatoire.

**M4. Path traversal confirmés.**
- `cleanup-csv/+server.ts:19` : `./data/../csv-imports/countries.csv` passe la validation, ce qui permet de supprimer les CSV de seed (ou n'importe quel `.csv` accessible).
- `export-csv/+server.ts:256-260` : `customName` n'est pas filtré, donc on peut écrire un CSV hors de `./data`.
- `download-backup:15-23` et `delete-backup:15-19` ne vérifient qu'une sous-chaîne. Je ne les ai pas trouvés exploitables directement, car Linux exige que le répertoire `cellar-backup-…/` existe, mais la défense reste fragile.
- Correction : un helper `resolveInDir(dir, name)` qui fait `path.basename`, puis un test `/^cellar-(backup|export)-[\w.-]+\.zip$/`, puis vérifie que `path.resolve(...)` reste bien dans le répertoire.

**M5. Lecture et suppression de fichiers arbitraires via `wineImages`.**
- `processRowData` (`import-csv:347-413`) copie toutes les colonnes du CSV, y compris `path` et `filename` pour la table `wineImages`. `import-json` fait de même.
- Ensuite, `images` DELETE (`images/+server.ts:173,190`) fait `path.join(IMAGES_DIR, filename)`, ce qui permet de supprimer `../../data/cellar.db`.
- De même, `download-images:62` fait `path.join('./static', image.path, filename)`, ce qui permet de lire `/etc/...`.
- Correction : n'accepter qu'une whitelist de colonnes à l'import, forcer `path`, appliquer `basename` sur les noms de fichiers et vérifier l'inclusion du chemin final au moment de la lecture ou de la suppression.

**M6. Le dédoublonnage de `import-csv` est cassé pour `wineDefinitions`.**
- À la lecture, la clé est `name|region|appellation|classification|color` (`154-160`, `178-184`).
- Après insertion, la clé est construite comme `name|producer|appellation|color` (`1331-1336`). Les doublons à l'intérieur d'un même fichier ne sont donc pas détectés.
- De plus, `export-csv` n'exporte pas `regionName` pour les définitions (`178-207`). Réimporter son propre export duplique donc tous les vins.
- Il n'y a pas non plus de transaction : un import interrompu laisse des données partielles.

**M7. Performance de `import-csv`.**
- Pour chaque bouteille, toutes les définitions sont rechargées avec 4 jointures (`786-802`).
- Pour chaque bouteille rangée dans une caisse, toutes les bouteilles de la caisse sont rechargées avec un `SELECT` complet au lieu d'un `count` (`1017-1019`).
- Le barcode est vérifié par une requête par ligne (`1127`).
- Chaque ligne de bouteille est journalisée en entier (`1243-1305`). Le fichier compte 146 appels `console`.
- Pour quelques milliers de bouteilles, cela fait des millions de lignes jointes et des logs énormes.

**M8. Taille des uploads.**
- `BODY_SIZE_LIMIT=10737418240` (10 Go, `Dockerfile:66`).
- Tous les handlers chargent le fichier entier en mémoire (`formData()` puis `arrayBuffer()`). Le contrôle des 500 Mo de `restore:174` n'intervient qu'après le chargement, donc il ne protège pas la mémoire.
- `import-images-zip` n'a ni limite de taille ni protection contre les zip bombs : `uncompressedSize` est collecté (`42-45`) mais jamais utilisé.
- Il rouvre aussi le zip pour chaque image (`61-123`, coût O(n²)).

**M9. Vingt connexions SQLite séparées.**
- Toutes les routes CRUD (`wine-types`, `countries`, `regions`, `appellations`, `origins`, `wine-*` et leurs `[id]`) font `new Database('data/cellar.db')` au chargement du module (lignes 8-10), au lieu d'importer `$lib/db`.
- Conséquences : le chemin est relatif, ces connexions contournent l'ordre des migrations, elles empêchent une restauration propre et elles exposent à des `SQLITE_BUSY`.

**M10. `wipe-database` n'est pas transactionnel (`95-141`).**
- Il enchaîne 13 `DELETE` puis le reseed. Si `forceSeedInitialData` échoue, la base reste vide et le flag de seeding est supprimé.
- Il crée aussi deux zips identiques de la DB, dont l'un est faussement nommé « export » (`83-88`).

**M11. `restore-label-presets:14` supprime tous les presets avant de vérifier que le CSV existe (`17-20`).** Si le CSV est absent, les presets sont perdus.

### Mineur

- **Code mort :**
  - `admin/test/` est un répertoire vide.
  - `seed-manufacturer-presets` et `restore-label-presets` n'ont aucun appelant côté front.
  - `hasWineBottlesFile` n'est pas utilisé (`import-csv:462`).
  - `extractZipToTemp` n'extrait rien et ne se sert pas de `tempDir` (`import-images-zip:18`).
  - Plusieurs imports de schéma ne servent pas (`restore`, `auto-backup`).
- **Identifiants :** `generateId()` est basé sur `Math.random` (`import-csv:117`, `upload-image:10`, `import-images-zip:14`), alors que `generateUUID` existe ailleurs.
- **Détection de la table par sous-chaîne du nom de fichier (`import-csv:539-545`) :** elle est incohérente avec `getTablePriority` (`480-512`). Par exemple, `wine_bottles.csv` reçoit la priorité 5 mais n'est rattaché à aucune table.
- **CRUD :**
  - PUT renvoie `success` même si l'id n'existe pas.
  - DELETE renvoie 400 au lieu de 409.
  - Aucune limite de longueur sur les champs.
  - Les POST existent en double avec `/api/wine-types`, `/api/countries` et `/api/regions`.
- **`images` PUT :** le fichier est renommé avant la mise à jour de la DB, sans retour arrière (`126-135`).
- **`import-json` :** les fichiers temporaires ne sont pas nettoyés sur le chemin d'échec (`432-443`).
- **Mémoire :** `download-backup:31` lit le zip entier en mémoire au lieu de le streamer. `download-images:86-104` bufferise tout le zip et fait `reject(new Response)`.
- **Fuite d'informations internes dans les messages d'erreur :** `import-json:436`, `auto-backup:286`.
- **Horodatage à la minute près :** deux restaurations ou backups dans la même minute utilisent les mêmes chemins (`temp-restore-${timestamp}`).

## 4. Refactoring structurel proposé

1. **Une couche `src/lib/server/` dont les routes ne sont que des adaptateurs.** Chaque route : parser l'entrée (zod ou valibot), appeler un service, convertir le résultat en `Response`.
   - `settings.ts` : `getSetting`/`setSetting` et les clés, aujourd'hui recopiés 3 fois (`hooks`, `auto-backup`, `backup-settings`).
   - `backup/` : `snapshotDb()` (API `backup`), `buildArchive({db, images, json})`, `listBackups()`, `resolveBackupFile(name)`, `retention(kind, keep)`, `scheduler.ts`.
   - `restore.ts` : extraction sûre, validation, swap atomique, migrations.
   - `fs-safe.ts` : `resolveInDir`, `safeZipEntries` (limites de taille et de nombre d'entrées).
2. **Découper `import-csv` (environ 1 500 lignes, pour une cible de 600 à 700 lignes en 8 fichiers) :**
   - `tables.ts` : une config déclarative par table (`nameField`, dépendances, champs requis, conversions de types, colonnes autorisées, fonction de clé de dédoublonnage). L'ordre se déduit par tri topologique des dépendances.
   - `detect.ts` : une seule correspondance nom de fichier vers table.
   - `parse.ts` : parse direct du buffer, sans fichier temporaire.
   - `referenceIndex.ts` : une classe chargée une seule fois par import, avec la même fonction de clé pour l'indexation et la recherche (cela corrige M6 et M7).
   - `pipeline.ts` : conversion, puis résolution des références, puis validation, puis dédoublonnage, puis insertion, avec un résultat typé par ligne.
   - `bottles.ts` : barcode et capacité des caisses (compteurs précalculés).
   - L'import entier dans un `db.transaction`, avec un mode `dryRun` qui renvoie le rapport sans valider.
   - Un logger `debug` activable à la place des 146 `console.log`.
3. **CRUD générique :** une fabrique `createLookupCrud({ table, nameColumn, label, parent?, usages: [{table, column, label}] })` qui renvoie `{ collection: {GET, POST}, item: {PUT, DELETE} }`.
   - Les 6 entités simples (`wine-types`, `colors`, `formats`, `classifications`, `origins`, `countries`) ne diffèrent que par leurs noms (`diff` vérifié). `regions` et `appellations` passent par l'option `parent`.
   - Chaque `+server.ts` tient alors en 2 lignes et utilise `$lib/db`.
   - Fusionner avec les `/api/<entité>` publics, qui font doublon.
4. **Un module unique pour l'export et l'import JSON**, avec une liste de tables partagée. Cela évite les exports automatiques incomplets.

## 5. Quick wins (moins d'une heure chacun)

1. Ajouter `zipfile.on('error', reject)` dans `restore` et `import-json` (corrige le crash M1).
2. Mettre les deux blocs de suppression et insertion de `import-json` et `wipe-database` dans `db.transaction`.
3. Remplacer `new Database('data/cellar.db')` par `import { db } from '$lib/db'` dans les 20 routes CRUD.
4. Écrire `resolveInDir` et l'appliquer à `cleanup-csv`, `export-csv` (`customName`), `download-backup`, `delete-backup`, `images` et `download-images`.
5. Rendre bloquant l'échec du backup préalable dans `restore` et `import-json`.
6. Corriger la clé composite (`import-csv:1331`) et ajouter `regionName` à l'export CSV des définitions.
7. Dans `import-csv`, sortir la requête des définitions de la boucle des bouteilles et remplacer le `SELECT` par un `count()`.
8. Baisser `BODY_SIZE_LIMIT` à 600 Mo et vérifier `Content-Length` avant `formData()`.
9. Dans `restore-label-presets`, vérifier la présence du CSV avant de supprimer.
10. Supprimer `admin/test/`, les variables et imports morts, et unifier la génération d'identifiants sur `generateUUID`.

Tous les fichiers sont sous `src/routes/api/admin/`. Pour le contexte, j'ai aussi lu `src/hooks.server.ts`, `src/lib/db/index.ts`, `svelte.config.js` et `Dockerfile`.
