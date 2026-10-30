# Audit d'avant 1.0 : synthèse

Commit audité : `9df0d08c` (develop, 2026-10-16), fin de P6. Audit en lecture seule : rien n'a été corrigé, mergé, poussé ni tagué.

## Méthode

- Sept axes, ceux des revues de `docs/roadmap/reviews/`, découpés en treize périmètres étroits (deux ou trois parties pour les axes 2, 3, 5, 6 et 7, plus une partie dédiée au chemin de mise à jour). Un auditeur par périmètre, avec seulement les sources de son périmètre.
- Passe 1 : chaque problème des 7 revues, chaque critère d'acceptation et chaque point « Trouvé pendant » ou « Reste » de la feuille de route reçoit un verdict, avec une preuve dans le code actuel. Les « Décisions prises » font foi.
- Passe 2 : nouveaux constats sur les mêmes axes. L'app a été lancée depuis des worktrees jetables, avec des données inventées. Chromium headless, déjà en cache, a été piloté par le protocole DevTools, sans rien installer. Le banc de mise à jour a été rejoué de 0.1.0 et de 0.7.0 vers develop, hors Docker et dans Docker.
- Vérification : chaque rapport a été repris par un second agent, chargé de le réfuter, qui a rejoué les preuves sur sa propre instance. Un rédacteur par axe a ensuite appliqué les corrections du vérificateur et fusionné les doublons entre axes. Il a aussi vérifié lui-même les points signalés hors périmètre avant de les garder.
- Portes du projet sur ce commit, toutes vertes :
  - `pnpm check`, `pnpm i18n:check` (0 texte en dur), `pnpm knip` et `pnpm build` ;
  - `pnpm lint` : 0 erreur, 104 avertissements ;
  - `pnpm test` : 976 tests sur 110 fichiers.

## Déroulement

1. L'agent principal a lu `AGENTS.md`, la feuille de route (tâches, « Décisions prises », constats et « Reste ») et les sept revues, puis lancé une fois les portes du projet sur `9df0d08c`.
2. Treize auditeurs ont travaillé en parallèle, chacun dans sa worktree jetable, sur ses propres ports et avec ses propres données inventées.
3. Treize vérificateurs ont repris chacun un rapport pour le réfuter.
4. Sept rédacteurs ont écrit les fichiers d'axe, puis l'agent principal a écrit cette synthèse.
5. Tout a été commité sur la branche `docs/audit-pre-1.0`, sans merge ni push. Les worktrees jetables ont été supprimées, et les serveurs et conteneurs arrêtés.

| Auditeur | Axe | Périmètre | Exécution | Vérification |
|---|---|---|---|---|
| a1-data | 1 | Schéma, connexion, migrations, repositories, transactions, séquence des codes-barres, seeding, scripts | App compilée, migration cassée provoquée | 51 lignes revues |
| a2a-auth | 2 | Authentification, session, CSRF, code d'accès | App compilée, en http et en https | 29 lignes revues |
| a2b-api | 2 | API publique hors admin, validation, services de domaine | App compilée, 10 000 bouteilles inventées | 46 lignes revues, 1 ajoutée |
| a3a-backup | 3 | Sauvegardes, restauration, import JSON, effacement, sauvegardes automatiques, cron | App compilée avec les variables de l'image Docker | 47 lignes revues |
| a3b-import | 3 | Import et export CSV, images et envois, référentiels, préréglages d'étiquettes, réglages des codes-barres | Deux instances compilées | 51 lignes revues |
| a4-admin-ui | 4 | Front d'administration | App compilée, Chromium headless | 40 lignes revues |
| a5a-wines | 5 | Liste des vins, page d'un vin, formulaires de vin et de bouteille | App compilée, Chromium headless | 44 lignes revues |
| a5b-front | 5 | Layout, navigation, code mort, utilitaires partagés, Svelte 5, i18n, accessibilité, thème | App compilée, Chromium headless | 77 lignes revues |
| a6a-barcode | 6 | Codes-barres, étiquettes PDF, scanner | App compilée, Chromium avec une caméra factice | 27 lignes revues |
| a6b-pages | 6 | Stockage, historique, hors cave, statistiques, manques, préférences, page racine | App compilée | 49 lignes revues, 1 ajoutée |
| a7a-release | 7 | Docker, CI, releases, contrôle de mise à jour, documentation | Image Docker construite et lancée | 30 lignes revues |
| a7b-arch | 7 | Outillage, dépendances, architecture transverse, qualité des tests | `pnpm audit`, `outdated` et `why` | 63 lignes revues, 2 ajoutées |
| a7c-upgrade | 7 | Chemin de mise à jour de 0.1.0 et de 0.7.0 vers develop | Banc hors Docker et dans Docker | Constats seulement |

Incident : a7c a lancé `pnpm install` dans une worktree v0.1.0 imbriquée. Sans `pnpm-workspace.yaml` dans ce tag, pnpm est remonté jusqu'au checkout principal. Il y a réaligné `node_modules` sur le lockfile de develop, qui était le même commit, et régénéré les dossiers ignorés `src/lib/paraglide/` et `.svelte-kit/`. `git status` y est resté propre et aucune donnée n'a été touchée (axe 7, « Note pour qui rejoue le banc »).

## Résultats en chiffres

| Axe | Fichier | Lignes de traçabilité | Corrigé | Partiel | Non fait | Sans objet | Écart décidé | Majeurs | Mineurs |
|---|---|---|---|---|---|---|---|---|---|
| 1 Données et scripts | `axe-1-donnees.md` | 78 | 65 | 3 | 8 | 1 | 1 | 1 | 8 |
| 2 API publique, auth, sécurité | `axe-2-api-securite.md` | 107 | 101 | 1 | 0 | 1 | 4 | 0 | 9 |
| 3 API admin | `axe-3-api-admin.md` | 100 | 89 | 3 | 5 | 2 | 1 | 3 | 15 |
| 4 Front admin | `axe-4-front-admin.md` | 65 | 51 | 2 | 10 | 2 | 0 | 0 | 9 |
| 5 Interface principale | `axe-5-interface.md` | 184 | 134 | 7 | 34 | 6 | 3 | 1 | 22 |
| 6 Pages fonctionnelles et codes-barres | `axe-6-pages.md` | 105 | 82 | 0 | 19 | 3 | 1 | 2 | 19 |
| 7 Infra, CI, Docker, releases, docs | `axe-7-infra.md` | 99 | 76 | 8 | 9 | 1 | 5 | 0 | 22 |
| **Total** | | **738** | **598** | **24** | **85** | **16** | **15** | **7** | **104** |

Aucun constat Critique. Les 58 tâches de la feuille de route ont toutes leur critère d’acceptation tenu. Les lignes « Non fait » sont presque toutes des « Reste » laissés exprès pour cet audit, et aucune ne remet en cause un critère.

Ce que l'audit a prouvé en direct, en plus des critères :
- **Sécurité :**
  - sans session, toutes les écritures et tout `/api/admin/**` reçoivent 401 ;
  - avec une origine étrangère ou `Origin: null`, les 77 écritures, form actions de `/wines` comprises, reçoivent 403 ;
  - la 6e tentative de code reçoit 429.
- **Sauvegardes :**
  - le cycle sauvegarde → effacement → restauration rend données, images, réglages et compteurs de codes-barres ;
  - 7 zips corrompus ou piégés sont refusés, la base restant intacte.
- **Codes-barres :** 568 étiquettes imprimées en page 1 sur 112 combinaisons de préréglages se décodent.
- **Mise à jour :**
  - de 0.1.0 et de 0.7.0 vers develop, aucune perte de données, et les 10 actions attendues s'affichent ;
  - le retour à une version plus ancienne est refusé sans rien écrire ;
  - le `chown` de l'action 0.2.0 répare des volumes appartenant à root.

Constats écartés à la vérification :
- le bandeau « ORIGIN manquant » (écart décidé REL-02, repris en décision ci-dessous) ;
- l'absence de confirmation pour régénérer le jeton cron (un avertissement est déjà affiché) ;
- les actions 0.8.0 de pdf-labels et import-csv (décidé : une phrase dans les notes, pas d'action) ;
- `{@html}` dans les dialogues d'import (seules des constantes y passent).

L'option « Remplacer tous les codes-barres » passe de Majeur à Mineur : le comportement est voulu, seule l'aide est à corriger.

## 1. Bloquants pour la 1.0

### Prérequis de publication, prévus par des décisions

- **R1. Retirer l'exception Paraglide** de `pnpm-workspace.yaml` dans un commit dédié, après le 2026-10-16 à 23:07 UTC. `pnpm install --frozen-lockfile` doit encore passer. Le commentaire du bloc, qui dit « branche p6/ui-10 seulement », part avec lui (axe 7, m1).
- **R2. Visibilité et protection** (décisions « Visibilité » et « Protection des branches ») :
  - rendre publics le dépôt et le paquet GHCR, puis réécrire les passages de README-Docker qui supposent une image privée ;
  - activer la protection de `main` ;
  - écrire dans `RELEASING.md` la règle de versions 1.x qui remplace celle de 0.x (axe 7, section « À faire avant 1.0.0 »).
- **R3. Notes de version justes.**
  - Le résumé 0.8.0 dit que `/` redirige côté serveur, ce qui est faux depuis fbfaf8a9 (axe 7, m2).
  - L'action 0.2.0 sur le mode cron dit deux choses fausses depuis 0.6.0 : il faut la reformuler sur place, sans nouvelle action (axe 7, m21).
  - Le résumé 0.8.0 annonce aussi des noms accentués triés « en place » : faux pour l'historique et le hors cave (axe 6, m2), à corriger selon la décision D7.

### Défauts à corriger avant la 1.0

Données perdues ou fausses sans message : un cellier ne doit pas pouvoir corrompre ses propres données en 1.0.

- **B1. Une note masquée écrase les notes** (axe 6, M2). Dans le dialogue de changement de statut, une note tapée sous « Consommée » est encore envoyée après le passage à « Disponible ». Elle remplace alors les notes de toutes les bouteilles sélectionnées, reproduit dans le hors cave, `BottleDetailsDialog` et la page vin. Correction en une ligne dans `newStatus` (`bottle-changes.ts`).
- **B2. Un champ numérique mal lu enregistre une valeur fausse sans erreur** (axe 5, M1). Dans un Chrome anglais avec l'app en français, « 12,5 » devient 125 ; « 1e » efface le prix. Correction : `type="text" inputmode="decimal"`, et `formNumbers` qui lit la virgule. Elle dépend de la décision D5.
- **B3. L'import CSV fond deux vins qui ne diffèrent que par le type** (axe 3, M3). Le second vin est perdu, et ses bouteilles sont rattachées au premier, même dans une cave vide. Correction : le type entre dans la clé du vin, et une clé ambiguë est signalée.
- **B4. Une sauvegarde de plus de 500 Mo faite par Cellar ne se restaure plus** (axe 3, M1, avec a4 UI-07/Reste-3).
  - Cellar crée cette sauvegarde sans avertir.
  - La restauration depuis la liste la télécharge dans le navigateur, puis la renvoie, et reçoit 413.
  - Correction : restaurer côté serveur par le nom (décision D3).
- **B5. Restaurer ou importer un zip occupe environ cinq fois sa taille en mémoire** (axe 3, M2) : 1 Go de plus pour un zip de 200 Mo, à mettre en regard de la RAM d'un NAS. À traiter avec B4. La restauration par nom supprime l'envoi ; l'envoi d'un fichier choisi sur le disque doit passer en flux.
- **B6. Millésime 0** (axe 1, M1, avec a6 UI-04/Trouvé-3, décision D1).
  - **Origine :** jusqu'à 0.6.0, l'import CSV écrivait 0 pour un millésime vide, et aucune migration ne l'a converti.
  - **Lu comme une année :** cartes (« 0-2018 »), statistiques (décennie « 0 »), historique, CSV et étiquettes.
  - **Lu comme absent :** filtre « sans millésime » et page vin.
  - **Correction proposée :** une migration 0 → NULL, puis empêcher un nouveau 0.
- **B7. Préréglages d'étiquettes livrés faux** (axe 6, M1 et m3).
  - Les préréglages Avery ont 2 mm d'espacement vertical : 27 étiquettes au lieu de 30 sur une planche 5160, jusqu'à 15 mm hors des découpes.
  - Cinq autres préréglages livrés sont refusés par le PDF (DK-22210, Dymo 30320, Zebra 2x1, Generic 40x25, Generic 50x30), et l'API des préréglages enregistre des réglages que le PDF refuse.
  - Ce défaut existe depuis 0.1.0, et chaque installation a ces préréglages en base. Correction : corriger le CSV livré, et ajouter une migration qui ne réécrit que les préréglages encore à leurs valeurs d'origine (décision D6).
- **B8. Contrat de l'API figé pour la 1.0** (axe 2, m1, avec a6 UI-04/Reste-2, UI-09/Reste-7b et a4 UI-07/Reste-5, décision D2). 31 couples route × méthode n'ont aucun appelant dans l'app, dont `PUT /api/bottles/{id}` et `DELETE /api/storage-cases/{id}`. Pourtant, les notes de 0.7.0 en recommandent certains aux scripts. Trois décisions se contredisent : UI-04 et UI-09 les gardent « jusqu'à l'audit », API-06 les dit supprimés. Il faut trancher avant la 1.0, parce que la 1.0 fige ce contrat.

### Proposition de calendrier

Le plan convenu le 2026-10-13 tient. Publier d'abord P6 en **0.8.0**, après R1, et après R3 pour le résumé 0.8.0. Les corrections B1 à B8 et les tâches choisies ci-dessous partent ensuite en 0.9.x, puis 1.0.0 après R2. B6 et B7 apportent des migrations, et B8 peut demander une action de mise à jour conditionnelle « scripts ».

## 2. Le reste, en tâches proposées

Les numéros renvoient aux fichiers d'axe (« a3 m9 » : axe 3, Mineur m9). Chaque tâche regroupe les constats et les lignes Partiel ou Non fait qui touchent les mêmes fichiers.

| Tâche | Contenu | Sources |
|---|---|---|
| T1. Restauration et sauvegardes robustes (avec B4, B5) | Écritures retenues pendant l'effacement ; fichiers d'images orphelins retirés ; réglages de sauvegarde et actions de mise à jour après une restauration (D8) ; nom long → 422 au lieu de 500 ; sauvegardes « auto » d'avant 0.6.0 ; sauvegardes de sécurité étiquetées ; limite de nom alignée sur le serveur ; nettoyage des dossiers temporaires au démarrage et `.gitignore` ; import JSON : erreur disque en 422, images copiées hors du verrou | a3 m1–m6, DATA-05/Reste-1 et Reste-4, R3-m16 ; a4 m5, m6 |
| T2. Images | Zip d'images en flux, plantage du serveur sur une image illisible ; import zip sans contrôle du contenu, `.bmp` accepté et servi (contre SEC-06) ; renommage (500, extension libre, fichier renommé avant la ligne) ; limite 20 Mo / 10 Mo ; recherche par nom d'origine ; image orpheline après abandon ; image de 20 Mo refusée en 413 | a3 m11–m15, R3-m12, R3-m15, DATA-05/Reste-3 ; a5 m5, UI-06/Reste-2 ; a7 m17 |
| T3. Import CSV | Rapprochement par nom seul (régions, appellations, cases), CSV aux lignes inégales ; aide de « Remplacer tous les codes-barres » ; casse des référentiels (D9) ; rapport qui liste chaque ligne sautée (500 après écriture sur un gros fichier) ; colonne `filename` fausse ; côté admin : essai à blanc, tables reconnues par le serveur, option restée cochée, `.CSV` refusé, id de table brut, props mortes, `{#each}` sans clé | a3 m7–m10, API-04/Reste-1 et 2 ; a4 m3, m4, m7, m9, R4-m8b, UI-07/Trouvé-13, 14, Reste-1a, 1b |
| T4. Codes-barres | Comparaison par `LIKE` (casse, préfixes plus longs) ; POST qui remplace un code donné ; codes donnés aux bouteilles bues ; saisie groupée sensible à la casse ; réglages non rechargés après reconnexion ; saut de numérotation après un préfixe numérique ; zone blanche recopiée, bornes 0 et 1 | a6 m1, m5, m6 ; a2 m3, m4 ; a5 m6, m20, m21 ; a1 DATA-06/Trouvé-1 (D15) |
| T5. Étiquettes et scanner (avec B7) | Hauteur contrôlée contre barres dessinées, boutons actifs sur une plage invalide, formulaire par défaut invalide, zone blanche DK-11204 ; bornes HTML du formulaire ; limites connues du scanner (D15), message HTTPS faux | a6 m16, m17, UI-08/Reste-1–3, Trouvé-3d, Trouvé-4a–d |
| T6. Historique, hors cave, statistiques, manques | Tri par octets et tri « date de consommation » (D7) ; contrôles en double ; « Millésimes récents » vide ; prix 0 → N/A ; moyenne sans prix à 0,00 € ; régions homonymes fusionnées ; code mort ; règles sans test ; tri secondaire de `winesBelowTarget` | a6 m2, m4, m8–m12, m14, m15 ; a4 UI-07/Trouvé-3, 4, Reste-4 ; a5 UI-05/Reste-3 |
| T7. Stockage | Restes d'UI-09 (position 0, renommage d'une case importée, brouillon ancien, capacité vidée, conteneur seul, cases de même nom) ; « Column » retiré au milieu d'un nom ; une icône par place ; noms de cases collés ; `confirm()` natif et suppression de préréglage sans confirmation ; tri de `listContainers` | a6 m7, m13, m18, m19, R6-m6c, UI-09/Reste-1–6 ; a1 m1 ; a5 UI-06/Reste-1 |
| T8. Liste des vins et dialogues de bouteilles | Dialogue de statut et de déplacement en quatre copies ; `WineListView` (957 lignes), filtres dans l'URL (D16) ; `/wines` qui envoie chaque bouteille avec une copie de son vin (1,4 Mo pour 700 bouteilles) ; recherche par code-barres sur les bouteilles bues ; « Ajouter une bouteille » qui reprend un vin annulé ; « Consommée » sans date bloquée en silence ; prix négatifs (D10) ; chargement des cases en trois copies ; confirmation de suppression qui survit à la navigation | a5 m1–m4, m14, m22, R5-M6c, R5-M6g, R5-m7, R5-m11, R5-m24, R5-Refacto-structure, -filtres-URL, -5, -6a, -6c ; a4 m1 |
| T9. API : format et cohérence (après B8) | `/api` inconnu en 404 HTML, 405 en texte ; PUT de réglages qui répondent `{ success: true }` ; 200 sur un vin inconnu ; deux DELETE de bouteille ; `backup-token` hors `apiHandler` ; champs à plat, replis morts, noms trompeurs ; durée de session expliquée | a2 m2, m5–m9, R2-m5a ; a1 m8, R1-m4a |
| T10. Thème, accessibilité, pages d'erreur | `color-scheme` sombre, contrastes de trois thèmes et du rouge sombre, couleurs gardées après un passage au clair, bordures des champs, deux `h1`, « Connexion » au premier rendu, `SearchableSelect` au clavier, page préférences, titres de page, `src/error.html`, `admin/+error.svelte`, plantage sans stockage local | a5 m8–m13, m15, UI-10/Reste-1–4, 10 ; a4 m8 |
| T11. Textes et i18n | Toasts qui enveloppent le 401, « Wine Definition » en anglais, 75 clés en double, typographie de `fr.json`, `check-i18n.mjs` sans test, `{reason}` anglais, BMP cité, « Casier » ; bandeau d'actions de mise à jour qui perd une coche | a5 m16–m19, UI-10/Trouvé-1b, Reste-5–9, 13 ; a4 m2 |
| T12. Données, seeding et migrations | Noms vides au seeding ; message de migration sans nom de fichier ; `foreign_key_check` à chaque démarrage ; `appellations.csv` en latin1 ; chaîne de 0004 ; `migrations.ts` → `seed.ts` ; requêtes et horodatages recopiés (`$defaultFn`) | a1 m2, m5, m7, DATA-02/Reste-1, DATA-03/Reste-1, DATA-07/Reste-1–3, R1-m8b ; a7 m19 |
| T13. Image Docker et CI | Démarrer l'image jusqu'à `healthy` avant publication ; `prepare` qui ne peut pas échouer ; `.dockerignore` ; image de base non épinglée ; healthcheck en double (D13) ; jsPDF optionnel, kysely, binaires better-sqlite3 d'autres plateformes ; garde CI `schema.ts` / `drizzle/` ; `check-origin.mjs` qui hérite de `DATABASE_PATH` ; numéro de version de develop entre deux tags (D4) ; runner arm64 | a7 m3, m5, m7, m8, m11, m12, m22, R7-m3, DEP-04/Reste-5, QA-04/Reste-1 ; a1 m3, m4 |
| T14. Documentation | Listes « ce que lance la CI » ; exemple `:3000` du log ORIGIN ; « Wine Cellar » et `docker-setup.sh` ; AGENTS.md sur la règle des routes ; README-Docker : chemin `data/cellar.db` en dur, lien symbolique, WAL sur partage réseau, `Content-Type` des scripts ; `BODY_SIZE_LIMIT` hors Docker ; « - undefined » de la feuille de route (virgule en trop dans la tâche UI-10 de `tasks.mjs`) ; phrase CSRF de la tâche API-01 de `tasks.mjs` | a7 m4, m6, m9, m10, m18, DEP-03/Reste-2 ; a1 DATA-01/Reste-1–3 ; a2 R2-m5a |
| T15. Dépendances, lint et tests | Correctifs publiés depuis plus de 7 jours (revue groupée avant le tag) ; `@types/node` ; ESLint périmé et convention de logs ; scripts de CI, zip d'images, `/uploads` et `safeUrl` sans test ; copies de migrations des tests jamais supprimées ; `scripts/` non typés ; alias shadcn ; `Vary`, `check:watch`, ENOENT de `prepare` | a7 m13–m16, m20, R7-M4c, DEP-03/Trouvé-5 ; a1 m6 ; a5 m7, UI-10/Reste-11, 12, 14 |
| T16. Architecture cible de la revue 7 (selon D14) | `src/lib/db` hors de `src/lib/server`, composants par feature, Playwright, palette « blue » dupliquée, composants maison dans `ui/`, `<select>` bruts, couleurs en dur | a7 R7-Archi-1, 3, 7, R7-m5c, R7-m8a–c |

## 3. Décisions qui te reviennent

À trancher avant les corrections bloquantes :

- **D1. Millésime 0 (B6).** Je propose que 0 veuille dire « sans millésime », avec une migration 0 → NULL. Reste à choisir entre relever la borne basse à 1 et transformer 0 en vide à la validation, ce qui rouvre « millésime 0-9999 » d'UI-06. Si 0 est au contraire une vraie année, il faut corriger le filtre, la page vin et la recherche.
- **D2. Routes sans appelant (B8).** Trois options :
  - API interne : tout supprimer, avec une action conditionnelle « scripts », ce qui contredit les notes de 0.7.0 ;
  - API publique documentée : tout garder et documenter, sauf au moins `PUT /api/bottles/{id}` ;
  - mixte : garder ce que les notes publiées promettent.

  Dans tous les cas, accorder UI-04, UI-09, API-05 et API-06. Reformuler aussi la phrase d'API-05 « un champ inconnu est refusé (422) », vraie pour PATCH seulement.
- **D3. Restauration (B4, B5).** Confirmer que la limite de 500 Mo (SEC-07) ne vise que les envois, et qu'une sauvegarde de la liste se restaure côté serveur par son nom. Passer restauration et import JSON en corps brut change l'API des scripts : une phrase dans les notes, ou une action ?
- **D4. Versions.**
  - Confirmer le calendrier : 0.8.0, puis 0.9.x, puis 1.0.0.
  - Fixer la règle des versions en 1.x.
  - Décider de la numérotation de develop entre deux tags. Aujourd'hui, un build de develop se déclare 0.7.0 : il ne refuse pas un retour à 0.7.0 et ne montre pas l'action 0.8.0.
- **D5. Champs numériques (B2).** Accepter « 12,5 » avec une virgule quelle que soit la langue du navigateur ?
- **D6. Préréglages livrés (B7).** Accepter une migration qui réécrit les préréglages encore à leurs valeurs d'origine ? Les cinq préréglages refusés : passer en QR, ou les retirer ? DK-11204 a 9,3 modules de blanc au lieu de 10 : corriger ou accepter ?

À trancher pour le reste :

- **D7. Tri de l'historique et du hors cave.** Trier comme les autres tableaux (casse, accents, vides en fin), ou garder le tri SQL et corriger la note 0.8.0 ? Changer de filtre garde-t-il le tri ? Hors « Consommées », que trie « date de consommation » ?
- **D8. Après une restauration**, les réglages de sauvegarde automatique et les actions de mise à jour viennent-ils de l'instance ou de la sauvegarde ? Aujourd'hui, les premiers viennent de la sauvegarde, ce qui peut couper les sauvegardes, et les secondes de l'instance.
- **D9. Casse des noms.**
  - Les référentiels deviennent-ils insensibles à la casse (règle API-03, avec un index unique après fusion des doublons) ?
  - Les noms de cases deviennent-ils uniques, et les doublons existants sont-ils renommés ou fusionnés ?
  - Un séparateur automatique entre conteneur et case renommerait les cases existantes.
- **D10. Règles de saisie.**
  - Une bouteille « Consommée » exige-t-elle une date (nouvelle règle serveur), ou les dialogues cessent-ils de l'exiger ?
  - Les prix sont-ils bornés à 0 ?
  - Les images orphelines sont-elles acceptées et documentées, ou supprimées à l'annulation ?
- **D11. Bandeau « ORIGIN manquant » (REL-02).** Sans `ORIGIN` en http simple, la première connexion reçoit 403 : l'utilisateur visé ne voit donc jamais ce bandeau. Garder la décision ?
- **D12. Dépendances acceptées.** esbuild 0.18, tiré par drizzle-kit et bloqué en amont : l'accepter nommément, comme esbuild 0.19 ? kysely en production : l'ajouter à « Types en production », ou le retirer de l'image ?
- **D13. Healthcheck.** Lequel garder, celui du Dockerfile ou celui du compose, et avec quels délais ?
- **D14. Architecture cible de la revue 7.** La poursuivre ou l'abandonner : `src/lib/db` sous `server`, composants par feature, Playwright.
- **D15. Limites acceptées seulement dans les entrées « Fait » ou dans la doc**, à inscrire ou non dans « Décisions prises » :
  - code manuel à 10 chiffres sous un préfixe vide (DATA-06) ;
  - chaîne de 0004 (DATA-07) ;
  - arrêt de `vite dev` sur une migration cassée ;
  - limites du scanner (UI-08/Trouvé-4) ;
  - les deux limites de SEC-03 : éviction au-delà de 10 000 clients, allocation partagée derrière la redirection de ports de Docker.
- **D16. Choix plus petits.**
  - « Ajouter un vin » aussi en anglais ?
  - Fusionner les clés i18n de même texte dans `common.*` ?
  - Les filtres de la liste des vins dans l'URL ?
  - Correspondance des codes-barres sensible à la casse d'abord ?
  - Une coche d'action de mise à jour visible jusqu'à la visite suivante ?
  - Convention de logs du conteneur ?
  - Colonne du type ajoutée à l'export CSV des bouteilles (B3) et nouvelle forme de la réponse de l'import CSV (a4 m9) : une phrase dans les notes suffit-elle ?
