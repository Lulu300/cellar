# Vérification d’avant 1.0, axe 2 : API publique, authentification, sécurité

Commit revu : `cf48032d` (develop, 1.0.0-rc.1, 2026-10-29). Périmètre : celui de l’axe 2 de l’audit (`audit-pre-1.0/axe-2-api-securite.md`, commit `9df0d08c`) : authentification, session, contrôle d’origine, code d’accès, API publique, validation des entrées, plus les tâches API-07, API-09 et BUG-17. Méthode : rapport de l’auditeur (`$S/p12/a2/rapport-axe-2.md`) relu pour le réfuter, puis tout refait sur une instance à moi : worktree détachée à `cf48032d` (supprimée), `pnpm install --frozen-lockfile`, `pnpm build`, `node server.js` sur 4525 (`ORIGIN=http://localhost:4525`) et 4526 (`ORIGIN=https://cellar.test:4526`), données inventées dans `$S/p12/v2/d4525` et `d4526`. Inventaire route × méthode refait depuis `src/routes`, sans reprendre la liste de l’auditeur. Sondes Node sans dépendance (`node:http`, en-têtes `Origin` et `Host` libres), Chromium headless de Playwright pour l’encadrement, 8 fichiers de tests de sécurité relancés (122 tests verts). Chaque verdict autre que « fait », chaque « fait » venu d’un Critique ou Majeur de l’audit, d’un contrôle de sécurité ou d’un critère de tâche, et plus d’un tiers des autres « fait » ont été rejoués ou relus à `cf48032d`. Les portes du lead passent (`$S/p12/gates/summary.txt` : check, lint, test, i18n:check, knip, build, test:e2e, exit 0).

`$S` = `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214/scratchpad`

### Preuves du vérificateur (chemins absolus)

| Repère | Fichier | Contenu |
|---|---|---|
| [inv] | `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214/scratchpad/p12/v2/my-routes.txt` | Inventaire refait : 69 fichiers `+server.ts`, 72 couples hors référentiels (dont `GET /uploads/[...path]`) + 8 référentiels × 4 = 103 couples sous `/api` |
| [matrix] | `…/scratchpad/p12/v2/matrix-4525.log` (script `matrix.mjs`) | 65 écritures + 4 form actions × 6 variantes (sans session avec et sans `Origin`, session + `Origin` étranger, `null`, autre port, `Host`/`X-Forwarded-Host`/`x-cellar-origin-host` forgés) ; 10 lectures admin × GET, HEAD, OPTIONS, et `/api/%61dmin/…` ; 7 écritures vers des routes inconnues. 0 échec |
| [auth] | `…/scratchpad/p12/v2/auth2-4525.log` | 6 mauvais codes, bon code en 7e avec `X-Forwarded-For` forgé, 9 pages gardées, 99 requêtes `__data.json` (11 masques), déconnexion puis cookie réutilisé |
| [api] | `…/scratchpad/p12/v2/api-4525.log` (script `api.mjs`) | Appels avec session : affirmations de 0.11.0, 201/204, 404/405, traversées (`/uploads`, sauvegardes), corps trop gros, paramètres de requête, wipe |
| [api2] | `…/scratchpad/p12/v2/api2-4525.log` | Mode cron, noms d’export CSV, section « Origin check » de `docs/API.md`, commandes `curl` du document |
| [maj] | `…/scratchpad/p12/v2/majeurs-4525.log`, `…/majeurs2-4525.log` | Lignes Majeur R2-M1, M2e, M3a–h, M7c–e, API-01, API-05, API-08, UI-12 rejouées |
| [expiry] | `…/scratchpad/p12/v2/expiry-4525.log` | Session forcée expirée dans ma base ; hachés de session et code `scrypt$…` en base |
| [https] | `…/scratchpad/p12/v2/https-4526.log` | 6e mauvais jeton d’installation → 429, origine http → 403, bon jeton tapé en minuscules avec espaces → cookie `Secure` |
| [doc] | `…/scratchpad/p12/v2/docdiff.log` (script `docdiff.mjs`) | Index et sections de `docs/API.md` contre [inv] ; colonne « Session » contre la règle de `session.ts` |
| [upgrade] | `…/scratchpad/p12/v2/server-4525-upgrade.log`, `…/banner-4525.log` | Base marquée 0.8.0 puis relancée : actions 0.9.0 et 0.11.0 dans les logs et la page admin ; `PUT upgrade-actions` |
| [frame] | `…/scratchpad/p12/v2/frame.log`, `frame-localhost.png`, `frame-127.0.0.1.png`, `frame.mjs`, `frame-site/server.mjs`, `headers-4525.txt` | Admin encadré par une page d’un autre port du même hôte (V2-m1) |
| [leak] | `…/scratchpad/p12/v2/leak-4525.log` | Dossier d’images en lecture seule : réponse de `admin/upload-image` (renvoi axe 3) |
| [vitest] | `…/scratchpad/p12/v2/vitest-security.log` | `api-doc`, `session`, `hooks.server`, `csrf`, `access-code` (route), `login-attempts`, `body`, `paths` : 8 fichiers, 122 tests verts |
| [hist] | `…/scratchpad/p12/v2/security-core-log.txt` | `git log 9df0d08c..cf48032d` du cœur de sécurité : 22 commits |
| [srv] | `…/scratchpad/p12/v2/server-4525.log`, `server-4526.log`, `cleanup.log`, `worktree-list-after.txt` | Logs, arrêts vérifiés par PID, worktree supprimée |

`…` = `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214`.

## 1. Résumé

- 149 verdicts : **137 fait**, **7 fait autrement**, **4 pas fait**, **1 sans objet**, 0 partiel, **0 régressé**.
  - Traçabilité de l’audit, 107 lignes : 103 fait, 3 fait autrement, 1 sans objet.
  - Constats de l’audit a2 m1 à m9 : 9 fait. Points restés ouverts : 2 fait.
  - Critères d’API-07, API-09 et BUG-17 : 3 fait.
  - 28 points « Trouvé pendant » de ces tâches : 20 fait, 4 fait autrement, 4 pas fait (connus, sans tâche ni décision, voir section 4).
- Régressions : aucune. Le diff du cœur de sécurité depuis l’audit (22 commits, [hist]) ne rouvre rien : la matrice complète passe.
- Nouveaux constats : 0 Critique, 0 Majeur, **1 Mineur**, ajouté par le vérificateur : **V2-m1**, l’app se laisse encadrer (iframe) avec la session par une page du même site, ce qui permet de détourner des clics sur l’admin (« Wipe All Data »). Régression : non.
- L’auditeur ne rapportait aucun constat. Ses verdicts tiennent, sauf 5 points « Trouvé pendant API-09 » (section 5).

## 2. Traçabilité (passe 1)

### Revue 2

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R2-C1a | `handle` ne fait que les migrations | Corrigé | fait | `src/hooks.server.ts:107` (`handleRequest` : origine, puis `authenticate`), `src/lib/server/session.ts:56,67` ; [matrix] 65/65 écritures et 4/4 form actions → 401 sans session |
| R2-C1b | `POST /api/access-code` sans cookie ni session | Corrigé | fait | `features/settings/service.ts:66` (`logIn` → `createSession`) ; [auth] `Set-Cookie: cellar_session=…; HttpOnly; SameSite=Lax` ; [expiry] 4 sessions en base, toutes en haché de 64 hex |
| R2-C1c | État connecté = `sessionStorage` | Corrigé | fait | `src/lib/stores/auth.svelte.ts:40` lit `/api/session` ; [api2] `GET /api/session` sans cookie → `{"authenticated":false}` |
| R2-C1d | Timeout côté client seulement | Corrigé | fait | `session.ts:118` ; [expiry] session expirée en base → `{"authenticated":false}` puis 401 |
| R2-C1e | `PUT /api/settings` ouvert | Corrigé | fait | [matrix] 401 sans session ; [api] avec session 200 `{"sessionTimeoutHours":12}` |
| R2-C1f | Cookie `SameSite=Strict` | Écart décidé | fait autrement | Décision « Cookie de session (SEC-02) » ; `session.ts:31` ; [auth] `SameSite=Lax` |
| R2-C2a | `csrf.checkOrigin: false` | Corrigé | fait | `src/lib/server/csrf.ts:24` ; [matrix] `Origin` étranger 69/69, `null` 69/69, autre port 69/69 → 403 |
| R2-C2b | `request.json()` accepte `text/plain` | Corrigé | fait | [api2] `text/plain` sans `Origin` → 403 de SvelteKit ; inter-sites → 403 `cross_site_request` ([matrix]) |
| R2-C2c | Définir `ORIGIN` ou les en-têtes du proxy | Corrigé | fait | `server.js` (en-têtes écrasés à chaque requête), `docker-compose.yml:22` ; [matrix] hôte forgé 69/69 → 403 ; [https] origine http face à un `ORIGIN` https → 403 |
| R2-M1 | Fichier temporaire au chemin du `prefix` de `barcode/csv` | Corrigé | fait | `api/barcode/csv/+server.ts` en mémoire ; `features/barcode/service.ts:89` (`checkedPrefix`) ; [maj] génération auto coupée : `prefix "/../../x"` → 422 `invalid_barcode_prefix` ; génération auto active : `prefix` ignoré (documenté), CSV `WINE…` en mémoire |
| R2-M1b | Même chose pour `pdf-labels` | Corrigé | fait | `api/barcode/pdf-labels/+server.ts` en mémoire ; [maj] marges invalides → 422 avant tout rendu |
| R2-M2a | Code `1234` en clair | Corrigé | fait | `access-code.ts:124-144` ; [expiry] valeur en base `scrypt$N=32768,r=8,p=1$…` |
| R2-M2b | Le `GET` crée les réglages | Corrigé | fait | `features/settings/service.ts:44-48` (lecture seule ; ne fait que journaliser le jeton d’installation) |
| R2-M2c | Comparaison `===` non constante | Corrigé | fait | `access-code.ts:92`, `setup-token.ts:40-45`, `features/backup/token.ts:31-41` (`timingSafeEqual`) |
| R2-M2d | Aucune limite de tentatives | Corrigé | fait | `login-attempts.ts:65` ; [auth] 5 × `{"valid":false}`, 6e → 429 `Retry-After: 60` ; bon code en 7e avec `X-Forwarded-For` et `X-Real-IP` forgés → 429 |
| R2-M2e | Minimum de 4 caractères | Écart décidé | fait autrement | Décision « Code d’accès (SEC-03) » ; `api/access-code/+server.ts:18` ; [maj] nouveau code de 3 caractères → 422 |
| R2-M3a | `quantity` sans borne | Corrigé | fait | `shared/schemas/bottle.ts:98` ; [maj] 101 → 422 |
| R2-M3b | Unicité du code-barres à `quantity === 1` | Corrigé | fait | `bottles/service.ts:75,90-104` ; [api] 2 bouteilles + code → 422 `barcode_for_one_bottle` |
| R2-M3c | Corps brut à `updateWineDefinition` | Corrigé | fait | `api/definitions/[id]/+server.ts:15-17` ; [api] `id: "forced"`, `createdAt` ignorés au POST |
| R2-M3d | Un `type` inconnu crée un type | Corrigé | fait | [maj] `typeId` inconnu → 409 `missing_reference` ; `type: "Brand new type"` ignoré, 5 types avant et après |
| R2-M3e | `pageFormat` inconnu → 500 | Corrigé | fait | `schemas/label.ts:11` ; [maj] `B9` → 422 |
| R2-M3f | Marges négatives | Corrigé | fait | `schemas/label.ts:7` ; [maj] −5 → 422 |
| R2-M3g | `name.trim()` sur une non-chaîne | Corrigé | fait | `schemas/reference.ts:5` ; [maj] `[1]` et `{name: 5}` → 422 |
| R2-M3h | `startNumber` en chaîne | Corrigé | fait | `schemas/label.ts:38` ; [maj] `"5"` → 422 |
| R2-M4a | Corps illimité, `formData()` avant contrôle | Corrigé | fait | `http/body.ts:31,106` ; [api] `Content-Length` 30 Mo → 413 ; JSON de 2 Mo → 413 avec et sans session ; form action de 2 Mo → 413 |
| R2-M4b | MIME et extension pris au client | Corrigé | fait | `server/upload.ts:14` ; [api] HTML nommé `.png` → 422, SVG → 422, PNG annoncé `text/html` → 201 `type: image/png` |
| R2-M4c | Pas de `nosniff` | Corrigé | fait | `routes/uploads/[...path]/+server.ts:26` ; [api] `x-content-type-options: nosniff` |
| R2-M5 | `PUT /api/bottles/[id]` remplace tout | Écart décidé | fait | Décision « Mises à jour des bouteilles (API-05) » du 2026-10-17, appliquée par API-07 ; [api] PUT → 405 JSON, `Allow: PATCH, DELETE` ; absent de [inv] |
| R2-M6a | Filtres de `/api/wines` sans effet | Corrigé | fait | `api/wines/+server.ts:5` ; [api] `?sortField=__proto__` → 200 |
| R2-M6b | La page vin charge tout le catalogue | Corrigé | fait | `routes/wines/[id]/+page.server.ts:10-18` |
| R2-M7a | DELETE d’un conteneur case par case | Corrigé | fait | `storage/service.ts:240-243` (transaction) ; [maj] conteneur dont une case a une bouteille → 409, rien supprimé |
| R2-M7b | POST et PUT des conteneurs hors transaction | Corrigé | fait | `storage/service.ts:210-235` (une transaction) ; tests `storage-containers/server.test.ts` (portes) |
| R2-M7c | DELETE d’une définition ou case utilisée → 500 | Corrigé | fait | [maj] 409 `in_use` (`details.bottleCount`), 409 `case_holds_bottles` |
| R2-M7d | `caseIds` d’un autre conteneur | Corrigé | fait | `storage/service.ts:215` ; [maj] → 404 « Case not found in this container » |
| R2-M7e | `capacity` ignorée au POST | Corrigé | fait | [maj] capacité 1 : 2e bouteille → 409 `case_full` `{caseName, capacity, bottles}` |
| R2-m1 | Occupation des cases incohérente | Corrigé | fait | `storage/repository.ts:142` (`caseLoads`) |
| R2-m2 | N+1 dans `barcode/csv` | Corrigé | fait | `barcode/repository.ts:180-181` (`inArray`) |
| R2-m3 | Fichiers temporaires inutiles | Corrigé | fait | `attachmentResponse` dans les routes de téléchargement (relu) ; [api] `download-backup` en flux avec `Content-Length` |
| R2-m4 | CSV mal échappé, formules | Corrigé | fait | `src/lib/server/csv.ts:13-45` |
| R2-m5a | Erreurs hors format (404, 405, 403) | Partiel | fait | `hooks.server.ts:93-103` ; [api] `GET /api/nope` (même `Accept: text/html`) → 404 JSON, `HEAD /api/nope` → 404, `DELETE /api/wines` → 405 `Allow: GET, HEAD`, `POST /api/statistics` → 405 JSON. Partie 403 : documentée (DOC-03), [api2] texte et `{"message"}` comme le dit `docs/API.md`. `GET /api` sans barre : section 4 |
| R2-m5b | Conflit de code-barres en 400 | Corrigé | fait | Lu : `db-errors.ts` (`duplicate_barcode` → 409) ; test `bottles/server.test.ts` (portes) |
| R2-m5c | DELETE en 200 `{message}` | Corrigé | fait | [api] 204 sans corps : `admin/images`, `admin/wine-definitions/{id}` ; `lookup-crud.ts:163-166` |
| R2-m6a | Quatre fichiers `wine-*` identiques | Corrigé | fait | `lookup-crud.ts:148-167` ; `api/countries/+server.ts` réexporte |
| R2-m6b | POST `/api/wines` en double | Corrigé | fait | [inv] `GET` seul |
| R2-m6c | `/api/wines/[id]` sans appelant | Corrigé | fait | Absent de [inv] |
| R2-m6d | Référentiels sous `/api/admin` | Corrigé | fait | [inv] aucun |
| R2-m7 | `pdf-labels` de 541 lignes | Corrigé | fait | Route de 11 lignes (relue) |
| R2-m8 | `uploads` : `resolve` inutilisé, EISDIR | Corrigé | fait | `paths.ts:40` (`resolveInDir`) ; [api] 12 variantes (`..%2f`, `%2e%2e`, `..%5c`, `%252e`, `%00`, `.DS_Store`, dossier, `//etc/passwd`) → 404 |
| R2-m9 | Répertoire vide `api/test-barcode` | Corrigé | fait | Absent de [inv] |

### Revue 1 (M3)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R1-M3a | 38 routes interrogent la base | Corrigé | fait | `eslint.config.js:51-72` ; `grep -E "server/db/|drizzle-orm|/repository|better-sqlite3" src/routes` hors tests et `import type` : vide |
| R1-M3b | CRUD des presets réimplémenté | Corrigé | fait | `api/admin/label-presets/[id]/+server.ts:10-23` appelle `features/labels/service.ts` |

### Revue 3 (C0)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R3-C0a | Aucun hook ne protège `/api/admin/*` | Corrigé | fait | `session.ts:56-58` (sur `route.id`) ; [matrix] 10 lectures × GET, HEAD, OPTIONS → 401 ; `/api/%61dmin/…` → 401 |
| R3-C0b | POST inter-sites vers wipe-database | Corrigé | fait | [matrix] 401 sans session, 403 `Origin` étranger ou `null` ; [api2] jeton cron → 401 |

### Revue 4 (C1)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R4-C1 | Garde admin décorative | Corrigé | fait | `admin/+layout.server.ts`, chaque page admin, `barcode/+layout.server.ts`, `barcode/+page.server.ts:13` (`await parent()`) ; [auth] 9 pages → 303 `/wines?login` ; 99 `__data.json` sans session, 0 donnée admin |

### Revue 5 (M5)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R5-M5 | Mises à jour groupées par N PUT | Corrigé | fait | `components/bottles/bottle-changes.svelte.ts:60` (un `PATCH /api/bottles`, garde `sending`) ; [api] `PATCH /api/bottles` de 2 ids → 200 |

### Revue 7 (C1)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R7-C1a | Auth en `sessionStorage` | Corrigé | fait | Voir R2-C1a, R2-C1c |
| R7-C1b | `checkOrigin: false` | Corrigé | fait | Voir R2-C2a |
| R7-C1c | wipe vidable par `fetch(no-cors)` | Corrigé | fait | `csrf.ts:24-38` ; [matrix] wipe : 401 sans cookie, 403 avec `Origin` étranger, `null` ou autre port |
| R7-C1d | Code par défaut `1234` | Corrigé | fait | `settings/service.ts:80-104` ; [https] 5 mauvais jetons → 403, 6e → 429, bon jeton `" u3hj - z825 - 42uy "` → 200 + cookie ; [auth] 2e choix → 409 `access_code_already_set` |
| R7-C1e | `ORIGIN` dans docker-compose | Corrigé | fait | `docker-compose.yml:22` (`${ORIGIN:?…}`) |

### SEC-01

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-01 | Inter-sites → 403 ; l’app marche depuis son URL | Corrigé | fait | [matrix] 69/69 × 4 variantes inter-sites → 403 ; [api] toute l’API utilisée depuis `ORIGIN` ; CI `scripts/check-origin.mjs` (portes) |

### SEC-02

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-02 | Sans cookie, toute mutation et `/api/admin/**` → 401 | Corrigé | fait | [matrix] 69 + 65 + 30 + 10 + 7 contrôles sans session, seule `POST /api/access-code` passe (422 sur `{}`) |

### SEC-03

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-03 | Code jamais en clair ; 6e tentative → 429 | Corrigé | fait | [expiry] `scrypt$…` ; [auth] ; [https] ; [vitest] `access-code/server.test.ts` |

### SEC-05 (partie publique)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-05 | Helper testé ; routes passent par lui | Corrigé | fait | `paths.ts:40`, `backup/files.ts:95` (`resolveBackupFile` : `BACKUP_FILE` puis `resolveInDir`) ; [vitest] `paths.test.ts` ; [api] `download-backup` (8 noms), `delete-backup`, `restore`, `import-json` (4 noms chacun, dont `cellar.db`) → 422 ou 404, jamais un fichier hors sauvegardes |
| SEC-05/préfixe | `^[A-Za-z0-9-]{0,6}$` | Corrigé | fait | `barcode/service.ts:89` ; [api] `barcode-settings` `../x` → 422 ; [maj] `barcode/csv` → 422 (génération coupée) |
| SEC-05/uploads | `isFile()` et `nosniff` | Corrigé | fait | Voir R2-m8 et R2-M4c |

### SEC-06 (partie publique)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-06/taille | `Content-Length` avant `formData()` | Corrigé | fait | Voir R2-M4a |
| SEC-06/contenu | Images reconnues par leurs octets | Corrigé | fait | Voir R2-M4b ; [api] zip avec `../../evil.png` refusé en entier (422) |

### API-01

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| API-01 | Plus de `request.json()` sans schéma ; 422 jamais 500 | Corrigé | fait | Seul `http/body.ts` lit les corps (relu) ; [maj] JSON cassé → 400 `malformed_body`, tableau → 422 avec `details` |
| API-01/Trouvé-1 | Au-delà de `BODY_SIZE_LIMIT`, 500 | Corrigé | fait | `http/body.ts:13-16,31-51` ; [vitest] `body.test.ts` |
| API-01/Trouvé-2 | `PUT /api/settings` sans réglage | Corrigé | fait | [api] base neuve, PUT → 200 |
| API-01/Trouvé-3 | PUT → 500 sur non-JSON ; `it.fails` | Corrigé | fait | Test `settings/server.test.ts` (portes) |
| API-01/Trouvé-4 | `as any` de `createMultipleWineBottles` | Sans objet | sans objet | Fonction absente |
| API-01/Trouvé-5 | L’import CSV insère toutes les colonnes | Corrigé | fait | `features/shared/imported-rows.ts:21` (`ROW_SCHEMAS`) |
| API-01/Trouvé-6 | Erreurs anglaises affichées telles quelles | Corrigé | fait | `shared/api-error.ts:5` (liste fermée) |
| API-01/Trouvé-7 | Définition sans appellation → 500 | Corrigé | fait | [maj] → 422 `details[0].path = appellationId` |
| API-01/Trouvé-8 | Ligne relue après écriture → 500 | Corrigé | fait | `lookup-crud.ts:89` (dans la transaction) |
| API-01/Trouvé-9 | Espacements non numériques | Corrigé | fait | `schemas/label.ts:7` |
| API-01/Trouvé-10 | Case inexistante → 500 | Corrigé | fait | Test `bottles/[id]/server.test.ts` (portes) |
| API-01/Trouvé-11 | Imports qui réparent différemment | Corrigé | fait | `imported-rows.ts` partagé |
| API-01/Trouvé-12 | Code-barres ni texte ni nombre → 500 | Corrigé | fait | [maj] `barcode: {}` → 422 |

### API-02

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| API-02 | Aucune route n’importe la base | Corrigé | fait | Voir R1-M3a |
| API-02/Trouvé-1 | Écritures hors transaction | Corrigé | fait | `bottles/service.ts:90-104` (`keepingCasesWithinCapacity`), `settings/service.ts:80-104` |
| API-02/Trouvé-2 | PUT barcode-settings hors transaction | Corrigé | fait | `barcode/service.ts` `updateBarcodeSettings` (relu) |
| API-02/Trouvé-3 | Course export préalable / import JSON | Corrigé | fait | `hooks.server.ts:24-28,117-120` ; `write-gate.ts:39` ; `json-import.ts:179` |
| API-02/Trouvé-4 | `download-backup` tout en mémoire | Corrigé | fait | `backup/service.ts:174` (`Readable.toWeb`) ; [api] zip de 51 062 octets avec `Content-Length` |

### API-05

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| API-05 | Statut de 10 bouteilles atomique | Corrigé | fait | [maj] 10 001 ids → 422 ; id fantôme → 404 `details.ids: ["ghost"]`, notes inchangées (`null`) |
| API-05/Trouvé-1 | « Hors cave » envoie l’objet entier | Corrigé | fait | `bottle-changes.svelte.ts:29-39` (`newStatus`) |
| API-05/Trouvé-2 | Bouteille supprimée restée sélectionnée | Corrigé | fait | `routes/out-of-cellar/+page.svelte` (`onMissing`) |

### API-06

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| API-06 | Moins d’endpoints, pas de régression | Corrigé | fait | [inv] ; [doc] 103/103 |
| API-06/Trouvé-1 | `Content-Disposition` cassé | Corrigé | fait | `content-disposition.ts:21-24` ; [api] nom `é€🍷 "q"` → `filename="cellar-backup-___ _q_-…"; filename*=UTF-8''…` |
| API-06/Trouvé-2 | `startNumber`, `count` non typés | Corrigé | fait | Voir R2-M3h |
| API-06/Trouvé-3 | `__proto__` accepté | Corrigé | fait | `admin/export-csv/+server.ts:14` ; [api2] `__proto__` et `constructor` → 422 « Unknown table » |
| API-06/Trouvé-4 | `validateBarcodeSettings` inutilisé | Corrigé | fait | `grep` vide |
| API-06/Trouvé-5 | Enregistrement d’image en double | Corrigé | fait | `images/service.ts:207` (`saveImage`) |
| API-06/Trouvé-6 | Import `createWineBottle` inutilisé | Corrigé | fait | `api/bottles/+server.ts` (relu) |
| API-06/Trouvé-7 | Imports inutilisés, `substr` | Corrigé | fait | Lint des portes exit 0 |
| API-06/Trouvé-8 | Préfixe `cellar-export-` écrit 3 fois | Corrigé | fait | `backup/files.ts:25` |
| API-06/Trouvé-9 | « Unknown Appellation/Region » | Corrigé | fait | `grep "'Unknown" src/lib/server` : seulement `'Unknown error'` (`images/service.ts:266,344`) |
| API-06/Trouvé-10 | Remise à zéro des modèles sans page | Corrigé | fait | `restore-label-presets` absent de [inv] |
| API-06/Trouvé-11 | `/api/wines` lit `sortField` | Corrigé | fait | Voir R2-M6a |
| API-06/Trouvé-12 | `csrf.ts` recouvre SvelteKit 3 | Écart décidé | fait autrement | Décisions « Contrôle CSRF maison (SEC-01, DEP-03) » et « Endpoints et CSRF (API-06) » ; [vitest] `csrf.test.ts` |
| API-06/Trouvé-13 | Chemin du serveur exposé | Corrigé | fait | [api] `list-backups` en noms de fichiers. Une autre réponse expose encore un chemin : renvoi axe 3 (section 7) |
| API-06/Trouvé-14 | `admin/images` remet `imageId` à NULL | Corrigé | fait | `db/schema.ts:102` (`onDelete: 'set null'`) |
| API-06/Trouvé-15 | GET `/api/admin/auto-backup` | Corrigé | fait | [inv] POST seul |

### Compléments

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| UI-10/Trouvé-SEC02a | `?login` reste dans l’URL | Corrigé | fait | `components/layout/LoginDialog.svelte:126-129` |
| DATA-05/Reste-cron | Mode cron | Corrigé | fait | [api2] commande documentée : mode interne → 409 `cron_backups_disabled`, mode cron → 200 `files.backup`/`files.export`, `bearer` en minuscules → 200, mauvais jeton → 401, ancien jeton après régénération → 401, jeton sur `PUT /api/settings` et wipe → 401 ; [api] jeton sur `create-backup`, `list-backups` → 401 |

### Constats de l’audit (a2 m1 à m9)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| a2 m1 | Routes sans appelant | fait | Décisions « Endpoints et CSRF (API-06) », « Chargement côté serveur (UI-04) », « Page stockage (UI-09) » (2026-10-17 : API publique documentée), « Mises à jour des bouteilles (API-05) » ; [doc] 103 couples, chacun avec sa section, colonne « Session » conforme |
| a2 m2 | Baisser la durée n’écourte pas les sessions | fait | `en.json:854`, `fr.json:854` (« Un changement vaut pour les prochaines connexions… changez le code d’accès ») ; `session.ts:95` |
| a2 m3 | POST remplace le code donné en mode auto | fait | Décision « Code-barres donné en mode automatique (BUG-19) » ; [api] `MANUAL-1` gardé en mode auto |
| a2 m4 | Bouteille créée bue reçoit un code | fait | `bottles/service.ts:95-96` ; [api] 2 bouteilles `consumed` → `[null, null]` |
| a2 m5 | Deux DELETE, deux contrats | fait | `api/admin/wine-bottles/[id]/+server.ts:5-8` appelle `deleteWineBottle` ; [api] id inconnu → 404 par les deux routes |
| a2 m6 | Réponses incohérentes | fait | [api] `wines/nope/locations` → 404 ; 409 `in_use` avec `details.bottleCount` ; PUT `settings`, `backup-settings`, `barcode-settings` (avec `conflictInfo`), `admin/images` → valeur enregistrée ; wipe → `{"backup"}` ; `POST /api/bottles` → `{bottles, count}` ; `upload/image` sans `success` ; [upgrade] `PUT upgrade-actions` → l’action enregistrée |
| a2 m7 | `backup-token` hors `apiHandler` | fait | `api/admin/backup-token/+server.ts:6` |
| a2 m8 | Formes multiples, replis morts | fait | [api] `GET /api/definitions/{id}` : 19 clés, sans `appellations`/`regions`/`countries` ; `'Unknown'`/`'Standard'` absents ; `checkBarcodeForOneBottle` unique (`bottles/service.ts:75`) |
| a2 m9 | Commentaires et noms trompeurs | fait | `uploads/[...path]/+server.ts:18,23-25` ; `exportBarcodes`/`exportManualBarcodes` suivent leurs routes (`barcode/service.ts:220,229`) ; `caseCapacitySchema` (`schemas/storage.ts:19`) ; `BOTTLE_SORT_COLUMNS` absent |

### Points restés ouverts de l’audit

| Point | Verdict | Preuve |
|---|---|---|
| Réponses hors `apiHandler` (R2-m5a, UI-07/Trouvé-11, UI-07/Reste-2) | fait | Voir R2-m5a |
| Décision sur les routes sans appelant (m1, UI-04/Reste-2, UI-09/Reste-7b, UI-07/Reste-5, retrait de PUT) | fait | Voir a2 m1 et R2-M5 |

### API-07 · Contrat de l’API figé pour la 1.0

Critère : « `PUT /api/bottles/{id}` répond 405, et l’action « scripts » s’affiche à la mise à jour. Chaque route du document a un test de route. Le document et les décisions UI-04, UI-09, API-05 et API-06 disent la même chose. » Verdict : **fait**.

- PUT → 405 JSON, `Allow: PATCH, DELETE` ([api]).
- Action affichée, rejouée par le vérificateur (l’auditeur ne l’avait pas fait) : ma base marquée 0.8.0 puis relancée, les logs listent l’action 0.9.0 (« Scripts that call `PUT /api/bottles/{id}` must switch to `PATCH`… ») et celle de 0.11.0. La page `/admin/settings` contient les deux textes ([upgrade]).
- Tests de route : chaque dossier de `src/routes/api` a son `server.test.ts`, sauf les 16 dossiers des référentiels (couverts par `features/shared/lookup-crud.test.ts`) et 4 routes testées depuis le fichier d’une route sœur : `barcode/export-all/server.test.ts:5`, `barcode/stats/server.test.ts:7`, `admin/backup-settings/server.test.ts:4`, `admin/label-presets/server.test.ts:8`. [vitest] `api-doc.test.ts` vert.
- Décisions UI-04, UI-09, API-05 et API-06 (version du 2026-10-17) : API publique documentée, sans PUT. [doc] 103 couples dans l’index, 103 dans le code, 0 écart.

| Point « Trouvé pendant API-07 » | Verdict | Preuve |
|---|---|---|
| 1. Nom d’un référentiel comparé avec la casse | fait | API-08 ; `lookup-crud.ts:89` ; [maj] `POST {"name":"fRANCE"}` → 200 avec la ligne `France`. Le PUT reste sensible à la casse : section 4 |
| 2. UI-09 : unicité, espace gardé, conteneur dans l’export | fait | UI-12 ; [maj] nom de conteneur en double → 409 `duplicate_container` (le reste relève de l’axe 6) |
| 3. Restauration : réglages et actions | fait | DATA-12 ; test `admin/restore/instance-settings.test.ts` (portes) |
| 4. Cinq PUT `{success: true}` | fait | API-09 ; [api], [upgrade] |
| 5. `import-images-zip` accepte `.bmp` | fait | DATA-13 ; `images/service.ts` (`detectImageType` par entrée) ; [api] zip avec `old.bmp` et `../../evil.png` → 422 |
| 6. `backup-token` hors `apiHandler` | fait | Voir a2 m7 |
| 7. 422 sans `details` | fait | [api] `upload/image`, `download-backup`, `delete-backup`, `restore`, `import-json`, `import-images-zip` → `details[{path, message}]` |
| 8. Ancien préfixe > 6 → 500 | fait | BUG-19 ; `http/handler.ts:23-25` (409 `barcode_prefix_too_long`) |
| 9. next-barcode éteint → 200 vide | fait | [api] 409 `barcode_generation_off` |
| 10. Préfixe par `LIKE` | fait | BUG-19 (relu dans `barcode/repository.ts`) |
| 11. `LIMIT 10` avant le groupe sans nom | fait | UI-11 ; `bottles/repository.ts:351-363` (`isNotNull(producer)` avant `limit(10)`) |
| 12. Pas d’`ORDER BY` | fait autrement | Décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) » (API-07/12 accepté) ; `docs/API.md` : « in no particular order » |
| 13. Garde inatteignable de `getWineShortages` | fait | UI-11 ; `bottles/service.ts` relu |
| 14. URL d’image non encodées | fait | `paths.ts:19-21` ; [api] `/uploads/wines/renamed%20%231.png` → 200 `image/png` |
| 15. 10 Mo contre 20 Mo | fait | `docs/API.md` « Size limits » (20 Mo par image partout) |
| 16. `updatedDefinitions` faux | fait autrement | Décision « Tâches de l’audit… » (API-07/16 informatif) ; le champ n’existe plus : [api] PUT renvoie l’image |
| 17. Test `.zip` sensible à la casse | fait | Décision « Tâches de l’audit… » (réglé en P7/P8) ; `restore` et `import-json` prennent `{filename}` ou `application/zip` (`http/body.ts:125-133`) |
| 18. POST ignore le code en mode auto | fait | Voir a2 m3 |
| 19. PUT de préréglage inconnu → 422 avant 404 | fait | `api/admin/label-presets/[id]/+server.ts:17-19` (`getLabelPreset` avant `parseBody`) |

### API-09 · API : format des réponses et cohérence

Critère : 404 et 405 au format, PUT qui renvoient la valeur, 201/204 du résumé 0.7.0, 404 par les deux DELETE, `?file=` → 422 et action 0.11.0, prix négatifs refusés et réparés, `api-doc.test.ts`. Verdict : **fait** pour la partie API, rejouée en direct ([api], [api2], [upgrade]) :

- `GET /api/nope` → 404 `not_found` JSON. `DELETE /api/wines` → 405 `method_not_allowed`, avec `Allow: GET, HEAD` (avec session) ; sans session, 401, comme le dit `docs/API.md`.
- PUT `settings`, `backup-settings`, `barcode-settings` (`conflictInfo`), `upgrade-actions` et `admin/images` → la valeur enregistrée. `PUT /api/access-code` → 204, corps de 0 octet.
- `DELETE admin/wine-definitions/{id}` et `DELETE admin/images` → 204 ; `POST admin/upload-image` → 201 ; `import-images-zip` → 201 dans le rapport de l’auditeur, 422 dans ma sonde (mon zip contenait `../../evil.png`, refusé en entier, voir SEC-06/contenu).
- Bouteille inconnue → 404 par les deux routes ; `wines/{id}/locations` d’un vin inconnu → 404.
- `download-backup?file=` → 422 ; `?filename=` → 200, zip avec `Content-Length`.
- Prix ou valeur négatifs → 422 par `POST /api/bottles`, `PATCH /api/bottles` et `PATCH /api/bottles/{id}`.
- `non-consumed` → `definition` ; `GET /api/wines` → `{definition, bottles}`, sans `definition` dans les bouteilles ; `GET /api/definitions/{id}` → `appellation` seul.
- Chaque phrase de l’action « scripts » de 0.11.0 (`releases.json`) correspond à une réponse mesurée ([api], [upgrade]).
- Hors de l’axe 2, non rejoués ici : le message sous le champ (axe 5) et la réparation des imports et de la base. Pour celle-ci, la migration `drizzle/0015_repair_negative_prices.sql` existe et des tests la couvrent (`db/migrations.test.ts`, `admin/import-csv/server.test.ts`, `admin/import-json/server.test.ts`), verts dans les portes.

| Point « Trouvé pendant API-09 » | Verdict | Preuve |
|---|---|---|
| `success` et `message` restent dans 9 réponses | pas fait | Aucune décision ni tâche. Vu en direct : `create-backup`, `admin/upload-image`, `auto-backup`, `export-csv` ([api], [api2]) ; `docs/API.md` les décrit. Section 4 |
| Message 409 « in the cellar » qui compte les bues | pas fait | Aucune décision. [api] « This wine has 4 bottles in the cellar » pour 2 bues et 2 en cave ; `catalog/service.ts:109-118`. Section 4 |
| Erreurs des champs sans `aria-describedby` | fait | Fait en P10 (BUG-16/5, ROADMAP ligne 2314) : `components/forms/FormField.svelte:36-48` (`aria-describedby`, `aria-invalid`), commits 52ea2a8e et 23d2239b. Le rendu reste à l’axe 5 |
| `GET /api` sans barre finale → 404 HTML | pas fait | Aucune décision. [api] `GET /api` → 404 `text/html` ; `GET /api/` → 404 JSON (`hooks.server.ts:95`, `startsWith('/api/')`). Section 4 |
| Références cassées → vin absent des listes, 404 | pas fait | Aucune décision : conséquence des jointures internes d’API-09, sur une base modifiée à la main seulement. Section 4 |
| Ligne de réparation coupée vers 5 000 caractères | fait autrement | Décision « Longueur des textes (DATA-10) » (textes coupés sans le signaler) ; résumé 0.11.0 |

### BUG-17 · Une note de consommation remplace les notes

Critère : « Consommer des bouteilles avec une note garde leurs notes existantes, suivies de la nouvelle, dans les quatre écrans de changement de statut. » Verdict : **fait**.

- [api] `PATCH /api/bottles {ids: [b1, b2], changes: {availability: "consumed"}, addedNote: "Drunk with Paul"}` → `["Gift from Marie\nDrunk with Paul", "Drunk with Paul"]`.
- Les quatre écrans passent par le même code : `BottleStatusDialog` dans `routes/wines/[id]/+page.svelte:420`, `routes/out-of-cellar/+page.svelte:135` et `components/bottles/BottleDetailsDialog.svelte:217` ; `components/barcode/BulkBarcodeDialog.svelte:208` appelle `newStatus`, qui envoie `addedNote` (`bottle-changes.svelte.ts:29-39`). Parcours e2e « consume a bottle » vert (portes).

| Point « Trouvé pendant BUG-17 » | Verdict | Preuve |
|---|---|---|
| Pas de garde contre le double envoi | fait | UI-13 ; `bottle-changes.svelte.ts:60` (`sending`) |
| Nouvel essai après une réponse perdue : note ajoutée deux fois | fait autrement | Décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) », 2026-10-23 : accepté |
| Dialogue de statut copié dans quatre écrans | fait | UI-13, décision « Dialogue de statut partagé (UI-13) » ; un seul `BottleStatusDialog` |

## 3. Nouveaux constats (passe 2)

Cherché d’abord dans les changements de P7 à P11 ([hist]) : `withoutBody` pour Paraglide, réécriture 404/405, `Vary` retiré sur `/uploads/`, wipe ajouté aux routes qui retiennent les écritures, corps lus en flux limité, restauration par nom. La matrice complète passe après ces changements ([matrix], [auth], [https]).

Contrôles faits sans défaut :

- **Inventaire et document** : 103 couples dans le code, 103 dans l’index de `docs/API.md`, 103 sections, colonne « Session » égale à la règle de `session.ts:56-61` ([doc]).
- **Sessions** : expiration en base ([expiry]), déconnexion puis cookie réutilisé → 401 ([auth]), `Secure` derrière un `ORIGIN` https ([https]).
- **Jeton cron** : il n’ouvre que `auto-backup` ; ancien jeton refusé après régénération ([api2]).
- **Corps trop gros** : 413 avant lecture pour JSON, multipart et form action, avec ou sans session ([api]).
- **Traversées** : `/uploads` (12 variantes), `download-backup` (8), `delete-backup`, `restore` et `import-json` (4 chacun, dont `cellar.db`, qui est dans le même dossier que les sauvegardes), renommage d’image (`.html`, `../`, `.x.png`), noms de sauvegarde (`../evil`, `auto-x`, CRLF), `customName` d’export CSV (`../x`, CRLF), entrée de zip `../../evil.png` ([api], [api2]).
- **XSS** : 6 `{@html}`, tous avec des messages des fichiers de langue et des arguments constants (`ZipImportResultsDialog.svelte:152`, `ZipImportInfoDialog.svelte:46,61,78,94`, `CsvImportResultsDialog.svelte:289`) ; aucun `innerHTML`, `DOMParser`, `document.write` ; `InlineMarkdown` ne rend que des éléments, liens limités à `https?://` (`utils/inline-markdown.ts:8`), et ne lit que `releases.json` ; site d’un vin par `safeUrl` (`utils/url.ts:8`, `wines/[id]/+page.svelte:216`), `javascript:` refusé par l’API (422). Aucune valeur de la base n’atteint un `{@html}`.
- **Paramètres de requête** : valeurs absurdes sur `/api/appellations`, `/api/regions`, `/api/wines`, `/api/bottles`, `/cellar-history`, `/out-of-cellar`, `/wines` → 200 ; ids inconnus → 404 ; paramètres passés à Drizzle en valeurs liées ([api]).
- **Corps d’erreur** : 500 générique `internal_error` (`http/handler.ts:38-43`), sans pile ni chemin, sauf le cas renvoyé à l’axe 3 (section 7).
- **Form actions** : même garde (401 sans session, 403 inter-sites, 413) que l’API ([matrix], [api]).

### Régressions

Aucune.

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

**V2-m1. L’app se laisse encadrer avec sa session par une page du même site : clics détournés sur l’admin** (ajouté par le vérificateur)

- Ce qui se passe : aucune réponse ne porte `X-Frame-Options` ni de CSP `frame-ancestors` ([frame] `headers-4525.txt` : `/wines` et `/admin/settings` n’envoient que `content-type`, `etag`, `vary`). `SameSite=Lax` n’envoie pas le cookie dans un iframe d’un autre site, mais l’envoie dans un iframe du **même site**. Pour un navigateur, deux ports du même hôte sont le même site : sur un NAS, Cellar (`http://192.168.1.20:3005`) partage son site avec toutes les autres apps du NAS (`:5000`, `:8080`…), et derrière un proxy avec les autres sous-domaines du même domaine. Une page piégée ou compromise sur l’une d’elles peut donc afficher l’admin de Cellar, connecté, sous un calque, et faire cliquer « Wipe All Data » puis sa confirmation, ou « Restore .zip ». Le contrôle d’origine ne sert à rien ici, car les clics partent de la page de Cellar elle-même.
- Reproduction : `node frame-site/server.mjs http://localhost:4525/admin/backups` sert sur `127.0.0.1:4527` une page avec un iframe, puis `node frame.mjs <worktree> <dossier>` (Chromium headless, connecté sur `localhost:4525`) ouvre cette page deux fois. Par `http://localhost:4527` (même site), l’iframe affiche `/admin/backups` connecté, titres « Admin Panel | Full Backup… », boutons « Restore .zip | Wipe All Data » (`frame-localhost.png`). Par `http://127.0.0.1:4527` (autre site), l’iframe est renvoyé à `/wines?login` (`frame-127.0.0.1.png`).
- Preuves : `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214/scratchpad/p12/v2/frame.log`, `…/p12/v2/frame-localhost.png`, `…/p12/v2/frame-127.0.0.1.png`, `…/p12/v2/headers-4525.txt`. L’auditeur n’a pas regardé ce point.
- Où : `src/hooks.server.ts:65-86` (`handle` ne pose aucun en-tête de réponse) ; `vite.config.ts` (pas de `kit.csp`).
- Pourquoi Mineur et pas plus : il faut une page malveillante sur le même site et plusieurs clics de l’utilisateur. Le wipe et la restauration écrivent d’abord une sauvegarde de sécurité. Enfin, la décision « Code d’accès (SEC-03) » prévoit un réseau local ou un VPN. Mais aucune décision ne couvre l’encadrement, et le point n’apparaît dans aucun document du dépôt (`git grep -i "iframe|frame-ancestors|x-frame|clickjack"` vide hors `body.ts`). La seule mention d’une CSP est une note de compatibilité du scanner (« Trouvé pendant DEP-05 », `wasm-unsafe-eval`).
- Correction possible : poser `X-Frame-Options: DENY` dans `handle` (une ligne, sur toutes les réponses), ou `Content-Security-Policy: frame-ancestors 'none'`. Garder la note de DEP-05 en tête si une CSP complète est un jour ajoutée.
- Régression : **non**. Aucun en-tête de ce type n’a jamais existé (`git log -S"X-Frame-Options"` et `git log -S"frame-ancestors"` vides), et 9df0d08c n’avait pas de `kit.csp`.

## 4. Déjà connus (vus, non comptés comme constats)

- **`GET /api` sans barre finale → page 404 HTML**, alors que `/api/` et toute route inconnue dessous répondent en JSON ([api]). Connu : « Trouvé pendant API-09 » (ROADMAP ligne 2157), confirmé en direct.
- **`PUT /api/<table>/{id}` compare les noms avec la casse** : connu, « Trouvé pendant API-08 » (ROADMAP ligne 1986). Non rejoué par le vérificateur ; `docs/API.md` (« Reference tables ») décrit les deux comportements.
- **Message du 409 `in_use` de la suppression d’un vin** : « bottles in the cellar », bues comprises ([api] : 4 pour 2 bues et 2 en cave). Connu : « Trouvé pendant API-09 ».
- **`success` et `message` restent** dans les réponses de `create-backup`, `create-export`, `restore`, `import-json`, `auto-backup`, `export-csv`, `import-csv`, `upload-image`, `import-images-zip` ([api], [api2]). Connu : « Trouvé pendant API-09 ».
- **Références cassées par une modification à la main** : vin absent des listes et 404. Connu : « Trouvé pendant API-09 ».
- **403 de SvelteKit en texte** pour une écriture sans `Origin` de type formulaire ou sans `Content-Type` ([api2] : texte, ou `{"message"}` avec `Accept: application/json`) : documenté par DOC-03 (`docs/API.md`, « Origin check »). La commande cron documentée envoie `Content-Type: application/json` (`README-Docker.md:490,498`, `BackupSettingsDialog.svelte:45`) ; la même requête sans cet en-tête reçoit ce 403 ([api]), comme le document le dit.
- **Envoi multipart chunked mesuré après sa lecture** : sans `Content-Length`, `request.formData()` lit jusqu’à `BODY_SIZE_LIMIT` (512 Mo) avant le contrôle de taille de la route (`http/body.ts:99-114`). Seulement avec une session. Noté à l’audit (R2-M4a), écrit dans `docs/API.md` (« before the server reads it when the request sends a `Content-Length` header ») ; décision « Taille des requêtes (SEC-07) ».
- **Limites acceptées du code d’accès** (éviction au-delà de 10 000 clients, compteur partagé derrière la redirection de ports de Docker) : décision « Limites acceptées (audit d’avant 1.0) ».

## 5. Corrections du vérificateur

- **Trouvé pendant API-09, « `success` et `message` restent »** : fait autrement → **pas fait**. L’auditeur citait « hors périmètre de la tâche » : ce n’est pas une décision de « Décisions prises ». Point connu, rangé en section 4.
- **Trouvé pendant API-09, « message 409 in the cellar »** : fait autrement → **pas fait**. Même raison.
- **Trouvé pendant API-09, `GET /api`** : fait autrement → **pas fait**. Même raison.
- **Trouvé pendant API-09, « références cassées »** : fait autrement → **pas fait**. Aucune entrée de « Décisions prises » ne couvre ce point ; les jointures internes viennent du « À faire » d’API-09, pas d’une décision.
- **Trouvé pendant API-09, `aria-describedby`** : « renvoi », qui n’est pas un verdict → **fait**. Fait en P10 (BUG-16/5) : `FormField.svelte:36-48`, commits 52ea2a8e et 23d2239b. L’auditeur pensait le point encore ouvert.
- **Constat ajouté** : V2-m1 (Mineur), encadrement de l’app par une page du même site.
- **Preuve précisée, R2-M1 et SEC-05/préfixe** : `barcode/csv` ne répond 422 `invalid_barcode_prefix` que si la génération automatique est coupée. Quand elle est active, le champ `prefix` est ignoré, comme le dit `docs/API.md`, et le CSV part en mémoire avec le préfixe réglé ([maj]). Pas de risque : aucun fichier n’est écrit. Le verdict ne change pas.
- **Preuve ajoutée, critère d’API-07** : l’affichage de l’action « scripts » à la mise à jour, non rejoué par l’auditeur, l’est ici ([upgrade]). Le verdict ne change pas.
- **Compte des tests rejoués** : 8 fichiers et 122 tests ici, contre 124 chez l’auditeur, dont le lot comprenait aussi le module `access-code` à la place de `paths`. Sans effet sur les verdicts.
- **Renvoi ajouté** vers l’axe 3 : réponse de `admin/upload-image` qui expose un chemin du serveur (section 7).

Aucun verdict « fait » de l’auditeur n’est cassé par une de mes sondes. Aucun « régressé » n’est à retirer, puisqu’il n’y en avait pas.

## 6. Désaccords

- **R2-m5a, « fait » ou « partiel »** : `GET /api` (sans barre) répond encore en HTML. L’auditeur et moi gardons « fait ». La correction demandée par l’audit visait les réponses « sous `/api/` », ce qui est fait, et le reste est connu (section 4). Une lecture plus stricte de « route `/api` inconnue » donnerait « partiel ». Les preuves ne tranchent pas cette question de lecture : le mainteneur en décide.
- Pas d’autre désaccord : les verdicts changés en section 5 suivent la règle de `brief-common.md` (« fait autrement » seulement avec une décision), sur laquelle les preuves suffisent.

## 7. Renvois (autres axes)

- **Axe 3 (ajouté par le vérificateur)** : `POST /api/admin/upload-image` met le `error.message` brut de Node dans sa réponse 201. Exemple : `failed[0].error = "EACCES: permission denied, open '/private/tmp/…/d4525/uploads/wines/wine-….png'"`, avec le chemin absolu du serveur, alors que `POST /api/upload/image` répond un 500 générique pour la même panne (`images/service.ts:262-267`, et même motif à `:344` pour `import-images-zip`). Déjà présent à 9df0d08c (`images/service.ts:212`) : pas une régression. Preuve : `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214/scratchpad/p12/v2/leak-4525.log` (dossier d’images de ma base mis en lecture seule).
- **Axe 5** : partie « message sous le champ » du critère d’API-09 (prix négatif), et rendu des `aria-describedby` de `FormField` (rattaché ici à BUG-16/5). Non rejoués ici.
- **Axes 1 ou 3** : réparation des prix négatifs par `drizzle/0015_repair_negative_prices.sql` et par les imports (critère d’API-09). Ici, seuls la présence de la migration et les noms des tests ont été vérifiés.
- **Axe 3 (renvoi de l’auditeur, gardé, non rejoué)** : `/uploads/` sert les images avec `Cache-Control: public, max-age=31536000` sans `Vary` (ae17dccb), et l’import zip remplace un fichier du même nom : un navigateur peut montrer l’ancienne image jusqu’à un an. [api] confirme l’en-tête et l’absence de `Vary`.

## Nettoyage

- Instances arrêtées par `kill`, puis vérifiées par PID (`ps -p`) : 4525 premier lancement (PID 54267), 4526 (PID 25176), 4525 relancé pour la mise à niveau (PID 76981), et la page d’essai de l’encadrement sur 4527 (PID 20550). Aucun n’existe plus, et `lsof` ne trouve aucun processus à l’écoute sur 4525 à 4529 (`…/p12/v2/cleanup.log`).
- Worktree `$S/p12/wt-v2` supprimée (`git worktree remove --force`, `git status` vide avant) : elle n’apparaît plus dans `git worktree list`, et le dossier n’existe plus (`…/p12/v2/worktree-list-after.txt`).
- Aucun fichier suivi modifié, aucun commit, aucun `git stash`. `data/`, `docker-data/` et `~/cellar-testdata` n’ont pas été touchés, et le dossier de l’auditeur (`$S/p12/a2/`) seulement lu. Seul ce fichier a été écrit dans `review-pre-1-0`.
