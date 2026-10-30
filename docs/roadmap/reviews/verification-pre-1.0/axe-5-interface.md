# Vérification d’avant 1.0, axe 5 : interface principale

Commit revu `cf48032d` (develop, 1.0.0-rc.1, 2026-10-29). Périmètre : la liste des vins, la page d’un vin, les formulaires de vin et de bouteille, les dialogues de statut, de déplacement et de détail des bouteilles, et le front transverse (layout, navigation, utilitaires partagés, Svelte 5, i18n, accessibilité, thème), avec les tâches P7–P11 de l’axe : BUG-14, UI-13, UI-14, UI-15, UI-16, UI-17, UI-20. Méthode : le rapport de l’auditeur (`$A/rapport-axe-5.md`) a été repris ligne par ligne par un vérificateur qui ne l’avait pas écrit, sur sa propre instance : worktree jetable à `cf48032d`, `pnpm install --frozen-lockfile` et `pnpm build` (`$V/00-build.log`), app construite sur le port 4555 avec des données inventées (100 vins aux noms accentués, deux régions « Bourgogne » en France et en Suisse, 646 bouteilles dont 300 bues, 5 images, un conteneur de 30 cases ; `$V/run/seed.log`), et une copie de la base à table renommée sur le port 4556 pour `error.html`. Chromium headless (Playwright du projet) : parcours BUG-14 dans un navigateur en-US puis fr-FR avec l’app en français, aller-retour des filtres de la liste par l’URL, dialogues de statut et de déplacement (double clic, réseau coupé, date vide, retour du focus), matrice axe-core 4.14.0 de 13 pages et 6 dialogues en anglais et français × clair et sombre × 1280 et 390 px (148 analyses), contraste du texte en couleur du thème dans les 8 thèmes × clair et sombre (1 632 éléments mesurés sur les écrans, plus le jeton `--primary-text` contre 6 surfaces), rejeu de chaque constat V5, mesure du poids de `/wines` ; curl pour le rendu serveur, la langue et SEC-04 ; lecture du code et de l’historique (`git show 9df0d08c:…`). Chaque verdict autre que « fait », chaque « fait » issu d’un Critique, d’un Majeur, d’un contrôle de sécurité ou d’un critère, plus d’un tiers des autres « fait », et chaque constat ont été rejoués. Les portes complètes sont celles du lead (`$S/p12/gates/summary.txt`, toutes à 0 ; lint sans avertissement, 1 456 tests).

Notations : `$S` = `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214/scratchpad`, `$A` = `$S/p12/a5` (preuves de l’auditeur), `$V` = `$S/p12/v5` (preuves du vérificateur). Les `fichier:ligne` sont ceux de `cf48032d` ; un chemin qui commence par `lib/` ou `routes/` est sous `src/`.

## 1. Résumé

- **Régressions : aucune.** Les 184 lignes de l’audit, ses 23 constats et les critères des 7 tâches P7–P11 tiennent à `cf48032d` ; chaque constat nouveau existait déjà au commit audité `9df0d08c` (`$V/regression-history.txt`).
- Verdicts, 258 lignes en tout :
  - traçabilité de l’audit, 184 lignes : 173 fait, 4 fait autrement, 1 partiel (UI-10, à cause de V5-m1), 6 sans objet ;
  - constats de l’audit (a5 M1, m1 à m22) : 22 fait, 1 partiel (m22, HTML de `/wines` encore lourd et sans compression) ;
  - points restés ouverts (8 groupes) : 7 fait, 1 partiel (le même m22) ;
  - tâches P7–P11, 43 lignes : 7 critères (6 fait, 1 fait autrement : UI-13), 36 points « Trouvé pendant » (9 fait, 3 fait autrement, 24 pas fait, qu’aucune tâche ni décision ne reprend) ;
  - total : **217 fait, 8 fait autrement, 3 partiel, 24 pas fait, 0 régressé, 6 sans objet**. Plus aucun « non vérifié » : les 8 de l’auditeur ont reçu un verdict prouvé.
- Constats nouveaux : **0 Critique, 0 Majeur, 7 Mineurs** (V5-m1 à V5-m6 de l’auditeur, tous confirmés ; V5-m7 ajouté par le vérificateur). Aucun n’est une régression.
- Mesures rejouées :
  - BUG-14 : Chromium `navigator.language=en-US`, app en français : « 12,5 » → 1 POST, prix 12,5 ; « 12.5 » → 12,5 ; « 1e » → 0 POST, `aria-invalid=true`, « Saisissez un nombre. », focus sur le champ ; en édition le prix s’affiche « 12,5 », « 1e » n’envoie rien et le prix reste 12,5. Même résultat en fr-FR.
  - axe sur 148 analyses (104 pages, 44 dialogues) : 0 sérieuse ; une seule règle en échec, `label` critique, sur la liste filtrée par « Nb bouteilles » (8 analyses, V5-m1). Liste de `SearchableSelect` ouverte : `region` modéré (connu).
  - 390 et 1280 px : aucun défilement horizontal de page ; un `h1` par page ; `color-scheme` conforme au mode partout ; titres distincts.
  - Thèmes : 0 texte en couleur du thème sous 4,5:1 sur 1 632 mesures ; `--primary-text` ≥ 4,5:1 contre fond, carte, popover, muted, accent et secondary dans les 16 combinaisons (minimum 4,50 en bleu sombre) ; axe `color-contrast` 0.
  - `/wines` : HTML 1 142 184 octets, `__data.json` 316 953, aucune bouteille bue dans les données de la page ; pas de `Content-Encoding` (gzip : 53 646) (`$V/payload.txt`).

| Id | Sévérité | Titre | Régression |
|---|---|---|---|
| V5-m1 | Mineur | Champ nombre du filtre « Nb bouteilles » sans nom accessible (axe critique `label`) | non |
| V5-m2 | Mineur | À 390 et 768 px, les actions du détail des bouteilles sont hors du dialogue | non |
| V5-m3 | Mineur | Recherche de la liste et des listes à choix sensible aux accents | non |
| V5-m4 | Mineur | Titre du détail des bouteilles « Nom - » pour un vin sans producteur | non |
| V5-m5 | Mineur | « ... » écrit dans les composants : « Mise à jour... » | non |
| V5-m6 | Mineur | À 1024 et 1280 px, le nom de chaque vin est coupé sur sa carte | non |
| V5-m7 | Mineur | « Ce sera la première bouteille pour ce vin » pour un vin qui a déjà des bouteilles hors case (ajouté par le vérificateur) | non |

## 2. Traçabilité (passe 1)

Les lignes marquées « rejoué » ont été refaites par le vérificateur ; les autres « fait » reprennent le `fichier:ligne` de l’auditeur, contrôlé par échantillon (`$V/code-checks.txt` : 32 contrôles, tous conformes).

### Revue 5

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R5-C1 | XSS stockée par le site web | Corrigé | fait | rejoué : `routes/wines/[id]/+page.svelte:216,227` (`safeUrl`, `rel="noopener noreferrer"`), `lib/utils/url.test.ts` ; `javascript:` forcé en base → `<span>javascript:alert(1)</span>`, 0 `href="javascript:` (`$V/sec04-replay.txt`) |
| R5-M1 | Formulaire de vin effacé au choix d’une région | Corrigé | fait | rejoué (code) : `lib/components/forms/WineDefinitionForm.svelte:46-47` (`untrack`, initialisé au montage) |
| R5-M1/double-chargement | Deux `loadFullDefinition()` | Corrigé | fait | Vin passé par la page : `routes/wines/+page.svelte:93-99`, `routes/wines/[id]/+page.svelte:397-402` |
| R5-M1/setTimeout | `setTimeout` restant | Partiel | fait | rejoué (code) : `routes/wines/+page.svelte:41-44` (`await invalidate(CELLAR)`, sans délai) ; seuls `setTimeout` de la liste : `debounced-text.svelte.ts:25`, `BarcodeSearch.svelte:65` |
| R5-M2 | Tri non branché | Corrigé | fait | rejoué (code) : `lib/utils/wine-group-sort.ts:70`, `WineListView.svelte:51` |
| R5-M3a | `types.ts` | Corrigé | fait | rejoué : `src/lib/types.ts` absent (`$V/code-checks.txt`) |
| R5-M3b | `WineType` | Corrigé | fait | Idem |
| R5-M3c | Liste typée en bouteilles | Corrigé | fait | `WineGroupDTO` (`WineListView.svelte:33-34`) |
| R5-M3d | Badges par enum | Corrigé | fait | `lib/utils/wine-badges.ts`, `wine-badges.test.ts` |
| R5-M3e | Nom au lieu d’id | Corrigé | fait | rejoué : filtres région par id, « Bourgogne (France) » et « Bourgogne (Suisse) » séparées (`$V/flows/flows.log`, `ui14-region-ch-separately`) |
| R5-M4a | Pas de load ; `/` par `goto` | Corrigé | fait | `routes/wines/+page.server.ts:23-26` ; `routes/+page.svelte:7` (meta refresh) |
| R5-M4b | `/wines/[id]` charge toute la cave | Corrigé | fait | `routes/wines/[id]/+page.server.ts:10-18` |
| R5-M4c | `/api/admin/images` pour l’URL | Corrigé | fait | `imageUrlsById()` (`wines/+page.server.ts:25`) |
| R5-M4d | Référentiels rechargés | Corrigé | fait | `routes/+layout.server.ts:25-33` ; `lib/components/forms/case-loads.svelte.ts` |
| R5-M4e | `bind:this` + `loadWines()` | Corrigé | fait | `invalidate(CELLAR)` (`routes/wines/+page.svelte:42`, `:104`) |
| R5-M6a | `handleSubmit` copiés | Corrigé | fait | `lib/components/forms/form-action.svelte.ts:70-94` |
| R5-M6b | Remise à zéro copiée | Corrigé | fait | `lib/components/bottles/WineBottleDialog.svelte:57-65` (`{#key}`) |
| R5-M6c | Dialogue de statut en 4 copies | Non fait | fait autrement | rejoué (code) : un seul `bottles/BottleStatusDialog.svelte`, importé par `BottleDetailsDialog.svelte`, `routes/out-of-cellar/+page.svelte`, `routes/wines/[id]/+page.svelte` ; `BulkBarcodeDialog` garde son sélecteur fait des morceaux partagés : décision « Dialogue de statut partagé (UI-13) » |
| R5-M6d | Tableaux copiés | Corrigé | fait | `bottles/BottleTable.svelte` (`BottleDetailsDialog.svelte`, `storage/AllBottlesDialog.svelte`) |
| R5-M6e | Helpers copiés | Corrigé | fait | `lib/utils/format.ts` ; `Intl.*Format` seulement dans `format.ts` et `barcode/label-issue-message.ts:7` |
| R5-M6f | « Non consommées » ×4 | Corrigé | fait | `ownedBottles` (`wine-group-sort.ts:19`) |
| R5-M6g | Cartes de bouteilles copiées | Non fait | fait | `bottles/BottleCard.svelte`, rendu par un snippet (`routes/wines/[id]/+page.svelte:345,381`) |
| R5-M7a | `WineRegistrationForm` | Corrigé | fait | Absent |
| R5-M7b | `mockData.ts` | Corrigé | fait | rejoué : absent ; knip 0 (`$S/p12/gates/5-knip.log`) |
| R5-m1 | `on:` / `onclick` | Corrigé | fait | rejoué : 0 directive `on:` dans `src` (`$V/code-checks.txt`) |
| R5-m2 | Deux paquets d’icônes | Corrigé | fait | rejoué : `package.json:33`, `@lucide/svelte` seul |
| R5-m3 | Erreurs silencieuses | Partiel | fait | rejoué : réseau coupé sur la page vin → « Le serveur est injoignable. Vérifiez votre connexion, puis réessayez. », dialogue resté ouvert (`$V/flows/flows.log`, `ui13-network-error-shown`) ; `bottles/bottle-changes.svelte.ts:60-73` |
| R5-m4 | Pas d’état de chargement | Corrigé | fait | Rendu serveur ; « aucun vin » si les filtres ne retiennent rien (`WineListView.svelte:124-132`) |
| R5-m5 | `console.*` | Corrigé | fait | rejoué : 0 `console.` dans `lib/components` et `routes` hors serveur et tests (`$V/code-checks.txt`) |
| R5-m6 | Liste des vins du formulaire | Corrigé | fait | `forms/WineBottleForm.svelte:83,92-104` |
| R5-m7 | Code-barres sur les bouteilles bues | Non fait | fait | rejoué : 0 `"consumed"` dans `/wines/__data.json` (`$V/payload.txt`) ; décision « Bouteilles bues de la liste des vins (UI-14) » |
| R5-m8 | `formatCurrency` en `en-US` | Corrigé | fait | `format.ts:35-46` (`getLocale()`) |
| R5-m9 | Date du jour en UTC | Corrigé | fait | `format.ts:118-123` |
| R5-m10 | Note au pas de 0,5 | Écart décidé | fait autrement | Décisions « Données réparées par la migration 0006 », « Formats et tableaux (UI-02) » ; `format.ts:66-70` |
| R5-m11 | Région et pays par nom | Non fait | fait | rejoué : `?region=<id>` France → 19 vins dont « Bug04 Bourgogne de France », Suisse → « Bug04 Bourgogne de Suisse » seul (`$V/flows/flows.log`, `ui14-region-ch-separately`) ; `lib/utils/wine-filters.ts:130-133` |
| R5-m12 | « No Image » en dur | Corrigé | fait | `wines/WineCard.svelte:70-72` |
| R5-m13 | `getAvailabilityLabel` | Corrigé | fait | `bottles/availability.ts` |
| R5-m14 | Textes en dur, dialogue bouteille | Corrigé | fait | « Hardcoded text: 0 » (`$S/p12/gates/4-i18n-check.log`) |
| R5-m15 | Textes en dur, dialogue vin | Corrigé | fait | Idem |
| R5-m16 | Titre de `[id]` ; `requireAuth` | Corrigé | fait | rejoué : titre « Bug04 Bourgogne de France - Cave à vin » (`$V/matrix/matrix-summary.txt`) ; 0 `requireAuth` |
| R5-m17 | Modal de connexion fait main | Corrigé | fait | rejoué : `layout/LoginDialog.svelte` (Dialog bits-ui), axe 0 sur le dialogue de connexion, 8 combinaisons (`$V/matrix.log`) |
| R5-m18 | En-têtes triables | Corrigé | fait | `table/SortableHeader.svelte` ; axe 0 sur l’historique et le hors cave, 8 combinaisons (`$V/matrix.log`) |
| R5-m19 | Boutons icône sans nom | Corrigé | fait | rejoué : axe `button-name` 0 sur 148 analyses (`$V/matrix/matrix-summary.txt`) |
| R5-m20 | Interrupteur « images » | Corrigé | fait | `wines/WineListToolbar.svelte:139-155` (`role="switch"`, `aria-checked`) |
| R5-m21 | Boutons dans un `<a>` | Corrigé | fait | `WineCard.svelte:83-112` (lien étiré, boutons frères) |
| R5-m22 | Menu mobile | Corrigé | fait | `routes/+layout.svelte:150-170` ; 0 défilement horizontal à 390 px sur 52 pages (`$V/matrix/matrix-summary.txt`) |
| R5-m23 | Refiltrage à chaque frappe ; image lue 2 fois | Non fait | fait | Debounce 200 ms (`debounced-text.svelte.ts:25`) ; URL d’image lue une fois (`WineListView.svelte:114`) |
| R5-m24 | Bouteilles bues envoyées | Non fait | fait | rejoué : `/wines/__data.json` sans bouteille bue ; `/api/wines` les garde (301 bues sur 649, `$V/payload.txt`) |
| R5-Refacto-structure | Dossier `features/wines` | Partiel | fait | `components/wines/{WineFilters,WineListToolbar,WineCard,BarcodeSearch,DebouncedInput}`, `bottles/{BottleStatusDialog,MoveBottlesDialog,BottleCard}` |
| R5-Refacto-filtres-URL | Filtres dans l’URL | Non fait | fait | rejoué : « Bug04 » + région au clavier → vin → Retour du navigateur → `?search=Bug04&region=<id>`, champs remplis, mêmes 5 cartes ; lien partagé ouvert dans une session neuve → mêmes filtres (`$V/flows/flows.log`, `ui14-search-region-open-back`, `ui14-shared-link-new-context`) |
| R5-Refacto-1 | Nettoyage | Corrigé | fait | Fichiers absents ; un paquet d’icônes |
| R5-Refacto-2 | DTO, `any`, enums | Corrigé | fait | Voir UI-03 |
| R5-Refacto-3 | Loads, `invalidate` | Corrigé | fait | `wines/+page.server.ts:23-26`, `wines/[id]/+page.server.ts:10-18` |
| R5-Refacto-3b | `/` redirigé côté serveur | Écart décidé | fait autrement | Décision « Healthcheck et racine (UI-04) » ; `routes/+page.svelte:7` |
| R5-Refacto-4 | Pickers, runes, actions | Corrigé | fait | `forms/LocationPicker.svelte`, `forms/StorageCasePicker.svelte` ; actions `wines/+page.server.ts:39-66` |
| R5-Refacto-4b | Superforms | Écart décidé | fait autrement | Décision « Formulaires (UI-06, DEP-01) » |
| R5-Refacto-5 | `BottleStatusDialog`, `MoveBottlesDialog` | Partiel | fait | rejoué : `bottles/BottleStatusDialog.svelte`, `bottles/MoveBottlesDialog.svelte` ; axe 0 sur les deux dialogues, 8 combinaisons chacun (`$V/matrix.log`, `$V/matrix/matrix-extra.txt`) |
| R5-Refacto-6a | Découper `WineListView` | Non fait | fait | rejoué : `wc -l` : `WineListView.svelte` 142, plus gros composant de la liste `WineCard.svelte` 203 |
| R5-Refacto-6b | Tri sur agrégats | Corrigé | fait | Voir BUG-05 |
| R5-Refacto-6c | Délai sur la recherche | Non fait | fait | rejoué : URL `?search=Bug04` 450 ms après la frappe (`$V/flows/flows.log`) |
| R5-Refacto-6d | Filtrage serveur | Sans objet | sans objet | Toujours conditionnel |
| R5-Refacto-7 | Derniers composants en runes | Corrigé | fait | rejoué : 0 `export let`, `$:`, `createEventDispatcher`, `svelte/store`, `<slot` (`$V/code-checks.txt`) |

### Revue 4 (M8, m7)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R4-M8 | 34 clés absentes | Corrigé | fait | « Missing keys: 0 » (`$S/p12/gates/4-i18n-check.log`) |
| R4-m7a | `aria-label` dans l’admin | Corrigé | fait | rejoué : axe 0 sur `/admin/settings` et `/admin/data/countries`, 8 combinaisons (`$V/matrix.log`) |
| R4-m7b | Edit, Trash sans libellé | Corrigé | fait | axe `button-name` 0 |
| R4-m7c | `confirm()` natif | Corrigé | fait | `storage/ContainerDialog.svelte:15,79` utilise `layout/confirm.svelte.js` |

### Revue 7 (M7)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R7-M7a | 30 clés absentes | Corrigé | fait | « Missing keys: 0 », « Unreadable keys: 0 » |
| R7-M7b | Replis `\|\| 'Réessayer'` | Corrigé | fait | `git grep "]() \|\|"` vide |
| R7-M7c | Clés en double | Corrigé | fait | « Duplicate keys: 0 », « Same text under several keys: 0 » |

### SEC-04

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| SEC-04 | `javascript:` refusé et jamais en lien ; conteneur piégé en texte | Corrigé | fait | rejoué sur l’app construite (`$V/sec04-replay.txt`) : `POST /api/definitions` et `POST /wines?/createWine` avec `website=javascript:alert(1)` → 422 `invalid_body`, `path: website` ; valeur forcée en base → `<span>javascript:alert(1)</span>`, 0 `href="javascript:` ; conteneur `<img src=x onerror=alert(1)>` (201) : `/storage` le rend 3 fois échappé (`&lt;img…`) et 2 fois en `<img` dans les données, 0 brut |

### BUG-04

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-04 | Choisir une région ne vide plus les champs | Corrigé | fait | Voir R5-M1 |

### BUG-05

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-05 | Tri cohérent | Corrigé | fait | rejoué : `?sort=bogus&dir=up&bottles=weird&count=abc&from=x` → 100 cartes, 0 erreur de page (`$V/flows/flows.log`, `ui14-invalid-values`) ; `sortWineGroups` (`wine-group-sort.ts:70`), `wine-group-sort.test.ts` |

### UI-01

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| UI-01 | knip ne signale rien | Corrigé | fait | `$S/p12/gates/5-knip.log`, code 0 |
| UI-01/Trouvé-1 | Services morts, `uuid.ts`, alias `@/*` | Corrigé | fait | rejoué : `src/lib/services`, `utils/uuid.ts`, `svelte.config.js` absents |
| UI-01/Trouvé-2 | Imports inutilisés ; `nanoid` | Corrigé | fait | Lint sans avertissement (`$S/p12/gates/2-lint.log`) |
| UI-01/Trouvé-3 | Fonctions mortes | Corrigé | fait | grep des noms vide |
| UI-01/Trouvé-4 | `mockData.ts` | Corrigé | fait | Absent |
| UI-01/Trouvé-5 | Type `.json` jamais servi | Corrigé | fait | grep vide |

### UI-02

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| UI-02 | Plus de copie des helpers | Corrigé | fait | Voir R5-M6e |
| UI-02/Trouvé-1a | Comparateurs des dialogues | Corrigé | fait | `lib/utils/bottle-sort.ts` (`sortBottles`) |
| UI-02/Trouvé-1b | Chaînes comparées avec `<` | Partiel | fait | `utils/compare.ts:3` (`Intl.Collator`) ; historique et hors cave triés en mémoire (`server/features/bottles/service.ts:181`) |
| UI-02/Trouvé-1c | Téléchargement copié | Corrigé | fait | `utils/download.ts` seul |
| UI-02/Trouvé-2 | Filtre millésime sur les bues | Corrigé | fait | `wine-filters.ts:45-58` (`ownedBottles`) |
| UI-02/Trouvé-3 | `BarcodeDialog` recopie | Corrigé | fait | `barcode/BarcodeDialog.svelte:12,52` (`saveBlob`) |
| UI-02/Trouvé-4 | Origine sur la 1re bouteille | Corrigé | fait | `wine-filters.ts:61-63` |
| UI-02/Reste-1 | `formatDate` sans UTC | Non fait | fait | rejoué : `format.ts:17` (`timeZone: 'UTC'`) ; Chromium `America/New_York` (décalage 300 min), achat au 2025-01-01 affiché « 1 janv. 2025 », jamais « 31 déc. 2024 » (`$V/extras/extras.log`, `ui15-date-utc-minus-5`) |
| UI-02/Reste-2 | Deux sélecteurs « par page » | Non fait | fait | rejoué : `table/PageSizeSelect.svelte`, seul utilisé par `out-of-cellar` et `cellar-history` ; 0 `<select` dans `src` |
| UI-02/Reste-3 | `wineDefinition` de `non-consumed` | Non fait | fait | `storage/AllBottlesDialog.svelte:92,111` lit `bottle.definition` |

### UI-03

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| UI-03 | Plus d’`any`, `types.ts` supprimé | Corrigé | fait | `types.ts` absent ; `no-explicit-any` en erreur, lint 0 |
| UI-03/Trouvé-1 | `onOpenFormatDialog` | Sans objet | sans objet | `DataManagementTabs` toujours absent |
| UI-03/Trouvé-2 | Rosé en gris | Corrigé | fait | `wine-badges.ts`, `wine-badges.test.ts` |
| UI-03/Reste-1 | Champs de la 1re bouteille en tête | Non fait | fait | rejoué : `/api/wines` en `definition,bottles` seulement (`$V/payload.txt`) |

### UI-05

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| UI-05 | 0 syntaxe Svelte 4 | Corrigé | fait | Voir R5-Refacto-7 |
| UI-05/Trouvé-1 | `Toast.svelte` mixte | Corrigé | fait | `layout/Toast.svelte` en runes |
| UI-05/Trouvé-2 | Avertissements `no-unused-vars` | Partiel | fait | rejoué : `$S/p12/gates/2-lint.log` sans aucun avertissement |
| UI-05/Trouvé-3 | `on:close` | Corrigé | fait | 0 `on:` |
| UI-05/Trouvé-4 | `isDark` lu à l’ouverture | Corrigé | fait | `color-scheme` suit le mode (`app.css:9,52`), 0 écart sur 148 analyses (`$V/matrix/matrix-summary.txt`) |
| UI-05/Reste-1 | `confirmConsumption` muet | Non fait | fait | Voir R5-m3 (rejoué) |
| UI-05/Reste-2 | « Retour » inerte en accès direct | Non fait | fait | rejoué : page d’un vin ouverte directement, « Retour » → `/wines` (`$V/extras/misc.txt`) ; `layout/BackButton.svelte:18` |
| UI-05/Reste-3 | `winesBelowTarget` sans ordre secondaire | Non fait | fait | rejoué (code) : `server/features/bottles/service.ts:217` (`compareText(a.name, b.name)`) |
| UI-05/Reste-4 | Navigation à 390 px | Corrigé | fait | rejoué : 0 défilement horizontal sur 104 pages, 390 et 1280 px (`$V/matrix/matrix-summary.txt`) |

### UI-06

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| UI-06 | Fichiers < 400 lignes, même validation | Corrigé | fait | `WineBottleForm.svelte` 345, `WineDefinitionForm.svelte` 250 ; trou M1 corrigé (BUG-14, rejoué) |
| UI-06/Trouvé-1 | 409 « préfixe épuisé » | Corrigé | fait | `forms/field-errors.ts:14` |
| UI-06/Trouvé-2a | Id affiché | Corrigé | fait | `forms/SearchableSelect.svelte:102-109` |
| UI-06/Trouvé-2b | Formulaire vide enregistrable | Sans objet | sans objet | Toujours sans chargement |
| UI-06/Trouvé-2c | Appellations rechargées | Corrigé | fait | `forms/LocationPicker.svelte` |
| UI-06/Trouvé-2d | Chargements partagés | Corrigé | fait | Un état par composant |
| UI-06/Trouvé-2e | `resetForm()` ×2 | Corrigé | fait | Absent |
| UI-06/Trouvé-3 | Image d’un vin créé | Corrigé | fait | `routes/wines/+page.svelte:41-44` (`invalidate(CELLAR)`) |
| UI-06/Trouvé-4a | Champs d’un 422 | Corrigé | fait | rejoué : « 1e » → `aria-invalid=true`, message relié par `aria-describedby` (`$V/flows/flows.log`) ; `form-action.test.ts` |
| UI-06/Trouvé-4b | `consumedDate` en édition | Corrigé | fait | `forms/form-sources.ts` (`bottleFormValues`) |
| UI-06/Trouvé-5a | Saisie effacée | Corrigé | fait | Champs non contrôlés (`WineBottleForm.svelte:197-207`) |
| UI-06/Trouvé-5b | `BulkBarcodeDialog` lu au contrôle | Corrigé | fait | `barcode/bulk-barcode.ts:115` (`computeRows`) |
| UI-06/Trouvé-6a | Recherche d’images | Corrigé | fait | `forms/ImagePicker.svelte` |
| UI-06/Trouvé-6b | Légendes vides | Corrigé | fait | Idem |
| UI-06/Trouvé-6c | Référentiels rechargés | Corrigé | fait | `page.data.references` (`WineDefinitionForm.svelte:49`, `WineBottleForm.svelte:63`) |
| UI-06/Trouvé-7 | `openEditBottleDialog` ×2 | Corrigé | fait | Un seul `WineBottleDialog` par écran |
| UI-06/Trouvé-8 | `LocaleDateInput` efface | Corrigé | fait | `forms/locale-date.ts`, `locale-date.test.ts` |
| UI-06/Trouvé-9 | Cases « A10 » avant « A2 » | Corrigé | fait | `server/features/storage/service.ts` |
| UI-06/Reste-1 | `listContainers` par nom brut | Non fait | fait | rejoué (code) : `server/features/storage/service.ts:39` (`compareText(containerLabel(…))`) |
| UI-06/Reste-2 | Image < 20 Mo refusée en 413 | Non fait | fait | rejoué (code) : limite sur le fichier, `server/features/images/service.ts:242` (`MAX_WINE_IMAGE_BYTES`), `ImagePicker.svelte:51` |
| UI-06/Reste-3 | Appelants des deux routes | Sans objet | sans objet | Toujours appelées (`forms/case-loads.svelte.ts:20`, envoi d’`ImagePicker`) |

### UI-10

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| UI-10 | axe sans violation critique ; aucun texte en dur | Corrigé | partiel | rejoué : 0 critique ni sérieuse sur 140 des 148 analyses, mais `label` critique sur `/wines?…&bottles=at_least&count=1` dans les 8 combinaisons (V5-m1, déjà là au commit audité) ; « Hardcoded text: 0 », sauf les « ... » de V5-m5 |
| UI-10/Trouvé-1a | `?login` reste | Corrigé | fait | `routes/+layout.svelte:51-58` |
| UI-10/Trouvé-1b | Toast à côté du dialogue sur 401 | Partiel | fait | rejoué : session terminée côté serveur, suppression d’une sauvegarde → dialogue de connexion seul, message « Votre session a expiré » dans le dialogue, aucun toast (`$V/extras/ui15-backup-delete-401.png`) ; `lib/stores/toast.svelte.ts:23` |
| UI-10/Trouvé-2a | `storage/+page.svelte` | Corrigé | fait | Contrôle i18n |
| UI-10/Trouvé-2b | Pluriels | Corrigé | fait | « Plurals made by hand: 0 » |
| UI-10/Trouvé-2c | Titres en deux clés | Corrigé | fait | `pageTitle()` (`layout/navigation.ts:12-14`) |
| UI-10/Trouvé-2d | Erreurs d’API anglaises | Corrigé | fait | `utils/api-error.ts` |
| UI-10/Trouvé-2e | Majuscules en français | Corrigé | fait | Titres français relevés (`$V/matrix/matrix-summary.txt`) |
| UI-10/Trouvé-2f | `ui.*` fourre-tout | Non fait | fait | rejoué : 0 clé `ui.*` (`$V/code-checks.txt`) |
| UI-10/Trouvé-2g | Clés inutilisées | Corrigé | fait | « Unused keys: 0 » |
| UI-10/Trouvé-3a | Textes de `SearchableSelect` | Corrigé | fait | `SearchableSelect.svelte` : tout par `m[…]` |
| UI-10/Trouvé-3b | Onglets admin au même libellé | Corrigé | fait | `/admin/data/countries` : 10 liens distincts |
| UI-10/Trouvé-4a | Page codes-barres | Corrigé | fait | Contrôle i18n |
| UI-10/Trouvé-4b | Refus de caméra | Corrigé | fait | `barcode/camera-error.ts` (+ test) |
| UI-10/Trouvé-5a | Navigation à 390 px | Corrigé | fait | Voir UI-05/Reste-4 |
| UI-10/Trouvé-5b | Ligne de prix coupée | Corrigé | fait | Aucun défilement relevé ; voir V5-m6 pour le nom |
| UI-10/Trouvé-5c | « N/A » en dur | Corrigé | fait | `common.not_available` |
| UI-10/Trouvé-5d | Scanner en `http://` | Corrigé | fait | `camera-error.ts` |
| UI-10/Trouvé-5e | Aide du jeton | Corrigé | fait | `fr.json` |
| UI-10/Trouvé-6 | Remplacer svelte-i18n | Corrigé | fait | Paraglide ; `svelte-i18n` absent |
| UI-10/Trouvé-7a | Erreurs de restauration | Corrigé | fait | `utils/api-error.ts` |
| UI-10/Trouvé-7b | `BackupSettingsDialog` | Corrigé | fait | Contrôle i18n |
| UI-10/Trouvé-8a | Import CSV en anglais | Corrigé | fait | Codes traduits (`admin.csv_problem_*`, `lib/utils/import-problems.ts`) |
| UI-10/Trouvé-8b | « Rechargez la page » après rechargement | Non fait | fait | rejoué (code) : `toast.bottles_deleted_elsewhere` (« … La liste est à jour. », `fr.json:958`) |
| UI-10/Trouvé-8c | Boutons hors des cartes | Corrigé | fait | Captures 1280 et 390 (`$V/matrix/page-wines-*.png`) |
| UI-10/Trouvé-9 | Contraste des cases à cocher | Corrigé | fait | rejoué : axe `color-contrast` 0 dans le dialogue des bouteilles, 8 thèmes × 2 modes (`$V/themes/themes-summary.txt`) |
| UI-10/Trouvé-10 | Puce vide | Sans objet | sans objet | Documentation, pas du code |
| UI-10/Trouvé-11 | Paraglide, cookie puis navigateur | Corrigé | fait | rejoué : cookie `fr` → `lang="fr"` ; `Accept-Language: fr-CA` → `fr` ; `de-DE` → `en` (`$V/ssr-checks.txt`) |
| UI-10/Trouvé-12a | `DYNAMIC_KEYS` | Corrigé | fait | « Unreadable keys: 0 » |
| UI-10/Trouvé-12b | Clés `storage.*` | Corrigé | fait | « Unused keys: 0 » |
| UI-10/Trouvé-12c | `invalid_filename` | Corrigé | fait | `ZipImportResultsDialog.svelte` |
| UI-10/Trouvé-12d | Rendu serveur en anglais | Corrigé | fait | Voir Trouvé-11 |
| UI-10/Trouvé-12e | SVG malformé | Corrigé | fait | rejoué : aucune erreur console hors des 404 voulus sur 148 analyses (`$V/matrix/matrix-summary.txt`) |
| UI-10/Trouvé-13a | `get()` dans `format.ts` | Corrigé | fait | `getLocale()` partout |
| UI-10/Trouvé-13b | `plural: 's'` | Corrigé | fait | ICU |
| UI-10/Trouvé-14a | Textes de `SearchableSelect` | Corrigé | fait | Voir 3a |
| UI-10/Trouvé-14b | « No Image », `for` orphelin | Corrigé | fait | axe `label` 0 sur la liste par défaut |
| UI-10/Trouvé-14c | « - My Wine Cellar » | Corrigé | fait | `pageTitle` |
| UI-10/Trouvé-14d | « Code-Barre » | Corrigé | fait | `fr.json` |
| UI-10/Trouvé-14e | Titre « Toutes » | Corrigé | fait | `storage/AllBottlesDialog.svelte` |
| UI-10/Trouvé-15a | Débordement à 390 px | Corrigé | fait | Voir UI-05/Reste-4 |
| UI-10/Trouvé-15b | Cartes qui se recouvrent | Corrigé | fait | Captures |
| UI-10/Trouvé-15c | Page 500 en anglais | Corrigé | fait | rejoué : `/nope` et `/wines/does-not-exist` → 404, « 404 - Cave à vin », un `h1` (`$V/ssr-checks.txt`) |
| UI-10/Trouvé-15d | Guide CSV en anglais | Corrigé | fait | Contrôle i18n |
| UI-10/Trouvé-15e | « 20 MB » en dur | Corrigé | fait | `wine_form.image_hint` avec `{size}` |
| UI-10/Trouvé-15f | Exemples pris pour des valeurs | Corrigé | fait | Décision « Accessibilité et langue (UI-10) » : italique, « ex : » (captures `$V/flows/*.png`) |
| UI-10/Reste-1 | Couleurs sombres gardées en clair | Non fait | fait | rejoué : Sombre → Clair dans la page = variables d’un chargement en clair, thèmes bleu et jaune (`$V/themes/ui16.txt`) ; jaune → bleu sans rechargement, idem (`$V/themes/switch.txt`) ; `utils/theme-colors.ts:310-330` |
| UI-10/Reste-2 | Bordures des champs | Non fait | fait | rejoué : `--input` de 3,19 à 3,48:1 contre fond, carte et popover, 16 combinaisons (`$V/themes/input-border.txt`) ; sous 3:1 sur `muted` (Trouvé pendant UI-16) |
| UI-10/Reste-3 | Deux `h1` | Non fait | fait | rejoué : un `h1` sur les 104 pages (`$V/matrix/matrix-summary.txt`) |
| UI-10/Reste-4 | « Connexion » au premier rendu | Non fait | fait | rejoué : curl avec session → lien `/admin` et « Déconnexion » dans le HTML serveur ; sans session → aucun lien admin (`$V/ssr-checks.txt`) |
| UI-10/Reste-5 | `{reason}` anglais | Non fait | fait | `errors.invalid_export_invalid_row` avec `{problems}` traduits (`utils/api-error.ts:139`) ; voir UI-15/Trouvé-7 pour `{table}` |
| UI-10/Reste-6 | BMP cité | Non fait | fait | rejoué : 0 valeur avec « BMP » dans `fr.json` (`$V/code-checks.txt`) |
| UI-10/Reste-7 | « Casier » | Non fait | fait | rejoué : 0 valeur avec « casier » |
| UI-10/Reste-8 | Placeholders télégraphiques | Non fait | fait | `placeholders.search_*` en phrases (« Rechercher des vins… », capture `$V/flows/20-v5m4-title-no-producer.png`) |
| UI-10/Reste-9 | Clés `ui.*` | Non fait | fait | 0 |
| UI-10/Reste-10 | Exemple du code-barres coupé | Non fait | fait | Aide sous le champ (`wines/BarcodeSearch.svelte:127-130`), décision « Aide du champ code-barres (UI-17) » |
| UI-10/Reste-11 | Pas de `Vary` | Non fait | fait | rejoué : `vary: Cookie, Accept-Language` sur `/wines`, `__data.json`, `/api/wines` (`$V/payload.txt`) ; `hooks.server.ts:81-84` |
| UI-10/Reste-12 | `check:watch` | Non fait | fait | rejoué (code) : `package.json:16-18` (`check:watch:messages … --watch`) |
| UI-10/Reste-13 | « Pas un CSV » générique | Non fait | fait | `admin.csv_problem_not_csv` et `…_from_line` (`lib/utils/import-problems.ts:37-40`) |
| UI-10/Reste-14 | ENOENT de `prepare` dans Docker | Non fait | fait | rejoué (code) : `Dockerfile:21` (`--ignore-scripts`), build après `COPY . .` (`:24,27`) |

### QA-03

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| QA-03 | 0 clé manquante, 0 doublon, CI | Corrigé | fait | `$S/p12/gates/4-i18n-check.log` « i18n check passed » |
| QA-03/À faire-cron | Clés du cron | Sans objet | sans objet | Mode cron toujours là |

### Nouveaux constats de l’audit (A5)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| a5 M1 | Champ numérique mal lu : 125 ou prix effacé | fait | rejoué : voir BUG-14 (`$V/flows/flows.log`) |
| a5 m1 | « Ajouter une bouteille » reprend un vin annulé | fait | rejoué : bouton « Ajouter une bouteille de ce vin » d’une carte (« Bodega Âme n°61 - Héritiers Müller »), Échap, puis bouton du haut → champ Vin vide (`$V/extras/imagepicker-and-m1.txt`) ; `routes/wines/+page.svelte:35-38,64` |
| a5 m2 | Rappels redondants, 3 `WineBottleDialog` | fait | `onSaved(definition, addBottle)` (`routes/wines/+page.svelte:41-44`) ; un seul `WineBottleDialog` sur la page vin (`wines/[id]/+page.svelte:404-410`) |
| a5 m3 | Consommée sans date bloquée | fait | rejoué : date vidée, double clic sur Confirmer → 1 PATCH, bouteille bue sans date (`$V/flows/flows.log`, `ui13-double-click-no-date`) |
| a5 m4 | Prix négatifs | fait | rejoué (code) : `shared/schemas/bottle.ts:15,29` (`.min(0)`). Réparation en base : axe 1 |
| a5 m5 | Image abandonnée | fait | `forms/image-uploads.ts:39-49` (`#discard`), `ImagePicker.svelte:42` (`revokeObjectURL`), `image-uploads.test.ts` |
| a5 m6 | Réglages de code-barres après reconnexion | fait | `WineBottleForm.svelte:89` (relance sur `auth.isAuthenticated`) |
| a5 m7 | `safeUrl` sans test | fait | `lib/utils/url.test.ts` |
| a5 m8 | `color-scheme` | fait | rejoué : `app.css:9,52` ; `colorScheme` = mode sur les 148 analyses, 0 `<select>` natif (`$V/matrix/matrix-summary.txt`, `$V/themes/ui16.txt`) |
| a5 m9 | Contrastes des thèmes, badge, rouge sombre | fait | rejoué : texte des boutons ≥ 4,78:1, rouge d’erreur ≥ 6,42:1 dans les 16 combinaisons (`$V/themes/ui16.txt`) ; badge `bg-red-700` (`routes/+layout.svelte:109`) |
| a5 m10 | Préférences sans stockage | fait | rejoué : `localStorage` qui lève → interrupteur « images » `true → false`, 0 erreur de page (`$V/extras/extras.log`, `a5m10-no-storage`) |
| a5 m11 | `SearchableSelect` au clavier | fait | rejoué : `role="combobox"`, `aria-activedescendant`, `role="listbox"/"option"` (`SearchableSelect.svelte:365,370,406,418`) ; flèches puis Entrée choisissent « Bourgogne (France) » (`$V/flows/flows.log`) |
| a5 m12 | Préférences : libellés, bascules | fait | `preferences/ChoiceGroup.svelte:40,48-49` ; récapitulatif retiré (décision « Récapitulatif des préférences retiré (UI-17) ») |
| a5 m13 | Titres de page | fait | rejoué : 13 titres distincts par langue (`$V/matrix/matrix-summary.txt`) |
| a5 m14 | Cases en trois copies, course | fait | `forms/case-loads.svelte.ts` |
| a5 m15 | Pas d’`error.html` | fait | rejoué : table `wine_types` renommée dans une copie de la base, port 4556 → 500 avec `src/error.html` bilingue (`$V/error-html.txt`) |
| a5 m16 | `check-i18n` sans test | fait | `scripts/check-i18n.test.ts` (15 cas), `scripts/check-i18n-cases/` ; `alert`/`confirm`/`prompt` détectés (`check-i18n.mjs:47`) |
| a5 m17 | Typographie de `fr.json` | fait | rejoué : 0 valeur avec `'`, `"` ou `...` (`$V/code-checks.txt`) |
| a5 m18 | « Wine Definition » en anglais | fait | rejoué : 0 valeur anglaise avec « definition » |
| a5 m19 | 75 clés en trop | fait | « Same text under several keys: 0 » ; 2 exceptions commentées (`check-i18n.mjs`, `SAME_TEXT_ALLOWED`) |
| a5 m20 | Code exact rendu ambigu par la casse | fait | `barcode/bulk-barcode.ts:36-65` (`findSameBarcode`), `bulk-barcode.test.ts` |
| a5 m21 | Repli `bottles \|\| []` | fait | `bulk-barcode.ts:81-82` |
| a5 m22 | `/wines` : vin copié par bouteille, sans compression | partiel | rejoué : copie retirée, `__data.json` 316 953 octets (audit 732 360), 0 bouteille bue, bouteille sans `definition`. Reste : HTML 1 142 184 octets (audit 1 395 638 pour une cave proche), dont 802 011 de balisage (attributs `class` 414 510, SVG en ligne 255 105) ; aucune compression (`Content-Encoding` absent, gzip 53 646) ; ni README ni README-Docker ne parlent de compression par un proxy (`$V/payload.txt`) |

### Points restés ouverts de la passe 1 (§ 4 de l’audit)

| Groupe | Lignes | Verdict | Preuve |
|---|---|---|---|
| Découper la liste des vins | R5-Refacto-6a, structure, filtres-URL, 6c, m23, m11, m7 | fait | Lignes ci-dessus (UI-14), filtres rejoués |
| Dialogue de statut et de déplacement partagé | R5-M6c, Refacto-5, M6g, m3, UI-05/Reste-1, UI-10/Trouvé-8b, setTimeout, m14 | fait (M6c : fait autrement, décision UI-13) | Lignes ci-dessus (UI-13), dialogues rejoués |
| Alléger les données de `/wines` | R5-m24, UI-03/Reste-1, UI-02/Reste-3, m22 | partiel | m22 : HTML encore 1,1 Mo, sans compression |
| Thème et accessibilité | UI-10/Reste-1, 2, 3, 4, 10, m8, m9, m11, m12, m13 | fait | UI-16, UI-17, rejoués |
| Textes et i18n | UI-10/Trouvé-1b, 2f, Reste-5 à 9, 13, m16 à m19 | fait | UI-15 |
| Divers | UI-02/Reste-1, Reste-2, UI-05/Reste-2, Reste-3, UI-06/Reste-1, Reste-2, UI-05/Trouvé-2 | fait | Lignes ci-dessus |
| Outillage | UI-10/Reste-11, 12, 14 | fait | Lignes ci-dessus |
| Traité ailleurs | UI-02/Trouvé-1b | fait | `server/features/bottles/service.ts:181` |

### BUG-14 · Champs numériques lus par Cellar

| Point | Verdict | Preuve |
|---|---|---|
| Critère : Chrome en-US, app en français, « 12,5 » → 12,5 ; « 1e » → erreur sous le champ, prix inchangé ; idem fr-FR | fait | rejoué (`$V/flows/flows.log`), page vin, « + Ajouter une bouteille » : `navigator.language=en-US`, champ `type=text inputmode=decimal`, « 12,5 » → 1 POST, bouteilles à 12,5 : 0 → 1 ; « 12.5 » → 1 → 2 ; « 1e » → 0 POST, `aria-invalid=true`, « Saisissez un nombre. », focus sur `purchasePrice`. Édition d’une bouteille à 12,5 : le champ affiche « 12,5 », « 1e » → 0 `updateBottle`, prix inchangé. fr-FR : mêmes résultats |
| Trouvé 1 : 390 px, pas de défilement vers l’erreur | fait | rejoué : envoi refusé à 390 px → focus sur le premier champ en erreur (le vin), visible (`$V/extras/misc.txt`, `$V/extras/refused-submit-390.png`) |
| Trouvé 2 : `ContainerDialog`, erreur serveur en toast générique | fait | `storage/ContainerDialog.svelte:39` (`draft.showRefusal(body)`, sinon le message de l’API) |
| Trouvé 3 : `places_used` non formaté | fait | `bottle_form.places_used` : `{capacity, number}` en anglais, `{used, plural…}` et `{capacity, number}` en français |
| Trouvé 4 : `NumberInput` dans `ui/` | fait | `lib/components/forms/NumberInput.svelte` (UI-19) |
| Trouvé 5 : `amount` négatif | fait | `schemas/bottle.ts:15,29` |
| Rejeté en revue : `{max, number}` ICU | fait autrement | Décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) » : BUG-14/6 (ce point, sixième de la liste de BUG-14) est classé « accepté ou seulement informatif » ; `formatNumber` gardé (`forms/field-errors.ts:51`) |

### UI-13 · Dialogues de statut et de déplacement partagés

| Point | Verdict | Preuve |
|---|---|---|
| Critère : un seul dialogue de statut et de déplacement, utilisé par les quatre écrans ; page vin : double clic = 1 requête, échec réseau affiché, « Consommée » sans date enregistrée | fait autrement | Trois écrans importent `BottleStatusDialog` ; le quatrième (`BulkBarcodeDialog`) garde son sélecteur fait des morceaux partagés : décision « Dialogue de statut partagé (UI-13) ». Le reste rejoué : 1 PATCH sur double clic, message réseau, bouteille bue sans date ; Échap rend le focus à « Cliquer pour marquer consommé » et à « Changer emplacement » (`$V/flows/flows.log`, `ui13-*`, `move-dialog-escape-focus`) |
| Trouvé 1 : `GET /api/storage-cases/{id}/capacity` sans appelant | fait autrement | Décision « Endpoints et CSRF (API-06) » (les endpoints sans appelant restent) ; route `routes/api/storage-cases/[id]/capacity/+server.ts` toujours là |
| Trouvé 2 : l’aperçu compte des bouteilles qui ne prennent pas de place | pas fait | `bottles/MoveBottlesDialog.svelte:73` (`incoming={bottles.length}`), `bottles/CaseTargetPicker.svelte:77,117` |
| Trouvé 3 : `fetch` bruts restants | pas fait | `storage/AllBottlesDialog.svelte:54`, `storage/ContainerDialog.svelte:65,70,81`, `barcode/PresetManager.svelte:87`, `barcode/BarcodeStatsCard.svelte:28` |
| Trouvé 4 : « bu le » sur une bouteille non bue | pas fait | `bottles/BottleCard.svelte:164-169` (`{:else if bottle.consumedDate}` ; anciennes lignes seulement) |
| Trouvé 5 : `{#each}` sans clé | fait | `routes/wines/[id]/+page.svelte:255,303,345,381` tous clés |

### UI-14 · Liste des vins

| Point | Verdict | Preuve |
|---|---|---|
| Critère : « Bug04 », ouvrir, revenir → filtres et URL gardés ; deux « Bourgogne » séparées ; `/wines` deux fois moins lourd, `/api/wines` garde les bues ; aucun composant > 400 lignes ; e2e | fait | rejoué : `ui14-search-region-open-back`, `ui14-region-ch-separately` (`$V/flows/flows.log`) ; `__data.json` 316 953 octets contre 757 010 avant UI-14 (2,39×), mesure choisie par le coordinateur et écrite dans le « Fait en P9 » (le HTML seul ne gagne que 1,69× selon la tâche) ; `/api/wines` : 301 bues ; composants de la liste ≤ 203 lignes ; e2e verts (`$S/p12/gates/7-test-e2e.log`) |
| Trouvé 1 : HTML ~560 Ko pour 100 cartes | pas fait | 802 011 octets de balisage pour 100 cartes (`$V/payload.txt`) ; aucune tâche ultérieure ne l’a repris |
| Trouvé 2 : nom `showTablePage` | pas fait | `lib/utils/table-navigation.ts:11`, utilisé par la liste des vins, `PageSizeSelect`, le hors cave et l’historique ; UI-19 ne l’a pas renommé |
| Trouvé 3 : avertissements de lint | fait | Lint sans avertissement (`$S/p12/gates/2-lint.log`) ; plus de `console` dans `AllBottlesDialog` |

### UI-15 · Textes et i18n

| Point | Verdict | Preuve |
|---|---|---|
| Critère : `i18n:check` passe, ses tests échouent si on retire une détection ; même texte sous deux clés hors `common.*` ; plus de `ui.*` ; 401 sur suppression de sauvegarde ; 1er janvier en UTC-5 | fait | Gate i18n ; `scripts/check-i18n.test.ts` (15 cas sur `scripts/check-i18n-cases/`) ; 0 `ui.*` ; rejoués : 401 → dialogue de connexion seul (`$V/extras/ui15-backup-delete-401.png`), « 1 janv. 2025 » à New York (`$V/extras/extras.log`) |
| Trouvé 1 : « session expirée » dans des dialogues à côté de la connexion | pas fait | `forms/WineBottleForm.svelte:106-118` : un 401 de `next-barcode` range `errorMessage(error)` sous le champ code-barres (commentaire : « 401 once the session has expired ») |
| Trouvé 2 : `{count}` non formaté | pas fait | Messages compilés : en anglais `${i?.count} selected`, `… and ${i?.count} more`, `${i?.count} free`, sans `Intl.NumberFormat` ; le français passe par `#` (`icuPound`, formaté) (`$V/i18n-counts.txt`) |
| Trouvé 3 : `check-i18n` ne voit pas `placeholder={'…'}` ni `caption:` | pas fait | Sonde : `checkI18n` de `cf48032d` sur un projet jetable (`$V/i18n-probe/`) ne signale que `placeholder={'Type the name of the wine'}` ; `placeholder={'e.g. 2020'}` et `{ caption: 'Shown caption here' }` affiché passent (`$V/i18n-probe.txt`) |
| Trouvé 4 : `rowProblemsText` sépare par « ; » | pas fait | `lib/utils/import-problems.ts:45` (`.join('; ')`) |
| Trouvé 5 : pas d’espace insécable | pas fait | 214 valeurs de `fr.json` avec une espace U+0020 avant `:`, `;`, `!`, `?` ou dans « » ; 0 U+00A0 ni U+202F ; `common.label` = « {label} : » (`$V/i18n-trouve-ui15.txt`) |
| Trouvé 6 : capitales anglaises, français télégraphique | pas fait | 180 valeurs anglaises en capitales de titre (« Purchase Date », « Storage Cases », « My Wines »…) ; `wines.view_bottle_details` = « Voir détails de la bouteille » (`$V/i18n-trouve-ui15.txt`) |
| Trouvé 7 : `invalid_row` nomme la table brute | pas fait | `server/features/backup/json-import.ts:94-98` passe `table` (clé d’`EXPORT_TABLES`, ex. `wineDefinitions`) ; `utils/api-error.ts:134-140` ne traduit que `problems` |
| Trouvé 8 : clés qui ne diffèrent qu’en anglais | pas fait | `forms.duplicate_wine_bottle`/`forms.duplicate_bottle` (« Dupliquer la bouteille » ×2), `common.add_bottle`/`forms.add_wine_bottle` (« Ajouter une bouteille » ×2), `auth.session_expired`/`errors.unauthenticated` (`$V/i18n-trouve-ui15.txt`) |
| Trouvé 9 : « Producteur : » vide sur la page vin | pas fait | `routes/wines/[id]/+page.svelte:153-160` (`{wineDefinition.producer}` sans repli) |
| Trouvé 10 : `UpgradeBanner` sans test | pas fait | `src/lib/components/admin/UpgradeBanner.svelte` ; aucun `*.test.ts` ni `e2e/` ne le cite (`git grep UpgradeBanner`) |

### UI-16 · Thème

| Point | Verdict | Preuve |
|---|---|---|
| Critère : sélecteurs natifs sombres sans contournement ; texte des boutons, badge et bordures aux ratios WCAG ; sombre → clair = rechargement | fait | rejoué (`$V/themes/ui16.txt`) : 0 `<select>` dans `src`, `color-scheme` sombre mesuré ; texte des boutons ≥ 4,78:1 (vert clair), rouge d’erreur ≥ 6,42:1, 16 combinaisons ; bordure `--input` ≥ 3,19:1 contre la page (`$V/themes/input-border.txt`), conforme à la décision « Champs en mode sombre (UI-16) » ; sombre → clair identique à un chargement (bleu, jaune) |
| Trouvé 1 : `--input` sous 3:1 sur `muted` | pas fait | Mesuré : 2,85 à 3,05:1 en clair dans les 8 thèmes, 2,98 à 2,99:1 en sombre pour violet, orange, rouge et rose (`$V/themes/input-border.txt`) |
| Trouvé 2 : bordures des sélecteurs natifs, `FilterSelect`… | fait | Laissées à UI-18 : plus de `<select>` natif, `FilterSelect` sur `OptionSelect` |
| Trouvé 3 : pas vérifié dans Firefox | pas fait | `playwright.config.ts:18` et `ci.yml:112` : Chromium seulement ; aucun Firefox installé ni essayé ici non plus |

### UI-17 · Accessibilité, connexion au premier rendu, pages d’erreur

| Point | Verdict | Preuve |
|---|---|---|
| Critère : lien Admin dans le HTML serveur ; `SearchableSelect` au clavier seul ; axe sans violation sérieuse (liste, vin, préférences, admin) ; envoi refusé à 390 px → premier champ en erreur ; erreur du layout racine → `error.html` | fait | rejoués : `$V/ssr-checks.txt` (lien `/admin` avec session) ; clavier (`$V/flows/flows.log`) ; 0 sérieuse sur 148 analyses (la critique `label` de V5-m1 n’apparaît qu’avec un mode « Nb bouteilles » choisi) ; 390 px (`$V/extras/misc.txt`) ; `$V/error-html.txt`. `/admin/data/nope` → « 404 - Administration - Cave à vin » avec les 4 liens de l’admin |
| Trouvé 1 : `region` modérés | pas fait | rejoué : liste de « Région » ouverte → `moderate region`, `#s7-list` (`$V/matrix/matrix-extra.txt`) |
| Trouvé 2 : « ajouter » après saisie, Tab ne choisit pas | pas fait | rejoué : « Bourgogne (Suisse) » en surbrillance, Tab → champ vide, URL sans région (`$V/extras/extras.log`, `ui17-tab-does-not-choose`) ; `SearchableSelect.svelte:276-282` |
| Trouvé 3 : toasts empilés | pas fait | rejoué : déconnecté, clics répétés sur « Ajouter un vin » → le même avertissement affiché deux fois, l’un sous l’autre (`$V/extras/ui17-toasts-stack.png`) ; `lib/stores/toast.svelte.ts:19-30` sans regroupement |
| Trouvé 4 : aide d’`ImagePicker` non reliée | pas fait | rejoué : l’aide « Un fichier JPEG, PNG, WebP ou GIF de 20 Mo au plus… » (`id=…-message`) n’est référencée par aucun `aria-describedby`, ni au repos ni en parcourant les images (`$V/extras/imagepicker-and-m1.txt`). Cause : `FormField.svelte:36-39` ne marque que le premier champ hors `type="hidden"` et `type="file"`, et pas les boutons ; `ImagePicker.svelte:85` n’en a pas d’autre |
| Trouvé 5 : erreur d’une page de données perd les liens des tables | pas fait | `/admin/data/nope` : liens `/admin/backups`, `/admin/data`, `/admin/images`, `/admin/settings` seulement (`$V/ssr-checks.txt`). Renvoi axe 4 |

### UI-20 · Texte en couleur du thème

| Point | Verdict | Preuve |
|---|---|---|
| Critère : aucun texte en couleur du thème sous 4,5:1, 8 thèmes clair et sombre | fait | rejoué (`$V/themes/themes-summary.txt`) : 1 632 éléments `text-primary-text` mesurés (sélection du détail des bouteilles, résultats de la recherche par code-barres, entrée « ajouter » de `SearchableSelect`, lien du site survolé, lien de la pénurie survolé), pire 5,52:1 ; `--primary-text` contre 6 surfaces ≥ 4,50:1 ; axe `color-contrast` 0 ; tous les autres `text-primary` de `src` sont des icônes (`git grep`) |
| Trouvé 1 : icônes `text-primary` sous 3:1 en jaune et orange clairs | pas fait | Icônes toujours en `text-primary` (`routes/statistics/+page.svelte:66,88,106,122,138`, `routes/wine-shortage/+page.svelte:75`, dialogues de l’admin) ; aucune décision ne les accepte |
| Trouvé 2 : bleu sombre à 4,50008:1 | pas fait | Mesuré 4,50:1 (conforme, sans marge) ; couleur inchangée. Aucune décision : ce n’est pas « fait autrement » |
| Trouvé 3 : variante `link` sans utilisateur | fait autrement | Décision « Code mort et knip (UI-01) » (primitives shadcn gardées telles que le CLI les écrit) |
| Trouvé 4 : étape e2e qui choisit juste après l’ouverture d’un Select | fait | Les parcours attendent que la liste soit prête avant de choisir (`e2e/backup.spec.ts:25-28`, `toHaveAttribute('data-highlighted')`) ; e2e verts (`$S/p12/gates/7-test-e2e.log`) |

## 3. Nouveaux constats (passe 2)

### Régressions

Aucune.

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

**V5-m1. Le champ nombre du filtre « Nb bouteilles » n’a pas de nom accessible**
- Ce qui se passe : choisir « Exactement », « Au moins » ou « Moins de » affiche un `<input type="number">` sans libellé, `aria-label` ni `aria-labelledby`. Un lecteur d’écran l’annonce « zone d’édition » sans dire ce qu’elle compte. axe : violation critique `label`, en anglais et en français, clair et sombre, 1280 et 390 px. L’analyse par défaut d’UI-17 ne la voyait pas, car le champ n’apparaît qu’après ce choix.
- Reproduction : `/wines?bottles=at_least&count=3`, puis axe-core.
- Preuves : auditeur `$A/extras/extras.log`, `$A/flows/flows.log` ; vérificateur `$V/flows/flows.log` (`v5m1-count-field-axe-1280` et `-390` : `ariaLabel:null, labelledby:null, labels:0`, `label` critique sur `.w-16`), `$V/matrix/matrix-summary.txt` (8 analyses de `wines-filters`).
- Où : `src/lib/components/wines/WineListToolbar.svelte:124-131` (`DebouncedInput` sans nom ; le `Select.Trigger` voisin en a un, `:110-113`).
- Régression : non. Même `Input` sans libellé au commit audité (`src/lib/components/WineListView.svelte:653-659` (`bind:value={bottleFilterCount}` :655) à `9df0d08c`, `$V/regression-history.txt`) ; UI-14 l’a déplacé tel quel.

**V5-m2. À 390 et 768 px, les actions du détail des bouteilles sont hors du dialogue**
- Ce qui se passe : dans le dialogue ouvert par « N bouteilles » d’une carte (ou par une recherche de code-barres qui trouve une bouteille), cocher une bouteille fait apparaître « Changer emplacement » et « Changer la disponibilité des bouteilles » à droite de la ligne d’en-tête, dans la zone qui défile en largeur avec le tableau. Rien n’indique qu’ils existent.
  - 390 px, français : boutons à x = 370–546 et 554–829 pour un dialogue de 0 à 390 px ; zone 340 px de large pour 804 de contenu.
  - 390 px, anglais : « Change bottle availability » à x = 444–635.
  - 768 px : « Changer la disponibilité des bouteilles » à 561–836, coupé ; 1024 px : les deux visibles.
- Reproduction : `/wines?search=Bug04%20Bourgogne%20de%20France`, ouvrir « N bouteilles », cocher une ligne, mesurer.
- Preuves : auditeur `$A/extras/details-buttons.txt`, `$A/extras/details-buttons-fr-390.png` ; vérificateur `$V/flows/flows.log` (`details-actions-*`), `$V/flows/details.log`, `$V/flows/details-actions-fr-390.png`, `$V/flows/details-actions-fr-768.png`.
- Où : `src/lib/components/bottles/BottleDetailsDialog.svelte:131-189` (`flex justify-between` dans `flex-1 overflow-auto`).
- Régression : non. Même mise en page au commit audité (`BottleDetailsDialog.svelte:335-390` à `9df0d08c`).

**V5-m3. La recherche ignore la casse mais pas les accents**
- Ce qui se passe : la recherche de la liste et les listes à choix (`SearchableSelect`) comparent `toLowerCase().includes`. « chateau » ne trouve aucun des 13 « Château » ; « ecureuil » aucun des 7 « Écureuil ». Le tri, lui, ignore accents et casse (décision « Tri de l’historique et du hors cave (UI-04, UI-07) »), et aucune décision ne vise la recherche.
- Reproduction : `/wines?search=chateau` contre `/wines?search=ch%C3%A2teau`.
- Preuves : auditeur `$A/flows/flows.log`, `$A/extras/focus.txt` ; vérificateur `$V/flows/flows.log` (`v5m3-accents` : `chateau=0, château=13, CHÂTEAU=13, ecureuil=0, écureuil=7`).
- Où : `src/lib/utils/wine-filters.ts:119,128`, `src/lib/components/forms/SearchableSelect.svelte:59`.
- Régression : non. Même code au commit audité (`WineListView.svelte:146-151`, `ui/SearchableSelect.svelte:52` à `9df0d08c`).

**V5-m4. Le titre du détail des bouteilles finit par « - » pour un vin sans producteur**
- Ce qui se passe : le titre est `{name} - {producer}`, sans repli. « Mas Forêt n°4 » sans producteur donne « Mas Forêt n°4 - », alors que sa carte dit « Producteur inconnu ».
- Reproduction : chercher un vin sans producteur, ouvrir « N bouteilles ».
- Preuves : auditeur `$A/extras/misc.txt`, `$A/extras/details-title-no-producer.png` ; vérificateur `$V/flows/details.log`, `$V/flows/v5m4-title-no-producer.png`.
- Où : `src/lib/components/bottles/BottleDetailsDialog.svelte:125`.
- Régression : non. Même ligne au commit audité (`BottleDetailsDialog.svelte:329`). Proche de UI-15/Trouvé-9 (« Producteur : » vide sur la page vin), autre écran.

**V5-m5. « ... » écrit dans les composants : « Mise à jour... »**
- Ce qui se passe : pendant un envoi, le bouton de confirmation des dialogues de statut, de déplacement et de saisie groupée affiche `{m['common.updating']()}...`, soit « Mise à jour... », alors qu’UI-15 a mis tout `fr.json` en « … » et que `check-i18n` refuse `...` dans les valeurs ; le contrôle ne voit pas ces points, qui ne sont pas des lettres.
- Reproduction : réponse du PATCH retardée de 2,5 s, Confirmer sur la page vin → boutons désactivés `["Consommé","","Annuler","Mise à jour..."]`.
- Preuves : vérificateur `$V/extras/extras.log` (`v5m5-updating-text`), `$V/extras/v5m5-updating-text.png` (l’auditeur n’avait que le code).
- Où : `src/lib/components/bottles/ConfirmButtons.svelte:19`, `src/lib/components/barcode/BulkBarcodeDialog.svelte:471`. Même nature hors axe : `src/routes/statistics/+page.svelte:27-29` (`abbreviate`, `'...'`), en renvoi.
- Régression : non. Déjà au commit audité (`BottleDetailsDialog.svelte:499`) ; UI-13 l’a repris dans `ConfirmButtons`.

**V5-m6. À 1024 et 1280 px, le nom de chaque vin est coupé sur sa carte**
- Ce qui se passe : la grille passe à 4 colonnes en `lg` et 5 en `xl` ; le titre, en `truncate`, partage sa ligne avec « Modifier » et « Dupliquer » et ne dispose que de 96 px (1280) ou 108 px (1024). Les 100 titres de la cave de test sont coupés à ces deux largeurs (« Bodega Âme n°61 » 150 px, « Mas Forê… »), aucun à 390 px. Le nom complet n’est que dans `title`, invisible au toucher.
- Reproduction : `/wines` connecté, fenêtre de 1280 ou 1024 px, comparer `scrollWidth` et `clientWidth` des `h2`.
- Preuves : auditeur `$A/matrix/page-wines-fr-light-1280.png` ; vérificateur `$V/flows/flows.log` (`v5m6-title-truncation-1280` : `truncated:100` sur 100, `-1024` : 100, `-390` : 0), `$V/flows/20-v5m4-title-no-producer-FAIL.png` (une seule carte, coupée aussi).
- Où : `src/lib/components/wines/WineListView.svelte:108`, `src/lib/components/wines/WineCard.svelte:82-112`.
- Régression : non. Même grille et même `truncate` au commit audité (`WineListView.svelte:692,741`). Complément du vérificateur : 1024 px touché aussi.

**V5-m7. « Ce sera la première bouteille pour ce vin » pour un vin qui a déjà des bouteilles hors case (ajouté par le vérificateur)**
- Ce qui se passe : le bloc « Emplacements des bouteilles existantes » du dialogue d’ajout de bouteilles affiche « Aucune bouteille stockée encore. Ce sera la première bouteille pour ce vin. » dès qu’aucune bouteille disponible du vin n’est dans une case. Pour « Bug04 Bourgogne de France », qui a 4 bouteilles disponibles sans case (la page dit « Bouteilles disponibles (4) »), le dialogue annonce la première bouteille. `wineLocations` ne compte que les bouteilles rangées (`totalBottles: 0`). Rien n’est écrit de faux en base : seul le texte trompe.
- Reproduction : page d’un vin dont les bouteilles n’ont pas de case, « + Ajouter une bouteille » ; `GET /api/wines/{id}/locations` → `{"locations":[],"totalBottles":0}`.
- Preuves : `$V/extras/first-bottle-message.txt`, `$V/extras/first-bottle-message.png`.
- Où : `src/lib/components/forms/ExistingBottleLocations.svelte:58-61` ; message `forms.no_bottles_stored_yet` (`en.json:286`, `fr.json:286`) ; `src/lib/server/features/storage/service.ts:273-295`, `storage/repository.ts:163-171` (bouteilles sans case écartées).
- Régression : non. Même condition et même message au commit audité (`src/lib/components/ExistingBottleLocations.svelte:58-60`, `fr.json:282` à `9df0d08c`).

## 4. Déjà connus

Non comptés comme constats ; les points « Trouvé pendant » ont leur verdict en section 2.

- HTML de `/wines` lourd et sans compression (1 142 184 octets, gzip 53 646) : a5 m22 (partiel) et « Trouvé pendant UI-14 ».
- `region` modéré sur la liste portée de `SearchableSelect`, Tab qui ne choisit pas, « ajouter » après saisie, toasts empilés, aide d’`ImagePicker` non reliée, liens des tables perdus sur une erreur de l’admin : « Trouvé pendant UI-17 ».
- « Producteur : » vide sur la page vin, capitales anglaises, `{count}` anglais non formaté, angles morts de `check-i18n`, « ; » entre problèmes, table brute dans `invalid_row`, espaces insécables, clés qui ne diffèrent qu’en anglais, `UpgradeBanner` sans test, « session expirée » dans des dialogues : « Trouvé pendant UI-15 ».
- Aperçu de capacité du déplacement qui compte des bouteilles sans place, `fetch` bruts restants, « bu le » sur d’anciennes lignes : « Trouvé pendant UI-13 ».
- `--input` sous 3:1 sur `muted`, Firefox non essayé : « Trouvé pendant UI-16 ».
- Icônes en couleur du thème sous 3:1 en jaune et orange clairs, bleu sombre à 4,50:1 sans marge : « Trouvé pendant UI-20 » et UI-18.
- Champs entiers restés en `type="number"` (filtres millésime et « Nb bouteilles ») : décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) ». V5-m1 vise le nom accessible de ce champ, pas son type.
- La saisie groupée ne trouve plus une bouteille bue : décision « Bouteilles bues de la liste des vins (UI-14) ».
- « Retour » après Précédent ou Suivant du navigateur mène à `/wines` sans filtres : choix commenté dans `layout/BackButton.svelte:6-9`, sans décision dans la feuille de route ; vu, non compté.

## 5. Corrections du vérificateur

Verdicts changés :
- BUG-14 « Rejeté en revue : `{max, number}` ICU » : pas fait → **fait autrement**. La décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) » classe BUG-14/6 (ce sixième point de la liste de BUG-14, après les cinq « Trouvé pendant ») parmi « ce qui est accepté ou seulement informatif ».
- UI-13 critère : fait → **fait autrement**. Le critère demande un dialogue « utilisé par les quatre écrans » ; `BulkBarcodeDialog` garde son propre sélecteur, ce que permet la décision « Dialogue de statut partagé (UI-13) » ; même raisonnement que la ligne R5-M6c, que l’auditeur avait déjà mise en « fait autrement ».
- UI-17 Trouvé 4 (aide d’`ImagePicker`) : fait → **pas fait**. L’auditeur s’appuyait sur `ImagePicker.svelte:85` et `FormField.svelte:43-48` ; le run montre qu’aucun élément ne référence l’aide, car `FormField` saute les `input type="file"` et les boutons (`FormField.svelte:36-39`) (`$V/extras/imagepicker-and-m1.txt`).
- UI-20 Trouvé 2 (bleu sombre à 4,50008:1) : fait autrement → **pas fait**. Aucune décision derrière « couleur inchangée par choix d’UI-20 » ; la couleur est conforme (4,50:1 mesuré) mais rien n’a été fait.
- UI-20 Trouvé 4 (étape e2e après l’ouverture d’un Select) : fait autrement → **fait**. Aucune décision derrière ; les parcours attendent l’option en surbrillance avant de choisir (`e2e/backup.spec.ts:25-28`) et passent.
- Les 8 « non vérifié » de l’auditeur, verdict non permis, reçoivent un verdict prouvé, tous **pas fait** : UI-15 Trouvé 2 (`$V/i18n-counts.txt`), 3 (`$V/i18n-probe.txt`), 4 (`import-problems.ts:45`), 7 (`json-import.ts:94-98`), 10 (aucun test) ; UI-16 Trouvé 1 (`$V/themes/input-border.txt`), 3 (Chromium seul) ; UI-17 Trouvé 3 (`$V/extras/ui17-toasts-stack.png`).

Constats :
- V5-m1 à V5-m6 : confirmés, sévérité Mineur gardée, « Régression : non » vérifié au commit `9df0d08c` (`$V/regression-history.txt`).
- V5-m2 : mesures refaites en anglais et à 1024 px (non touché).
- V5-m5 : rendu réel capturé pendant un envoi lent (l’auditeur n’avait que le code) ; même défaut repéré hors axe dans `statistics/+page.svelte:27-29`, mis en renvoi.
- V5-m6 : étendu à 1024 px (100 titres sur 100 coupés).
- V5-m7 : **ajouté par le vérificateur**.
- Preuves corrigées : UI-10/Trouvé-5b et 15b gardent « fait », mais V5-m6 montre que le nom, lui, est coupé ; SEC-04 rejoué avec un compte exact (le premier `grep` de `$V/sec04-replay.txt` comptait aussi le texte échappé, la note qui suit le corrige).

## 6. Désaccords

Aucun désaccord restant avec l’auditeur : chaque divergence est tranchée par une preuve (section 5).

Point d’interprétation laissé au mainteneur, sans désaccord : le critère d’UI-14 dit « `/wines` pèse au moins deux fois moins ». Mesuré sur `__data.json` (choix du coordinateur, inscrit dans le « Fait en P9 »), il est atteint (2,39×) ; mesuré sur le HTML de la page, il ne l’est pas (1,69× selon la tâche). L’auditeur et le vérificateur notent le critère « fait » et gardent le reste dans a5 m22 (partiel).

## 7. Renvois

- Axe 6 : `src/routes/statistics/+page.svelte:27-29` coupe les noms des barres par `'...'` au lieu de « … » (même nature que V5-m5) ; preuve : lecture du code à `cf48032d`.
- Axe 4 : une erreur dans une page de données de l’admin garde la navigation de l’admin mais perd les liens des tables (`/admin/data/nope`, `$V/ssr-checks.txt`) ; c’est UI-17/Trouvé-5.
- Axe 4 : UI-15/Trouvé-4, 7 et 10 (« ; » entre problèmes d’import, table brute dans `invalid_row`, `UpgradeBanner` sans test) touchent l’admin ; verdicts donnés ici, à fusionner si l’axe 4 les a aussi.
- Axe 1 : réparation des prix négatifs déjà en base (migration d’API-09) non vérifiée ici.
- Information pour le lead : le checkout principal est sur `develop` à `abbb2f25` pendant la revue ; les worktrees de revue restent sur `cf48032d` (`$V/worktree-list-after.txt`).

Serveurs et worktree : `node server.js` port 4555 (PID 72269) et port 4556 (PID 74328, base cassée exprès) arrêtés, absents après vérification par PID (`$V/run/stopped.txt`) ; worktree `$S/p12/wt-v5` supprimé par `git worktree remove --force`, absent de `git worktree list` (`$V/worktree-list-after.txt`) ; aucun fichier suivi modifié, aucun commit ; données de test seulement sous `$V/run/`.
