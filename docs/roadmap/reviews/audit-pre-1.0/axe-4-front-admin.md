# Audit d'avant 1.0, axe 4 : front d'administration

Commit audité `9df0d08c` (develop, 2026-10-16). Périmètre : `src/routes/admin/**`, `src/lib/components/admin/**`, `src/lib/api/client.ts` et leurs tests. Méthode : lecture du code, puis l'app lancée depuis une worktree détachée avec des données inventées (pays « Zland n », vins « Test Wine n », images de test, actions de mise à jour 0.2.0 écrites dans `app_settings`), pilotée par curl et par un Chromium headless en CDP. Chaque constat a été revu par un second agent, qui l'a rejoué dans sa propre worktree pour tenter de le réfuter. Les trois points signalés par d'autres axes ont été vérifiés par le rédacteur, par lecture du code.

## 1. Résumé

Le front d'administration n'a plus rien de la page de 1749 lignes relevée par la revue 4. Il est découpé en routes chargées sur le serveur, avec un seul client API, une collection générique et une confirmation en promesse. Les sept Majeurs de la revue 4 dans ce périmètre sont corrigés, comme les critères de BUG-02, BUG-03, BUG-12 et UI-07. Sur 65 lignes de traçabilité, 51 sont corrigées. Les points ouverts portent sur l'import CSV (essai à blanc absent, logique de tables recopiée côté client), l'aller-retour de la restauration par le navigateur (traité en Majeur à l'axe 3), le tri de l'historique, qui reste à trancher, et six `{#each}` sans clé. La passe 2 ne trouve aucun Critique ni Majeur, mais neuf Mineurs. Les deux plus gênants : une confirmation de suppression qui survit à la navigation et s'exécute depuis une autre page (m1), et l'option « remplacer tous les codes-barres » restée cochée d'un import CSV au suivant (m3).

## 2. Traçabilité (passe 1)

65 lignes : 51 Corrigé, 2 Partiel, 10 Non fait, 2 Sans objet, 0 Écart décidé. Le vérificateur a confirmé tous les verdicts qu'il a contrôlés : les 14 lignes non corrigées, les 12 lignes « Corrigé » issues d'un Majeur ou d'un critère, et 14 des 39 autres. Il n'a ajouté aucune ligne. R4-C1 est traité à l'axe 2, R4-M8 et R4-m7 à l'axe 5.

### Revue 4

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| R4-M1 | Suppression d'images cassée (`imageIds` contre `imageId`), flux `force` perdu | Corrigé | `ImageDeleteDialog.svelte:61-64` envoie `{ imageIds, force }`. `DELETE /api/admin/images` à 2 ids : `force:false` → 409 `in_use` avec les vins, `force:true` → 200 `{"deleted":2,"clearedReferences":1}` ; même flux dans le navigateur |
| R4-M2 | Recherche d'images non propagée : Exporter et Tout sélectionner ignorent le filtre | Corrigé | État unique `ImageSelection` (`image-selection.svelte.ts`) ; Exporter envoie `selection.visible` (`images/+page.svelte:68-70`) ; navigateur : recherche « 2010 », Tout sélectionner → 3 images sur 5 |
| R4-M3 | Édition d'un format : champ vide | Corrigé | `EntityFormDialog.svelte:44` lit `editing?.name` ; navigateur : `#entity-name` = « 100 cl », bouton actif |
| R4-M4 | Trois sources d'état, flags `isCreating*` jamais vrais | Corrigé | `stores/admin`, `services/admin`, `utils/admin` supprimés (285c439d, aad356cb) ; aucun `svelte/store` dans l'admin ; jobs longs dans `jobs.svelte.ts` (tests `jobs.test.ts`), `BackupActions.svelte:175-177` |
| R4-M5 | Couche services contournée et morte, 93 `fetch` | Corrigé | Un seul `fetch` dans le périmètre : `src/lib/api/client.ts:55` ; grep `adminService`, `entityService` : 0 fichier |
| R4-M6 | Suppression copiée 8 fois | Corrigé | `EntityCollection.remove` (`entity-collection.svelte.ts:68-85`), utilisée par `[entity]`, `wines`, `bottles` ; test « deletes an entry, then reloads the data of the page » |
| R4-M7 | Échecs de chargement silencieux | Corrigé | `load` serveur par page ; dossier de données illisible → `/admin/backups` 500 avec le message traduit (voir m8 pour la navigation perdue) |
| R4-m1a | 13 états vides « No X match your search » en dur | Corrigé | `EntityListPanel.svelte:111` (`admin.no_match`, `admin.no_entries`), `images/+page.svelte:275-277` |
| R4-m1b | `formatBackupType` et `formatFileSize` (« Bytes ») en dur | Corrigé | `backups/backup-type.ts` (test « speaks the language of the interface ») ; `utils/format.ts:76-90` via `Intl.NumberFormat(getLocale())` |
| R4-m1c | `DeleteBackupConfirmDialog.svelte:91`, `BarcodeSettingsDialog.svelte:57` en dur | Corrigé | Premier fichier supprimé (confirmation générique, `backups/+page.svelte:102-104`) ; aucun texte anglais nu dans le balisage des 30 `.svelte` de l'admin |
| R4-m1d | Chaînes de `+page.svelte`, `<title>` « My Wine Cellar » | Corrigé | `+page.svelte` supprimé ; titre traduit `admin/+layout.svelte:20` |
| R4-m1e | Messages 409 de l'API affichés en anglais | Corrigé | `apiErrorMessage` (`utils/api-error.ts:128-149`) ; test « keeps why an entry in use cannot be deleted » |
| R4-m2 | 213 `any`, props typées `any` | Corrigé | grep `: any` / `as any` vide ; `no-explicit-any` en erreur (décision UI-03) ; `pnpm check` 0 erreur |
| R4-m3 | Prop drilling (100 et 75 props) | Corrigé | `DataManagementTabs` et `AdminDialogs` supprimés (8a21c800) ; 1 à 7 props par dialogue |
| R4-m4 | Commentaires « Extracted to » | Corrigé | grep `extracted to\|removed - unused\|moved to` vide (restent des « // Props », voir m4) |
| R4-m5 | Logs de debug | Corrigé | Aucun `console.` dans `src/lib/components/admin` ni `src/routes/admin` |
| R4-m6 | Double toast « accès refusé » | Sans objet | Garde client supprimée : `admin/+layout.server.ts:6` redirige sans session (`session.ts:79-82`) ; grep `access_denied` vide |
| R4-m8a | Filtrage appelé 3 fois par rendu | Corrigé | `BackupList.svelte:38-40` en `$derived` |
| R4-m8b | 21 `{#each}` sur 30 sans clé | Partiel | Restent 6 sur 19, signalés par ESLint : `CsvImportDialog.svelte:120,197`, `CsvImportResultsDialog.svelte:89,159,230`, `ZipImportResultsDialog.svelte:83` |
| R4-m8c | Tout chargé dans `onMount` | Corrigé | `load` serveur pour settings, backups, images, `data/[entity]`, wines, bottles ; test `page.server.test.ts` « loads its data with a session » |
| R4-m9a | `lucide-svelte` et `@lucide/svelte` | Corrigé | `package.json:30` : seul `@lucide/svelte` |
| R4-m9b | Titre concaténé « Edit Wine Types » | Corrigé | `entities.ts:93` : `admin.edit_wine_type` |
| R4-m9c | `wineBottleErrors` jamais alimenté | Sans objet | Code supprimé ; erreurs portées par `inUse` de `EntityCollection` |
| R4-m9d | Bouton « Retour » en `history.back()` | Corrigé | Retiré de l'admin (décision UI-07) ; `history.back` n'existe plus que hors admin |
| R4-m10a | `imageHelpers.ts`, `searchHelpers.ts` morts | Corrigé | Fichiers absents ; `pnpm knip` passe |
| R4-m10b | `load*` morts dans `api.ts` | Corrigé | `utils/admin/` supprimé |
| R4-m10c | `DialogStates`, `LoadingStates` | Corrigé | Supprimés avec `utils/admin/types.ts` (3ccb17c7) |
| R4-m10d | `entityActions.loadAllData` en doublon | Corrigé | Supprimé avec `stores/admin` |

### BUG-02

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-02 | Supprimer deux images filtrées fonctionne ; Tout sélectionner ne prend que les visibles | Corrigé | Navigateur : recherche « 2010 », Tout sélectionner → 3 images `*-2010*`, les 2 autres non cochées ; Supprimer → 409 affiché, « Delete anyway » → les 3 supprimées, les 2 autres restent |
| BUG-02/Trouvé-1 | Les toasts de succès ne s'affichaient jamais | Corrigé | `ImageDeleteDialog.svelte:65-73` ; toast observé « 3 images deleted; 1 wine no longer has an image » |

### BUG-03

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-03 | Champ prérempli en édition | Corrigé | Voir R4-M3 : « 100 cl » prérempli |

### BUG-12

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-12 | Une image cochée puis masquée par la recherche sort de la sélection | Corrigé | `image-selection.svelte.ts:36-40` ; navigateur : image cochée, recherche qui la masque, recherche vidée → décochée, dialogue limité aux images choisies sous le filtre ; test « drops a selected image that the search hides » |

### UI-07

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-07 | `admin/+page.svelte` supprimé ; 8 dialogues et 13 listes remplacés par des composants génériques | Corrigé | Fichier absent (8a21c800) ; `EntityFormDialog` pour les 8 tables (`data/[entity]/+page.svelte:73`), `EntityListPanel` pour ces tables plus vins et bouteilles. curl avec session : `/admin` 307 → `/admin/settings`, `/admin/data` 307 → `/admin/data/countries`, 6 pages 200, `/admin/data/sessions` 404 ; sans session 303 → `/wines?login` |
| UI-07/Trouvé-1 | Dialogue de restauration titré « Import Data » pour une sauvegarde manuelle | Corrigé | `backups/+page.svelte:277,288` (choix par `file.isExport`) ; navigateur : « Database Restore » |
| UI-07/Trouvé-2 | Toast « données précédentes téléchargées » sans téléchargement | Corrigé | `savePreviousData(result.backup)` (`backups/+page.svelte:126-137,175`) ; navigateur : `cellar-backup-pre-restore-….zip` téléchargé |
| UI-07/Trouvé-3 | Historique : changer de filtre réinitialise le tri | Non fait | Toujours le cas, désormais voulu par le code : `cellar-history/+page.svelte:13-16` (`sort: null`) ; aucune décision. Voir Reste-4 |
| UI-07/Trouvé-4 | « Date de consommation » hors « Consommées » trie par date d'achat | Non fait | `cellar-history/+page.server.ts:35-37` ; le test « sorts the bottles in the cellar by purchase date when asked for the consumption date » fige ce comportement ; l'en-tête annonce `consumedDate` alors que le tri suit la date d'achat. Voir Reste-4 |
| UI-07/Trouvé-5 | « Wine Definitions » en double dans les onglets | Corrigé | `data/+layout.svelte:9-16` : une seule entrée `wines` |
| UI-07/Trouvé-6 | `ImageRenameDialog` affiche l'id comme nom actuel | Corrigé | `ImageRenameDialog.svelte:67` : `image?.filename` |
| UI-07/Trouvé-7 | Échec du téléchargement préalable réduit à un `console.warn` | Corrigé | `backups/+page.svelte:130-135` : toast persistant `previous_data_not_downloaded` |
| UI-07/Trouvé-8 | Textes anglais en dur dans les trois dialogues de remplacement | Corrigé | Remplacés par `ReplaceDataDialog` et `WipeDialog`, tout en `m[...]` |
| UI-07/Trouvé-9 | `RestoreFromListingConfirmDialog` reconnaît le type au préfixe du nom | Corrigé | Composant supprimé ; `file.isExport` vient de `list-backups` |
| UI-07/Trouvé-10 | Réponse non JSON d'un proxy non gérée | Corrigé | `client.ts:66-67,75-80` (`unexpectedAnswer`) ; `client.test.ts` |
| UI-07/Trouvé-11 | Page HTML 404 pour un chemin `/api/...` inconnu | Non fait | `curl /api/does-not-exist` → 404 `text/html` (GET et POST) ; seul le client le gère. Défaut traité à l'axe 2 |
| UI-07/Trouvé-12 | Connexion coupée au lieu d'un 413 pour un JSON par morceaux de plus de 1 Mo | Corrigé | `Transfer-Encoding: chunked` de 1,5 Mo sur `POST /api/countries` → 413 `body_too_large` |
| UI-07/Trouvé-13 | Pas de bouton « essai à blanc » (`dryRun`) | Non fait | Le serveur l'accepte (`csv-import/service.ts:66`), l'interface ne l'envoie jamais (`backups/+page.svelte:218-223`) |
| UI-07/Trouvé-14 | Détection des codes-barres et tri des résultats recopiés côté client | Partiel | Le tri a disparu (ordre du serveur). Restent la détection par nom de fichier (`backups/+page.svelte:205-206`, `includes('bottles')` contre `tableOfFile` côté serveur) et la liste des tables, colonnes et priorités recopiée dans `components/admin/csv-tables.ts`, alors que le serveur calcule l'ordre (`csv-import/tables.ts:72-80`) |
| UI-07/Trouvé-15 | Admin chargée sur le serveur | Corrigé | Voir R4-m8c |
| UI-07/Trouvé-16 | Retirer le rechargement des référentiels en quittant `/admin` | Corrigé | `routes/+layout.svelte:49-56` ne traite plus l'admin ; les écritures font `invalidateAll()` |
| UI-07/Trouvé-17 | États « en cours » jamais affichés | Corrigé | `Jobs` et `BackupActions.svelte:170-181`, boutons désactivés pendant un job |
| UI-07/Trouvé-18 | `formatters.ts` : cas `automatic-*` et « Legacy » morts, libellés anglais | Corrigé | `backup-type.ts` ; test « names each type that the backup list gives » |
| UI-07/Trouvé-19 | `stores/admin/types.ts` réduit à `UIActions` | Corrigé | Dossier supprimé |
| UI-07/Trouvé-20 | Branches `result.warning` et `relatedDefinitions` mortes dans `ImageRenameDialog` | Corrigé | `ImageRenameDialog.svelte:43-48` lit `updatedDefinitions`, renvoyé par l'API (curl PUT : `"updatedDefinitions":1`) |
| UI-07/Trouvé-21 | `executeCsvImport` lit barcode-settings sans tester `response.ok` | Corrigé | Réglage fourni par la `load` (`backups/+page.server.ts:14`) |
| UI-07/Trouvé-22 | Corps lu avant le statut | Corrigé | `client.ts:64-68` teste `response.ok` d'abord |
| UI-07/Trouvé-23 | Prop `onUpdateCurrentPage` jamais transmise | Corrigé | Composant supprimé |
| UI-07/Trouvé-24 | Producteur ou millésime null insérés tels quels dans les messages | Corrigé | `wine-labels.ts`, `wine-labels.test.ts` ; navigateur : « …delete the wine "Test Wine 0"? » pour un vin sans producteur |
| UI-07/Trouvé-25 | Pagination découpée à la main, page non ramenée à la dernière | Corrigé | `entity-collection.svelte.ts:48-56` (`clampPage`) ; navigateur : suppression en page 3 → « Showing 21 to 22 of 22 », recherche gardée |
| UI-07/Trouvé-26 | Recopie de `saveResponse` | Corrigé | `client.ts:89-95` réutilise `saveResponse` (`utils/download.ts`) |
| UI-07/Reste-1a | Pas de bouton « essai à blanc » pour l'import CSV | Non fait | Voir Trouvé-13 |
| UI-07/Reste-1b | Détection des codes-barres à remplacer côté client | Non fait | `backups/+page.svelte:204-216` |
| UI-07/Reste-2 | `/api/...` inconnu → page 404 HTML | Non fait | Voir Trouvé-11 ; défaut traité à l'axe 2 |
| UI-07/Reste-3 | La restauration depuis la liste télécharge le fichier puis le renvoie | Non fait | `backups/+page.svelte:146-151` (`requestBlob`, puis `POST /api/admin/restore`). Conséquence grave traitée en Majeur à l'axe 3 (sauvegarde de plus de 500 Mo impossible à restaurer) |
| UI-07/Reste-4 | Tri de l'historique relevé pendant BUG-06, à trancher | Non fait | Voir Trouvé-3 et Trouvé-4 ; rien dans « Décisions prises » |
| UI-07/Reste-5 | `GET /api/settings` sans appelant | Non fait | `routes/api/settings/+server.ts:15` ; seul appelant, `SessionTimeoutDialog.svelte:34`, en PUT ; GET appelé seulement par `server.test.ts`. Défaut traité à l'axe 2 (liste des routes sans appelant) |

## 3. Nouveaux constats (passe 2)

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

**m1. La confirmation générique survit à la navigation et supprime depuis une autre page**
- Où : `src/lib/components/admin/confirm.svelte.ts:8-30` (état de module), `src/routes/admin/+layout.svelte:50`
- Scénario : l'utilisateur demande une suppression, revient en arrière (bouton du navigateur, geste du téléphone), puis valide le dialogue resté ouvert sur une autre page. La suppression part depuis une page démontée. Trois cas reproduits :
  - dans l'admin : `/admin/data/countries`, Supprimer « Vland 3 », `history.back()` → `/admin/settings`, dialogue toujours ouvert, Delete → le pays est supprimé ;
  - hors de l'admin : Supprimer « Vland 4 », retour jusqu'à `/wines` (dialogue disparu avec le layout), puis `history.forward()` → `/admin/settings`, le dialogue réapparaît, car la question et sa promesse vivent dans le module ; Delete → supprimé ;
  - cascade : sur `/admin/data/wines`, Supprimer un vin qui a 3 bouteilles → 409 → second dialogue « This wine has 3 bottles… » (sans le nom du vin, `en.json:752`) ; `history.back()` → `/admin/data/countries`, dialogue toujours là ; « Delete All » → le vin et ses 3 bouteilles sont supprimés.
  Attendu : quitter la page annule la question.
- Correction proposée : dans `ConfirmDialog.svelte`, `beforeNavigate(() => confirmation.answer(false))`. Le composant est monté au moment où l'on quitte l'admin, donc le hook couvre aussi le deuxième cas ; `answer(false)` sans question en attente ne fait que fermer.
- Preuve : Chromium headless : `Vland 3 exists after Delete on settings: false` ; cascade : `definitions left: []`, `bottles: []`, toast « Wine definition and 3 bottles deleted ».
- Vérification : Confirmé, corrigé (scénario élargi par le vérificateur aux cas 2 et 3). Mineur maintenu : aucune suppression ne part sans un clic sur un bouton destructeur, et l'objet supprimé est celui que l'utilisateur venait de choisir ; le risque est une confirmation hors contexte, surtout dans le cas de la cascade.

**m2. Une action de mise à jour cochée disparaît du bandeau au premier rechargement des données**
- Où : `src/lib/components/admin/UpgradeBanner.svelte:17-18`, `src/lib/server/upgrade.ts:336`, `src/routes/admin/+layout.server.ts:8`
- Scénario : on coche par erreur une action du bandeau, puis on enregistre n'importe quoi dans l'admin (`invalidateAll()`) → l'action disparaît et la coche ne peut plus être annulée. Le commentaire promet l'inverse : « Ticked actions stay listed, so that a wrong tick can be undone; the next visit hides them ». Passer d'une page de l'admin à l'autre ne masque rien : seul `invalidateAll()` relit la `load` du layout.
- Correction proposée : garder dans le bandeau la liste lue au montage, fusionnée avec les nouvelles actions ; ou accepter ce comportement et corriger le commentaire.
- Preuve : bandeau `[0.2.0#0, 0.2.0#1]` → coche #0 → suppression d'un pays sur la même page → `[0.2.0#1]` ; `__data.json?x-sveltekit-invalidated=111` après le PUT ne renvoie plus l'action cochée.
- Vérification : Confirmé.

**m3. L'option « Remplacer tous les codes-barres » reste cochée à l'import CSV suivant**
- Où : `src/lib/components/admin/dialogs/BarcodeOverrideDialog.svelte:24-34`
- Scénario : premier import d'un fichier de bouteilles, l'utilisateur choisit « remplacer » ; second import sans recharger la page → « remplacer » est présélectionné. Validé sans relire, l'import remplace les codes-barres du fichier, alors que le choix par défaut annoncé est « garder ». Cause : `confirmBarcodeOverride` ferme par `open = false`, ce qui ne déclenche pas `onOpenChange`, donc `closeDialog` ne remet pas l'option à `false`.
- Correction proposée : remettre `overrideAllBarcodes = false` à chaque ouverture (`$effect` sur `open`, comme les autres dialogues) ou dans `confirmBarcodeOverride`.
- Preuve : Chromium : radios `[keep, override]` = `[true, false]` au premier import, `[false, true]` au second.
- Vérification : Confirmé.

**m4. Props, valeurs par défaut et commentaires morts dans les dialogues d'import**
- Où : `src/lib/components/admin/dialogs/CsvImportDialog.svelte:19-20,76-82,283-285` ; `src/lib/components/admin/dialogs/BarcodeOverrideDialog.svelte:15-16,31-33,87-88` ; commentaires « // Props » ou « // Internal state » dans 8 dialogues (`CsvImportDialog`, `BarcodeOverrideDialog`, `ZipImportResultsDialog`, `ZipImportInfoDialog`, `AccessCodeDialog`, `CsvImportResultsDialog`, `CsvExportDialog`, `BarcodeInfoDialog`)
- Scénario : aucun effet visible. `isImportingCsv` (« Loading… », « Importing… ») ne peut pas valoir vrai dialogue ouvert : les deux dialogues se ferment avant d'appeler `onConfirm`, et les tuiles qui les ouvrent sont désactivées pendant un job (`BackupActions.svelte:170`). Les valeurs par défaut `onConfirm = async (files, delimiter) => {}` et `async (overrideAllBarcodes) => {}` portent sur des props obligatoires. Les commentaires disent ce que fait le code, contre la règle 6 d'AGENTS.md.
- Correction proposée : retirer `isImportingCsv` des deux dialogues (la tuile de `BackupActions` montre déjà l'import), ces deux valeurs par défaut et ces commentaires.
- Preuve : `gates.log`, ESLint : `BarcodeOverrideDialog.svelte 16:28 'overrideAllBarcodes' is defined but never used`, `CsvImportDialog.svelte 20:28 'files'` et `20:43 'delimiter' is defined but never used`. Ces trois avertissements, signalés à part, sont ces valeurs par défaut mortes : ils sont fusionnés ici.
- Vérification : Confirmé (fusion des avertissements de lint vérifiée par le rédacteur).

**m5. Le nom d'une sauvegarde est limité à 50 caractères par le client, à 200 par le serveur**
- Où : `src/lib/components/admin/backups/NameBackupDialog.svelte:58` (`maxlength={50}`), `src/lib/server/features/backup/files.ts:56` (`max(200)`)
- Scénario : un nom de 60 caractères est coupé sans message, alors que le serveur l'accepte. La décision UI-07 dit que « les noms de sauvegarde ne sont vérifiés que par le serveur ».
- Correction proposée : retirer `maxlength`. À faire avec la correction de l'axe 3 (le serveur compte des unités UTF-16, pas les octets du nom de fichier final, et un nom long donne un 500) : sans elle, retirer la limite du client expose ce 500.
- Preuve : `POST /api/admin/create-backup` avec un nom de 60 caractères → 201.
- Vérification : Confirmé, avec la précision sur la limite en octets du serveur, routée vers l'axe 3.

**m6. Les sauvegardes de sécurité sont listées comme « Sauvegarde manuelle »**
- Où : `src/lib/server/features/backup/files.ts:98-105` (`manual-${kind}` dès que le nom n'est pas automatique), `src/lib/components/admin/backups/backup-type.ts:12-13`
- Scénario : après des restaurations, des imports JSON ou un effacement, la liste « Sauvegardes manuelles » se remplit de fichiers `pre-restore-` (`service.ts:259`), `pre-import-` (`json-import.ts:131`) et `pre-reset-` que l'utilisateur n'a pas créés. Attendu : un libellé qui dit d'où vient le fichier.
- Correction proposée : reconnaître les préfixes `pre-restore`, `pre-reset` et `pre-import` dans `listBackups` et leur donner un libellé « avant restauration » ou équivalent.
- Preuve : liste rendue : `Manual backup — cellar-backup-pre-restore-…zip`, `Manual backup — cellar-backup-pre-reset-…zip`.
- Vérification : Confirmé.

**m7. L'import CSV refuse un fichier `.CSV` en majuscules**
- Où : `src/lib/components/admin/dialogs/CsvImportDialog.svelte:55`
- Scénario : choisir `WINEBOTTLES.CSV` → toast « Only CSV files are supported: WINEBOTTLES.CSV », bouton « Import 0 files » désactivé. Le sélecteur (`accept=".csv"`) et le serveur (`csv-import/detect.ts:9` met le nom en minuscules) ignorent la casse. Attendu : le fichier est accepté.
- Correction proposée : `file.name.toLowerCase().endsWith('.csv')`, comme le test des zip (`BackupActions.svelte:145`).
- Preuve : `file.name.endsWith('.csv')` ; reproduit dans Chromium.
- Vérification : Confirmé.

**m8. Une erreur de chargement fait perdre la navigation de l'admin**
- Où : pas de `src/routes/admin/+error.svelte` ; seule `src/routes/+error.svelte` existe
- Scénario : une section de l'admin échoue à charger → la page d'erreur racine remplace tout le layout de l'admin. Pour aller à une autre section, il faut repasser par le menu principal, et le bandeau des actions de mise à jour disparaît.
- Correction proposée : un `admin/+error.svelte` qui reprend le message traduit ; le layout de l'admin reste alors affiché autour.
- Preuve : dossier de données de travail en `chmod 300` → `/admin/backups` 500, `h1` « Wine Cellar » et « 500 », aucun lien `/admin/settings`, message traduit.
- Vérification : Confirmé. Mineur : le menu principal reste affiché.

**m9. Les résultats de l'import CSV affichent l'identifiant brut de la table**
- Où : `src/lib/components/admin/dialogs/CsvImportResultsDialog.svelte:94-96` ; `src/lib/server/features/csv-import/pipeline.ts:198`, `src/lib/server/features/csv-import/service.ts:35,48`
- Scénario : interface en français, import de `cave-wineBottles.csv` → le titre du bloc de résultats est « wineBottles (cave-wineBottles.csv) ». Le serveur renvoie dans `table` une chaîne déjà composée (`${table} (${file})`, ou le seul nom du fichier quand aucune table n'est reconnue), et le dialogue l'affiche telle quelle, alors que `components/admin/csv-tables.ts` donne un `label()` traduit par table, déjà utilisé par `CsvImportDialog.svelte:166` et `CsvExportDialog.svelte:112`. Attendu : « Bouteilles (cave-wineBottles.csv) ».
- Correction proposée : renvoyer `table` (l'identifiant, ou rien) et `file` séparément dans le rapport de fichier, et composer le titre côté client avec `label()`. `result.table` sert aussi de clé à `expandedErrors` (`CsvImportResultsDialog.svelte:144-246`) : prendre le nom de fichier comme clé. Le format de réponse de `POST /api/admin/import-csv` change : une phrase dans les notes de version, comme pour `errors[].problems` (décision UI-10).
- Preuve : `pipeline.ts:198` ``return fileReport(`${table} (${file})`, …)`` ; `CsvImportResultsDialog.svelte:96` `{result.table}`.
- Vérification : signalé par a4-admin-ui (hors périmètre), vérifié par le rédacteur sur le code.

## 4. Points restés ouverts de la passe 1

- Import CSV piloté par le serveur :
  - UI-07/Trouvé-13 et Reste-1a : bouton « essai à blanc » (`dryRun`), que le serveur accepte déjà ;
  - UI-07/Trouvé-14 (Partiel) et Reste-1b : détection des codes-barres par `includes('bottles')` côté client, et tables, colonnes et priorités recopiées dans `csv-tables.ts`. À faire avec m9 : le serveur dit quelle table il a reconnue.
- Dialogues d'import : R4-m8b (Partiel), 6 `{#each}` sans clé dans `CsvImportDialog`, `CsvImportResultsDialog` et `ZipImportResultsDialog`. Mêmes fichiers que m3, m4, m7 et m9 : une seule tâche de nettoyage.
- Restauration depuis la liste côté serveur : UI-07/Reste-3, à traiter avec le Majeur de l'axe 3 (sauvegarde de plus de 500 Mo impossible à restaurer).
- Tri de l'historique, à trancher par le mainteneur : UI-07/Trouvé-3 (le tri repart à zéro quand le filtre change), Trouvé-4 (« Date de consommation » hors « Consommées » trie par date d'achat, et un test fige ce comportement), Reste-4.
- API, traitées à l'axe 2 : UI-07/Trouvé-11 et Reste-2 (`/api/...` inconnu en 404 HTML), Reste-5 (`GET /api/settings` sans appelant).

## 5. Constats écartés

- « Régénérer le jeton cron » invalide l'ancien jeton sans confirmation (N6 de l'auditeur) : réfuté. Le dialogue avertit juste au-dessus du bouton (« The cron job has a token. Generating a new one replaces it: update the cron job then. », `en.json:842`, affiché par `BackupSettingsDialog.svelte:179-181` quand un jeton existe). L'effet se répare en recopiant la commande affichée, et la décision DATA-05 ne demande qu'un jeton « régénérable ».
- `{@html}` dans les dialogues d'import (`ZipImportResultsDialog.svelte:146`, `CsvImportResultsDialog.svelte:277`, `ZipImportInfoDialog.svelte:47,62,79,95`), signalé par a6b-pages : non confirmé. Les six appels ne reçoivent que des constantes écrites dans le composant (`strong: '<strong>'`, `imageName: '<code>imageName</code>'`) et des messages des fichiers de langue (`en.json:639,790,794,798,802,815` et leurs équivalents dans `fr.json`), qui n'ont pas d'autre paramètre. Aucune valeur de la base, aucun nom de fichier ni aucune réponse du serveur n'y passe : les noms de fichiers du zip sont affichés par interpolation échappée (`ZipImportResultsDialog.svelte:101-103`, `{item.filename}`).

## 6. Renvois

- R4-C1 (contrôle d'accès admin côté client) : voir axe 2.
- R4-M8 (clés i18n absentes) et R4-m7 (accessibilité) : voir axe 5.
- `/api/...` inconnu en 404 HTML, 405 et 403 en texte (UI-07/Trouvé-11, Reste-2) : voir axe 2.
- Endpoints sans appelant, dont `GET /api/settings` (UI-07/Reste-5) : voir axe 2, liste unique des routes.
- Restauration depuis la liste par aller-retour dans le navigateur, sauvegarde de plus de 500 Mo impossible à restaurer (UI-07/Reste-3) : voir axe 3.
- Nom de sauvegarde long → 500, limite comptée en caractères et non en octets : voir axe 3 (m5 garde la limite du client).
- Deux `h1` sur chaque page de l'admin (`src/routes/+layout.svelte:121`, `src/routes/admin/+layout.svelte:24`) : voir axe 5.
- Pas de `src/error.html` : voir axe 5.
- Signalés par a4-admin-ui hors périmètre, sans axe propriétaire dans la consolidation, non vérifiés ici : réponses de forme différente entre `POST /api/admin/wipe-database` (`backups.database.filename`) et restauration ou import (`backup`), `backups/+page.svelte:175` contre `:197` ; images envoyées renommées `wine-<uuid>.<ext>`, que la recherche par nom de la page images ne retrouve pas.
