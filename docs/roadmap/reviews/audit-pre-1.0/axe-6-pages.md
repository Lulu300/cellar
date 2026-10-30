# Audit d'avant 1.0, axe 6 : pages fonctionnelles et codes-barres

Commit audité `9df0d08c` (develop, 2026-10-16). Périmètre : en partie A, les codes-barres, les étiquettes PDF et le scanner (`src/routes/barcode`, `src/routes/api/barcode`, `features/barcode`, `features/labels`, `src/lib/shared/barcode.ts` et `labels.ts`, `QrScannerDialog`, `BarcodeDialog`) ; en partie B, les pages stockage, historique, hors cave, statistiques, manques, préférences et la page racine. Méthode : lecture du code, puis l'app lancée depuis des worktrees détachées avec des données inventées, pilotée par curl et par un Chromium headless en CDP (caméra factice, getUserMedia ralenti, étiquettes rendues en vidéo `.y4m`). Les PDF d'étiquettes ont été générés pour les 28 préréglages livrés, rendus à 300 dpi et décodés par zxing-wasm. Chaque constat a été revu par un second agent, qui l'a rejoué dans sa propre worktree pour tenter de le réfuter. Les six points signalés par d'autres axes ont été vérifiés par le rédacteur, par lecture du code et par des requêtes SQLite en mémoire.

## 1. Résumé

Les défauts graves de la revue 6 sont corrigés. Il n'y a plus qu'un seul format de code-barres, qui lève une erreur au lieu de tronquer, et la XSS de la page stockage a disparu. Le PDF est vectoriel : 568 étiquettes sur 568 imprimées en page 1 se décodent. La caméra s'éteint à la fermeture du scanner, et les règles du stockage passent par le serveur. Les huit critères d'acceptation de l'axe sont tenus. Sur 105 lignes de traçabilité, 82 sont corrigées. Les points ouverts portent sur les étiquettes (hauteur des barres, bouton PDF actif sur une plage invalide, formulaire par défaut invalide), sur les limites connues du scanner et sur six restes de la page stockage. Trois choix attendent le mainteneur : le millésime 0 (axe 1) et les endpoints sans appelant (axe 2), traités ailleurs, et le tri de l'historique (m2). La passe 2 trouve deux Majeurs :
- les préréglages Avery livrés impriment moins d'étiquettes que la planche, décalées des découpes (M1) ;
- dans le dialogue de changement de statut, une note tapée sous « Consommée » puis masquée remplace les notes de toutes les bouteilles sélectionnées (M2).

La passe 2 trouve aussi 19 Mineurs, dont quatre défauts vus par plusieurs auditeurs et regroupés ici : préfixe de code-barres comparé par `LIKE`, tri SQL par octets, préréglages livrés refusés par le PDF, règles des manques et des statistiques sans test.

## 2. Traçabilité (passe 1)

105 lignes : 82 Corrigé, 0 Partiel, 19 Non fait, 3 Sans objet, 1 Écart décidé. Les vérificateurs ont rejoué toutes les lignes non corrigées, tous les critères et toutes les lignes issues d'un Critique ou d'un Majeur, et une partie des Mineurs. Ils ont confirmé tous les verdicts et ajouté une ligne (R6-m8c). Les lignes UI-04/Reste-2 et UI-09/Reste-7b (endpoints sans appelant) sont traitées à l'axe 2, UI-04/Trouvé-3 (millésime 0) à l'axe 1.

### Revue 6

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R6-C1 | Codes à 10 caractères ici, 13 là ; `slice(-n)` tronque | Corrigé | Une seule `formatBarcode` (`src/lib/shared/barcode.ts:190-198`), qui lève `BarcodeRangeError` ; `barcodeStats` réutilise `getNextBarcodeNumber` (`features/barcode/service.ts:142`). Repro : préfixe `ab`, `POST /api/barcode/csv {1,4}` → `ab00000001`, `ab00000002` avec leur vin, puis `ab00000003`, `ab00000004` vides ; `next-barcode` = `stats.nextNumber` = 3 |
| R6-C2 | XSS stockée via `{@html}` sur la page stockage | Corrigé | Aucun `{@html}` dans `src/routes/storage` ni `components/storage`. Conteneur nommé `<img src=x onerror=alert(1)>` : `/storage` le rend échappé |
| R6-M1 | Faux DOM, faux motifs, `addImage` JPEG | Corrigé | Barres `pdf.rect` depuis `code128Bars` (`features/labels/pdf.ts:84-98`) ; jsbarcode et pngjs retirés ; code non encodable → 409 `barcode_not_encodable`. Banc : 112 combinaisons (28 préréglages × barcode/QR × bordure), 96 PDF, 568/568 étiquettes de page 1 décodées, aucun code parasite |
| R6-M2 | Écriture hors de tmpdir via le préfixe, fichier temporaire + `setTimeout` | Corrigé | `api/barcode/csv/+server.ts:8-12` répond directement ; aucun `tmpdir`/`setTimeout` ; préfixes `../x`, `A"B`, `ABCDEFG` → 422 `invalid_barcode_prefix` |
| R6-M3 | Mise en page et validation en trois versions ; serveur sans validation | Corrigé | Un seul `checkLabelLayout` (`shared/labels.ts:105-144`), appelé par la page (`label-options.svelte.ts:33-37`) et le PDF (`pdf.ts:19-33`) ; `labelSheetSchema` ; test de parité « the label checks of the barcode page » (`pdf-labels/server.test.ts:221`). Écarts restants : UI-08/Reste-1 et 2 |
| R6-M4 | Page de 1685 lignes, deux copies du formulaire, blob copié 4 fois | Corrigé | `barcode/+page.svelte` : 170 lignes ; un seul `LabelPdfCard` pour les deux modes (`:48-52`, `:140-144`) ; un seul `downloadFile` (`components/barcode/api.ts:13-30`) |
| R6-M5 | Caméra laissée allumée si on ferme pendant le démarrage | Corrigé | Compteur `generation` et `$effect` avec cleanup (`QrScannerDialog.svelte:54-64`, `66-112`). CDP, getUserMedia ralenti de 1,5 s : pistes vivantes 1/1 pendant le démarrage, 0/1 après fermeture |
| R6-M6a | Règles « case occupée / capacité / conteneur non vide » côté client seulement | Corrigé | `features/storage/service.ts:146-150` (409 `case_holds_bottles`), `:79-94` (409 `case_full`) ; rejoué : capacité baissée sous l'occupation → 409 `case_full`, case retirée → 409 `case_holds_bottles`, `DELETE` d'un conteneur non vide → 409 |
| R6-M6b | `DELETE /api/storage-cases/[id]` sans vérification | Corrigé | `api/storage-cases/[id]/+server.ts:6-9` → `deleteStorageCase` ; rejoué : 409 ; test « answers 409 and keeps a case that still holds an available bottle » |
| R6-M6c | `removeCase` supprime sur le serveur même si l'utilisateur annule | Corrigé | `container-draft.svelte.ts:73-75` ne touche que le brouillon ; navigateur : retirer une case puis Annuler → aucune requête, cases intactes |
| R6-M6d | `/api/storage-occupancy` appelé une fois par case | Corrigé | Une requête groupée `caseLoads` (`features/storage/repository.ts:111-126`) |
| R6-M7a | Cases retrouvées par leur nom reconstruit | Corrigé | `StorageTable.svelte:43-44` lit `container.cases[position]` ; groupement par `containerId` (`service.ts:39-44`) |
| R6-M7b | Case renommée avec un suffixe non numérique disparaît | Corrigé | Affichage indépendant du nom ; test « takes the suffix of each case from its name » |
| R6-M7c | Collision « A1 »+« 1 » / « A »+« 11 » | Corrigé | Test « are told apart by id when two containers give the same name » (`features/storage/service.test.ts:238`). Le nom reste ambigu : UI-09/Reste-6 et m19 |
| R6-M7d | Cases triées par UUID | Corrigé | Conteneurs triés par `compareText(containerLabel(name))` (`service.ts:41-43`), cases par `position` |
| R6-M8 | Changer de filtre ne revient pas en page 1 ; `changeFilter`/`changeItemsPerPage` morts | Corrigé | `cellar-history/+page.svelte:15-17` remet `page: null` ; le `changeFilter` actuel est une nouvelle fonction, appelée par le `Select` (`:54`). Page hors limites ramenée à la dernière (`bottles/service.ts:121-127`) |
| R6-M9a | Colonne emplacement toujours « N/A » | Corrigé | `BottleTable.svelte:146` ; rejoué : la bouteille hors cave rangée en A1 affiche `A1` |
| R6-M9b | Tri `definition` compare des objets | Corrigé | Tri SQL sur `wineDefinitions.name` ; test « sorts on the name of the wine ». Collation restante : m2 |
| R6-M9c | `Promise.all` annonce un échec après une mise à jour partielle | Corrigé | Un seul PATCH tout ou rien (`out-of-cellar/+page.svelte:83-87`, `utils/bottle-changes.ts:23-29`) |
| R6-M10a | Camembert vide avec une seule catégorie | Corrigé | `utils/pie-chart.ts:23` (`full: true`), `PieChart.svelte:12-20` ; test « draws a single category as a full circle » ; rejoué : `<circle cx="100" …>` |
| R6-M10b | Pourcentages sur `totalBottles` alors que les types null sont retirés | Corrigé | Parts calculées sur la somme des tranches (`pie-chart.ts:19`) ; `typeId` et `colorId` `NOT NULL` |
| R6-M11a | Aucune load function, tout en `onMount` + `fetch` | Corrigé | `+page.server.ts` pour storage, cellar-history, out-of-cellar, statistics, wine-shortage ; aucun `fetch(` dans un `onMount` de `src/routes` |
| R6-M11b | Erreurs avalées, état vide affiché | Corrigé | Les loads lèvent ; `+error.svelte` traduit ; `/nope` → 404, texte français |
| R6-M11c | Historique et hors cave téléchargent toute la cave | Corrigé | `listBottlePage`, SQL `limit/offset` (`bottles/repository.ts:146-155`) |
| R6-m1a | Textes en dur : avertissements de validation en anglais (barcode) | Corrigé | `LabelPdfCard.svelte:105-142` affiche `options.issues` par code ; i18n:check à 0 |
| R6-m1b | Textes en dur : « Preview: », « to » (barcode) | Corrigé | `grep` dans `components/barcode` : rien |
| R6-m1c | Textes en dur : storage:767,781,987 | Corrigé | Page réécrite, textes via `m[...]` |
| R6-m1d | Textes en dur : wine-shortage:72 | Corrigé | `m['wine_shortage.*']` |
| R6-m1e | Pluriel bricolé, out-of-cellar:292 | Corrigé | Pluriels ICU (`out_of_cellar.showing_bottles`, `selected_count`…) |
| R6-m1f | Phrase assemblée par morceaux, cellar-history:378 | Corrigé | `history.total` et `table/Pagination.svelte` |
| R6-m1g | `{decade}s`, statistics:470 | Corrigé | Message `statistics.decade` (`statistics/+page.svelte:404`) |
| R6-m1h | Couleurs associées à des libellés français | Corrigé | `typeFill`/`colorFill` (`utils/wine-badges.ts`), décision UI-03 |
| R6-m1i | `formatCurrency('en-US')` | Corrigé | `utils/format.ts:28-40` suit `getLocale()` ; seule définition |
| R6-m1j | `\|\| 'Réessayer'` inutile, QrScanner:221 | Corrigé | `grep Réessayer src` : rien |
| R6-m2a | `formatDate`/`formatCurrency` dans 4 pages | Corrigé | Une seule définition, `utils/format.ts:10,28` |
| R6-m2b | Libellé et variante de disponibilité copiés | Corrigé | `components/bottles/availability.ts`, `AvailabilityBadge.svelte` |
| R6-m2c | Fenêtre de pagination copiée 3 fois | Corrigé | `utils/pagination.ts:2`, seul utilisateur `table/Pagination.svelte:46` |
| R6-m2d | En-tête triable copié 14 fois | Corrigé | `table/SortableHeader.svelte` ; aucun autre `toggleSort` |
| R6-m2e | Échappement CSV dans 3 endpoints, `location` non échappé | Corrigé | `server/csv.ts:33-43`, utilisé par `barcode/service.ts:201` et `backup/service.ts:171` |
| R6-m2f | Logique de thème en 3 exemplaires | Corrigé | `utils/theme.ts` supprimé ; `stores/preferences.svelte.ts`, `utils/theme-colors.ts` |
| R6-m3 | Fuites des préférences (`subscribe`, `matchMedia`) | Corrigé | Plus d'abonnement dans `preferences/+page.svelte` ; `matchMedia` écouté par le store singleton (`preferences.svelte.ts:40`) |
| R6-m4 | N+1 dans le CSV des codes-barres | Corrigé | Une requête `barcodeRows` (`barcode/service.ts:249`) |
| R6-m5 | 16 `console.*` dans pdf-labels | Corrigé | `grep console.` dans labels, barcode et `api/barcode` : rien |
| R6-m6a | `showBorder` ni enregistré ni restauré | Corrigé | `shared/schemas/label.ts:23` |
| R6-m6b | `<select>` lié à un objet perd la sélection | Corrigé | `PresetManager.svelte:119-131` : `value={selectedId}` |
| R6-m6c | Suppression d'un préréglage sans confirmation | Non fait | `PresetManager.svelte:225-233` appelle `deletePreset` (`:75-89`) sans confirmation. N'importe quel préréglage part en un clic, préréglages livrés compris (`labels/repository.ts:36-37`), et rien ne les remet (décision API-06) |
| R6-m7a | Boutons à icône seule sans `aria-label` | Corrigé | Balayage des `<Button>` sans texte : tous ont un `aria-label` |
| R6-m7b | En-têtes de tri sans clavier ni `aria-sort` | Corrigé | `SortableHeader.svelte:23-25` |
| R6-m7c | `Label` sans `for` sur les marges | Corrigé | Tous les `<Label` de `LabelSettingsForm.svelte` ont un `for` |
| R6-m7d | Graphiques sans équivalent textuel | Corrigé | `PieChart.svelte:9-10` `aria-hidden`, légende avec les comptes |
| R6-m7e | `min-w-[800px]` sur les dialogues de stockage | Corrigé | Absent ; `ContainerDialog.svelte:94` `sm:max-w-3xl` |
| R6-m8a | `any` omniprésent | Corrigé | 3 `any` restants, hors périmètre ; `no-explicit-any` en erreur (UI-03) |
| R6-m8b | Mélange Svelte 4 / Svelte 5 | Corrigé | Aucun `export let` dans `src/routes` ni `components` ; plus de `svelte/store` |
| R6-m8c | Aucun type partagé pour les réponses d'API (ajoutée par le vérificateur) | Corrigé | `src/lib/shared/dto.ts` (41 exports), ex. `StorageContainerDTO` importé par `EditContainerButton.svelte:5` |
| R6-m9a | Dossier vide `api/test-barcode/` | Corrigé | Absent |
| R6-m9b | `isDarkMode` et `percentage` de légende | Corrigé | Absents |
| R6-m9c | `viewMode 'list'` / `containersPerPage` | Corrigé | `viewMode` : `'table' \| 'grid'` ; `containersPerPage` sert à la pagination (`storage/+page.svelte:32-38`) |
| R6-m9d | `isValidBarcode` et `validateBarcodeSettings` | Corrigé | Absents |

### BUG-01

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-01 | Même plage : mêmes codes en CSV et PDF ; le CSV retrouve les bouteilles | Corrigé | Test « prints the same codes as the CSV of the same range » (`pdf-labels/server.test.ts:90`) ; repro CSV (R6-C1) ; codes décodés du banc = `formatBarcode('CV', 1..6)` |
| BUG-01/Trouvé-1 | `generateSequentialBarcode` tronque ; `it.fails` à passer en `it` | Corrigé | `barcode.ts:194-196` lève ; test « refuses a number too long for the prefix instead of truncating it » (`shared/barcode.test.ts:25`) ; plus d'`it.fails`. Repro : préfixe `XYZAB2`, départ 9999, 2 bouteilles → 409 `barcode_range`, aucune créée |

### BUG-06

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-06 | Filtre → page 1, colonne emplacement et tri, camembert à une part | Corrigé | R6-M8, R6-M9a-c, R6-M10a, rejoués sur le serveur d'audit |

### BUG-07

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-07 | Ouvrir puis fermer tout de suite éteint la caméra | Corrigé | CDP : ouverture puis Échap → 0/1 piste vivante ; fermeture à 300 ms d'un démarrage lent → 0/1 ; fermer puis rouvrir → 0/2 ; navigation vers `/statistics` dialogue ouvert → 0/1 |
| BUG-07/Trouvé-1 | html5-qrcode importé en tête, dans `dependencies` | Corrigé | Retiré ; `barcode-detector` en `devDependencies` (`package.json:40`), chargé à la demande (`utils/barcode-scanner.ts:43`) |

### BUG-08

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-08 | PDF scanné à 100 % par le scanner de l'application ; entrée invalide → 400 | Corrigé | Banc zxing-wasm 568/568 ; scanner de l'app dans Chrome headless, caméra factice : `CV00000001` lu avec le `BarcodeDetector` natif et avec le repli zxing-wasm. Corps invalide → 422 `invalid_body` (convention d'API-01), corps non JSON → 400 |
| BUG-08/Trouvé-1 | `Buffer.slice` déprécié | Corrigé | `pdf.ts:65` : `Buffer.from(pdf.output('arraybuffer'))` |
| BUG-08/Trouvé-2 | PDF de 4 étiquettes à 1,9 Mo | Corrigé | Mesuré : 6 étiquettes Avery 5160 = 24 414 octets (QR : 67 931) ; 30 étiquettes = 107 Ko |

### DEP-05

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DEP-05 | Étiquettes du banc lues à 100 %, sans BarcodeDetector natif aussi ; html5-qrcode retiré | Corrigé | Lecture par l'app avec `delete window.BarcodeDetector` (repli zxing-wasm) d'une étiquette à bordure sur fond sombre ; fond sombre au banc : 188/188 étiquettes présentes lues. Échantillon : les 432 vidéos du banc d'origine n'ont pas été rejouées |

### UI-04

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-04 | Données dès le rendu serveur, sans `fetch` dans `onMount` | Corrigé | `/storage`, `/cellar-history`, `/out-of-cellar`, `/statistics`, `/wine-shortage` rendus avec leurs données (curl) ; aucun `fetch(` dans un `onMount` de `src/routes` |
| UI-04/Trouvé-1 | Carte d'AGENTS.md qui décrit `src/lib/db/` avec ses services | Corrigé | `AGENTS.md:29,31` |
| UI-04/Trouvé-2 | La 307 de `/` rendait les healthchecks « unhealthy » | Corrigé | `src/routes/+page.svelte:6-8` (meta refresh), `+page.ts:8-10` ; tests `routes/page.test.ts:22,30` ; rejoué : `GET /` et `HEAD /` → 200 |
| UI-04/Trouvé-3 | Millésime 0 : sens et affichage jamais décidés | Non fait | Voir axe 1. Affichages divergents : `0` dans `BottleTable.svelte:142`, N/A sur la page vin, masqué dans le hors cave, décennie « Années 0 » dans les statistiques, `0` dans l'export CSV |
| UI-04/Trouvé-4 | Le banc comparait mal les réponses | Sans objet | Outil hors du dépôt (`git ls-files \| grep -i bench` : rien) |
| UI-04/Reste-1 | État de connexion chargé côté client | Non fait | `stores/auth.svelte.ts:28-31` : 2 `fetch` (et non plus 3), appelé par `+layout.svelte:53` ; `+layout.server.ts:14-29` ne transmet pas la session |
| UI-04/Reste-2 | GET `/api/wine-shortage`, `/api/statistics`, `/api/images`, `/api/wines`, `/api/bottles` sans appelant | Non fait | Voir axe 2. Toujours servis et sans appelant ; s'y ajoute `GET /api/storage-containers` |

### UI-08

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-08 | Une seule copie du formulaire ; client et serveur valident avec le même code | Corrigé | R6-M3, R6-M4 ; repro 50 × 30 : la page bloque (0,29 mm) et le serveur répond 422 `module_width_below_minimum` (`actual` 0,2897) |
| UI-08/Trouvé-1 | `BarcodeDialog` vide le DOM à la main | Corrigé | SVG depuis `code128Bars` (`BarcodeDialog.svelte:72-101`), aucun `eslint-disable` |
| UI-08/Trouvé-2 | Bouton dans un bouton | Corrigé | Page réécrite ; `PresetManager.svelte:95-135` sans imbrication |
| UI-08/Trouvé-3a | Scanner aveugle sur fond sombre | Corrigé | Traité par DEP-05 |
| UI-08/Trouvé-3b | QR codes en PNG | Corrigé | Carrés vectoriels (`pdf.ts:122-143`) ; test « draws each QR code as vector squares, not as an image » |
| UI-08/Trouvé-3c | Formats de page répétés | Corrigé | `PAGE_FORMATS` unique (`shared/labels.ts:15-24`) |
| UI-08/Trouvé-3d | DK-11204 : 9,3 modules de blanc au lieu de 10 | Non fait | Choix commenté (`barcode.ts:133-139`), sans décision. Mesuré : première barre à 3,075 mm du bord = 9,3 modules de 0,33 mm ; lue quand même au banc (6/6) |
| UI-08/Trouvé-3e | La page recopie la règle de largeur | Corrigé | `code128ModuleWidth` (`labels.ts:113`) ; test « warns about bars under the recommended width once the quiet zones are counted » |
| UI-08/Trouvé-4a | UPC-E hors règles GS1 relu sous un autre code | Non fait | Repli `rawValue.slice(1)` (`barcode-scanner.ts:63`), sans décision |
| UI-08/Trouvé-4b | Anciens scans d'EAN-13 à 0 initial gardés sur 13 chiffres | Non fait | Aucune normalisation des codes stockés |
| UI-08/Trouvé-4c | Détecteur natif macOS : 12/20 Data Matrix | Non fait | Le natif est toujours préféré dès qu'il lit Code 128 et QR (`barcode-scanner.ts:36-40`) |
| UI-08/Trouvé-4d | Caméra débranchée en plein scan : aucun message | Non fait | Aucun écouteur `ended`/`inactive` ; CDP : `track.stop()` → le dialogue reste « Scanner un code… » sans erreur ni « Réessayer » |
| UI-08/Trouvé-4e | Une CSP future devra autoriser `wasm-unsafe-eval` | Sans objet | Aucune CSP aujourd'hui ; note à garder |
| UI-08/Trouvé-4f | Non testé sur vrai iPhone ni Android | Écart décidé | Décision « Scanner sur téléphone (DEP-05) » |
| UI-08/Trouvé-5a | Import CSV des préréglages sans contrôle | Corrigé | `db/migrations.ts:164-204` : `labelPresetSchema.safeParse` par ligne |
| UI-08/Trouvé-5b | `labelSheetSchema` côté serveur | Corrigé | `shared/schemas/label.ts:47` |
| UI-08/Reste-1 | Hauteur contrôlée `labelHeight - 2*padding`, barres plus courtes dans le PDF | Non fait | `labels.ts:111,120-124` contrôle 15 mm pour DK-11204 ; `pdf.ts:75-78` dessine 10 mm ; mesuré : 240 rectangles de 28,346 pt = 10,0 mm, sans blocage |
| UI-08/Reste-2 | Plage hors limites ou préfixe manuel invalide ne désactivent pas le bouton PDF | Non fait | `label-options.svelte.ts:34` valide avec un préfixe `''` ; `LabelPdfCard.svelte:154` et `CsvRangeCard.svelte:76` ne regardent que `printable` ; le serveur répond un 422 traduit |
| UI-08/Reste-3 | Formulaire par défaut (50 × 30 mm) invalide dès l'ouverture | Non fait | `label-options.svelte.ts:13-27` ; 422 `module_width_below_minimum` (0,2897 < 0,33) ; `labels.test.ts:66-77` le constate |

### UI-09

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-09 | Annuler une édition ne modifie rien ; occupation identique partout | Corrigé | Brouillon (`container-draft.svelte.ts:19-22`) et Annuler sans requête (navigateur) ; une seule occupation (`features/storage/repository.ts:98-126`) ; test « is the same in every answer that gives it » |
| UI-09/Trouvé-1 | Message générique pour le 409 de suppression d'une case | Corrigé | `utils/api-error.ts:34-35` traduit `case_holds_bottles` et `case_full` avec le nom de la case |
| UI-09/Trouvé-2 | `AllBottlesDialog` ne rafraîchit pas l'occupation | Corrigé | `AllBottlesDialog.svelte:126` : `invalidate(CELLAR)` |
| UI-09/Trouvé-3 | Tri par `localeCompare` | Corrigé | Aucun `localeCompare` hors tests ; `compareText` côté serveur |
| UI-09/Reste-1 | Cases ajoutées par CSV à un conteneur existant : position 0 | Non fait | `csv-import/tables.ts:45-48` ne traite pas `position` ; défaut 0 (`db/schema.ts:168`) |
| UI-09/Reste-2 | Le serveur reconstruit le nom des cases (conteneur + suffixe) | Non fait | `features/storage/service.ts:106` ; une case importée « Top shelf » du conteneur « C » devient « CTop shelf » à l'enregistrement |
| UI-09/Reste-3 | Un brouillon ouvert longtemps supprime une case créée entre-temps | Non fait | Pas d'`updatedAt` dans `containerSchema` ; `updateContainer` supprime toute case absente (`service.ts:172-179`) |
| UI-09/Reste-4 | Une capacité vidée devient 5 | Non fait | Le schéma accepte null, le service met `DEFAULT_CASE_CAPACITY` (`service.ts:107`) |
| UI-09/Reste-5 | Seul conteneur sans case : « aucune donnée », sans bouton | Non fait | `storage/+page.svelte:114` ; le PUT accepte `cases: []` |
| UI-09/Reste-6 | L'import CSV identifie les cases par leur nom | Non fait | `csv-import/tables.ts:45-48,66` ; pas d'unicité sur `storage_cases.name` |
| UI-09/Reste-7a | `/api/storage-occupancy` sans appelant | Sans objet | Nouvel appelant : `forms/StorageCasePicker.svelte:27` |
| UI-09/Reste-7b | `DELETE /api/storage-cases/{id}` sans appelant | Non fait | Voir axe 2. Aucun appel hors tests ; toujours servi avec son 409 |

## 3. Nouveaux constats (passe 2)

### Critique

Aucun.

### Majeur

**M1. Préréglages Avery livrés : 2 mm d'espacement vertical, moins d'étiquettes que la planche et des étiquettes hors des découpes**
- Où : `scripts/data/label_presets.csv:2-7` (`horizontal_spacing,vertical_spacing` = `2,2`) ; `src/lib/shared/labels.test.ts:36-50`
- Scénario : choisir « Avery 5160 » et imprimer 30 codes sur une planche Avery 5160 → 27 étiquettes en page 1 (3 × 9 au lieu de 3 × 10). La rangée k est imprimée à 11,8 + 27,4k mm au lieu de 12,7 + 25,4k : l'écart va de −0,9 mm (rangée 1) à +15,1 mm (rangée 9), et la 9e rangée chevauche les découpes 9 et 10. La 3e colonne est décalée de −2,5 mm (pas horizontal de 68,675 mm au lieu de 69,85). Les codes suivants partent sur une nouvelle feuille, dont la 10e rangée reste vide : 3 étiquettes perdues par planche. Attendu : 30 étiquettes alignées sur les découpes. Grilles calculées par `labelGrid` sur le CSV :

  | Préréglage | Grille calculée | Planche réelle |
  |---|---|---|
  | Avery 5160 et 8160 | 3 × 9 = 27 | 30 |
  | Avery 5161 | 2 × 9 = 18 | 20 |
  | Avery 5162 | 2 × 7 = 14 | 14, mais marge haute de 11,8 mm au lieu de 21,2 : écart de −9,4 mm (rangée 1) à +2,8 mm (rangée 7) |
  | Avery 5163 | 2 × 4 = 8 | 10 |
  | Avery 5164 | 2 × 2 = 4 | 6 |

- Correction proposée : corriger les lignes Avery du CSV : espacement vertical 0, espacement horizontal 3,175 mm pour 5160 et 8160, marges latérales et marge haute de 5162 d'après les gabarits Avery (les sources varient de 0,186″ à 0,22″ pour les marges latérales, à vérifier sur la fiche). Ajouter une migration qui ne met à jour que les préréglages semés encore identiques aux anciennes valeurs (même nom, mêmes mesures), et une phrase dans les notes de version. Faire porter le test « fits an Avery 5160 sheet » sur la ligne réelle du CSV : il n'obtient aujourd'hui 3 × 10 qu'en posant `verticalSpacing: 0`. Même CSV et même migration que m3. Ce n'est pas une régression : la ligne et la formule existaient déjà à 556c7bb.
- Preuve : `generateLabelsPdf` : Avery 5160, 27 codes tiennent sur 1 page, 28 en demandent 2 ; Avery 5164 : 4 sur 1 page, 6 en demandent 2 ; Avery 5163 : 8 et 10. Au banc, les 8 codes manquants sur 576 sont ceux d'Avery 5164.
- Vérification : Confirmé, corrigé (le vérificateur a recalculé les décalages sur le gabarit Avery, corrigé « la page 2 commence au milieu d'une planche » en « une rangée vide par planche », et ajouté l'espacement horizontal et la marge haute de 5162 à la correction).

**M2. Changement de statut : une note tapée sous « Consommée » puis masquée remplace les notes de toutes les bouteilles**
- Où : `src/lib/utils/bottle-changes.ts:18` (`notes: note.trim()`), appelé avec la note quel que soit le statut par `src/routes/out-of-cellar/+page.svelte:85`, `src/lib/components/BottleDetailsDialog.svelte:164` et `src/routes/wines/[id]/+page.svelte:175`. Le champ note n'est affiché que pour « Consommée » (`out-of-cellar/+page.svelte:276-295`, `BottleDetailsDialog.svelte:475-490`, `wines/[id]/+page.svelte:869-880`).
- Scénario : dans le hors cave, sélectionner des bouteilles, ouvrir « Changer le statut », taper une note sous « Consommée », choisir finalement « Disponible » (le champ disparaît), confirmer. Les notes existantes de toutes les bouteilles sélectionnées sont remplacées par le texte masqué. Attendu : seule une note visible est envoyée. `consumedNote` n'est vidé qu'à l'ouverture et à la fermeture du dialogue (`:68`, `:114`). Le défaut existait déjà à 556c7bb. Majeur et non Critique : la perte est silencieuse et touche toute la sélection, mais elle demande une séquence précise (taper, puis changer d'avis). L'échelle lue à la lettre (« perte de données ») permettrait de la monter en Critique.
- Correction proposée : dans `newStatus`, n'ajouter la note que pour `CONSUMED` (`...(availability === BottleAvailability.CONSUMED && note.trim() && { notes: note.trim() })`), avec un test dans un `bottle-changes.test.ts`. Cela couvre les trois appelants. Retirer ensuite la garde locale `consuming ? consumedNote : ''` de `BulkBarcodeDialog.svelte:270-274`, devenue inutile.
- Preuve : Chromium headless en CDP sur l'app compilée. Trois bouteilles hors cave aux notes « keep me 1/2/3 », toutes cochées, statut `consumed`, « HIDDEN TEXT » tapé dans `#consumed-note`, statut passé à `available` (`#consumed-note` absent du DOM), Confirmer. Corps PATCH capté : `{"ids":[…],"changes":{"availability":"available","notes":"HIDDEN TEXT"}}`. Ensuite, `GET /api/bottles` donne les 3 bouteilles en `available "HIDDEN TEXT"`.
- Vérification : Confirmé, corrigé (portée élargie à `BottleDetailsDialog` et à la page vin ; correction déplacée dans `newStatus`).

### Mineur

**m1. Compteur et export « du préfixe » par `LIKE` : casse ignorée, préfixes plus longs et codes manuels inclus**
- Où : `src/lib/server/features/barcode/repository.ts:116` (`countBottlesWithBarcode`) et `:164` (`bottlesWithBarcodePrefix`), utilisés par `barcodeStats` et `exportPrefixBarcodes` (`features/barcode/service.ts:139,216`). La numérotation compare exactement : `substr(barcode, 1, n) = prefix` (`repository.ts:103`).
- Scénario : l'utilisateur passe du préfixe `ABCDEF` à `AB`, ou de `WINE` à `wine` (les minuscules sont permises, décision SEC-05), ou saisit des codes manuels qui commencent par le préfixe. La page codes-barres affiche alors un total qui mélange tout, et « Exporter les codes du préfixe » liste les étiquettes de l'ancien préfixe et les codes manuels. Attendu : les seuls codes générés du préfixe courant.
- Correction proposée : une condition partagée avec `highestGeneratedBarcodeNumber` (`substr(barcode, 1, length(prefix)) = prefix`, sensible à la casse, et chiffres après le préfixe) pour le compteur et l'export.
- Preuve : préfixe `ab`, bouteilles `ab00000001`, `ab00000002`, `AB00000009`, `ABCDEF0001`, `ABCDEF0002`, `abc-manual` → `GET /api/barcode/stats` : `totalWithBarcode: 6`, et `GET /api/barcode/export-all` liste les 6 (a6a). Préfixe `WINE`, une bouteille passée en `PATCH {"barcode":"wine-x-lower"}` → `totalWithBarcode` 3 → 4, et `wine-x-lower` exporté (a2b). Préfixe `wine` avec `WINE00000007`, `WINEMANUAL`, `wine00000003` → compte 3, export des 3 (a1).
- Vérification : Confirmé (constat commun à trois auditeurs, a6a N2, a2b N2 et a1 N2, réunis ici ; reproduit par les vérificateurs de a6a et de a2b).

**m2. L'historique et le hors cave trient par octets : casse, accents et valeurs vides**
- Où : `src/lib/server/features/bottles/repository.ts:113-124` (`SORT_COLUMNS`) et `:150` (`orderBy` sans `COLLATE`) ; à comparer avec `src/lib/utils/compare.ts:3-22` et `src/lib/components/bottles/bottle-table.ts:56-66` ; test `src/lib/server/features/bottles/list.test.ts:61` ; `releases.json` (résumé 0.8.0)
- Scénario : trier l'historique ou le hors cave par vin → « Zeta » passe avant « alpha », et « Échezeaux » après « Zinfandel ». Trier le hors cave par emplacement → les bouteilles sans case passent en tête (31 « N/A » avant la seule bouteille rangée). Le tri par statut suit le code interne (`available`, `consumed`, `out_of_cellar`), pas le libellé affiché. La même `BottleTable`, triée côté client dans `AllBottlesDialog` et `BottleDetailsDialog`, donne l'ordre de la langue avec les vides en dernier. Le résumé 0.8.0 annonce pourtant « accented names sorted in place ». Attendu : le même ordre que les autres tableaux (`compareText`, vides en dernier).
- Correction proposée : `ORDER BY (col IS NULL), col COLLATE NOCASE` règle les vides et la casse. better-sqlite3 n'enregistre pas de collation (`typeof db.collation` vaut `undefined`). Pour les accents, deux voies : trier en mémoire avec `compareValues` la liste filtrée (quelques milliers de lignes au plus) avant de la découper en pages, ou trier sur une clé normalisée calculée à l'écriture. Aligner le test `list.test.ts:61`, qui fige « a missing value as the lowest ». À défaut, corriger la phrase du résumé 0.8.0. Décision à prendre : le « Reste après UI-07 » note déjà que ce tri « a été rendu volontaire par UI-04, à trancher ».
- Preuve : `/cellar-history?sort=definition&dir=asc` → `Gift, Zeta, alpha, beta, Émile` (vérificateur de a6b) ; `/out-of-cellar/__data.json?sort=definition&dir=asc` → `Zinfandel, abbaye de Lérins, Échezeaux` (vérificateur de a5b) ; `/wines` rend `alpha, beta, Émile, Zeta`.
- Vérification : Confirmé (constat commun à a6b N1 et a5b N1, réunis ici ; reproduit par les deux vérificateurs).

**m3. Cinq préréglages livrés sont refusés par le PDF, et l'API des préréglages enregistre ce que le PDF refuse**
- Où : `scripts/data/label_presets.csv:13,16,20,24,25` (Brother DK-22210, Dymo 30320, Zebra 2x1, Generic 40x25, Generic 50x30, tous en `barcode`) ; `src/lib/shared/schemas/label.ts:28-31` et `src/lib/server/features/labels/service.ts:30-39` (aucun `checkLabelLayout`) ; test `src/lib/shared/labels.test.ts:85` « accepts the narrowest labels that the default presets hold »
- Scénario : choisir « Zebra 2x1 » ou « Dymo 30320 » → le bouton PDF reste grisé avec une erreur, et aucun réglage de la page ne le débloque : la largeur de module dépend d'un nombre de modules fixe (`BARCODE_MODULE_COUNT`, `labels.ts:75`), pas du préfixe. Le test cité vérifie DK-11204 (54 mm de large), alors que ces cinq préréglages sont plus étroits (29 à 51 mm). Par ailleurs, `POST /api/admin/label-presets` enregistre un QR de 8 × 8 mm ou une étiquette de 400 mm sur A4, que le PDF refuse. Attendu : un préréglage livré imprime tel quel, et un préréglage enregistré est imprimable. Le refus existait déjà avant P6.
- Correction proposée : passer ces cinq lignes en `qrcode` (ou les retirer) dans le CSV, avec la même migration conditionnelle que M1. Faire porter le test sur toutes les lignes du CSV. Côté API, appeler `checkLabelLayout` à l'enregistrement, ou au moins refuser `labels_do_not_fit`, qui ne dépend pas du type de code.
- Preuve : les 5 préréglages en code-barres → 422 `module_width_below_minimum` (0,159 ; 0,310 ; 0,303 ; 0,228 ; 0,297 mm). `POST /api/admin/label-presets` QR 8 × 8 mm → ligne enregistrée ; `POST /api/barcode/pdf-labels` même mise en page → 422 `qr_size_below_minimum` (`actual 6, limit 10`).
- Vérification : Confirmé, corrigé (constat commun à a6a N4 et a3b N7, réunis ici ; lignes du CSV corrigées en 13, 16, 20, 24, 25 ; Generic 50x30 recoupe UI-08/Reste-3).

**m4. Les règles des manques et des statistiques n'ont aucun test**
- Où : `src/lib/server/features/bottles/service.ts:150-178` (`getStatistics`, `getWineShortages`) et `src/lib/server/features/bottles/repository.ts:258,404` (`cellarStatistics`, `winesBelowTarget`) ; pas de `page.server.test.ts` pour `out-of-cellar`, `statistics`, `wine-shortage`
- Scénario : des règles vérifiées à la main pendant l'audit peuvent régresser sans qu'aucun des 976 tests n'échoue. Exemples : seules les bouteilles disponibles comptent dans la valeur, le stock et les répartitions ; un vin sans bouteille est listé avec tout son manque ; le badge du layout vaut le nombre de vins listés ; le millésime null est exclu.
- Correction proposée : un test de service pour `getWineShortages` (bouteilles sorties et bues non comptées, cible nulle jamais listée, vin sans bouteille) et un pour `getStatistics` (bouteilles hors cave et bues exclues des répartitions, millésime null exclu). Pas de cas « cible 0 → 100 % » : cette branche est morte (m12).
- Preuve : aucun `*.test.ts` n'appelle `getWineShortages`, `getStatistics`, `winesBelowTarget` ni `cellarStatistics` ; seuls `navigation.test.ts` et `wine-badges.test.ts` contiennent ces mots.
- Vérification : Confirmé, corrigé (constat commun à a6b N9 et a7b N6, réunis ici pour la partie statistiques et manques ; le vérificateur de a7b a retiré le cas « cible 0 », code mort).

**m5. Préfixe vide après un préfixe numérique : la numérotation saute dans les codes de l'autre préfixe**
- Où : `src/lib/server/features/barcode/repository.ts:91-110` ; le commentaire `:52-58` ne décrit pas ce saut
- Scénario : préfixe `123`, deux bouteilles `1230000001` et `1230000002`, puis passage au préfixe vide → la bouteille suivante reçoit `1230000003`. Si l'utilisateur a imprimé d'avance une planche `1230000001…1230000030`, un de ses codes est déjà pris quand il revient au préfixe `123`. Le saut est la conséquence voulue de la garantie « jamais le code d'une bouteille existante », mais rien ne l'explique. Aucune décision ne couvre ce cas : « Anciens codes-barres » ne parle que des codes à 13 caractères, « Compteurs de codes-barres » ne traite pas le recouvrement.
- Correction proposée : le documenter dans le commentaire et dans le dialogue des réglages (un préfixe vide ou numérique partage ses codes avec les préfixes numériques plus longs). Sinon, pour un préfixe numérique, exclure les codes qui commencent par un préfixe numérique plus long qui a son compteur `barcode_last_number:*`.
- Preuve : `updateBarcodeSettings({ prefix: '' })` → `{ hasConflict: true, actualNext: 1230000003, nextBarcode: '1230000003' }`, puis la bouteille suivante reçoit `1230000003`.
- Vérification : Confirmé.

**m6. Zone blanche du dialogue de bouteille recopiée ; deux bornes basses pour la même plage**
- Où : `src/lib/components/BarcodeDialog.svelte:22` (`QUIET_ZONE = 10`) recopie `QUIET_ZONE_MODULES` (`src/lib/shared/barcode.ts:125`, non exporté) ; `barcode.ts:180` dit « numbers go from 0 to … », `src/lib/server/features/barcode/service.ts:95` dit « from 1 to … »
- Scénario : changer la zone blanche des étiquettes ne change pas celle du SVG téléchargé ; un script reçoit deux bornes basses différentes pour le même préfixe.
- Correction proposée : exporter `QUIET_ZONE_MODULES` et l'importer dans le dialogue ; aligner le message de `BarcodeRangeError` sur 1, puisque le 0 n'est jamais attribué.
- Preuve : 409 « numbers go from 0 to 9999 » et 422 « go from 1 to 9999 » pour les préfixes `ABCDEF` et `XYZAB2`.
- Vérification : Confirmé.

**m7. `containerLabel` retire « Column » au milieu d'un nom : enregistrer renomme le conteneur**
- Où : `src/lib/shared/storage.ts:5-7` (`name.replace('Column ', '')`), utilisé par `src/lib/components/storage/container-draft.svelte.ts:46`
- Scénario : un conteneur « Wine Column X » ; ouvrir l'édition pour changer une capacité, puis enregistrer → le conteneur devient « Wine X » et ses cases « Wine X1 », « Wine X2 », sans que l'utilisateur ait touché au nom. Attendu : seul le préfixe historique « Column » en tête est retiré.
- Correction proposée : `name.replace(/^Column /, '')`, avec un cas dans `container-draft.test.ts`.
- Preuve : navigateur : bouton « Edit the container Wine X », dialogue ouvert avec `Wine X`, « Update Container » sans modification → `PUT … {"name":"Wine X",…}`, puis conteneur « Wine X » et cases « Wine X1 », « Wine X2 ».
- Vérification : Confirmé.

**m8. Statistiques : « Millésimes récents » reste un cadre vide quand aucun millésime n'a moins de 10 ans**
- Où : `src/routes/statistics/+page.svelte:426-457`
- Scénario : une cave dont tous les vins ont plus de 10 ans (ou un millésime 0) → un bloc vide de 300 px, sans le message « Aucune donnée de millésime ». La condition teste `winesByVintage.length > 0`, puis filtre `vintage >= currentYear - 10` ; `maxCount` vaut alors `-Infinity`.
- Correction proposée : calculer `recentVintages` avant le `{#if}` et tester sa longueur.
- Preuve : `winesByVintage:[{vintage:0,count:2},{vintage:2005,count:3},{vintage:2015,count:3}]` → carte vide, 0 occurrence de « No vintage data available ».
- Vérification : Confirmé.

**m9. Manques : un prix d'achat à 0 affiche « Prix : N/A »**
- Où : `src/routes/wine-shortage/+page.svelte:91-95` (`wine.minPrice ? … : null`)
- Scénario : une bouteille offerte saisie à 0 € masque la fourchette de prix du vin. Attendu : « 0,00 € - 12,00 € (6,00 €) ».
- Correction proposée : `wine.minPrice != null`.
- Preuve : vin « Gift » avec `minPrice:0,maxPrice:12,avgPrice:6` → « Price: N/A ».
- Vérification : Confirmé.

**m10. Historique : le tri par date de consommation hors filtre « consommées » trie par date d'achat**
- Où : `src/routes/cellar-history/+page.server.ts:35-42` ; test `cellar-history/page.server.test.ts` « sorts the bottles in the cellar by purchase date when asked for the consumption date »
- Scénario : filtre « Tous », clic sur « Date de consommation » → la flèche s'affiche sur cette colonne, mais les bouteilles sortent dans l'ordre de leur date d'achat. Le commentaire `:35` (« Only a consumed bottle has a consumption date ») est faux pour le filtre `all`, qui inclut les bouteilles bues. Comportement repris de 556c7bb.
- Correction proposée : sur « Tous », trier vraiment par `consumedDate` ; sur « En cave », retirer la colonne ou renvoyer `sort: 'purchaseDate'` pour que l'en-tête dise vrai.
- Preuve : `/cellar-history?filter=all&sort=consumedDate&dir=asc` renvoie `sort:"consumedDate"`, mais les deux bouteilles bues sortent 2024-03-01 puis 2023-01-01, l'ordre de leurs achats (2010 puis 2019).
- Vérification : Confirmé.

**m11. Historique et hors cave : contrôles et textes en double**
- Où : `src/routes/cellar-history/+page.svelte:79-99` et `src/routes/out-of-cellar/+page.svelte:171-190` ; `cellar-history/+page.server.ts:16-23` et `+page.svelte:107-115` ; `out-of-cellar/+page.server.ts:7-15` et `+page.svelte:194-203` ; `out-of-cellar/+page.svelte:139,188`
- Scénario : le choix du nombre par page existe en deux versions : `Select` bits-ui avec `history.items_per_page` d'un côté, `<select>` natif avec `out_of_cellar.show` et `items_per_page` de l'autre. Chaque page liste ses colonnes deux fois (load pour le tri, composant pour l'affichage), à tenir synchrones à la main : un oubli donne une colonne affichée non triable ou un tri accepté sur une colonne absente. « Retour » a deux clés de même texte (`history.back`, `common.back`, `en.json:71,467`). Le hors cave affiche deux fois le même total (`showing_bottles` et `total_bottles_out`). Le double sélecteur figure déjà dans les « Restent ouverts » d'UI-02.
- Correction proposée : un composant `PageSizeSelect` partagé ; la liste des colonnes dans un module commun importé par le load et la page ; garder `common.back` et un seul total.
- Preuve : extraits cités.
- Vérification : Confirmé.

**m12. Code mort dans les manques et les statistiques**
- Où : `src/routes/wine-shortage/+page.svelte:26-38,62-77,366` ; `src/lib/server/features/bottles/service.ts:169-175` ; `src/routes/statistics/+page.svelte:301,342,471`
- Scénario : sans effet visible. `handleAddBottle` copie 10 champs dans `selectedDefinitionForBottle`, dont seul `.id` est lu. Le `HAVING count < targetQuantity` (`bottles/repository.ts:463-465`) est faux pour une cible 0 et NULL pour une cible absente : les branches `: 100` et `: 0` de `getWineShortages` et le `!` de `wine.targetQuantity!` ne servent jamais. Les `.slice(0, 10)` doublent les `.limit(10)` des requêtes (`repository.ts:321,336,373`).
- Correction proposée : garder `selectedDefinitionId` seul, retirer les branches et les `slice`.
- Preuve : extraits cités.
- Vérification : Confirmé.

**m13. Une case de grande capacité dessine une icône par place**
- Où : `src/lib/components/storage/CaseLoad.svelte:20` (`places = compact ? Math.min(capacity, 15) : capacity`)
- Scénario : une cave décrite comme un seul grand casier (200 à 1000 places ; le schéma l'autorise) → la vue tableau affiche une cellule géante et une page lourde. La vue grille plafonne déjà à 15.
- Correction proposée : un plafond aussi en vue tableau (par exemple 24 places, puis « +N »).
- Preuve : case de 1000 places → `/storage` pèse 611 916 octets et contient 1006 icônes `lucide-bottle-wine`.
- Vérification : Confirmé.

**m14. Statistiques : une moyenne sans aucun prix s'affiche « 0,00 € » au lieu de N/A**
- Où : `src/routes/statistics/+page.svelte:165,173` (`formatCurrency(statsData.valueStats?.avgPurchasePrice || 0)`, idem `avgCurrentValue`)
- Scénario : une cave dont aucune bouteille disponible n'a de prix d'achat (ou de valeur actuelle) → « Prix d'achat moyen : 0,00 € », comme si les bouteilles étaient gratuites. La requête renvoie NULL dans ce cas (`AVG` sur aucune ligne, `bottles/repository.ts:265-270`, typé `number | null`), et `formatCurrency(null)` donne déjà N/A (`src/lib/utils/format.ts:33`). Attendu : N/A.
- Correction proposée : retirer le `|| 0` des deux moyennes.
- Preuve : extrait cité ; `sqlite3 :memory:` sur deux bouteilles disponibles sans prix, `AVG(CASE WHEN availability='available' AND price IS NOT NULL THEN price END)` → `NULL`.
- Vérification : signalé par a6b (hors périmètre), vérifié par le rédacteur.

**m15. Statistiques : deux régions homonymes de pays différents sont fusionnées**
- Où : `src/lib/server/features/bottles/repository.ts:334` (`.groupBy(regions.name)`) ; l'unicité ne porte que sur `(country_id, name)` (`src/lib/db/schema.ts:39`, `drizzle/0006_constraints_and_indexes.sql:162`)
- Scénario : l'utilisateur crée « Central Valley » au Chili et aux États-Unis → le graphique « Principales régions » affiche une seule barre qui additionne les deux. Attendu : une barre par région. Aucun cas dans les régions semées (`scripts/data/appellations.csv` : aucun nom partagé entre pays), donc seulement avec des régions créées par l'utilisateur.
- Correction proposée : grouper par `regions.id` et afficher le pays quand deux régions portent le même nom (ou toujours « Région (Pays) »). Même cause que le filtre par région de la liste des vins (R5-m11, axe 5).
- Preuve : `sqlite3 :memory:` avec deux régions « Central Valley » (pays `cl` et `us`) et 3 bouteilles, même jointure et `GROUP BY r.name` → `Central Valley|3`.
- Vérification : signalé par a1 (hors périmètre), vérifié par le rédacteur.

**m16. Scanner : un navigateur sûr mais sans `getUserMedia` reçoit « La caméra exige une connexion sécurisée »**
- Où : `src/lib/components/barcode/camera-error.ts:25-27` (`window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia)`), lu par `src/lib/components/QrScannerDialog.svelte:77-79`, qui affiche toujours `scanner.camera_unavailable`
- Scénario : page en HTTPS (ou sur localhost) dans un navigateur ou une webview sans API caméra → le message demande d'ouvrir Cellar en HTTPS, ce qui est déjà le cas. Attendu : un message qui dit que ce navigateur ne donne pas accès à la caméra. Le test `camera-error.test.ts:52-55` constate ce cas (`browser(true)` → `false`) sans distinguer le message.
- Correction proposée : distinguer les deux causes (contexte non sûr, API absente), avec une seconde clé i18n, par exemple `scanner.no_camera_api`.
- Preuve : `en.json:1031` : « The camera needs a secure connection: open Cellar over HTTPS (or on localhost). » ; extrait cité.
- Vérification : signalé par a5b (hors périmètre), vérifié par le rédacteur.

**m17. Formulaire d'étiquettes : bornes HTML différentes du schéma**
- Où : `src/lib/components/barcode/LabelSettingsForm.svelte:78-79,90-91` (`min="10" max="200"` pour largeur et hauteur), `:20-26,152-153` (marges ≤ 50, espacements ≤ 20, marge intérieure ≤ 10) ; schéma `src/lib/shared/schemas/label.ts:6,11-12` (`max(500)` partout)
- Scénario : sur A3, une étiquette de 250 mm de large est valide pour le serveur, mais les flèches du champ s'arrêtent à 200. Tapée au clavier, la valeur passe : les champs ne sont pas dans un `<form>`, rien ne vérifie ces bornes, et `Input` ne stylise que `aria-invalid`. Les bornes HTML sont donc indicatives et ne concordent pas avec la règle qui s'applique. Aucun préréglage livré ne les dépasse.
- Correction proposée : exporter les bornes du schéma et les reprendre dans le formulaire, ou retirer `min`/`max` du formulaire.
- Preuve : extraits cités.
- Vérification : signalé par a6a (hors périmètre), vérifié par le rédacteur.

**m18. Suppression d'un conteneur par `confirm()` natif**
- Où : `src/lib/components/storage/ContainerDialog.svelte:76` ; seul `confirm(` natif de `src` (les autres suppressions passent par `src/lib/components/admin/confirm.svelte.ts`)
- Scénario : supprimer un conteneur ouvre la boîte native du navigateur par-dessus le dialogue de l'app, avec le style et les boutons du navigateur. Les suppressions de l'admin (sauvegardes, vins, bouteilles, référentiels) passent par la confirmation générique en dialogue. La confirmation générique n'est rendue que par le layout admin, ce qui explique aussi R6-m6c (préréglage supprimé sans confirmation).
- Correction proposée : rendre la confirmation générique disponible hors de l'admin (dans le layout racine) et l'utiliser ici et dans `PresetManager`. Corriger d'abord le défaut de cette confirmation relevé à l'axe 4 (m1 : elle survit à la navigation).
- Preuve : `grep -rnE "[^a-zA-Z.]confirm\(" src` hors tests : `ContainerDialog.svelte:76` et les appels `await confirm({...})` de l'admin.
- Vérification : signalé par a5b (hors périmètre), vérifié par le rédacteur.

**m19. Noms de cases collés au nom du conteneur, et un espace saisi comme séparateur est retiré : noms ambigus**
- Où : `src/lib/server/features/storage/service.ts:106` (`name: \`${container.name}${suffix}\``) ; le nom et chaque suffixe passent par `trim()` (`src/lib/shared/schemas/common.ts:7`, `src/lib/shared/schemas/storage.ts:5`) ; suffixes par défaut « 1 », « 2 »… (`src/lib/components/storage/container-draft.svelte.ts:67-70`) ; exemple du champ : « ex : cave à vin A, réfrigérateur 1 » (`fr.json:425`)
- Scénario : créer le conteneur « Frigo » avec la case « B1 » donne « FrigoB1 ». L'utilisateur qui tape « Frigo » suivi d'un espace, ou « B1 » précédé d'un espace, obtient aussi « FrigoB1 » : le schéma retire l'espace des deux côtés, et seul un séparateur visible (« -B1 ») survit. Avec l'exemple proposé, le conteneur « réfrigérateur 1 » donne les cases « réfrigérateur 11 », « réfrigérateur 12 »…, et sa 11e case s'appelle « réfrigérateur 111 ». Deux conteneurs « A1 » et « A » donnent tous deux une case « A11 » ; le test « are told apart by id when two containers give the same name » (`features/storage/service.test.ts:238-258`) l'assume. La page stockage les distingue par id, mais les autres écrans n'affichent que le nom : colonne emplacement des tableaux de bouteilles, export CSV, import CSV par nom (UI-09/Reste-6). Le dialogue annonce le format (« Chaque casier sera nommé selon le format : Frigo[Nom du casier] ») : la concaténation est voulue, mais l'espace retiré ne l'est pas.
- Correction proposée : la plus simple est de ne retirer que les espaces de fin d'un suffixe (`trimEnd`), pour qu'un espace en tête serve de séparateur, ce qui suit la décision « Page stockage » (« son suffixe est gardé tel quel »), et de changer l'exemple du champ pour un nom sans chiffre final (« Cave A, Frigo »). Un séparateur automatique changerait le format décidé et les noms existants : à trancher par le mainteneur, avec UI-09/Reste-2.
- Preuve : extraits cités ; test `service.test.ts:238-258` (deux cases « A11 »).
- Vérification : signalé par a5a (hors périmètre), vérifié par le rédacteur.

## 4. Points restés ouverts de la passe 1

Tâche proposée « Étiquettes : contrôles alignés sur le PDF » (avec M1 et m3) :
- UI-08/Reste-1 : la hauteur contrôlée ne correspond pas aux barres dessinées (DK-11204 : 10 mm sous un minimum de 15).
- UI-08/Reste-2 : une plage hors limites ou un préfixe manuel invalide ne désactivent pas les boutons PDF et CSV.
- UI-08/Reste-3 : le formulaire par défaut (50 × 30 mm) est invalide dès l'ouverture.
- UI-08/Trouvé-3d : DK-11204 a 9,3 modules de blanc au lieu de 10, à corriger ou à décider.

Tâche proposée « Scanner : limites connues » (décider ce qui est accepté) :
- UI-08/Trouvé-4a : un UPC-E hors des règles GS1 est relu sous un autre code.
- UI-08/Trouvé-4b : les anciens EAN-13 à 0 initial restent sur 13 chiffres.
- UI-08/Trouvé-4c : le détecteur natif de macOS lit mal les Data Matrix (12/20).
- UI-08/Trouvé-4d : une caméra débranchée en plein scan n'affiche aucun message.

Tâche proposée « Stockage : restes d'UI-09 » (avec m7, m13, m19) :
- UI-09/Reste-1 : des cases ajoutées par CSV prennent la position 0.
- UI-09/Reste-2 : enregistrer renomme une case importée (« CTop shelf »).
- UI-09/Reste-3 : un brouillon ancien supprime une case créée entre-temps (`updatedAt` + 409).
- UI-09/Reste-4 : une capacité vidée devient 5.
- UI-09/Reste-5 : un seul conteneur sans case n'a plus de bouton d'édition.
- UI-09/Reste-6 : l'import CSV confond deux cases de même nom.

Tâche proposée « Confirmations hors admin » (avec m18) :
- R6-m6c : la suppression d'un préréglage, livré ou non, se fait sans confirmation.

Tâche proposée « Session dans le layout serveur » :
- UI-04/Reste-1 : l'état de connexion se charge côté client (2 requêtes).

Traités dans d'autres axes :
- UI-04/Reste-2 et UI-09/Reste-7b : endpoints sans appelant, voir axe 2.
- UI-04/Trouvé-3 : millésime 0, voir axe 1.

## 5. Constats écartés

- a6a N7 « Suppression d'un préréglage sans confirmation » : doublon de la ligne R6-m6c (Non fait), qui reprend la portée élargie par le vérificateur (préréglages livrés compris, rien ne les remet).
- a7b N6, cas « `shortagePercentage` vaut 100 quand la cible est 0 » : réfuté par le vérificateur de a7b. Le `HAVING` exclut une cible 0 ou NULL, et cette branche est du code mort (m12). Le reste du constat est repris en m4.

## 6. Renvois

- Endpoints sans appelant de cet axe (`/api/barcode/stats`, `/api/barcode/stats-manual`, GET de `/api/admin/label-presets` et de `label-presets/[id]`, GET `/api/wine-shortage`, `/api/statistics`, `/api/storage-containers`, `DELETE /api/storage-cases/{id}`) : a6a N5, UI-04/Reste-2 et UI-09/Reste-7b, voir axe 2 (liste unique des routes, décision du mainteneur).
- Millésime 0 (statistiques « Années 0 », `BottleTable` qui affiche 0, export CSV) : UI-04/Trouvé-3, voir axe 1.
- Dialogue de changement de statut en plusieurs copies, et chargement des cases et de leur remplissage en trois copies (`BottleDetailsDialog`, `BulkBarcodeDialog`, `StorageCasePicker`) : voir axe 5. La correction de M2 (`newStatus`) reste valable quelle que soit la factorisation.
- Pas de `src/error.html` : voir axe 5.
- Préréglages d'étiquettes, partie API : a3b N7, repris en m3 ; l'axe 3 n'en garde qu'un renvoi.
- Hors axe, transmis au lead : `{@html}` des dialogues d'import de l'admin (`ZipImportResultsDialog.svelte:146`, `CsvImportResultsDialog.svelte:277`, `ZipImportInfoDialog.svelte:47,62,79,95`) ; clés i18n en double de même texte (`common.cancel`, `forms.cancel`, `storage.cancel`, `barcode.cancel`, `admin.cancel`, `out_of_cellar.cancel`) ; `BulkBarcodeDialog.svelte:172-177` (`findMatches` insensible à la casse puis « se termine par », deux bouteilles visées avec des préfixes `cv`/`CV`) ; `WineBottleForm.svelte:102-105` (affichage d'un 409 `barcode_range` d'un préfixe épuisé, à vérifier).
