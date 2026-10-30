# Vérification d’avant 1.0, axe 4 : front d’administration

Commit revu `cf48032d` (develop, 1.0.0-rc.1, 2026-10-29). Périmètre : `src/routes/admin/**`, `src/lib/components/admin/**`, la confirmation du layout racine (`layout/ConfirmDialog.svelte`, `confirm.svelte.ts`), `forms/OptionSelect.svelte` et les primitives `ui/select` et `ui/dialog` telles que l’admin les emploie, plus les parts admin des tâches P7–P11 de l’axe : UI-18, BUG-21, API-08, DATA-12, UI-20. Méthode : le rapport de l’auditeur (`$A/rapport-axe-4.md`) a été repris ligne par ligne par un vérificateur qui ne l’avait pas écrit, sur sa propre instance : un worktree détaché à `cf48032d`, construit (`pnpm build`), l’app lancée sur le port 4545 avec d’autres données inventées (même gabarit de seeding que l’auditeur, images renommées par `PUT /api/admin/images`), pilotée par curl et par le Chromium headless de Playwright. Runs : routes et sécurité par curl ; BUG-21 dans 4 dialogues à Select, souris (après et pendant l’animation de la liste), toucher, clavier et `locator.click()`, à 1280 et 390 px, en et fr, `scrollY` lu avant, pendant et après le dialogue ; 8 dialogues de l’admin à 1280 × 900, 390 × 844 et 375 × 667, en/fr, clair/sombre (96 ouvertures : géométrie, bouton d’action touchable, molette et glissé, axe-core 4.14.0, piège du focus, Échap) ; 8 pages de l’admin × en/fr × clair/sombre × 1280/390 (64 chargements, axe complet) ; contraste axe dans les 8 thèmes × clair/sombre (6 pages et le guide de l’import CSV) ; rejeux des images (409 puis « Delete anyway »), de la pagination, de la confirmation après navigation, de l’import CSV (essai à blanc, `.CSV`, option des codes-barres, titres), du nom de sauvegarde, de la restauration depuis la liste et de l’échec du téléchargement de la sauvegarde de sécurité, d’une erreur 500 de `load` ; 10 fichiers de test de l’admin (52 tests) relancés. Chaque verdict autre que « fait », chaque « fait » issu d’un Majeur de la revue 4, d’un contrôle de sécurité ou d’un critère, plus de la moitié des autres « fait », et chaque constat ont été rejoués. Les portes complètes sont celles du lead (`$S/p12/gates/summary.txt`, toutes à 0).

Notations : `$S` = `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214/scratchpad`, `$A` = `$S/p12/a4` (preuves de l’auditeur), `$V` = `$S/p12/v4` (preuves du vérificateur, scripts dans `$V/scripts/`). Les `fichier:ligne` sont ceux de `cf48032d`.

## 1. Résumé

- **Régressions : 2, toutes deux Mineures.**
  - V4-m6 : l’échec du téléchargement de la sauvegarde de sécurité ne se voit plus (UI-07/Trouvé-7, corrigé à l’audit), depuis a700cc93 (DATA-12, 2026-10-23). Aucune décision ne l’accepte : l’entrée DATA-12 imposait le lien `<a download>`, mais range la perte du signal parmi ses « Trouvé pendant (hors périmètre) », comme un point ouvert, pas comme un choix.
  - V4-m7 (ajouté par le vérificateur) : passer au clavier (Tab) sur le délimiteur des dialogues d’export et d’import CSV le change en tabulation, depuis 4614db09 (UI-18, 2026-10-29).
- Verdicts, 106 lignes en tout :
  - traçabilité de l’audit, 65 lignes : 61 fait, 1 fait autrement, 1 régressé, 2 sans objet ;
  - constats de l’audit (a4 m1 à m9) : 9 fait ;
  - points restés ouverts de l’audit, 6 lignes (la ligne 5 de l’auditeur, à deux verdicts, est scindée) : 5 fait, 1 fait autrement ;
  - tâches P7–P11, 26 lignes : 10 fait, 2 fait autrement, 14 pas fait (les « Trouvé pendant » encore ouverts, tous listés par la feuille de route) ;
  - total : **85 fait, 4 fait autrement, 14 pas fait, 1 régressé, 2 sans objet, 0 partiel**.
- Constats nouveaux : **0 Critique, 0 Majeur, 7 Mineurs**. V4-m1 à V4-m5 de l’auditeur confirmés (V4-m1 élargi à un troisième dialogue, chiffres de V4-m2 corrigés) ; V4-m6 et V4-m7 ajoutés par le vérificateur.
- Essais rejoués :
  - BUG-21 : 36 essais par une vraie entrée (souris, souris pendant l’animation, toucher, clavier) dans 4 dialogues, à 1280 et 390 px, en et fr : la page reste à son `scrollY` pendant et après le dialogue, et l’option est choisie ; seul `locator.click()` de Playwright fait défiler (6 cas sur 8) ;
  - 64 chargements de page : 0 violation axe, aucun défilement horizontal, un seul `h1`, aucune erreur console ; 96 ouvertures de dialogue : 0 sortie du focus sur 25 tabulations, Échap ferme toujours ; axe sérieux seulement dans le guide de l’import CSV (V4-m2, V4-m3) ;
  - contraste : 0 violation sur 96 analyses de pages (8 thèmes × clair/sombre × 6 pages), guide CSV en échec dans les 16 modes.

## 2. Traçabilité (passe 1)

« rejoué » renvoie à un run du vérificateur ; « lecture » à une lecture du code à `cf48032d`.

### Revue 4

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| R4-M1 | Suppression d’images (`imageIds`), flux `force` | Corrigé | fait | `ImageDeleteDialog.svelte:56-64`. Rejoué : 3 images « 2010 » → corps `{"imageIds":[3 ids],"force":false}` → 409 avec les vins → « Delete anyway » → `force:true`, toast « 3 images deleted; 3 wines no longer have an image », restent `riesling-2015.png` et `etiquette-zland.png` (`$V/repro-images.json`) |
| R4-M2 | Recherche propagée à Exporter et Tout sélectionner | Corrigé | fait | `image-selection.svelte.ts:19-28`. Rejoué : recherche « 2010 », Tout sélectionner → 3 cochées sur 3 visibles (5 images) (`$V/repro-images.json`) |
| R4-M3 | Édition d’un format : champ prérempli | Corrigé | fait | `EntityFormDialog.svelte:43-47`. Rejoué : `#entity-name` = « 100 cl », Save actif (`$V/repro-m3edit.json`) |
| R4-M4 | Une seule source d’état, plus de `svelte/store` | Corrigé | fait | grep `svelte/store` dans l’admin : 0 (`$V/greps.log`) ; `jobs.test.ts` vert (`$V/vitest-admin.log`) |
| R4-M5 | Un seul `fetch` | Corrigé | fait | Seul `src/lib/api/client.ts:55` (`$V/greps.log`) |
| R4-M6 | Suppression factorisée | Corrigé | fait | `entity-collection.svelte.ts` ; test « deletes an entry, then reloads the data of the page » vert (`$V/vitest-admin-names.log`) |
| R4-M7 | Échecs de chargement visibles | Corrigé | fait | Rejoué : dossier de données en `chmod 300` → `/admin/backups` 500 dans le layout de l’admin, titre « 500 - Administration - Cave à vin », liens `/admin/settings`, `/backups`, `/data`, `/images`, message traduit (`$V/admin-backups-500.html`) |
| R4-m1a | États vides traduits | Corrigé | fait | Lecture : `EntityListPanel.svelte:111` |
| R4-m1b | Types de sauvegarde et tailles traduits | Corrigé | fait | `backup-type.ts:10-20` ; tests « speaks the language of the interface », « names each type that the backup list gives » verts. Rejoué : « Backup before restore … 60.6 kB • Oct 29, 2026 » (`$V/repro-restore.json`) |
| R4-m1c | Textes en dur des dialogues | Corrigé | fait | `pnpm i18n:check` 0 (`$S/p12/gates/4-i18n-check.log`) ; aucun texte anglais sur les captures fr (`$V/shots/dialogs/fr-*`) |
| R4-m1d | Titre de page traduit | Corrigé | fait | Rejoué : « Sauvegardes - Administration - Cave à vin », « Countries - Admin Panel - Wine Cellar », un `h1` par page sur 64 chargements (`$V/pages.json`) |
| R4-m1e | Messages 409 traduits | Corrigé | fait | Lecture : `utils/api-error.ts` (`apiErrorMessage`) ; 409 des images affiché en clair (`$V/repro-images.json`) |
| R4-m2 | Plus de `any` | Corrigé | fait | grep `: any`/`as any` : 0 (`$V/greps.log`) ; `pnpm check` 0 (portes) |
| R4-m3 | Prop drilling | Corrigé | fait | Lecture : dialogues à 1-4 props (`CsvImportDialog.svelte:18-27`, `BarcodeOverrideDialog.svelte:12-18`) |
| R4-m4 | Commentaires « Extracted to » | Corrigé | fait | grep `// Props`, `// Internal state` : 0 (`$V/greps.log`) |
| R4-m5 | Logs de debug | Corrigé | fait | grep `console.` : 0 (`$V/greps.log`) |
| R4-m6 | Double toast « accès refusé » | Sans objet | sans objet | Garde serveur. Rejoué : sans session, 5 pages admin → 303 `/wines?login`, `GET /api/admin/list-backups` → 401 (`$V/curl-checks.log`) |
| R4-m8a | Filtrage en `$derived` | Corrigé | fait | Lecture : `BackupList.svelte:40-42` |
| R4-m8b | `{#each}` sans clé | Partiel | fait | grep : aucun `{#each}` sans clé dans le périmètre (`$V/greps.log`) ; lint sans avertissement (`$S/p12/gates/2-lint.log`) |
| R4-m8c | Données chargées par le serveur | Corrigé | fait | Tests « /admin/settings … /admin/data/[entity] loads its data with a session » (6) verts (`$V/vitest-admin-names.log`) |
| R4-m9a | Un seul paquet lucide | Corrigé | fait | `package.json:33` : seul `@lucide/svelte` |
| R4-m9b | Titres non concaténés | Corrigé | fait | Lecture : `entities.ts` (`admin.edit_country`…) |
| R4-m9c | `wineBottleErrors` | Sans objet | sans objet | Code absent |
| R4-m9d | Bouton « Retour » `history.back()` | Corrigé | fait | Lecture : aucun dans l’admin (décision « Admin en pages (UI-07) ») |
| R4-m10a | `imageHelpers.ts`, `searchHelpers.ts` morts | Corrigé | fait | Absents ; `pnpm knip` 0 (portes) |
| R4-m10b | `load*` morts | Corrigé | fait | `utils/admin/` absent |
| R4-m10c | `DialogStates`, `LoadingStates` | Corrigé | fait | grep vide |
| R4-m10d | `loadAllData` | Corrigé | fait | grep vide |

### BUG-02

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-02 | Supprimer des images filtrées ; Tout sélectionner ne prend que les visibles | Corrigé | fait | Rejoué : voir R4-M1 et R4-M2 |
| BUG-02/Trouvé-1 | Toasts de succès | Corrigé | fait | Rejoué : toast « 3 images deleted; 3 wines no longer have an image » (`$V/repro-images.json`) |

### BUG-03

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-03 | Champ prérempli en édition | Corrigé | fait | Rejoué : voir R4-M3 |

### BUG-12

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| BUG-12 | Image cochée puis masquée par la recherche : sortie de la sélection | Corrigé | fait | `image-selection.svelte.ts:31-36` ; test « drops a selected image that the search hides… » vert. Rejoué : `riesling-2015.png` cochée, recherche « 2010 », recherche vidée → 0 cochée (`$V/repro-images.json`) |

### UI-07

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| UI-07 | Admin en pages, composants génériques | Corrigé | fait | Rejoué : avec session `/admin` 307 → `/admin/settings`, `/admin/data` 307 → `/admin/data/countries`, 7 pages 200, `/admin/data/sessions` et `/admin/data/nope` 404 ; sans session 303 (`$V/curl-checks.log`) |
| UI-07/Trouvé-1 | Titre du dialogue de restauration | Corrigé | fait | Lecture : `backups/+page.svelte` (`file.isExport`), `ReplaceDataDialog.svelte` ; captures de l’auditeur (`$A/sweep-dialogs.json`) |
| UI-07/Trouvé-2 | Téléchargement des données précédentes | Corrigé | fait | `backups/+page.svelte:135-138`. Rejoué : événement `download` `cellar-backup-pre-restore-….zip` (`$V/repro-restore.json`) |
| UI-07/Trouvé-3 | Tri de l’historique remis à zéro au changement de filtre | Non fait | fait | Décision « Tri de l’historique et du hors cave » ; `cellar-history/+page.svelte:16-18` ; test « keeps a sort given in the URL whatever the filter » vert |
| UI-07/Trouvé-4 | « Date de consommation » trie par date d’achat | Non fait | fait | Tests « sorts every bottle by consumption date, the bottles not drunk last », « has no consumption date column for the bottles in the cellar » verts |
| UI-07/Trouvé-5 | « Wine Definitions » en double | Corrigé | fait | Lecture : `data/+layout.svelte:9-16` |
| UI-07/Trouvé-6 | Nom actuel de l’image | Corrigé | fait | Lecture : `ImageRenameDialog.svelte:67` |
| UI-07/Trouvé-7 | Échec du téléchargement préalable signalé | Corrigé | régressé | Depuis a700cc93 (DATA-12) : `savePreviousData` (`backups/+page.svelte:135-138`) appelle `saveUrl` (`utils/download.ts:7-14`) et annonce le téléchargement sans rien vérifier ; à `9df0d08c`, `downloadBlob` dans un `try` affichait `previous_data_not_downloaded`. Rejoué : téléchargement annulé par Chromium (le serveur répond 404), la page affiche « …which your browser downloads… » et aucun avertissement (`$V/restore-fail.json`). Aucune décision ne l’accepte : V4-m6 |
| UI-07/Trouvé-8 | Textes des dialogues de remplacement | Corrigé | fait | Lecture : `ReplaceDataDialog.svelte`, `WipeDialog.svelte` tout en `m[...]` |
| UI-07/Trouvé-9 | Type reconnu par le préfixe | Corrigé | fait | Lecture : `file.isExport` |
| UI-07/Trouvé-10 | Réponse non JSON d’un proxy | Corrigé | fait | Lecture : `client.ts:45-80` ; `client.test.ts` vert |
| UI-07/Trouvé-11 | `/api/...` inconnu en page 404 HTML | Non fait | fait | `hooks.server.ts:94-97`. Rejoué : GET (et POST avec session) `/api/does-not-exist` → 404 `application/json` `not_found` ; `DELETE /api/wines` → 405 JSON, `allow: GET, HEAD` (`$V/curl-checks.log`) |
| UI-07/Trouvé-12 | 413 pour un JSON par morceaux | Corrigé | fait | Rejoué : `Transfer-Encoding: chunked` 1,5 Mo sur `POST /api/countries` → 413 `body_too_large` (`$V/curl-checks.log`) |
| UI-07/Trouvé-13 | Bouton « essai à blanc » | Non fait | fait | `CsvImportDialog.svelte:278-284`, `backups/+page.svelte:226`. Rejoué en/fr : avis d’essai à blanc, pays 10 → 10, bouteilles 53 → 53 (`$V/repro-csv.json`) |
| UI-07/Trouvé-14 | Tables et codes-barres devinés côté client | Partiel | fait | `backups/+page.svelte:202-205` (`tableOfFile` sur `data.csvTables` de la `load`) ; `csv-tables.ts` ne garde que libellés et délimiteurs. Rejoué : dialogue des codes-barres ouvert pour `cave-wineBottles.csv` (`$V/repro-csv.json`) |
| UI-07/Trouvé-15 | Admin chargée sur le serveur | Corrigé | fait | Voir R4-m8c |
| UI-07/Trouvé-16 | Pas de rechargement en quittant `/admin` | Corrigé | fait | Lecture : `routes/+layout.svelte` ne traite plus l’admin |
| UI-07/Trouvé-17 | États « en cours » | Corrigé | fait | Lecture : `BackupActions.svelte:168-178` (`disabled={running !== null}`, libellé occupé) |
| UI-07/Trouvé-18 | `formatters.ts` mort | Corrigé | fait | Test « names each type that the backup list gives » vert |
| UI-07/Trouvé-19 | `stores/admin/types.ts` | Corrigé | fait | Absent |
| UI-07/Trouvé-20 | Branches mortes de `ImageRenameDialog` | Corrigé | fait | Lecture : lit `result.wines` (forme d’API-09) ; 5 renommages `PUT /api/admin/images` → 200 |
| UI-07/Trouvé-21 | barcode-settings lu sans tester `ok` | Corrigé | fait | Lecture : `backups/+page.server.ts` (`barcodeAutoGeneration` de la `load`) |
| UI-07/Trouvé-22 | Statut lu avant le corps | Corrigé | fait | Lecture : `client.ts:64-68` |
| UI-07/Trouvé-23 | `onUpdateCurrentPage` | Corrigé | fait | Absent |
| UI-07/Trouvé-24 | Producteur ou millésime null dans les messages | Corrigé | fait | Tests « leaves out a missing producer… », « …missing vintage… » verts |
| UI-07/Trouvé-25 | Page ramenée à la dernière | Corrigé | fait | `entity-collection.svelte.ts:47-50`. Rejoué : bouteilles « Showing 41 to 50 of 53 », 10 suppressions → « Showing 41 to 43 of 43 » (`$V/repro-page.json`) |
| UI-07/Trouvé-26 | Recopie de `saveResponse` | Corrigé | fait | `client.ts:84-90` → `utils/download.ts:27-32` |
| UI-07/Reste-1a | Essai à blanc | Non fait | fait | Voir Trouvé-13 |
| UI-07/Reste-1b | Détection des codes-barres côté client | Non fait | fait | Voir Trouvé-14 |
| UI-07/Reste-2 | `/api/...` inconnu → 404 HTML | Non fait | fait | Voir Trouvé-11 |
| UI-07/Reste-3 | Restauration de la liste par aller-retour | Non fait | fait | `backups/+page.svelte:149-154`. Rejoué : une seule requête, `POST /api/admin/restore`, aucun `download-backup` avant (`$V/repro-restore.json`) |
| UI-07/Reste-4 | Tri de l’historique à trancher | Non fait | fait | Tranché par la décision « Tri de l’historique et du hors cave (UI-04, UI-07) », appliqué (Trouvé-3 et 4) |
| UI-07/Reste-5 | `GET /api/settings` sans appelant | Non fait | fait autrement | Décision « Endpoints et CSRF (API-06) » : les endpoints sans appelant restent (API publique) ; aussi listé « réglé » par la décision « Tâches de l’audit d’avant 1.0 » |

### Nouveaux constats de l’audit (a4)

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| a4 m1 | Confirmation qui survit à la navigation | Mineur | fait | `layout/ConfirmDialog.svelte:16` (`beforeNavigate` → `answer(false)`), monté par `routes/+layout.svelte:182`. Rejoué : Supprimer « Vland 4 », Précédent → 0 dialogue, Suivant → 0 dialogue, « Vland 4 » existe ; une suppression normale marche ensuite (`$V/repro-m1.json`) |
| a4 m2 | Action cochée qui disparaît au rechargement | Mineur | fait | `UpgradeBanner.svelte:20-27` ; tests `keepShown` « keeps a ticked action that the data read again leaves out » verts ; run de l’auditeur (`$A/repro-m2.json`). Décision « Petits choix » |
| a4 m3 | « Remplacer tous les codes-barres » reste coché | Mineur | fait | `BarcodeOverrideDialog.svelte:22-25`. Rejoué en/fr : 1ʳᵉ ouverture `[true,false]`, choix « remplacer », 2ᵉ ouverture `[true,false]` (`$V/repro-csv.json`) |
| a4 m4 | Props, valeurs par défaut et commentaires morts | Mineur | fait | grep `isImportingCsv`, `// Props` : 0 ; lint sans avertissement. Reste la valeur par défaut de `ZipImportInfoDialog.svelte:14`, connue (API-08/Trouvé) |
| a4 m5 | Nom de sauvegarde coupé à 50 | Mineur | fait | Rejoué fr : pas de `maxlength`, 60 caractères gardés ; 100 « é » → toast 422 traduit, dialogue resté ouvert (`$V/repro-m5.json`) |
| a4 m6 | Sauvegardes de sécurité listées comme manuelles | Mineur | fait | `features/backup/files.ts:32` ; rejoué : « Backup before restore cellar-backup-pre-restore-… » (`$V/repro-restore.json`) |
| a4 m7 | `.CSV` refusé | Mineur | fait | `CsvImportDialog.svelte:53`. Rejoué en/fr : `COUNTRIES-UPPER.CSV` listé, aucun toast (`$V/repro-csv.json`) |
| a4 m8 | Erreur de chargement : navigation perdue | Mineur | fait | `admin/+error.svelte`. Rejoué : 404 et 500 dans le layout de l’admin, liens des sections gardés (`$V/pages.json`, `$V/admin-backups-500.html`). Les onglets des tables disparaissent : connu (Trouvé pendant UI-17) |
| a4 m9 | Identifiant brut de la table dans les résultats | Mineur | fait | `CsvImportResultsDialog.svelte:43-44`. Rejoué fr : « Pays (countries.csv) », « Bouteilles (cave-wineBottles.csv) » (`$V/repro-csv.json`, `$V/shots/csv-dryrun-fr.png`) |

### Points restés ouverts de l’audit

| Réf | Point | Verdict audit | Verdict | Preuve |
|---|---|---|---|---|
| Ouvert-1 | Import CSV piloté par le serveur (Trouvé-13, 14, Reste-1a, 1b, m9) | ouvert | fait | Voir ces lignes (API-08) |
| Ouvert-2 | Dialogues d’import : `{#each}` sans clé, m3, m4, m7, m9 | ouvert | fait | Voir R4-m8b, m3, m4, m7, m9 |
| Ouvert-3 | Restauration depuis la liste côté serveur | ouvert | fait | Voir Reste-3 |
| Ouvert-4 | Tri de l’historique | ouvert | fait | Voir Trouvé-3, 4, Reste-4 |
| Ouvert-5a | `/api/...` inconnu en 404 HTML (Trouvé-11, Reste-2) | ouvert | fait | Voir Trouvé-11 |
| Ouvert-5b | `GET /api/settings` sans appelant (Reste-5) | ouvert | fait autrement | Décision « Endpoints et CSRF (API-06) » |

### UI-18 (P10) : couleurs du thème et sélecteurs

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-18 critère | Plus de `<select>` natif ; couleurs en dur justifiées ; pas de régression en clair et en sombre | fait | `grep -rnoE '<select\b' src --include='*.svelte'` → 0 (`$V/greps.log`) ; 64 pages et 96 dialogues sans défilement horizontal ni erreur console (`$V/pages.json`, `$V/dialogs.json`). Le critère ne couvre pas le comportement clavier : V4-m7 est une régression d’UI-18 |
| UI-18/Trouvé-1 | Select dans un dialogue qui fait défiler la page | fait autrement | Repris par BUG-21, clos comme « pas un défaut » (voir ci-dessous) |
| UI-18/Trouvé-2 | `text-primary` sous 4,5:1 | fait | Repris par UI-20 (ci-dessous) |
| UI-18/Trouvé-3 | Décoratifs du jaune clair sous 3:1 | pas fait | Aucune décision ne parle de leur contraste (voir section 6) ; repris dans « Trouvé pendant UI-20 » ; icônes `text-primary` de titre de dialogue de l’admin inchangées |
| UI-18/Trouvé-4 | Neuf Select écrits à la main | pas fait | Hors admin ; 20 `Select.Root` hors `OptionSelect` ; UI-19 ne les a pas repris |
| UI-18/Trouvé-5 | `csvDelimiterOptions` dans un fichier sur les tables | pas fait | `components/admin/csv-tables.ts:47-55` |
| UI-18/Trouvé-6 | Bloc « sans photo » dupliqué | pas fait | Hors admin ; lecture seulement |
| UI-18/Trouvé-7 | `FilterSelect` garde le nom « All … » | pas fait | `FilterSelect.svelte:22` (`aria-label={allLabel}`) |
| UI-18/Trouvé-8 | `h4` (axe `heading-order`, modéré) | pas fait | Rejoué : `heading-order` sur l’import CSV (guide fermé ou ouvert) et `ZipImportInfoDialog`, dans les 12 combinaisons (`$V/dialogs.json`) |

### BUG-21 (P11) : la page défile derrière un dialogue quand on choisit dans un Select

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| BUG-21 critère | Choisir une option dans le Select d’un dialogue ne fait pas défiler la page, à 1280 et 390 px, prouvé par un test qui échoue avant | fait autrement | Clos le 2026-10-29 « sans changement de code : pas un défaut », note datée de l’entrée BUG-21 (« le mainteneur ne l’a jamais vu à la main »), écrite par f82c3f64 (« with the maintainer’s decisions ») ; `status.json` : « pas un défaut, sans commit ». Pas d’entrée dans « Décisions prises », et la décision « Avant la 1.0 (P11, P12) » le décrit encore comme un défaut. Rejoué : 4 dialogues (délimiteurs d’export et d’import, mode de sauvegarde, pays d’une région), page à 400 px, souris (après et pendant l’animation, 120 ms), toucher, clavier, à 1280 et 390, en et fr : 36/36 sans mouvement, ni pendant ni après la fermeture, option choisie (`$V/bug21.json`, `$V/bug21-fr-import.json` : en fr à 390, le délimiteur de l’import est sous la zone défilante du dialogue, qu’il faut d’abord faire défiler, sans bouger la page). `locator.click()` : 6/8 font défiler (400 → 481, 510, 1054, 1131) (`$V/shots/bug21-*-locator-*.png`). Aucun test ne garde ce comportement |
| BUG-21/Trouvé-1 | Toucher dans WebKit mobile laisse la liste ouverte | pas fait | Non testé : seul Chromium est en cache (`~/Library/Caches/ms-playwright`) ; « à vérifier sur un vrai iPhone » |

### API-08 (P9), parties admin

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| API-08 critère (admin) | « Essai à blanc » montre le rapport et la base ne change pas ; lint sans avertissement dans les dialogues d’import | fait | Rejoué (Trouvé-13) ; `$S/p12/gates/2-lint.log` sans avertissement |
| API-08/todo admin | Option des codes-barres décochée à chaque ouverture, tables du serveur, `.CSV`, titres traduits, clés des `{#each}` | fait | Voir a4 m3, Trouvé-14, a4 m7, a4 m9, R4-m8b |
| API-08/Trouvé (admin) | « Proceed with Import » pendant un essai à blanc | pas fait | Rejoué : boutons `["Cancel","Proceed with Import"]`, `["Annuler","Lancer l’import"]` (`$V/repro-csv.json`) |
| API-08/Trouvé (admin) | Valeur par défaut morte `ZipImportInfoDialog.svelte:14` | pas fait | `onProceedWithImport = () => {}` (`$V/greps.log`) |
| API-08/Trouvé (admin) | Pas de test de l’essai à blanc, de `.CSV` ni de la remise à zéro de l’option | pas fait | Seul `routes/api/admin/import-csv/server.test.ts` touche `dryRun` ; aucun test ni e2e des dialogues (`$V/open-items.log`) |

### DATA-12 (P9), parties admin

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| DATA-12/a4 m5 | Plus de coupe à 50 caractères | fait | Voir a4 m5 |
| DATA-12/a4 m6 | Libellé des sauvegardes de sécurité | fait | Voir a4 m6 |
| DATA-12/DATA-08-1 | Avertissement pour une sauvegarde trop grosse | fait | Lecture : `backups/+page.svelte:77,84` (toast `warning` sans fin si `restorable` est faux) ; décision « Sauvegarde trop grosse (DATA-12) ». Pas de sauvegarde de plus de 2 Gio produite |
| DATA-12/DATA-08-2 | Sauvegarde de sécurité téléchargée par le navigateur, sans blob ni attente | fait | `backups/+page.svelte:135-138`, `utils/download.ts:7-14`. Rejoué : événement `download` du navigateur, page rendue sans attendre (`$V/repro-restore.json`) |
| DATA-12/Trouvé (admin) | « Download » de la liste charge le fichier en mémoire | pas fait | `backups/+page.svelte:98-100` → `downloadBlob` → `saveResponse` → `response.blob()` (`client.ts:84-90`, `download.ts:27-32`) |
| DATA-12/Trouvé (admin) | Échec du téléchargement de la sauvegarde de sécurité invisible | pas fait | Même défaut que UI-07/Trouvé-7 (régressé) : V4-m6 |
| DATA-12/Trouvé (admin) | Sauvegarde manuelle nommée « pre-… » étiquetée de sécurité | pas fait | Rejoué : nom « pre-restore-mine » → type `safety-backup-restore` (`$V/open-items.log`) ; `files.ts:32` |

### UI-20 (P11), écrans de l’admin

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| UI-20 critère (admin) | Aucun texte en couleur du thème sous 4,5:1, 8 thèmes clairs et sombres | fait | Rejoué : axe `color-contrast` sur 6 pages admin × 8 thèmes × clair/sombre : 0 violation sur 96 analyses (`$V/themes.json`, `$V/themes.log`). Le seul échec, dans le guide CSV, est un gris, pas la couleur du thème : V4-m2 |
| UI-20/Trouvé (admin) | Icônes `text-primary` sous 3:1 en jaune et orange clairs | pas fait | Noté « Trouvé pendant UI-20 (hors périmètre) » ; la décision « Couleurs décoratives et statuts (UI-18) » ne parle pas de leur contraste (voir section 6) |

### Version affichée dans l’admin (décision « Version de Cellar (REL-03) »)

| Réf | Point | Verdict | Preuve |
|---|---|---|---|
| REL-03 version | Numéro de version dans l’admin | fait | `admin/+layout.svelte:24-26` ; capture « Version 1.0.0-rc.1 » (`$V/shots/dialogs/en-light-1280x900-csv-export.png`, en arrière-plan) |

## 3. Nouveaux constats (passe 2)

### Régressions

**V4-m6. L’échec du téléchargement de la sauvegarde de sécurité ne se voit plus (ajouté par le vérificateur, repris des « Déjà connus » de l’auditeur)**
- Ce qui se passe : après une restauration, un import JSON ou un effacement, la page lance le téléchargement de la sauvegarde des données remplacées par un lien `<a download>` et affiche aussitôt, en vert, « The previous data was backed up in …zip, which your browser downloads. It also stays in the list of backups. » Si le téléchargement échoue (fichier absent, erreur du serveur ou du proxy), Chromium l’annule, et la page n’en sait rien : pas d’avertissement. À l’audit, l’échec donnait un toast `warning` permanent (`previous_data_not_downloaded`). Atténuation : le toast dit que le fichier reste dans la liste.
- Reproduction : `node $V/scripts/restore-fail.mjs` contre l’app construite. La réponse de `POST /api/admin/restore` est réécrite pour nommer un fichier absent (`page.route` n’atteint pas un téléchargement lancé par `<a download>`) ; le serveur répond 404 au téléchargement (`curl` dans `$V/restore-fail.log`), Chromium l’annule (`failure: "canceled"`), la page affiche le seul toast de succès, en et fr.
- Preuves : `$V/restore-fail.json`, `$V/restore-fail.log`, `$V/shots/restore-fail-missing-file-en.png`, `-fr.png` ; auditeur : section 4 de `$A/rapport-axe-4.md`.
- Où : `src/routes/admin/backups/+page.svelte:135-138`, `src/lib/utils/download.ts:7-14`.
- Régression : oui. Corrigé à l’audit (`9df0d08c`, `backups/+page.svelte:126-137`, `downloadBlob` dans un `try`) ; cassé par a700cc93 (DATA-12, 2026-10-23), qui a aussi retiré la clé. Aucune décision ne l’accepte : l’entrée DATA-12 demandait `<a download>` (« sans `response.blob()` ») sans dire que le signal d’échec pouvait disparaître, puis range « l’échec du téléchargement de la sauvegarde de sécurité est invisible » parmi ses « Trouvé pendant (hors périmètre) », comme un point ouvert. Le lead décide s’il le compte ou le range en « Déjà connus ».

**V4-m7. Passer au clavier sur le délimiteur d’un dialogue CSV le change en tabulation (ajouté par le vérificateur)**
- Ce qui se passe : dans « Export to CSV Files » et « CSV Import », un utilisateur au clavier qui passe le champ Délimiteur avec Tab le change, sans le vouloir, de « , » à « Tab » (« Tabulation » en français). `OptionSelect` donne `items` au Select de bits-ui 2.20.0 pour le choix par la première lettre ; sur un déclencheur fermé, bits-ui passe à cette recherche toute touche qui n’ouvre pas la liste, Tab compris (`select.svelte.js:690-691`), et la recherche « Tab » trouve l’option « Tab » ou « Tabulation ». L’export écrit alors des fichiers `.csv` séparés par des tabulations ; l’import lit l’en-tête comme une seule colonne et rejette chaque ligne (« No value for wineName »). Le déclencheur montre bien « Tab ». Aucun autre `OptionSelect` de l’app n’a d’option qui commence par « tab ».
- Reproduction : Admin › Backups › CSV Export, focus dans « Custom filename », Tab (focus sur le délimiteur, toujours « , »), Tab → le délimiteur affiche « Tab » ; exporter Countries → `POST /api/admin/export-csv {"tables":["countries"],"delimiter":"\t"}`. Même chose dans CSV Import : un essai à blanc de `cave-wineBottles.csv` après Tab donne « Row 1: No value for wineName », contre `unknown_wine` avec « , » (`$V/tab-delimiter-control.log`). Script : `node $V/scripts/tab-delimiter.mjs` (en/fr, 1280/390 : 4 sur 4).
- Preuves : `$V/tab-delimiter.json`, `$V/tab-delimiter.log`, `$V/tab-delimiter-control.log`, `$V/shots/tab-delimiter-*.png`, `$V/shots/dialogs/en-light-1280x900-csv-export.png` (délimiteur passé à « Tab » par les 25 tabulations du balayage).
- Où : `src/lib/components/forms/OptionSelect.svelte:40-46` (`items={options}`), `src/lib/components/admin/csv-tables.ts:47-55`, `CsvExportDialog.svelte:140-146`, `CsvImportDialog.svelte:249-255`.
- Sévérité : Mineur. Seul le parcours au clavier est touché, la valeur choisie est affichée, et l’import ne peut rien écrire de faux : il rejette les lignes.
- Régression : oui. À `9df0d08c` les délimiteurs étaient des `<select>` natifs (`CsvExportDialog.svelte:141`, `CsvImportDialog.svelte:247`), que Tab ne change pas ; depuis 4614db09 (UI-18, 2026-10-29).

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

**V4-m1. Les dialogues « Export to CSV Files », « Import Images from ZIP » et, en mode cron, « Auto Backup Settings » dépassent l’écran d’un petit téléphone (confirmé, élargi par le vérificateur)**
- Ce qui se passe : ces dialogues n’ont ni hauteur maximale ni défilement propre. Centrés en `position: fixed`, sur une page verrouillée, ils sortent de l’écran dès qu’ils sont plus hauts que lui. Le haut (titre, croix) et le bas (Annuler, Exporter, Choisir un fichier ZIP, Enregistrer) restent hors d’atteinte : ni la molette ni un glissé ne les ramènent. À 375 × 667 : export CSV −69 → 737 (en) et −86 → 754 (fr), bouton « Export CSV Files » non touchable ; ZIP −78 → 745 (en), −126 → 793 (fr), « Choose ZIP File » non touchable ; réglages des sauvegardes en mode cron (ajouté par le vérificateur) −31 → 699 (en), −74 → 742 (fr), boutons coupés au bas de l’écran. À 390 × 844, le dialogue ZIP en français dépasse déjà (−27 → 872 : titre et croix coupés, bouton touchable). L’import CSV (`max-h-[85vh]`, défilement propre) tient partout. Au clavier, Tab atteint encore les boutons et Échap ferme.
- Reproduction : `node $V/scripts/dialogs.mjs` et `node $V/scripts/cron-dialog.mjs` contre l’app construite ; ou, à 375 × 667, Admin › Backups › CSV Export.
- Preuves : `$V/dialogs.json` (`rect`, `actionHittable:false`, `rectAfterScroll` inchangé), `$V/cron-dialog.json`, `$V/shots/dialogs/fr-light-375x667-csv-export.png`, `fr-light-375x667-zip-info.png`, `fr-375x667-backup-settings-cron.png` ; auditeur : `$A/sweep-dialogs-small.json`, `$A/shots/dialogs-small/`.
- Où : `src/lib/components/admin/dialogs/CsvExportDialog.svelte:91`, `ZipImportInfoDialog.svelte:31`, `BackupSettingsDialog.svelte:89` (`max-w-*` seuls), contre `CsvImportDialog.svelte:85-89`.
- Régression : non. Mêmes classes à `9df0d08c` (`BackupSettingsDialog.svelte:88` pour le troisième) ; hauteurs d’alors non remesurées.

**V4-m2. Le guide de l’import CSV montre ses exemples de noms de fichiers sous 4,5:1 dans les 16 modes (confirmé, chiffres corrigés)**
- Ce qui se passe : la ligne « Examples: countries.csv, 2024-countries.csv » de chaque table est en `text-muted-foreground/80`, ses `<code>` sur `bg-muted/50` (texte de 12 px). Contraste axe : de 3,58 à 3,83:1 dans 7 thèmes clairs, de 4,34 à 4,42:1 en ardoise clair, de 4,02 à 4,41:1 dans les 8 thèmes sombres. Seule violation de contraste de l’admin. UI-20 ne la couvre pas (pas la couleur du thème).
- Reproduction : Admin › Backups › CSV Import › « CSV File Format Guide », axe `color-contrast` ; `node $V/scripts/themes.mjs`.
- Preuves : `$V/themes.log`, `$V/themes.json`, `$V/dialogs.json` (`csv-import-guide`, `color-contrast:serious:6` dans les 12 combinaisons), `$V/shots/themes/yellow-light-csv-guide.png` ; auditeur : `$A/theme-contrast.log`.
- Où : `src/lib/components/admin/dialogs/CsvImportDialog.svelte:185-192`.
- Régression : non. Classe présente depuis edaf50f5, avant l’audit ; `--muted` et `--muted-foreground` inchangés entre `9df0d08c` et `cf48032d` (`git diff` de `theme-colors.ts` et `app.css` sans ligne `muted` modifiée).

**V4-m3. La liste défilante du guide de l’import CSV n’est pas atteignable au clavier (confirmé)**
- Ce qui se passe : le guide liste les 13 tables dans un bloc `max-h-80 overflow-y-auto` sans élément focalisable, et qui ne l’est pas lui-même. Au clavier, on ne fait pas défiler les tables cachées. axe : `scrollable-region-focusable`, sérieux, dans les 12 combinaisons.
- Reproduction : ouvrir le guide ; Tab saute la liste, les flèches ne la font pas défiler.
- Preuves : `$V/dialogs.json` (`csv-import-guide`, cible `.max-h-80`) ; auditeur : `$A/sweep-dialogs-csv-import.json`.
- Où : `src/lib/components/admin/dialogs/CsvImportDialog.svelte:162`.
- Régression : non (même bloc à `9df0d08c`).

**V4-m4. La liste « Wines » de l’admin met les vins sans producteur en tête et trie par octets (confirmé)**
- Ce qui se passe : `/admin/data/wines` suit l’ordre SQL `producer, name` : vins sans producteur d’abord, capitales et accents comptés, numéros triés comme du texte (« Test Wine 0, 12, 16, 20, 24, 4, 8 », puis « Producteur 1 - … »). Les autres tableaux suivent « sans casse ni accents, vides en dernier » ; aucune décision ne vise cette liste, qui n’a pas de tri réglable.
- Reproduction : `node $V/scripts/wines-order.mjs`.
- Preuves : `$V/wines-order.json`, `$V/shots/admin-data-wines-1280.png` ; auditeur : `$A/shots/pages/en-light-1280-admin_data_wines.png`.
- Où : `src/lib/server/features/catalog/repository.ts:133`, lu par `src/routes/admin/data/wines/+page.server.ts`.
- Régression : non (`repository.ts:155` à `9df0d08c`).

**V4-m5. README-Docker envoie vers « Backup & Restore » de la page admin, qui s’ouvre sur Settings (confirmé)**
- Ce qui se passe : README-Docker dit « Open the admin page … In **Backup & Restore**, choose **CSV Import** » (l. 389-392), « **Wipe All Data** (Admin, Backup & Restore) » (l. 295) et « **Backup & Restore** creates one on demand » (l. 457). `/admin` mène à Settings ; « Backup & Restore » est une carte de l’onglet **Backups**, que le texte ne nomme pas, alors qu’il nomme l’onglet **Images** (l. 398).
- Reproduction : suivre « Importing CSV data » sur l’app construite.
- Preuves : `$V/curl-checks.log` (`/admin` 307 → `/admin/settings`), `$V/shots/pages/en-light-1280-_admin_settings.png`.
- Où : `README-Docker.md:295,389-392,457` ; `src/routes/admin/+page.server.ts`.
- Régression : non (même texte à `9df0d08c`, l. 286, 369, 435).

## 4. Déjà connus (non comptés)

- « Download » de la liste des sauvegardes charge le fichier en mémoire (`backups/+page.svelte:98-100`) ; une sauvegarde manuelle nommée « pre-… » est étiquetée de sécurité (`files.ts:32`). Trouvé pendant DATA-12.
- « Proceed with Import » pendant un essai à blanc ; aucun test des dialogues pour l’essai à blanc, `.CSV` et l’option des codes-barres ; valeur par défaut morte `ZipImportInfoDialog.svelte:14`. Trouvé pendant API-08.
- Une erreur dans une page de données de l’admin perd les onglets des tables (`/admin/data/nope`). Trouvé pendant UI-17.
- `FilterSelect` garde le nom « All … » ; `heading-order` modéré (`h4` de l’import CSV et de `ZipImportInfoDialog`) ; `csvDelimiterOptions` dans `csv-tables.ts` ; neuf Select écrits à la main ; bloc « sans photo » dupliqué. Trouvé pendant UI-18.
- Icônes `text-primary` sous 3:1 en jaune et orange clairs. Trouvé pendant UI-18 et UI-20 (verdict discuté en section 6).
- `locator.click()` de Playwright enchaîné à l’ouverture d’un Select fait défiler la page (6 cas sur 8). Entrée BUG-21 et « Trouvé pendant UI-20 ».
- Toucher une option dans WebKit mobile laisse la liste ouverte. Trouvé pendant BUG-21, non testé (pas de WebKit en cache).
- La 2ᵉ question de la suppression en cascade ne nomme pas le vin (`admin.confirm_cascade_delete`, « This wine has 3 bottles… ») : relevé dans le texte d’a4 m1 de l’audit, sans constat.
- Le bandeau des actions de mise à jour garde le texte anglais des notes, avec une phrase qui le dit (`UpgradeBanner.svelte:73-75`) : décision « Branches et versions (REL-01) » (notes de release en anglais).

## 5. Corrections du vérificateur

- UI-07/Trouvé-7 : verdict « régressé » gardé, mais l’auditeur écrit « choix assumé par DATA-12 » et le range en « Déjà connus ». Aucune décision ne l’accepte ; l’entrée DATA-12 le liste comme point ouvert. Rejoué (l’auditeur ne l’avait pas fait) et rapporté en V4-m6, comme le lead le demandait pour une régression non acceptée.
- Ouvert-5 : la ligne de l’auditeur porte deux verdicts (« fait / fait autrement ») ; scindée en Ouvert-5a (fait) et Ouvert-5b (fait autrement), une ligne un verdict.
- UI-18/Trouvé-3 et UI-20/Trouvé (icônes sous 3:1) : « fait autrement » → « pas fait ». La décision « Couleurs décoratives et statuts (UI-18) » fixe la couleur des icônes, pas leur contraste, et n’accepte rien pour l’orange ; seule la note d’UI-20 dit « le jaune déjà accepté par UI-18 ». Voir section 6.
- V4-m1 élargi : le dialogue des réglages des sauvegardes, en mode cron, dépasse aussi à 375 × 667 (en et fr).
- V4-m2 chiffres corrigés : l’auditeur donne 3,58 à 3,83:1 pour tous les thèmes clairs ; ardoise clair est à 4,34-4,42:1.
- V4-m7 ajouté (régression d’UI-18, trouvée parce que le balayage des dialogues de l’auditeur et du vérificateur, 25 à 30 tabulations, laissait le délimiteur sur « Tab »).
- Précisions sans changement de verdict : `POST /api/does-not-exist` sans session répond 401, pas 404 (le 404 JSON vient avec une session, `$V/curl-checks.log`) ; BUG-21 en fr à 390 px : le délimiteur de l’import est sous la zone défilante du dialogue, un clic à son centre ne l’ouvre pas tant qu’on n’a pas fait défiler le dialogue, ce qui ne bouge pas la page (`$V/bug21-fr-import.json`).
- Aucun constat de l’auditeur rejeté ; aucun changement de sévérité.

## 6. Désaccords

- Icônes `text-primary` sous 3:1 (UI-18/Trouvé-3, UI-20/Trouvé). Auditeur : « fait autrement », par la décision « Couleurs décoratives et statuts (UI-18) » et la note « le jaune déjà accepté par UI-18 » de l’entrée UI-20. Vérificateur : « pas fait », car le texte de la décision ne parle pas de contraste, et rien ne couvre l’orange clair (2,75:1). Au mainteneur de dire si la décision vaut acceptation.
- Titre de la page d’erreur de l’admin. L’auditeur compte « 404 - Admin Panel - Wine Cellar » comme preuve d’a4 m8. La décision « Titres de page (UI-17) » dit que « les pages d’erreur gardent « {statut} - Cave à vin » », alors que `admin/+error.svelte:10` donne « 404 - Administration - Cave à vin » (rejoué, `$V/pages.json`). La décision ne dit pas si la page d’erreur gardée dans le layout de l’admin suit la règle des pages d’erreur ou celle de l’admin : point à trancher, non compté.
- BUG-21 : même verdict (« fait autrement »), mais il repose sur une note datée de l’entrée, pas sur « Décisions prises », et la décision « Avant la 1.0 (P11, P12) » le décrit toujours comme un défaut à corriger. Le vérificateur l’accepte comme constat daté du mainteneur ; le lead peut demander une ligne dans « Décisions prises ».

## 7. Renvois

- Axe 5 (UI-17) : V4-m2 et V4-m3 sont deux violations sérieuses d’axe dans l’admin (guide CSV ouvert), alors que le critère d’UI-17 dit « axe ne remonte aucune violation sérieuse sur … l’admin » (mesuré guide fermé). Preuve : `$V/dialogs.json`.
- Axe 5 (UI-18, UI-20) : icônes sous 3:1 dans toute l’app, voir section 6.
- Axe 5 : titre des pages d’erreur de l’admin et décision « Titres de page (UI-17) », voir section 6.
- Axe 5 : le mécanisme de V4-m7 (toute touche passée à la recherche d’un `OptionSelect` fermé) vaut pour chaque `OptionSelect` ; aucun autre n’a d’option qui commence par « tab » (`grep '": "tab'` dans les fichiers de langue), à revoir si des options sont ajoutées.
- Axe 3 (note de l’auditeur, non vérifiée ici) : dans le log e2e des portes, le re-seeding après effacement donne `label_presets.csv: 0 added` (`$S/p12/gates/7-test-e2e.log`).

## Nettoyage

- Serveurs : PID 74682 (premier lancement, port 4545) arrêté par SIGTERM, `ps -p 74682` vide ; PID 78020 (relance sur la même base pour V4-m7) arrêté par SIGTERM, `ps -p 78020` vide ; `lsof` : rien n’écoute sur 4545-4549.
- Worktree `$S/p12/wt-v4` supprimé (`git worktree remove --force`, deux fois : supprimé puis recréé pour V4-m7), absent de `git worktree list`. Aucun fichier suivi modifié, aucun commit.
