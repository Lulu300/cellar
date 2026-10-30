# Audit d'avant 1.0, axe 2 : API publique, authentification et sécurité serveur

Commit audité `9df0d08c` (develop, 2026-10-16). Périmètre : authentification, session, contrôle d'origine (CSRF) et code d'accès (partie A), puis API publique hors admin, validation des entrées et services de domaine (partie B). L'axe tient aussi la liste unique des routes sans appelant, publiques et admin. Méthode : lecture du code, puis l'app lancée depuis des worktrees détachées avec des données inventées (`node server.js` en `ORIGIN=http://localhost:4420`, une seconde instance en https pour le drapeau `Secure`, une troisième sur 4430 avec 10 000 bouteilles d'un vin fictif). Une sonde a envoyé chacune des 77 écritures sans session, avec une origine étrangère et avec `Origin: null`. Chaque constat a été revu par un second agent, qui l'a rejoué sur sa propre instance (ports 4620 et 4650) pour tenter de le réfuter. Les quatre points signalés par d'autres axes ont été vérifiés par le rédacteur, par lecture du code et par un test jetable lancé dans une worktree à part (gardé hors dépôt, worktree supprimée). Les portes du lead sur ce commit passent : check, lint (0 erreur, 104 avertissements), 976 tests, i18n, knip et build.

## 1. Résumé

La sécurité serveur demandée par les revues 2, 3, 4 et 7 est en place et a été mesurée en direct. Sans session, toute écriture et tout `/api/admin/**` (GET, HEAD et OPTIONS compris) reçoivent 401. Avec une origine étrangère ou `Origin: null`, les 77 écritures reçoivent 403. Le code d'accès est haché en scrypt, la 6e tentative dans la minute reçoit 429, et le premier code exige le jeton des logs. Côté API, chaque corps passe par un schéma zod, et un corps invalide reçoit 422, jamais 500. Les routes n'importent plus la base, et les écritures multiples sont atomiques. Sur 107 lignes de traçabilité, 101 sont corrigées, 4 sont des écarts décidés, 1 est sans objet et une seule reste partielle : les réponses produites hors `apiHandler` (route `/api` inconnue en 404 HTML, 405 et 403 de SvelteKit en texte). La passe 2 ne trouve ni Critique ni Majeur, mais neuf Mineurs. Le plus important est une décision à prendre avant le tag (m1) : 31 couples route × méthode n'ont aucun appelant, alors que trois décisions s'y contredisent (UI-04 et UI-09 les gardent « jusqu'à l'audit d'avant 1.0 », API-06 dit qu'ils sont supprimés) et que les notes de 0.7.0 en recommandent déjà certains aux scripts. Suivent deux écarts dans l'attribution des codes-barres à la création d'une bouteille (m3, m4).

## 2. Traçabilité (passe 1)

107 lignes : 101 Corrigé, 1 Partiel, 0 Non fait, 1 Sans objet, 4 Écart décidé. Le vérificateur de la partie A a revu ses 29 lignes (25 lignes principales et 4 complémentaires) et n'a corrigé qu'une preuve (UI-10/Trouvé-SEC02b, renvoyée à l'axe 5). Celui de la partie B a revu 46 lignes sur 79, dont toutes celles qui ne sont pas « Corrigé ». Il a ajouté une ligne (R2-M1b). Deux lignes complémentaires sont retirées du compte : API-01/Trouvé-SEC03, doublon d'API-01/Trouvé-2, et UI-10/Trouvé-SEC02b, traité à l'axe 5.

### Revue 2

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R2-C1a | `handle` ne fait que les migrations, aucune auth serveur | Corrigé | `src/hooks.server.ts:74-78` : contrôle d'origine puis `authenticate()` (`src/lib/server/session.ts:67-73`) ; sonde sans session : 77 écritures sur 77 et tous les GET `/api/admin/**` → 401 |
| R2-C1b | `POST /api/access-code` renvoie `{valid}` sans cookie ni session | Corrigé | `features/settings/service.ts:66-70` (`logIn` → `createSession`) ; en direct : `set-cookie: cellar_session=…; HttpOnly; SameSite=Lax` ; jeton de 32 octets stocké en SHA-256 (`session.ts:18-20,95-104`) |
| R2-C1c | État « connecté » = drapeau `sessionStorage` | Corrigé | `grep "sessionStorage\|wine-cellar-authenticated" src` vide ; `src/lib/stores/auth.svelte.ts:24-44` lit `/api/session` |
| R2-C1d | Timeout de session appliqué côté client seulement | Corrigé | Expiration en base (`session.ts:95-104`), session expirée rejetée (`:118-127`) ; en direct : session forcée expirée → `{"authenticated":false}` et 401 ; test `session.test.ts` « answers 401 once the session has expired » |
| R2-C1e | `PUT /api/settings` ouvert | Corrigé | Sans session → 401 ; avec session et même origine → 200 |
| R2-C1f | Cookie `SameSite=Strict` proposé | Écart décidé | Décision « Cookie de session (SEC-02) » : `SameSite=Lax` ; `session.ts:31` |
| R2-C2a | `csrf.checkOrigin: false` | Corrigé | Plus de `svelte.config.js` ; contrôle de SvelteKit 3 actif (`vite.config.ts:53-56`) et `src/lib/server/csrf.ts:24-38` pour toute écriture ; en direct avec session : `Origin: http://evil.example` → 77/77 en 403, `Origin: null` → 77/77 en 403 |
| R2-C2b | `request.json()` accepte `text/plain` (POST sans preflight) | Corrigé | `POST /api/definitions` en `text/plain`, inter-sites avec session → 403. `parseBody` accepte encore `text/plain` en même origine, sans risque : le contrôle d'origine passe avant |
| R2-C2c | Définir `ORIGIN` ou `PROTOCOL_HEADER`/`HOST_HEADER` | Corrigé | `docker-compose.yml:22` (`${ORIGIN:?…}`), `README-Docker.md:125-196`, `server.js:33-52` ; en direct, `Host`, `X-Forwarded-Host` et `x-cellar-origin-host` forgés → 403 ; `ORIGIN` en https et origine http → 403 |
| R2-M1 | Fichier temporaire au chemin choisi par le `prefix` de `barcode/csv` | Corrigé | `src/routes/api/barcode/csv/+server.ts:8-12` répond en mémoire (`attachmentResponse`) ; `checkedPrefix` (`features/barcode/service.ts:83-88`) ; repro : `prefix "/../../x"` → 422 `invalid_barcode_prefix` |
| R2-M1b | Même chose pour `pdf-labels`, `filename` à assainir (ajoutée par le vérificateur) | Corrigé | `api/barcode/pdf-labels/+server.ts` (11 lignes) répond en mémoire ; `grep writeFile\|tmpdir\|createWriteStream` vide dans `features/labels`, `features/barcode`, `routes/api/barcode` ; nom passé par `content-disposition.ts` |
| R2-M2a | Code par défaut `1234` stocké en clair | Corrigé | `src/lib/server/access-code.ts:129-144` (1234 supprimé, autre code en clair haché, puis VACUUM) ; en base : `scrypt$N=32768,r=8,p=1$…` ; tests `access-code.test.ts:87,97` |
| R2-M2b | Le `GET` crée les réglages | Corrigé | `settings/service.ts:44-48` : `accessCodeExists` ne fait que lire |
| R2-M2c | Comparaison `===` non constante | Corrigé | scrypt + `timingSafeEqual` (`access-code.ts:86-97`), `setup-token.ts:40-45`, `backup/token.ts:31-41` |
| R2-M2d | Aucune limite de tentatives | Corrigé | `src/lib/server/login-attempts.ts:6-13,65-83` ; en direct : 5 × `{"valid":false}` puis 429 `retry-after: 60`, même avec le bon code et un `X-Forwarded-For` forgé |
| R2-M2e | Minimum de 4 caractères | Écart décidé | Décision « Code d'accès (SEC-03) » ; `src/routes/api/access-code/+server.ts:18` |
| R2-M3a | `quantity` sans borne | Corrigé | `src/lib/shared/schemas/bottle.ts:81-85` (`max(100)`) ; repro `quantity: 101` → 422 ; test « creates from 1 to 100 bottles in one request » |
| R2-M3b | Unicité du code-barres vérifiée à `quantity === 1` seulement, code manuel perdu au-delà | Corrigé | `bottles/service.ts:59-64` (422 `barcode_for_one_bottle`) ; index unique → 409 `duplicate_barcode` (`db-errors.ts:38-46`) ; tests de `bottles/server.test.ts`. Le mode automatique est traité en m3 |
| R2-M3c | Corps brut passé à `updateWineDefinition` | Corrigé | `api/definitions/[id]/+server.ts:15-17` + `wineDefinitionSchema` (`schemas/wine.ts:16-40`) ; test « drops the columns a client may not set » |
| R2-M3d | Un `type` inconnu crée un type | Corrigé | Ids seulement ; test « answers 409 for a type id that does not exist, and creates no type » |
| R2-M3e | `pageFormat` inconnu → 500 | Corrigé | `schemas/label.ts:10` (`z.enum(PAGE_FORMATS)`) |
| R2-M3f | Marges négatives → DoS mémoire du PDF | Corrigé | `schemas/label.ts:6` (0 à 500), largeur et hauteur > 0 et ≤ 500, `count` ≤ 1000 |
| R2-M3g | `name.trim()` sur une non-chaîne → 500 | Corrigé | `namedSchema` (`schemas/reference.ts:5`) ; repro `POST /api/countries '[1]'` → 422 |
| R2-M3h | `startNumber` en chaîne concaténé | Corrigé | `labelRangeSchema` (`schemas/label.ts:36-41`) ; repro `"5"` → 422 |
| R2-M4a | Corps illimité, `formData()` avant le contrôle de taille | Corrigé | `parseFormData` lit `Content-Length` d'abord (`http/body.ts:90-98`) ; repro 30 Mo → 413. Un envoi chunked n'est mesuré qu'à la lecture (documenté `body.ts:86-88`) |
| R2-M4b | Type MIME et extension pris au client | Corrigé | `detectImageType` (`server/upload.ts:12-30`) ; repro : HTML nommé `.png` → 422 ; PNG envoyé en `text/html` → stocké `wine-….png`, servi `image/png` |
| R2-M4c | Pas de `nosniff` | Corrigé | `routes/uploads/[...path]/+server.ts:52` ; en-tête présent |
| R2-M5 | `PUT /api/bottles/[id]` remplace tout avec des défauts implicites | Écart décidé | Décision « Mises à jour des bouteilles (API-05) » : PUT gardé, servi par le code de PATCH. Le piège reste pour les scripts : `PUT {definitionId, formatId, "availabilty":"consumed"}` → 200, notes, prix, millésime, case et code-barres remis à null ; le même corps en PATCH → 422. `bottleSchema` n'est pas strict exprès (`schemas/bottle.ts:7-8`, test `bottles/[id]/server.test.ts:118`). La phrase « Un champ inconnu est refusé (422) » de la décision ne vaut que pour PATCH : à préciser avec m1 |
| R2-M6a | Filtres et tri de `/api/wines` sans effet | Corrigé | `api/wines/+server.ts` appelle `listWines()` sans paramètre |
| R2-M6b | La page d'un vin télécharge tout le catalogue | Corrigé | `routes/wines/[id]/+page.server.ts:10-18` |
| R2-M7a | DELETE d'un conteneur case par case | Corrigé | `storage/service.ts:194-200` en transaction ; test « keeps the cases when the container cannot be deleted » |
| R2-M7b | POST et PUT des conteneurs hors transaction | Corrigé | `storage/service.ts:120-128,159-188` ; deux tests « creates nothing… », « changes nothing… » |
| R2-M7c | DELETE d'une définition ou d'une case utilisée → 500 | Corrigé | Repro : 409 `in_use` et 409 `case_holds_bottles` |
| R2-M7d | PUT : `caseIds` d'un autre conteneur accepté | Corrigé | `storage/service.ts:172-179` ; tests « refuses a case of another container », « deletes the cases it no longer lists » |
| R2-M7e | POST valide `capacity` puis l'ignore | Corrigé | `caseFields` (`storage/service.ts:100-110`) ; repro : capacité 1, 2e bouteille → 409 `case_full` |
| R2-m1 | « Occupation des cases incohérente » | Corrigé | Un seul calcul `caseLoads` (`storage/repository.ts:111-126`) ; test « is the same in every answer that gives it » |
| R2-m2 | « N+1 dans barcode/csv » | Corrigé | Une requête `inArray` (`barcode/repository.ts:167-168`) |
| R2-m3 | « Fichiers temporaires inutiles » | Corrigé | csv, export-all, export-manual répondent par `attachmentResponse` |
| R2-m4 | « CSV mal échappé », formules | Corrigé | `src/lib/server/csv.ts:4-45` (garde de la décision API-06) |
| R2-m5a | « Erreurs incohérentes » : corps d'erreur variés | Partiel | Toutes les routes passent par `apiHandler`. Restent hors format, reproduit par l'auditeur et le vérificateur : route `/api` inconnue → 404 HTML (`GET /api/nope`, même avec `Accept: application/json`) ; méthode non servie → 405 texte (`DELETE /api/wines`) ; contrôle CSRF de SvelteKit → 403 texte « Cross-site POST form submissions are forbidden » (multipart, `text/plain`, et toute écriture sans `Content-Type` ni `Origin`, comme `curl -X DELETE /api/bottles/1`), seul `csrf.ts` répond `cross_site_request` au format. La phrase de `ROADMAP.md:971` (« 403 du contrôle CSRF répondent au même format ») est donc ambiguë |
| R2-m5b | Conflit de code-barres en 400 | Corrigé | 409 `duplicate_barcode` ; test « refuses the barcode of another bottle » |
| R2-m5c | DELETE en 200 `{message}` | Corrigé | 204 partout (`bottles/[id]`, `definitions/[id]`, `storage-*`, `lookup-crud.ts:166-169`) |
| R2-m6a | Quatre fichiers `wine-*` identiques | Corrigé | `createLookupCrud` (`features/shared/lookup-crud.ts`) |
| R2-m6b | `POST /api/wines` et `POST /api/definitions` en double | Corrigé | `api/wines/+server.ts` n'a plus que GET |
| R2-m6c | `/api/wines/[id]` sans appelant | Corrigé | Supprimé ; `wines/[id]/locations` est appelé par `ExistingBottleLocations.svelte:17` |
| R2-m6d | Référentiels aussi sous `/api/admin` | Corrigé | `ls src/routes/api/admin` : plus aucun référentiel |
| R2-m7 | `pdf-labels` de 541 lignes, `console.log`, `global.document` | Corrigé | Route de 11 lignes ; `features/labels/pdf.ts` 166 lignes, `grep console\|global\|document` vide |
| R2-m8 | `uploads/[...path]` : `resolve` inutilisé, EISDIR | Corrigé | `resolveInDir` + `stats.isFile()` (`uploads/[...path]/+server.ts:10-15`) ; repro `/uploads/wines` → 404, `..%2f..%2fdata%2fcellar.db` → 404 |
| R2-m9 | Répertoire vide `api/test-barcode` | Corrigé | Absent |

### Revue 1 (M3)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R1-M3a | 38 routes interrogent la base directement | Corrigé | Règle `eslint.config.js:53-84` ; essai dans une worktree : une route qui importe `#lib/db/index.js`, `#lib/db/schema.js`, `drizzle-orm` ou un `repository` donne 5 erreurs ; `grep` des imports de base dans `src/routes` (hors tests) vide |
| R1-M3b | CRUD des presets inutilisé et réimplémenté par les routes | Corrigé | `features/labels/service.ts`, seul chemin des routes `admin/label-presets` |

### Revue 3 (C0)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R3-C0a | Aucun hook ne protège `/api/admin/*` | Corrigé | `session.ts:56-61`, décidé sur l'id de route : `/api/%61dmin/list-backups` → 401, `HEAD` et `OPTIONS` admin → 401 |
| R3-C0b | POST cross-origin vers wipe-database | Corrigé | Sans session 401 ; avec session et origine étrangère 403 ; avec le jeton cron 401 |

### Revue 4 (C1)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R4-C1 | Garde admin purement décorative (`sessionStorage`) | Corrigé | `src/routes/admin/+layout.server.ts` et chaque `+page.server.ts` admin appellent `redirectWithoutSession` ; `/barcode/+page.server.ts` fait `await parent()`. En direct sans session : `/admin/backups`, `/barcode` → 303 ; `__data.json` avec layout sauté, sur les 6 pages admin et `/barcode` → `{"type":"redirect","location":"/wines?login"}`, aucune donnée |

### Revue 5 (M5)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R5-M5 | Mises à jour groupées : N PUT parallèles d'objets périmés | Corrigé | `patchBottles` (`utils/bottle-changes.ts:23-29`), utilisé par `BottleDetailsDialog.svelte:162,262`, `BulkBarcodeDialog.svelte:302`, `wines/[id]/+page.svelte:173`, `out-of-cellar/+page.svelte:83` |

### Revue 7 (C1)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R7-C1a | Auth en `sessionStorage`, hooks qui ne vérifient rien | Corrigé | Voir R2-C1a, R2-C1c |
| R7-C1b | `csrf: { checkOrigin: false }` | Corrigé | Voir R2-C2a |
| R7-C1c | wipe-database sans corps, vidable par `fetch(no-cors)` | Corrigé | Un `fetch` inter-sites porte un `Origin` étranger → 403 (`csrf.ts:28-29`) ; sans cookie → 401 |
| R7-C1d | Code par défaut `1234` | Corrigé | Voir R2-M2a ; premier code soumis au jeton des logs (`settings/service.ts:80-105`) : 5 mauvais jetons → 403 puis 429 ; bon jeton (minuscules, espaces) → 200 + cookie ; second essai → 409 `access_code_already_set` |
| R7-C1e | Définir `ORIGIN` dans docker-compose | Corrigé | `docker-compose.yml:19-22`, `.env.example:1-10` |

### SEC-01

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-01 | POST cross-origin vers `/api/*` → 403 ; l'app marche depuis son URL | Corrigé | 77/77 écritures cross-origin → 403 avec session ; depuis `ORIGIN` : `PUT /api/settings` 200, actions `/wines?/…` traitées (422/404 de validation, pas 403) ; CI : `scripts/check-origin.mjs` |

### SEC-02

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-02 | Sans cookie, toute mutation et tout `/api/admin/**` → 401 ; `sessionStorage` n'ouvre rien | Corrigé | Toutes les écritures et tous les GET/HEAD/OPTIONS admin → 401, sauf `POST /api/access-code` (connexion). Sans `Origin`, les 4 form actions de `/wines` reçoivent le 403 de SvelteKit avant le 401 |

### SEC-03

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-03 | Code jamais en clair ; 6e tentative en moins d'une minute → 429 | Corrigé | Valeur en base `scrypt$…` ; 6e tentative 429 en direct ; test `access-code/server.test.ts:153` « answers 429 to the 6th attempt in a minute, even with the right code » |

SEC-01, SEC-02 et SEC-03 n'ont aucune puce « Trouvé pendant » ni « Reste » dans leur entrée.

### SEC-05 (partie publique)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-05 | Helper testé sur `..`, chemin absolu, octet nul ; routes listées passent par lui | Corrigé | `paths.test.ts:21-26` ; `uploads/[...path]` passe par `resolveInDir` ; `barcode/csv` n'écrit plus de fichier |
| SEC-05/préfixe | Préfixe `^[A-Za-z0-9-]{0,6}$` | Corrigé | `checkedPrefix` (`barcode/service.ts:83-88`) ; repro 422 |
| SEC-05/uploads | `stats.isFile()` et `nosniff` sur `uploads` | Corrigé | Voir R2-m8 et R2-M4c |

### SEC-06 (partie publique)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-06/taille | `Content-Length` vérifié avant `formData()` | Corrigé | Voir R2-M4a |
| SEC-06/contenu | Images reconnues par leurs premiers octets | Corrigé | Voir R2-M4b |

### API-01

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| API-01 | Plus de `request.json()` sans schéma ; corps invalide → 422, jamais 500 | Corrigé | `grep request.json/formData/text/arrayBuffer` hors tests : seul `http/body.ts:24-25,93` ; repro : JSON cassé → 400 `malformed_body`, tableau ou corps vide → 422 avec `details` |
| API-01/Trouvé-1 | Au-delà de `BODY_SIZE_LIMIT`, 500 au lieu de 413 | Corrigé | `http/body.ts:37-39,94-95` ; test `body.test.ts` « answers 413 to a body over BODY_SIZE_LIMIT » |
| API-01/Trouvé-2 | `PUT /api/settings` ne crée jamais un réglage absent | Corrigé | Upsert (`settings/repository.ts:12-20`) ; test « saves the timeout when the setting was never seeded » ; en direct sur base neuve : 200 (même point que la puce « Trouvé pendant SEC-03 », `ROADMAP.md:965`) |
| API-01/Trouvé-3 | `PUT /api/settings` → 500 sur un corps non JSON ; deux `it.fails` | Corrigé | Test « answers 400 to a body that is not JSON » ; aucun `it.fails` dans `src` |
| API-01/Trouvé-4 | Type de `createMultipleWineBottles` masqué par `as any` | Sans objet | Fonction supprimée avec `services.ts` |
| API-01/Trouvé-5 | L'import CSV insère toutes les colonnes | Corrigé | Fait par API-04 : `ROW_SCHEMAS` (`features/shared/imported-rows.ts:21-43`) |
| API-01/Trouvé-6 | Erreurs d'API en anglais affichées telles quelles | Corrigé | `code` d'une liste fermée (`shared/api-error.ts`), traduit par `utils/api-error.ts` |
| API-01/Trouvé-7 | `POST /api/definitions` sans appellation → 500 | Corrigé | `appellationId` obligatoire (`schemas/wine.ts:19`) → 422 |
| API-01/Trouvé-8 | Ligne relue après écriture → 500 si disparue | Corrigé | `updatePreset` par `.returning()` ; `createLookupCrud` relit dans la transaction (`lookup-crud.ts:86-121`) |
| API-01/Trouvé-9 | Espacements non numériques des presets → NaN | Corrigé | `labelLayoutSchema` (`schemas/label.ts:9-24`) |
| API-01/Trouvé-10 | `PUT /api/bottles/[id]` avec une case inexistante → 500 | Corrigé | Test « answers 409 for a storage case that does not exist, and keeps the bottle » |
| API-01/Trouvé-11 | Imports JSON et CSV qui réparent différemment | Corrigé | Normaliseur partagé `imported-rows.ts` (API-04) |
| API-01/Trouvé-12 | Code-barres ni texte ni nombre → 500 | Corrigé | `schemas/bottle.ts:24-27` → 422 |

### API-02

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| API-02 | Aucune route n'importe le client DB ; `services.ts` n'existe plus | Corrigé | Voir R1-M3a ; pas de `services.ts` dans `src/lib/db` |
| API-02/Trouvé-1 | Écritures hors transaction (réglages, définitions, PUT bouteille, code, préréglages fabricant) | Corrigé | Une instruction pour réglages et définitions (décision « Services par domaine ») ; `updateBottles` en transaction (`bottles/service.ts:89`) ; code d'accès en transaction (`settings/service.ts:97,122`) ; `seed-manufacturer-presets` supprimé |
| API-02/Trouvé-2 | PUT `admin/barcode-settings` hors transaction | Corrigé | `updateBarcodeSettings` (`barcode/service.ts:115-129`) |
| API-02/Trouvé-3 | Course entre export préalable et import JSON | Corrigé | `ROUTES_HOLDING_WRITES` (`hooks.server.ts:22,80-83`) + `holdWrites` (`backup/json-import.ts:170`) |
| API-02/Trouvé-4 | `download-backup` lit tout le fichier en mémoire | Corrigé | `Readable.toWeb(createReadStream(...))` (`backup/service.ts:142`) ; repro : 5 téléchargements coupés à 1 s, le serveur reste debout |

### API-05

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| API-05 | Statut de 10 bouteilles en une requête atomique, sans toucher aux autres champs | Corrigé | Test « changes the status of 10 bottles and no other column » ; repro : `PATCH /api/bottles` de 10 000 ids → 200 en 0,79 s ; 10 001 ids → 422 ; un id fantôme → 404 `details.ids`, rien d'écrit |
| API-05/Trouvé-1 | « Hors cave » envoie l'objet bouteille entier | Corrigé | `newStatus` (`utils/bottle-changes.ts:10-20`) |
| API-05/Trouvé-2 | Bouteille supprimée restée sélectionnée après un échec partiel | Corrigé | `out-of-cellar/+page.svelte:100` retire les `missingIds` |

### API-06

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| API-06 | Moins d'endpoints, pas de régression du front | Corrigé | Supprimés : `POST /api/wines`, `/api/wines/[id]`, 8 routes `/api/admin/<référentiel>`, etc. ; portes vertes. Il reste des routes sans appelant : m1 |
| API-06/Trouvé-1 | Nom avec emoji ou guillemet → `Content-Disposition` cassé | Corrigé | `content-disposition.ts` (repli ASCII + `filename*`) |
| API-06/Trouvé-2 | `startNumber`, `count` de barcode/csv non typés | Corrigé | Voir R2-M3h |
| API-06/Trouvé-3 | `table in AVAILABLE_TABLES` accepte `__proto__` | Corrigé | `Object.hasOwn` (`admin/export-csv/+server.ts:14`) ; test `export-csv/server.test.ts:61` |
| API-06/Trouvé-4 | `validateBarcodeSettings` inutilisé | Corrigé | `grep` vide |
| API-06/Trouvé-5 | `admin/upload-image` et `upload/image` dupliquent l'enregistrement | Corrigé | Un seul `saveImage` (`images/service.ts:153-160`) |
| API-06/Trouvé-6 | `api/bottles` importe `createWineBottle` inutilisé | Corrigé | `api/bottles/+server.ts:2-6` |
| API-06/Trouvé-7 | Imports inutilisés, `substr` | Corrigé | Fichiers absents du lint (`gates.log`) ; `grep "substr("` hors SQL vide |
| API-06/Trouvé-8 | Préfixe `cellar-export-` écrit à trois endroits | Corrigé | `backupFilePrefix` (`backup/files.ts:23`) |
| API-06/Trouvé-9 | `GET /api/definitions` renvoie « Unknown Appellation/Region » | Corrigé | Test « names the appellation, region and country of each wine » |
| API-06/Trouvé-10 | Remise à zéro des modèles d'étiquettes sans page | Corrigé | `restore-label-presets` supprimé (décision API-06) |
| API-06/Trouvé-11 | `GET /api/wines` lit encore `sortField`/`sortDirection` | Corrigé | Voir R2-M6a |
| API-06/Trouvé-12 | `csrf.ts` recouvre le contrôle de SvelteKit 3 | Écart décidé | Décisions « Contrôle CSRF maison » et « Endpoints et CSRF (API-06) » |
| API-06/Trouvé-13 | Chemin du serveur exposé par l'admin | Corrigé | `stripDataDirPrefix` supprimé, réponses en noms de fichiers |
| API-06/Trouvé-14 | `admin/images` remet `imageId` à NULL lui-même | Corrigé | La clé étrangère le fait (`images/service.ts:129-131`) |
| API-06/Trouvé-15 | GET `/api/admin/auto-backup` sans appelant | Corrigé | `admin/auto-backup/+server.ts:6` n'exporte que POST |

### Compléments : puces « Trouvé pendant SEC-0x » rangées sous d'autres tâches

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-10/Trouvé-SEC02a | `?login` reste dans l'URL après la connexion | Corrigé | `src/lib/components/layout/LoginDialog.svelte:128-130` retire `login` puis `goto(…, { replace: true })` |
| DATA-05/Reste-cron | Mode cron désactivé depuis SEC-02 | Corrigé | En direct : jeton haché en base (64 hex) ; bon jeton → 409 `cron_backups_disabled` (mode interne, attendu) ; mauvais jeton → 401 ; jeton sur `create-backup`, `wipe-database`, `PUT /api/settings`, `list-backups` → 401 ; ancien jeton après régénération → 401 |

## 3. Nouveaux constats (passe 2)

Matrice d'autorisation mesurée, sans défaut. La règle (`session.ts:56-61`) est la suivante : toute route `/api/admin/**` exige une session, quelle que soit la méthode. Hors admin, GET, HEAD et OPTIONS sont publics (décision SEC-02), et toute autre méthode exige une session, sauf `POST /api/access-code`. Une écriture vers une route inconnue (`route.id` nul) reçoit 401. Les loads de `/admin/**` et `/barcode` redirigent en 303, y compris en `__data.json`. Autres contrôles sans défaut : cookies (`HttpOnly; SameSite=Lax`, `Secure` seulement si `ORIGIN` est en https), déconnexion (cookie réutilisé → 401), fin des autres sessions au changement de code (`keepOnlySession`), jeton d'installation (60 bits, temps constant, révoqué après usage), en-têtes d'origine du client écrasés par `server.js`, et parité entre form actions de `/wines` et API JSON (mêmes services, mêmes 409, 503 et 401).

Deux limites de la décision SEC-03, vérifiées et documentées, sans constat :
  - au-delà de 10 000 clés, la limite de tentatives évince le client suivi depuis le plus longtemps (`login-attempts.ts:15,46-54`) : avec un /48 IPv6, un attaquant peut s'évincer lui-même. Cela ne compte qu'avec une exposition à Internet, que la décision exclut ;
  - derrière la redirection de ports de Docker ou un proxy sans `ADDRESS_HEADER`, tous les clients partagent la même allowance, documentée dans `README-Docker.md:221-226`.

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

**m1. Routes sans appelant : liste unique, décision à prendre avant 1.0**
- Où : les routes du tableau ci-dessous. Décisions en cause : « Chargement côté serveur (UI-04) » (« Les GET sans appelant restent jusqu'à l'audit d'avant 1.0 »), « Page stockage (UI-09) » (« `DELETE /api/storage-cases/{id}` reste jusqu'à l'audit d'avant 1.0 »), « Mises à jour des bouteilles (API-05) » (PUT peut-être retiré en 1.0) et « Endpoints et CSRF (API-06) » (« Les endpoints sans appelant sont supprimés »).
- Scénario : si 1.0.0 est tagué sans trancher, ces routes deviennent une API publique de fait, à maintenir et à tester, alors que la plupart n'ont aucun test de route et qu'aucun document ne les décrit. Les décisions UI-04 et UI-09 les gardent jusqu'à cet audit, tandis que la décision API-06 dit qu'elles sont supprimées. En plus, les notes déjà publiées en recommandent certaines aux scripts : `UPGRADING.md:13` (action 0.7.0, « use `/api/definitions` instead of `/api/wines` to create or change a wine », « call `/api/<table>` »), le résumé de 0.7.0 (`releases.json:12`, « For scripts, `PATCH /api/bottles/{id}` changes only the fields it is given … `PUT /api/bottles/{id}` still works ») et `CHANGELOG.md:21` (« `GET /api/admin/auto-backup` (use `GET /api/admin/backup-settings`) »).
- Liste, refaite par le rédacteur : `grep -rn "/api/" src scripts` hors `src/routes/api/`, hors `*.test.ts` et hors commentaires, puis contrôle de la méthode de chaque `fetch`/`request`. Les chemins dynamiques ne visent que les 8 référentiels (`` `/api/${slug}` ``, `components/admin/entities.ts:37-153`) : `EntityFormDialog.svelte:54-57` fait POST et PUT, `EntityCollection` fait DELETE seulement (`entity-collection.svelte.ts:72`). Les pages chargent leurs données par leurs `+page.server.ts`, et les URL qu'on y lit sont des commentaires (`wines/+page.server.ts:21`, `statistics/+page.server.ts:5`, `dto.ts:104,125`).

  | Route | Méthode | Appelant | Test de route | Signalé par |
  |---|---|---|---|---|
  | `/api/wines` | GET | aucun (commentaire `wines/+page.server.ts:21`) | non | a2b N1, a7b N1, a6b UI-04/Reste-2 |
  | `/api/bottles` | GET | aucun (commentaires `out-of-cellar`, `cellar-history`) | non | a2b N1, a6b UI-04/Reste-2 |
  | `/api/definitions/{id}` | GET | aucun | non | a2b N1 |
  | `/api/images` | GET | aucun ; commentaire faux `api/images/+server.ts:5-6` (« the wine pages only need… ») : les pages appellent `imageUrlsById()` | non | a2b N1, a3b N8, a7b N1, a6b UI-04/Reste-2 |
  | `/api/statistics` | GET | aucun | non | a2b N1, a7b N1, a6b UI-04/Reste-2 |
  | `/api/wine-shortage` | GET | aucun | non | a2b N1, a7b N1, a6b UI-04/Reste-2 |
  | `/api/storage-containers` | GET | aucun (seul le POST est appelé, `ContainerDialog.svelte:67`) | non | a2b N1, a6b UI-04/Reste-2 |
  | `/api/settings` | GET | aucun (le PUT est appelé, `SessionTimeoutDialog.svelte:34`) | sert d'aide dans `settings/server.test.ts:14` | a2b N1, a4 UI-07/Reste-5 |
  | `/api/barcode/stats` | GET | aucun | oui | a2b N1, a6a N5, a7b N1 |
  | `/api/barcode/stats-manual` | GET | aucun | non | a2b N1, a6a N5, a7b N1 |
  | `/api/{countries,regions,origins,wine-types,wine-colors,wine-classifications,wine-formats}` | GET (7) | aucun : les listes viennent de `+layout.server.ts:21-27` ; seul `/api/appellations` est lu (`LocationPicker.svelte:30`) ; filtres `?countryId=` et `?regionId=` (`lookup-crud.ts:32`) envoyés par personne | `lookup-crud.test.ts:278,287` | a2b N1, a3b N8 |
  | `/api/bottles` | POST | seulement `scripts/check-origin.mjs:84` (contrôle CSRF de la CI) ; l'interface crée par la form action `createBottles` | oui | a2b N1 |
  | `/api/bottles/{id}` | PUT | aucun | oui | a2b N1 (décision API-05) |
  | `/api/bottles/{id}` | PATCH | aucun (l'interface passe par `PATCH /api/bottles`, `bottle-changes.ts:24`) | oui | a2b N1 |
  | `/api/bottles/{id}` | DELETE | aucun ; double de `DELETE /api/admin/wine-bottles/{id}` (m5) | non | a2b N1 |
  | `/api/definitions` | POST | aucun (form action `createWine`) | oui | a2b N1 |
  | `/api/definitions/{id}` | PUT, DELETE | aucun (form action `updateWine`, admin `wine-definitions`) | oui | a2b N1 |
  | `/api/storage-cases/{id}` | DELETE | aucun : la page remplace les cases par `PUT /api/storage-containers/{id}` | oui, 3 cas (`storage-cases/[id]/server.test.ts:58-84`) | a7b N1, a2b N1, a6b UI-09/Reste-7b |
  | `/api/admin/list-backups` | GET | aucun (la page lit `listBackups()`, `admin/backups/+page.server.ts:11`) | aucun test propre, mais route témoin d'une lecture admin dans `session.test.ts:33,51,168`, `hooks.server.test.ts:150`, `client.test.ts:68,87` | a7b N1 |
  | `/api/admin/backup-settings` | GET | aucun (la page lit `getBackupSettingsView()`, `admin/backups/+page.server.ts:12`) | oui (`backup-settings/server.test.ts:14`) | trouvé par le rédacteur ; cité par `CHANGELOG.md:21` |
  | `/api/admin/wine-definitions` | GET | aucun (`EntityCollection` ne fait que DELETE) | non | a3b N8 |
  | `/api/admin/wine-bottles` | GET | aucun | non | a3b N8 |
  | `/api/admin/label-presets`, `/api/admin/label-presets/{id}` | GET (2) | aucun (la page lit `listPresets()`, `barcode/+page.server.ts:19`) | non | a3b N8, a6a N5 |
  | `/api/admin/upload-image` | POST, champ `image` | branche `upload-image/+server.ts:11-13` ; la page envoie `images` (`admin/images/+page.svelte:97`) | non | a3b N8 |

  Soit 31 couples route × méthode et une branche. `POST /api/admin/auto-backup` n'a pas d'appelant dans `src`, mais il est appelé par le cron documenté (`README-Docker.md:457,465`, commande affichée par `BackupSettingsDialog.svelte:44`) : il n'est pas dans la liste.
- Correction proposée : une décision du mainteneur, puis une seule tâche.
  - API interne : supprimer les routes, puis les fonctions devenues mortes, que knip signalera (`deleteStorageCase`, `deleteWineBottle` ou `deleteWineBottleIfAny`, `listImageUrls` si `imageUrlsById` n'en a plus besoin, etc.). Il faut aussi déplacer les tests témoins de `list-backups` vers une autre lecture admin (par exemple `GET /api/admin/images`) et viser une autre écriture dans `check-origin.mjs` (par exemple `PATCH /api/bottles`). Enfin, ajouter une action de mise à jour conditionnelle « scripts » dans `releases.json`, de la même forme que celle de 0.7.0, qui reprenne la phrase déjà écrite par la décision API-05 pour PUT. Cette voie contredit les notes de 0.7.0 citées plus haut.
  - API publique documentée : garder les routes, les décrire dans un document pour les scripts, ajouter un test par route lue, et au minimum retirer `PUT /api/bottles/{id}` (piège de R2-M5, décision API-05).
  - Voie mixte, la plus proche des notes publiées : garder ce que ces notes promettent aux scripts (`/api/definitions` en écriture, `PATCH /api/bottles/{id}`, les GET `/api/<table>`, `GET /api/admin/backup-settings`) et supprimer le reste.
  Dans tous les cas, mettre à jour les décisions UI-04, UI-09 et API-06 pour qu'elles ne se contredisent plus.
- Preuve : commande ci-dessus. Les tests qui dépendent des routes ont été comptés par `grep` des imports de `./+server` dans les `server.test.ts`.
- Vérification : Confirmé, corrigé. Le vérificateur de a7b a réfuté « seule `barcode/stats` a un test » : `DELETE /api/storage-cases/{id}` a 3 tests, et `list-backups` sert de témoin dans 3 fichiers. Le vérificateur de a2b a précisé que `/api/settings` a un appelant en PUT. Le rédacteur a ajouté `GET /api/admin/backup-settings`.

**m2. Baisser la durée de session n'écourte pas les sessions ouvertes, alors que l'interface le laisse croire**
- Où : `src/lib/server/session.ts:90-104` (expiration fixée à la connexion), `src/lib/server/features/settings/service.ts:31-34` ; textes `src/lib/i18n/locales/en.json:871` (« Sessions last {hours} hours. »), `:934`, `:1123` (« Set how long users stay logged in before being automatically logged out »), et les mêmes clés en fr.
- Scénario : l'admin craint qu'un appareil perdu reste connecté et passe le réglage de 168 h à 1 h. Le toast confirme « Session timeout updated to 1 hour », mais la session de l'appareil perdu reste valable jusqu'à 7 jours. Attendu : un effet immédiat, ou un texte qui dit que le réglage vaut pour les prochaines connexions. Changer le code d'accès est le seul moyen de couper les autres sessions.
- Correction proposée : la plus simple est le texte de `ui.session_timeout_description`, en en et en fr (« applies to the next logins; change the access code to end the other sessions »). Sinon, stocker `createdAt` et comparer avec la durée courante dans `getSession`.
- Preuve : en direct, `PUT /api/settings {"sessionTimeoutHours":1}` → 200, puis en base la session ouverte expire toujours 24 h après la connexion. Le code le veut ainsi (`session.ts:91-92`, « a new timeout setting applies from the next login »), mais aucune décision ni aucun texte ne le dit à l'utilisateur.
- Vérification : Confirmé.

**m3. En mode automatique, POST remplace sans le dire le code-barres donné, alors que PATCH l'accepte**
- Où : `src/lib/server/features/bottles/service.ts:58-67` (`barcode: barcodes ? barcodes[i] : bottle.barcode`) ; `updateBottles` (`:80-108`) écrit le code manuel quel que soit le mode.
- Scénario : un script crée une bouteille avec un code déjà collé, sur l'API ou en postant directement à la form action `createBottles`. Il reçoit 201 avec un autre code, et doit faire un PATCH ensuite, que la même API accepte. L'interface ne peut pas le déclencher, car le champ est désactivé à la création en mode automatique (`WineBottleForm.svelte:300`, `disabled={autoBarcode && !editedId}`). Le résumé de 0.7.0, « A manual barcode given to several bottles at once is refused instead of dropped », n'est vrai qu'en mode manuel. Attendu : le code donné est gardé, ou refusé avec un message.
- Correction proposée : garder le code donné pour une seule bouteille, comme PATCH, ou répondre 422 `barcode_for_one_bottle` ou un code dédié. Ajouter un test avec un code différent de celui de la séquence : le test `bottles/service.test.ts:431` « ignores the barcode given when generation is on » passe `CV00000001`, le code que la séquence aurait donné de toute façon, et ne montre donc pas la perte. À faire dans la même modification que m4.
- Preuve : mode automatique, préfixe `WINE`, `POST /api/bottles {"barcode":"MANUAL-1", …}` → 201 avec `"barcode":"WINE000001"` ; sur une autre bouteille, `PATCH /api/bottles/{id} {"barcode":"MANUAL-1"}` → 200 avec `"MANUAL-1"`. Le comportement vient de 0.x (`556c7bb:src/lib/db/services.ts:643-646`), et aucune entrée des « Décisions prises » ne le couvre : API-04 ne vise que l'import CSV, qui garde le code du fichier (`csv-import/bottles.ts:104-108`).
- Vérification : Confirmé, corrigé (le vérificateur a retiré le scénario de l'interface, où le champ est désactivé).

**m4. Une bouteille créée bue ou sortie reçoit un code-barres automatique, alors que l'import n'en donne qu'aux bouteilles disponibles**
- Où : `src/lib/server/features/bottles/service.ts:58,67` (`takeNextBarcodes` appelé quel que soit le statut) ; règle contraire de l'import, `src/lib/server/features/csv-import/bottles.ts:98-106` (« Only an available bottle takes a number: one out of the cellar or consumed has no label to scan »).
- Scénario : en mode automatique, l'utilisateur enregistre une bouteille déjà bue (le formulaire propose « Bue » à la création, `WineBottleForm.svelte:128-132`). Elle prend le numéro suivant de la séquence, qui ne sera jamais imprimé ni scanné, et la planche suivante d'étiquettes commence plus loin. Attendu : la même règle que l'import, qui suit la décision « Import CSV (API-04) » (« Seules les bouteilles disponibles reçoivent un code-barres automatique »). La décision ne vise que l'import : rien ne couvre l'écart.
- Correction proposée : dans `createBottles`, ne prendre des numéros que pour une bouteille disponible (`bottle.availability === BottleAvailability.AVAILABLE`), avec un test. À faire avec m3, dans la même fonction.
- Preuve : test jetable dans une worktree à part (dossier de travail de l'audit, hors dépôt), mode automatique, préfixe `WINE`, `POST /api/bottles {availability: "consumed", quantity: 2}` → `201 [["consumed","WINE000001"],["consumed","WINE000002"]]`. L'auditeur de l'axe 3 l'a vu en direct (`WINE000008` sur une bouteille bue).
- Vérification : signalé par a3b, vérifié par le rédacteur. Confirmé.

**m5. Deux routes DELETE pour une bouteille, avec deux contrats**
- Où : `src/lib/server/features/bottles/service.ts:134-141` : `deleteWineBottle` (404 si la bouteille n'existe pas), servi par `DELETE /api/bottles/{id}`, et `deleteWineBottleIfAny` (204 toujours), servi par `DELETE /api/admin/wine-bottles/{id}`.
- Scénario : un client qui supprime une bouteille déjà supprimée reçoit 404 par l'API publique et 204 par l'admin. Pour un vin, l'admin répond 404 (`deleteDefinitionAndBottles`, et le « Fait » d'API-03, `ROADMAP.md:1013` : « Supprimer un vin inconnu répond aussi 404 »). L'interface n'appelle que la route admin, et la route publique n'a aucun appelant (m1). Attendu : un seul contrat, et une seule route.
- Correction proposée : faire pointer la collection des bouteilles de l'admin vers `/api/bottles` (`admin/data/bottles/+page.svelte:23`), puis supprimer `api/admin/wine-bottles/` (dont le GET n'a pas d'appelant non plus) et `deleteWineBottleIfAny`. La bouteille déjà supprimée reçoit alors 404, comme un vin. Si m1 garde les routes de l'admin, faire au minimum appeler `deleteWineBottle` par la route admin.
- Preuve : test jetable (dossier de travail de l'audit, hors dépôt) : id inconnu → `DELETE /api/bottles/{id}` 404, `DELETE /api/admin/wine-bottles/{id}` 204. `bottles/[id]/server.test.ts` ne teste que PUT et PATCH, et aucun test ne vise la route admin.
- Vérification : signalé par a7b, vérifié par le rédacteur. Confirmé.

**m6. Réponses incohérentes entre ressources : 404, détails du 409 `in_use`, forme des succès**
- Où et preuves :
  - `GET /api/wines/nope/locations` → 200 `{"definitionId":"nope","locations":[],"totalBottles":0}`, alors que `GET /api/definitions/nope` et `GET /api/storage-cases/nope/capacity` répondent 404 (`storage/service.ts:226-245`).
  - `DELETE /api/definitions/{id}` d'un vin qui a des bouteilles → 409 `{"code":"in_use","message":"Other entries still use this one"}` sans `details` (refus de la clé étrangère traduit par `src/lib/server/db-errors.ts:86-89`), alors qu'un référentiel donne `details: {count, usedBy}` (`lookup-crud.ts:140-143`) et l'admin `bottleCount` (`catalog/service.ts:119-123`). Le commentaire `catalog/service.ts:104` (« throws a ConflictError (in_use) ») décrit une erreur que la fonction ne lève pas.
  - Quatre PUT répondent `{ success: true }` au lieu de la valeur enregistrée : `api/settings/+server.ts:20`, `api/admin/upgrade-actions/+server.ts:16` (signalé par a7a), `api/admin/backup-settings/+server.ts:22` (avec un `message` anglais) et `api/admin/barcode-settings/+server.ts:17` (avec `conflictInfo`). La décision « PUT qui renvoie la ligne » ne couvre que les référentiels : décision « Référentiels (API-03) » (`ROADMAP.md:54-55`) et son « Fait » (`ROADMAP.md:1013`). Mais l'action 0.7.0 publiée la généralise (`UPGRADING.md:13`, `releases.json:15` : « read the saved entry from a PUT instead of `{ success: true }` »). Ce n'est donc pas un écart décidé : la phrase promet ce que ces quatre routes ne font pas. Test jetable : `PUT /api/settings` → `200 {"success":true}`.
  - `POST /api/admin/wipe-database` rend la sauvegarde préalable en `backups.database.filename` (`wipe-database/+server.ts:7-11`, objet `{filename, size}`), alors que la restauration et l'import JSON la rendent en `backup` (`backup/service.ts:315`, `backup/json-import.ts:185`). La page lit donc deux formes pour la même information (`admin/backups/+page.svelte:175` contre `:197`). Signalé par a4.
  - `POST /api/bottles` ajoute un `message` anglais (`api/bottles/+server.ts:21`), et `POST /api/upload/image` un `success: true` (`images/service.ts:171-178`).
- Scénario : un client générique ne peut pas traiter les réponses de la même façon d'une ressource à l'autre. Un script écrit d'après l'action 0.7.0 attend la valeur enregistrée en réponse à `PUT /api/settings`, et reçoit `{ success: true }`. L'interface ne souffre que de la double lecture de la page des sauvegardes.
- Correction proposée : 404 dans `wineLocations` pour un vin inconnu ; `deleteWineDefinition` en transaction avec le compte, comme `deleteDefinitionAndBottles`, ou au moins corriger le commentaire. Faire renvoyer la valeur enregistrée aux quatre PUT : `getSettings()`, `getBackupSettingsView()`, les réglages de codes-barres avec `conflictInfo`, et l'état de l'action. La phrase de l'action 0.7.0 devient alors vraie. Faire rendre `backup` par le wipe, comme la restauration, et retirer `message` et `success`, que le statut porte déjà. Les routes que m1 supprimerait sortent de ce point.
- Vérification : Confirmé (a2b N4). Les points sur les PUT d'admin et sur le wipe ont été signalés par a7a et a4, puis vérifiés par le rédacteur et fusionnés ici.

**m7. `POST /api/admin/backup-token` est la seule route API hors `apiHandler`**
- Où : `src/routes/api/admin/backup-token/+server.ts:5`.
- Scénario : si `createBackupToken()` lève (base occupée, disque plein), SvelteKit répond 500 `{"message":"Internal Error"}` au lieu de `{ error: { code, message } }`. L'interface affiche alors `errors.unexpected_response` (traduit, avec le statut, `client.ts:66-67`) au lieu de `errors.internal_error`. Seuls le texte et la journalisation changent. Attendu : le même format que toutes les autres routes, comme API-01 l'annonce.
- Correction proposée : `export const POST = apiHandler(() => Response.json({ token: createBackupToken() }));`, sans nouveau test.
- Preuve : sur tous les `src/routes/**/+server.ts`, hors `uploads/[...path]` (hors `/api`) et les référentiels (enveloppés par `lookup-crud.ts:153-166`), seul `backup-token` n'utilise pas `apiHandler`.
- Vérification : Confirmé, corrigé. La moitié « pas de test de route » est réfutée : `backup-settings/server.test.ts:4` importe la route et la teste, et `hooks.server.test.ts:139-166` vérifie que le jeton n'ouvre que `auto-backup` et que l'ancien reçoit 401. L'impact est plus faible qu'annoncé.

**m8. Vins décrits sous plusieurs formes, avec des valeurs de repli mortes**
- Où :
  - `catalog/repository.ts:70-81` (`getDefinitionWithLocation`) renvoie la localisation imbriquée et aussi `appellations`, `regions` et `countries` à plat ; aucun composant ne lit les champs à plat (seul `wineDefinition.appellation?.region…`, `wines/[id]/+page.svelte:292-310`), et le test `catalog/service.test.ts:28` « nested and flat » fige ce doublon ;
  - des valeurs de repli pour des clés étrangères NOT NULL (`schema.ts:72-82,186-188`), donc jamais atteintes, et différentes entre elles : `'Unknown'` (`bottles/repository.ts:67,91,97-98`, `catalog/repository.ts:52-53`), `'Standard'` (`bottles/repository.ts:188`), `'Unknown Region/Appellation/Country'` en anglais (`catalog/service.ts:68-70`) ;
  - le refus `barcode_for_one_bottle` écrit deux fois (`bottles/service.ts:59-64` et `:83-88`).
- Scénario : sans effet pour l'utilisateur ; du code à maintenir et des formes à documenter si l'API devient publique (m1).
- Correction proposée : retirer les champs à plat de `getDefinitionWithLocation` et leurs assertions ; des jointures internes (`innerJoin`) au lieu des replis ; une fabrique pour l'erreur de code-barres.
- Preuve : extraits cités, relus par le vérificateur.
- Vérification : Confirmé, corrigé. Le premier point du rapport (`/api/bottles/non-consumed` qui renvoie `wineDefinition`, reconverti par `AllBottlesDialog.svelte:59`) est retiré : il est déjà suivi en UI-02/Reste-3 (`ROADMAP.md:1134`), voir la section 6.

**m9. Commentaires et noms trompeurs**
- Où :
  - `routes/uploads/[...path]/+server.ts:51` : « Uploads keep the extension the client chose ». Ce n'est plus vrai pour les envois depuis SEC-06, qui déduisent l'extension du contenu (`server/upload.ts:33-35`). Cela reste vrai pour l'import zip et les anciens fichiers ;
  - `api/images/+server.ts:5-6` : voir m1 ;
  - `GET /api/barcode/export-all` appelle `exportPrefixBarcodes` (codes du préfixe seulement), et `export-manual` appelle `exportAllBarcodes` (tous les codes) : URL et fonctions disent l'inverse (`barcode/export-all/+server.ts:7-8`, `export-manual/+server.ts:7-8`, choisies par `BarcodeStatsCard.svelte:30-31` selon le mode) ;
  - `caseCapacity` désigne à la fois un schéma zod (`schemas/storage.ts:8`) et une fonction de service (`storage/service.ts:209`) ;
  - avertissement de lint `BOTTLE_SORT_COLUMNS` « only used as a type » (`schemas/bottle-list.ts:4`, `gates.log:262`).
- Scénario : un lecteur qui se fie au nom ou au commentaire se trompe de fonction ou de comportement.
- Correction proposée : corriger le commentaire d'`uploads` (« the extension found in the content; the zip import and older files keep theirs ») ; renommer les deux fonctions d'export pour qu'elles correspondent aux routes ; renommer le schéma `caseCapacitySchema` ; écrire le type sans constante, ou utiliser la constante.
- Preuve : extraits cités.
- Vérification : Confirmé.

## 4. Points restés ouverts de la passe 1

Une seule ligne de l'axe reste ouverte. D'autres axes y renvoient des lignes « Non fait » qui relèvent des mêmes tâches.

- **Réponses hors `apiHandler` au format de l'API** :
  - R2-m5a (Partiel) : une route `/api` inconnue répond en 404 HTML et une méthode non servie en 405 texte. Proposition : dans `handle`, réécrire au format `{ error: { code, message } }` une réponse 404 ou 405 sous `/api/` qui n'est pas du JSON.
  - Même ligne : le 403 du contrôle CSRF de SvelteKit est en texte. Il passe avant `handle`, donc rien à changer dans le code. Préciser « les 403 de `csrf.ts` » dans `docs/roadmap/tasks.mjs:774` (puis `build.mjs`), et ajouter une phrase dans `README-Docker.md`, près de la section `ORIGIN` : une écriture envoyée par un script sans `Origin` doit porter `Content-Type: application/json`, sinon un `DELETE` sans corps reçoit 403.
  - Lignes d'autres axes couvertes par cette tâche : UI-07/Trouvé-11 et UI-07/Reste-2 (axe 4).
- **Décision sur les routes sans appelant** (m1) : couvre UI-04/Reste-2 et UI-09/Reste-7b (axe 6), UI-07/Reste-5 (axe 4), ainsi que le retrait éventuel de `PUT /api/bottles/{id}` prévu par la décision API-05.

## 5. Constats écartés

- a2a N2, moitié « pas de test de route pour `backup-token` » : réfutée, la route est testée (`backup-settings/server.test.ts:4`, `hooks.server.test.ts:139-166`). Le reste devient m7.
- a2a N3 (« les 403 du contrôle CSRF de SvelteKit ne sont pas au format, contrairement à la feuille de route ») : doublon de la troisième partie de R2-m5a, fusionné dans cette ligne (section 2) et dans sa tâche (section 4). Le vérificateur a élargi le cas aux `DELETE` sans corps des scripts, et a relevé qu'il n'existe pas de « doc de l'API pour les scripts » où le dire.
- a2b N5, premier point (`/api/bottles/non-consumed` renvoie `wineDefinition`) : déjà suivi en UI-02/Reste-3 (`ROADMAP.md:1134`), traité à l'axe 5.
- a7b N1, « seule `barcode/stats` a un test » : réfuté (3 tests pour `DELETE /api/storage-cases/{id}`, `list-backups` témoin dans 3 fichiers) ; le reste est fusionné dans m1.
- a3b N8, a6a N5, a7b N1, a6b UI-04/Reste-2 et UI-09/Reste-7b, a4 UI-07/Reste-5 : fusionnés dans la liste unique de m1 (doublons d'un même défaut).
- a2a, ligne UI-10/Trouvé-SEC02b : la preuve `PresetManager.svelte:87` est fausse (un `catch` réseau, jamais atteint sur un 401) ; le vérificateur la remplace par `:53`. La ligne est traitée à l'axe 5.

## 6. Renvois

- Préfixe de code-barres comparé avec `LIKE` dans les statistiques et `export-all` (a2b N2) : voir axe 6.
- Toasts d'erreur composés qui enveloppent le 401 à côté du dialogue de connexion (UI-10/Trouvé-SEC02b, Partiel) : voir axe 5.
- `/api/bottles/non-consumed` qui renvoie `wineDefinition` (UI-02/Reste-3) : voir axe 5.
- Code-barres manuel, message de refus figé après reconnexion (partie de a5a N7) : voir axe 5. La partie « POST remplace le code » est m3 ici.
- Image envoyée puis abandonnée, fichier orphelin (`WineDefinitionForm.svelte:66-85`) : voir axe 5.
- Poids de la page `/wines` avec beaucoup de bouteilles bues (`listWines`, 9,3 Mo pour 10 000 bouteilles d'un vin) : voir axe 5, R5-m24.
- Import zip d'images sans contrôle du contenu, `.bmp` accepté, et branche `bmp` de `routes/uploads/[...path]/+server.ts:35-37` : voir axe 3.
- Puces « Trouvé pendant SEC-02/SEC-07 » et « Trouvé pendant SEC-03 » de DATA-05 (`ROADMAP.md:865,867` : restauration, `keepOnlySession` si `migrateSchema()` échoue) : voir axe 3.
- `src/lib/db/` hors de `src/lib/server/`, non protégé par la garde server-only de SvelteKit (R7-Archi-1) : voir axe 7.
- Variables inutilisées signalées par le lint dans `BarcodeOverrideDialog.svelte:16` et `CsvImportDialog.svelte:20` : voir axe 4.
