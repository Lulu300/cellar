# Revue : API non-admin, authentification et sécurité serveur

Tout a été vérifié en lisant le code. Quelques points ont été testés en local : `path.join`, le PRAGMA `foreign_keys` de better-sqlite3 et un stream sur un répertoire. svelte-check renvoie 0 erreur. Le projet n'a aucun test.

## 1. Résumé

L'authentification n'existe que dans le navigateur. Le serveur ne vérifie rien : toutes les routes `/api/**`, y compris `/api/admin/wipe-database`, `restore` et `download-backup`, répondent à n'importe qui sur le réseau. En plus, la protection CSRF est désactivée, si bien qu'un site web quelconque visité depuis le LAN peut envoyer des POST destructeurs. zod est installé mais importé nulle part, donc aucune entrée n'est validée. Les handlers contiennent la logique métier : PDF, CSV, transactions manuelles. `hooks.server.ts` ne contient que des migrations et un planificateur de sauvegardes.

## 2. Ce qui va bien

- Toutes les requêtes passent par le query builder Drizzle ou des templates `sql```, qui sont paramétrés. Aucune injection SQL constatée.
- `src/routes/uploads/[...path]/+server.ts:15` bloque `..` et `\0`. J'ai vérifié que `join('./static/uploads', '/etc/passwd')` reste bien dans `static/uploads`.
- Les fichiers uploadés sont renommés côté serveur (`wine-${nanoid()}`), avec une liste blanche de types MIME et une limite de taille déclarée.
- `GET /api/access-code` ne renvoie pas le code.
- `statistics`, `wine-shortage` et `storage-occupancy` font leurs agrégations en SQL (`GROUP BY`, `COUNT`), pas en JS.
- Les handlers sont assez réguliers : try/catch, log, 404 quand l'entité manque, et le type `RequestHandler` dans la plupart des fichiers.

## 3. Problèmes

### Critique

**C1. Aucune authentification ni autorisation côté serveur**
- Où :
  - `src/hooks.server.ts:335-360` : `handle` ne fait que les migrations.
  - `src/routes/api/access-code/+server.ts:99-100` : renvoie `{valid}` sans poser de cookie ni de session.
  - `src/lib/stores/auth.ts:92-93` : l'état « connecté » n'est qu'un `sessionStorage`.
- Scénario : `curl -X POST http://nas:3005/api/admin/wipe-database` vide la base. Autre voie : dans la console du navigateur, `sessionStorage.setItem('wine-cellar-authenticated','true')` débloque toute l'interface. Le timeout de session (`auth.ts:35`) n'est appliqué que côté client, et `PUT /api/settings` est lui-même ouvert.
- Correction :
  - Après un code valide, poser un cookie de session `httpOnly`, `SameSite=Strict` (+ `Secure` derrière HTTPS) avec un token aléatoire stocké haché et une expiration.
  - Dans `hooks.server.ts`, remplir `event.locals.session` et refuser avec 401 toute mutation et tout `/api/admin/**` sans session.
  - Décider explicitement quelles lectures restent publiques.

**C2. CSRF désactivé, et `request.json()` accepte `text/plain`**
- Où : `svelte.config.js` (`csrf.checkOrigin: false`, commit c9717b3).
- Scénario : n'importe quelle page web ouverte sur le LAN peut soumettre un formulaire `POST` vers `http://nas:3005/api/admin/wipe-database`, qui ne lit pas de corps. Elle peut aussi envoyer un `fetch(..., {mode:'no-cors', body: JSON, headers:{'Content-Type':'text/plain'}})` vers `POST /api/bottles`. Le navigateur n'envoie pas de preflight, et `request.json()` ne vérifie pas le Content-Type. Les protections réseau local des navigateurs récents réduisent ce risque sans le supprimer.
- Correction :
  - Réactiver `checkOrigin`.
  - Définir `ORIGIN`, ou `PROTOCOL_HEADER`/`HOST_HEADER` derrière un reverse proxy. C'est probablement ce qui a conduit à le désactiver.
  - Avec C1, ajouter un cookie `SameSite=Strict`.

### Majeur

**M1. Écriture de fichier à un chemin choisi par l'appelant**
- Où : `src/routes/api/barcode/csv/+server.ts:34,165-168`. En mode manuel, qui est le défaut quand le réglage `barcode_auto_generation` est absent (`services.ts:909`), le `prefix` du corps finit dans le nom du fichier temporaire.
- Vérifié : `prefix = "/../../../../../../app/static/uploads/x"` donne `/app/static/uploads/x_1_1_123.csv`. Le conteneur tourne en root (`Dockerfile:56`). L'impact est limité par le suffixe `.csv` et la suppression après 30 s.
- Correction : supprimer complètement le fichier temporaire (voir quick wins), valider `prefix` (`/^[A-Za-z0-9-]{0,12}$/`) et assainir `filename` dans `Content-Disposition`. Même chose pour `pdf-labels:170`.

**M2. Code d'accès faible et attaquable par force brute**
- Où : `access-code/+server.ts`.
  - Code par défaut `1234` stocké en clair (`:10`).
  - Le `GET`, censé être une lecture, crée les réglages (`:77`).
  - Comparaison `===` qui n'est pas à temps constant (`:99`, `:124`).
  - Aucune limite de tentatives, et 4 caractères minimum (`:117`).
- Conséquence : 10 000 requêtes suffisent pour un code à 4 chiffres. Ce point ne comptera qu'une fois C1 corrigé.
- Correction : hachage scrypt (`node:crypto`) + `timingSafeEqual`, limite par IP en mémoire (par exemple 5 essais/minute avec backoff exponentiel), changement de code imposé au premier lancement, et initialisation des réglages dans la migration de données.

**M3. Aucune validation des entrées (zod jamais importé)**
- `bottles/+server.ts:18` : `quantity` sans borne ; `createMultipleWineBottles` fait un INSERT par bouteille (`services.ts:638-660`). `quantity: 1000000` bloque le serveur.
- `bottles/+server.ts:21` : l'unicité du code-barres n'est vérifiée que si `quantity === 1`, et le code manuel est ignoré sans message quand `quantity > 1` (`services.ts:645`).
- `definitions/[id]/+server.ts:49` et `wines/[id]/+server.ts:21` : le corps brut est passé à `updateWineDefinition`, donc toute colonne est modifiable (`id`, `createdAt`, `targetQuantity`…). Un `type` qui n'est pas un ID existant crée un nouveau type portant ce nom (`services.ts:408-417`) : une faute de frappe pollue les données de référence.
- `pdf-labels/+server.ts:82` : un `pageFormat` inconnu provoque un TypeError, donc un 500 au lieu d'un 400. Des marges négatives (`:83-84`) font grossir `labelWidth`, et `Buffer.alloc(width*height)` (`:333`) devient un DoS mémoire et CPU, jusqu'à 1000 fois.
- `countries:29`, `regions:36`, `wine-types:29` : `name.trim()` sur une valeur qui n'est pas une chaîne donne un 500.
- `barcode/csv:46` : si `startNumber` arrive en chaîne, il est concaténé au lieu d'être additionné (`"5"+0 = "50"`).
- Correction : un schéma zod par endpoint, plus un helper `parseBody(request, schema)` qui renvoie 400 (ou 422) avec le détail des erreurs.

**M4. Upload : corps de requête illimité et type de fichier non vérifié**
- `Dockerfile:66` fixe `BODY_SIZE_LIMIT` à 10 GiB pour toutes les routes. `upload/image:22` fait `request.formData()`, qui charge tout en mémoire avant le contrôle de taille de 20 Mo (`:37`) : OOM possible.
- Le type MIME (`:30`) et l'extension (`:47`) sont ceux du client, donc on peut stocker `wine-x.html` ou `.svg`. En prod, la route `uploads` les sert en `application/octet-stream`, ce qui n'est pas exploitable aujourd'hui, mais une seule ligne ajoutée au `switch` le rendrait exploitable.
- Correction : limite globale autour de 25 Mo (relevée seulement pour les routes d'import admin) ; détection par magic bytes ; extension dérivée du type détecté ; `X-Content-Type-Options: nosniff`.

**M5. `PUT /api/bottles/[id]` remplace tout et applique des valeurs par défaut implicites**
- Où : `bottles/[id]/+server.ts:20-42`. Si `origin` est absent, `originId` passe à null. Si `availability` est absent, la bouteille redevient `available`. Les dates absentes passent à null.
- Ce problème a déjà causé une perte de données : le commit bc9a8de indique que l'édition depuis AllBottlesDialog « clearait » l'optimum, la valeur et l'origine.
- Correction : `PATCH` avec un schéma zod `.partial()` et ne mettre à jour que les champs présents.

**M6. Le filtrage et le tri de `/api/wines` sont inopérants**
- `getFilteredWineBottles` (`services.ts:752`) ignore `filters` et `sort`. Les 9 paramètres analysés dans `wines/+server.ts:9-47` ne servent donc à rien. De toute façon, le résultat repart de `allDefinitions` (`:66`), qui renvoie toutes les définitions.
- Les deux tables sont chargées entièrement à chaque appel, et `wines/[id]/+page.svelte:167` télécharge tout le catalogue pour afficher un seul vin.
- Correction : supprimer ce code mort, ou filtrer réellement en SQL ; exposer `/api/definitions/[id]/bottles`.

**M7. Écritures en plusieurs étapes sans transaction, FK mal gérées**
- better-sqlite3 active `foreign_keys=1` (vérifié), et le schéma n'a aucun `ON DELETE`.
- `storage-containers/[id]` DELETE (`:79-85`) supprime les cases une par une. Si la 3e case contient des bouteilles, l'erreur FK arrive après la suppression des deux premières : état partiel + 500.
- Même chose pour POST (`:33-48`) et PUT (`:34-57`). `definitions/[id]` DELETE et `storage-cases/[id]` DELETE renvoient 500 au lieu de 409.
- Le PUT ne vérifie pas que `caseIds[i]` appartient bien au conteneur (`:37-44`), et les cases retirées de la liste ne sont jamais supprimées. Le POST valide `capacity` puis l'ignore (`:24`).
- Correction : `db.transaction(...)`, vérification d'appartenance, erreur de domaine `ConflictError` traduite en 409.

**M8. `hooks.server.ts` porte un planificateur de sauvegardes fragile**
- Les migrations tournent au premier requête et non au démarrage. En cas d'échec, `migrationRun` reste false et la requête est servie quand même, sur une base non migrée (`:352-356`). On réessaie à chaque requête.
- Le flag n'est passé à true qu'après plusieurs `await`. Plusieurs requêtes simultanées au démarrage peuvent donc lancer `scheduleNextBackup` en parallèle, et une sauvegarde en retard peut être faite deux fois.
- Le module ouvre trois connexions SQLite distinctes au lieu d'utiliser le singleton `$lib/db`.
- `scheduleNextBackup` n'est pas exporté : modifier les réglages de sauvegarde n'a aucun effet avant un redémarrage.
- La logique archiver est copiée 5 fois (`create-backup`, `auto-backup`, `wipe-database`, `restore`, `hooks`).

### Mineur

- **Occupation des cases incohérente** : `storage-occupancy:19` ne compte que les bouteilles `available` ; `storage-cases/[id]/capacity:26-31` compte toutes les bouteilles, y compris `out_of_cellar` (le commentaire dit le contraire) ; `wines/[id]/locations:68-75` fait de même, avec un N+1 qui charge des lignes juste pour les compter.
- **N+1 dans `barcode/csv:54-131`** : jusqu'à 3 requêtes par code, soit 3000 pour 1000 codes. Une seule requête `inArray` avec jointures suffit.
- **Fichiers temporaires inutiles** dans `csv`, `export-all` et `export-manual` : écriture, relecture, puis `setTimeout(unlink)`. Il suffit de renvoyer `new Response(csvContent)`.
- **CSV mal échappé** : `location` n'est pas échappé (`export-all:72`, `export-manual:58`), et rien n'empêche l'injection de formules (`=`, `+`, `@`).
- **Erreurs incohérentes** :
  - corps d'erreur variés : `{error}`, `{error, message}`, texte brut via `error()` (`access-code`, `settings`), `{message}` ;
  - un conflit de code-barres renvoie 400 au lieu de 409 (`bottles/+server.ts:24`) ;
  - DELETE renvoie 200 avec `{message}` au lieu de 204.
- **Duplication et endpoints morts** :
  - `wine-types`, `wine-colors`, `wine-formats`, `wine-classifications` sont quatre fichiers identiques (diff vérifié) ;
  - `POST /api/wines` et `POST /api/definitions` créent la même ressource avec des noms de champs différents (`type`/`color` contre `typeId`) ;
  - `/api/wines/[id]` n'est appelé par aucun client ;
  - `countries`, `regions` et `appellations` existent aussi sous `/api/admin/*`.
- **`pdf-labels` (541 lignes)** : rendu bitmap dans le handler, `console.log` à chaque étiquette (`:326-330`), et patch de `global.document` (`:249`). Ce patch est synchrone, donc sans course, mais c'est un hack.
- **`uploads/[...path]`** : `resolve` est importé sans être utilisé ; une URL pointant sur un répertoire (`/uploads/wines`) donne une réponse cassée (EISDIR vérifié). Ajouter `stats.isFile()`.
- **Répertoire vide** : `src/routes/api/test-barcode/` est vide. Il n'expose rien, mais il faut le supprimer. Aucun autre endpoint de test ou de debug dans ce périmètre.

## 4. Refactoring structurel proposé

1. **Couche serveur dédiée** dans `src/lib/server/` (SvelteKit interdit son import côté client) :
   - `auth/` : session, hachage, limitation des tentatives ;
   - `services/` par domaine : `bottles`, `definitions`, `storage`, `reference-data`, `barcode/{csv,pdf}`, `backup/` ;
   - `http/` : `parseBody`, mapping des erreurs.

   Les handlers deviennent minces (environ 10 lignes) : zod → service → DTO.
2. **Hooks composés** avec `sequence(handleSession, guardApi, securityHeaders)`. Migrations et planificateur passent dans le hook `init` (`ServerInit`, SvelteKit 2.10+), avec un module `backup` unique, réutilisé par les routes admin, qui expose `reschedule()`.
3. **Schémas zod partagés** dans `src/lib/schemas/` : `z.infer` remplace les 22 `any`/`as any` du périmètre, et le client peut valider avec les mêmes schémas.
4. **Contrat d'API unique** :
   - erreurs au format `{ error: { code, message, details? } }` ;
   - codes 201, 204, 404, 409, 422 ;
   - une seule ressource `definitions` ;
   - `GET /api/bottles?status=available,out_of_cellar` à la place de `/non-consumed` ;
   - `PATCH` pour les mises à jour partielles ;
   - une fabrique `createReferenceRoutes(service)` ou une route `/api/reference/[kind]` pour les 4 listes de référence.
5. **Erreurs de domaine** (`NotFound`, `Conflict`, `Validation`) levées par les services et traduites en un seul endroit, ce qui évite les 500 génériques sur les violations de FK.
6. **Performance** : pagination de `/api/wines`, comptages en SQL, `inArray` au lieu des boucles, transactions pour les écritures multiples.
7. **Tests** : Vitest sur les services, avec une base `:memory:`, et sur les schémas, en priorité pour l'auth, les bouteilles et le stockage.

## 5. Quick wins (moins d'une heure chacun)

1. Réactiver `csrf.checkOrigin` et définir `ORIGIN` dans `docker-compose.yml`.
2. Ramener `BODY_SIZE_LIMIT` à environ 25 Mo.
3. Dans `barcode/csv`, `export-all` et `export-manual` : supprimer le fichier temporaire, renvoyer la chaîne directement et valider `prefix` par regex.
4. Borner `quantity` à 1–100 dans `POST /api/bottles`, et refuser un code-barres manuel quand `quantity > 1`.
5. Valider `pageFormat` et les marges (≥ 0) dans `pdf-labels`, et retirer les `console.log`.
6. Mettre une liste blanche des champs dans `PUT /api/definitions/[id]` (en attendant zod).
7. Entourer de `db.transaction` les écritures de `storage-containers` POST, PUT et DELETE.
8. Ajouter `X-Content-Type-Options: nosniff` et `stats.isFile()` dans `uploads/[...path]`.
9. Dans le hook, passer `migrationRun` à true avant les `await`, et renvoyer 503 si la migration échoue.
10. Supprimer `api/test-barcode/`, `api/wines/[id]` (inutilisé) et le parsing de filtres sans effet dans `GET /api/wines`.

Les corrections C1 et C2 viennent avant le reste : tant que le serveur ne contrôle pas l'accès, les autres corrections de sécurité ont peu d'effet.
