# Revue 7 : outillage, infra et architecture transverse (cellar)

## 1. Résumé

L'impression de « gros monolithe » est juste, mais elle tient moins au découpage en fichiers qu'à l'absence de frontières. Il n'y a pas de couche serveur : les routes ouvrent elles-mêmes la base, et `src/lib/server` n'existe pas. Il n'y a aucune validation (zod est installé mais jamais importé), aucun test, et aucune load function réelle : l'application fonctionne comme une SPA, avec des `fetch` dans `onMount` vers 77 endpoints. L'outillage de base est sain : `svelte-check` passe à 0 erreur et 0 warning, le mode `strict` est actif et la migration vers Svelte 5 est faite aux trois quarts. Le point le plus grave est transverse. L'authentification n'existe que côté client et la protection CSRF est désactivée, si bien que n'importe quelle page web peut déclencher `POST /api/admin/wipe-database`.

## 2. Ce qui va bien

- **Typage.** `tsconfig.json` est en `strict: true`. `svelte-check` donne `0 ERRORS 0 WARNINGS` (lancé via `node_modules/.bin`, car `pnpm` n'est pas dans le PATH). Il n'y a aucun `@ts-ignore`, `@ts-nocheck` ni `svelte-ignore`.
- **Svelte 5 majoritaire.** 44 composants sur 63 (hors `ui/`) utilisent les runes, et `onclick` est utilisé 318 fois contre 32 `on:`.
- **Migrations versionnées.** Le dossier `drizzle/` contient les migrations et le journal, appliqués automatiquement.
- **i18n quasi complète.** fr et en ont 1190 et 1191 clés (seule `admin.skipped` manque en fr).
- **shadcn-svelte adopté.** On compte 274 `<Button>` contre 46 `<button>` bruts, et 106 `<Input>` contre 34 `<input>`.
- **Docker.** Le Dockerfile est multi-stage avec un healthcheck. La CI est multi-arch (amd64 et arm64) avec cache GHA. `.nvmrc`, Node 24 et pnpm 10 sont épinglés.
- **Hygiène git.** Le `.gitignore` couvre `data/*.db`, `docker-data/` et `.DS_Store`, et aucun `.DS_Store` n'est versionné.

## 3. Problèmes par sévérité

### Critique

**C1. Aucune autorisation côté serveur, et CSRF désactivé.**
- L'auth repose sur `sessionStorage` (`src/lib/stores/auth.ts:1-40`). `src/hooks.server.ts:335-359` ne vérifie rien.
- `svelte.config.js:23-25` désactive la protection : `csrf: { checkOrigin: false }`.
- `src/routes/api/admin/wipe-database/+server.ts:59` n'exige aucun corps de requête. Un simple `fetch(..., {method:'POST', mode:'no-cors'})` depuis un site tiers ouvert par quelqu'un du réseau local vide donc la base. Une sauvegarde est faite avant, ce qui limite la perte, mais pas l'exposition.
- Le code d'accès par défaut est `'1234'` (`src/routes/api/access-code/+server.ts:10`).
- **Correction :** réactiver `checkOrigin` et définir `ORIGIN` dans `docker-compose.yml` (c'est très probablement pour contourner son absence que le check a été coupé). Ajouter ensuite un cookie de session `httpOnly` signé, posé par `/api/access-code` et vérifié dans `hooks.server.ts` pour tout `/api/admin/*` et toute méthode autre que GET.

**C2. Plus de 21 connexions SQLite indépendantes, avec des chemins en dur.**
- `new Database('data/cellar.db')` apparaît au niveau module dans 20 fichiers `src/routes/api/admin/**/+server.ts`, par exemple `regions/+server.ts:9`.
- S'y ajoutent `src/lib/db/index.ts:14` et 4 ouvertures dans `hooks.server.ts` (lignes 156, 230, 322, 347).
- Le chemin de la base est écrit en dur 29 fois et `static/uploads` 14 fois. Il n'y a aucune `process.env`, aucun PRAGMA WAL ni `busy_timeout`.
- **Correction :** un seul module `src/lib/server/db.ts` qui lit `DATABASE_PATH`, et aucun autre `new Database` dans `src/`. Les autres agents détailleront les effets sur la couche DB ; ici, le problème est structurel.

### Majeur

**M1. Migrations lancées à la première requête, erreurs avalées.**
- `hooks.server.ts:337-356` lance les migrations dans le handler, puis `catch` → `console.error`, et l'application continue de servir.
- Le healthcheck (`GET /`) peut donc passer au vert avec un schéma cassé.
- **Correction :** utiliser `init` de `hooks.server.ts` (SvelteKit ≥ 2.10), ou un script `node migrate.js && node build` dans le `CMD`, et faire planter le processus en cas d'échec.

**M2. Dockerfile.**
- Le conteneur tourne en root : la ligne 57 commente `# USER root` et la ligne 54 fait `chmod -R 777`. **Correction :** `USER node` et `chown node:node` sur les dossiers des volumes.
- `node_modules` est copié en entier depuis le stage de build (l. 46), devDependencies comprises : vite, typescript, drizzle-kit, svelte-check, tailwind. Le `node_modules` local pèse 793 Mo. **Correction :** `pnpm prune --prod` ou `pnpm deploy --prod` avant la copie. adapter-node embarque déjà les devDependencies dans `build/`.
- `BODY_SIZE_LIMIT=10737418240` (10 Go, l. 66) ouvre la porte à une saturation disque ou mémoire. Il faut une limite réaliste, par exemple 500M pour les imports ZIP.
- Le paquet `sqlite` est installé au runtime (l. 38) alors que better-sqlite3 embarque sa propre copie de SQLite.

**M3. Une CI qui publie `latest` sans aucun contrôle.**
- `.github/workflows/docker-publish.yml` construit et pousse l'image à chaque push sur `main`, sans `check`, sans build de test et sans tests.
- `docker-compose.yml` consomme `:latest`, donc tout commit cassé sur `main` part en production au prochain `pull`.
- **Correction :** un job `verify` (`pnpm install --frozen-lockfile && pnpm check && pnpm test && pnpm build`) dont dépend `build-and-push` (`needs:`).

**M4. Aucun lint, aucun format, aucun test.**
- Il n'y a ni eslint, ni prettier, ni vitest, ni playwright. Pourtant `src/lib/utils.ts:8,10` contient des `eslint-disable`.
- Les fichiers `scripts/test-*.ts` (7 fichiers) sont des scripts manuels, branchés sur aucun script npm.
- `tsconfig` n'inclut pas `scripts/`, qui n'est donc pas typé.

**M5. Dépendances incohérentes (`package.json`).**
- **Deux paquets d'icônes.** `lucide-svelte` (l. 68) est utilisé dans 41 fichiers ; `@lucide/svelte` (l. 20) dans les composants `ui/` et dans `WineListView.svelte` et `BulkBarcodeDialog.svelte`. Il faut garder `@lucide/svelte`, qui est le paquet maintenu.
- **Jamais importés :** `zod` (l. 74), `@tanstack/svelte-table` et `@tanstack/table-core` (l. 56-57), `@internationalized/date` (l. 19), `@tailwindcss/forms` et `@tailwindcss/typography` (l. 25-26, absents de `app.css`), `@sveltejs/adapter-auto` (l. 21).
- `formsnap` et `sveltekit-superforms` ne servent qu'à `components/ui/form/`, que rien n'importe.
- **`@types/*` placés dans `dependencies` :** `@types/archiver`, `@types/csv-parse`, `@types/yauzl` (l. 58-60). Ils sont installés en production. `@types/csv-parse` et `@types/jspdf` sont en plus obsolètes : ces deux bibliothèques fournissent leurs propres types.

**M6. Deux lockfiles.**
- `package-lock.json` n'a pas été touché depuis le 2025-09-20 et a déjà dérivé : `html5-qrcode` et `@types/pngjs` n'y figurent pas.
- **Correction :** supprimer `package-lock.json` et ajouter `"packageManager": "pnpm@10.x"`.
- `.npmrc` contient `engine-strict=true`, mais `package.json` n'a pas de champ `engines`, donc le réglage n'a aucun effet.

**M7. Traductions affichées sous forme de clés.**
- 30 clés utilisées dans le code n'existent ni en fr ni en en, par exemple `admin.clear` (`WineBottlesTab.svelte:118`), `toast.error_saving_*` (8 dialogues admin) et `barcode.text_too_long`.
- `QrScannerDialog.svelte:221` écrit `$_('common.retry') || 'Réessayer'`. Le repli ne marche jamais, car svelte-i18n renvoie la clé elle-même quand la traduction manque.
- Il y a aussi des clés dupliquées dans le JSON (c'est la dernière qui gagne en silence) : 2 dans `fr.json` (`automatic_backups`, `backup_mode`) et 19 dans `en.json`.
- **Correction :** un script CI qui extrait les clés et compare les deux fichiers.

### Mineur

- **`svelte.config.js`** : l'alias de gabarit `"@/*": "./path/to/lib/*"` (l. 20-22) a été recopié tel quel dans `.svelte-kit/tsconfig.json`, et les commentaires parlent encore d'adapter-auto.
- **`vite.config.ts`** : `rollupOptions.external: []` et les réglages `nanoid` dans `ssr` et `optimizeDeps` semblent hérités d'un vieux contournement ; ils sont à supprimer et à tester.
- **`docker-compose.yml:33-40`** déclare 3 volumes nommés que rien n'utilise (ce sont des bind mounts qui servent). Le healthcheck est défini à la fois ici et dans le Dockerfile.
- **Port incohérent** : `docker-setup.sh:25` et `README-Docker.md:81` indiquent `localhost:3000`, alors que le compose expose 3005.
- **Thème** :
  - `src/lib/utils/theme.ts` (clé `theme`) n'est importé nulle part. C'est un doublon mort de `theme-colors.ts` (clé `wine-cellar-theme`).
  - Le thème est appliqué dans `onMount` après `await waitLocale()` (`+layout.svelte:34-55`), et `app.html` n'a aucun script de thème. Résultat : un flash du thème clair à chaque chargement.
  - La palette « blue » de `theme-colors.ts` reprend les valeurs de `:root` dans `app.css`.
- **Code mort** : `src/lib/mockData.ts` (316 lignes, aucun import), `src/lib/index.ts` (placeholder), `routes/api/admin/test/` et `routes/api/test-barcode/` (dossiers vides non versionnés).
- **Deux générateurs d'ID** : `generateUUID` (14 fichiers) et `nanoid` (7 fichiers).
- **`ui/`** mélange les composants générés et deux composants maison (`LocaleDateInput.svelte`, `SearchableSelect.svelte`). On trouve encore 27 `<select>` bruts et 455 classes de couleur Tailwind en dur (`bg-red-500`, etc.) au lieu des tokens.
- **Hygiène du dépôt** :
  - `test-labels.pdf` est en réalité une réponse JSON d'erreur de 41 octets.
  - `appellations.csv` existe en 3 copies identiques (racine, `csv-imports/`, `scripts/data/`), et la copie racine n'est référencée nulle part. Les 6 autres CSV sont en double entre `csv-imports/` et `scripts/data/`. Il faut garder `scripts/data/` comme source et ignorer `csv-imports/`.
  - `wine_images_schema.sql` est un brouillon remplacé par `drizzle/0000`.
  - `.claude/settings.local.json` (réglages personnels) est versionné.
  - `README.md` est encore le gabarit `sv` et `docs/` est vide.

## 4. Indicateurs chiffrés

| Indicateur | Valeur |
|---|---|
| Fichiers .svelte/.ts dans `src/` | 245 (≈ 37 600 lignes) |
| Erreurs / warnings `svelte-check` | 0 / 0 |
| Plus gros fichiers | `admin/+page.svelte` 1749, `barcode/+page.svelte` 1685, `api/admin/import-csv/+server.ts` 1508, `WineDefinitionDialog` 1384, `WineListView` 1243, `storage/+page.svelte` 1216, `WineBottleDialog` 1088, `lib/db/services.ts` 983, `wines/[id]/+page.svelte` 885, `BottleDetailsDialog` 846, `WineRegistrationForm` 647, `lib/db/migrations.ts` 634, `BulkBarcodeDialog` 633, `AllBottlesDialog` 625, `out-of-cellar/+page.svelte` 591 |
| Pages / endpoints `+server.ts` | 11 / 77 |
| Load functions | 1 (`wines/[id]/+page.ts`, qui ne fait que renvoyer `params.id`), 0 `+page.server.ts`, 0 `+layout.(server.)ts` |
| `fetch(` côté client | 132 dans 36 `.svelte` et 52 dans `src/lib/**/*.ts` (stores et services admin) |
| Composants Svelte 4 (`$:`, `export let`, `createEventDispatcher`) | 14 fichiers sur 63 (72 `$:`, 24 `export let`) |
| Composants runes | 44 fichiers (`$state` 148, `$derived` 32, `$effect` 14, `$props` 42) |
| Fichiers important `svelte/store` | 17 |
| `any` | 478 (dont 85 côté serveur) |
| `console.log` / `console.error` | 311 / 362 |
| `await request.json()` sans validation | 50 |
| `new Database(...)` dans `src/` | 25 |
| Clés i18n utilisées mais absentes | 30 (dans les deux langues) |
| Dépendances déclarées mais jamais importées | 8 |
| Tests automatisés | 0 |

## 5. Architecture cible et feuille de route

### Structure cible

```
src/lib/server/            # importable uniquement côté serveur (garanti par SvelteKit)
  db/{client.ts,schema.ts,migrate.ts}
  auth/session.ts
  config.ts                # env : DATABASE_PATH, UPLOADS_DIR, ORIGIN…
  features/<domaine>/{repository.ts,service.ts}   # wines, bottles, storage, barcode, backup, referentials
src/lib/shared/schemas/    # schémas zod partagés client/serveur + types z.infer
src/lib/features/<domaine>/components/   # composants UI par domaine
src/lib/components/ui/     # shadcn uniquement (généré)
src/routes/(app)/wines/+page.server.ts   # load + form actions
src/routes/api/…           # réservé aux vrais besoins JSON (scanner, exports)
```

Principes :
- les routes restent minces : parse zod → service → réponse ;
- les pages lisent leurs données via `load` et écrivent via les form actions ou `use:enhance` ;
- les stores globaux deviennent des classes `.svelte.ts` à runes ;
- vitest teste les services sur une base SQLite en mémoire, playwright couvre 3 ou 4 parcours.

### Feuille de route, dans l'ordre

1. **Sécurité d'abord (S).** Réactiver `checkOrigin`, ajouter `ORIGIN` au compose, cookie de session `httpOnly` vérifié dans `hooks.server.ts`, `USER node`, limiter `BODY_SIZE_LIMIT`.
2. **Garde-fous (S).** eslint, prettier, vitest, script de vérification i18n, job CI `verify` avant le push. Rien ne doit être refactoré sans ce filet.
3. **Une seule connexion DB (M).** Créer `lib/server/db` et `config.ts` lu depuis l'environnement, remplacer les 25 `new Database`, ajouter le PRAGMA WAL, déplacer les migrations dans `init` ou un script de démarrage qui échoue franchement.
4. **Validation zod (M).** Un schéma par entité dans `lib/shared/schemas`, appliqué aux 50 `request.json()` et réutilisé dans les formulaires.
5. **Services serveur par domaine (L).** Découper `lib/db/services.ts` (983 lignes) et `api/admin/import-csv/+server.ts` (1508 lignes). Tester chaque service au fil du découpage.
6. **Load functions (L, page par page).** Commencer par les pages simples (`wine-shortage`, `cellar-history`, `statistics`), puis `wines/[id]`, `storage`, `barcode`, et finir par `admin`.
7. **Svelte 5 complet (M).** Migrer les 14 composants legacy en commençant par les dialogues (`WineDefinitionDialog`, `WineBottleDialog`), et remplacer les stores `writable` des services admin.
8. **Découpage UI par feature (L).** Éclater les 5 fichiers de plus de 1100 lignes en sous-composants dans `lib/features/*`.
9. **Image Docker allégée (S).** `pnpm deploy --prod`, retrait de `sqlite` du runtime, mesure de la taille avant et après.

## 6. Quick wins (moins d'une heure chacun)

- Supprimer `package-lock.json`, ajouter `packageManager` et `engines`.
- Retirer `zod` (ou le garder pour l'étape 4), `@tanstack/*`, `@internationalized/date`, `@tailwindcss/forms`, `@tailwindcss/typography`, `adapter-auto`, `@types/jspdf` et `@types/csv-parse`. Déplacer les `@types/*` restants en devDependencies.
- Migrer `lucide-svelte` vers `@lucide/svelte` (41 imports à changer).
- Supprimer l'alias `@/*`, les commentaires adapter-auto et les réglages `nanoid` de vite.
- Supprimer `theme.ts`, `mockData.ts`, `test-labels.pdf`, `appellations.csv` (racine) et `wine_images_schema.sql`. Retirer `.claude/settings.local.json` et `csv-imports/` du suivi git.
- Ajouter les 30 clés i18n manquantes, dédoublonner les JSON, retirer le `|| 'Réessayer'` qui ne sert à rien.
- Supprimer les volumes nommés inutilisés du compose et passer 3000 → 3005 dans `docker-setup.sh` et `README-Docker.md`.
- Ajouter un script de thème inline dans `src/app.html` pour supprimer le flash.
- Écrire un vrai `README.md` (stack, dev, variables d'environnement, déploiement).

Aucun fichier versionné n'a été modifié : `git status` montre toujours seulement `.omc/`. `svelte-kit sync` a régénéré `.svelte-kit/`, qui est ignoré par git.
