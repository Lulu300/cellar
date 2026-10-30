# Vérification d’avant 1.0, axe 3 : API d’administration

Commit revu `cf48032d` (develop, 1.0.0-rc.1, 2026-10-29). Périmètre : `src/routes/api/admin/**`, les référentiels `/api/<table>`, la route `/uploads`, les domaines `features/backup`, `features/csv-import`, `features/images`, `features/shared/lookup-crud.ts`, et les tâches P7–P11 de l’axe : DATA-08, BUG-15, BUG-18, DATA-12, DATA-13, API-08. Méthode : le rapport de l’auditeur (`$A/rapport-axe-3.md`) a été repris ligne par ligne par un vérificateur qui ne l’avait pas écrit, sur sa propre instance : un worktree détaché à `cf48032d`, `pnpm build`, deux serveurs (`node server.js`, `BODY_SIZE_LIMIT=512M`, `NODE_ENV=production`, ports 4535 et 4536) avec d’autres données inventées que celles de l’auditeur, et des scripts écrits à part (`$V/scripts/`). Ce qui a été exécuté : le cycle sauvegarde → effacement → restauration par nom puis par envoi, avec une sauvegarde marquée 0.8.0 en mode cron ; 12 zips piégés ou invalides (37 cas sur la restauration par envoi et par nom, l’import JSON et l’import d’images), base comparée par une empreinte de toutes ses tables ; une sauvegarde de 572 Mio (600 242 031 octets) restaurée par son nom ; la mémoire (RSS) pour des corps de 200 Mo, sur serveur chaud et sur serveurs neufs, avec des corps témoins de 0,3 et 20 Mo ; l’import CSV de vins jumeaux par le type, la note et la description, en un import et en deux ; le jeton cron ; le 413 lu dans `Content-Length` ; les noms de sauvegarde ; les images (contenu, taille, renommage, zip, fichier illisible) ; les référentiels ; l’import CSV (colonne de trop, 20 000 lignes sautées, essai à blanc, 2 000 bouteilles) ; 56 726 écritures pendant un effacement ; un `kill -9` pendant une restauration. Chaque verdict autre que « fait », chaque « fait » issu d’un Critique, d’un Majeur, d’un contrôle de sécurité ou d’un critère, plus de la moitié des autres « fait », et chaque constat ont été rejoués. Les portes complètes sont celles du lead (`$S/p12/gates/summary.txt` : toutes à 0, lint sans avertissement).

Notations : `$S` = `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214/scratchpad`, `$A` = `$S/p12/a3` (preuves de l’auditeur), `$V` = `$S/p12/v3` (preuves du vérificateur). Les `fichier:ligne` sont ceux de `cf48032d` ; `features/…` veut dire `src/lib/server/features/…`.

## 1. Résumé

- **Régressions** :
  - API-04, critère de taille seulement : l’import CSV compte 914 lignes hors tests (936 avec la détection de table sortie dans `src/lib/shared/csv-import.ts` par API-08), au-dessus des 700 du critère depuis 1a7204ed (BUG-15, P7). Le comportement tient : 2 200 lignes en 318 ms, tests aller-retour. Aucune décision ne relève la limite (voir Désaccords).
  - V3-m2 : `docs/API.md:1901` dit que la restauration laisse les autres fichiers d’images ; depuis 857acda9 (DATA-12), elle les supprime, ce que dit `:1916`.
- Verdicts, 166 lignes en tout :
  - traçabilité de l’audit, 100 lignes : 96 fait, 1 fait autrement, 1 régressé, 2 sans objet ;
  - constats de l’audit (a3 M1 à M3, m1 à m15) : 18 fait ;
  - points restés ouverts de l’audit, 11 éléments : 11 fait ;
  - tâches P7–P11 : 6 critères fait ; 31 points « Trouvé pendant », « Reste » et décisions : 10 fait, 3 fait autrement, 18 pas fait (tous des points ouverts listés dans la feuille de route) ;
  - total : **141 fait, 4 fait autrement, 18 pas fait, 1 régressé, 2 sans objet, 0 partiel**.
- Constats nouveaux : **0 Critique, 0 Majeur, 2 Mineurs** (V3-m1, V3-m2). V3-m3 de l’auditeur est fondu dans la ligne API-04.
- Essais rejoués, tous concluants :
  - cycle par nom puis par envoi : vins, bouteilles, codes-barres, lignes et fichiers d’images (SHA-1 identiques), réglages des codes-barres, réglage de session, préréglage d’étiquettes revenus ; réglages des sauvegardes automatiques (cron/12/5) et jeton de l’instance gardés ; compteur au plus grand des deux (`VER0000009`, la sauvegarde avait `…07`) ; sauvegarde marquée 0.8.0 en cron/48 restaurée sur une instance interne/24/7 → interne/24/7, actions 0.9.0 et 0.11.0 ajoutées avec `mayBeDone: true` (`$V/cycle.log`) ;
  - 37 refus (422, ou 409 pour la version future), base, `data/` et images inchangés, rien écrit hors du dossier, session 200 ensuite, aucun fichier temporaire ; dans une vraie sauvegarde, HTML en `.png`, BMP, sous-dossier et fichier caché non restaurés (`$V/traps.log`) ;
  - sauvegarde de 572 Mio : envoi → 413, restauration par nom → 200 en 1,9 s, RSS +47 Mio, 30 images aux mêmes empreintes (`$V/large.log`) ;
  - restauration en corps brut sur serveurs neufs : +41 et +59 Mio pour 191 Mio, autant qu’une sauvegarde de 0,3 Mio (+33 et +47 Mio) ; import d’un zip d’images de 191 Mio : +471 à +914 Mio (V3-m1) (`$V/memory-fresh.log`, `$V/memory.log`) ;
  - jumeaux par le type : 2 et 3 bouteilles rattachées ; par la note ou la description : 6 bouteilles `several_wines`, en un import comme en deux (`$V/csv-twins.log`).

## 2. Traçabilité (passe 1)

### Revue 3

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R3-C1a | `import-json` vide puis réinsère sans transaction | Corrigé | fait | `features/backup/repository.ts:56-` (`replaceCellar` dans `db.transaction`) ; test `import-json/server.test.ts` « changes nothing, images included, when a row cannot be inserted » ; rejoué : 7 zips piégés sur l’import JSON → 422, base inchangée (`$V/traps.log`) |
| R3-C1b | Les exports automatiques omettent 5 tables | Corrigé | fait | `scheduler.ts:86` → `createExportZip` (`export.ts:24-38,49`) ; `json-import.ts:117-122` (422 `incomplete`) ; test `import-json/server.test.ts:488` (lecture) |
| R3-C1c | La sauvegarde « pre-import » repasse par le chemin fragile | Corrigé | fait | `json-import.ts:178-181` (`backUpThenReplace` puis `copyImages` dans `holdWrites`) ; rejoué : 3 imports JSON de 200 Mo → 200 (`$V/memory.log`) ; essai par nom de l’auditeur (`$A/misc.log`) |
| R3-C1d | Images copiées avant toute validation | Corrigé | fait | `json-import.ts:177-182` ; `restore.ts:134-148` ; rejoué : `bad-images.zip`, log « Not restored … images/evil.png », « … images/x.bmp » (`$V/traps.log`) |
| R3-C2a | `copyFile` par-dessus la base ouverte | Corrigé | fait | `db/index.ts:59-97` ; rejoué : restaurations sur le serveur en marche, sans redémarrage, session gardée (`$V/cycle.log`) |
| R3-C2b | Aucune validation du fichier reçu | Corrigé | fait | `restore.ts:64-102`, `upgrade.ts:234-260` ; rejoué : `not-sqlite`, `not-cellar`, `corrupt-db` (`damaged`), `no-migrations`, `future` (409), zip tronqué, octets aléatoires → refusés, empreinte de la base inchangée (`$V/traps.log`) |
| R3-C2c | Migrations pas relancées après restauration | Corrigé | fait | `db/index.ts:74` ; test `restore/upgrade.test.ts:116` ; rejoué : sauvegarde marquée 0.8.0 restaurée, version de l’instance posée, actions ajoutées (`$V/cycle.log`) |
| R3-C2d | La restauration continue si la sauvegarde préalable échoue | Corrigé | fait | `features/backup/service.ts:304-310` (500 `pre_restore_backup_failed`) ; test `pre-restore-backup.test.ts` « restores nothing, and keeps an earlier backup… » |
| R3-C2e | Base remplacée avant les images ; 500 si leur copie échoue | Corrigé | fait | `service.ts:326-327` ; test `restore/server.test.ts` « keeps the restored database when its images cannot be copied… » |
| R3-M1 | Un zip piégé fait planter le process | Corrigé | fait | test `zip.test.ts:91` (`images/../../x`, `/tmp/x`) ; rejoué : `slip.zip`, `abs.zip` sur 4 routes → 422, ni `slip-v3.png` ni `/tmp/abs-v3.png` écrits, session 200 (`$V/traps.log`) |
| R3-M2a | Le .db est zippé à chaud | Corrigé | fait | `archive.ts:25-27` (`VACUUM INTO`) ; test `archive.test.ts` « createBackupZip while another program writes » |
| R3-M2b | Logique d’archive copiée 6 fois | Corrigé | fait | Un seul écrivain de zip dans `features/backup` (`archive.ts:33-113`) ; celui de `images/service.ts:381-404` est un point « Trouvé pendant DATA-13 », déjà connu |
| R3-M3a | `setTimeout` armé à la première requête | Corrigé | fait | `hooks.server.ts` (`reschedule()` dans `init`) ; chaque démarrage logue « 📅 Next automatic backup » avant « Listening » (`$V/run-B/server.log`) ; sauvegarde en retard de l’auditeur (`$A/overdue-backup.log`) |
| R3-M3b | PUT `backup-settings` ne replanifie rien | Corrigé | fait | `service.ts:84-93` ; test `scheduler.test.ts` « applies a new interval at once, without a restart » |
| R3-M3c | Rétention commune | Corrigé | fait | `files.ts:138-151` ; rejoué : mode cron, garder 2, 4 passages → 2 sauvegardes et 2 exports `auto-cron` (`$V/checks.log`) |
| R3-M3d | POST `auto-backup` non authentifié | Corrigé | fait | `token.ts:31-41`, `hooks.server.ts:117` ; rejoué : bon jeton 200 (`bearer` aussi), mauvais, ancien, absent, GET, autre route (effacement) → 401 ; mode interne → 409 `cron_backups_disabled` (`$V/checks.log`) |
| R3-M4a | `cleanup-csv` | Sans objet | sans objet | Absente des 23 routes de `src/routes/api/admin/` |
| R3-M4b | `export-csv` : `customName` non filtré | Corrigé | fait | `exportCsvTables` (`resolveInDir`, `fitsNameLimit`), rien écrit sur le serveur ; rejoué : `a/b` et 76 « é » → 422 (`$V/checks.log`) |
| R3-M4c | Contrôle par sous-chaîne des noms de sauvegarde | Corrigé | fait | `files.ts:28,95-97` ; rejoué : `../cellar.db`, `cellar.db`, `cellar-backup-../../x.zip`, `cellar-backup-x/../../cellar.db` → 422 au téléchargement, à la suppression et à la restauration par nom (`$V/checks.log`) |
| R3-M5a | Imports qui recopient `path` et `filename` | Corrigé | fait | `shared/imported-rows.ts:38-40` (nom seul, `path` forcé) ; rejoué : `imageName` `../x.png` → `invalid` (`$V/checks3.log`) |
| R3-M5b | `images` DELETE : `path.join` | Corrigé | fait | `images/service.ts:196-201` (`resolveInDir`) |
| R3-M5c | `download-images` lit `./static/<path>` | Corrigé | fait | `images/service.ts:419-421` (chemin stocké ignoré) |
| R3-M6a | Clé de dédoublonnage différente | Corrigé | fait | Une seule clé, type compris (`referenceIndex.ts:10-17,32-34`) ; rejoué (`$V/csv-twins.log`) |
| R3-M6b | L’export n’a pas `regionName` | Corrigé | fait | En-tête réel des vins chez l’auditeur (`$A/csv-export/`) ; lecture |
| R3-M6c | Import interrompu = données partielles | Corrigé | fait | `csv-import/service.ts:72-84` ; test `import-csv/server.test.ts` « imports nothing from any of the files when a row cannot be inserted » |
| R3-M7a | Définitions rechargées par bouteille | Corrigé | fait | `referenceIndex.ts:61-73` ; rejoué : 200 vins et 2 000 bouteilles en 318 ms (`$V/misc.log`) |
| R3-M7b | Bouteilles de la case rechargées | Corrigé | fait | `bottles.ts:57,67,118-121` ; même essai |
| R3-M7c | Une requête par code-barres | Corrigé | fait | `bottles.ts:58` (`Set`) ; même essai |
| R3-M7d | 146 `console` | Corrigé | fait | 0 `console.` dans `csv-import/` hors tests (auditeur) ; même essai |
| R3-M8a | `BODY_SIZE_LIMIT` à 10 Go | Écart décidé | fait autrement | Décision « Taille des requêtes (SEC-07) » : 512 Mo, `Dockerfile:77` |
| R3-M8b | Fichier chargé avant le contrôle de taille | Corrigé | fait | `http/body.ts:19-21,31-51,106-114` ; rejoué : `Content-Length` de 501 Mio sans corps → 413 en 0 à 1 ms sur restauration, import JSON, import d’images et import CSV ; 501 Mio sans `Content-Length` → 413, aucun `temp-*` (`$V/checks.log`) |
| R3-M8c | `import-images-zip` sans limite ni protection | Corrigé | fait | `zip.ts:11,14,18` ; rejoué : bombe (2,6 Mo, 2,19 Gio décompressés) et zip de 10 001 entrées → 422 sur 4 routes (`$V/traps.log`) |
| R3-M8d | Zip rouvert pour chaque image | Corrigé | fait | `images/service.ts:299-313` (une extraction) |
| R3-M10a | `wipe-database` non transactionnel | Corrigé | fait | `repository.ts:30-38` ; test `wipe-database/server.test.ts` « changes nothing when the default data cannot be inserted again » |
| R3-M10b | Deux zips dont un faux « export » | Corrigé | fait | `service.ts:380-414` ; rejoué : un seul `cellar-backup-pre-reset-…` par effacement (`$V/cycle.log`) |
| R3-M11 | `restore-label-presets` | Sans objet | sans objet | Route absente |
| R3-m1 | `admin/test/` vide | Corrigé | fait | Absent de la liste des routes |
| R3-m2 | Routes sans appelant | Corrigé | fait | Ni `seed-manufacturer-presets` ni `restore-label-presets` dans la liste des routes |
| R3-m3 | `hasWineBottlesFile` | Corrigé | fait | `grep` vide (auditeur) |
| R3-m4 | `extractZipToTemp` | Corrigé | fait | `images/service.ts:299-313` passe par `extractZip` |
| R3-m5 | Imports de schéma inutilisés | Corrigé | fait | `restore/+server.ts` : 12 lignes, imports utilisés ; lint sans avertissement (`$S/p12/gates/2-lint.log`) |
| R3-m6 | `generateId()` sur `Math.random` | Corrigé | fait | `randomUUID` (`pipeline.ts:178`, `upload.ts:51`, auditeur) |
| R3-m7 | Détection de la table par sous-chaîne | Corrigé | fait | `src/lib/shared/csv-import.ts:7-22` (la table qui finit le plus loin ; déplacée là par 1b71f74a, API-08) |
| R3-m8 | PUT `success` sur un id inconnu | Corrigé | fait | Rejoué : `PUT /api/countries/nope` → 404 (`$V/checks2.log`) |
| R3-m9 | DELETE 400 au lieu de 409 | Corrigé | fait | Rejoué : DELETE France → 409 `in_use` (19 régions) (`$V/checks2.log`) |
| R3-m10 | Pas de limite de longueur | Corrigé | fait | Rejoué : 501 caractères → 422 (`$V/checks2.log`) |
| R3-m11 | POST en double | Corrigé | fait | Rejoué : `GET /api/admin/countries` → 404 ; `/api/countries` répond (`$V/checks2.log`) |
| R3-m12 | `images` PUT : fichier renommé avant la DB | Partiel | fait | `images/service.ts:153-159` (ligne puis fichier dans une transaction) ; rejoué : fichier et ligne renommés ensemble (`$V/checks2.log`) |
| R3-m13 | Fichiers temporaires de `import-json` | Corrigé | fait | `json-import.ts:193-196` ; rejoué : aucun `temp-*` après les 37 refus (`$V/traps.log`) |
| R3-m14 | `download-backup` en mémoire | Corrigé | fait | `service.ts:166-176` (flux) ; rejoué : 42 007 026 octets reçus, égal à la taille du fichier (`$V/misc.log`) ; pic de 187 Mio pour 629 Mo chez l’auditeur (`$A/download-rss.log`) |
| R3-m15 | `download-images` bufferise le zip | Partiel | fait | `images/service.ts:412-464` ; rejoué : 3 images → 200 `application/zip`, `Content-Length` 41 954 334 (`$V/checks2.log`) |
| R3-m16 | Fuite d’informations dans les erreurs | Partiel | fait | `json-import.ts:55-84` : seuls un zip invalide, un JSON illisible ou sans `data` donnent 422 ; une erreur disque reste 500 ; `data/` en lecture seule chez l’auditeur (`$A/readonly-data.log`) |
| R3-m17 | Horodatage à la minute | Corrigé | fait | `archive.ts:15-17` ; noms à la milliseconde (`…T22-31-23-406.zip`, `$V/cycle.log`) |
| R3-Refacto-2 | Découper `import-csv` | Corrigé | fait | `features/csv-import/` (6 fichiers) ; rejoué : essai à blanc, base inchangée (`$V/checks2.log`). Taille : voir API-04 |
| R3-Refacto-3 | Fabrique CRUD générique | Corrigé | fait | `shared/lookup-crud.ts` ; rejoué : casse, 404, 409, 422, 401 (`$V/checks2.log`) |

### Revue 2 (M8)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R2-M8a | Migrations à la première requête | Corrigé | fait | `hooks.server.ts:33-58` (`process.exit(1)`) ; voir aussi l’axe 1 |
| R2-M8b | Plusieurs `scheduleNextBackup` | Corrigé | fait | `scheduler.ts:98-143` (un timer, drapeau `running`) |
| R2-M8c | Trois connexions SQLite dans le hook | Corrigé | fait | Aucune connexion ouverte dans `hooks.server.ts` |
| R2-M8d | `scheduleNextBackup` non exporté | Corrigé | fait | `reschedule` exporté, appelé par `saveBackupSettings` ; la restauration garde les réglages de l’instance (décision « Restauration »), rejoué (`$V/cycle.log`) |
| R2-M8e | Archiver copié 5 fois | Corrigé | fait | Voir R3-M2b |

### DATA-05

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DATA-05 | Restaurer sans redémarrer ; sauvegarde pendant des écritures ; fréquence appliquée | Corrigé | fait | Rejoué (`$V/cycle.log`) ; test `archive.test.ts` « createBackupZip while another program writes » ; `service.ts:92` |
| Trouvé-1 | Sauvegarde préalable avant la validation | Corrigé | fait | Rejoué : liste de `data/` inchangée après les 37 refus, donc aucun `pre-restore` (`$V/traps.log`) |
| Trouvé-2 | Zip sans `cellar.db` → 500 | Corrigé | fait | Rejoué : `no-db.zip` → 422 `no_database` (`$V/traps.log`) |
| Trouvé-3 | Horodatage à la minute | Corrigé | fait | `archive.ts:15-17` ; test `pre-restore-backup.test.ts:77` |
| Trouvé-4 | Sous-dossier de `images/` → EISDIR | Corrigé | fait | Rejoué : `images/sub/deep.png` ignoré, restauration 200 (`$V/traps.log`) |
| Trouvé-5 | Images copiées sans vérifier le type | Corrigé | fait | Rejoué : HTML en `.png` et BMP « Not restored » (`$V/traps.log`) |
| Trouvé-6 | Fichiers cachés dans les sauvegardes | Corrigé | fait | `archive.ts:119-128` ; rejoué : `images/.hidden.png` non restauré |
| Trouvé-7 | `resolveBackupFile` en double | Corrigé | fait | `files.ts:95-97` seul |
| Trouvé-8 | Échec après la copie → serveur en 500 | Corrigé | fait | `db/index.ts:87-96` |
| Trouvé-9 | Erreur d’écriture du zip → processus tué | Corrigé | fait | `archive.ts:69-113` ; rejoué : `download-images` d’une image illisible → 500, serveur vivant (`$V/checks2.log`) ; `data/` en lecture seule chez l’auditeur |
| Trouvé-10 | `docker stop` pendant une sauvegarde | Corrigé | fait | `.partial` (`archive.ts:9,70-90`) ; `leftovers.ts:12-27` |
| Trouvé-11 | Réglages sans replanification | Corrigé | fait | Voir R3-M3b |
| Trouvé-12 | Imports inutilisés dans `restore` | Corrigé | fait | `restore/+server.ts` : 12 lignes |
| Trouvé-13 | Échec de `migrateSchema()` | Corrigé | fait | `db/index.ts:72-78` |
| Trouvé-14 | Ordre testé pas à pas | Corrigé | fait | Tests `restore/*.test.ts` par POST |
| Trouvé-15 | archiver 8 et yauzl | Corrigé | fait | `package.json` : `archiver ^8.0.0`, `yauzl ^3.4.0` (auditeur) |
| Trouvé-16 | `setSetting` recopié | Corrigé | fait | `settings/repository.ts` |
| Trouvé-17 | `import-json` sans test | Corrigé | fait | 17 tests dans `import-json/server.test.ts` |
| Trouvé-18 | `no-async-promise-executor` | Corrigé | fait | `grep` vide (auditeur) ; lint à 0 |
| Trouvé-19 | Variables jamais lues dans le hook | Corrigé | fait | `hooks.server.ts` réécrit |
| Trouvé-20 | `Content-Type` du cron | Corrigé | fait | `README-Docker.md:490,498` (commande avec l’en-tête) ; sans `Origin` ni `Content-Type`, comme `curl` → 403 (`$A/cron.log`) ; avec l’`Origin` du serveur et sans corps → 200 (`$V/checks.log`) : le refus vient du contrôle de SvelteKit sur une requête sans `Origin` (`csrf.ts:9-17`), ce que le README couvre |
| Reste-1 | Fichiers temporaires après un arrêt brutal | Non fait | fait | Rejoué : `kill -9` pendant la restauration par nom de 572 Mio → `temp-extract-…` (75 Mo) laissé, retiré au redémarrage (`$V/kill9.log`) ; `leftovers.ts:12-27` |
| Reste-2 | `docker stop` attend 10 s | Corrigé | fait | `scheduler.ts:128` (`unref`) |
| Reste-3 | `download-images` en mémoire | Non fait | fait | Voir R3-m15 |
| Reste-4 | Images de l’import JSON hors du verrou | Non fait | fait | `json-import.ts:179-182` (`copyImages` dans `holdWrites`) |

### BUG-10

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-10 | Sauvegarde « Cœur de cave € 🍷 » téléchargée et restaurée | Corrigé | fait | Rejoué : créée 201, `download-backup` 200 avec `filename*=UTF-8''cellar-backup-C%C5%93ur%20de%20cave%20%E2%82%AC%20%F0%9F%8D%B7-…`, restaurée par nom 200 ; `?file=` → 422 (`$V/misc.log`, `$V/checks.log`) |

### API-03

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| API-03 | 8 référentiels par la même fabrique | Corrigé | fait | `lookup-crud.test.ts` ; rejoué : POST existant 200, casse ignorée, 404, 409, 422, 401 (`$V/checks2.log`) |
| API-03/Trouvé-1 | Vérification puis suppression | Corrigé | fait | `lookup-crud.ts:127-143` ; test `lookup-crud.test.ts` « deleting a row that starts to be used… » |

### API-04

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| API-04 | Moins de 700 lignes ; 2 000 bouteilles en moins de 5 s ; test aller-retour | Corrigé | régressé (taille seule) | `wc -l` hors tests, même méthode que l’audit (697 retrouvées à `9df0d08c`) : 914 à `cf48032d` (bottles 128, parse 70, pipeline 298, referenceIndex 171, service 149, tables 98), 936 avec `src/lib/shared/csv-import.ts` (22 lignes, l’ancien `detect.ts` sorti du dossier par 1b71f74a). Par commit : 1a7204ed 718 (BUG-15), 84da5930 734, 026eb931 751 (BUG-18), 1b71f74a 882 et 88d7de89 887 (API-08), 9b40ee28 912 (UI-12), b4e25822 914. Le reste tient : 200 vins et 2 000 bouteilles en 318 ms (`$V/misc.log`) ; `round-trip.test.ts` (« puts the same cellar back in an empty database », « adds nothing when imported into the cellar it comes from »). Voir Désaccords |
| Trouvé-1 | `if (!cleanedData.id)` morts | Corrigé | fait | `pipeline.ts:178` |
| Trouvé-2a | Référence optionnelle non résolue | Corrigé | fait | Ligne sautée (décision « Import CSV (API-04) ») ; rejoué : `unknown_reference` « Atlantis » (`$V/checks3.log`) |
| Trouvé-2b | Normalisation recopiée | Corrigé | fait | `referenceIndex.ts:161-170` |
| Trouvé-2c | Nom d’export qui contient « regions » | Corrigé | fait | `shared/csv-import.ts:7-22` ; test `import-csv/server.test.ts` « reads the table from the end… » |
| Trouvé-2d | Export des bouteilles trop pauvre | Corrigé | fait | Rejoué : en-tête `wineName,producer,appellationName,classificationName,typeName,colorName,…,containerName,storageCaseName,…` (`$V/csv-twins.log`) |
| Reste-1 | Rapprochement par nom seul | Non fait | fait | `referenceIndex.ts:89-99`, `pipeline.ts:155-163` (parent donné par le fichier) ; rejoué : région sous un pays inconnu → `unknown_reference` (`$V/checks3.log`) |
| Reste-2 | CSV aux lignes inégales | Non fait | fait | `parse.ts:27` ; rejoué : `origins.CSV`, ligne 2 à colonne de trop → `uneven_row`, les 2 autres importées (`$V/checks2.log`) |

### BUG-09

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-09 | Exporter puis réimporter ne crée aucun doublon | Corrigé | fait | Test `round-trip.test.ts:220` ; essai `,`, `;`, tabulation de l’auditeur (`$A/misc.log`) |
| BUG-09/Trouvé-1 | Préfixe des exports CSV | Corrigé | fait | Rejoué : `cellar-export-wineDefinitions-…csv` (`$V/csv-twins.log`) |

### SEC-05

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-05 | Helper testé ; aucun chemin sans lui | Corrigé | fait | `paths.test.ts` ; rejoué : `/uploads/wines/..%2f..%2fdata%2fcellar.db`, `%2e%2e/%2e%2e/…`, `/uploads/..%2fdata/…` → 404 ; noms de sauvegarde (R3-M4c) et d’image (`a/b.png` → 422) (`$V/checks.log`, `$V/checks2.log`) |

### SEC-06

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-06 | Zip `images/../../x` refusé ; zip bomb refusé | Corrigé | fait | `zip.test.ts:91,105` ; rejoué sur 4 routes (`$V/traps.log`) ; contenu des images du zip contrôlé depuis DATA-13 (a3 m11) |

### Constats de l’audit (a3)

| Réf | Point | Sévérité audit | Verdict | Preuve |
|---|---|---|---|---|
| a3 M1 | Sauvegarde > 500 Mo non restaurable | Majeur | fait | Rejoué : 600 242 031 octets, `restorable: true`, envoi → 413, restauration par nom → 200, 30 images identiques (`$V/large.log`) ; `body.ts:125-134` |
| a3 M2 | Restaurer ou importer un zip : ×5 en mémoire | Majeur | fait | Restauration et import JSON en corps brut écrit en flux (`body.ts:31-51,125-134`). Rejoué sur serveurs neufs : restauration de 191 Mio +41 et +59 Mio, sauvegarde témoin de 0,3 Mio +33 et +47 Mio (`$V/memory-fresh.log`) ; import JSON de 191 Mio +18 à +83 Mio sur serveur chaud (`$V/memory.log`). L’auditeur disait « partiel » à cause de l’import d’un zip d’images : hors du périmètre de M2, voir Corrections et V3-m1 |
| a3 M3 | Vins fondus quand seul le type diffère | Majeur | fait | Rejoué (`$V/csv-twins.log`) ; `referenceIndex.ts:10-17` |
| a3 m1 | L’effacement ne retient pas les écritures | Mineur | fait | Rejoué : 56 726 écritures pendant un effacement de 28 s → 503 `writes_held`, `Retry-After: 10`, aucune 201 (`$V/wipe-hold.log`) ; `hooks.server.ts:24,117`, `service.ts:381` |
| a3 m2 | Fichiers d’images jamais retirés | Mineur | fait | Rejoué : 0 fichier après chaque effacement, les 3 de la sauvegarde après restauration (`$V/cycle.log`, `$V/wipe-hold.log`) ; `restore.ts:155-165` |
| a3 m3 | Restauration qui coupe les sauvegardes automatiques | Mineur | fait | Décision « Restauration (audit d’avant 1.0) » ; `service.ts:320-321` ; rejoué (`$V/cycle.log`) |
| a3 m4 | Actions de la sauvegarde jetées | Mineur | fait | Décision « Restauration » ; `upgrade.ts:234-260,272-286` ; rejoué : 0.9.0 et 0.11.0, `mayBeDone: true` (`$V/cycle.log`) |
| a3 m5 | Nom accepté → 500 | Mineur | fait | `files.ts:38-41` (150 octets) ; rejoué : 75 « é » 201, 76 → 422, 200 → 422, 37 emoji 201, 38 → 422 (`$V/checks.log`) |
| a3 m6 | Sauvegardes « auto » classées automatiques | Mineur | fait | `files.ts:30-32` ; rejoué : `manual-backup`, `safety-backup-reset`, `safety-backup-restore` (`$V/cycle.log`) |
| a3 m7 | Aide de « Remplacer tous les codes-barres » | Mineur | fait | `fr.json:562` (auditeur) |
| a3 m8 | Casse des référentiels | Mineur | fait | Rejoué : « france », « FRANCE » → 200 « France » (`$V/checks2.log`). Le PUT reste sensible à la casse : déjà connu |
| a3 m9 | Rapport de chaque ligne → 500 | Mineur | fait | Rejoué : 20 000 lignes sautées → 200, 1 000 listées (`$V/checks2.log`) |
| a3 m10 | Colonne `filename` au lieu d’`imageName` | Mineur | fait | Rejoué : `{"code":"invalid","column":"imageName"}` (`$V/checks3.log`) |
| a3 m11 | Zip d’images non vérifié, BMP | Mineur | fait | `images/service.ts:330-336` ; rejoué : BMP et faux `.jpg` → `not_an_image`, même nom deux fois → `duplicate_filename`, aucun fichier ajouté (`$V/checks3.log`) ; SVG annoncé PNG → 422, BMP refusé par l’admin (`$V/checks2.log`) |
| a3 m12 | `download-images` fait planter le serveur | Mineur | fait | Rejoué : image en `chmod 000` → 500 `image_unreadable`, session 200 ensuite (`$V/checks2.log`) |
| a3 m13 | Renommage : 500, extension libre | Mineur | fait | Rejoué : 300 caractères, `label.txt`, `a/b.png` → 422 ; « renommée é.png » → 200, servi en `image/png` avec `nosniff` (`$V/checks2.log`) |
| a3 m14 | 20 Mo / 10 Mo | Mineur | fait | Rejoué : 20 970 603 octets acceptés par `/api/upload/image` et `/api/admin/upload-image` ; 20 Mio + 1 → 413 et `failed` « max 20 MB » (`$V/checks2.log`) |
| a3 m15 | Recherche par nom d’origine | Mineur | fait | `images/service.ts:110-117`, `utils/image-search.ts:10-15` (lecture) |

### Points restés ouverts de l’audit (section 4)

| Élément | Verdict | Preuve |
|---|---|---|
| R3-m15 (zip d’images en flux) | fait | Voir R3-m15 |
| DATA-05/Reste-3 (même défaut) | fait | Voir R3-m15 |
| m12 (image illisible) | fait | Voir a3 m12 |
| DATA-05/Reste-1 (nettoyage au démarrage) | fait | `$V/kill9.log` |
| R3-m16 (erreur disque de l’import JSON) | fait | `json-import.ts:55-84` ; `$A/readonly-data.log` |
| DATA-05/Reste-4 (images sous le verrou) | fait | `json-import.ts:179-182` |
| R3-m12 (ordre du renommage) | fait | `images/service.ts:153-159` |
| m13 (nom long, extension) | fait | `$V/checks2.log` |
| API-04/Reste-1 (rapprochement par nom) | fait | `$V/checks3.log` |
| API-04/Reste-2 (lignes inégales) | fait | `$V/checks2.log` |
| M3 (type absent de la clé) | fait | `$V/csv-twins.log` |

### Tâches P7–P11 de l’axe

**DATA-08** — critère (sauvegarde de 600 Mo restaurée depuis la liste ; restauration ou import JSON de 200 Mo sous la moitié de sa taille en RSS ; échec sans changement) : **fait**. Sauvegarde de 600 242 031 octets restaurée par nom, RSS +47 Mio (`$V/large.log`) ; restauration de 191 Mio +41 à +59 Mio sur serveurs neufs, +95 Mio au plus sur un serveur dont le RSS était retombé à 58 Mio (moitié : 95,5 Mio) ; une sauvegarde témoin de 0,3 Mio coûte +33 à +47 Mio, donc la hausse ne suit pas la taille ; import JSON +18 à +83 Mio (`$V/memory-fresh.log`, `$V/memory.log`) ; 37 refus sans changement (`$V/traps.log`). La page envoie le nom pour une sauvegarde de la liste (`admin/backups/+page.svelte:150-153`).

| Trouvé / Reste | Verdict | Preuve |
|---|---|---|
| DATA-08/1 limites d’extraction sans avertissement à la création | fait | DATA-12 : `archive.ts:56-62` (`restorable`) ; `create-backup` répond `restorable: true` (`$V/large.log`) ; 10 001 fichiers → `restorable: false` chez l’auditeur (`$A/too-large.log`) |
| DATA-08/2 sauvegarde de sécurité téléchargée en `blob()` | fait | `admin/backups/+page.svelte:135-136` (`saveUrl`) |
| DATA-08/3 `readExport` : erreur disque en 422 | fait | `json-import.ts:55-84` ; `$A/readonly-data.log` |
| DATA-08/4 `download-backup?file=` | fait | API-09 ; rejoué : `?file=` → 422 (`$V/checks.log`) |
| Décision du mainteneur : pas de `NODE_OPTIONS` | fait autrement | Décision « Taille des requêtes (SEC-07) » |

**BUG-15** — critère (cave A, Champagne 2 et Mousseux 3 ; export ; cave B vide → deux vins, 2 et 3 bouteilles ; jumeaux par la note ou la description → `several_wines`) : **fait**. Cave B : Champagne 2, Mousseux 3 ; les 6 bouteilles des jumeaux par la note et par la description → `several_wines` (`$V/csv-twins.log`).

| Trouvé / Reste | Verdict | Preuve |
|---|---|---|
| BUG-15/1 ligne invalide annoncée « Déjà dans la cave » | fait | API-08 : `pipeline.ts:195-217` (validation avant la recherche) ; rejoué : vin présent avec un site « not a url » → `invalid` sur `website` (`$V/checks3.log`) |
| BUG-15/2 jumeaux en imports séparés | fait | BUG-18 ; rejoué, cave C (`$V/csv-twins.log`) |
| BUG-15/3 `regionName` qui contredit la cave → « vin inconnu » | fait autrement | Décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) » (BUG-15/3 accepté) |

**BUG-18** — critère (cave A, deux vins qui ne diffèrent que par la note ; vins puis bouteilles en deux imports dans une cave B vide → deux vins, bouteilles `several_wines`) : **fait**. Cave C : 6 vins, les bouteilles des jumeaux par la note et par la description `several_wines`, celles des jumeaux par le type rattachées (`$V/csv-twins.log`).

| Trouvé / Reste | Verdict | Preuve |
|---|---|---|
| BUG-18/1 (= BUG-15/1) | fait | Voir BUG-15/1 |

**DATA-12** — critère (cron → interne gardé, actions « peut-être déjà faites » ; écriture pendant l’effacement → 503 ; dossier d’images vide après effacement ; 200 caractères accentués → 422 ; aucun fichier temporaire après `kill -9`) : **fait**. `$V/cycle.log`, `$V/wipe-hold.log`, `$V/checks.log`, `$V/kill9.log`.

| Trouvé / Reste | Verdict | Preuve |
|---|---|---|
| « Download » de la liste en blob | pas fait | `admin/backups/+page.svelte:98-100` (`downloadBlob`) |
| Import JSON laisse les fichiers d’images de la cave remplacée | pas fait | `json-import.ts:171-197` : pas de `removeUnreferencedImages` |
| Écritures retenues n’attendent pas une sauvegarde automatique | pas fait | `scheduler.ts:132-143`, hors de `write-gate.ts` (auditeur) |
| Sauvegarde manuelle « pre-… » étiquetée de sécurité | pas fait | `files.ts:32` (`SAFETY_FILE` sur le nom) ; `$A/wipe-hold.log` |
| La restauration n’ajoute pas les actions en attente propres à la sauvegarde | pas fait | `upgrade.ts:234-260` (actions calculées depuis la version) |
| Message « illisible » qui peut finir par « .. » | pas fait | `json-import.ts:52-53` |
| Restauration qui saute les BMP depuis 0.7.0 | fait autrement | Décision « Formats d’image (SEC-06) » ; notes 0.11.0 (convertir les BMP) |
| Échec du téléchargement de la sauvegarde de sécurité invisible | pas fait | `admin/backups/+page.svelte:135-137` (`saveUrl`, puis toast de succès) |
| Script qui filtre sur `manual-backup` | fait | Le point ne demande que la documentation : `docs/API.md:1748-1751` liste `safety-backup-*` |

**DATA-13** — critère (`.bmp` et faux `.jpg` signalés sans copie ; image illisible → erreur, serveur vivant ; 300 caractères → 422 ; 20 970 603 octets depuis le formulaire et l’admin ; fermer le formulaire après le choix d’une image ne laisse aucun fichier) : **fait**. `$V/checks2.log`, `$V/checks3.log`. Dernier point, par lecture : l’image n’est envoyée qu’à l’enregistrement (`forms/WineDefinitionForm.svelte:65,74-88`, `beforeSend`), et les envois qu’aucun vin enregistré n’utilise sont supprimés à la fermeture (`forms/image-uploads.ts:42-62`, `WineDefinitionForm.svelte:60`) ; tests `image-uploads.test.ts:46,57,68,79,95`. Pas rejoué dans un navigateur (renvoi axe 5).

| Trouvé / Reste | Verdict | Preuve |
|---|---|---|
| `restore.ts` refait la détection d’`upload.ts` | pas fait | `restore.ts:104-117,139` et `upload.ts:35-47` (auditeur) |
| Écriture du zip d’images en double | pas fait | `images/service.ts:381-404` et `archive.ts:69-113` |
| Commentaire périmé de `/uploads` | fait | `uploads/[...path]/+server.ts:7,18,23-25` justes (route réécrite par 83b9b1f6, DEP-06) |
| Toast après la fermeture du formulaire quand l’enregistrement échoue | pas fait | `forms/form-action.svelte.ts:78,107` : toast sans tenir compte de la fermeture ; lecture, non rejoué (renvoi axe 5) |
| Résultats de l’import zip en noms de base | pas fait | `images/service.ts:323` (`path.basename`) ; rejoué : deux entrées `…/wine-202d….png` rapportées sous le même nom (`$V/checks3.log`) |
| Renommer `a.jpg` en `A.jpg` sur un disque insensible à la casse | pas fait | `$A/misc.log` (409 `duplicate_name` sur macOS) |
| Images orphelines à la fermeture de l’onglet | pas fait | `forms/image-uploads.ts:42-46` : suppression seulement dans `onDestroy`, aucun `pagehide`/`beforeunload` ; lecture (renvoi axe 5) |
| Marge de 64 Ko pour tous les formulaires | pas fait | `body.ts:97,107` (informatif) |

**API-08** — critère (« france » → « France » ; colonne de trop signalée seule ; 20 000 lignes sautées sans 500 ; essai à blanc sans écriture ; ligne de vin invalide déjà présente signalée invalide ; lint sans avertissement dans les dialogues) : **fait**. `$V/checks2.log`, `$V/checks3.log` ; bouton « Essai à blanc » : `CsvImportDialog.svelte:75-80,283`, `CsvImportResultsDialog.svelte:55-59` ; lint à 0 avertissement (`$S/p12/gates/2-lint.log`).

| Trouvé / Reste | Verdict | Preuve |
|---|---|---|
| `PUT /api/<table>/{id}` sensible à la casse | pas fait | Rejoué : « Testland » renommé « FRANCE » → 200, deux pays « france » (`$V/checks2.log`) |
| Avertissement `prefer-svelte-reactivity` | fait | Lint à 0 avertissement (`$S/p12/gates/2-lint.log`) |
| Défaut mort `ZipImportInfoDialog.svelte:14` | pas fait | `onProceedWithImport = () => {}` (auditeur) |
| « Proceed with Import » pendant un essai à blanc | pas fait | `BarcodeOverrideDialog.svelte:83`, aucune branche `dryRun` |
| Pas de test de l’essai à blanc, de `.CSV`, de la remise à zéro | pas fait | Le seul test d’essai à blanc (`import-csv/server.test.ts:980`) date d’API-04 (6ff01d09, 2026-10-13), avant le point ; aucun test de `.CSV` ni de la remise à zéro de l’option, ni dans `src` ni dans `e2e/` |

## 3. Nouveaux constats (passe 2)

### Régressions

- API-04 (taille du code) : voir la ligne API-04 et Désaccords ; pas compté comme constat.
- V3-m2, phrase sur les images : voir ci-dessous.

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

**V3-m1. Import d’un zip d’images et envoi groupé d’images : 2,5 à 4,8 fois leur taille en mémoire**
- Ce qui se passe : DATA-08 a fait passer la restauration et l’import JSON en corps brut écrit en flux. `POST /api/admin/import-images-zip` et `POST /api/admin/upload-image` lisent encore un formulaire de 500 Mo au plus avec `request.formData()`, puis `file.arrayBuffer()`. La page des images envoie toute la sélection en une requête (`upload-image/+server.ts:7-8` le dit). Mesuré, sur serveurs neufs (RSS de départ 223 à 257 Mio) : zip de 191 Mio +820 et +471 Mio, contre +73 et +56 Mio pour un zip de 19 Mio ; 10 images de 20 Mo en une requête +576 et +510 Mio, contre +71 et +70 Mio pour une ; sur serveur chaud, zip de 191 Mio +844 à +914 Mio, pic à 1 087 Mio. Pour un zip de 450 Mo, comme celui que donne « Télécharger les images » d’une cave de 120 photos, cela fait de 1,1 à 2 Go de plus : sur un NAS de 2 Go, le conteneur peut être tué. Rien n’est écrit avant la lecture du formulaire : pas de perte de données, la requête échoue et le conteneur redémarre. Mineur : l’import d’images en zip et l’envoi groupé sont des chemins secondaires (la restauration et l’import JSON, chemins principaux, sont réglés).
- Reproduction : `node $V/scripts/memfresh.mjs <port> <runDir> <pid> images-zip-200` (et `images-zip-20`, `upload-image-10x20`, `upload-image-1x20`) sur un serveur démarré pour chaque mesure par `$V/scripts/start.sh`.
- Preuve : `$V/memory-fresh.log`, `$V/memory.log` ; chez l’auditeur `$A/large-uploads.log`, `$A/images-zip-warm.log`, `$A/upload-image-rss.log`.
- Où : `src/routes/api/admin/import-images-zip/+server.ts:9`, `src/routes/api/admin/upload-image/+server.ts:10`, `src/lib/server/http/body.ts:106-114`, `src/lib/server/features/images/service.ts:249,299`.
- Régression : non. Même code à `9df0d08c` (budget de 500 Mo depuis 49ce5424, 2026-10-09) ; ni M2 ni DATA-08 ne visaient ces routes.

**V3-m2. `docs/API.md`, restauration : deux phrases contredisent le code**
- Ce qui se passe : `docs/API.md:1900-1902` dit que la restauration copie les images de la sauvegarde « over the files of the same name (the other image files stay) » ; `:1916-1917` et le code (`restore.ts:155-165`, `service.ts:327`) suppriment les fichiers qu’aucune image de la base restaurée ne cite. `:1918-1919` range « the last barcode numbers given » dans « What stays as it was », alors que le code garde, pour chaque préfixe, le plus grand des deux compteurs (`barcode/service.ts:61-72`, décision « Compteurs de codes-barres (DATA-06) ») ; rejoué : la sauvegarde avait `VER0000007`, l’instance `…09`, résultat `…09` ; une sauvegarde au compteur plus haut le ferait monter. `README-Docker.md` le dit juste (« for each barcode prefix the higher last number given »).
- Reproduction : lire `docs/API.md:1898-1925` ; `$V/scripts/cycle.mjs` (fichiers non cités supprimés, compteur).
- Preuve : `$V/cycle.log`, `$A/cycle-A.log`.
- Où : `docs/API.md:1901,1918-1919`.
- Régression : oui pour la phrase des images : écrite par f3868486 (2026-10-17), vraie jusqu’à 857acda9 (DATA-12, 2026-10-23), qui a ajouté la suppression et la ligne `:1916` sans corriger `:1901`. Non pour les compteurs : la phrase date de b4d88785 (2026-10-17), après 60b927cc (2026-10-12) qui garde déjà le plus grand ; elle n’a jamais été exacte.

## 4. Déjà connus

Vus, non comptés comme constats :
- Les points « Trouvé pendant » encore ouverts de DATA-12 (7), DATA-13 (7) et API-08 (4) : tableaux de la section 2.
- Le PUT d’un référentiel reste sensible à la casse (« Trouvé pendant API-08 »).
- `success` et `message` restent dans les réponses des routes d’admin (« Trouvé pendant API-09 »).
- Import CSV : noms de conteneurs et de cases distingués par la casse, l’import prend le premier (décision « Noms de rangement uniques (UI-12) ») ; sans parent dans le fichier, le premier nom l’emporte (décision « Import CSV (API-04) »).
- Une note de vin hors de 1 à 5 dans un CSV est retirée avec une ligne dans la description, sans erreur (réparation DATA-03, `imported-rows.ts:85-97`) : la ligne n’est pas « invalide ».
- BMP refusés à la restauration et à l’envoi, BMP déjà en base encore servis (décision « Formats d’image (SEC-06) », notes 0.11.0).
- Mémoire de base du serveur sans `NODE_OPTIONS` (décision « Taille des requêtes (SEC-07) »).
- Après une restauration, le délai de session vient de la sauvegarde (48 h revenu alors que l’instance était à 72 h, `$V/cycle.log`) : la décision « Restauration » ne garde que les réglages des sauvegardes automatiques et le jeton ; c’est ce que fait le code.

## 5. Corrections du vérificateur

- a3 M2 : « partiel » → « fait ». La partie « Où » de M2 ne cite que `body.ts` (le `formData()` partagé), `backup/service.ts` et `json-import.ts`, son scénario et sa mesure sont une restauration, sa correction proposée vise `restore` et `import-json` ; DATA-08, qui a M2 pour source, a pour critère « restaurer ou importer en JSON », et la décision SEC-07 du 2026-10-17 ne parle que de ces deux routes. Les deux sont tenues. La mémoire de l’import d’images reste un constat à part (V3-m1).
- V3-m3 (auditeur, Mineur, « Import CSV : 914 lignes ») : fondu dans la ligne API-04, qui porte déjà le verdict « régressé » ; c’est une métrique de code, sans effet pour un utilisateur ni un admin, et la compter deux fois gonflerait les constats. Le comptage par commit est confirmé, avec 22 lignes de plus dans `src/lib/shared/csv-import.ts`.
- V3-m1 : confirmé, Mineur ; facteurs remesurés sur serveurs neufs, avec corps témoins : zip ×2,5 à ×4,3 (×4,8 sur serveur chaud), envoi de 10 images ×2,7 à ×3,0 ; les +708 Mio de l’auditeur pour 10 images comptaient le reste du tas.
- V3-m2 : confirmé tel quel ; régression datée (f3868486 puis 857acda9, b4d88785 après 60b927cc).
- API-08, « pas de test de l’essai à blanc, de `.CSV`, de la remise à zéro » : « partiel » → « pas fait ». Le test serveur cité par l’auditeur date d’API-04 (6ff01d09), avant que la tâche ne relève ce point, qui vise donc l’admin ; rien ne le couvre.
- DATA-13, « Toast après la fermeture du formulaire » et « Images orphelines à la fermeture de l’onglet » : « hors axe, non vérifié » n’est pas un verdict → « pas fait », par lecture (`form-action.svelte.ts:78,107` ; `image-uploads.ts:42-46`).
- DATA-12, « Script qui filtre sur `manual-backup` » : « fait autrement » → « fait ». Aucune décision n’est derrière ; le point ne demande que la documentation, qui existe (`docs/API.md:1748-1751`).
- DATA-13, critère : l’auditeur laissait « fermer le formulaire ne laisse aucun fichier » non rejoué ; prouvé ici par le code et les tests (`image-uploads.test.ts`).
- DATA-05/Trouvé-20 : précision. Sans `Content-Type`, le cron reçoit 403 seulement sans en-tête `Origin` (cas de `curl`) ; avec l’`Origin` du serveur, 200.
- DATA-08 : précision. Sur un serveur au RSS retombé à 58 Mio, la restauration de 191 Mio monte de +95 Mio, à la limite de la moitié (95,5 Mio) ; l’auditeur a vu +137 Mio juste après un démarrage. La sauvegarde témoin de 0,3 Mio coûte +33 à +47 Mio : cette hausse vient du chargement du code de la restauration, pas de la taille du fichier, et le critère tient.

## 6. Désaccords

- API-04, « moins de 700 lignes » : pour l’auditeur, régression constatée et constat Mineur V3-m3 (« aucune décision ne relève la limite »). Pour le vérificateur, verdict « régressé » sur la métrique seule, sans constat : la limite a été franchie par des fonctions que le mainteneur a demandées après coup (BUG-15, BUG-18 par la décision « Suites de P7 », API-08, UI-12), aucune n’a de mise en défaut de comportement, et la décision « Import CSV (API-04) » fixe encore la façon de compter les 700 lignes sans dire si la limite vaut toujours après ces ajouts. Ni le code ni la feuille de route ne tranchent : au mainteneur de dire si la limite tient encore (à relever ou à retrouver).
- a3 M2 : l’auditeur lit « importer un zip » comme incluant l’import d’un zip d’images, d’où « partiel ». Le vérificateur s’en tient au périmètre écrit de M2 et de DATA-08 (voir Corrections). La mémoire de l’import d’images est rapportée dans les deux cas (V3-m1).

## 7. Renvois

- Axe 4 : « Download » de la liste des sauvegardes charge tout le fichier dans le navigateur (`admin/backups/+page.svelte:98-100`, `downloadBlob`) ; point connu de DATA-12.
- Axe 4 : `BarcodeOverrideDialog.svelte:83` affiche « Proceed with Import » pendant un essai à blanc ; `ZipImportInfoDialog.svelte:14` garde un défaut mort (points connus d’API-08).
- Axe 5 : DATA-13, critère « fermer le formulaire ne laisse aucun fichier », et les points « toast après la fermeture » et « images orphelines à la fermeture de l’onglet » : prouvés ici par lecture seulement (`forms/image-uploads.ts`, `forms/form-action.svelte.ts:78,107`), à rejouer dans un navigateur.
- Axe 7 ou lead : commentaire ambigu `csv-import/service.ts:37` (« The name has no table name, such as wineBottles.csv » : `wineBottles.csv` en contient justement une) ; détail.
- Lead : un zip fait par la commande `zip` de macOS, lancée sans locale UTF-8, garde les noms accentués sans le drapeau UTF-8 ; l’import d’images les lit alors en CP437 et les signale `filename_not_found_in_database` (`$V/checks2.log`, « renomm├⌐e ├⌐.png »). Dépend de l’outil qui fait le zip, et seuls les noms renommés à la main portent des accents : non retenu comme constat.
