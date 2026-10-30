# Revue de code : frontend d'administration

## 1. Résumé

La page `src/routes/admin/+page.svelte` (1749 lignes) n'est plus un monolithe d'interface : le HTML a été extrait dans 39 composants. En revanche, elle reste le contrôleur de toute l'administration : environ 45 `$state` locaux, une centaine de props transmises à chaque niveau, 8 copies de la logique de suppression. Le découpage s'est arrêté à mi-chemin. Il a laissé environ 1500 lignes de services et de stores morts, trois sources d'état concurrentes et plusieurs bugs fonctionnels confirmés (suppression d'images cassée, édition des formats, recherche d'images non propagée). `svelte-check` passe sans erreur, mais surtout parce que le périmètre contient 213 `any`.

## 2. Ce qui va bien

- **Svelte 5 dans les composants** : `$props`, `$bindable`, `$derived` sont utilisés partout. Le filtrage et la pagination des tabs sont en `$derived` (`WineTab.svelte:72-97`).
- **Composants autonomes** : chaque dialogue gère son propre appel API et son état de chargement local (`BackupNamingDialog.svelte:21-68`).
- **Bonne UX sur les opérations destructives** : une sauvegarde de sécurité est téléchargée avant un wipe ou une restauration (`DatabaseWipeConfirmDialog.svelte:46-49`). La suppression d'un vin qui a des bouteilles déclenche une confirmation de cascade (`+page.svelte:997-1020`). Les erreurs 409 « en cours d'utilisation » s'affichent en ligne sous l'élément.
- **i18n globalement en place** : `svelte-i18n` est utilisé dans la grande majorité des libellés et des toasts.
- **Primitives UI cohérentes** (shadcn/bits-ui), et les mises à jour des stores sont immuables.

## 3. Problèmes

### Critique

**C1. Le contrôle d'accès admin est purement décoratif.** `+page.svelte:199-240` → `src/lib/stores/auth.ts`
- Problème : la garde se contente de lire `sessionStorage['wine-cellar-authenticated'] === 'true'`. `src/hooks.server.ts` n'exporte aucun `handle`, et aucune route `/api/admin/*` ne vérifie de session (grep : seule `auto-backup` mentionne l'auth).
- Pourquoi c'est grave : n'importe qui peut taper `sessionStorage.setItem(...)` dans la console, ou appeler directement `/api/admin/wipe-database`.
- Correction : session côté serveur (cookie httpOnly signé) vérifiée dans `hooks.server.ts` pour `/admin` et `/api/admin`, plus un `+layout.server.ts` qui redirige. La partie API sort de mon périmètre, mais la garde frontend ne peut pas compenser son absence.

### Majeur

**M1. La suppression d'images est cassée.**
- `ImageDeleteDialog.svelte:33-41` envoie `{ imageIds: [...] }`.
- `api/admin/images/+server.ts:160-164` attend `imageId` et répond 400 « Image ID is required ».
- La version qui fonctionnait, avec boucle et `force`, est `confirmDeleteImages` dans `+page.svelte:480-562`. Ce code est mort : seul un appel récursif le référence.
- Correction : faire boucler le dialogue sur `imageId`, ou accepter un tableau côté API, et réintégrer le flux `force` de la page.

**M2. La recherche d'images ne remonte jamais au store, avec un risque de perte de données.**
- Dans `DataManagementTabs.svelte:44-45`, `imageSearchQuery` et `selectedImages` ne sont pas `$bindable`. Le `bind:` des lignes 394-395 ne modifie donc qu'une copie locale.
- `exportAllImages` (`+page.svelte:304-306`) et `AdminService.toggleSelectAll` (`adminService.ts:46-65`) lisent `$uiState.imageSearchQuery`, qui vaut toujours `''`.
- Conséquence : « Exporter » exporte toutes les images, et « Tout sélectionner » sélectionne aussi les images masquées par le filtre. Une fois M1 corrigé, « Supprimer la sélection » supprimerait des images invisibles à l'écran.
- Correction : passer par `uiActions.setImageSearchQuery` et `setSelectedImages`, qui existent déjà mais ne sont jamais appelées, ou marquer les props `$bindable`. À corriger dans la même PR que M1.

**M3. L'édition d'un format ouvre un champ vide.**
- `WineFormatDialog.svelte:26` lit `editingFormat.format`, alors que l'entité expose `name` (l'API et `BottleTab.svelte:118` utilisent `name`).
- Le bouton « Enregistrer » reste désactivé tant que l'utilisateur n'a pas retapé le nom.
- Correction : lire `editingFormat.name`.

**M4. Trois sources d'état concurrentes, dont deux en grande partie mortes.**
- Les `writable` (`uiStateStore`, `formDataStore`, `entityDataStore`, `loadingStateStore`) coexistent avec environ 45 `$state` dans la page, qui dupliquent des stores existants mais inutilisés :
  - les flags `show*Dialog` dupliquent `dialogStateStore` ;
  - les `*Errors` dupliquent `errorStateStore` ;
  - `barcodeSettings` et `backupSettings` dupliquent les champs de `formDataStore`, avec une forme différente (`maxBackups` d'un côté, `autoBackupKeepCount` de l'autre).
- `UiState` (`uiStateStore.ts:6`) et `UIState` (`stores/admin/types.ts:8`) décrivent des filtres différents.
- Les flags `isCreatingBackup`, `isRestoringDatabase`, `isWipingDatabase`, `isImportingJson` et `isCreatingExport` ne sont jamais passés à `true` (0 appel à leurs setters). Les indicateurs de `BackupRestoreSection.svelte:69,159` n'apparaissent donc jamais.
- Correction : voir la section 4, une seule source d'état en runes.

**M5. La couche services est contournée et en partie morte.**
- Le périmètre contient 93 `fetch(`, dont 46 dans la page et les composants.
- Seul `AdminService` est importé. Il reçoit les stores en paramètre `any` (`adminService.ts:12,33,46,70`) : c'est un sac de fonctions, pas un service.
- Jamais importés : `entityService.ts` (367 l.), `imageService.ts` (262), `wineEntityService.ts` (183), `geographyService.ts` (119), `wineDataService.ts` (115), `services/admin/index.ts`.
- `imageService.ts` appelle des endpoints qui n'existent pas : `/api/admin/export-all-images` (l.123), `/api/admin/images/upload` (l.164), `/api/admin/images/import-zip` (l.210).
- Correction : supprimer ces fichiers et créer un vrai client API (section 4).

**M6. Suppression copiée-collée 8 fois.**
- `performDeleteType`, `performDeleteColor`… `performDeleteAppellation` (`+page.svelte:595-975`) : environ 380 lignes identiques au nom près, `setTimeout` de nettoyage de l'erreur en ligne compris.
- Une même logique existe aussi dans `entityService.ts` (mort) et dans `AdminService.performDeleteType` (mort).
- Correction : une fonction générique `deleteEntity(config, id)`.

**M7. Échecs de chargement silencieux.**
- `entityDataStore.ts:97-99` (et les 9 blocs suivants) avale l'erreur dans un `console.error`.
- L'utilisateur voit « No wine types found » au lieu d'un message d'erreur. Les versions avec toast se trouvent dans les services morts.
- Correction : toast et état `error` par collection.

**M8. 34 clés i18n absentes de `en.json` et `fr.json`** (vérifié par script).
- Les 8 clés `toast.error_saving_*` utilisées par tous les dialogues d'entité, par exemple `WineTypeDialog.svelte:58,61`.
- `admin.clear` (`WineDefinitionsTab.svelte:134`), `admin.warning_replace_database` (`DatabaseRestoreConfirmDialog.svelte:97`), `toast.images_deleted_successfully` (`ImageDeleteDialog.svelte:57`), etc.
- `svelte-i18n` affiche alors la clé brute à l'utilisateur.
- Correction : ajouter les clés, puis un test CI qui compare les clés utilisées à celles des JSON.

### Mineur

- **m1. Chaînes en dur** :
  - 13 états vides du type « No X match your search » (`WineTab.svelte:161,255,349`, `GeographyTab.svelte:164,261,358`…) ;
  - `formatBackupType` (`formatters.ts:28-44`) et `formatFileSize` (« Bytes ») ;
  - `DeleteBackupConfirmDialog.svelte:91` et `BarcodeSettingsDialog.svelte:57` ;
  - `+page.svelte:509,538,541` et le `<title>` « My Wine Cellar » (l.1465) ;
  - les messages d'erreur 409 renvoyés par l'API, en anglais, sont affichés tels quels.
- **m2. Typage** : 213 `any` et 7 `as any` (`+page.svelte:164,1554-1557`). Les props de `AdminDialogs` et `DataManagementTabs` sont typées `any`. `formActions.setEditingEntity` construit la clé par template string (`formDataStore.ts:157`).
- **m3. Prop drilling** : `DataManagementTabs` reçoit environ 100 props, `AdminDialogs` environ 75. Toute la logique remonte et redescend à travers 3 niveaux.
- **m4. Décombres de commentaires** : `+page.svelte:1613-1671` (une trentaine de commentaires « Extracted to X »), plus une vingtaine de « removed - unused » et « moved to ».
- **m5. Logs de debug** : 17 `console.log`, dont un dump des résultats d'import CSV avec emojis (`+page.svelte:1226-1278`), et 131 `console.*` au total.
- **m6. Double toast « accès refusé »** : `onMount` (l.222-225) et le `$effect` (l.199-213) se déclenchent tous les deux après `authInitialized = true`.
- **m7. Accessibilité** :
  - 0 `aria-label` dans le périmètre ;
  - boutons à icône seule sans libellé : Edit et Trash (`WineTab.svelte:143-148` et équivalents), bouton d'effacement de la recherche (`WineTab.svelte:124-129`, `<button>` sans `type` ni label) ;
  - `confirm()` natif (`+page.svelte:541`, code mort).
- **m8. Performance et réactivité** :
  - `BackupManagementSection.svelte:74,89,101` appelle 3 fois par rendu une fonction de filtrage au lieu d'un `$derived` ;
  - 21 des 30 `{#each}` ne sont pas keyés ;
  - tout est chargé côté client dans `onMount`, sans fonction `load`.
- **m9. Divers** :
  - `lucide-svelte` et `@lucide/svelte` sont tous deux dans `package.json` ;
  - titre de dialogue concaténé et au pluriel (« Edit Wine Types », `WineTypeDialog.svelte:69`) ;
  - `wineBottleErrors` n'est jamais alimenté ;
  - le bouton « Retour » fait `history.back()`.
- **m10. Utilitaires morts** :
  - `imageHelpers.ts`, `searchHelpers.ts` ;
  - `loadImages`, `loadBackupFiles`, `loadBarcodeSettings`, `loadBackupSettings`, `loadSessionTimeout` et `loadAllBasicData` dans `api.ts` ;
  - `DialogStates` et `LoadingStates` dans `utils/admin/types.ts` ;
  - `entityActions.loadAllData` fait doublon avec `AdminService.loadAllData`.

## 4. Refactoring structurel proposé

**Architecture cible**

```
src/routes/admin/
  +layout.server.ts        ← garde de session serveur
  +layout.svelte           ← navigation (onglets = liens)
  settings/+page.svelte
  backups/+page.svelte (+page.ts load)
  data/[entity]/+page.svelte (+page.ts load)
  images/+page.svelte
src/lib/admin/
  api/client.ts            ← request<T>(), ApiError {status, inUse, message}, downloadBlob()
  entities.config.ts       ← registre déclaratif des 8 entités simples
  state/collection.svelte.ts ← class EntityCollection<T> (runes)
  components/EntityListPanel.svelte, EntityFormDialog.svelte, ConfirmHost.svelte
```

**Les briques**

- **Routes au lieu d'onglets.** L'état de navigation passe dans l'URL : on peut créer des liens directs vers une section, et chaque page ne charge que ses propres données. Cela supprime la page de 1749 lignes et le prop drilling.
- **Un client API unique et typé.** Il centralise le parsing JSON, les erreurs (409 `inUse`) et le téléchargement de blobs, aujourd'hui dupliqué 3 fois (`+page.svelte:267-275`, `335-343`, `1333-1347`). Les types des entités viennent de Drizzle (`InferSelectModel`) et non plus de `utils/admin/types.ts`.
- **Un état en runes à la place des `writable`.** Classe `EntityCollection<T>` avec `items`, `loading` et `errors` en `$state`, plus `filtered` et `paged` en `$derived`, et les méthodes `load()`, `save()`, `remove()`. Elle est instanciée par entité via `setContext`, pour éviter l'état module partagé.
- **Composants génériques pilotés par configuration.** Par exemple : `{ key:'wineTypes', endpoint:'/api/admin/wine-types', labelField:'type', fields:[{name:'type', kind:'text'}], reloadAfterDelete:['wineTypes'] }`.
  - `EntityListPanel` remplace les 13 blocs recherche, liste, pagination et erreur dupliqués dans les 4 tabs.
  - `EntityFormDialog` remplace 8 dialogues de 90 à 115 lignes. Region et Appellation ne demandent qu'un champ `select` en plus.
  - WineDefinitions et WineBottles gardent des composants dédiés (filtres spécifiques).
- **Confirmation en promesse.** `if (await confirm({ message })) …` remplace le trio `formDataStore.confirmAction`, `showConfirmDialog` et `AdminService.showConfirmation`.

**Étapes**, chacune livrable seule :

1. Quick wins (section 5) et suppression du code mort.
2. Client API, puis migration des `fetch` des dialogues.
3. `EntityCollection`, `EntityListPanel` et `EntityFormDialog` sur une entité pilote (wine-types), puis les 7 autres.
4. Découpage en routes, en supprimant au fur et à mesure `AdminDialogs`, `DataManagementTabs` et les stores `writable`.
5. Backups et images en dernier : ils ont le plus de logique spécifique.

## 5. Quick wins

1. Réparer la suppression d'images (M1) et la propagation de la recherche et de la sélection (M2), ensemble.
2. `WineFormatDialog.svelte:26` : remplacer `.format` par `.name` (M3).
3. Ajouter les 34 clés i18n manquantes (M8).
4. Supprimer les 5 services morts, `dialogStateStore`, `errorStateStore`, `stores/admin/types.ts`, `imageHelpers`, `searchHelpers` et `confirmDeleteImages` : environ 1600 lignes en moins, sans impact fonctionnel.
5. Supprimer le dump `console.log` du CSV (`+page.svelte:1226-1278`) et les commentaires « Extracted to ».
6. Ajouter un toast d'erreur dans les `load*` de `entityDataStore.ts`.
7. Ajouter un `aria-label` (traduit) aux boutons à icône seule.
8. Supprimer le `$effect` d'auth redondant (m6) et l'un des deux packages lucide.

Note hors périmètre, pour la personne qui fait la revue de l'API : C1 dépend entièrement de l'absence de `handle` dans `src/hooks.server.ts`.

**Recommandation : REQUEST CHANGES** (1 Critique, 8 Majeurs).
