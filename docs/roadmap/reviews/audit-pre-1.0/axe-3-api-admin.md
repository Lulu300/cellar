# Audit d'avant 1.0, axe 3 : API d'administration

Commit audité `9df0d08c` (develop, 2026-10-16). Périmètre : `src/routes/api/admin/**`, les référentiels `/api/<table>`, la route `/uploads`, et les domaines `features/backup`, `features/csv-import`, `features/images`, `features/shared/lookup-crud.ts` et les préréglages d'étiquettes. La partie A couvre les sauvegardes, la restauration, l'import JSON, l'effacement et le cron ; la partie B, l'import et l'export CSV, les images, les référentiels et les préréglages. Méthode : lecture du code, puis l'app lancée depuis des worktrees détachées avec des données inventées (`node server.js`, `BODY_SIZE_LIMIT=512M` comme l'image). Chaque constat a été rejoué par un second agent qui cherchait à le réfuter. Ce qui a été exécuté : restaurations de sauvegardes de 51 Ko à 200 Mo, avec mesure de la mémoire, un `kill -9` pendant une restauration, cinq sauvegardes prises pendant des écritures, `data/` en lecture seule, des zips piégés (`images/../../x.png`, zip bomb de 2,4 Gio), un aller-retour CSV de 2 200 lignes, un export puis un import entre deux caves, et les 8 référentiels par curl. Les points signalés par d'autres axes ont été vérifiés par le rédacteur, par lecture du code, avec `git check-ignore` et un test Vitest jetable dans sa propre worktree.

## 1. Résumé

Les défauts graves de la revue 3 sont corrigés. L'import JSON, la restauration, l'effacement et l'import CSV sont transactionnels. La restauration valide le zip, migre la copie et bascule par `rename`. Les sauvegardes passent par `VACUUM INTO`. Le planificateur est armé au démarrage et replanifié à chaque réglage. Les traversées de chemin et les zip bombs sont refusées, et l'import CSV, réécrit en 697 lignes, importe 2 000 bouteilles en 0,2 s. Sur 100 lignes de traçabilité, 89 sont corrigées. Huit restent ouvertes : 3 Partiel (renommage d'image, zip d'images en mémoire, erreur disque de l'import JSON) et 5 Non fait (fichiers temporaires après un arrêt brutal, images de l'import JSON copiées hors du verrou, rapprochement CSV par nom seul, CSV aux lignes inégales).

La passe 2 trouve 3 Majeurs et 15 Mineurs. Les plus graves :
- une sauvegarde de plus de 500 Mo, que Cellar crée sans avertir, ne peut plus être restaurée (M1) ;
- restaurer ou importer un zip occupe environ cinq fois sa taille en mémoire (M2) ;
- deux vins qui ne diffèrent que par leur type se fondent en un seul à l'import CSV, avec toutes leurs bouteilles (M3).

## 2. Traçabilité (passe 1)

100 lignes : 89 Corrigé, 3 Partiel, 5 Non fait, 2 Sans objet, 1 Écart décidé. Les deux vérificateurs ont contrôlé toutes les lignes venues d'un Critique, d'un Majeur ou d'un critère, et les lignes non corrigées. Ils n'ont ajouté aucune ligne. Un verdict a changé : R3-M8b passe d'Écart décidé à Corrigé (voir la ligne, et M2 pour la part qui reste ouverte). R3-C0 est traité à l'axe 2, R3-M9 à l'axe 1. Les refactorisations 1 et 4 de la revue 3 n'ont pas de ligne ici : la couche de services est le critère d'API-02 (axe 2), et la liste de tables partagée est vérifiée sous R3-C1b.

### Revue 3

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R3-C1a | `import-json` vide puis réinsère sans transaction | Corrigé | `features/backup/repository.ts:53-69` (`replaceCellar` dans un `db.transaction`) ; tests `import-json/server.test.ts` « changes nothing, images included, when a row cannot be inserted », « answers 422 and changes nothing when a row refers to one the export lacks » |
| R3-C1b | Les exports automatiques omettent 5 tables | Corrigé | Tous les exports passent par `createExportZip` (`export.ts:48-61`, 13 tables d'`EXPORT_TABLES`) ; `json-import.ts:98-107` refuse un export incomplet (422 `incomplete`) ; test « refuses an automatic export of 0.5.0 before changing anything » |
| R3-C1c | La sauvegarde « pre-import » repasse par le même chemin fragile | Corrigé | Import transactionnel (C1a) ; essai : export « Cœur de cave € 🍷 » importé depuis la liste → 200, 530 lignes, `cellar-export-pre-import-…zip` créé |
| R3-C1d | Images copiées avant toute validation | Corrigé | `json-import.ts:166-176` : extraction dans un dossier temporaire, `copyImages` après la transaction ; contenu vérifié par `detectImageType` (`restore.ts:134-148`) |
| R3-C2a | `copyFile` par-dessus la base ouverte | Corrigé | `src/lib/db/index.ts:45-82` : copie `.restore`, migration de la copie, fermeture, `renameSync`, suppression de `-wal`/`-shm` ; test `restore/server.test.ts` « puts the backup in place of the open database, with its images » |
| R3-C2b | Aucune validation du fichier reçu | Corrigé | `restore.ts:64-102` (en-tête SQLite, `integrity_check`, 14 tables), `upgrade.ts:225-251` (migrations, version) ; essai : 7 fichiers invalides → 422 `invalid_backup`, base inchangée, aucun fichier laissé |
| R3-C2c | Migrations pas relancées après restauration | Corrigé | `db/index.ts:59` (`migrateSchema(copy)`) ; test `restore/upgrade.test.ts` « records this version in the restored database… » (schéma 0.5.0) |
| R3-C2d | La restauration continue si la sauvegarde préalable échoue | Corrigé | `service.ts:283-289` (`PreRestoreBackupError`, 500 `pre_restore_backup_failed`) ; test `pre-restore-backup.test.ts` « restores nothing, and keeps an earlier backup… » |
| R3-C2e | Base remplacée avant les images ; 500 si leur copie échoue | Corrigé | `service.ts:307-316` (`imagesCopyFailed` signalé) ; test « keeps the restored database when its images cannot be copied, and says so » |
| R3-M1 | Un zip piégé fait planter le process | Corrigé | `src/lib/server/zip.ts:58` (`zipfile.on('error')`), `:85-99` ; test `zip.test.ts` « refuses the entry name images/../../x » ; `slip.zip` envoyé à `import-images-zip`, `restore` et `import-json` → 422, `GET /api/session` 200 ensuite |
| R3-M2a | Le .db est zippé à chaud, sans le journal | Corrigé | `archive.ts:24-26` (`VACUUM INTO`) ; essai : 5 sauvegardes pendant 81 écritures, `integrity_check` ok pour les 5 ; test « createBackupZip while another program writes » |
| R3-M2b | Logique d'archive copiée 6 fois | Corrigé | Un seul `createBackupZip` / `writeZipWithImages` (`archive.ts:29-94`) ; aucun autre `ZipArchive` dans `features/backup` |
| R3-M3a | `setTimeout` armé à la première requête | Corrigé | `hooks.server.ts:27-56` (`reschedule()` dans `init`) ; essai : sauvegarde en retard faite dès le démarrage |
| R3-M3b | PUT `backup-settings` ne replanifie rien | Corrigé | `service.ts:72-81` ; test `scheduler.test.ts` « applies a new interval at once, without a restart » |
| R3-M3c | Rétention commune aux sauvegardes et aux exports | Corrigé | `files.ts:119-132` (`applyRetention(kind, keep)`) ; essai `keep=2` : 2 sauvegardes et 2 exports gardés ; test « keeps the given number of automatic backups, and of automatic exports, apart » |
| R3-M3d | POST `auto-backup` non authentifié | Corrigé | `token.ts:31-41` (jeton haché, `timingSafeEqual`), `hooks.server.ts:78` ; essai : bon jeton 200, mauvais jeton, autre route, GET et ancien jeton → 401 |
| R3-M4a | `cleanup-csv` : `./data/../csv-imports/x.csv` passe | Sans objet | Route supprimée (décision API-06, endpoints sans appelant) |
| R3-M4b | `export-csv` : `customName` non filtré | Corrigé | Plus aucune écriture sur le serveur (`backup/service.ts:185-221`), préfixe via `resolveInDir` (`:192-197`, 422 `invalid_file_name`) ; test « answers each file … and writes none on the server » |
| R3-M4c | `download-backup` / `delete-backup` : contrôle par sous-chaîne | Corrigé | `files.ts:79-81` (motif `^cellar-(backup` ou `export)-.*\.zip$`, puis `resolveInDir`) |
| R3-M5a | Imports CSV/JSON qui recopient `path` et `filename` de `wineImages` | Corrigé | Liste blanche `shared/imported-rows.ts:21-44`, `filename` contrôlé, `path` forcé (`:39-41`) ; essai : `../../data/cellar.db` refusé, `path` mis à `/uploads/wines/` |
| R3-M5b | `images` DELETE : `path.join(IMAGES_DIR, filename)` | Corrigé | `images/service.ts:141-147` (`resolveInDir`) |
| R3-M5c | `download-images` lit `./static/<path>/<filename>` | Corrigé | `images/service.ts:325-331` (chemin stocké ignoré, `resolveInDir`) |
| R3-M6a | Clé de dédoublonnage différente à la lecture et après insertion | Corrigé | Une seule `wineKey` (`csv-import/referenceIndex.ts:13-24`) ; test « imports a wine listed twice in the same file once » ; la clé omet le type : voir M3 |
| R3-M6b | L'export n'a pas `regionName` | Corrigé | `csvExportRows('wineDefinitions')` le sélectionne ; en-tête vu dans un export réel |
| R3-M6c | Import interrompu = données partielles | Corrigé | `csv-import/service.ts:76-83` (`db.transaction`) ; test « imports nothing from any of the files when a row cannot be inserted » |
| R3-M7a | Définitions rechargées pour chaque bouteille | Corrigé | `ReferenceIndex` chargé une fois (`referenceIndex.ts:36-44`) |
| R3-M7b | Bouteilles de la case rechargées par bouteille | Corrigé | `csv-import/bottles.ts:67`, compteur `:118-121` |
| R3-M7c | Une requête par ligne pour le code-barres | Corrigé | `Set` des codes lu une fois (`bottles.ts:57-58`) |
| R3-M7d | 146 `console`, chaque bouteille journalisée | Corrigé | 0 `console.` dans `csv-import/` ; `debugLogger('csv-import')` (`service.ts:11`) ; 200 vins et 2 000 bouteilles en 0,21 s |
| R3-M8a | `BODY_SIZE_LIMIT` à 10 Go | Écart décidé | Décision SEC-07 : 512 Mo (`Dockerfile:67`) |
| R3-M8b | Fichier entier chargé avant le contrôle de taille | Corrigé (vérificateur ; Écart décidé chez l'auditeur) | C'est l'« À faire » de SEC-06, « vérifier `Content-Length` avant `formData()` », fait : `http/body.ts:90-91` ; essai : CSV de 53 Mo → 413 en 1 ms, envoi `chunked` → 413. Le corps d'un envoi sous la limite reste lu en mémoire, avec un facteur 5 que la décision SEC-07 ne couvre pas : constat séparé M2 |
| R3-M8c | `import-images-zip` sans limite ni protection zip bomb | Corrigé | `zip.ts:10-15,45-49,64-66` ; `bomb.zip` (2,4 Mo, 2,4 Gio décompressés) → 422 |
| R3-M8d | Zip rouvert pour chaque image (O(n²)) | Corrigé | Une seule extraction (`images/service.ts:249-251`) |
| R3-M10a | `wipe-database` non transactionnel | Corrigé | `repository.ts:27-35` ; test `wipe-database/server.test.ts` « changes nothing when the default data cannot be inserted again » |
| R3-M10b | Deux zips identiques, dont un faux « export » | Corrigé | `service.ts:359-382` ; essai : un seul `pre-reset` |
| R3-M11 | `restore-label-presets` supprime avant de vérifier le CSV | Sans objet | Route supprimée par API-06 (`CHANGELOG.md:21`) |
| R3-m1 | « `admin/test/` est un répertoire vide » | Corrigé | Absent de `src/routes/api/admin/` |
| R3-m2 | « `seed-manufacturer-presets` et `restore-label-presets` sans appelant » | Corrigé | Supprimés (API-06) ; `grep` vide |
| R3-m3 | « `hasWineBottlesFile` n'est pas utilisé » | Corrigé | Symbole absent |
| R3-m4 | « `extractZipToTemp` n'extrait rien » | Corrigé | Absent ; `importImagesZip` passe par `extractZip` (`images/service.ts:249`) |
| R3-m5 | « imports de schéma inutilisés (`restore`, `auto-backup`) » | Corrigé | Routes de 13 et 14 lignes sans import de schéma ; `pnpm lint` passe |
| R3-m6 | « `generateId()` basé sur `Math.random` » | Corrigé | `grep generateId\|Math.random` vide ; `randomUUID` (`csv-import/pipeline.ts:171`, `upload.ts:34`) |
| R3-m7 | « détection de la table par sous-chaîne » | Corrigé | `csv-import/detect.ts:8-20`, ordre déduit des références (`tables.ts:71-80`) |
| R3-m8 | « CRUD : PUT renvoie `success` si l'id n'existe pas » | Corrigé | `shared/lookup-crud.ts:119` ; `PUT /api/countries/nope` → 404 |
| R3-m9 | « CRUD : DELETE renvoie 400 au lieu de 409 » | Corrigé | `lookup-crud.ts:129-145` ; `DELETE` France → 409 `in_use` (19 régions) |
| R3-m10 | « CRUD : aucune limite de longueur » | Corrigé | `shared/schemas/common.ts:7` (500) ; nom de 501 caractères → 422 |
| R3-m11 | « POST en double avec `/api/wine-types`, `/api/countries`, `/api/regions` » | Corrigé | Une seule route `/api/<table>` (décision API-03) |
| R3-m12 | « `images` PUT : fichier renommé avant la DB, sans retour arrière » | Partiel | Contrôles ajoutés avant (`images/service.ts:78-84`), mais l'ordre reste `rename` puis `renameImageRow` (`:88-89`), sans retour arrière. Si l'UPDATE échoue (base occupée) ou ne trouve plus la ligne (`:90`, `NotFoundError`), le fichier porte le nouveau nom et la ligne l'ancien. Aussi signalé par un autre auditeur, vérifié par le rédacteur |
| R3-m13 | « `import-json` : fichiers temporaires non nettoyés en cas d'échec » | Corrigé | `json-import.ts:187-190` (`finally`) ; après les 422 de `slip.zip`, `data/` ne contient que la base |
| R3-m14 | « `download-backup` lit le zip entier en mémoire » | Corrigé | `backup/service.ts:134-144` (`createReadStream`) |
| R3-m15 | « `download-images` bufferise tout le zip et fait `reject(new Response)` » | Partiel | Le `reject(new Response)` a disparu ; `zipImages` concatène toujours tout le zip (`images/service.ts:342-350`, `Buffer.concat`) |
| R3-m16 | « fuite d'informations internes dans les messages d'erreur » | Partiel | Les 500 sont génériques (`http/handler.ts:30-35`). Reste `readExport` (`json-import.ts:55-71`) : toute erreur, `writeFile` et `mkdir` compris, devient 422 `invalid_export` / `unreadable` avec `error.message`. Essai, `data/` en lecture seule : `422 … It cannot be read: EACCES: permission denied, open '…/data/temp-import-….zip'`, alors que la restauration répond 500 sans chemin. Contredit `CHANGELOG.md:21` (0.7.0, « instead of revealing where the server keeps its data ») |
| R3-m17 | « horodatage à la minute : deux restaurations partagent les chemins » | Corrigé | `archive.ts:14-16` (milliseconde) ; `importImagesZip` utilise `Date.now()` (`images/service.ts:242`) |
| R3-Refacto-2 | Découper `import-csv` | Corrigé | `features/csv-import/` : 7 fichiers, 697 lignes hors test ; `dryRun` (`service.ts:27,81`) ; test « answers the report of a dry run without writing anything » |
| R3-Refacto-3 | Fabrique CRUD générique, fusion avec les routes publiques | Corrigé | `features/shared/lookup-crud.ts` ; 8 référentiels (`catalog/service.ts:31-64`, `geography/service.ts:7-30`) ; chaque route fait 3 lignes |

### Revue 2 (M8)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R2-M8a | Migrations à la première requête, app servie même en cas d'échec | Corrigé | `hooks.server.ts:27-55` : migrations dans `init`, `process.exit(1)` en cas d'échec |
| R2-M8b | Plusieurs `scheduleNextBackup` en parallèle | Corrigé | Un seul timer remplacé par `reschedule()`, drapeau `running` (`scheduler.ts:76-121`) |
| R2-M8c | Trois connexions SQLite dans le hook | Corrigé | Aucune connexion ouverte dans `hooks.server.ts` ; `db` partagé (`db/index.ts:30-36`) |
| R2-M8d | `scheduleNextBackup` non exporté | Corrigé | `reschedule` exporté, appelé par `saveBackupSettings` et `restoreBackup` (`service.ts:80,305`) |
| R2-M8e | Archiver copié 5 fois | Corrigé | Voir R3-M2b |

### DATA-05

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DATA-05 | Restaurer une ancienne sauvegarde sans redémarrer ; sauvegarde valide pendant des écritures ; fréquence appliquée tout de suite | Corrigé | Test `upgrade.test.ts` (schéma 0.5.0) ; essai : effacement puis restauration depuis la liste, sans redémarrage, données, images et réglages revenus ; 5 sauvegardes pendant des écritures, `integrity_check` ok ; PUT des réglages replanifié dans la même requête |
| DATA-05/Trouvé-1 | Sauvegarde préalable écrite avant la validation du zip | Corrigé | `service.ts:272-286` ; 7 fichiers invalides, aucun `pre-restore` |
| DATA-05/Trouvé-2 | Zip sans `cellar.db` → 500 | Corrigé | `service.ts:273-278` → 422 `no_database` |
| DATA-05/Trouvé-3 | Horodatage à la minute : collisions | Corrigé | `archive.ts:14-16` ; test « gives each restore its own pre-restore backup, even within a minute » |
| DATA-05/Trouvé-4 | Sous-dossier de `images/` → EISDIR | Corrigé | `restore.ts:122-127` |
| DATA-05/Trouvé-5 | Images copiées sans vérifier le type | Corrigé | `restore.ts:134-148` ; test « restores only the images the app accepts » |
| DATA-05/Trouvé-6 | Fichiers cachés dans les sauvegardes | Corrigé | `archive.ts:100-109` ; test « archives only the regular, visible files of the images folder » |
| DATA-05/Trouvé-7 | `resolveBackupFile` en double | Corrigé | Une seule définition (`files.ts:79-81`) |
| DATA-05/Trouvé-8 | Échec après la copie → serveur en 500 | Corrigé | `db/index.ts:72-81` (base rouverte dans le `finally`) |
| DATA-05/Trouvé-9 | Erreur d'écriture du zip → processus tué | Corrigé | `archive.ts:73-92` ; essai `data/` en lecture seule : create-backup, create-export, wipe, restore → 500, processus vivant ; `download-images` plante encore : voir m12 |
| DATA-05/Trouvé-10 | `docker stop` pendant une sauvegarde → zip partiel | Corrigé | `.partial` puis `rename` (`archive.ts:47-71`), `removePartialBackups()` au démarrage (`hooks.server.ts:54`) ; test « removes only the files of interrupted backups… » |
| DATA-05/Trouvé-11 | Réglages enregistrés sans replanification | Corrigé | Voir R3-M3b |
| DATA-05/Trouvé-12 | Imports inutilisés dans la route restore | Corrigé | `restore/+server.ts` : 13 lignes, 4 imports utilisés |
| DATA-05/Trouvé-13 | Échec de `migrateSchema()` : session et code non remis | Corrigé | Migration et `prepare` sur la copie avant la bascule (`db/index.ts:57-63`, `service.ts:295-301`) |
| DATA-05/Trouvé-14 | Ordre de la restauration testé pas à pas, pas par POST | Corrigé | `restore/server.test.ts`, `instance-settings.test.ts` passent par POST `/api/admin/restore` |
| DATA-05/Trouvé-15 | archiver 7 → 8 et yauzl | Corrigé | `package.json:72,78` |
| DATA-05/Trouvé-16 | `setSetting` recopié | Corrigé | Tout passe par `settings/repository.ts` |
| DATA-05/Trouvé-17 | `import-json` sans test | Corrigé | `import-json/server.test.ts` : 13 tests |
| DATA-05/Trouvé-18 | Exceptions `no-async-promise-executor` | Corrigé | `grep` vide |
| DATA-05/Trouvé-19 | Variables à `null` jamais lues dans le hook | Corrigé | Hook réécrit (87 lignes) |
| DATA-05/Trouvé-20 | Le cron doit envoyer `Content-Type: application/json` | Corrigé | `README-Docker.md:457,465`, `BackupSettingsDialog.svelte:44` ; sans l'en-tête → 403 |
| DATA-05/Reste-1 | Fichiers temporaires laissés dans `data/` après un arrêt brutal | Non fait | Essai : `kill -9` pendant la restauration de 200 Mo, redémarrage → `temp-restore-…zip` (191 Mo) et `temp-extract-…/` (167 Mo) toujours là ; `removePartialBackups` (`archive.ts:112-127`) ne vise que `cellar-(backup` ou `export)-*.partial`. Même cas par lecture du code : `temp-import-*`, `temp-extract-import-*` (`json-import.ts:162-163`), `cellar.db.restore` (`db/index.ts:51`) et, vérifié par le rédacteur, `temp-zip-import-*` (`images/service.ts:243-244`, retiré seulement par le `finally` de `:310-313`). En dev, `.gitignore:18-24` n'ignore que les fichiers posés directement dans `data/` : `git check-ignore` ne couvre ni `data/temp-extract-1/cellar.db`, ni `data/temp-zip-import-1/a.png`, ni `data/temp-extract-import-1/data.json` |
| DATA-05/Reste-2 | `docker stop` attend 10 s après une sauvegarde | Corrigé | `scheduler.ts:104-106` (`timer.unref()`) ; essai hors Docker : arrêt en moins d'une seconde (pas vérifié dans le conteneur) |
| DATA-05/Reste-3 | `download-images` construit son zip en mémoire | Non fait | `images/service.ts:342-350` (`Buffer.concat`), puis `new Uint8Array(zip)` dans la route. Même défaut que R3-m15 |
| DATA-05/Reste-4 | L'import JSON copie ses images après avoir relâché le verrou | Non fait | `json-import.ts:170-176` et `service.ts:283-309` : `copyImages` après `holdWrites` |

### BUG-10

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-10 | Une sauvegarde « Cœur de cave € 🍷 » se télécharge et se restaure depuis la liste ; un export CSV de ce nom se télécharge | Corrigé | Rejoué par l'auditeur et le vérificateur : `download-backup` → 200, `filename*=UTF-8''cellar-backup-C%C5%93ur%20de%20cave%20%E2%82%AC%20%F0%9F%8D%B7-…` ; effacement puis restauration de ce fichier → 200, bouteilles revenues ; tests `download-backup/server.test.ts`, `export-csv/server.test.ts:31-39`, `content-disposition.test.ts` |

### API-03

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| API-03 | 8 référentiels servis par la même fabrique, avec des tests | Corrigé | `lookup-crud.test.ts` (16 tests) ; essai : POST d'un nom existant → 200 avec la ligne, renommage vers un nom pris → 409 `duplicate_name`, parent inconnu → 409 `missing_reference`, sans session → 401. La comparaison des noms distingue la casse : voir m8 |
| API-03/Trouvé-1 | Vérification puis suppression : une écriture entre les deux donne 500 | Corrigé | La clé étrangère décide (`lookup-crud.ts:129-145`) ; test « deleting a row that starts to be used meanwhile … 409 in_use, not 500 » |

### API-04

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| API-04 | Moins de 700 lignes ; 2 000 bouteilles en moins de 5 s ; test aller-retour | Corrigé | 697 lignes hors test (compté sans le normaliseur partagé, décision API-04) ; 2 200 lignes en 0,21 s ; `csv-import/round-trip.test.ts` (3 tests) |
| API-04/Trouvé-1 | Quatre `if (!cleanedData.id)` morts | Corrigé | Id posé une seule fois (`pipeline.ts:171`) |
| API-04/Trouvé-2a | Référence optionnelle non résolue : ligne insérée sans elle, puis dupliquée | Corrigé | Ligne sautée (`pipeline.ts:74-116`), comme la décision API-04 l'accepte ; `originName` inconnu → `unknown_reference` |
| API-04/Trouvé-2b | Rapprochement des bouteilles qui recopie la normalisation | Corrigé | `ReferenceIndex.winesOfBottle` réutilise `wineKey` (`referenceIndex.ts:93-104`) |
| API-04/Trouvé-2c | Nom d'export contenant « regions » lu comme cette table | Corrigé | `detect.ts:8-20` ; test « reads the table from the end of an export name that holds another table name » |
| API-04/Trouvé-2d | Export des bouteilles avec `wineName` et `producer` seuls | Corrigé | Appellation, classification et couleur exportées ; doublon sans code reconnu (`bottles.ts:77-89`) ; réimport dans la même cave → 0 importé, 541 ignorés. Le type manque encore : voir M3 |
| API-04/Reste-1 | Régions, appellations et cases rapprochées par leur nom seul, la première l'emporte | Non fait | `referenceIndex.ts:46-53` |
| API-04/Reste-2 | Un CSV aux lignes de longueurs différentes échoue en entier | Non fait | `origins.csv` (`Origin B,extra` en ligne 3) → 0 importé, `not_csv` ligne 3 |

### BUG-09

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-09 | Exporter puis réimporter ne crée aucun doublon | Corrigé | Test `round-trip.test.ts` « adds nothing when imported into the cellar it comes from » ; essai avec virgule, `;` et tabulation : 0 importé, 539 à 541 ignorés |
| BUG-09/Trouvé-1 | Export CSV à nom personnalisé non téléchargeable faute de préfixe | Corrigé | Préfixe toujours posé (`backup/service.ts:192`), fichiers renvoyés dans la réponse |

### SEC-05

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-05 | Helper testé (`..`, chemin absolu, octet nul) ; aucune route listée ne construit un chemin sans lui | Corrigé | `paths.test.ts` « refuses a traversal / absolute POSIX path / null byte … » ; `grep path.join\|path.resolve` dans `src/lib/server` et `src/routes` : chaque nom venu d'une requête ou de la base passe par `resolveInDir` ou est généré (`newImageFileName`) ; `uploads/[...path]/+server.ts:10-14,52` ; préfixe `../x` → 422 `invalid_barcode_prefix` |

### SEC-06

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-06 | Le zip `images/../../x` est refusé sans crash ; un zip bomb est refusé | Corrigé | 422 au lieu du 400 écrit dans le critère, par le format d'erreur d'API-01 (`http/errors.ts:34-37`) ; tests `restore/invalid-backup.test.ts`, `zip.test.ts` « refuses a zip bomb before inflating it » ; rejoué sur les 3 routes. Le contrôle du contenu des images manque à l'import zip d'images : voir m11 |

## 3. Nouveaux constats (passe 2)

Le constat « import JSON : erreur disque rapportée en 422 avec chemin serveur » est traité sous R3-m16 (Partiel), section 2, et n'est pas répété ici. Les fichiers temporaires laissés après un arrêt brutal sont sous DATA-05/Reste-1.

### Critique

Aucun.

### Majeur

**M1. Une sauvegarde de plus de 500 Mo faite par Cellar ne peut plus être restaurée**
- Où : `src/lib/server/zip.ts:8` (`MAX_ZIP_UPLOAD_BYTES`), `src/lib/server/features/backup/service.ts:252`, `src/lib/server/http/body.ts:90-91` ; aucune limite à la création (`archive.ts:29-39,87-89`) ; `src/routes/admin/backups/+page.svelte:144-151` (restaurer ou importer depuis la liste télécharge le zip dans le navigateur, puis le renvoie).
- Scénario : une cave de 150 vins photographiés → « Créer une sauvegarde » donne un zip de 600 Mo, sans avertissement → plus tard, « Restaurer » depuis la liste ou depuis le fichier → 413, toast « La requête est trop volumineuse. », sans dire qu'il y a une limite ni quoi faire. La seule sauvegarde complète ne se restaure pas. Une image peut faire 20 Mo (`src/lib/shared/images.ts:2`), rien ne limite leur nombre ni ne les réduit : 25 photos de 20 Mo, ou environ 120 photos de téléphone de 4 Mo, suffisent. Attendu : toute sauvegarde écrite par Cellar se restaure.
- Correction proposée : restaurer (et importer) une sauvegarde de la liste côté serveur, par son nom (`resolveBackupFile`, puis extraction sur place), sans envoi ni limite. La limite de 500 Mo ne vise plus que les fichiers envoyés, ce que dit déjà la décision SEC-07. Cela règle aussi UI-07/Reste-3 (axe 4).
- Preuve : envoi d'un fichier de 501 Mo à `/api/admin/restore` → `{"error":{"code":"body_too_large",…}}`, 413 en 2 ms.
- Vérification : Confirmé, corrigé (le vérificateur a ajouté le toast affiché, et le lien avec UI-07/Reste-3 ; il a vérifié qu'aucune décision ne couvre le cas : SEC-07 ne parle que des envois).

**M2. Restaurer ou importer un zip occupe environ cinq fois sa taille en mémoire**
- Où : `src/lib/server/http/body.ts:93` (`request.formData()` garde tout le corps en mémoire) ; `src/lib/server/features/backup/service.ts:264` et `json-import.ts:57` (`file.arrayBuffer()`, une copie de plus).
- Scénario : un NAS de 2 Go restaure une sauvegarde de 450 Mo, sous la limite → environ 2,3 Go de plus → le noyau tue le processus pendant la lecture du formulaire. Rien n'est changé, mais la restauration est impossible et le conteneur redémarre. Attendu : une mémoire indépendante de la taille du fichier.
- Correction proposée : envoyer le zip comme corps brut (`application/zip`) et l'écrire sur disque en flux (`pipeline(Readable.fromWeb(request.body), createWriteStream(tempFile))`). Lire le champ du formulaire en flux (`file.stream()`) n'enlève que la copie d'`arrayBuffer()`, soit environ une fois la taille. M1 retire le cas le plus courant, la restauration depuis la liste. Passer au corps brut change le contrat de `POST /api/admin/restore` et `import-json` pour d'éventuels scripts : à signaler dans les notes de version.
- Preuve : RSS au repos 343 Mo, pic de 1 363 Mo pendant la restauration d'une sauvegarde de 210 Mo (×5,1) ; même mesure chez l'auditeur (226 → 1 279 Mo). Script hors serveur : `formData()` +600 Mo, `arrayBuffer()` +400 Mo, `Buffer.from` +0 pour 200 Mo.
- Vérification : Confirmé, corrigé (cause précisée : `Buffer.from(arrayBuffer)` partage la mémoire et ne copie rien ; c'est `formData()` qui pèse le plus).
- Arbitrage entre vérificateurs : R3-M8b reste Corrigé pour ce que SEC-06 demandait (413 sur `Content-Length` avant `formData()`). La décision SEC-07 fixe les limites, pas la mémoire employée sous ces limites : le facteur 5 n'est donc pas un écart décidé, et il forme ce constat.

**M3. Vins homonymes sur toute la clé : un vin perdu à l'import CSV, ses bouteilles rattachées à l'autre**
- Où : `src/lib/server/features/csv-import/referenceIndex.ts:14` (`WINE_KEY` sans le type), `:77-78` (`winesByKey` ne garde que le premier vin d'une clé), `:93-97` ; `pipeline.ts:120-124`.
- Scénario : deux fiches qui ne diffèrent que par le type, la note, la description ou l'image (un doublon complété après coup, deux cuvées saisies sous le même nom ; rien ne l'empêche, aucune contrainte d'unicité dans `db/schema.ts`). Export CSV, puis import dans une cave vide (déménagement, réinstallation) → la seconde fiche est signalée « Déjà dans la cave » alors que la cave était vide, et ses bouteilles sont rattachées en silence à la première. Attendu : les deux vins importés, ou au moins les bouteilles refusées en `several_wines`. API-04 écrit « les homonymes sont signalés », et le commit 6ff01d09 « a homonym that the file cannot tell apart is reported instead of taking the first » : la règle écrite est cassée. La décision « Import CSV (API-04) » ne vise que les exports 0.6.0 ou antérieurs.
- Correction proposée : ajouter `typeName` à la clé (déjà exporté pour les vins, à ajouter à l'export des bouteilles) ; garder dans l'index la liste des vins d'une clé et répondre `several_wines` quand elle en a plus d'un. Les fichiers de bouteilles exportés avant ce changement passeraient par le chemin « ancien fichier » (`:98-103`) et signaleraient `several_wines`, ce qui reste cohérent avec la décision API-04.
- Preuve : cave A, deux vins identiques par nom, producteur, appellation, classification et couleur, l'un « Champagne » (2 bouteilles), l'autre « Mousseux » (3 bouteilles) ; export importé dans une cave B vide → `wineDefinitions … "skipped":[{"row":2,"reason":{"code":"same_name",…}}]`, `wineBottles … "successfulImports":8` ; dans B, un seul vin « Champagne » avec 5 bouteilles, le « Mousseux » et sa description absents. `round-trip.test.ts` ne couvre que des vins qui diffèrent par la couleur ou la classification.
- Vérification : Confirmé (reproduit à l'identique ; ce n'est pas une régression, la clé n'a jamais contenu le type).

### Mineur

**m1. L'effacement ne retient pas les écritures : celles faites pendant sa sauvegarde ne sont pas dans la sauvegarde de secours**
- Où : `src/hooks.server.ts:22` (`ROUTES_HOLDING_WRITES` : restore et import-json seulement), `src/lib/server/features/backup/service.ts:359-366`.
- Scénario : un téléphone ajoute des bouteilles pendant que l'admin efface → 201, puis la sauvegarde `pre-reset`, censée permettre de revenir en arrière, ne les contient pas. Attendu : 503 `writes_held` pendant la sauvegarde et l'effacement, comme pendant une restauration.
- Correction proposée : ajouter `/api/admin/wipe-database` à `ROUTES_HOLDING_WRITES`, et faire la sauvegarde et `wipeCellar()` dans `holdWrites`.
- Preuve : image de 150 Mo (sauvegarde de quelques secondes), boucle de POST `/api/bottles` pendant l'effacement → 7 898 réponses 201 ; la première bouteille écrite n'est ni dans le `cellar.db` de `pre-reset` ni dans la base. Pendant une restauration, les mêmes écritures reçoivent 503.
- Vérification : Confirmé. Mineur : il faut une seconde session qui écrit pendant les secondes du zip, et l'effacement aurait de toute façon supprimé ces lignes ; ce qui se perd, c'est leur présence dans la sauvegarde de secours. Aucune décision ne couvre l'effacement (API-02 ne cite que l'import JSON et la restauration).

**m2. Les fichiers d'images ne sont jamais retirés par l'effacement ni par la restauration**
- Où : `features/backup/repository.ts:27-35` (le wipe supprime les lignes de `wine_images`, pas les fichiers), `restore.ts:134-148` (les images de la sauvegarde s'ajoutent à celles du dossier), `archive.ts:100-109` (chaque sauvegarde prend tous les fichiers du dossier).
- Scénario : effacer pour repartir de zéro → les photos restent sur le disque, absentes de la page des images (qui lit la table), toujours servies par `/uploads/wines/<nom>`, sans moyen de les supprimer depuis l'interface, et elles grossissent chaque sauvegarde (voir M1). Attendu : les fichiers des images supprimées partent aussi ; la sauvegarde `pre-reset` ou `pre-restore` les garde.
- Correction proposée : après la transaction du wipe, supprimer les fichiers des images supprimées ; après une restauration, supprimer les fichiers qu'aucune ligne de `wine_images` ne cite.
- Preuve : après l'effacement, `wine_images` = 0 et 3 fichiers dans `uploads/wines` ; après la restauration de « Cœur de cave », `wine_images` = 1 et 3 fichiers.
- Vérification : Confirmé.

**m3. Une restauration peut couper les sauvegardes automatiques sans le dire**
- Où : `features/backup/service.ts:291-305` (le jeton cron est remis par `putBackBackupToken`, mais `auto_backup_mode` vient de la sauvegarde) ; `scheduler.ts:93-96`.
- Scénario : restaurer une sauvegarde de 0.1.x faite en mode « External Cron Job » (l'action 0.2.0 n° 3 demandait de passer en mode interne) sur une instance en mode interne sans jeton → mode cron sans jeton : plus aucune sauvegarde automatique, ni interne ni par cron. Rien ne le signale hors de la boîte de réglages. Attendu : les sauvegardes continuent comme avant la restauration.
- Correction proposée : garder les réglages des sauvegardes automatiques de l'instance, comme le jeton ; au minimum, repasser en mode interne quand la sauvegarde est en mode cron et que l'instance n'a pas de jeton. Le commentaire `service.ts:303` montre que reprendre les réglages de la sauvegarde est voulu, sans « Décision prise » : à trancher.
- Preuve : instance en mode interne sans jeton, sauvegarde prise en mode cron, restauration → `GET backup-settings` : `"autoBackupMode":"cron","hasBackupToken":false`, log « 📅 No automatic backup planned (disabled, or left to a cron job) ».
- Vérification : Confirmé.

**m4. Une restauration jette les actions de mise à jour de la sauvegarde, dont celles qui concernent ses données**
- Où : `src/lib/server/upgrade.ts:258-266` (`putBackUpgradeState` remet les actions de l'instance), `features/backup/service.ts:293-299` ; tests `restore/upgrade.test.ts` « records this version in the restored database, and keeps the instance's actions » et « drops the actions of the backup when the instance has none ».
- Scénario : un utilisateur change de NAS. Il installe la version courante (base neuve, aucune action), puis restaure une sauvegarde faite en 0.3.0. La copie est migrée et marquée à la version courante, et les actions des versions 0.4.0 à 0.8.0 ne sont jamais calculées. Il ne voit donc pas l'action conditionnelle 0.4.0 (« Only if you printed barcode labels before 0.4.0 … print them again »), qui porte sur les étiquettes de ses bouteilles, pas sur l'installation. Même chose, pour une sauvegarde d'avant 0.2.0, pour l'action 0.2.0 n° 6 (ces sauvegardes contiennent le code d'accès en clair) et pour l'action 0.2.0 n° 3 (mode cron, voir m3). Les autres actions (ORIGIN, propriétaire des dossiers, Node, scripts) concernent bien l'installation : les garder de l'instance est juste pour elles. Attendu : les actions qui portent sur les données de la sauvegarde restent visibles.
- Correction proposée : à la restauration, calculer `planUpgrade` pour la version de la sauvegarde et fusionner ses actions dans la liste de l'instance avec `mayBeDone: true`, comme la décision REL-02 le fait pour une version inconnue. L'utilisateur coche celles qui ne le concernent pas. Le comportement actuel est documenté (`README-Docker.md:441-443`) mais n'est pas une « Décision prise » : à trancher.
- Preuve : `upgrade.ts:263-266` ; `releases.json`, action 0.4.0 n° 1 conditionnelle aux étiquettes imprimées ; le second test cité vérifie que la liste reste vide après la restauration d'une sauvegarde 0.5.0-rc.1 sur une instance sans action.
- Vérification : signalé par a3a, vérifié par le rédacteur (lecture du code, des tests et de `releases.json`). Mineur : l'information perdue porte sur une action conditionnelle, et les étiquettes fautives se révèlent au premier scan.

**m5. Un nom de sauvegarde accepté par le schéma donne une erreur 500**
- Où : `src/lib/server/features/backup/files.ts:55-57` (`max(200)` compte des unités UTF-16, pas des octets) ; un nom de fichier est limité à 255 octets ; `archive.ts:30` ajoute `.zip.db.partial`, et SQLite ajoute `-journal`.
- Scénario : nommer une sauvegarde avec une longue description → toast « Internal server error ». Les noms ne sont vérifiés que par le serveur (décision UI-07), et celui-ci ne dit pas ce qui ne va pas. Sur ext4 ou btrfs, environ 55 emoji ou 110 lettres accentuées suffisent. Attendu : 422 `invalid_file_name`.
- Correction proposée : limiter le nom en octets (par exemple `Buffer.byteLength(name) <= 150`) dans `manualBackupRequest` et dans `exportCsvTables`, avec le même 422.
- Preuve : 200 « x » → 500 `internal_error`, log `SqliteError: unable to open database file` (`SQLITE_CANTOPEN`, `VACUUM INTO` vers un chemin de plus de 255 octets) ; 190 « x » → 201.
- Vérification : Confirmé.

**m6. Des sauvegardes manuelles nommées « auto » sont listées comme automatiques, et la rétention ne les supprime jamais**
- Où : `src/lib/server/features/backup/files.ts:28-30` (`LEGACY_AUTOMATIC_FILE`), `:98-100` (classées `automatic-backup-internal`), `:119-123` (`applyRetention` ne compte que `AUTOMATIC_FILE`) ; test `files.test.ts` « …older unnamed automatic backups are not counted ».
- Scénario : jusqu'à 0.5.0, une sauvegarde nommée « auto » s'appelait `cellar-backup-auto-<date>.zip` (`create-backup/+server.ts:56-58` à v0.5.0). La page des sauvegardes la range parmi les sauvegardes automatiques (« planificateur »), mais la rétention, que `README-Docker.md:446-448` décrit (« deletes older ones »), ne la supprime jamais. Le commentaire et le test parlent de « older unnamed automatic files », mais aucune version de l'historique git n'a écrit ce nom : depuis le premier commit, les fichiers automatiques portent `auto-internal-` ou `auto-cron-`. Attendu : un fichier que la rétention ne touche pas est listé comme manuel.
- Correction proposée : retirer `LEGACY_AUTOMATIC_FILE` et sa branche ; ces fichiers apparaissent alors comme manuels, ce qu'ils sont. Corriger le commentaire du test.
- Preuve : `git log --all -G'-auto-\$\{'` ne trouve que 6186e749 et 10eda4a6 (0.6.0), où la ligne trouvée est `` `cellar-${kind}-auto-${source}-${timestamp}.zip` ``, avec la source ; `git grep 'cellar-backup-auto-' v0.1.0` ne montre que `auto-internal-` et `auto-cron-`.
- Vérification : signalé par a3a, vérifié par le rédacteur, avec une précision : ces fichiers ne sont pas d'anciennes sauvegardes automatiques mais des sauvegardes manuelles nommées « auto ». Rien n'est perdu (la rétention les épargne), d'où Mineur.

**m7. « Remplacer tous les codes-barres » coupe la détection des doublons sans le dire**
- Où : `src/lib/server/features/csv-import/bottles.ts:77-78` (`if (this.newBarcodes) return undefined`) ; texte d'aide `fr.json:616`.
- Scénario : l'utilisateur réimporte un fichier de bouteilles déjà importé, avec l'option → chaque bouteille est ajoutée une seconde fois, avec un nouveau code, sans avertissement. L'option est conçue pour un fichier venu d'une autre cave, dont les codes recouvrent ceux de celle-ci : y garder la détection ignorerait à tort ces bouteilles en `same_barcode`. Le défaut tient donc au texte, qui ne dit pas que toutes les lignes du fichier sont ajoutées. L'option reste en plus cochée d'un import au suivant (axe 4, m3).
- Correction proposée : compléter le texte d'aide : « toutes les lignes du fichier sont ajoutées, sans recherche de doublons ». Ne pas changer le comportement.
- Preuve : fichier des bouteilles de l'export d'une cave réimporté dans cette cave en `dryRun` : sans l'option `0 imported, 8 already in the cellar`, avec `8 imported, 0 already`.
- Vérification : Confirmé, corrigé (Majeur → Mineur : comportement voulu et hérité, `git show 6ff01d09^:src/lib/server/features/backup/csv-import.ts` l. 1387-1409 ; la correction « appeler `duplicate()` quelle que soit l'option » casserait l'usage de l'option, seule la correction du texte est gardée).

**m8. Noms des référentiels : l'API distingue la casse, l'import CSV non**
- Où : `src/lib/server/features/shared/lookup-crud.ts:88-93` (`eq(nameColumn, fields.name)`) ; `csv-import/referenceIndex.ts:8-11` (`normalized`, sans casse).
- Scénario : dans le dialogue d'ajout de l'admin (`components/admin/EntityFormDialog.svelte:57`) ou par un script, créer « france » alors que « France » existe → 201, deux pays. Une cave reconstruite depuis l'export perd ensuite « france » (ligne ignorée en `same_name`). Le formulaire de vin n'est pas touché : `SearchableSelect.svelte:87-88,98-103` choisit l'entrée existante sans tenir compte de la casse. Attendu : la règle de la décision API-03 (« POST d'un nom existant renvoie la ligne existante ») appliquée sans tenir compte de la casse, comme l'import.
- Correction proposée : comparer avec `lower(trim(name))` dans `findOrCreate`. Un index unique `COLLATE NOCASE` demanderait une migration qui fusionne d'abord les doublons existants.
- Preuve : `POST /api/countries {"name":"France"}` → 200 ; `{"name":"france"}` → 201.
- Vérification : Confirmé, corrigé (le scénario du formulaire de vin est réfuté ; le doublon passe par l'admin et les scripts).

**m9. Le rapport de l'import CSV liste chaque ligne ignorée : 500 après écriture sur un gros fichier**
- Où : `src/lib/server/features/csv-import/pipeline.ts:40-53` (`fileReport` renvoie `skipped` et `errors` en entier) ; `src/routes/api/admin/import-csv/+server.ts:19` (`Response.json` après la transaction) ; `components/admin/dialogs/CsvImportResultsDialog.svelte:227` (tous les numéros de ligne joints dans le DOM).
- Scénario : un CSV de 30 Mo, sous la limite de 50 Mo, fait de lignes déjà en cave → la transaction est validée, puis `Response.json` échoue (`RangeError: Invalid string length`) → l'utilisateur reçoit 500 « Internal server error » alors que l'import a écrit ses lignes. Le serveur a monté à plus de 3 Go pendant l'essai. Attendu : un rapport borné, et un statut qui dit ce qui a été écrit. Sans effet sur une vraie cave (quelques milliers de lignes), d'où Mineur.
- Correction proposée : au-delà d'un seuil (par exemple 1 000 lignes), renvoyer seulement le nombre de lignes ignorées ou en erreur, avec les premières.
- Preuve : test Vitest jetable dans une worktree du rédacteur, `POST /api/admin/import-csv` avec `countries.csv` : 3 Mo (1 000 000 lignes « Zz ») → 200, réponse de 56,9 Mo (×19), RSS 853 Mo ; 30 Mo (10 000 000 lignes) → 500 `internal_error`, log `RangeError: Invalid string length`, RSS de pointe 3,8 Go, et la ligne « Zz » présente en base après la réponse.
- Vérification : signalé par a3b, vérifié par le rédacteur (reproduit ; la conséquence « 500 après écriture » est un ajout du rédacteur).

**m10. L'erreur d'un `imageName` invalide est signalée sur une colonne `filename` que le fichier n'a pas**
- Où : `src/lib/server/features/csv-import/pipeline.ts:102-105` (la ligne d'image créée renvoie les problèmes de la table `wineImages`).
- Scénario : `wineDefinitions.csv` avec `imageName` `../x.png` → « Valeur non valide pour filename ». Attendu : la colonne du fichier, `imageName`.
- Correction proposée : dans `referencedIds`, renommer la colonne en `reference.csvColumn` avant de renvoyer les problèmes.
- Preuve : `{"row":1,"problems":[{"code":"invalid","column":"filename"}]}`.
- Vérification : Confirmé.

**m11. Import d'images en zip : contenu non vérifié, BMP accepté et servi, entrées homonymes écrasées**
- Où : `src/lib/server/features/images/service.ts:224` (`.bmp` dans `IMAGE_EXTENSIONS`), `:260-284` (copie sans `detectImageType` ; `path.basename` confond `images/a.png` et `sub/a.png`) ; `src/routes/uploads/[...path]/+server.ts:35-37` (`.bmp` servi en `image/bmp`) ; `shared/imported-rows.ts:39-41` (un `imageName` du CSV peut porter n'importe quelle extension).
- Scénario : un zip d'« images » qui n'en sont pas, ou un `.bmp`, est accepté et donne des images cassées dans les fiches ; deux entrées de même nom donnent deux « success », la seconde écrase la première. La décision SEC-06 dit « Seuls JPEG, PNG, WebP et GIF sont acceptés, reconnus par leur contenu », ce que respectent l'envoi direct (fichier SVG annoncé `image/png` → 422) et la restauration (`backup/restore.ts:131-140`). La route `/uploads` garde une branche `bmp` que la décision exclut. Pas de faille : `nosniff` et un type fixé par l'extension empêchent l'exécution.
- Correction proposée : passer chaque entrée par `detectImageType` avant la copie ; retirer `.bmp` d'`IMAGE_EXTENSIONS` et de la route `/uploads` ; signaler une entrée dont le nom a déjà été copié.
- Preuve : `fake.zip` avec `images/<nom en base>.png` (du HTML), `images/other.bmp` et `sub/a/<même nom>.png` → `2 successful` pour le même fichier, le HTML copié puis servi en `image/png` ; un CSV de vins avec `imageName` `evil.svg` crée la ligne d'image `evil.svg`. Route `/uploads` relue par le rédacteur : `case 'bmp': contentType = 'image/bmp'` (`:35-37`).
- Vérification : Confirmé (partie `/uploads` signalée par a7b, a2a et a2b, vérifiée par le rédacteur).

**m12. `download-images` fait planter le serveur si une image ne peut pas être ouverte**
- Où : `src/lib/server/features/images/service.ts:332-334` (`archive.append(createReadStream(imagePath), …)` après un `stat`, sans écouteur `error` sur le flux) ; `archive.finalize()` (`:348`) non attendu.
- Scénario : une image devient illisible après le démarrage (droits changés sur le partage du NAS), ou disparaît entre le `stat` et l'ouverture → un admin télécharge la sélection d'images → tout Cellar s'arrête. Attendu : un 500, ou l'image sautée avec un avertissement, comme pour la sauvegarde (`archive.ts:73-82`).
- Correction proposée : `archive.file(imagePath, { name })`, géré par l'écouteur `error` de l'archive comme dans `archive.ts:88`, et un `.catch` sur `finalize()`. À faire avec R3-m15 / DATA-05/Reste-3 (zip en mémoire).
- Preuve : `chmod 000` sur une image, puis POST `/api/admin/download-images` avec son id → `curl` HTTP 000, processus terminé : `Error: EACCES … Emitted 'error' event on ReadStream instance`. Avec la même image, `create-backup` et `wipe-database` répondent 500 et le serveur reste debout.
- Vérification : Confirmé. Mineur : il faut une session et une image illisible, et Docker relance le conteneur.

**m13. Renommer une image : 500 sur un nom long, extension libre**
- Où : `src/routes/api/admin/images/+server.ts:17` (`newFilename: z.string().min(1)`, sans maximum) ; `features/images/service.ts:70-90`.
- Scénario : un nom de plus de 255 octets → 500 au lieu d'un 422. Renommer en `label.txt` est accepté : le fichier est ensuite servi en `application/octet-stream`. L'image reste affichée dans les fiches (le navigateur reconnaît le contenu), mais l'extension ne correspond plus au type.
- Correction proposée : limiter le nom à 255 octets en UTF-8, et garder l'extension d'origine ou exiger une extension d'image. À faire avec R3-m12 (ordre du renommage).
- Preuve : nom de 304 caractères → 500 `internal_error`, `ENAMETOOLONG … syscall: 'rename'` ; `label.txt` → 200, puis `GET /uploads/wines/label.txt` → `content-type: application/octet-stream`.
- Vérification : Confirmé, corrigé (réfuté : « l'image ne s'affiche plus dans les fiches » ; capture Chromium d'une fiche dont l'image a été renommée en `.txt` : elle s'affiche).

**m14. Taille maximale d'une image : 20 Mo dans le formulaire de vin, 10 Mo dans l'admin**
- Où : `src/lib/shared/images.ts:2` (`MAX_WINE_IMAGE_BYTES`, 20 Mo) ; `features/images/service.ts:181,191` (`MAX_ADMIN_IMAGE_SIZE`, 10 Mo).
- Scénario : une photo de 15 Mo passe par le formulaire de vin et est refusée par la page des images de l'admin.
- Correction proposée : une seule constante, `MAX_WINE_IMAGE_BYTES`, pour les deux routes.
- Preuve : JPEG de 15 Mo vers `/api/admin/upload-image` → `failed: [{ error: "Image file too large (max 10MB)" }]`.
- Vérification : Confirmé.

**m15. La recherche d'images de l'admin ne trouve rien par le nom d'origine**
- Où : `src/lib/server/upload.ts:33-35` (`newImageFileName` : `wine-<uuid>.<ext>`) ; `src/lib/db/schema.ts:58-64` (aucune colonne pour le nom d'origine) ; `src/lib/components/admin/image-selection.svelte.ts:23-26` (filtre sur `filename` seulement) ; `features/images/service.ts:45-59` (la liste ne donne pas les vins qui utilisent l'image).
- Scénario : l'utilisateur envoie `chateau-margaux-2015.jpg`, puis cherche « margaux » dans la page des images → aucun résultat ; toutes les images s'appellent `wine-<uuid>`, et la page ne montre pas le vin de chaque image. Seules les images renommées à la main se retrouvent. Ce n'est pas une régression : les noms sont aléatoires depuis 0.3.0 au moins (`git grep` à v0.3.0 : `wine-${nanoid()}`).
- Correction proposée : renvoyer avec chaque image le nom des vins qui l'utilisent (`winesUsingImages` existe) et chercher aussi dans ces noms. La règle de la décision BUG-12 (la recherche retire de la sélection ce qu'elle masque) reste valable.
- Preuve : lecture du code citée ; `originalFilename` n'existe que dans la réponse d'`uploadImages` (`service.ts:204`) et n'est stocké nulle part.
- Vérification : signalé par un autre auditeur, vérifié par le rédacteur (lecture du code et de l'historique git).

## 4. Points restés ouverts de la passe 1

- Tâche « Zip d'images en flux et robuste » :
  - R3-m15 (Partiel) : `download-images` concatène tout le zip en mémoire (`images/service.ts:342-350`) ;
  - DATA-05/Reste-3 (Non fait) : même défaut, relevé pendant API-02 ;
  - à faire avec m12 (plantage sur une image illisible) : `writeZipWithImages` d'`archive.ts` sait déjà écrire en flux et gérer les erreurs.
- Tâche « Nettoyage des fichiers temporaires au démarrage » :
  - DATA-05/Reste-1 (Non fait) : `temp-restore-*`, `temp-extract-*`, `temp-import-*`, `temp-extract-import-*`, `temp-zip-import-*` et `cellar.db.restore` restent après un arrêt brutal ; étendre `removePartialBackups` à ces noms, et ajouter `data/temp-*/` à `.gitignore`.
- Tâche « Import JSON : erreurs et images sous le verrou » :
  - R3-m16 (Partiel) : une erreur disque devient 422 `invalid_export` avec le chemin du serveur ; n'attraper que `InvalidZipError`, l'erreur de `JSON.parse` et les deux erreurs « no JSON / no data » ;
  - DATA-05/Reste-4 (Non fait) : `copyImages` après `holdWrites` (`json-import.ts:170-176`, `service.ts:283-309`).
- Tâche « Renommage d'image » :
  - R3-m12 (Partiel) : `rename` du fichier avant l'UPDATE, sans retour arrière (`images/service.ts:88-90`) ;
  - à faire avec m13 (500 sur un nom long, extension libre).
- Tâche « Import CSV : rapprochement » :
  - API-04/Reste-1 (Non fait) : régions, appellations et cases rapprochées par leur nom seul, la première l'emporte (`referenceIndex.ts:46-53`) ;
  - API-04/Reste-2 (Non fait) : un CSV aux lignes de longueurs différentes échoue en entier ;
  - à faire avec M3 (type absent de la clé d'un vin).

## 5. Constats écartés

Aucun constat n'est réfuté en entier. Parties écartées :
- R3-M8b en Écart décidé (auditeur a3b) : SEC-06 demandait le contrôle de `Content-Length` avant `formData()`, et il est fait ; la ligne passe à Corrigé, et la mémoire employée sous la limite forme M2.
- M2, cause « `Buffer.from` fait une copie de plus » : réfutée, `Buffer.from(arrayBuffer)` partage la mémoire (`b.buffer === ab`).
- m7, correction « appeler `duplicate()` quelle que soit l'option » et sévérité Majeur : écartées, l'option est voulue pour des fichiers d'une autre cave ; seul le texte d'aide est en défaut.
- m8, scénario « l'utilisateur tape « bordeaux » dans le formulaire de vin » : réfuté, `SearchableSelect` choisit l'entrée existante sans tenir compte de la casse.
- m13, « l'image ne s'affiche plus dans les fiches » : réfuté par une capture Chromium.
- m6, « sauvegardes automatiques d'avant 0.6.0 » (point signalé) : aucune version n'a écrit ces noms ; le constat est gardé sous sa vraie forme, des sauvegardes manuelles nommées « auto ».

## 6. Renvois

- Restauration depuis la liste par aller-retour dans le navigateur (UI-07/Reste-3, Non fait) : la ligne est à l'axe 4, la conséquence grave est M1 ici.
- Limite de 50 caractères du nom de sauvegarde côté client : voir axe 4, m5 (ici m5 pour le 500 du serveur).
- Option « Remplacer tous les codes-barres » restée cochée d'un import au suivant : voir axe 4, m3 (lié à m7).
- Sauvegardes de sécurité listées comme « Sauvegarde manuelle » : voir axe 4, m6 (classement des fichiers par nom, comme m6 ici).
- Endpoints sans appelant (`GET /api/images`, branche `image` d'`upload-image`, GET admin des vins, des bouteilles et des préréglages, GET de 7 référentiels sur 8) : voir axe 2, liste unique des routes.
- Préréglages d'étiquettes livrés refusés par le PDF (Brother DK-22210, Dymo 30320, Zebra 2x1, Generic 40x25, Generic 50x30 : `scripts/data/label_presets.csv:13,16,20,24,25`) : voir axe 6. L'axe 3 n'en garde que ceci : `POST /api/admin/label-presets` enregistre une mise en page que le PDF refuse (QR de 8 × 8 mm → 201, puis `POST /api/barcode/pdf-labels` → 422 `qr_size_below_minimum`), car `features/labels/service.ts:30-39` n'appelle pas `checkLabelLayout`.
- `POST /api/bottles` donne un code-barres automatique à une bouteille bue, alors que l'import ne le fait pas (décision API-04) : voir axe 2.
- Image envoyée puis abandonnée, fichier orphelin : voir axe 5 (lié à m2).
- Tests manquants de l'import zip d'images et de `/uploads` : voir axe 7.
- API-02 « Trouvé pendant DATA-05 » (retenue des écritures pendant l'import JSON, `download-backup` en flux) : vérifié Corrigé en passant ici ; les lignes sont à l'axe 2.
- R3-C0 (authentification et CSRF) : voir axe 2. R3-M9 (vingt connexions SQLite) : voir axe 1.
