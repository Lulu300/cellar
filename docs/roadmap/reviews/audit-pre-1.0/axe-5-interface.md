# Audit d'avant 1.0, axe 5 : interface principale

Commit audité `9df0d08c` (develop, 2026-10-16). Périmètre en deux parties : A, la liste des vins, la page d'un vin et les formulaires de vin et de bouteille ; B, le front transverse (layout, navigation, code mort, utilitaires partagés, Svelte 5, i18n, accessibilité, thème). Méthode : lecture du code, puis l'app lancée depuis des worktrees jetables avec des données inventées (`node server.js` sur les ports 4470, 4480, 4700, 4710 et 4770), pilotée par curl et par un Chrome headless en CDP. axe-core 4.14.0, déjà présent dans le cache npx, a été lancé sur 13 pages en clair et en sombre. Chaque constat a été revu par un second agent, qui l'a rejoué pour tenter de le réfuter. Les points signalés par d'autres axes ont été vérifiés par le rédacteur (code, `sqlite3`, mesure de `/wines` sur le port 4770). Les portes du projet (check, test 976/976, i18n:check, knip, build ; lint avec 104 avertissements) viennent de l'exécution unique faite par le lead.

## 1. Résumé

L'interface a été réécrite depuis la revue 5. Les composants sont en runes, les données sont chargées sur le serveur, et les formulaires de vin et de bouteille sont de nouveaux composants courts, validés par les mêmes schémas que le serveur. La XSS du site web (SEC-04) est corrigée et a été rejouée. Sur 184 lignes de traçabilité, 134 sont corrigées. Les points ouverts sont surtout de structure :
- le dialogue de changement de statut existe en quatre copies ;
- `WineListView.svelte` fait 957 lignes ;
- les filtres de la liste ne sont pas dans l'URL.

S'y ajoutent des points de thème et d'accessibilité : contrastes après un passage du sombre au clair, deux `h1`, « Connexion » au premier rendu. Le constat le plus grave de la passe 2 est un Majeur (M1) : un champ numérique mal lu par le navigateur enregistre sans erreur un prix vide, ou dix fois trop grand (« 12,5 » devient 125 dans un Chrome anglais). Les 21 Mineurs portent sur l'accessibilité, la duplication, l'i18n et la taille de `/wines` (1,4 Mo de HTML pour 700 bouteilles).

## 2. Traçabilité (passe 1)

184 lignes : 134 Corrigé, 7 Partiel, 34 Non fait, 6 Sans objet, 3 Écart décidé. Les deux vérificateurs ont contrôlé 121 lignes : toutes celles qui ne sont pas « Corrigé », toutes celles issues d'un problème Critique ou Majeur ou d'un critère, et un échantillon des autres. Ils n'ont changé aucun verdict et n'ont ajouté aucune ligne. Ils ont corrigé des preuves, reprises ci-dessous. R5-M5 (mises à jour groupées) est traité à l'axe 2. Les chemins courts désignent des fichiers de `src/lib/components/` (`forms/` pour les formulaires), sauf mention.

### Revue 5

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R5-C1 | XSS stockée par le site web | Corrigé | Voir SEC-04 : `safeUrl` à l'affichage (`src/routes/wines/[id]/+page.svelte:334-351`, `rel="noopener noreferrer"`), refus serveur (`src/lib/shared/schemas/wine.ts:7-13`) |
| R5-M1 | Le formulaire de vin s'efface quand on choisit une région ou crée une appellation | Corrigé | Formulaire non contrôlé, initialisé une fois par montage (`WineDefinitionForm.svelte:44-55`, `untrack`). Chrome : nom et producteur gardés après pays, région et création de l'appellation « Zzz Audit AOC » |
| R5-M1/double-chargement | Deux `loadFullDefinition()` concurrents | Corrigé | La définition vient de la page (`WineDefinitionDialog.svelte:51-58`) |
| R5-M1/setTimeout | `setTimeout` qui masquent les courses | Partiel | Il en reste un : `src/routes/wines/+page.svelte:26-30` (« Small delay to ensure everything is updated »), après un `await invalidate(CELLAR)` qui suffit |
| R5-M2 | Tri non branché, sur la première bouteille | Corrigé | Voir BUG-05 |
| R5-M3a | `types.ts` ne suit plus le schéma | Corrigé | `src/lib/types.ts` absent ; DTO dérivés des services (`src/lib/shared/dto.ts:108-123`) |
| R5-M3b | Collision du nom `WineType` | Corrigé | Plus d'enum (`types.ts` supprimé) |
| R5-M3c | Liste typée en bouteilles au lieu de groupes | Corrigé | `WineGroupDTO` (`dto.ts:108`) ; `WineListView.svelte:49-53` |
| R5-M3d | Badges colorés par enum, types créés en gris | Corrigé | `src/lib/utils/wine-badges.ts:91-112` ; test `wine-badges.test.ts` « gives a name the user created a colour of its own, the same each time » |
| R5-M3e | Le formulaire envoie un nom au lieu d'un id | Corrigé | `valueField="id"` (`WineDefinitionForm.svelte:134-166`, `WineBottleForm.svelte:149-189`) ; `schemas/wine.ts:19-22` ; test `api/definitions/server.test.ts` « a type given by name » → 422 |
| R5-M4a | Aucune load function, `/` redirigé par `goto` | Corrigé | `+page.server.ts` sur toutes les pages ; HTML de `/wines` avec les vins (curl) ; `/` : 200 et meta refresh (`src/routes/+page.svelte:7`), comme le veut la décision « Healthcheck et racine » |
| R5-M4b | `/wines/[id]` télécharge toute la cave | Corrigé | `src/routes/wines/[id]/+page.server.ts:10-17` (`getDefinitionDetails(id)`, `listBottlesWithDefinitions(id)`) |
| R5-M4c | `/api/admin/images` appelé pour l'URL d'image | Corrigé | `imageUrlsById()` (`wines/+page.server.ts:23`), `imageUrlOf()` (`wines/[id]/+page.server.ts:16`) |
| R5-M4d | Référentiels rechargés par chaque composant | Corrigé | `src/routes/+layout.server.ts:19-27` ; plus de GET de référentiels dans les composants. Le chargement des cases reste en trois copies (m14) |
| R5-M4e | Rafraîchissement par `bind:this` + `loadWines()` | Corrigé | Plus de `bind:this={wineListView}` ; `invalidate(CELLAR)` partout. Le `loadWines()` de `WineBottleForm.svelte:80,84` est le rechargement des vins de R5-m6, pas ce motif |
| R5-M6a | `handleSubmit` / `handleSaveAndAddAnother` copiés | Corrigé | `FormAction.submit` (`forms/form-action.svelte.ts:54-86`), bouton secondaire par `submitter.value` |
| R5-M6b | Trois copies de la remise à zéro | Corrigé | Remontage du formulaire (`WineBottleDialog.svelte:36-41,65-73`) |
| R5-M6c | Dialogue de changement de statut en plusieurs copies | Non fait | Quatre copies : `BottleDetailsDialog.svelte:424-509` (Select bits-ui), `src/routes/wines/[id]/+page.svelte:835-893`, `src/routes/out-of-cellar/+page.svelte:250-300` et `BulkBarcodeDialog.svelte:410-440` (selects natifs, contournement du mode sombre dans deux) ; `grep -l consumedNote` → 4 fichiers ; `confirmConsumption` copiée (`[id]:165-196`, `BottleDetailsDialog.svelte:151-190`) ; clés doublées `wine_details.change_bottle_status` / `admin.change_bottle_status` |
| R5-M6d | Tableaux de bouteilles dupliqués | Corrigé | `bottles/BottleTable.svelte`, utilisé par `BottleDetailsDialog.svelte:397` et `AllBottlesDialog.svelte:242` |
| R5-M6e | Helpers copiés (`formatDate`, `formatCurrency`, `getTypeColor`…) | Corrigé | `src/lib/utils/format.ts:10,28`, `wine-badges.ts` ; `grep renderStars\|loadImageUrls\|getTypeColor` vide |
| R5-M6f | « Bouteilles non consommées » calculé 4 fois | Corrigé | `ownedBottles` (`src/lib/utils/wine-group-sort.ts:19-25`) |
| R5-M6g | Cartes des bouteilles disponibles et consommées dupliquées | Non fait | `src/routes/wines/[id]/+page.svelte:458-637` et `662-790` : mêmes boutons et mêmes badges |
| R5-M7a | `WineRegistrationForm.svelte` mort | Corrigé | Fichier absent |
| R5-M7b | `mockData.ts` | Corrigé | Fichier absent ; knip à 0 |
| R5-m1 | Mélange `on:definitionSaved` / `onclick` | Corrigé | 0 directive `on:` dans `src` |
| R5-m2 | Deux paquets d'icônes | Corrigé | `package.json:30` : seul `@lucide/svelte` |
| R5-m3 | Erreurs silencieuses (« You could show a toast here ») | Partiel | `WineListView` ne charge plus rien. `src/routes/wines/[id]/+page.svelte:191-194` garde le `catch` muet et le commentaire (voir UI-05/Reste-1 ; signalé aussi par a5a) |
| R5-m4 | Pas d'état de chargement, « aucun vin » pendant le chargement | Corrigé | Rendu serveur (`wines/+page.server.ts:21-24`) ; « aucun vin » seulement si les filtres ne retiennent rien (`WineListView.svelte:906`) |
| R5-m5 | 21 `console.*` dans `WineBottleDialog` | Corrigé | 0 dans `WineBottleDialog.svelte` ; 1 `console.error` dans un `catch` de `WineBottleForm.svelte` |
| R5-m6 | Liste des vins rafraîchie seulement si leur nombre change | Corrigé | `WineBottleForm.svelte:79-97` recharge `/api/definitions` à chaque ouverture |
| R5-m7 | Recherche par code-barres sur les bouteilles bues, sélection invisible | Non fait | `WineListView.svelte:226-232` parcourt `wine.bottles` sans filtre ; `BottleDetailsDialog.svelte:90` n'affiche que `ownedBottles`. Chromium, `WINE000001` (bue) : « 1 bouteille sélectionnée », seule ligne `WINE000002` non cochée ; « Changer la disponibilité » ouvre un dialogue vide, et « Confirmer » ne fait rien (`:127`, `:151`, `:258`). Aucune écriture : Mineur |
| R5-m8 | `formatCurrency` forcé en `en-US` | Corrigé | `utils/format.ts:33` suit `getLocale()` |
| R5-m9 | Date du jour en UTC | Corrigé | `today()` en heure locale (`utils/format.ts:94-100`) ; test `format.test.ts:87` (0 h 30 à Paris) |
| R5-m10 | Note au pas de 0,5 contre colonne entière | Écart décidé | Décisions « Données réparées par la migration 0006 » et « Formats et tableaux (UI-02) » (4,5 arrondi à 5) ; `format.ts:58-62` |
| R5-m11 | Filtres région et pays comparés par nom | Non fait | `WineListView.svelte:166-172` (`wine.definition.region === selectedRegion`), `SearchableSelect` sans `valueField="id"` (`:404-421`). `regions_country_id_name_unique` (`src/lib/db/schema.ts:39`) admet deux régions homonymes dans deux pays, que le filtre confond (signalé aussi par a5a) |
| R5-m12 | « No Image » en dur | Corrigé | `WineListView.svelte:727` |
| R5-m13 | `getAvailabilityLabel`, « No non-consumed bottles found » | Corrigé | `bottles/availability.ts` partagé ; grep vide |
| R5-m14 | Textes en dur de `WineBottleDialog` | Corrigé | Réécrit (UI-06) ; « Hardcoded text: 0 » |
| R5-m15 | Textes en dur de `WineDefinitionDialog` | Corrigé | Idem (60 lignes) |
| R5-m16 | Titre de `[id]` en dur ; `requireAuth` inutilisé | Corrigé | `wines/[id]/+page.svelte:224` ; `grep requireAuth` vide |
| R5-m17 | Modal de connexion fait main | Corrigé | `layout/LoginDialog.svelte:148-217` en `Dialog` bits-ui |
| R5-m18 | En-têtes triables sans focus ni `aria-sort` | Corrigé | `table/SortableHeader.svelte:22-36` |
| R5-m19 | Boutons icône sans `aria-label` | Corrigé | Script `iconbtn.mjs` sur routes et composants : 0 ; `[id]:247-255` |
| R5-m20 | Interrupteur « images » sans `role="switch"` | Corrigé | HTML de `/wines` : `role="switch" aria-checked="true" aria-label="Afficher images"` |
| R5-m21 | Boutons dans un `<a>` | Corrigé | `WineListView.svelte:695-750` : lien étiré par `::after`, boutons frères |
| R5-m22 | 9 liens sans menu mobile | Corrigé | `src/routes/+layout.svelte:128,146-156` ; 390 px sans débordement |
| R5-m23 | Refiltrage et retri à chaque frappe ; `getImageUrl()` deux fois | Non fait | `WineListView.svelte:197-208` sans délai ; `imageUrls.get(...)` deux fois (`:703-705`). Même point que R5-Refacto-6c |
| R5-m24 | `/api/wines` et `/wines` grossissent avec les bouteilles bues | Non fait | `catalog/service.ts:142-157` joint toutes les bouteilles. Mesuré par le rédacteur (signalé par a2b) : 100 vins et 700 bouteilles dont 300 bues → HTML de `/wines` 1 395 638 octets, `__data.json` 732 360 ; 3 000 bouteilles → 3,5 Mo et 2,7 Mo. Voir aussi m22 |
| R5-Refacto-structure | Dossier `features/wines` (filtres, cartes, dialogues) | Partiel | Fonctions pures centralisées (`utils/wine-group-sort.ts`, `format.ts`, `wine-badges.ts`), formulaires dans `forms/` ; manquent `filters.svelte.ts`, `WineFilters`, `WineGrid`, `WineCard`, `BarcodeSearch`, `BottleStatusDialog`, `MoveBottlesDialog`, `BottleCard` |
| R5-Refacto-filtres-URL | Filtres de la liste dans l'URL | Non fait | `$state` local (`WineListView.svelte:72-104`) ; ni `page.url` ni `goto`. Chrome : recherche « Bug04 », ouvrir le vin, `history.back()` → recherche vide, 4 cartes. La décision UI-04 ne vise que l'historique et le hors cave |
| R5-Refacto-1 | Nettoyage : code mort, `mockData.ts`, un seul paquet d'icônes | Corrigé | Fichiers absents ; seul `@lucide/svelte` |
| R5-Refacto-2 | DTO dérivés, plus d'`any`, plus d'enums | Corrigé | Voir UI-03 |
| R5-Refacto-3 | Load serveur pour `/wines` et `/wines/[id]`, image jointe, `invalidate` | Corrigé | `wines/+page.server.ts:22-25`, `wines/[id]/+page.server.ts:10-18` ; test `[id]/page.server.test.ts` « loads the wine with its own bottles only » |
| R5-Refacto-3b | `/` redirigé côté serveur | Écart décidé | Décision « Healthcheck et racine (UI-04) » : 200 et meta refresh |
| R5-Refacto-4 | `LocationPicker`, `StorageCasePicker`, runes, form actions | Corrigé | `forms/LocationPicker.svelte`, `forms/StorageCasePicker.svelte` ; actions `wines/+page.server.ts:38-65` |
| R5-Refacto-4b | Avec superforms | Écart décidé | Décision « Formulaires (UI-06, DEP-01) » : helper maison |
| R5-Refacto-5 | `BottleTable`, `BottleStatusDialog`, `MoveBottlesDialog`, PATCH groupé | Partiel | `BottleTable` et `PATCH /api/bottles` faits ; les deux dialogues non extraits (R5-M6c) |
| R5-Refacto-6a | Découper `WineListView` | Non fait | 957 lignes : filtres, recherche par code-barres, grille, cartes, 6 dialogues |
| R5-Refacto-6b | Tri sur des agrégats | Corrigé | Voir BUG-05 |
| R5-Refacto-6c | Délai d'attente sur la recherche | Non fait | `bind:value={searchQuery}` (`WineListView.svelte:373`) relance filtre et tri à chaque frappe (`:197-210`) |
| R5-Refacto-6d | Filtrage serveur « plus tard, si la cave grossit » | Sans objet | Conditionnel ; aucune décision ne le demande pour 1.0 |
| R5-Refacto-7 | Derniers composants en runes | Corrigé | Aucun `export let`, `$:`, `createEventDispatcher` ni `svelte/store` dans `src` |

### Revue 4 (M8, m7)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R4-M8 | 34 clés absentes des JSON | Corrigé | `pnpm i18n:check` : « Missing keys: 0 » |
| R4-m7a | 0 `aria-label` dans l'admin | Corrigé | `EntityListPanel.svelte:83,92`, `SearchField.svelte:18,26`, `BackupList.svelte:108-132`, `src/routes/admin/images/+page.svelte:296,323` |
| R4-m7b | Edit, Trash, effacement de recherche sans libellé | Corrigé | `EntityListPanel.svelte:83,92`, `SearchField.svelte:26` |
| R4-m7c | `confirm()` natif dans l'admin | Corrigé | `admin/confirm.svelte.ts`. Un `confirm()` natif reste hors admin (`storage/ContainerDialog.svelte:76`, voir Renvois) |

### Revue 7 (M7)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R7-M7a | 30 clés utilisées absentes | Corrigé | « Missing keys: 0 », « Unreadable keys: 0 » |
| R7-M7b | `$_('common.retry') \|\| 'Réessayer'` : repli mort | Corrigé | `grep "Réessayer\|]() \|\|"` vide |
| R7-M7c | Clés en double dans les JSON | Corrigé | « Duplicate keys: 0 » ; `scripts/check-i18n.mjs:211-216` lit les lignes. Les clés différentes au même texte restent nombreuses (m19) |

### SEC-04

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| SEC-04 | `javascript:` refusé et jamais affiché en lien ; conteneur `<img src=x onerror=alert(1)>` affiché en texte | Corrigé | `POST /wines?/createWine` avec `website=javascript:alert(1)` → 422 `invalid_body`, `path: website`. Valeur forcée en base : rendue `<span>javascript:alert(1)</span>`. Conteneur piégé : `/storage` et `/wines/[id]` rendent `&lt;img src=x …`, 0 occurrence brute. Aucun `{@html}` sur une valeur de base. Rejoué par le vérificateur. Le rendu n'a pas de test (m7) |

### BUG-04

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-04 | Choisir une région ne vide plus les champs | Corrigé | Voir R5-M1 (rejoué dans Chrome) |

### BUG-05

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-05 | Le tri choisi change l'ordre de façon cohérente | Corrigé | `WineListView.svelte:582-611` ; `sortWineGroups` (`wine-group-sort.ts:53-78`) ; tests `wine-group-sort.test.ts` « sorts by the oldest vintage still owned, not by the first bottle », « … average price … » |

### UI-01

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-01 | knip ne signale rien dans `src/lib` | Corrigé | `pnpm knip` sur 9df0d08c : code de sortie 0 |
| UI-01/Trouvé-1 | Services admin morts, `WineRegistrationForm`, `uuid.ts`, alias `@/*` | Corrigé | `src/lib/services`, `utils/uuid.ts`, `svelte.config.js` absents |
| UI-01/Trouvé-2 | Imports inutilisés de statistics ; `ssr.noExternal: ["nanoid"]` | Corrigé | Aucun avertissement lint sur `statistics/+page.svelte` ; `vite.config.ts` sans `nanoid` |
| UI-01/Trouvé-3 | `toggleImageSelection`, `formatValue`, `openFormatDialog`, helpers à 12 caractères | Corrigé | grep des six noms vide |
| UI-01/Trouvé-4 | `mockData.ts` | Corrigé | Fichier absent |
| UI-01/Trouvé-5 | Type `.json` jamais servi dans `backup/service.ts` | Corrigé | grep vide |

### UI-02

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-02 | Plus de copie locale des helpers | Corrigé | Une seule définition de chaque (`utils/format.ts`, `utils/pagination.ts`, `utils/theme-colors.ts`) ; `Intl.*Format` seulement dans `format.ts` et `LabelPdfCard.svelte:32` |
| UI-02/Trouvé-1a | Comparateurs propres aux deux dialogues | Corrigé | `BottleTable` et `sortBottles` (`bottles/bottle-table.ts:61-66`) |
| UI-02/Trouvé-1b | Chaînes comparées avec `<` | Partiel | Client corrigé (`utils/compare.ts:3`, `Intl.Collator`). Historique et hors cave, triés par SQL, gardent le défaut : voir axe 6 |
| UI-02/Trouvé-1c | Téléchargement de Blob copié six fois | Corrigé | Seulement `utils/download.ts:5` |
| UI-02/Trouvé-2 | Filtre millésime sur les bouteilles bues ; replis `\|\| [wine]` | Corrigé | `utils/wine-filters.ts:41-52` sur `ownedBottles` |
| UI-02/Trouvé-3 | `BarcodeDialog.svelte` recopie le téléchargement | Corrigé | `BarcodeDialog.svelte:12,54` `saveBlob` |
| UI-02/Trouvé-4 | Filtre origine sur la première bouteille | Corrigé | `wine-filters.ts:55-57` |
| UI-02/Reste-1 | `formatDate` affiche en heure locale un jour stocké à minuit UTC | Non fait | `utils/format.ts:10-13` sans `timeZone: 'UTC'` (`isoDate`, `:105-107`, lit en UTC) |
| UI-02/Reste-2 | Sélecteur « éléments par page » en deux versions | Non fait | `src/routes/out-of-cellar/+page.svelte:175` natif ; `src/routes/cellar-history/+page.svelte:83-90` bits-ui |
| UI-02/Reste-3 | `/api/bottles/non-consumed` renvoie `wineDefinition` | Non fait | curl : `"wineDefinition":{…}` ; `AllBottlesDialog.svelte:26-27,59` le renomme |

### UI-03

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-03 | Plus d'`any` aux frontières, `types.ts` supprimé | Corrigé | `types.ts` absent ; 2 `any` hors frontières (`server/features/backup/repository.ts:42` justifié, `src/lib/utils.ts:9,11` de shadcn) |
| UI-03/Trouvé-1 | `onOpenFormatDialog` mal typé | Sans objet | `DataManagementTabs` supprimé (UI-07) |
| UI-03/Trouvé-2 | Camembert : rosé en gris | Corrigé | `colorFill` normalise (`wine-badges.ts:83-89`) ; test « finds a name whatever its accents, case and spaces » |
| UI-03/Reste-1 | `/api/wines` répète en tête les champs de la première bouteille | Non fait | `server/features/catalog/service.ts:155-172` (`{ ...first, bottles, definition }`, entrée `def-<id>`) ; même forme dans `/wines`, dont `WineListView` ne lit que `definition` et `bottles` |

### UI-05

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-05 | 0 `export let`, `$:`, `createEventDispatcher` | Corrigé | grep : 0 / 0 / 0, et 0 `svelte/store`, `on:`, `<slot`. `compilerOptions.runes` reste absent de `vite.config.ts` |
| UI-05/Trouvé-1 | `Toast.svelte` mélange les syntaxes | Corrigé | `ui/toast/Toast.svelte:7-15` en `$props()` |
| UI-05/Trouvé-2 | ~180 avertissements `no-unused-vars` | Partiel | 104 avertissements, dont 4 `no-unused-vars` : `BarcodeOverrideDialog.svelte:16`, `CsvImportDialog.svelte:20` (×2), `src/lib/shared/schemas/bottle-list.ts:4` |
| UI-05/Trouvé-3 | `on:close` sur `WineBottleDialog` | Corrigé | 0 directive `on:` |
| UI-05/Trouvé-4 | `preferences.isDark` lu à l'ouverture seulement | Corrigé | `wines/[id]/+page.svelte:850`, réactif |
| UI-05/Reste-1 | `confirmConsumption` muet sur une erreur réseau | Non fait | `wines/[id]/+page.svelte:191-194` : `console.error` et « You could show a toast notification here » |
| UI-05/Reste-2 | « Retour » (`history.back()`) inerte sur une page ouverte directement | Non fait | `wines/[id]/+page.svelte:230`. Page ouverte dans un nouvel onglet ou depuis un lien externe : rien, ou sortie de Cellar (signalé aussi par a5a) |
| UI-05/Reste-3 | `winesBelowTarget` sans ordre secondaire | Non fait | `server/features/bottles/repository.ts:466-468`, un seul `ORDER BY` ; le service (`:168`) ne retrie pas |
| UI-05/Reste-4 | Navigation qui déborde à 390 px | Corrigé | `scrollWidth` = 390 sur 12 pages à 390 px ; pas de débordement à 1280, 1300 et 1440 px |

### UI-06

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-06 | Fichiers < 400 lignes, validation identique client et serveur | Corrigé | `wc -l` : 60, 75, 256, 343, 130, 59, 174 ; même lecteur et même schéma (`WineDefinitionForm.svelte:57-60`, `wines/+page.server.ts:42,55,62`). Trou côté navigateur : M1 |
| UI-06/Trouvé-1 | 409 « préfixe épuisé » non montré | Corrigé | `barcode_range` → champ code-barres (`forms/field-errors.ts:10-17`), dit dès l'ouverture (`WineBottleForm.svelte:100-112`) ; test `wines/server.test.ts` « say with 409 barcode_range that the prefix has no number left ». Vérifié par le rédacteur (signalé par a6a) : le message « choisissez-en un autre » s'affiche sous le champ, désactivé en mode automatique (`:287-303`) |
| UI-06/Trouvé-2a | `SearchableSelect` affiche l'id si les options arrivent après | Corrigé | `SearchableSelect.svelte:59-84` ; Chrome : « Bug04 Wine - Domaine Test » |
| UI-06/Trouvé-2b | Chargement en échec : formulaire vide mais enregistrable | Sans objet | Plus de chargement (`WineDefinitionForm.svelte:44`) |
| UI-06/Trouvé-2c | Appellations rechargées seulement si vides | Corrigé | Une fois par montage, `$derived` (`LocationPicker.svelte:28-58`) |
| UI-06/Trouvé-2d | Indicateurs de chargement partagés | Corrigé | Un `loading` par composant |
| UI-06/Trouvé-2e | `resetForm()` appelé deux fois | Corrigé | Plus de `resetForm` |
| UI-06/Trouvé-3 | Image d'un vin créé : « No Image » jusqu'au rechargement | Corrigé | Chrome : la carte montre `/uploads/wines/wine-….png` sans rechargement |
| UI-06/Trouvé-4a | Champs d'un 422 non marqués | Corrigé | `refusalErrors` (`field-errors.ts:50-62`) ; test `form-action.test.ts` « marks each field that the details of a 422 name » |
| UI-06/Trouvé-4b | Édition sans `consumedDate` | Corrigé | `BottleDetailsDialog.svelte:306`, `AllBottlesDialog.svelte:113-117` |
| UI-06/Trouvé-5a | Réglages rechargés : saisie effacée | Corrigé | Champs non contrôlés (`WineBottleForm.svelte:193-216`) |
| UI-06/Trouvé-5b | `BulkBarcodeDialog` décide sur les bouteilles lues au contrôle | Corrigé | `BulkBarcodeDialog.svelte:96-98,131` |
| UI-06/Trouvé-6a | Recherche d'images qui plante | Corrigé | `ImagePicker.svelte:33-37` (`filename`) |
| UI-06/Trouvé-6b | Légendes d'images vides | Corrigé | `ImagePicker.svelte:153-166` |
| UI-06/Trouvé-6c | Dialogues qui rechargent les référentiels | Corrigé | `page.data.references` (`WineDefinitionForm.svelte:47`, `WineBottleForm.svelte:63`, `LocationPicker.svelte:22`) |
| UI-06/Trouvé-7 | Deux copies de `openEditBottleDialog` | Corrigé | Voir Trouvé-4b |
| UI-06/Trouvé-8 | `LocaleDateInput` efface la date à la première frappe invalide | Corrigé | `ui/locale-date.ts:37-40` ; test « keeps the date while the text is not a complete one » |
| UI-06/Trouvé-9 | Cases triées par nom (« A10 » avant « A2 ») | Corrigé | `server/features/storage/service.ts:55-57` ; `GET /api/storage-cases` dans l'ordre ; aucun retri côté client |
| UI-06/Reste-1 | `listContainers` trie par nom brut | Non fait | `server/features/storage/repository.ts:16-18` contre `compareText(containerLabel(…))` (`service.ts:42`). Seul `GET /api/storage-containers`, sans appelant, l'expose (axe 2) |
| UI-06/Reste-2 | Image d'un peu moins de 20 Mo refusée en 413 | Non fait | PNG de 20 970 603 octets (< 20 971 520, `src/lib/shared/images.ts:2`) → `413 body_too_large` ; le client l'accepte (`ImagePicker.svelte:44`). Cause : la limite compte tout le corps multipart (`src/routes/api/upload/image/+server.ts:9`) |
| UI-06/Reste-3 | `/api/storage-occupancy` et `/api/upload/image` utilisés | Sans objet | Constat : appelants `StorageCasePicker.svelte:27`, `WineDefinitionForm.svelte:73` |

### UI-10

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-10 | axe sans violation critique ; aucun texte en dur | Corrigé | « Hardcoded text: 0 ». axe-core 4.14.0 sur 13 pages, connecté, en `fr`, clair et sombre : 0 violation critique, sérieuse ou modérée (thème par défaut ; m9 pour les autres) |
| UI-10/Trouvé-1a | `?login` reste dans l'URL | Corrigé | `LoginDialog.svelte:128-130` |
| UI-10/Trouvé-1b | Toast d'erreur à côté du dialogue de connexion sur un 401 | Partiel | `src/lib/stores/toast.svelte.ts:22` ne filtre que le message exact. Huit toasts l'enveloppent : `admin/images/+page.svelte:63,79,117,142`, `admin/backups/+page.svelte:113,200,232`, `barcode/PresetManager.svelte:53`. Ex. : « Échec de la suppression de la sauvegarde : Votre session a expiré… ». Contraire à la décision « Accessibilité et langue (UI-10) » (sans toast « session expirée ») ; vu aussi par a2a |
| UI-10/Trouvé-2a | Textes en dur de `storage/+page.svelte` | Corrigé | « Hardcoded text: 0 », « Unused keys: 0 » |
| UI-10/Trouvé-2b | Pluriels à l'anglaise | Corrigé | « Plurals made by hand: 0 » ; tous les messages se lisent en ICU, aucun pluriel sans `other` |
| UI-10/Trouvé-2c | Titres composés de deux clés | Corrigé | grep vide |
| UI-10/Trouvé-2d | Erreurs d'API anglaises par `result.error \|\| …` | Corrigé | `src/lib/api/client.ts:69`, `apiErrorMessage` |
| UI-10/Trouvé-2e | Majuscules à l'anglaise dans `fr.json` | Corrigé | grep : aucun « Mot Mot » hors noms propres |
| UI-10/Trouvé-2f | `ui.*` fourre-tout | Non fait | Voir Reste-9 |
| UI-10/Trouvé-2g | `i18n:check` échoue sur les clés inutilisées | Corrigé | `scripts/check-i18n.mjs:269` compté dans `failures` |
| UI-10/Trouvé-3a | Textes anglais de `SearchableSelect`, `BackupNamingDialog`, `WineBottleDialog` | Corrigé | `SearchableSelect.svelte:206,228,307,330,343` |
| UI-10/Trouvé-3b | Deux onglets admin au même libellé | Corrigé | `/admin/data/wines` : 10 liens, 10 libellés distincts |
| UI-10/Trouvé-4a | Textes anglais de `barcode/+page.svelte` | Corrigé | « Hardcoded text: 0 » |
| UI-10/Trouvé-4b | Refus de caméra → erreur générique | Corrigé | `QrScannerDialog.svelte:103-106`, `barcode/camera-error.ts:13-18` |
| UI-10/Trouvé-5a | Navigation qui élargit la page à 390 px | Corrigé | Voir UI-05/Reste-4 |
| UI-10/Trouvé-5b | Ligne de prix coupée | Corrigé | CDP de 390 à 1920 px : aucun texte rogné |
| UI-10/Trouvé-5c | « N/A » en dur sur la page codes-barres | Corrigé | `common.not_available` |
| UI-10/Trouvé-5d | Scanner en `http://` : erreur générique | Corrigé | `camera-error.ts:25-27` (`isSecureContext`) |
| UI-10/Trouvé-5e | Aide du jeton limitée à `docker compose logs` | Corrigé | `fr.json:111` |
| UI-10/Trouvé-6 | Remplacer svelte-i18n | Corrigé | `@inlang/paraglide-js` 2.27.0 (`package.json:27`) ; plus de `svelte-i18n` |
| UI-10/Trouvé-7a | Erreurs de restauration en anglais | Corrigé | `utils/api-error.ts:84-97` |
| UI-10/Trouvé-7b | Textes en dur de `BackupSettingsDialog` | Corrigé | « Hardcoded text: 0 » |
| UI-10/Trouvé-8a | Messages de l'import CSV en anglais | Corrigé | `errors[].problems[].code` (curl) |
| UI-10/Trouvé-8b | Après un 404, « Rechargez la page » sur une liste déjà rechargée | Non fait | Chromium, `/out-of-cellar` : cocher une bouteille, la supprimer par l'API, Confirmer → liste rechargée, toast « Cet élément n'existe plus. Rechargez la page. ». `invalidate(CELLAR)` (`out-of-cellar/+page.svelte:95`) passe avant le toast (`:99`) ; idem `BottleDetailsDialog.svelte:166-167`. Le rapport UI-10 disait le cas non reproduit |
| UI-10/Trouvé-8c | Boutons qui débordent des cartes à 1280 px | Corrigé | `elementFromPoint` à 390, 1024 et 1280 px |
| UI-10/Trouvé-9 | Contraste des cases à cocher | Corrigé | `ui/checkbox/checkbox.svelte` : 5,92:1 |
| UI-10/Trouvé-10 | Puce vide dans ROADMAP.md | Sans objet | Pas du code : `',,` en fin de `docs/roadmap/tasks.mjs:1054` (12abed50), rendu « - undefined » à `ROADMAP.md:1331` par `build.mjs:76` ; aucun texte perdu |
| UI-10/Trouvé-11 | Paraglide exact, plugin ICU1 local, ordre cookie puis navigateur, abandon de `wine-cellar-locale` annoncé | Corrigé | `package.json:27-28`, `project.inlang/settings.json:5`, `paraglide.config.js:7-8`, `i18n/plurals.test.ts:8-16`, `releases.json` |
| UI-10/Trouvé-12a | `DYNAMIC_KEYS` incomplet | Corrigé | Supprimé ; clés écrites en entier (`utils/api-error.ts:99-116`) |
| UI-10/Trouvé-12b | Clés `storage.*` gardées pour les textes en dur | Corrigé | « Unused keys: 0 » |
| UI-10/Trouvé-12c | `invalid_filename` non traduit | Corrigé | `ZipImportResultsDialog.svelte:24-28` |
| UI-10/Trouvé-12d | Rendu serveur toujours en anglais | Corrigé | curl : cookie `fr` → `<html lang="fr">` ; `Accept-Language: fr-CA` → `fr` |
| UI-10/Trouvé-12e | Chemin SVG malformé | Corrigé | CDP sur 12 pages : aucune erreur en console |
| UI-10/Trouvé-13a | `format.ts` lit la langue avec `get()` | Corrigé | `getLocale()` (`utils/format.ts:2,12,18,33,67,81`) |
| UI-10/Trouvé-13b | `admin.showing_bottles` avec `plural: 's'` | Corrigé | Pluriel ICU |
| UI-10/Trouvé-14a | Textes en dur de `SearchableSelect` | Corrigé | Voir Trouvé-3a |
| UI-10/Trouvé-14b | « No Image », `label for` sans `id` | Corrigé | `WineListView.svelte:727` ; aucun `for` orphelin sur `/wines` |
| UI-10/Trouvé-14c | Suffixe « - My Wine Cellar » | Corrigé | `wines/[id]/+page.svelte:224` |
| UI-10/Trouvé-14d | « Code-Barre » contre « code-barres » | Corrigé | `fr.json` : seulement « code(s)-barres » |
| UI-10/Trouvé-14e | Titre « Toutes » d'`AllBottlesDialog` | Corrigé | `AllBottlesDialog.svelte:134` |
| UI-10/Trouvé-15a | Pages qui débordent à 390 px | Corrigé | Voir UI-05/Reste-4 |
| UI-10/Trouvé-15b | Cartes qui recouvrent le bouton voisin | Corrigé | Voir Trouvé-8c |
| UI-10/Trouvé-15c | Page 500 en anglais | Corrigé | `src/routes/+error.svelte` ; `/nope` en `fr` traduit. Reste l'erreur du layout racine (m15) |
| UI-10/Trouvé-15d | Guide de l'import CSV en anglais | Corrigé | « Hardcoded text: 0 » |
| UI-10/Trouvé-15e | « 20 MB » en dur | Corrigé | `fr.json:975,1172` avec `{size}` |
| UI-10/Trouvé-15f | Exemples pris pour des valeurs | Corrigé | Décision « Accessibilité et langue (UI-10) » ; `fr.json:1021` |
| UI-10/Reste-1 | En clair après le sombre, `--secondary-foreground` et `--accent-foreground` gardent la valeur sombre | Non fait | `utils/theme-colors.ts:276-290` ne les redéfinit pas. CDP Sombre puis Clair : `oklch(0.98 …)`, bouton « Secondaire » 1,06:1, lien courant de la navigation 1,15:1 |
| UI-10/Reste-2 | Bordures des champs trop pâles | Non fait | `src/app.css:25,59` : 1,34:1 en clair, 1,29:1 en sombre (3:1 demandé) |
| UI-10/Reste-3 | Deux `h1` par page | Non fait | 2 `h1` sur les pages principales et l'admin (logo, `src/routes/+layout.svelte:121`). Sur `wines/[id]`, le nom du vin est un `div` (`CardTitle`, `:239`) : seul le `h1` du logo |
| UI-10/Reste-4 | « Connexion » au premier rendu serveur même connecté | Non fait | curl avec session : « Connexion » sur 12 pages, sans liens Admin ni Code-barres (`+layout.svelte:34-39`) ; corrigé après `auth.init()` |
| UI-10/Reste-5 | `errors.invalid_export_invalid_row` insère un `{reason}` anglais | Non fait | `fr.json:48` |
| UI-10/Reste-6 | `admin.supported_formats_list` cite BMP | Non fait | `fr.json:820`, contraire à SEC-06 |
| UI-10/Reste-7 | « Casier » contre « case » dans `errors.*` | Non fait | `fr.json:17-18` contre `fr.json:262,417-463,631,701` |
| UI-10/Reste-8 | Placeholders `search_*` télégraphiques | Non fait | `fr.json:237-240,272-275,986-987` |
| UI-10/Reste-9 | Clés `ui.*` fourre-tout | Non fait | 57 clés `ui.*` |
| UI-10/Reste-10 | Exemple du champ code-barres coupé à 390 px | Non fait | Il demande 353 px, le champ en offre 110 |
| UI-10/Reste-11 | Pas de `Vary: Cookie, Accept-Language` | Non fait | Aucun `Vary` sur `/wines`. SvelteKit envoie un `ETag` qui dépend du corps : aucun 304 ne sert la mauvaise langue, l'effet reste théorique sans cache partagé |
| UI-10/Reste-12 | `check:watch` ne compile les messages qu'une fois | Non fait | `package.json:16` |
| UI-10/Reste-13 | Erreur « pas un CSV » générique | Non fait | `.txt` → `422 invalid_body`, détail anglais non montré ; le client filtre déjà par extension |
| UI-10/Reste-14 | ENOENT sur `project.inlang` au premier `prepare` du build Docker | Non fait | `Dockerfile:8,19` : `pnpm install` avant `COPY . .` ; `package.json:14` avale l'échec (`\|\| echo ''`) |

### QA-03

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| QA-03 | 0 clé manquante, 0 doublon, CI en échec sinon | Corrigé | « i18n check passed » ; `.github/workflows/ci.yml:50`, repris par `release.yml:14` |
| QA-03/À faire-cron | Clés du mode cron devenues inutiles | Sans objet | Le mode cron est revenu (décision « Sauvegardes par cron (DATA-05) ») : `admin.external_cron_job` utilisé (`BackupSettingsDialog.svelte:160`) |

## 3. Nouveaux constats (passe 2)

### Critique

Aucun.

### Majeur

**M1. Un champ numérique mal lu par le navigateur enregistre un prix vide ou dix fois trop grand, sans erreur**
- Où : `src/lib/components/forms/WineBottleForm.svelte:193-203`, `src/lib/components/forms/WineDefinitionForm.svelte:182-209` (`<Input type="number">` dans un `<form novalidate>`), `src/lib/shared/schemas/form.ts:20-35`
- Scénario :
  - Chrome en anglais (app en français ou en anglais) : taper « 12,5 » dans « Prix d'achat » → Chrome lit la virgule comme séparateur de milliers, 125 est enregistré, le dialogue se ferme sans erreur.
  - Taper « 1e » ou « 1- » → `validity.badInput`, le navigateur envoie `""`, le prix existant est effacé sans erreur. Même défaut pour le millésime, la note et la quantité cible.
  - Attendu : le champ marqué invalide, rien d'envoyé, ou la virgule lue comme séparateur décimal.
  - Chrome fr-FR lit bien « 12,5 ». Firefox, qui accepte tout texte, n'a pas été essayé.
- Correction proposée : `type="text" inputmode="decimal"`, et `formNumbers` qui lit une virgule comme séparateur décimal. Le `type="text"` seul ferait refuser « 12,5 » en 422 aux Chrome français, qui marchent aujourd'hui. À défaut, refuser dans `FormAction.submit` tout champ `validity.badInput` : cela couvre l'effacement, pas le « 125 ».
- Preuve : `n1.mjs` (CDP), bouteille à 12,5 :
  ```
  Chrome en-US, app fr : "12,5" → value "125", badInput false → db: 125.0
  Chrome fr-FR, app fr : "12,5" → value "12.5" → db: 12.5
  Chrome en-US : "1e"           → value "", badInput true → dialogue fermé, db: (vide)
  ```
  `formNumbers` lit `""` comme NULL (`form.ts:30`), alors que son commentaire (l. 21-22) promet de transmettre le texte pour que le schéma le refuse.
- Vérification : Confirmé, corrigé (l'auditeur avait le scénario « 12,5 dans un navigateur français », qui n'efface rien ; le vérificateur a trouvé le cas « 125 » et montré que la correction `type="text"` seule régresserait)

### Mineur

**m1. « Ajouter une bouteille » reprend le vin d'un ajout annulé**
- Où : `src/routes/wines/+page.svelte:16-42,62`
- Scénario : créer un vin avec « Enregistrer et ajouter une bouteille », annuler le dialogue de bouteille, cliquer sur « Ajouter une bouteille » en haut de la page → le formulaire est prérempli avec ce vin. Attendu : un champ vide.
- Correction proposée : remettre `selectedDefinitionForBottle` à `null` à la fermeture du dialogue, ou ne passer le vin qu'à l'ouverture qui le demande.
- Preuve : `cdp/t5.mjs` → `C top Add Bottle form wine: "T5 Wine"`. `selectedDefinitionForBottle` n'est remis à `null` qu'après un enregistrement (l. 38-41) ; le bouton général fait seulement `showBottleDialog = true` (l. 62).
- Vérification : Confirmé

**m2. Dialogues de vin et de bouteille : rappels redondants, champs jamais lus, instances multipliées**
- Où : `src/lib/components/WineDefinitionDialog.svelte:27-35`, `src/lib/components/WineBottleDialog.svelte:13-48` ; consommateurs `src/routes/wines/+page.svelte:20-42`, `src/routes/wines/[id]/+page.svelte:120-152,209-213,797-825`, `src/lib/components/WineListView.svelte:322-350,914-938`, `src/routes/wine-shortage/+page.svelte:79-88`
- Scénario : sans effet visible ; chaque page qui ouvre ces dialogues recopie la même logique.
- Correction proposée : réduire les rappels à `onSaved(addAnother)`, retirer les `show… = false` redondants, et sur la page vin un seul `WineBottleDialog` piloté par `{ mode, bottle }`.
- Preuve : `isEdit`, `count`, `bottles` de `onBottleSaved` et `definition`, `isEdit` de `onDefinitionSaved` ne sont jamais lus (`grep -rnE "saved\.(count|bottles|isEdit)"` vide) ; seul `saveAndAddAnother` l'est. Les dialogues se ferment eux-mêmes (`WineDefinitionDialog.svelte:32`, `WineBottleDialog.svelte:39`), mais 9 gestionnaires remettent leur `show…Dialog = false`. La page vin monte trois `WineBottleDialog` (l. 809, 816, 824) aux gestionnaires identiques.
- Vérification : Confirmé

**m3. « Consommée » sans date : bloqué en silence par les dialogues de statut, accepté partout ailleurs**
- Où : `src/routes/wines/[id]/+page.svelte:170`, `src/lib/components/BottleDetailsDialog.svelte:155` (`if (CONSUMED && !consumedDate) return;`)
- Scénario : vider la date proposée, cliquer sur « Confirmer » → rien, ni requête ni message ; sur la page vin le bouton reste actif. Le formulaire de bouteille et l'API acceptent pourtant une bouteille bue sans date. Attendu, selon la décision « Formulaires de vin et de bouteille (UI-06) » (seules les règles du serveur, les erreurs disent ce qui manque) : enregistrer, ou dire que la date manque.
- Correction proposée : retirer la condition (le serveur décide), dans le dialogue de statut partagé de R5-M6c. Si une date doit être exigée, c'est une règle serveur à décider.
- Preuve : `POST /wines?/createBottles` avec `availability=consumed` sans date → `success` ; `PATCH /api/bottles {"changes":{"availability":"consumed"}}` → 200, en base `consumed|` (date vide).
- Vérification : Confirmé

**m4. Prix et valeur négatifs acceptés**
- Où : `src/lib/shared/schemas/bottle.ts:18-21` (`amount` sans borne)
- Scénario : une faute de frappe « -5 » est enregistrée. Elle ne compte pas dans le prix moyen de la carte (`priceStats` ignore les prix ≤ 0, `src/lib/utils/wine-group-sort.ts:40`), mais elle diminue la valeur totale des statistiques.
- Correction proposée : `.min(0)` sur `amount`. Le commentaire des l. 7-8 (bornes larges pour les bouteilles importées) demande de vérifier d'abord qu'aucun import n'en a créé.
- Preuve : `createBottles` avec `purchasePrice=-5` → `success`, `-5.0` en base ; `GET /api/statistics` → `"totalPurchaseValue":7.5` (12,5 − 5).
- Vérification : Confirmé

**m5. Image envoyée puis abandonnée : fichier orphelin, URL d'aperçu jamais libérée**
- Où : `src/lib/components/forms/WineDefinitionForm.svelte:66-85` (envoi dans `beforeSend`), `src/lib/components/forms/ImagePicker.svelte:48`
- Scénario : choisir une image, enregistrer un vin valide alors que le serveur refuse l'action (503 `writes_held` pendant un import, 401, erreur réseau), puis annuler → la ligne `wine_images` et le fichier restent, sans vin. Attendu : rien de stocké, ou une image retirée à l'abandon.
- Correction proposée : accepter et le documenter (l'admin supprime les images inutilisées), ou supprimer l'image envoyée quand le formulaire se démonte sans enregistrement ; révoquer l'URL d'aperçu au remplacement et au démontage.
- Preuve : l'image est stockée par `/api/upload/image` avant l'action ; son id est gardé pour un nouvel essai (`:81-83`), rien ne la supprime à l'annulation. Aucun `revokeObjectURL` hors de `utils/download.ts`.
- Vérification : Confirmé, corrigé (l'exemple de l'auditeur, un vin sans type, est arrêté par le contrôle client avant `beforeSend` : `form-action.svelte.ts:57-64` puis `:66`)

**m6. Après une reconnexion, le formulaire de bouteille ne recharge pas les réglages de code-barres**
- Où : `src/lib/components/forms/WineBottleForm.svelte:79-112,287-303`
- Scénario : session expirée, ouvrir « Ajouter une bouteille » → `loadNextBarcode` reçoit 401, laisse `autoBarcode = false` et range le message sous le champ. Se reconnecter par le dialogue de connexion : le formulaire n'est pas remonté, le champ code-barres reste saisissable, sans « (auto) » ni prochain code. Le code tapé est ensuite remplacé par le serveur sans le dire (partie serveur : axe 2). Attendu : le formulaire retrouve l'état du mode automatique.
- Correction proposée : relancer `loadNextBarcode` après une connexion réussie (ou au premier envoi qui suit un 401).
- Preuve : `loadNextBarcode` ne tourne qu'au montage (`onMount`, l. 79-82). Avec la génération active, `createBottles … barcode=MANUAL123` → `WINE000003` en base. Le message disparaît à la première frappe (`oninput`, l. 302).
- Vérification : Confirmé (nuance du vérificateur sur le message ; la partie « code tapé ignoré » est consolidée à l'axe 2)

**m7. Le rendu sûr du site web n'a pas de test**
- Où : `src/lib/utils/url.ts:8-31` (pas de `url.test.ts`) ; `src/routes/wines/[id]/+page.svelte:333-351`
- Scénario : un changement de `safeUrl` qui accepterait `data:` ou `//host` ne casserait aucun test, alors que c'est lui qui protège les valeurs déjà en base (sauvegarde ancienne restaurée).
- Correction proposée : un test unitaire de `safeUrl` (`javascript:`, `JAVASCRIPT:`, `data:`, espaces, URL relative → null ; http/https → URL).
- Preuve : `grep -rl safeUrl` sur les `*.test.ts` vide ; seul `isValidOptionalWebsite` est testé, pour `javascript:` (`schemas.test.ts:74`, `api/definitions/server.test.ts:40`).
- Vérification : Confirmé

**m8. Le mode sombre ne déclare pas `color-scheme` : contrôles natifs clairs, trois contournements**
- Où : `src/app.css:42-74`, `src/lib/utils/theme-colors.ts:293-296` ; contournements `src/routes/wines/[id]/+page.svelte:850`, `src/routes/out-of-cellar/+page.svelte:266`, `src/lib/components/BulkBarcodeDialog.svelte:418`
- Scénario : en sombre, les listes des `<select>` natifs (« éléments par page » du hors cave, filtres et dialogues de l'admin), le calendrier de `LocaleDateInput.svelte:76` et les barres de défilement restent claires.
- Correction proposée : `color-scheme: light` sur `:root`, `color-scheme: dark` sur `.dark` dans `app.css`, puis retirer les trois contournements.
- Preuve : CDP en Sombre : `getComputedStyle(document.documentElement).colorScheme` → `normal` ; 3 contournements pour 12 `<select>` natifs.
- Vérification : Confirmé

**m9. Contrastes insuffisants : texte des boutons de trois thèmes, badge de pénurie, rouge en sombre**
- Où : `src/lib/utils/theme-colors.ts:273-274,285` (et les `light.primary` des thèmes), `src/routes/+layout.svelte:106`, `src/app.css:57`
- Scénario : avec le thème jaune, orange ou vert, le texte blanc des boutons principaux (« Enregistrer », « Connexion ») passe sous 4,5:1. En sombre, tous les thèmes, bleu par défaut compris, affichent les erreurs (`text-destructive`, dont `LoginDialog.svelte:197`) sous 4,5:1. Le badge de pénurie de la navigation est à 3,81:1.
- Correction proposée : un `primary-foreground` sombre pour les thèmes clairs jaune, orange et vert (comme leurs variantes sombres) ; ne plus surcharger `destructive` en sombre (garder celui d'`app.css`) ; badge en `bg-red-700` (6,42:1).
- Preuve : `contrast.mjs` (OKLCH → sRGB → luminance WCAG) : `primary-foreground` sur `primary` en clair, bleu 5,88, vert 4,14, orange 3,21, jaune 2,56 ; badge blanc sur `red-500`, 12 px gras, 3,81:1 ; en sombre `themeVariables` impose `--destructive: oklch(0.577 …)` (lu en style inline par CDP) : 4,09 à 4,33:1, contre 7,07 avec `app.css:57`.
- Vérification : Confirmé, corrigé (ratios recalculés ; le rouge en sombre touche aussi le thème par défaut, le titre « hors du thème par défaut » était trop étroit)

**m10. Les préférences plantent l'interface quand le stockage local est refusé**
- Où : `src/lib/stores/preferences.svelte.ts:38-58,63-66` ; comparer `src/app.html:9-24`, `src/lib/utils/theme-colors.ts:300-304`, qui gèrent ce cas
- Scénario : navigateur qui bloque les cookies et données du site → exception à l'hydratation, la page du serveur reste affichée mais l'interrupteur « images » et les autres contrôles ne répondent plus. Le cookie de session étant aussi refusé, l'utilisateur ne peut que consulter.
- Correction proposée : `try/catch` autour de `#read()` et de `localStorage.setItem` (valeurs par défaut, choix gardé pour la session), avec un test.
- Preuve : Chromium aux cookies bloqués (`n4log.mjs`) : « SecurityError: Failed to read the 'localStorage' property… », exception non rattrapée `at new <anonymous>` (constructeur du store, `:39,52`), interrupteur resté `aria-checked="true"` après le clic. Navigation privée de Safari et de Chrome : `localStorage` y marche, pas de plantage.
- Vérification : Confirmé

**m11. `SearchableSelect` n'est pas une liste accessible au clavier**
- Où : `src/lib/components/ui/SearchableSelect.svelte:181-189,236-289,294-350`
- Scénario : dans le formulaire de bouteille, taper « Bo » quand deux vins correspondent : Tab quitte le champ sans atteindre la liste, Entrée ne choisit rien. Un lecteur d'écran n'annonce ni la liste ni les résultats. La liste est portée en fin de `body`, hors du piège de focus des dialogues. Le composant sert dans 7 composants.
- Correction proposée : le `Combobox` de bits-ui (déjà en dépendance), ou les rôles ARIA et les flèches avec `aria-activedescendant`.
- Preuve : ni `role="combobox"`, `aria-expanded`, `aria-controls`, `role="listbox"`/`option` ; seules Entrée et Échap sont gérées (`:244-268`), Entrée n'accepte qu'un nom exact ou un seul résultat (`:248-255`).
- Vérification : Confirmé

**m12. Page des préférences : libellés sans champ, boutons à bascule sans état**
- Où : `src/routes/preferences/+page.svelte:50,89,134,173` (`<Label>`), `:55-71,104-125,139-164,213-298` (groupes de boutons)
- Scénario : au lecteur d'écran, « Clair », « Sombre » et « Auto » sont trois boutons identiques ; rien ne dit lequel est actif. Le bloc « Préférences de l'application » répète en badges les réglages du haut (`:301`).
- Correction proposée : `role="radiogroup"` et `aria-checked` (ou `aria-pressed`), `aria-labelledby` vers le texte du groupe ; retirer le récapitulatif.
- Preuve : HTML rendu avec session : 12 `<label>` sans `for` ni champ inclus ; 0 `aria-pressed` ; l'état n'est porté que par `variant`.
- Vérification : Confirmé

**m13. Titres de page absents ou identiques**
- Où : `src/routes/barcode/+page.svelte` (pas de `<svelte:head>`), `src/routes/admin/+layout.svelte:20`
- Scénario : plusieurs onglets ouverts sur l'admin, ou l'historique du navigateur, ne distinguent pas les pages (WCAG 2.4.2).
- Correction proposée : un `<title>` par page, `{section} - {m['navigation.wine_cellar']()}`.
- Preuve : curl : `/barcode` → « Cave à vin » ; `/admin/settings`, `/admin/backups`, `/admin/images`, `/admin/data/wines` → tous « Administration - Cave à vin ».
- Vérification : Confirmé

**m14. Chargement des cases en trois copies, course sur la capacité dans `BottleDetailsDialog`**
- Où : `src/lib/components/BottleDetailsDialog.svelte:93-99,199-227`, `src/lib/components/BulkBarcodeDialog.svelte:234-260` (`fetch` brut), à côté de `src/lib/components/forms/StorageCasePicker.svelte:26` (`request()`)
- Scénario : choisir vite deux cases dans `BottleDetailsDialog` peut afficher la capacité de la première, arrivée en dernier. Une règle de chargement doit être changée en trois endroits.
- Correction proposée : reprendre le chargement de `StorageCasePicker` (ou ce composant lui-même) dans les deux dialogues, avec la garde de `BulkBarcodeDialog.svelte:255`. La copie du dialogue de statut est traitée avec R5-M6c.
- Preuve : les deux `loadStorageCases` sont identiques à une garde près ; l'`$effect` de `BottleDetailsDialog.svelte:93-99` ne vérifie pas que la réponse correspond encore à la case choisie, contrairement à `BulkBarcodeDialog.svelte:255`.
- Vérification : Confirmé, corrigé (la partie « dialogue de statut en quatre copies » est fusionnée dans R5-M6c)

**m15. Pas de `src/error.html` : une erreur du layout racine affiche la page anglaise par défaut**
- Où : `src/` (pas d'`error.html`) ; `src/routes/+layout.server.ts:14-29` lit la base sans `try`
- Scénario : base illisible ou disque plein pendant une requête → SvelteKit ne peut pas rendre `+error.svelte`, qui a besoin du layout, et sert sa page de repli en anglais, sans lien vers `/wines`.
- Correction proposée : un `src/error.html` neutre et bilingue, avec un lien vers `/wines`.
- Preuve : `ls src` sans `error.html` ; repli `node_modules/@sveltejs/kit/src/core/config/default-error.html` en `lang="en"`, qui affiche `%sveltekit.error.message%`. Non provoqué (il faudrait une base illisible).
- Vérification : Confirmé

**m16. `check-i18n.mjs` n'a pas de test et laisse passer des cas simples**
- Où : `scripts/check-i18n.mjs:30-48,175-185`
- Scénario : un `confirm('Delete?')` ou une propriété `caption:` affichée, ajoutés demain, passent la CI en anglais ; une régression du script passerait sans bruit.
- Correction proposée : quelques tests Vitest sur un dossier de cas (texte entre balises, attributs, littéraux affichés, `alert`/`confirm`/`prompt`), et ajouter ces trois fonctions au contrôle.
- Preuve : aucun test n'appelle le script. Sonde dans un worktree : `alert('Are you sure you want this')`, `confirm('Delete everything now?')`, `{ caption: 'Shown caption here' }` affiché par `{opts.caption}` et `placeholder={'e.g. 2020'}` ne sont pas signalés ; seuls `placeholder={'Type the name of the wine'}` et le texte entre balises le sont (« Hardcoded text: 2 »). Aucune fuite réelle aujourd'hui.
- Vérification : Confirmé

**m17. Typographie mélangée dans `fr.json`**
- Où : `src/lib/i18n/locales/fr.json`
- Scénario : l'interface mélange « l'étape » et « l’étape », « ... » et « … » d'un écran à l'autre.
- Correction proposée : une seule forme (apostrophe typographique, « … »), éventuellement vérifiée par `check-i18n.mjs`.
- Preuve : 182 lignes avec `'` contre 11 avec `’` (ex. l. 201, 856-857) ; 29 avec « ... » contre 19 avec « … ».
- Vérification : Confirmé

**m18. L'anglais garde « Wine Definition » là où le français dit « vin »**
- Signalé par a5a, vérifié par le rédacteur.
- Où : `src/lib/i18n/locales/en.json:169,218-220,235,247,252,323`
- Scénario : en anglais, le bouton principal de la liste dit « Add Wine Definition » et les formulaires « Edit / Duplicate / Save / Update Wine Definition ». En français : « Ajouter un vin », « Modifier le vin »… La décision « Accessibilité et langue (UI-10) » a retiré ce jargon (« Ajouter un vin » au lieu de « Ajouter Définition Vin »), mais seulement côté français (cad1c8b1).
- Correction proposée : « Add wine », « Edit wine », « Duplicate wine », « Save wine », « Update wine », « Wine », si le mainteneur veut appliquer la décision aux deux langues.
- Preuve : `wines.add_wine_definition` = « Add Wine Definition » / « Ajouter un vin » ; `forms.edit_wine_definition` = « Edit Wine Definition » / « Modifier le vin » ; `forms.wine_definition` = « Wine Definition » / « Vin » (8 clés).
- Vérification : Confirmé (rédacteur)

**m19. 75 clés i18n en trop : même texte dans les deux langues sous plusieurs noms**
- Signalé par a6b, vérifié par le rédacteur.
- Où : `src/lib/i18n/locales/en.json:68,234,347,432,517,594` (`common.cancel`, `forms.cancel`, `out_of_cellar.cancel`, `storage.cancel`, `barcode.cancel`, `admin.cancel`) et 53 autres groupes
- Scénario : « Annuler » existe sous six clés, « Date de consommation » sous cinq ; corriger un libellé demande de trouver toutes ses copies, et les copies divergent déjà (R5-M6c, `wine_details.change_bottle_status` / `admin.change_bottle_status`).
- Correction proposée : garder une clé `common.*` pour les mots isolés (Annuler, Confirmer, Pays, Région, Millésime, Notes) et retirer les copies ; garder des clés séparées seulement quand le contexte peut changer la traduction.
- Preuve : script Python sur les deux JSON : 1 180 clés, 54 groupes de clés au même texte en anglais et en français, 75 clés redondantes ; « Cancel » ×6, « Consumed Date » ×5, « Barcode », « Region », « Country » ×4. Toutes les six clés « cancel » sont utilisées (6, 2, 1, 1, 15 et 1 appels `m['…']`), donc `i18n:check` ne dit rien.
- Vérification : Confirmé (rédacteur)

**m20. Saisie groupée de codes-barres : un code exact devient ambigu quand un autre ne diffère que par la casse**
- Signalé par a6a, vérifié par le rédacteur.
- Où : `src/lib/components/BulkBarcodeDialog.svelte:171-177` (`findMatches`) ; comparer `src/lib/components/WineListView.svelte:222-229`
- Scénario : avec les préfixes `cv` et `CV` admis (décision « Préfixe de code-barres (SEC-05) »), deux bouteilles peuvent porter `cv000001` et `CV000001` : l'index unique est sensible à la casse, et un code manuel ou importé peut différer d'un autre par la seule casse. Scanner `CV000001` donne deux correspondances. La ligne est marquée ambiguë et l'utilisateur doit choisir, alors que le code scanné désigne exactement une bouteille. Rien n'est écrit sur la mauvaise bouteille : la ligne attend un choix. La recherche de la liste suit une troisième règle : « contient », sans casse.
- Correction proposée : dans `findMatches`, essayer d'abord l'égalité exacte sensible à la casse, puis sans casse, puis « se termine par ». Garder la même fonction pour la recherche de la liste si la règle doit être commune.
- Preuve : `findMatches` met tout en minuscules avant l'égalité (`:173-174`) ; une ligne à plusieurs correspondances a `chosenId: ''` (`:185`) et s'affiche avec le choix « ambigu » (`:416-433`). `sqlite3 :memory:` avec l'index `wine_bottles_barcode_unique` (`src/lib/db/schema.ts:208-210`) : insérer `cv000001` puis `CV000001` → 2 lignes.
- Vérification : Confirmé (rédacteur ; la gravité annoncée, « un code vise deux bouteilles », se limite à un choix demandé en trop)

**m21. Repli mort `wine.bottles || []` dans `BulkBarcodeDialog`**
- Signalé par a5b, vérifié par le rédacteur.
- Où : `src/lib/components/BulkBarcodeDialog.svelte:94`
- Scénario : sans effet ; le repli fait croire que `bottles` peut manquer.
- Correction proposée : `wines.flatMap((wine) => wine.bottles)`.
- Preuve : la prop est typée `wines?: { bottles: Bottle[] }[]` (`:50-51`), `bottles` non optionnel ; `WineGroupDTO` porte toujours `bottles` (`catalog/service.ts:155-172`, `bottles: []` pour un vin sans bouteille).
- Vérification : Confirmé (rédacteur)

**m22. `/wines` envoie chaque bouteille avec une copie entière de son vin, sans compression**
- Signalé par a2b, vérifié par le rédacteur.
- Où : `src/routes/wines/+page.server.ts:24`, `src/lib/server/features/catalog/service.ts:142-187`, `src/lib/server/features/bottles/repository.ts:86-101` (`toBottleWithDefinition`)
- Scénario : une cave de 100 vins et 700 bouteilles, dont 300 bues, donne 1,4 Mo de HTML pour `/wines` à chaque visite ; 3 000 bouteilles donnent 3,5 Mo. Sur le réseau local la page reste rapide (80 ms côté serveur), mais un téléphone en VPN ou en 4G le ressent, et le poids croît avec l'historique des bouteilles bues. Sévérité Mineur : cave domestique, sans erreur, et la revue 5 classait déjà R5-m24 en Mineur.
- Correction proposée : dans `listWines`, ne pas joindre `definition` à chaque bouteille, puisque le groupe la porte déjà. Seul `BulkBarcodeDialog.svelte:347,442` la lit, et il peut la prendre dans le groupe. Avec R5-m24 (ne pas envoyer les bouteilles bues) et UI-03/Reste-1 (champs de la première bouteille), cela forme une seule tâche. Le serveur Node ne compresse pas : gzip ramène la page de 1,4 Mo à 29 Ko, à signaler dans la doc pour qui a un proxy.
- Preuve : worktree jetable, port 4770, 100 vins et 700 bouteilles insérés par `sqlite3` : HTML 1 395 638 octets, dont 816 132 de données sérialisées (800 objets `definition:`) ; `__data.json` 732 360 octets ; aucun `Content-Encoding` ; `gzip -c` du HTML : 29 064 octets. Avec 3 000 bouteilles, dont 1 286 bues : HTML 3 536 011 octets, `__data.json` 2 718 261.
- Vérification : Confirmé (rédacteur)

## 4. Points restés ouverts de la passe 1

Tâches proposées, chacune regroupant des lignes Partiel ou Non fait :

- **Découper la liste des vins**
  - R5-Refacto-6a : `WineListView.svelte` en 957 lignes.
  - R5-Refacto-structure : filtres, cartes et dialogues non extraits.
  - R5-Refacto-filtres-URL : filtres perdus au retour.
  - R5-Refacto-6c et R5-m23 : pas de délai sur la recherche, URL d'image lue deux fois.
  - R5-m11 : filtres région et pays par nom.
  - R5-m7 : recherche par code-barres sur les bouteilles bues.
- **Un dialogue de statut et de déplacement partagé**
  - R5-M6c : quatre copies.
  - R5-Refacto-5 : `BottleStatusDialog` et `MoveBottlesDialog`.
  - R5-M6g : cartes de bouteilles copiées sur la page vin.
  - R5-m3 et UI-05/Reste-1 : erreur réseau muette.
  - UI-10/Trouvé-8b : « Rechargez la page » après rechargement.
  - R5-M1/setTimeout : délai restant sur `/wines`.
  - Avec m3 et m14.
- **Alléger les données de `/wines`**
  - R5-m24 : bouteilles bues envoyées.
  - UI-03/Reste-1 : champs de la première bouteille en tête.
  - UI-02/Reste-3 : `wineDefinition` de `/api/bottles/non-consumed`.
  - Avec m22.
- **Thème et accessibilité**
  - UI-10/Reste-1 : couleurs sombres gardées en clair.
  - UI-10/Reste-2 : bordures des champs.
  - UI-10/Reste-3 : deux `h1`.
  - UI-10/Reste-4 : « Connexion » au premier rendu.
  - UI-10/Reste-10 : exemple coupé à 390 px.
  - Avec m8, m9, m11, m12 et m13.
- **Textes et i18n**
  - UI-10/Trouvé-1b : toasts qui enveloppent le 401.
  - UI-10/Trouvé-2f et Reste-9 : clés `ui.*`.
  - UI-10/Reste-5, 6, 7, 8 et 13 : `{reason}` anglais, BMP cité, « Casier » contre « case », placeholders, « pas un CSV » générique.
  - Avec m16 à m19.
- **Divers**
  - UI-02/Reste-1 : `formatDate` sans `timeZone: 'UTC'`.
  - UI-02/Reste-2 : deux sélecteurs « éléments par page ».
  - UI-05/Reste-2 : « Retour » en `history.back()`.
  - UI-05/Reste-3 : `winesBelowTarget` sans ordre secondaire.
  - UI-06/Reste-1 : `listContainers` trié par nom brut.
  - UI-06/Reste-2 : image sous 20 Mo refusée en 413.
  - UI-05/Trouvé-2 : 4 `no-unused-vars`.
- **Outillage**
  - UI-10/Reste-11 : pas de `Vary`.
  - UI-10/Reste-12 : `check:watch`.
  - UI-10/Reste-14 : ENOENT de `prepare` dans le build Docker.
- **Traité ailleurs**
  - UI-02/Trouvé-1b : tri SQL par octets, axe 6.

## 5. Constats écartés

- a5a N8 (« Retour » = `history.back()`) : doublon de UI-05/Reste-2, déjà Non fait ; son scénario est repris dans cette ligne.
- a5b N8 (dialogue de statut en quatre copies) : fusionné dans R5-M6c, comme le demande la consolidation ; la partie « chargement des cases » devient m14.
- a5a, hors périmètre, filtres région et pays par nom : doublon de R5-m11.
- a5a, hors périmètre, erreur réseau avalée dans `confirmConsumption` : doublon de R5-m3 et UI-05/Reste-1.
- a5a, hors périmètre, recherche par code-barres sur les bouteilles bues : doublon de R5-m7.
- Point signalé par a6a, affichage d'un 409 `barcode_range` dans le formulaire de bouteille : vérifié sans défaut. Le message s'affiche sous le champ dès l'ouverture et à l'enregistrement (`WineBottleForm.svelte:100-112,287-303`, `field-errors.ts:13`) ; repris dans UI-06/Trouvé-1.
- a5b, hors périmètre, `Dockerfile:8` qui installe avant de copier `pnpm-workspace.yaml` : pas un défaut. `minimumReleaseAge` ne filtre que la résolution, et `pnpm install --frozen-lockfile` ne résout rien : essai du vérificateur avec `@inlang/paraglide-js@2.27.0`, qui n'avait pas encore 7 jours et sans exception, exit 0.

## 6. Renvois

- R5-M5 (mises à jour groupées non atomiques) : voir axe 2.
- Tri SQL par octets de l'historique et du hors cave (a5b N1, UI-02/Trouvé-1b) : voir axe 6.
- Code-barres manuel remplacé sans le dire en mode automatique (partie serveur de m6) : voir axe 2.
- Préfixe de code-barres comparé avec `LIKE`, sans la casse (lié à m20) : voir axe 6.
- Endpoints sans appelant, dont `GET /api/storage-containers` (UI-06/Reste-1) et `DELETE` de case : voir axe 2.
- Résumé 0.8.0 « `/` redirects … on the server » (a5b N9) : voir axe 7.
- Exception Paraglide encore là, commentaire de `pnpm-workspace.yaml:6-11` faux : voir axe 7.
- Millésime 0 traité comme absent par le filtre « sans millésime » (`src/lib/utils/wine-filters.ts:46`) et affiché ailleurs : voir axe 1.
- Pas de `admin/+error.svelte` : voir axe 4.
- `confirm()` natif pour supprimer un conteneur (`src/lib/components/storage/ContainerDialog.svelte:76`) : voir axe 6.
- Message « La caméra exige une connexion sécurisée » pour un navigateur sûr sans `getUserMedia` (`src/lib/components/barcode/camera-error.ts:25-27`) : voir axe 6.
