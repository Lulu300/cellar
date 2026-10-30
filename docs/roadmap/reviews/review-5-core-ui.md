# Revue : UI principale de gestion des vins

Périmètre : `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/wines/`, `src/lib/components/{WineListView,WineDefinitionDialog,WineBottleDialog,BottleDetailsDialog,AllBottlesDialog,WineRegistrationForm}.svelte`, `src/lib/types.ts`, `src/lib/mockData.ts`. Revue en lecture seule.

**Verdict : changements demandés** (1 critique, 7 majeurs, plusieurs mineurs).

## 1. Résumé

Le périmètre fait environ 6 000 lignes réparties dans 7 fichiers, et chacun mélange appels réseau, cache des listes de référence, règles métier, formulaire et affichage. Aucun composant n'utilise les runes : tous sont en syntaxe Svelte 4 (`export let`, `$:`, `createEventDispatcher`), seul `+layout.svelte` utilise `$state`. Il n'y a pas de load function utile. `types.ts` ne correspond plus au schéma Drizzle, ce qui explique les environ 115 `any` du périmètre. svelte-check sort 0 erreur, mais seulement parce que tout est typé `any`. J'ai trouvé une faille XSS stockée, un formulaire qui s'efface pendant la saisie, un tri qui n'est branché à aucun contrôle, et beaucoup de code dupliqué.

## 2. Ce qui va bien

- **i18n en place.** svelte-i18n est configuré en/fr et la grande majorité des libellés passent par `$_()`. L'attribut `lang` du document suit la langue choisie (`+layout.svelte:22`).
- **Composants partagés.** Les composants UI shadcn/bits-ui (Dialog, Select, Table, Card) donnent une base correcte aux dialogs. `SearchableSelect` est déjà partagé par tous les formulaires.
- **Bons réflexes UX** :
  - protection contre le double envoi (`isSubmitting`) ;
  - bouton « Save & add another » ;
  - contrôle de la capacité du casier avant l'envoi (`WineBottleDialog.svelte:458-468`) ;
  - l'erreur `BARCODE_ALREADY_EXISTS` s'affiche sur le champ concerné (l.541).
- **États de chargement et pagination.** `AllBottlesDialog` gère le chargement, les erreurs et la pagination (l.399-406).
- **Un modèle existe déjà dans le projet.** La partie admin a été découpée en `services/admin`, `stores/admin` et `utils/admin/formatters.ts`. superforms, formsnap, zod et les composants `ui/form` sont installés, mais aucun formulaire de vin ne s'en sert.

## 3. Problèmes

### Critique

**C1. XSS stockée via le champ « site web »**
- **Où :** `src/routes/wines/[id]/+page.svelte:477`.
- **Problème :** la page affiche `href={wineDefinition.website}` sans vérifier le schéma de l'URL. Côté client, la seule validation est `type="url"` (`WineDefinitionDialog.svelte:1157`), qui accepte `javascript:alert(1)`. Côté serveur, `POST /api/definitions` passe le corps tel quel à `createWineDefinition`.
- **Pourquoi c'est critique :** le `handle` de `hooks.server.ts:335` ne vérifie aucune authentification. Le `$auth.isAuthenticated` de l'UI n'est qu'un drapeau en sessionStorage. Toute personne qui atteint l'API peut donc enregistrer un lien qui exécute du JS quand un visiteur clique dessus.
- **Correction :** n'accepter que `http`/`https`, avec un helper `safeUrl()` à l'affichage et un schéma zod dans l'API. Ajouter `rel="noopener noreferrer"`. L'authentification côté serveur est à traiter dans la revue de l'API.

### Majeur

**M1. Le formulaire de définition s'efface pendant la saisie**
- **Où :** `WineDefinitionDialog.svelte:442-468`.
- **Mécanisme :** le bloc `$: if (open)` lit `appellations`, donc il se relance chaque fois que cette variable est réassignée. Or `loadAppellations()` la réassigne (l.624) dès qu'on choisit une région (l.569-571).
- **Effet en création :** `resetForm()` vide nom, producteur, pays et région. Cela tombe précisément sur le parcours « pays → région → créer une appellation ».
- **Effet en édition :** `populateFormData()` réécrit les valeurs du serveur par-dessus la saisie.
- **Autre défaut :** les blocs l.256 et l.450 lancent chacun `loadFullDefinition()` à l'ouverture, d'où deux requêtes concurrentes. Les `setTimeout` de 100 à 200 ms (l.344, 349, 434, 531, 826, 833) servent à masquer ces courses.
- **Vérification :** j'ai déduit ce comportement du graphe de dépendances des `$:`, sans l'exécuter. Il faut le reproduire avant de corriger.
- **Correction :** initialiser le formulaire dans `onOpenChange` ou dans un `$effect` qui ne dépend que de `open`/`editDefinition`. Dériver les listes en cascade avec `$derived` et supprimer les appels impératifs `updateDisplayValue()`/`reset()` via `bind:this`.

**M2. Le tri de la liste n'est branché à aucun contrôle**
- **Où :** `WineListView.svelte:504`. `toggleSort` n'est appelé nulle part, pas plus que `getVintageDisplay` et `getOptimumDisplay` (l.314, 322). La liste est donc toujours triée par nom.
- **Problème de fond :** les éléments triés sont des groupes, car l'API renvoie `{...firstBottle, bottles}` par définition (`api/wines/+server.ts:79-85`). Un tri par millésime ou par prix ne regarderait que la première bouteille de chaque groupe.
- **Correction :** soit supprimer le tri, soit l'exposer sur des valeurs agrégées (plage de millésimes, prix moyen).

**M3. Les types ne correspondent plus au schéma**
- **Champs divergents :** `types.ts` déclare `classification`, `type`, `format: WineFormat` (une enum), alors que le schéma utilise `classificationId`, `typeId`, `formatId` (`schema.ts:51-53, 129`). `targetQuantity` n'existe pas dans `types.ts`.
- **Collision de noms :** `WineType` est une enum dans `types.ts` et un type de ligne dans `schema.ts`.
- **Mauvais type pour la liste :** `WineListView` déclare ses données en `WineBottleWithDefinition[]` alors que ce sont des groupes par définition. D'où 48 `any` dans ce seul fichier.
- **Badges :** les enums colorent encore les badges (`WineListView:602-634`, `[id]:200-232`), alors que types et couleurs sont des tables modifiables. Tout type créé par l'utilisateur s'affiche en gris.
- **Id ou nom selon le cas :** en édition, `formData.type` reçoit un nom (l.415) alors que le select attend un id (`valueField="id"`). Même chose pour `format` (`WineBottleDialog:129`). Ça fonctionne uniquement parce que le serveur essaie l'id puis fait un « get-or-create » par nom (`services.ts:407-417`).
- **Correction :**
  - types de domaine dérivés du schéma (`$inferSelect`) ;
  - DTO explicites par endpoint (`WineGroupDTO`, `BottleDTO`) ;
  - n'envoyer que des ids ;
  - supprimer les enums Type/Color/Format ;
  - couleurs de badge via une table de correspondance avec une valeur de repli.

**M4. Tout est chargé côté client, et beaucoup trop**
- **Pas de load functions :** il n'y a aucun `+page.server.ts` ni `+layout.ts`. `wines/[id]/+page.ts` ne renvoie que `params.id`. Tout passe par `onMount`, donc le rendu serveur produit une page vide. `src/routes/+page.svelte` redirige avec `goto` dans `onMount` au lieu d'un `redirect(307)` côté serveur.
- **Page détail :** `/wines/[id]` (l.159-175) télécharge `/api/wines`, c'est-à-dire toutes les définitions et toutes les bouteilles, consommées comprises, pour n'en garder qu'une.
- **Images :** `/api/admin/images` est appelé par la liste, la page détail et `WineDefinitionDialog` (deux fois, l.150 et 207), uniquement pour traduire `imageId` en URL.
- **Référentiels :** chaque composant recharge lui-même ses listes. Par exemple, `/api/origins` est appelé à 7 endroits.
- **Rafraîchissement :** il passe par `bind:this` + `wineListView.loadWines()`.
- **Correction :**
  - load functions serveur qui appellent directement les services Drizzle ;
  - une requête dédiée aux bouteilles d'une définition ;
  - URL d'image jointe côté serveur ;
  - référentiels chargés une seule fois (`+layout.server.ts` ou un cache partagé) ;
  - `depends('app:wines')` + `invalidate()` à la place des appels via `bind:this`.

**M5. Mises à jour groupées non atomiques**
- **Où :** `BottleDetailsDialog.svelte:184-211` et `320-341`, même logique dans `[id]/+page.svelte:324-341`.
- **Problème :** le code envoie N `PUT` en parallèle avec `{...bottle, …}`. Chaque requête renvoie l'objet complet tiré de la liste, qui peut être périmé, et le `PUT` écrase toutes les colonnes. Si une requête échoue, une partie des bouteilles est modifiée et l'autre non.
- **Correction :** un `PATCH /api/bottles` qui prend `{ids, champs}`, exécuté dans une transaction, et n'envoyer que les champs modifiés.

**M6. Duplication massive**
- **Envoi des formulaires :** `handleSubmit` et `handleSaveAndAddAnother` font environ 100 lignes presque identiques (`WineBottleDialog:473-575` / `577-680`). Même cas dans `WineDefinitionDialog:846-908` / `910-964`.
- **Réinitialisation :** trois copies quasi identiques de la remise à zéro de `formData` (`WineBottleDialog:104-162`, `682-750`).
- **Dialog de changement de statut, écrit deux fois avec des comportements différents :**
  - `BottleDetailsDialog:676-744` utilise un Select bits-ui ;
  - `[id]:840-886` utilise un `<select>` natif avec une astuce pour le mode sombre (l.92).
- **Tableaux de bouteilles :** `BottleDetailsDialog:516-668` et `AllBottlesDialog:408-576` ont les mêmes colonnes, le même tri et les mêmes `getAvailability*`.
- **Helpers copiés de 2 à 4 fois :** `formatDate`, `formatCurrency`, `getTypeColor`, `getColorColor`, `renderStars`, `loadImageUrls`.
- **Calcul « bouteilles non consommées » :** répété 4 fois dans `WineListView` (l.126, 348, 414, 655).
- **Cartes de bouteilles :** disponibles et consommées sont dupliquées dans `[id]` (566-679 / 709-789).

**M7. Code mort**
- `WineRegistrationForm.svelte` (647 lignes) n'est importé nulle part et vise un ancien contrat de `/api/wines`.
- `mockData.ts` ne sert qu'à `scripts/db-setup.ts --seed` et maintient en vie les types obsolètes. Il faut le déplacer dans `scripts/fixtures/`.

### Mineur

**Syntaxe et dépendances**
- Mélange de syntaxes d'événements : `wines/+page.svelte` combine `on:definitionSaved` et `onclick`, `[id]` combine `on:click` (l.449, 594…) et `onclick`.
- Deux paquets d'icônes coexistent : `lucide-svelte` et `@lucide/svelte`.

**Erreurs et états de chargement**
- Erreurs silencieuses : `[id]:358-361` (« You could show a toast here »), `WineListView:189-192`.
- La liste n'a ni état de chargement ni état d'erreur. Pendant le chargement, elle affiche « aucun vin » (l.1188).
- 21 `console.*` dans `WineBottleDialog`, dont des données de l'application en production (l.184, 228, 320, 357).

**Bugs mineurs**
- `WineBottleDialog:288` : la liste des définitions n'est mise à jour que si leur nombre change. Un renommage n'apparaît pas.
- La recherche par code-barres (`WineListView:529-537`) inclut les bouteilles consommées, mais `BottleDetailsDialog` les masque (l.70). La sélection automatique pointe alors sur une ligne invisible : « 1 sélectionnée », et l'action ne fait rien.
- Formats incohérents : `formatCurrency` est forcé en `en-US` dans la liste (l.637) alors qu'ailleurs il suit la langue.
- La date du jour est calculée en UTC (`toISOString().split('T')[0]`, `BottleDetailsDialog:169`, `[id]:310`). En France, entre 0 h et 2 h, elle donne la veille.
- La note se saisit par pas de 0,5 (`WineDefinitionDialog:1165`) mais la colonne est un `integer` (`schema.ts:54`), et `"★".repeat(4.5)` tronque.
- Les filtres région et pays comparent des noms (`WineListView:386, 393`) alors que les autres filtres comparent des ids. Deux régions de même nom dans deux pays différents se confondent.

**i18n : chaînes encore en dur**
- `WineListView` : « No Image » (l.1061).
- `BottleDetailsDialog` : `getAvailabilityLabel` (l.405-416), « No non-consumed bottles found » (l.663).
- `WineBottleDialog` : l.431, 453, 462-466, 571, 928, 969.
- `WineDefinitionDialog` : l.231, 904, 1059, 1217, 1266, 1281, 1298.
- `[id]` : titre de page (l.409) ; `requireAuth` (l.399) est inutilisé.

**Accessibilité**
- **Modal de connexion :** fait main (`+layout:211-262`), sans `role="dialog"`, `aria-modal`, piège de focus ni fermeture par Échap, alors que `Dialog` est importé sans être utilisé (l.8, comme Badge, Input et Label). `onkeypress` est déprécié (l.234).
- **En-têtes triables :** ce sont des `TableHead onclick` non focusables et sans `aria-sort` (`BottleDetailsDialog:527-598`, `AllBottlesDialog:412-492`).
- **Boutons icône sans `aria-label` :** `[id]:447`, `621-634`, et le « × » de `WineDefinitionDialog:1207`.
- **Interrupteur « images » :** il n'a ni `role="switch"` ni `aria-checked` (`WineListView:1021`).
- **Boutons dans un lien :** les cartes contiennent des boutons dans un `<a>` (`WineListView:1042-1141`), ce qui est du HTML invalide contourné par `preventDefault`.
- **Navigation :** 9 liens sans menu mobile.

**Performance**
- À chaque frappe, sans délai d'attente, la liste refiltre et retrie toute la cave côté client (l.694-705). `getImageUrl()` est appelé deux fois par carte et `formatPriceRange` est recalculé à chaque rendu.
- C'est acceptable pour quelques centaines de vins, mais la réponse de `/api/wines` grossit avec l'historique des bouteilles consommées.

## 4. Refactoring proposé

**Structure cible** : un dossier par fonctionnalité, sur le modèle de la partie admin.

```
src/lib/features/wines/
  model/      dto.ts (dérivé du schéma), bottle.ts (isInCellar, countInCellar,
              priceStats, vintageRange : fonctions pures testables), badges.ts
  format.ts   formatDate/formatCurrency/formatTodayISO selon la langue
  state/      referenceData.svelte.ts (cache des référentiels en runes),
              filters.svelte.ts (filtres synchronisés avec l'URL)
  components/
    list/       WineFilters, WineGrid, WineCard, BarcodeSearch
    definition/ WineDefinitionForm, LocationPicker (pays→région→appellation), ImagePicker
    bottle/     WineBottleForm, StorageCasePicker (capacité), BottleTable (partagé par
                BottleDetails et AllBottles), BottleStatusDialog, MoveBottlesDialog, BottleCard
routes/wines/+page.server.ts, routes/wines/[id]/+page.server.ts (load + form actions)
```

**Étapes, chacune livrable seule :**
1. **Nettoyage sans risque :** supprimer le code mort (M7), déplacer `mockData.ts`, centraliser `format.ts`, `badges.ts` et `bottle.ts`, garder un seul paquet d'icônes.
2. **Types :** écrire les DTO dérivés du schéma, remplacer les `any` aux frontières, retirer les enums.
3. **Chargement des données :** créer `+page.server.ts` pour `/wines` et `/wines/[id]` (requête dédiée par définition, URL d'image jointe). Remplacer les `bind:this`/`loadWines()` par `invalidate`. Rediriger `/` côté serveur.
4. **Formulaires :** extraire `LocationPicker` et `StorageCasePicker`, puis réécrire les deux formulaires en runes avec superforms et zod (déjà installés) et des form actions. Cela règle M1, réunit les deux fonctions d'envoi en une seule et apporte la validation côté serveur (C1).
5. **Bouteilles :** extraire `BottleTable`, `BottleStatusDialog` et `MoveBottlesDialog`, et ajouter l'endpoint `PATCH` groupé (M5).
6. **Liste :** découper `WineListView`, exposer un vrai tri sur des agrégats, appliquer un délai d'attente à la recherche. Plus tard, déplacer le filtrage côté serveur si la cave grossit.
7. **Fin de la migration :** passer les derniers composants en runes et compléter l'i18n et l'accessibilité.

## 5. Quick wins

- `safeUrl()` sur `href={website}` + `rel="noopener noreferrer"` (C1) : 5 minutes.
- Supprimer `WineRegistrationForm.svelte`, `toggleSort`/`getVintageDisplay`/`getOptimumDisplay`, les drapeaux `*Loaded` jamais lus et les imports inutilisés du layout.
- Retirer `appellations` et `isLoadingAllAppellations` des dépendances du bloc `$: if (open)` (M1), par exemple en déplaçant le préchargement dans `onMount`.
- Sur `/wines/[id]`, filtrer côté serveur au lieu de télécharger toute la cave.
- Un module `format.ts` unique (date et devise selon la langue, date du jour locale).
- Toast d'erreur dans `[id]:358` ; état de chargement et d'erreur dans `WineListView`.
- Traduire `getAvailabilityLabel` et les autres chaînes en dur listées en §3.
- Login : remplacer le modal fait main par le `Dialog` déjà importé.
- Supprimer les `console.log` de `WineBottleDialog`.
