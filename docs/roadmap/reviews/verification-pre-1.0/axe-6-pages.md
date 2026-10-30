# Vérification d’avant 1.0, axe 6 : pages fonctionnelles et codes-barres

Commit revu `cf48032d` (develop, 1.0.0-rc.1, 2026-10-29). Périmètre : codes-barres, étiquettes PDF et scanner (`routes/barcode`, `api/barcode`, `features/barcode`, `features/labels`, `shared/barcode.ts`, `shared/labels.ts`, `components/barcode/`), pages stockage, historique, hors cave, statistiques, manques, préférences et racine, et les tâches P7 à P11 de l’axe : BUG-13, BUG-16, BUG-17, BUG-19, BUG-20, UI-11, UI-12. Méthode : le rapport de l’auditeur a6 a été repris ligne par ligne par un vérificateur qui ne l’avait pas écrit, sur sa propre instance : worktree détachée à `cf48032d` (supprimée à la fin), `pnpm build`, app lancée sur le port 4565 avec d’autres données inventées que l’auditeur (noms « émile », « Éric », « Zoé », « Œillade », « alpha », « beta », « Zeta », millésime vide, prix 0, régions « Valle » en Italie et en Australie, conteneurs « Frigo » (cases « ␣haut », « ␣bas »), « Cave A » (« 1 », « 2 ») et « Cave » (« ␣A1 »)) ; API par un client Node ; Chromium headless de Playwright pour les parcours (corps des PATCH captés, tris, confirmations, page codes-barres), 72 rendus (9 pages × en/fr × clair/sombre × 1280/390) avec axe-core 4.14.0 ; banc d’étiquettes à soi : 14 préréglages livrés, page 1 à 300 dpi par `pdftoppm`, chaque case décodée par zxing-wasm 3.1.6 (copie déjà installée par l’auditeur dans `$S/p12/a6/tools/`, utilisée en lecture), contours de l’Avery 5160 lus dans le flux du PDF ; scanner avec caméra factice (vidéos `.y4m` faites depuis les PDF du banc) ; mise à jour d’une copie de la base 0.7.0 de a1 (doublons de rangement, préréglages modifiés) sur le port 4566, avec une copie CRLF puis une copie modifiée du `label_presets.csv` d’avant BUG-16 ; 42 fichiers de test de l’axe (430 tests) ; historique par `git log -S` et `git show 9df0d08c:`. Chaque verdict autre que « fait » et « sans objet », chaque « fait » issu d’un Critique, d’un Majeur ou d’un critère, 55 des 105 lignes de traçabilité et les trois constats ont été rejoués ou relus par le vérificateur. Les portes complètes sont celles du lead (`$S/p12/gates/summary.txt`).

Notations : `$S` = `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214/scratchpad`, `$A` = `$S/p12/a6` (preuves de l’auditeur), `$V` = `$S/p12/v6` (preuves du vérificateur). Les `fichier:ligne` sont ceux de `cf48032d`. « a6 : » en tête d’une preuve signale une preuve de l’auditeur que le vérificateur n’a pas rejouée (ligne de l’échantillon non tiré).

Preuves du vérificateur (absolues sous `$V`) :
- [seed] `$V/scripts/seed.mjs`, sortie `$V/run1/seed.log` ; serveur `$V/run1/server.log`.
- [api] `$V/run1/api.log` (`$V/scripts/api.mjs`) : CSV des codes, unicité des rangements, suffixes.
- [api2] `$V/run1/api2.log` (`$V/scripts/api2.mjs`) : exemple de `docs/API.md`, `DELETE` d’une case puis PUT ancien, `addedNote`, préréglages refusés, plage `ABCDEF`.
- [bug19] `$V/run1/bug19.log` (`$V/scripts/bug19.mjs`) : compteur exact, POST avec code, bouteille bue, préfixe de 8 caractères.
- [bench] `$V/bench.log`, `$V/bench/results.json`, 28 PDF dans `$V/bench/` (`$V/scripts/bench.mjs`).
- [align] `$V/align-5160.log` (`$V/scripts/rects.py`) : contours de l’Avery 5160 lus dans le PDF.
- [flows] `$V/flows.log` (`$V/scripts/ui-flows.mjs`) ; [flows2] `$V/flows2.log` (`$V/scripts/ui-flows2.mjs`), captures `$V/flows/`.
- [barcode-page] `$V/barcode-page.log` (`$V/scripts/barcode-page.mjs`) ; [longpref] `$V/longpref.log`, `$V/flows/longpref-badge-1280.png`, `$V/flows/longpref-badge-390.png`.
- [updating] `$V/updating.log`, `$V/flows/updating-fr.png` ; [empty-name] `$V/empty-name.log`, `$V/flows/container-empty-name.png`.
- [screens] `$V/screens.log`, `$V/shots/report.json`, 72 captures dans `$V/shots/`.
- [scanner] `$V/scanner.log` (`$V/scripts/scanner.mjs`), [scanner2] `$V/scanner2.log` (`$V/scripts/scanner2.mjs`), captures et vidéos dans `$V/scanner/`.
- [run2] `$V/run2/before.txt`, `$V/run2/after.txt`, `$V/run2/server.log` ; [crlf] `$V/run2b/server.log`, `$V/run2b/server-modified.log`, `$V/run2b/modified-before.txt`, `$V/run2b/modified-after.txt`.
- [contrast] `$V/decade-contrast.log` ; [vitest] `$V/vitest-axis6.log` ; [pids] `$V/pids.log`.

## 1. Résumé

- **Régressions : une, en partie** (V6-m3) : depuis UI-13 (ba910245, 2026-10-23), le bouton Confirmer du dialogue de statut affiche « Mise à jour... » (trois points ASCII écrits dans le composant) sur le hors cave, qui affichait « Mise à jour… » par `out_of_cellar.updating` à `9df0d08c`. Aucune ligne de traçabilité n’est régressée.
- Verdicts, 162 lignes :
  - traçabilité de l’audit, 105 lignes : 93 fait, 9 fait autrement, 3 sans objet ;
  - constats de l’audit (a6 M1, M2, m1 à m19) : 20 fait, 1 fait autrement (m19) ;
  - critères des 7 tâches P7 à P11 de l’axe : 7 fait ;
  - points « Trouvé pendant » de ces tâches, 29 lignes : 11 fait, 18 pas fait (l’auditeur : 11 fait, 2 fait autrement, 16 pas fait ; voir section 5) ;
  - total : **131 fait, 10 fait autrement, 0 partiel, 18 pas fait, 0 régressé, 3 sans objet**.
  - Les points de la section 4 de l’audit reprennent des lignes déjà comptées.
- Constats nouveaux : **0 Critique, 0 Majeur, 3 Mineurs**, tous confirmés : V6-m1 (camembert des décennies en gris presque identiques), V6-m2 (colonne `location` des CSV de codes-barres ambiguë), V6-m3 (« Mise à jour... », régression en partie).
- Essais rejoués :
  - étiquettes : 14 préréglages livrés, 474 cases sur 474 décodées en page 1, aucun code parasite ; N codes tiennent sur une page, N + 1 en demandent deux ; Avery 5160 : 3 × 10, contours aux positions du gabarit Avery à moins de 0,001 mm ;
  - note masquée : corps `{"ids":[…],"changes":{"availability":"available"}}`, notes « keep-a », « keep-b » intactes ; note de consommation : corps avec `"addedNote":"Bu avec Paul"`, notes « Cadeau de Marie\nBu avec Paul » ;
  - tris : `alpha, beta, émile, Éric, Œillade, Zeta, Zoé` et l’inverse ; emplacements vides en dernier dans les deux sens ; date de consommation sur « Tous » avec les non bues en dernier ; filtre qui garde le tri ;
  - rangement : 409 `duplicate_container` et `duplicate_case`, « Frigo » et « frigo » coexistent (décision), « ␣haut » → « Frigo haut » ; mise à jour d’une base 0.7.0 : « A » et « A (2) », cases « A (2)1 » et « A1 (2) », aucune bouteille déplacée, index uniques posés ;
  - préréglages sur une base 0.7.0 : 5161 modifiée gardée, 5163 à bordure seule modifiée corrigée (bordure gardée), 8160 « Inkjet », cinq étroits en QR ; copie CRLF du CSV d’origine remplacée, copie modifiée gardée ;
  - scanner : Code 128 et QR lus avec le détecteur natif et avec le repli zxing-wasm, 0 piste vivante après lecture, après fermeture pendant un démarrage lent et après Échap ; caméra coupée → message et « Try Again » ;
  - 72 rendus : 200, aucune erreur console, aucun débordement horizontal, 0 violation axe-core.

## 2. Traçabilité (passe 1)

### Revue 6

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R6-C1 | Un seul format, pas de troncature | Corrigé | fait | Rejoué : `POST /api/barcode/csv {1,4,"VX"}` → `VX00000001`…`VX00000004` avec leur vin ; `stats` : 4 codes, `nextNumber` 5 [api] |
| R6-C2 | XSS `{@html}` stockage | Corrigé | fait | `grep {@html}` : 0 dans `routes/storage` et `components/storage` ; restent 3 dialogues de l’admin (renvoi axe 4) |
| R6-M1 | Barres vectorielles, plus de faux DOM | Corrigé | fait | Rejoué : 14 préréglages, page 1 rendue à 300 dpi, 474/474 cases décodées, aucun code parasite sur la page [bench] |
| R6-M2 | Écriture hors tmpdir via le préfixe | Corrigé | fait | `grep tmpdir\|setTimeout` dans `api/barcode` et `features/barcode` : 0 |
| R6-M3 | Une seule validation, côté serveur aussi | Corrigé | fait | Rejoué : préréglage QR 8 × 8 → 422 `label_too_small` (`qr_size_below_minimum`, 6 < 10), 400 mm → 422 `labels_do_not_fit` [api2] ; tests de `labels`, `pdf-labels` [vitest] |
| R6-M4 | Page de 1 685 lignes | Corrigé | fait | `routes/barcode/+page.svelte` : 174 lignes |
| R6-M5 | Caméra allumée si fermeture au démarrage | Corrigé | fait | Rejoué : getUserMedia ralenti de 1,5 s, Échap à 300 ms → 1 piste créée, 0 vivante [scanner] |
| R6-M6a | Règles du stockage côté client seulement | Corrigé | fait | `features/storage/service.ts:69-72,100` (409 `case_full`), `:165-182` (409 `case_holds_bottles`) ; tests du service de stockage [vitest] |
| R6-M6b | `DELETE /api/storage-cases/[id]` sans contrôle | Corrigé | fait | `service.ts:180-182` (`deleteEmptyCases`) appelé par `deleteStorageCase` ; rejoué : suppression d’une case vide → 204 [api2] |
| R6-M6c | Suppression d’une case même si l’on annule | Corrigé | fait | `ContainerDialog.svelte:22-27` (brouillon, rien n’est envoyé avant d’enregistrer) ; tests de `container-draft.test.ts` [vitest] |
| R6-M6d | Une requête par case | Corrigé | fait | `features/storage/repository.ts:142-154` (`caseLoads`, une requête groupée par case) |
| R6-M7a | Cases retrouvées par nom reconstruit | Corrigé | fait | `StorageTable.svelte:44` (`container.cases[position]`) |
| R6-M7b | Suffixe non numérique : case disparue | Corrigé | fait | Test « takes the suffix of each case from its name » (`container-draft.test.ts:90`) [vitest] |
| R6-M7c | Collision « A1 »+« 1 » / « A »+« 11 » | Corrigé | fait | Rejoué : « Cave A » + « 1 » et « Cave » + « ␣A1 » : deux cases « Cave A1 » distinctes par id [api] ; reste d’affichage : V6-m2 |
| R6-M7d | Cases triées par UUID | Corrigé | fait | Rejoué : `GET /api/storage-containers` → `Box, Cave, Cave A, Frigo, frigo, Probe, Shelf…` [flows2] |
| R6-M8 | Filtre → page 1 | Corrigé | fait | Rejoué : changement de filtre → `?filter=consumed&sort=definition&dir=desc`, sans `page` [flows] |
| R6-M9a | Emplacement toujours N/A | Corrigé | fait | Rejoué : hors cave, colonne Emplacement `Cave A2`, `Frigo bas` [flows2] |
| R6-M9b | Tri `definition` sur des objets | Corrigé | fait | Rejoué : `alpha, beta, émile, Éric, Œillade, Zeta, Zoé`, et l’inverse [flows] |
| R6-M9c | `Promise.all` partiel | Corrigé | fait | Rejoué : un seul `PATCH /api/bottles` par confirmation, corps capté [flows] |
| R6-M10a | Camembert vide à une part | Corrigé | fait | Capture : cercle plein « Champagne (6) » [screens] `$V/shots/stats-fr-light-1280.png` |
| R6-M10b | Parts sur `totalBottles` | Corrigé | fait | `utils/pie-chart.ts:19` (somme des tranches), `:23` (part pleine) |
| R6-M11a | Pas de load function | Corrigé | fait | 72 rendus des pages de l’axe en 200 [screens] |
| R6-M11b | Erreurs avalées | Corrigé | fait | 72 rendus en 200, 0 erreur console [screens] |
| R6-M11c | Toute la cave téléchargée | Corrigé | fait | `features/bottles/service.ts:181-184` : tri en mémoire puis une page envoyée au client (permis par la décision « Tri de l’historique et du hors cave ») |
| R6-m1a | Avertissements en anglais | Corrigé | fait | a6 : `LabelPdfCard.svelte:56-89` (`labelIssueMessage`) ; captures fr : « Avertissements de configuration » [shots] `barcode-fr-dark-390.png` |
| R6-m1b | « Preview: », « to » | Corrigé | fait | a6 : `barcode.preview`, `barcode.range_value` (`BarcodeRange.svelte:19`) |
| R6-m1c | Textes en dur du stockage | Corrigé | fait | a6 : Messages `m[...]` ; porte i18n à 0 [gates] |
| R6-m1d | wine-shortage:72 | Corrigé | fait | a6 : Page en `m['wine_shortage.*']` ; captures fr [shots] |
| R6-m1e | Pluriel bricolé hors cave | Corrigé | fait | a6 : `out_of_cellar.total_bottles_out` en ICU plural (`en.json:326`) |
| R6-m1f | Phrase en morceaux, historique | Corrigé | fait | a6 : `history.total` (`cellar-history/+page.svelte:45`) |
| R6-m1g | `{decade}s` | Corrigé | fait | « Années 1990 », « Années 2000 », « Années 2010 » [screens] `$V/shots/stats-fr-light-1280.png` |
| R6-m1h | Couleurs liées à des libellés français | Corrigé | fait | a6 : `typeFill`/`colorFill` (`statistics/+page.svelte:234,275`) |
| R6-m1i | `formatCurrency('en-US')` | Corrigé | fait | « 30,00 € » en français, « €10.00 » en anglais [screens] |
| R6-m1j | `\|\| 'Réessayer'` | Corrigé | fait | a6 : `grep Réessayer src` hors locales : rien |
| R6-m2a | `formatDate`/`formatCurrency` copiés | Corrigé | fait | a6 : Une définition, `utils/format.ts` |
| R6-m2b | Disponibilité copiée | Corrigé | fait | a6 : `components/bottles/availability.ts`, `AvailabilityBadge.svelte` |
| R6-m2c | Pagination copiée | Corrigé | fait | a6 : `table/Pagination.svelte`, `utils/pagination.ts` |
| R6-m2d | En-tête triable copié | Corrigé | fait | a6 : `table/SortableHeader.svelte` ; `th[aria-sort]` présent [flows] |
| R6-m2e | Échappement CSV copié | Corrigé | fait | a6 : `server/csv.ts` (`csvLine`), utilisé par `barcode/service.ts:207` |
| R6-m2f | Thème en 3 exemplaires | Corrigé | fait | a6 : `stores/preferences.svelte.ts`, `utils/theme-colors.ts` |
| R6-m3 | Fuites des préférences | Corrigé | fait | a6 : `preferences.svelte.ts:40-48` (un seul `matchMedia`, store singleton) |
| R6-m4 | N+1 dans le CSV | Corrigé | fait | a6 : `barcode/repository.ts:149-170` (une requête `barcodeRows`) |
| R6-m5 | `console.*` dans pdf-labels | Corrigé | fait | `grep console.` dans `components/barcode`, `features/labels`, `features/barcode`, `api/barcode` et les pages de l’axe : 0 |
| R6-m6a | `showBorder` pas enregistré | Corrigé | fait | a6 : `shared/schemas/label.ts:24` ; préréglage 5163 garde sa bordure après migration [run2] |
| R6-m6b | `<select>` lié à un objet | Corrigé | fait | a6 : `PresetManager.svelte:149-161` (`value={selectedId}`) |
| R6-m6c | Préréglage supprimé sans confirmation | Non fait | fait | `PresetManager.svelte:85` (`confirm` du layout) ; même dialogue rejoué pour un conteneur (UI-12) [flows2] |
| R6-m7a | Boutons à icône sans nom | Corrigé | fait | axe-core 4.14.0 : 0 violation sur 72 rendus [screens] |
| R6-m7b | Tri sans clavier ni `aria-sort` | Corrigé | fait | a6 : `SortableHeader.svelte` ; `aria-sort` lu dans le DOM [flows] |
| R6-m7c | `Label` sans `for` | Corrigé | fait | axe-core 4.14.0 : 0 violation sur 72 rendus [screens] |
| R6-m7d | Graphiques sans texte | Corrigé | fait | a6 : `PieChart.svelte:9-10` (`aria-hidden`, légende avec les comptes) |
| R6-m7e | `min-w-[800px]` | Corrigé | fait | `grep min-w-[800px]` : 0 |
| R6-m8a | `any` omniprésent | Corrigé | fait | a6 : 3 `any` hors périmètre (`lib/utils.ts:9,11`, `backup/repository.ts:45`) ; règle ESLint en erreur [gates] |
| R6-m8b | Svelte 4 / 5 mélangés | Corrigé | fait | Aucun `export let` hors `ui/`, aucun `svelte/store` (grep) |
| R6-m8c | Types partagés des réponses | Corrigé | fait | a6 : `shared/dto.ts` (ex. `BarcodeSettingsDTO` dans `BarcodeStatsCard.svelte:7`) |
| R6-m9a | `api/test-barcode/` vide | Corrigé | fait | `src/routes/api/test-barcode` absent |
| R6-m9b | `isDarkMode`, `percentage` | Corrigé | fait | Variable morte absente ; le seul `isDarkMode` est un paramètre de `applyTheme` (`utils/theme-colors.ts:288,310`) |
| R6-m9c | `viewMode 'list'`, `containersPerPage` | Corrigé | fait | a6 : `storage/+page.svelte:26,33-39` |
| R6-m9d | `isValidBarcode`, `validateBarcodeSettings` | Corrigé | fait | `grep isValidBarcode\b\|validateBarcodeSettings` : 0 (reste `isValidBarcodePrefix`, utilisé) |

### BUG-01

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-01 | Mêmes codes en CSV et PDF | Corrigé | fait | Codes décodés du banc = `VX00000001…` dans l’ordre de la plage [bench] ; test « prints the same codes as the CSV of the same range » [vitest] |
| BUG-01/Trouvé-1 | Troncature ; `it.fails` | Corrigé | fait | a6 : Test « refuses a number too long for the prefix instead of truncating it » (`shared/barcode.test.ts:26`) ; préfixe `ABCDEF` départ 9999, 2 bouteilles → 409 `barcode_range` [api-barcode] |

### BUG-06

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-06 | Filtre, emplacement, tri, camembert | Corrigé | fait | R6-M8, R6-M9a à c, R6-M10a rejoués [flows] [flows2] [screens] |

### BUG-07

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-07 | Ouvrir puis fermer éteint la caméra | Corrigé | fait | Rejoué : fermeture pendant un démarrage lent → 0 piste ; après chaque lecture → 0 ; Échap → 0 [scanner] [scanner2] |
| BUG-07/Trouvé-1 | html5-qrcode | Corrigé | fait | a6 : Absent de `package.json` ; `barcode-detector` en devDependencies (`package.json:45`), chargé à la demande (`utils/barcode-scanner.ts:43`) |

### BUG-08

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-08 | PDF lu à 100 % ; entrée invalide refusée | Corrigé | fait | Rejoué : 474/474 au banc [bench] ; scanner de l’app : `VX00000001` lu en Code 128 et en QR, natif et zxing [scanner] |
| BUG-08/Trouvé-1 | `Buffer.slice` | Corrigé | fait | a6 : `pdf.ts:39` (`Buffer.from(pdf.output('arraybuffer'))`) |
| BUG-08/Trouvé-2 | 1,9 Mo pour 4 étiquettes | Corrigé | fait | a6 : 31 étiquettes Avery 5160 : 113 786 octets (QR : 333 127) [bench] `results.json` |

### DEP-05

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| DEP-05 | Lu sans BarcodeDetector natif aussi | Corrigé | fait | Rejoué : `delete window.BarcodeDetector` → Code 128 lu en 611 ms, QR en 615 ms (natif : 873 et 600 ms) [scanner] |

### UI-04

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| UI-04 | Données au rendu serveur | Corrigé | fait | 72 rendus en 200 [screens] |
| UI-04/Trouvé-1 | Carte d’AGENTS.md | Corrigé | fait | a6 : AGENTS.md décrit `src/lib/server/db/` et `features/<domain>` |
| UI-04/Trouvé-2 | 307 de `/` et healthchecks | Corrigé | fait | a6 : `GET /` → 200, `HEAD /` → 200, `<meta http-equiv="refresh" content="0; url=/wines"/>` (curl) ; `routes/page.test.ts` |
| UI-04/Trouvé-3 | Millésime 0 | Non fait | fait | a6 : Décision « Millésime 0 » appliquée (DATA-09) : un millésime 0 envoyé par POST est stocké NULL (« Zoé » : millésime vide dans le CSV) [api-barcode] |
| UI-04/Trouvé-4 | Banc qui comparait mal | Sans objet | sans objet | a6 : Outil hors dépôt, toujours vrai |
| UI-04/Reste-1 | Session chargée côté client | Non fait | fait | a6 : `routes/+layout.server.ts` transmet `authenticated` et `accessCodeSet` ; `stores/auth.svelte.ts:25-31` les lit depuis `page.data` (UI-17) |
| UI-04/Reste-2 | GET sans appelant | Non fait | fait autrement | Décisions « Endpoints et CSRF (API-06) » et « Chargement côté serveur (UI-04) » (confirmées le 2026-10-17) : les GET sans appelant restent, documentés |

### UI-08

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| UI-08 | Un formulaire ; même code client et serveur | Corrigé | fait | R6-M3 rejoué [api2] |
| UI-08/Trouvé-1 | `BarcodeDialog` vide le DOM | Corrigé | fait | a6 : `BarcodeDialog.svelte:31,37,84` (SVG depuis `code128Bars`, `QUIET_ZONE_MODULES`) |
| UI-08/Trouvé-2 | Bouton dans un bouton | Corrigé | fait | a6 : `PresetManager.svelte:102-164` ; axe sans `nested-interactive` [shots] |
| UI-08/Trouvé-3a | Fond sombre | Corrigé | fait | a6 : DEP-05 |
| UI-08/Trouvé-3b | QR en PNG | Corrigé | fait | a6 : `pdf.ts:79-100` (carrés vectoriels) |
| UI-08/Trouvé-3c | Formats de page répétés | Corrigé | fait | a6 : `shared/labels.ts:15-24` |
| UI-08/Trouvé-3d | DK-11204 : 9,3 modules de blanc | Non fait | fait autrement | Décision « Page codes-barres (UI-08) » (2026-10-17) ; DK-11204 lue 51/51 [bench] |
| UI-08/Trouvé-3e | Règle de largeur recopiée | Corrigé | fait | a6 : `code128ModuleWidth` partagé (`shared/barcode.ts:136`, `pdf.ts:57`, `labels.ts:131`) |
| UI-08/Trouvé-4a | UPC-E hors règles GS1 | Non fait | fait autrement | Décision « Limites acceptées (audit d’avant 1.0) » (UPC-E hors règles GS1) |
| UI-08/Trouvé-4b | EAN-13 à 0 initial | Non fait | fait autrement | Décision « Limites acceptées (audit d’avant 1.0) » (EAN-13 à 0 initial) |
| UI-08/Trouvé-4c | Data Matrix natif macOS | Non fait | fait autrement | Décision « Limites acceptées (audit d’avant 1.0) » (Data Matrix du détecteur natif de macOS) |
| UI-08/Trouvé-4d | Caméra débranchée : aucun message | Non fait | fait | Rejoué : pistes arrêtées pendant un scan → « The camera stopped: check that it is still connected, then try again. » et « Try Again », qui rallume (1 piste) ; Échap → 0 [scanner2] |
| UI-08/Trouvé-4e | CSP future et `wasm-unsafe-eval` | Sans objet | sans objet | a6 : Toujours aucune CSP (`vite.config.ts`, `hooks.server.ts`) |
| UI-08/Trouvé-4f | Pas testé sur téléphone | Écart décidé | fait autrement | Décision « Scanner sur téléphone (DEP-05) » |
| UI-08/Trouvé-5a | Import CSV des préréglages sans contrôle | Corrigé | fait | a6 : `db/seed.ts:162,187-191` (`safeParse`, puis `blockingIssues`) ; journal « preset 19 (Zebra 2x1) skipped, not printable » [run3] |
| UI-08/Trouvé-5b | `labelSheetSchema` | Corrigé | fait | a6 : `shared/schemas/label.ts:64-71` |
| UI-08/Reste-1 | Hauteur contrôlée ≠ dessinée | Non fait | fait | `shared/labels.ts:41` (`codeHeight`), utilisée par le contrôle (`:143,151`) et le PDF ; DK-11204 lue 51/51 [bench] |
| UI-08/Reste-2 | Plage hors limites : PDF actif | Non fait | fait | Rejoué : préfixe `ABCDEF`, départ 99 999 : PDF et CSV grisés, « Enter a whole number between 1 and 9,999. » sous les champs, à 1280 et 390 px [barcode-page] |
| UI-08/Reste-3 | Formulaire par défaut invalide | Non fait | fait | a6 : `label-options.svelte.ts:28` (56 mm) ; PDF actif, deux avertissements jaunes ; `POST` 56 × 30 → 200 [flows] [api-presets] |

### UI-09

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| UI-09 | Annuler ne modifie rien ; occupation unique | Corrigé | fait | a6 : `ContainerDialog.svelte:21-26` (brouillon) ; test « is the same in every answer that gives it » (`service.test.ts:390`) |
| UI-09/Trouvé-1 | Message générique du 409 | Corrigé | fait | a6 : `utils/api-error.ts:37-38` |
| UI-09/Trouvé-2 | `AllBottlesDialog` sans rafraîchissement | Corrigé | fait | a6 : `AllBottlesDialog.svelte:120` (`invalidate(CELLAR)`) |
| UI-09/Trouvé-3 | `localeCompare` | Corrigé | fait | a6 : Seul reste : `csv-import/referenceIndex.ts:41`, une clé technique hors affichage |
| UI-09/Reste-1 | Cases importées en position 0 | Non fait | fait | a6 : `csv-import/pipeline.ts:101-121` ; test « places a case added to a container that has cases after them, unless the file says where » (`round-trip.test.ts:519`) |
| UI-09/Reste-2 | Le serveur reconstruit le nom | Non fait | fait autrement | Décisions « Page stockage (UI-09) » (pas de séparateur) et « Suffixe des cases (API-09) » ; « ␣haut » → « Frigo haut » [api] |
| UI-09/Reste-3 | Brouillon ancien supprime une case | Non fait | fait | a6 : `service.ts:205` ; rejoué : PUT avec l’ancien `updatedAt` → 409 `container_changed` ; le dialogue l’envoie (corps PUT capté) [api-storage] [flows] |
| UI-09/Reste-4 | Capacité vidée → 5 | Non fait | fait autrement | Décision « Champs numériques (BUG-14) » : le dialogue refuse une capacité vide, l’API garde 5 |
| UI-09/Reste-5 | Conteneur sans case sans bouton | Non fait | fait | a6 : Conteneur « Vide » : bouton « + Add Case », qui ouvre son édition [flows] `flows/storage-with-empty-container.png` |
| UI-09/Reste-6 | Import CSV par nom de case | Non fait | fait | Test « puts each bottle back in its case when two containers have cases of the same name » [vitest] |
| UI-09/Reste-7a | `/api/storage-occupancy` sans appelant | Sans objet | sans objet | a6 : Toujours appelé par le formulaire de bouteille |
| UI-09/Reste-7b | `DELETE /api/storage-cases/{id}` sans appelant | Non fait | fait autrement | Décision « Page stockage (UI-09) » : la route reste, documentée ; rejouée : `DELETE /api/storage-cases/{id}` → 204 [api2] |
### Constats de l’audit a6 (passe 2 de l’audit)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| a6 M1 | Préréglages Avery hors des découpes | Confirmé (Majeur) | fait | Rejoué : Avery 5160 et 8160 : 30 par page, 31 → 2 pages ; 5161 : 20 ; 5162 : 14 ; 5163 : 10 ; 5164 : 6 ; toutes les cases décodées [bench] ; contours de l’Avery 5160 lus dans le PDF : colonnes à 4,763 / 74,612 / 144,462 mm, rangées de 12,7 à 241,3 mm au pas de 25,4, bas à 266,7 mm, soit le gabarit Avery (0,1875″, pas 2,75″ × 1″, marge haute 0,5″) [align] |
| a6 M2 | Note masquée qui remplace les notes | Confirmé (Majeur) | fait | Rejoué : hors cave, 2 bouteilles « keep-a », « keep-b », « HIDDEN TEXT » sous « Consumed », puis « Available » (champ retiré du DOM), Confirm → corps `{"ids":[…],"changes":{"availability":"available"}}`, notes intactes [flows] ; `newStatus` (`components/bottles/bottle-changes.svelte.ts`), appelé par `BottleStatusDialog.svelte:65` et `BulkBarcodeDialog.svelte:208` |
| a6 m1 | Compteur et export par `LIKE` | Confirmé | fait | Rejoué : `vx00000009` ajouté sous le préfixe `VX` → compteur 4 inchangé, absent de l’export et de la plage [bug19] |
| a6 m2 | Tri par octets | Confirmé | fait | Rejoué : `alpha, beta, émile, Éric, Œillade, Zeta, Zoé` et l’inverse ; emplacements `Cave A2, Frigo bas, N/A, N/A` en croissant, `Frigo bas, Cave A2, N/A, N/A` en décroissant [flows] [flows2] ; `features/bottles/service.ts:181` (`sortBottles`) |
| a6 m3 | Cinq préréglages refusés ; API laxiste | Confirmé | fait | Rejoué : DK-22210 77/77, Dymo 30320 60/60, Zebra 2x1 44/44, Generic 50x30 24/24, en QR [bench] ; QR 8 × 8 → 422, 400 mm → 422 [api2] |
| a6 m4 | Règles des manques et statistiques sans test | Confirmé | fait | `features/bottles/statistics.test.ts` passe [vitest] |
| a6 m5 | Préfixe vide après numérique | Confirmé | fait | a6 : commentaire `barcode/repository.ts:52-61`, texte `admin.barcode_prefix_shares_numbers`, `actualNext 1230000003` |
| a6 m6 | Zone blanche recopiée ; bornes 0/1 | Confirmé | fait | Rejoué : `ABCDEF`, départ 99 999 → 422 « barcode numbers go from 1 to 9999 » [api2] ; a6 : `QUIET_ZONE_MODULES` exporté et lu par `BarcodeDialog` |
| a6 m7 | « Column » retiré au milieu | Confirmé | fait | `shared/storage.ts` : `name.replace(/^Column /, '')` |
| a6 m8 | Cadre vide « Millésimes récents » | Confirmé | fait | Capture : « Millésimes récents » montre 2018 [screens] `$V/shots/stats-fr-light-1280.png` |
| a6 m9 | Prix 0 → N/A | Confirmé | fait | a6 : « Price: €0.00 » (`$A/shots/shortage-en-light-1280.png`) |
| a6 m10 | Date de consommation triée par date d’achat | Confirmé | fait | Rejoué : « Tous », croissant `Feb 2, 2022, May 5, 2024, Oct 29, 2026…, N/A…`, décroissant `Oct 29, 2026…, Feb 2, 2022, N/A…` ; colonne absente sur « En cave » [flows] |
| a6 m11 | Contrôles et textes en double | Confirmé | fait | a6 : `table/PageSizeSelect.svelte` dans les deux pages, colonnes venues du load |
| a6 m12 | Code mort | Confirmé | fait | a6 : `wine-shortage/+page.svelte` (`selectedDefinitionId` seul) |
| a6 m13 | Une icône par place | Confirmé | fait | `storage/CaseLoad.svelte:18` (`PLACES = 24`), `:37` (« +N ») |
| a6 m14 | Moyenne sans prix « 0,00 € » | Confirmé | fait | Capture : « Valeur actuelle moyenne : N/A » quand aucune bouteille n’a de valeur [screens] `$V/shots/stats-fr-light-1280.png` ; `statistics/+page.svelte:180,188` sans `\|\| 0` |
| a6 m15 | Régions homonymes fusionnées | Confirmé | fait | Capture : deux barres « Valle », sous-titres « Austra... » et « Italia » [screens] `$V/shots/stats-fr-light-1280.png` |
| a6 m16 | « Connexion sécurisée » pour un navigateur sans API | Confirmé | fait | a6 : `camera-error.ts`, `navigator.mediaDevices` retiré → « This browser gives no access to the camera… » ; texte `scanner.no_camera_api` présent ; `camera-error.test.ts` passe [vitest] |
| a6 m17 | Bornes HTML ≠ schéma | Confirmé | fait | a6 : `LabelSettingsForm.svelte` sans `min`/`max` sur les mesures |
| a6 m18 | `confirm()` natif | Confirmé | fait | Rejoué : « Delete Container » → dialogue « Confirm » de Cellar, aucun dialogue natif ; Précédent → `/wines`, 0 dialogue, conteneur gardé [flows2] ; `ConfirmDialog.svelte:16` (`beforeNavigate`) |
| a6 m19 | Noms de cases collés, espace retiré | Confirmé | fait autrement | Décisions « Page stockage (UI-09) » (pas de séparateur) et « Noms de rangement uniques (UI-12) » ; rejoué : « ␣haut » → « Frigo haut », « ␣top␣␣ » → « Box top », « B␣ » → « BoxB » [api]. Reste d’affichage : V6-m2 |

### Points restés ouverts de l’audit (section 4)

Déjà comptés plus haut, mêmes verdicts que l’auditeur : UI-08/Reste-1, 2, 3 et Trouvé-4d fait ; UI-08/Trouvé-3d et 4a à 4c fait autrement ; UI-09/Reste-1, 3, 5, 6 fait, Reste-2 et 4 fait autrement ; R6-m6c fait ; UI-04/Reste-1 fait ; UI-04/Reste-2 et UI-09/Reste-7b fait autrement ; UI-04/Trouvé-3 fait (DATA-09).

### BUG-13 · Note masquée

| Point | Verdict | Preuve |
|---|---|---|
| Critère : hors cave, page vin, `BottleDetailsDialog` → notes intactes ; test qui échoue avant | fait | Les trois écrans montent `BottleStatusDialog` (`newStatus` à `:65`) ; rejoué dans le hors cave (a6 M2) [flows] ; `bottle-changes.test.ts` passe [vitest] |
| Trouvé 1 : `catch` muet sur la page vin | fait | `BottleChanges.refused` (`bottle-changes.svelte.ts`) affiche l’erreur ; reprise par UI-13 |
| Trouvé 2 : la note de consommation remplace | fait | BUG-17 ; décision « Suites de P7 (BUG-13, BUG-15) » |

### BUG-16 · Préréglages livrés

| Point | Verdict | Preuve |
|---|---|---|
| Critère : 30 Avery 5160 sur les découpes ; chaque préréglage donne un PDF ; non modifiés corrigés, modifié intact ; préréglage non imprimable refusé | fait | [align] [bench] ; base 0.7.0 : 5161 modifiée (marge gauche 13) gardée, 5163 à bordure seule modifiée corrigée (12,7 ; 3,951 ; 4,78 ; 0) avec sa bordure, les autres Avery corrigés [run2] ; refus 422 [api2] |
| Trouvé 1 : Avery 8160 « Laser » | fait | Base 0.7.0 mise à jour : « … - Inkjet » (migration `drizzle/0012_fix_avery_8160_description.sql`) [run2] |
| Trouvé 2 : copie CRLF | fait | Copie CRLF du CSV de `9df0d08c` : « Replaced the outdated label_presets.csv » ; copie modifiée en CRLF : même empreinte avant et après (`e240dafd…`) [crlf] |
| Trouvé 3 : aperçu qui répète l’erreur | fait | Un message par champ, nombre formaté « 9,999 » [barcode-page] |
| Trouvé 4 : départ non borné | fait | `ABCDEF`, départ 99 999 refusé côté page et API [barcode-page] [api2] |
| Trouvé 5 : `aria-describedby` de `FormField` | fait | a6 : commit 52ea2a8e (UI-17) ; 0 violation axe-core [screens] |
| Trouvé 6 : raison loin des boutons à 390 px | fait | a6 : `PresetManager.svelte:133-144` |

### BUG-17 · Note de consommation ajoutée

| Point | Verdict | Preuve |
|---|---|---|
| Critère : notes gardées, suivies de la nouvelle, dans les quatre écrans | fait | Rejoué dans le hors cave : corps `{"ids":[…],"changes":{"availability":"consumed","consumedDate":"2026-10-29"},"addedNote":"Bu avec Paul"}`, notes « Cadeau de Marie\nBu avec Paul » [flows] [flows2] ; par l’API : « n-zeta\nBu avec Paul », « n-emile\nBu avec Paul » [api2] ; les trois autres écrans passent par `newStatus` (`BottleStatusDialog.svelte:65`, `BulkBarcodeDialog.svelte:208`) |
| Trouvé 1 : pas de garde contre le double envoi | fait | `BottleChanges.sending` ; boutons grisés pendant l’envoi [updating] |
| Trouvé 2 : dialogue copié dans quatre écrans | fait | UI-13 : `BottleStatusDialog` unique ; la saisie groupée garde son sélecteur (décision « Dialogue de statut partagé (UI-13) ») |

### BUG-19 · Préfixe exact, casse, bouteilles bues

| Point | Verdict | Preuve |
|---|---|---|
| Critère : compteur et export exacts ; saisie groupée exacte ; POST avec code gardé, 422 pour deux ; bue sans code ; préfixe de 8 caractères sans 500 | fait | Rejoué : `vx00000009` hors du compteur et de l’export ; POST d’une bouteille avec `vx00000009` → gardé ; deux bouteilles → 422 `barcode_for_one_bottle` ; bouteille créée bue → `barcode: null` ; préfixe `LONGPREF` en base → `next-barcode` 409 `barcode_prefix_too_long`, `/barcode` en 200 [bug19] ; test de `bulk-barcode.test.ts` [vitest] |
| Trouvé : badge qui déborde avec un ancien préfixe trop long | pas fait | Rejoué : `LONGPREF` → le message de 83 caractères tient sur une ligne dans le badge `font-mono` (`BarcodeStatsCard.svelte:64-68`) : à 1280 px il sort de sa carte (badge 195-904 px, carte 112-448 px) ; à 390 px la page défile de 443 px en largeur [longpref] |
| Trouvé : la carte CSV répète le message | fait | a6 : commit 206ba37c ; avec `LONGPREF`, la carte CSV n’a qu’un message [barcode-page] |
| Trouvé : libellé « Bottles with Barcode » | pas fait | `en.json:449` ; le nombre est celui des codes du préfixe (4 avec 5 bouteilles à code) [bug19] |
| Trouvé : départ codé en dur à 5 | pas fait | `label-options.svelte.ts:22`, `routes/barcode/+page.svelte:28` |
| Trouvé : deux formulations de la session expirée | pas fait | `en.json:64` (`errors.unauthenticated`) et `:151` (`auth.session_expired`) ; aussi listé dans « Trouvé pendant UI-15 » |
| Trouvé : erreur du champ code-barres après « Bue » | pas fait | `WineBottleForm.svelte:78,108,117,292,305` : `barcodeRefusal` n’est vidé qu’au rechargement ou à la saisie, pas au changement de statut |

### BUG-20 · Étiquettes et scanner

| Point | Verdict | Preuve |
|---|---|---|
| Critère : copie CRLF remplacée, modifiée gardée ; `ABCDEF` + 99 999 refuse PDF et CSV avec la raison ; DK-11204 contrôle la hauteur dessinée ; caméra coupée → message | fait | [crlf] ; [barcode-page] ; `shared/labels.ts:41,143,151` et DK-11204 51/51 [bench] ; [scanner2] |
| Trouvé : ancien préfixe avec « É » laisse PDF actif | pas fait | Rejoué : préfixe `ÉCV` écrit en base → boutons PDF et CSV actifs, aucun message ; `POST /api/barcode/pdf-labels` → 409 `barcode_not_encodable` [barcode-page] ; `components/barcode/prefix-error.ts` ne contrôle que la longueur en mode automatique |
| Trouvé : exemple faux de `label_too_small` dans docs/API.md | pas fait | Rejoué : la requête d’exemple de `POST /api/barcode/pdf-labels` (63,5 × 33,9 mm) répond 200 `application/pdf`, pas le 422 montré (`height_below_minimum`, `actual 4`, `docs/API.md:1512-1516`) [api2] |
| Trouvé : expression régulière construite à chaque appel | pas fait | `shared/barcode.ts:154-158` (`new RegExp` dans `isValidBarcodePrefix`) |

### UI-11 · Historique, hors cave, statistiques, manques

| Point | Verdict | Preuve |
|---|---|---|
| Critère : émile, Éric, Zoé, vides en dernier ; tri gardé au changement de filtre ; date de consommation, non bues en dernier ; deux régions homonymes ; « Retour » direct → liste ; tests | fait | [flows] [flows2] (voir a6 m2, m10, R6-M8) ; deux barres « Valle » [screens] ; `BackButton.svelte:14,18` (`goto('/wines')` sans page d’origine) ; `statistics.test.ts`, `list.test.ts`, `cellar-history/page.server.test.ts` [vitest] |
| Trouvé : tri par statut sur les codes internes | pas fait | `utils/bottle-sort.ts:36` (`bottle.availability`) |
| Trouvé : `?.` et `\|\| 0` inatteignables | pas fait | `statistics/+page.svelte:83,101,119,135,157,165,171,227,268,313,352,394,470` |
| Trouvé : « Retour » après Précédent mène à `/wines` | pas fait | Comportement voulu et commenté (`BackButton.svelte:6-9`, `:14` `type !== 'popstate'`), mais aucune décision de « Décisions prises » ni décision datée du mainteneur ; la tâche le note « point ouvert, voulu » (voir section 5) |

### UI-12 · Stockage

| Point | Verdict | Preuve |
|---|---|---|
| Critère : « A » / « A (2) » sans perte ; second « A » → 409 ; « ␣haut » → « Frigo haut » ; export puis import remet chaque bouteille ; confirmation de Cellar qui disparaît en quittant la page | fait | Base 0.7.0 : « A », « A (2) », « A (2)1 », « A1 (2) », 11 bouteilles avant et après, chacune dans sa case, index `storage_containers_name_unique` et `storage_cases_container_id_name_unique` [run2] ; 409 `duplicate_container`, `duplicate_case`, « Frigo haut » [api] ; test « puts each bottle back in its case when two containers have cases of the same name » [vitest] ; confirmation rejouée [flows2] |
| Trouvé : `DELETE /api/storage-cases/{id}` ne change pas `updatedAt` | pas fait | Rejoué : `updatedAt` identique avant et après la suppression d’une case, puis PUT avec l’ancien `updatedAt` → 404 `not_found` au lieu de 409 `container_changed` [api2] ; `features/storage/service.ts:250-253` |
| Trouvé : « Enregistrer » grisé pour un nom vide sans raison | pas fait | Rejoué : nom vidé → « Update Container » grisé, aucun message, pas d’`aria-invalid` [empty-name] ; `ContainerDialog.svelte:225`. Contraire à la décision « Messages d’erreur (P7) » (« un bouton n’est grisé que si la raison est visible avant le clic ») |
| Trouvé : un nom de case en double rougit la capacité | pas fait | `ContainerDialog.svelte:162,174,182` : le même `error` met `aria-invalid` sur le suffixe et la capacité |
| Trouvé : `updatedAt` à la seconde | pas fait | Documenté (`docs/API.md`, `PUT /api/storage-containers/{id}`, « kept to the second ») mais aucune décision (voir section 5) |
| Trouvé : paramètre inutilisé de `WineBottleDialog` | pas fait | `components/bottles/WineBottleDialog.svelte:36` (`_bottles`) |
| Trouvé : `AllBottlesDialog` ne vide pas la bouteille modifiée | pas fait | `storage/AllBottlesDialog.svelte:119-121` (`handleBottleEdited` recharge sans remettre `editingBottle` à null) |
| Trouvé : `BulkBarcodeDialog` de 485 lignes | pas fait | 485 lignes à `cf48032d` |

## 3. Nouveaux constats (passe 2)

### Régressions

**V6-m3 (Mineur). « Mise à jour... » : points de suspension ASCII écrits dans les composants, hors i18n**
- Ce qui se passe : pendant l’envoi d’un changement de statut, le bouton Confirmer affiche `m['common.updating']()` suivi de `...` écrit dans `ConfirmButtons.svelte`. En français : « Mise à jour... » au lieu du « … » qu’exige AGENTS.md pour le français. `pnpm i18n:check` ne le voit pas : il ne cherche entre les balises que des lettres (`scripts/check-i18n.mjs`, `LETTER`). Le même motif reste dans `BulkBarcodeDialog`, et `abbreviate` des statistiques coupe les noms par `'...'` (« Austra... »).
- Reproduction : hors cave en français, cocher une bouteille, « Changer la disponibilité », Confirmer pendant que le PATCH est retenu 2,5 s → boutons `["", "Annuler", "Mise à jour..."]` (`$V/scripts/updating.mjs`).
- Preuves : `$V/updating.log`, `$V/flows/updating-fr.png` ; auditeur : extraits cités dans `$A/rapport-axe-6.md`.
- Où : `src/lib/components/bottles/ConfirmButtons.svelte:19`, `src/lib/components/barcode/BulkBarcodeDialog.svelte:471`, `src/routes/statistics/+page.svelte:28-29`.
- Régression : **oui, en partie**. `git log -S"out_of_cellar.updating" 9df0d08c..cf48032d` → ba910245 (« feat(bottles): share one status dialog and one move dialog », UI-13, 2026-10-23) : à `9df0d08c`, le hors cave affichait `out_of_cellar.updating` = « Mise à jour… » (`fr.json:354`, `out-of-cellar/+page.svelte:306`). La page vin n’avait aucun texte d’envoi à `9df0d08c` (son Confirmer n’était pas grisé) : le texte y est nouveau. `BottleDetailsDialog.svelte:499,621`, `BulkBarcodeDialog.svelte:643` et les statistiques (`:319,360,489`) avaient déjà ce motif à `9df0d08c`. Le contrôle de la typographie française d’`i18n:check` date de 0cd59b10 (2026-10-28, après UI-13) et ne couvre que les fichiers de langue.
- Vérification : confirmé, sévérité et régression en partie confirmées.

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

**V6-m1. Statistiques : les parts du camembert des décennies ont des gris presque identiques**
- Ce qui se passe : les décennies prennent tour à tour slate-500, gray-500, zinc-500, neutral-500… Le rapport de contraste entre deux couleurs voisines va de 1,000 à 1,019. Les parts ne se distinguent que par le liseré blanc, et la pastille de légende ne permet pas de savoir quelle part est « Années 1990 » et laquelle « Années 2010 ». Clair et sombre.
- Reproduction : une cave avec des bouteilles disponibles de trois décennies (1995, 2001, 2018), `/statistics`, carte « Âge des vins par décennie ».
- Preuves : `$V/shots/stats-fr-light-1280.png`, `$V/shots/stats-en-dark-1280.png`, `$V/decade-contrast.log` ; auditeur : `$A/shots/stats-fr-dark-1280.png`.
- Où : `src/routes/statistics/+page.svelte:39-54` (`neutralColors`, `neutralColor`), utilisé en `:401,412`.
- Régression : non. Même code à `9df0d08c` (`statistics/+page.svelte:24-38,390,401`), venu de 2ee50101 (BUG-06, 2026-10-11). La décision « Couleurs décoratives et statuts (UI-18) » ne cite pas ce camembert.
- Vérification : confirmé.

**V6-m2. CSV des codes-barres : la colonne `location` ne donne que le nom de la case, que deux conteneurs peuvent partager**
- Ce qui se passe : les noms de cases ne sont uniques que dans un conteneur. Le conteneur « Cave A » avec le suffixe « 1 » et le conteneur « Cave » avec le suffixe « ␣A1 » ont chacun une case « Cave A1 ». `GET /api/barcode/export-all` et `POST /api/barcode/csv` écrivent `Cave A1` pour les deux bouteilles : l’inventaire ne dit pas dans quel meuble est la bouteille. La colonne Emplacement des tableaux de bouteilles (`BottleTable.svelte:143`, `storageCase.name`) est dans le même cas. UI-12 a ajouté `containerName` à l’export CSV des bouteilles seulement, comme le demandait la décision « Page stockage (UI-09) ».
- Reproduction : `$V/scripts/seed.mjs` puis `$V/scripts/api.mjs` sur l’app : `VX00000002,émile,…,Cave A1` et `VX00000003,Éric,…,Cave A1`.
- Preuves : `$V/run1/seed.log`, `$V/run1/api.log` ; auditeur : `$A/run1/api-casename.log`.
- Où : `src/lib/server/features/barcode/repository.ts:145,159` (`storageCaseName` seul), `src/lib/server/features/barcode/service.ts:205`.
- Régression : non (même colonne à `9df0d08c`, `barcode/service.ts:187,199`). Les décisions « Page stockage (UI-09) » et « Noms de rangement uniques (UI-12) » écartent un séparateur automatique et ne parlent que de l’export des bouteilles. C’est le reste d’affichage de a6 m19.
- Vérification : confirmé.

## 4. Déjà connus (non comptés)

- Les 18 points « Trouvé pendant » marqués « pas fait » en section 2 : listés dans la feuille de route comme hors périmètre de BUG-19, BUG-20, UI-11 et UI-12 ; aucune tâche de P10 ou P11 ne les reprend (`ROADMAP.md`, aucune source « Trouvé pendant BUG-19/BUG-20/UI-11/UI-12 »). Deux pèsent plus que leur libellé : avec un ancien préfixe de plus de 6 caractères, la page codes-barres défile de 443 px en largeur à 390 px [longpref] ; et « Enregistrer » grisé sans raison contredit la décision « Messages d’erreur (P7) » [empty-name].
- DK-11204 et ses 9,3 modules de zone blanche : décision « Page codes-barres (UI-08) » ; lue 51/51 [bench].
- UPC-E, EAN-13 à 0 initial, Data Matrix natif : décision « Limites acceptées (audit d’avant 1.0) ».
- Préréglages Avery placés d’après les gabarits plutôt que la marge annoncée : décision « Étiquettes (BUG-16) ».
- « Frigo » et « frigo » coexistent (201) et l’import CSV les confond : décision « Noms de rangement uniques (UI-12) » [api].
- Un PUT de conteneur sans `caseCapacities` remet 5 : décision « Champs numériques (BUG-14) ».
- Plus rien ne remet les préréglages livrés supprimés : décision « Endpoints et CSRF (API-06) ».
- Sous un préfixe vide, un code manuel de 10 chiffres compte comme un code de Cellar : décision « Limites acceptées ».
- Un nouvel essai après une réponse perdue ajoute deux fois la note de consommation : décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) ».
- Deux formulations de la session expirée, `auth.session_expired` et `errors.unauthenticated` : aussi dans « Trouvé pendant UI-15 ».

## 5. Corrections du vérificateur

- UI-11, « Trouvé : “Retour” après Précédent mène à `/wines` » : **fait autrement → pas fait**. L’auditeur cite le commentaire de `BackButton.svelte:6-9` ; un commentaire et la mention « point ouvert, voulu » de la tâche ne sont pas une décision de « Décisions prises » ni une décision datée du mainteneur, ce qu’exige « fait autrement » (brief-common). Le comportement reste voulu : au mainteneur de l’accepter par une décision.
- UI-12, « Trouvé : `updatedAt` à la seconde » : **fait autrement → pas fait**, même raison : documenté dans `docs/API.md`, sans décision.
- BUG-19, badge du préfixe trop long : verdict « pas fait » inchangé, preuve renforcée : la page défile de 443 px en largeur à 390 px, et le badge sort de sa carte à 1280 px [longpref].
- R6-m9b : verdict « fait » inchangé ; « Absents (grep) » est inexact : `isDarkMode` existe encore, comme paramètre de `applyTheme` (`utils/theme-colors.ts:288,310`), pas comme la variable morte de l’audit.
- V6-m1, V6-m2, V6-m3 : confirmés, sévérité Mineur gardée. V6-m3 : régression en partie confirmée et datée (ba910245, UI-13).
- Aucun constat ajouté. Un essai de copie CRLF faite par `sed 's/$/\r/'` n’a pas été remplacé : le fichier livré n’a pas de saut de ligne final et `sed` ajoutait un `\r` seul à la dernière ligne, ce qu’aucune conversion LF → CRLF ne fait ; une conversion réelle (`perl -pe 's/\n/\r\n/'`) est remplacée [crlf]. Pas un défaut.

## 6. Désaccords

Aucun désaccord que les preuves ne tranchent pas. Les deux reclassements de la section 5 tiennent à la règle de « fait autrement » (une décision nommée), pas à un fait contesté : l’auditeur et le vérificateur s’accordent sur le comportement, voulu et documenté.

## 7. Renvois (hors axe)

- `{@html}` restants dans l’admin : `ZipImportResultsDialog.svelte`, `ZipImportInfoDialog.svelte`, `CsvImportResultsDialog.svelte` (grep à `cf48032d`) ; pour l’axe 4 (renvoi de l’auditeur, confirmé).
- Textes anglais « Wines in Cave » et « In Cave » (`en.json:424,429`), où « cave » vient du français ; pour l’axe 5. Les mêmes libellés sont déjà cités pour leurs capitales dans « Trouvé pendant UI-15 ».
- Abréviation des barres des statistiques à 6 ou 10 caractères puis « ... », sans infobulle : « Austra... » illisible (`statistics/+page.svelte:28-29`, capture `$V/shots/stats-fr-light-1280.png`) ; pour l’axe 5. Les trois points ASCII de ce même code font partie de V6-m3.

## Nettoyage

- Serveurs lancés par le vérificateur, chacun arrêté puis contrôlé par `ps -p` : PID 76257 (app, port 4565), 15613 (base 0.7.0 mise à jour, 4566), 20401 (redémarrage avec la copie CRLF, 4566), 21754 (redémarrage avec la copie modifiée, 4566) : tous disparus. Aucun processus n’écoute sur 4565 à 4569 (`lsof`). Journal : `$V/pids.log`.
- Navigateurs Chromium des scripts fermés par `browser.close()` ; les Chromium headless encore présents appartiennent à un autre agent (`node scripts/pages.mjs`).
- Worktree `$S/p12/wt-v6` supprimée (`git worktree remove --force`), absente de `git worktree list`.
