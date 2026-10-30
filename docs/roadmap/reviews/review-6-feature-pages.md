# Revue de code : pages secondaires et sous-système codes-barres/étiquettes

Périmètre : `src/routes/barcode`, `BulkBarcodeDialog.svelte`, `QrScannerDialog.svelte`, `src/lib/utils/barcode.ts`, `src/routes/api/barcode/*`, `api/test-barcode`, `src/routes/storage`, `statistics`, `out-of-cellar`, `cellar-history`, `wine-shortage`, `preferences` (et leurs endpoints `api/statistics`, `api/wine-shortage`).

## 1. Résumé

Les données agrégées sont bien placées : les statistiques et les manques sont calculés en SQL côté serveur, et le PDF n'est généré que côté serveur (aucun doublon jsPDF côté client). Le reste a de vrais problèmes. Le format des codes-barres diverge selon l'endroit où il est calculé, ce qui casse l'intégrité des données. La page de stockage contient une faille XSS stockée. La génération PDF repose sur un faux DOM et peut produire des codes illisibles sans signaler d'erreur. Les règles métier ne sont appliquées que dans l'UI, et les pages se copient beaucoup entre elles. `svelte-check` passe (0 erreur), mais surtout parce que le code utilise `any` partout.

**Verdict : REQUEST CHANGES.**

## 2. Ce qui va bien

- `api/statistics/+server.ts` et `api/wine-shortage/+server.ts` agrègent en SQL (`GROUP BY`/`HAVING`). Aucun calcul sur toute la cave n'est fait côté client.
- `jspdf` n'est importé que dans `api/barcode/pdf-labels`. La mise en page PDF n'est donc pas dupliquée entre client et serveur.
- `BulkBarcodeDialog.svelte` est la partie la mieux conçue :
  - fonctions pures `computeRows`/`locationChanges` ;
  - détection des doublons ;
  - `Promise.allSettled`, avec seulement les lignes en échec gardées pour réessayer (l.286-321) ;
  - protection contre les courses dans `loadTargetCapacity` (l.245) ;
  - la saisie est conservée si le dialogue est fermé par accident.
- `QrScannerDialog.svelte` :
  - `stopScanner` détache l'instance avant `stop()`, ce qui évite le double arrêt (l.117) ;
  - `onDestroy` nettoie ;
  - les scans répétés sont filtrés en mode continu ;
  - la caméra arrière est préférée ;
  - le refus de permission est géré.
- `utils/barcode.ts:188-209` renvoie des clés i18n pour la validation, une bonne idée (mal transportée, voir plus bas).
- L'i18n `$_()` est utilisée presque partout et les toasts sont cohérents.

## 3. Problèmes

### Critique

**C1. Le format des codes-barres diverge : 10 caractères ici, 13 là.**
- `utils/barcode.ts:95-113` (`generateSequentialBarcode`) produit 10 caractères. C'est ce que l'application attribue réellement aux bouteilles (`db/services.ts:579`, `api/admin/next-barcode`, import CSV) et ce qu'imprime le PDF.
- Mais ces endroits utilisent `padStart(13 - prefix.length)` :
  - `api/barcode/csv/+server.ts:44` ;
  - `api/barcode/stats/+server.ts:66` ;
  - `barcode/+page.svelte:269,356-366`.
- Conséquences :
  - l'export CSV par plage ne trouve jamais une bouteille existante (la comparaison `eq(barcode)` échoue toujours) ;
  - le « prochain code » affiché n'est pas celui qui sera attribué ;
  - pour une même plage, le CSV et le PDF contiennent des codes différents.
- De plus, `utils/barcode.ts:110` (`slice(-remainingChars)`) tronque sans prévenir. Avec un préfixe de 6 caractères, le n° 10000 devient « 0000 » et crée des doublons.
- Correction :
  - une seule fonction `formatBarcode()` partagée par tous ces endroits ;
  - une erreur au lieu de la troncature ;
  - `stats` doit réutiliser `getNextBarcodeNumber()` (c'est aujourd'hui une copie, l.41-63).

**C2. XSS stockée sur la page de stockage.**
- `storage/+page.svelte:1033` et `:1111` utilisent `{@html $_(..., { format: `<strong>${editContainerName}...` })}`.
- Le nom du conteneur vient de la base. Un nom contenant du HTML s'exécute à l'ouverture du dialogue d'édition.
- C'est aggravé par deux choses : l'API n'a aucune authentification côté serveur (l'auth n'existe que dans `sessionStorage`), et `svelte.config.js` désactive `csrf.checkOrigin`.
- Correction : supprimer `{@html}`. Afficher le nom en texte, entouré d'un `<strong>` dans le template.

### Majeur

**M1. Le PDF peut contenir de faux codes-barres sans erreur.**
- Le serveur fait tourner JsBarcode sur un canvas factice en remplaçant `global.document` (`pdf-labels/+server.ts:192-289`).
- En cas d'échec, `generateSimpleBarcodeDataUrl` (l.291-323) dessine un motif qui n'est pas du CODE128.
- Si aucun pixel noir n'est dessiné, un « motif de test » est généré (l.396-414).
- Résultat : des étiquettes imprimées et collées qui ne se scannent pas.
- Correction : dessiner les barres en vectoriel avec `pdf.rect()` à partir de `generateCODE128Pattern()`, qui existe déjà dans `utils/barcode.ts`. On supprime ainsi le faux DOM, `pngjs`, les solutions de secours, et on obtient un rendu net. Au passage, `addImage(..., 'JPEG')` reçoit un PNG (l.482).

**M2. Écriture de fichier hors du dossier temporaire via le préfixe manuel.**
- `csv/+server.ts:166` fait `join(tmpdir(), `barcodes_${prefix}_...`)`, où `prefix` vient du corps de la requête sans validation.
- Un préfixe `/../../../x` écrit en dehors de `tmpdir`.
- Le fichier temporaire ne sert à rien : il est écrit, relu, puis supprimé par un `setTimeout`. Même schéma dans `export-all` et `export-manual`.
- Correction : valider le préfixe (`^[A-Z0-9]{0,6}$`) et renvoyer directement `new Response(csv)`.

**M3. La logique de mise en page et de validation existe en trois versions qui divergent.**
- Client, `barcode/+page.svelte:94-200` : estime les modules par `len*11+35` et valide sur un échantillon de 13 caractères.
- Serveur, `pdf-labels:82-128` : passe par `generateCODE128Pattern` sur 10 caractères.
- `utils/barcode.ts:261` (`calculateLabelLayout`) : ignore les espacements, et n'est importé nulle part (l.7 de `pdf-labels`, import inutilisé).
- Le client peut donc déclarer valide ce que le serveur refuse, et l'inverse.
- Le serveur ne valide pas l'entrée (`...requestData`, l.42-50). Un `pageFormat` inconnu ou un préfixe de plus de 6 caractères (alors que l'UI autorise `maxlength=10`, l.705) produit une erreur 500.

**M4. `barcode/+page.svelte` (1685 lignes) contient deux copies presque identiques du formulaire.**
- Mode manuel : l.717-1115. Mode automatique : l.1187-1660.
- Les copies ont déjà divergé. Le mode manuel n'a ni « Bordure », ni « Mettre à jour le preset », ni l'affichage de validation, et son bouton PDF ignore `isValidConfiguration` (l.1096 contre l.1645).
- Le téléchargement par blob est copié 4 fois (l.250-266, 288-304, 325-341, 403-419).
- `$effect` utilise un tableau `deps` factice (l.80-92) alors que c'est un cas pour `$derived`.

**M5. Le scanner peut laisser la caméra allumée.**
- `QrScannerDialog.svelte:193-197` lance `setTimeout(startScanner, 500)` sans jamais l'annuler.
- `startScanner` (l.47-78) ne revérifie pas `open` après ses `await`.
- Si le dialogue se ferme pendant le démarrage, `new Html5Qrcode().start()` se termine après le `stopScanner()` et le flux n'est jamais arrêté.
- Correction : un jeton de génération ou un `AbortController`, le timer annulé dans le cleanup, puis une migration vers `$effect` avec une fonction de cleanup.

**M6. Stockage : règles métier appliquées uniquement côté client, et persistance incohérente.**
- Les vérifications « case occupée », « capacité inférieure au nombre de bouteilles » et « conteneur non vide » sont faites dans la page (l.209-313, 427-463).
- `DELETE /api/storage-cases/[id]` supprime sans vérifier (`services.ts:864`).
- `removeCase` supprime immédiatement sur le serveur (l.242-256), même si l'utilisateur clique ensuite sur Annuler.
- `updateContainer` appelle `/api/storage-occupancy` une fois par case, dans une boucle (l.379-384).
- Correction : le serveur refuse avec une 409 et un code d'erreur. Le dialogue devient un brouillon enregistré seulement à la validation, dans une transaction.

**M7. Stockage : les cases sont retrouvées par leur nom reconstruit.**
- `storage/+page.svelte:700-701, 832-833, 914-915` cherchent la case nommée `${conteneur}${numéro}`, en s'appuyant sur `/(\d+)$/` (l.513).
- Une case renommée avec un suffixe non numérique disparaît de l'affichage.
- Collision possible : conteneur « A1 » + case « 1 » et conteneur « A » + case « 11 » donnent tous deux « A11 ».
- Les cases sont triées par `containerId`, qui est un UUID (l.97).
- Correction : passer par l'id de la case et un champ `position` (à coordonner avec l'agent DB).

**M8. Historique : le filtre ne remet pas la pagination à zéro.**
- `cellar-history/+page.svelte:231,252` utilisent `bind:value`. Du coup, `changeFilter` et `changeItemsPerPage` (l.161-178) ne sont jamais appelées : c'est du code mort.
- Si l'on est en page 5 et qu'on passe sur « consommées », le tableau affiche « aucune bouteille » alors qu'il y a des résultats.

**M9. Hors cave : colonne et tris cassés.**
- `out-of-cellar/+page.svelte:446` affiche `bottle.location`, un champ que l'API ne renvoie pas (`services.ts:731-748`). La colonne vaut donc toujours « N/A » et le tri par emplacement ne fait rien.
- Le tri `'definition'` compare des objets (l.55-56, idem dans `cellar-history:55-56`), donc il ne trie pas.
- `Promise.all` (l.230) affiche « échec » alors qu'une partie des bouteilles a été mise à jour. `BulkBarcodeDialog` gère ce cas correctement.

**M10. Statistiques : le camembert reste vide s'il n'y a qu'une catégorie.**
- `statistics/+page.svelte:259-276` : avec une seule part à 100 %, l'arc commence et finit au même point, et le SVG ne dessine rien.
- C'est le cas pour une cave avec une seule couleur ou une seule décennie.
- Les pourcentages sont calculés sur `totalBottles`, alors que les types `null` sont retirés de la liste (`api/statistics:136`). Le camembert reste donc incomplet.

**M11. Chargement des données.**
- Aucune route du périmètre n'a de `+page.ts` ni de `+page.server.ts` : tout passe par `onMount` + `fetch`.
- Les erreurs sont avalées et affichent l'état vide : `storage:115-117`, `out-of-cellar:94-96`, `cellar-history:85-87`.
- `out-of-cellar` et `cellar-history` téléchargent toute la cave (`/api/bottles` avec toutes ses jointures), puis filtrent, trient et paginent dans le navigateur.

### Mineur

- **Textes en dur (i18n) :**
  - avertissements de validation en anglais, `barcode:113-193` ;
  - `"Preview:"` (l.1108, 1656), `" to "` (l.755, 1220), l.1630, l.1671-1677 ;
  - `storage:767,781,987` ;
  - `wine-shortage:72` ;
  - pluriel bricolé à la main, `out-of-cellar:292` ;
  - phrase assemblée par morceaux, `cellar-history:378` ;
  - `{decade}s`, `statistics:470` ;
  - couleurs associées à des libellés français, `statistics:322,338` ;
  - `formatCurrency('en-US')`, `statistics:72,81`, `wine-shortage:128` ;
  - `|| 'Réessayer'` qui ne sert jamais, `QrScanner:221` (svelte-i18n renvoie la clé).
- **Duplication :**
  - `formatDate`/`formatCurrency` dans 4 pages ;
  - libellé et variante de disponibilité (`BulkBarcode:344-364`, `cellar-history:122-159`) ;
  - fenêtre de pagination copiée 3 fois avec 2 algorithmes différents ;
  - en-tête triable copié 14 fois ;
  - échappement CSV dans 3 endpoints, et `location` non échappé (`export-all:72`, `export-manual:58`) ;
  - logique de thème en 3 exemplaires (`+layout:42-66`, `preferences:70-83`, `statistics:41-48`), alors que `lib/utils/theme.ts` n'est jamais importé.
- **Fuites dans les préférences :** `locale.subscribe` (l.44) et l'écouteur `matchMedia` (l.56) ne sont jamais retirés.
- **Requêtes N+1 dans le CSV :** jusqu'à 3000 requêtes (`csv:54-127`) alors qu'un seul `inArray` suffit.
- **Logs :** 16 `console.*` dans `pdf-labels`, dont des dumps de buffer à chaque étiquette (l.326-394, 480-481).
- **Presets :**
  - `showBorder` n'est ni enregistré ni restauré (absent du schéma) ;
  - le `<select>` lié à un objet perd la sélection après un rechargement (l.897) ;
  - la suppression se fait sans confirmation.
- **Accessibilité :**
  - boutons avec icône seule sans `aria-label` : `barcode:876,1396` ; `storage:687,808,899,1145` ;
  - en-têtes de tri cliquables non accessibles au clavier et sans `aria-sort` (`out-of-cellar:361-423`, `cellar-history:272-325`) ;
  - `Label` sans `for` sur les marges (`barcode:1551-1618`) ;
  - graphiques sans équivalent textuel ;
  - `min-w-[800px]` sur les dialogues de stockage, qui casse l'affichage mobile (l.997, 1088).
- **Typage et syntaxe :**
  - `any` omniprésent (15 dans `BulkBarcodeDialog`, 10 dans `statistics`), aucun type partagé pour les réponses d'API ;
  - mélange Svelte 4 / Svelte 5 : runes dans `barcode`, `export let`/`$:` partout ailleurs.
- **Code mort :**
  - `api/test-barcode/` est un dossier vide ;
  - `isDarkMode` et les `percentage` de légende dans `statistics` ;
  - `viewMode 'list'`/`containersPerPage` dans `storage` ;
  - `isValidBarcode` et `validateBarcodeSettings`.

## 4. Refactoring structurel du périmètre

1. **Module de domaine `$lib/barcode/` (pur, partagé client et serveur)** :
   - `format.ts` : une seule fonction `formatBarcode` ;
   - `code128.ts` : l'encodeur existant ;
   - `layout.ts` : `computeLayout()` renvoie lignes, colonnes et positions ;
   - `validation.ts` : renvoie `{code, params, severity}[]` ;
   - `schema.ts` : schéma zod de `LabelOptions` (zod est déjà une dépendance).

   Le client l'utilise pour la validation en temps réel, le serveur pour valider et dessiner. Les erreurs sont transmises sous forme d'objets structurés, sans découpage de chaînes (`barcode:431-449`).
2. **`$lib/server/barcode/`** :
   - rendu PDF vectoriel ;
   - `buildCsv(rows)` avec un échappement unique ;
   - requêtes groupées (`inArray`) ;
   - `getNextBarcodeNumber` utilisé par `stats` ;
   - plus de fichiers temporaires.
3. **Découper la page barcode** :
   - un `+page.server.ts` charge les réglages, les stats et les presets ;
   - composants `BarcodeStatsCard`, `CsvRangeCard`, `LabelPdfCard` (contenant `LabelSettingsForm` et `PresetManager`), avec le mode passé en prop. Une seule copie du formulaire ;
   - un seul `labelOptions = $state<LabelOptions>()` au lieu de 15 variables, pour appliquer ou sauver un preset d'un seul spread ;
   - un utilitaire `downloadResponse()`.
4. **Primitives de liste partagées** :
   - `$lib/utils/format.ts`, basé sur `$locale` ;
   - `$lib/bottles/availability.ts` ;
   - un composant `Pagination` ;
   - `@tanstack/svelte-table` (déjà dans les dépendances) pour fusionner hors-cave et historique en une seule `BottleTable` filtrée côté serveur (`?availability=`, via une fonction `load`).
5. **Stockage** :
   - règles métier côté serveur, en transaction ;
   - un seul `ContainerDialog` (création et édition) en mode brouillon ;
   - `StorageTable` et `StorageGrid` séparés ;
   - indexation par id et position.
6. **Graphiques** : composants `PieChart` (cas des 100 % géré par un `<circle>`) et `BarChart`, avec une palette indexée par la clé de couleur et non par le libellé.
7. **Préférences** : un store typé `$lib/stores/preferences.ts` qui encapsule les clés `localStorage` et le thème, consommé par le layout et les pages. Supprimer `utils/theme.ts`.
8. **Migration progressive vers les runes**, en commençant par `QrScannerDialog` (`$effect` avec cleanup et annulation).

## 5. Quick wins (moins d'une demi-journée chacun)

1. Remplacer les trois `padStart(13 …)` par `generateSequentialBarcode`, et lever une erreur au lieu de tronquer.
2. Retirer `{@html}` de `storage:1033,1111`.
3. Valider le préfixe côté serveur dans `csv` et `pdf-labels`, et supprimer les fichiers temporaires.
4. Supprimer les fausses solutions de secours du PDF et renvoyer une erreur 500 explicite. Supprimer aussi les `console.log`.
5. `cellar-history` : ajouter `onValueChange` pour remettre la page à 1.
6. `out-of-cellar` : utiliser `bottle.storageCase?.name`, et une table d'accesseurs pour le tri.
7. Camembert : dessiner un `<circle>` quand il n'y a qu'une part.
8. `preferences` : désabonner `locale` et retirer l'écouteur `matchMedia` dans `onDestroy`.
9. Annuler le `setTimeout` du scanner et revérifier `open` après chaque `await`.
10. Ajouter des `aria-label` sur les boutons à icône seule, et `formatCurrency` selon `$locale`.
11. Supprimer `api/test-barcode/` et les imports ou fonctions inutilisés.

Point transversal à signaler aux autres agents : l'API n'a aucune authentification côté serveur et `csrf.checkOrigin: false` est actif. Tout endpoint de ce périmètre (presets, PUT bouteilles, suppression de cases) peut être appelé sans session.
