# Feuille de route Cellar

Revue du code du 2026-10-08, commit `556c7bb`. Ce fichier est la version pour les agents : une entrée par tâche, avec assez de contexte pour rédiger un ticket ou la traiter.

- Statuts : `status.json`, repris sous chaque tâche. Pour en changer un : `node docs/roadmap/status.mjs <ID> <todo|doing|done|blocked> [note]`, qui régénère aussi ce fichier.
- Page de suivi, en lecture seule : `node docs/roadmap/build.mjs`, puis ouvrez `docs/roadmap/roadmap.html` (non versionnée).
- Rapports détaillés, avec `fichier:ligne` et scénarios : `docs/roadmap/reviews/` (les références `review-N-*.md#X` des tâches y renvoient).
- Les numéros de ligne datent de l’audit : revérifiez-les avant de modifier le code.

## Règles pour les agents

1. Une tâche par branche, créée depuis `develop` et mergée dans `develop` (rebase puis fast-forward). `main` ne reçoit que les versions publiées. Respectez les dépendances (`Dépend de`).
2. Avant de coder, relisez la section citée dans `Sources` et vérifiez que le problème existe toujours.
3. La tâche est terminée quand son critère d’acceptation est vérifié et que `pnpm check`, ainsi que `pnpm test` et `pnpm lint` une fois en place (QA-01, QA-02), passent.
4. Avant le merge dans `develop`, passez la tâche à « Fait » dans un dernier commit de la branche : `node docs/roadmap/status.mjs <ID> done "<note>"`, la note donnant le numéro de la PR ou la plage de commits, puis commitez `status.json` et `ROADMAP.md`.

## Décisions prises

- **Accès (SEC-02)** : Lecture libre, écriture protégée : consulter la cave reste libre ; toute écriture et tout /api/admin, y compris les GET sensibles, exigent une session côté serveur.
- **Suppression d’une case (DATA-03, UI-09)** : Refusée (409) si la case contient des bouteilles disponibles ; les bouteilles sorties perdent seulement leur lien (ON DELETE SET NULL).
- **Suppression d’une image (DATA-03, BUG-02)** : L’API répond 409 avec la liste des vins concernés, puis « Supprimer quand même » retire l’image de ces vins et la supprime (ON DELETE SET NULL).
- **Formulaires (UI-06, DEP-01)** : zod partagé, form actions natives et use:enhance, avec un helper d’erreurs maison ; superforms, formsnap et les remote functions sont écartés.
- **Fraîcheur des dépendances (SEC-08)** : pnpm n’installe que des versions publiées depuis au moins 7 jours (`minimumReleaseAge: 10080` dans pnpm-workspace.yaml). Pour un correctif de sécurité urgent, exception ponctuelle via `minimumReleaseAgeExclude`, retirée ensuite.
- **Branches et versions (REL-01)** : Le travail se fait sur `develop` ; `main` ne reçoit que les versions publiées. SemVer en 0.x pendant le nettoyage : le numéro mineur augmente à chaque phase publiée et dès qu’une mise à jour demande une action manuelle, le correctif sinon. 1.0.0 ensuite, selon « Versions après 0.8.0 (REL-01) ». Tags `-rc` sur develop (image `:dev`), tags définitifs sur main (`:latest`). Notes de release, CHANGELOG et UPGRADING en anglais.
- **Préfixe de code-barres (SEC-05)** : Lettres majuscules ou minuscules, chiffres et tiret, 6 caractères au plus (`^[A-Za-z0-9-]{0,6}$`) : les préfixes déjà enregistrés en minuscules restent valides.
- **Formats d’image (SEC-06)** : Seuls JPEG, PNG, WebP et GIF sont acceptés, reconnus par leur contenu. Pas de SVG (script possible) ni de HEIC (affiché seulement par Safari ; iOS convertit déjà en JPEG à l’envoi).
- **Taille des requêtes (SEC-07)** : `BODY_SIZE_LIMIT` à 512 Mo pour tout le serveur, au-dessus des 500 Mo acceptés par la restauration et les imports ; chaque route garde sa limite plus basse et répond 413 avant de lire le corps. La limite de 500 Mo ne vise que les fichiers envoyés : une sauvegarde déjà sur le serveur se restaure ou s’importe par son nom, sans envoi ni limite. La restauration et l’import JSON reçoivent le zip en corps brut, écrit sur disque en flux ; pour les scripts, une phrase dans les notes de version suffit, sans action de mise à jour (décision du 2026-10-17, audit d’avant 1.0). La sauvegarde est désignée par `{ "filename": … }`, comme pour `DELETE /api/admin/delete-backup` ; seul `application/zip` est accepté pour un envoi brut. L’image ne règle pas `NODE_OPTIONS` : `--max-semi-space-size` à 1 ou 4 réduisait la mémoire mais ralentissait toutes les requêtes de 8 à 15 %, et un ralentissement permanent des pages n’est pas accepté (décisions du 2026-10-17, DATA-08).
- **Code d’accès (SEC-03)** : Minimum de 4 caractères, à la demande des utilisateurs : Cellar est prévu pour un réseau local ou un VPN, pas pour Internet sans protection devant. Choisir le premier code (installation neuve, ancien code 1234, réinitialisation) exige un jeton à usage unique affiché dans les logs du conteneur ; les codes déjà choisis ne changent pas.
- **Cookie de session (SEC-02)** : `SameSite=Lax` : arriver par un lien depuis un autre site garde la session ; les écritures inter-sites restent bloquées par Lax et par le contrôle d’origine (SEC-01).
- **Visibilité (REL-01)** : Le dépôt et le paquet GHCR restent privés jusqu’à la 1.0.0. La documentation ne suppose pas qu’on peut télécharger l’image : les commandes ponctuelles utilisent `alpine` ou l’image que le conteneur fait déjà tourner.
- **Formatage (QA-02)** : Indentation de 4 espaces pour le code, 2 pour JSON, YAML et Markdown : c’était déjà le style majoritaire (décision du 2026-10-10).
- **Plages de versions (DEP-02)** : Dans package.json, une plage commence à la version installée (`^5.57.1`, pas `^5.0.0`) : le minimum déclaré est celui qui a été testé.
- **Écarts acceptés (DEP-01)** : `@internationalized/date` reste, car bits-ui l’exige comme dépendance pair. html5-qrcode a été retiré par DEP-05, qui le remplace par barcode-detector.
- **Protection des branches (QA-04)** : `main` doit refuser les force-push et la suppression, mais GitHub ne protège pas les branches d’un dépôt privé sur un compte gratuit : à activer quand le dépôt devient public (1.0.0) ou avec GitHub Pro. D’ici là, seul le lead pousse `main`, et seulement pour une version publiée. Pas de contrôle obligatoire sur `develop`, qui reçoit des pushs directs : la publication reste bloquée par le job `verify` de `release.yml`.
- **Sauvegardes par cron (DATA-05)** : Le jeton du mode cron est généré par Cellar dans les réglages de sauvegarde, stocké haché, affiché une fois et régénérable, et envoyé en `Authorization: Bearer`. Pas d’action de mise à jour : depuis 0.2.0 un appel cron reçoit 401 et l’action 0.2.0 renvoyait vers le planificateur interne ; le retour du mode cron est annoncé dans le résumé de 0.6.0 (décision du 2026-10-12).
- **Sélection d’images (BUG-12)** : Changer la recherche retire de la sélection les images qu’elle masque : on supprime exactement ce qu’on voit (décision du 2026-10-11).
- **Noms des fichiers téléchargés (BUG-10)** : Les noms restent libres à la création. L’en-tête `Content-Disposition` porte un nom ASCII de repli et le vrai nom en `filename*=UTF-8''…` (RFC 6266), ce qui débloque aussi les sauvegardes déjà créées (décision du 2026-10-11).
- **En-tête du seeding (BUG-11)** : Corrigé en P2 sans attendre DATA-07 : le seeding saute la ligne d’en-tête, et une migration supprime le pays « Pays », la région « Région » et l’appellation « Appellation » seulement s’ils sont enchaînés entre eux et que rien ne les utilise. Aucune action pour l’utilisateur (décision du 2026-10-11).
- **Version 0.4.0 (REL-01)** : P2 est publiée en 0.4.0 après le lot 3. L’entrée de `releases.json` est créée au début du lot 2 et complétée à chaque merge. Action conditionnelle : avant 0.4.0, l’export CSV de codes-barres donnait des codes de 13 caractères, qui ne correspondent à aucune bouteille ; les étiquettes imprimées depuis ce CSV sont à réimprimer (décision du 2026-10-11). Corrigé après la revue de BUG-08 : l’ancien PDF coupait le code-barres à droite, et 22 combinaisons modèle × code sur 56 ne se scannaient pas ; l’action demande donc aussi de scanner une étiquette par planche PDF et de réimprimer celles qui échouent.
- **Anciens codes-barres (BUG-01, DATA-06)** : Corrigé avant le tag 0.4.0-rc.1 : la numérotation reprend après les codes à 13 caractères générés avant septembre 2025 (préfixe + numéro sur 13 caractères) au lieu de repartir à 1. Avec un préfixe qui contient une lettre ou un tiret, tous ces codes comptent (trop grand → 409 « préfixe épuisé ») ; avec un préfixe vide ou numérique, un code à 13 chiffres ne compte que si son numéro tient dans le format à 10 caractères, pour qu’un EAN-13 manuel ne décale pas la séquence (décision du 2026-10-11).
- **Scanner (DEP-05)** : html5-qrcode est remplacé en P3 par `barcode-detector` (API `BarcodeDetector`, zxing-wasm en repli) pour lire les Code 128 sur fond sombre dans tous les navigateurs, iPhone compris (décision du 2026-10-11).
- **Ajouts de P2 gardés (BUG-05, BUG-06)** : On garde la ligne « Millésime : 2010-2020 » des cartes de vins, le tri par nombre de bouteilles et le composant PieChart partagé des statistiques, ajoutés sans être demandés (décision du 2026-10-11).
- **Exception SvelteKit 3.0.1 (DEP-03)** : Exception ponctuelle à la règle des 7 jours, accordée par le mainteneur le 2026-10-11 hors cas de sécurité : `@sveltejs/kit@3.0.1` (publié le 2026-10-06), version exacte, entre dans `minimumReleaseAgeExclude` dans le commit de DEP-03. Aucune autre version n’est exemptée : vite 8.3.2, nanoid 6.0.1 ou `crypto.randomUUID()` ; toute autre version bloquée arrête la tâche. Le 2026-10-12, le mainteneur a choisi de publier la 0.5.0 avant que 3.0.1 ait 7 jours (6 jours et 16 h), avec l’exception encore en place, pour pouvoir merger P4. L’exception est retirée dans un commit dédié sur develop à partir du 2026-10-13 à 01:34 UTC : ce retrait part dans la 0.6.0, et `pnpm install --frozen-lockfile` doit encore passer. Retirée le 2026-10-13 (203abf2) : `pnpm install --frozen-lockfile` passe encore, et la 0.6.0 est sortie sans l’exception.
- **Types en production (DEP-04)** : Depuis REL-05 (2026-10-28), `pnpm prune --prod --no-optional --ignore-scripts` écarte de l’image `@types/better-sqlite3`, `@types/node` et kysely, que pnpm installe comme dépendances optionnelles de drizzle-orm, ainsi que les dépendances optionnelles de jspdf, sans hook `.pnpmfile.cjs`. Avant, les types (environ 2,5 Mo) et kysely (environ 6 Mo) étaient acceptés dans l’image, sans effet à l’exécution (décisions du 2026-10-12 et du 2026-10-17).
- **Contrôle CSRF maison (SEC-01, DEP-03)** : `src/lib/server/csrf.ts` reste à côté du contrôle de SvelteKit 3 : il coûte peu, couvre tous les types de contenu et le mode dev. À réexaminer dans API-06, avec un test qui montre ce que SvelteKit 3 couvre seul (décision du 2026-10-12).
- **svelte-i18n (DEP-04, P6)** : L’alerte esbuild 0.19 tirée par svelte-i18n est acceptée (outil de dev absent de l’image, serveur esbuild jamais lancé), sans override. svelte-i18n, plus publié depuis octobre 2024, sera remplacé en P6 (par exemple par Paraglide), quand les composants seront réécrits (décision du 2026-10-12).
- **Scanner sur téléphone (DEP-05)** : Ni le mainteneur ni ses utilisateurs n’ont d’iPhone, et Android n’est pas testable tout de suite : la preuve pour Safari reste WebKit headless (534/534), et le scanner sera essayé sur les téléphones des utilisateurs avec l’image `:dev` (décision du 2026-10-12).
- **Actions GitHub épinglées (SEC-10)** : Une action épinglée n’est mise à jour que pour une raison (faille, besoin) ou lors d’une revue groupée en préparant une release, toujours avec la règle des 7 jours. Pas de Dependabot, qui ouvrirait des pull requests (décision du 2026-10-11).
- **Lignes incomplètes de l’import CSV (DATA-04)** : Une ligne incomplète (nom vide, ligne de virgules, case sans capacité) est sautée et signalée, pour toutes les tables. Seule une vraie erreur de base annule tout l’import, qui laisse alors la base inchangée (décision du 2026-10-12).
- **Données réparées par la migration 0006 (DATA-03)** : Régions et appellations en double : fusionnées dans la plus ancienne, qui reprend appellations et vins. Code-barres partagé : il reste sur la bouteille disponible (sinon la plus ancienne), les autres le perdent avec une ligne dans leurs notes. Statut inconnu : `out_of_cellar` avec une note. Note 0 : sans note ; toute autre note hors de 1 à 5 est retirée avec une ligne dans la description. Textes ajoutés en anglais. Tout nombre de 1 à 5 est accepté, pas seulement les demi-points. `parent_container_id` orphelin : NULL sans trace, la colonne n’étant jamais affichée (décision du 2026-10-12).
- **Contrôle de mise à niveau (REL-02)** : Version inconnue (bases d’avant 0.6.0) : une borne basse est déduite des migrations appliquées, les actions sont affichées depuis cette borne avec « peut-être déjà faite », et l’utilisateur les coche. Base venue d’une version plus récente : refus de démarrer, avec un message clair (relancer cette version, ou restaurer une sauvegarde d’avant la mise à jour). Prérequis manquant (`ORIGIN` sans `PROTOCOL_HEADER` ni `HOST_HEADER`) : avertissement dans les logs, sans bloquer le démarrage (décision du 2026-10-12). Le bandeau de l’admin ne le montre plus : sans `ORIGIN` en http, la connexion échoue avant d’y arriver, et derrière un proxy https il se trompait (décision du 2026-10-17, audit d’avant 1.0).
- **Compteurs de codes-barres (DATA-06)** : Un compteur par préfixe dans `app_settings`. Le wipe garde les compteurs : la numérotation continue. Une restauration garde, pour chaque préfixe, le plus grand des compteurs de la base actuelle et de la sauvegarde (décision du 2026-10-12).
- **Capacité des cases (API-02)** : Le serveur refuse (409 `case_full`) une écriture qui laisse une case avec plus de bouteilles disponibles que sa capacité : ajout, déplacement, retour en cave, capacité abaissée. Une case déjà trop pleine reste modifiable : seule une écriture qui l’emplit davantage est refusée. La capacité d’une case et les emplacements d’un vin comptent les bouteilles disponibles seulement (décision du 2026-10-13).
- **Services par domaine (API-02)** : Les autres écritures attendent (503 `writes_held`) pendant un import JSON, comme pendant une restauration ; les refus du serveur sont traduits dans les dialogues. Dossiers `images` et `shared` en plus des domaines prévus ; les imports restent dans `features/backup` jusqu’à API-04 ; une écriture d’une seule requête reste hors transaction ; la règle de lint interdit aussi aux routes les repositories (décision du 2026-10-13).
- **Référentiels (API-03)** : Une seule URL `/api/<table>` pour les formulaires et l’admin ; POST d’un nom existant renvoie la ligne existante (200) ; champ `name` partout ; listes triées par nom (décision du 2026-10-13). Le nom est comparé sans tenir compte de la casse (« france » renvoie « France »), comme le fait l’import CSV ; aucune migration ne fusionne les doublons existants (décision du 2026-10-17, audit d’avant 1.0).
- **Action de mise à jour 0.7.0 (API-01, API-03, API-06)** : Une seule action, conditionnelle, pour qui a des scripts, couvre les changements d’API-01, API-03 et API-06 : format d’erreur, IDs seulement, `/api/<table>`, `name`, PUT qui renvoie la ligne, `/api/definitions` au lieu de `/api/wines` (décision du 2026-10-13).
- **Import CSV (API-04)** : Les bouteilles de vins homonymes d’un export 0.6.0 ou antérieur sont signalées, pas importées. Seules les bouteilles disponibles reçoivent un code-barres automatique ; les bouteilles bues gardent celui du fichier. Restent ouverts et acceptés : réimporter le fichier d’origine rajoute les bouteilles disponibles sans code-barres qui en ont reçu un au premier import (réimporter plutôt l’export pris après) ; la limite des 700 lignes est comptée sans le normaliseur partagé avec l’import JSON (673 lignes) ; un millésime « NV » refuse sa ligne ; une référence optionnelle inconnue fait sauter la ligne ; l’envoi d’un CSV est limité à 50 Mo (décision du 2026-10-13).
- **Mises à jour des bouteilles (API-05)** : `PUT /api/bottles/{id}` est retiré avant la 1.0 (décision du 2026-10-17), avec une action conditionnelle « scripts » qui dit : « Scripts that call PUT /api/bottles/{id} must switch to PATCH and send only the fields to change. » Un champ inconnu est refusé (422) par PATCH ; 10 000 ids au plus par requête ; une action groupée envoie les mêmes changements à toutes les bouteilles (décision du 2026-10-13).
- **Endpoints et CSRF (API-06)** : `src/lib/server/csrf.ts` reste : il ajoute une couche au contrôle de SvelteKit 3, ses réponses sont traduites, et la matrice de test de ce que chacun couvre est faite. Les endpoints sans appelant restent : l’API est publique et documentée pour les scripts, sauf `PUT /api/bottles/{id}`, retiré (décision du 2026-10-17, audit d’avant 1.0). Plus rien ne remet les préréglages d’étiquettes par défaut (un bouton de réinitialisation pourra venir avec l’interface). La garde anti-formule des exports CSV ne vise que les cellules qui commencent par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot, sauf un texte de lettres, chiffres et tirets après le signe (`+A1-B2` n’est pas gardé). Les routes d’envoi et de liste des images restent séparées (décision du 2026-10-13).
- **Code mort et knip (UI-01)** : `pnpm knip` est un contrôle de la CI. Les primitives shadcn-svelte (`src/lib/components/ui/*/index.ts`) restent telles que le CLI les écrit : knip ignore leurs exports inutilisés (décision du 2026-10-13).
- **Types et badges (UI-03)** : Les badges et les camemberts des types et des couleurs prennent leur couleur dans une table clée par le nom normalisé (sans casse, accents ni espaces, avec des alias anglais) : les ids changent d’une installation à l’autre. Un nom créé par l’utilisateur reçoit une couleur stable, calculée à partir du nom, parmi des teintes que les noms seedés du même genre n’utilisent pas ; N/A et une référence absente restent gris. Le camembert des types prend les couleurs des badges. `no-explicit-any` est une erreur ESLint (décision du 2026-10-13).
- **Chargement côté serveur (UI-04)** : Historique et hors cave filtrés, triés et paginés sur le serveur, avec l’état dans l’URL ; `/` mène à `/wines` (voir « Healthcheck et racine (UI-04) ») ; page d’erreur traduite ; plus d’écran de chargement ; la sélection du hors cave est gardée d’une page à l’autre. L’admin est chargé par UI-07. Les GET sans appelant restent, documentés comme API publique (décision du 2026-10-13, confirmée le 2026-10-17).
- **Périmètre de UI-05 (P6)** : UI-05 ne migre pas les fichiers que UI-06, UI-07, UI-08 et UI-09 réécrivent en entier (dialogues de vin et de bouteille, admin et ses stores, BarcodeDialog, page stockage) : ils passent en runes avec leur réécriture, et le critère « 0 `export let` » se vérifie à la fin du lot 4 (décision du 2026-10-13).
- **Bibliothèque i18n (UI-10)** : Paraglide JS 2.27.0, version exacte, avec le plugin ICU1 chargé en local ; langue dans un cookie, pas de préfixe d’URL ; l’ancienne préférence `wine-cellar-locale` est abandonnée ; le remplacement ouvre UI-10, au lot 5 (décision du 2026-10-13).
- **Formats et tableaux (UI-02)** : Dates, montants et tailles au format de la langue partout (« 13 oct. 2026 », « 12,00 € », « 1,5 Mo »). Une seule pagination, numéros de page compris, avec un texte sans le nom de l’entité, admin incluse ; le dialogue « toutes les bouteilles » ne la montre qu’en bas. En-têtes et libellés de statut uniformisés (« Disponible » dans le formulaire de bouteille), sauf la pastille courte « Sortie » de la page vin. Une note est arrondie à l’étoile la plus proche (4,5 donne 5). Les filtres millésime et origine ne lisent que les bouteilles encore possédées. Un changement de préférences dans un autre onglet s’applique au thème, pas à l’interrupteur « images » d’une liste des vins déjà ouverte (décision du 2026-10-13).
- **Page stockage (UI-09)** : Les lignes du tableau sont les positions des cases dans leur conteneur, plus leur numéro ; une case sans numéro final se range en tête. Une case ajoutée prend le plus grand numéro + 1, et son suffixe est gardé tel quel. Les pourcentages suivent la langue. `PUT /api/storage-containers/{id}` remplace toute la liste des cases (une case absente est supprimée), avec une action de mise à jour non bloquante pour les scripts ; `DELETE /api/storage-cases/{id}` reste, documenté (décision du 2026-10-13, confirmée le 2026-10-17). Un nom de conteneur est unique, et les suffixes sont uniques dans un conteneur (409) ; les doublons existants sont renommés (« A (2) »), jamais fusionnés ; l’export CSV des bouteilles donne aussi le nom du conteneur. Pas de séparateur automatique entre conteneur et case : un espace tapé devant un suffixe est gardé, et l’exemple du champ passe à des noms sans chiffre final (« Cave A, Frigo ») (décision du 2026-10-17, audit d’avant 1.0).
- **Page codes-barres (UI-08)** : Un seul formulaire d’étiquettes, validé par le code que le serveur exécute ; la bordure est enregistrée dans les presets, et un preset enregistré reste sélectionné ; le dialogue d’une bouteille dessine lui-même son code-barres. `POST /api/barcode/pdf-labels` refuse un QR de moins de 10 mm et son 422 donne `details.issues` : une phrase dans les notes de version, pas d’action de mise à jour (décision du 2026-10-13). Préréglages livrés : une migration ne corrige que ceux encore identiques à leurs valeurs d’origine ; les cinq trop étroits pour un code-barres (Brother DK-22210, Dymo 30320, Zebra 2x1, Generic 40x25, Generic 50x30) passent en QR ; la zone blanche de 9,3 modules au lieu de 10 du DK-11204 est acceptée, car elle se lit (décision du 2026-10-17, audit d’avant 1.0).
- **Admin en pages (UI-07)** : `/admin` redirige vers `/admin/settings` ; le bandeau des actions de mise à jour s’affiche sur toutes les pages admin ; après une restauration, un import ou un effacement, seules les données sont rechargées, pas la page ; la suppression d’une sauvegarde passe par la confirmation générique ; les noms de sauvegarde ne sont vérifiés que par le serveur ; le bouton « Retour » de l’admin est retiré (décisions du 2026-10-16).
- **Formulaires de vin et de bouteille (UI-06)** : Les dialogues postent vers les form actions de `/wines` (`createWine`, `updateWine`, `createBottles`, `updateBottle`), depuis n’importe quelle page : un second chemin d’écriture à côté de l’API JSON, avec les mêmes services et les mêmes schémas. Seules les règles du serveur s’appliquent (millésime 0-9999, quantité cible 0-10000, capacité d’une case par le 409 `case_full` affiché sous la case). Dialogues plus larges sur ordinateur, sur une colonne au téléphone ; boutons d’enregistrement toujours actifs, les erreurs disent ce qui manque ; l’image est envoyée à l’enregistrement, en JPEG, PNG, WebP ou GIF ; formats et classifications fournis par le layout (décisions du 2026-10-16). Un millésime 0 est enregistré comme « sans millésime ». Prix et valeurs valent 0 au moins. La date de consommation est facultative : le dialogue de statut propose toujours la date du jour, sans l’exiger. Les champs numériques sont des champs texte avec `inputmode="decimal"` : Cellar lit lui-même « 12,5 » et « 12.5 », quelle que soit la langue du navigateur, et refuse le reste avec un message. Une image envoyée puis abandonnée est supprimée (décision du 2026-10-17, audit d’avant 1.0).
- **Exception Paraglide (UI-10)** : Exception ponctuelle à la règle des 7 jours, accordée par le mainteneur le 2026-10-16 : `@inlang/paraglide-js@2.27.0` (publié le 2026-10-09 à 23:07 UTC) et `@inlang/sdk@4.0.0` (22:19 UTC), versions exactes, dans `minimumReleaseAgeExclude` (commit e7b049ab). Prévue d’abord pour la seule branche `p6/ui-10`, puis, à la demande du mainteneur, mergée sur develop le jour même pour vérifier l’ensemble ; aucune autre version n’est exemptée. Le retrait se fait dans un commit dédié sur develop après le 2026-10-16 à 23:07 UTC, `pnpm install --frozen-lockfile` devant encore passer ; le merge sur main et la release n’ont lieu qu’ensuite. Retirée le 2026-10-17 (0b8318d0), avant la release 0.8.0.
- **Healthcheck et racine (UI-04)** : `/` répond 200 et mène à `/wines` par une meta refresh, pour que les healthchecks existants, y compris ceux des `docker-compose.yml` copiés, restent valides sans action de mise à jour ; pas de route `/api/health` (décision du 2026-10-16). Un seul healthcheck, dans le Dockerfile, avec les délais du compose (10 s d’attente maximale par essai, 40 s accordées au démarrage) ; celui du `docker-compose.yml` est retiré (décision du 2026-10-17, audit d’avant 1.0).
- **Accessibilité et langue (UI-10)** : Sous 1280 px, la navigation passe dans un menu ; toute réponse 401 ouvre le dialogue de connexion, sans toast « session expirée », sauf la déconnexion d’une session déjà terminée, exclue côté interface (`asksForAccessCode`) plutôt qu’en rendant la déconnexion idempotente côté serveur ; exemples des champs en italique, « e.g. » / « ex : » ; « Ajouter un vin » au lieu de « Ajouter Définition Vin » et casse de phrase en français ; `POST /api/admin/import-csv` renvoie `errors[].problems` (codes) et `skipped[].reason.code`, avec une phrase dans les notes de version et sans action de mise à jour (décisions du 2026-10-16).
- **Versions après 0.8.0 (REL-01)** : 0.9.0 pour les corrections bloquantes de l’audit d’avant 1.0 (P7), puis peut-être 0.10.0 avec une partie des autres tâches de l’audit, puis 1.0.0 avec de nouvelles fonctionnalités. La règle 0.x reste valable jusqu’à la 1.0. En 1.x : jamais d’action manuelle dans un correctif ; une majeure seulement pour une action qui concerne tout le monde et sans laquelle Cellar ne marche pas ; une action conditionnelle (scripts, mode cron…) reste dans une mineure. Après chaque tag, `develop` passe au numéro de rc suivant (0.9.0-rc.0 après 0.8.0, 0.9.0-rc.2 après 0.9.0-rc.1), pour qu’un build de develop ne porte jamais le numéro d’une version publiée (décision du 2026-10-17, audit d’avant 1.0).
- **Alerte esbuild 0.18 (DEP-04)** : esbuild 0.18, tiré par drizzle-kit 0.31.11 (outil de dev absent de l’image, serveur esbuild jamais lancé), est accepté sans override, comme esbuild 0.19 l’a été, jusqu’à une version de drizzle-kit qui le retire (décision du 2026-10-17, audit d’avant 1.0).
- **Millésime 0 (audit d’avant 1.0)** : 0 veut dire « sans millésime » (vins non millésimés, comme beaucoup de champagnes). Une migration remplace les 0 existants par NULL, avec une phrase dans les notes de version et sans action de mise à jour ; ensuite, un 0 envoyé par le formulaire, l’API ou l’import CSV est enregistré comme NULL, sans erreur (décision du 2026-10-17, audit d’avant 1.0).
- **Restauration (audit d’avant 1.0)** : Après une restauration, les réglages des sauvegardes automatiques restent ceux de l’instance, comme le jeton cron. Les actions de mise à jour de la version de la sauvegarde s’ajoutent à celles de l’instance, marquées « peut-être déjà faite » (décision du 2026-10-17, audit d’avant 1.0).
- **Tri de l’historique et du hors cave (UI-04, UI-07)** : Même ordre que les autres tableaux : sans tenir compte de la casse ni des accents, vides en dernier. Changer de filtre garde le tri. Sur « Tous les vins », « Date de consommation » trie vraiment par cette date, bouteilles non bues en dernier ; sur « En cave », cette colonne est retirée (décision du 2026-10-17, audit d’avant 1.0).
- **Architecture (revue 7)** : `src/lib/db` passe sous `src/lib/server`, pour que SvelteKit refuse son import côté client. Playwright couvre 3 ou 4 parcours. Le rangement des composants par domaine n’est pas abandonné : il fera l’objet d’une tâche dédiée, à la toute fin (décision du 2026-10-17, audit d’avant 1.0).
- **Limites acceptées (audit d’avant 1.0)** : Sous un préfixe vide, un code manuel de 10 chiffres compte comme un code de Cellar : la numérotation repart après lui (`9999999999` épuise la séquence). La migration 0004 ne répare qu’en partie une chaîne pays, région, appellation modifiée à la main. `vite dev` s’arrête au premier appel quand une migration est cassée. Scanner : un UPC-E hors règles GS1 peut être relu sous un autre code, les anciens scans d’EAN-13 à 0 initial restent sur 13 chiffres, le détecteur natif de macOS lit mal les Data Matrix ; en revanche, une caméra débranchée pendant un scan doit afficher un message. Code d’accès (SEC-03) : au-delà de 10 000 clients suivis, les plus anciens sont oubliés ; derrière la redirection de ports de Docker ou un proxy sans `ADDRESS_HEADER`, tous les clients partagent le même compteur (décision du 2026-10-17, audit d’avant 1.0).
- **Petits choix (audit d’avant 1.0)** : « Add wine » en anglais, comme « Ajouter un vin ». Les mots isolés (Annuler, Confirmer, Pays…) n’ont qu’une clé i18n, dans `common.*`. Les filtres de la liste des vins sont dans l’URL. Un code-barres est d’abord cherché à l’identique, majuscules comprises, puis sans casse. Une action de mise à jour cochée reste visible jusqu’à la visite suivante. Logs : le serveur écrit dans les logs du conteneur, le code du navigateur n’utilise pas `console`. La colonne du type ajoutée à l’export CSV des bouteilles et la nouvelle forme de la réponse de l’import CSV tiennent en une phrase des notes de version (décision du 2026-10-17, audit d’avant 1.0).
- **Messages d’erreur (P7)** : Un message d’erreur montré à l’utilisateur donne le plus de contexte possible : ce qui est attendu et ce qui ne va pas, par exemple « Saisissez un nombre entier entre 0 et 9 999. » plutôt que « Cette valeur n’est pas valide. ». Un bouton n’est grisé que si la raison est visible avant le clic (décisions du 2026-10-17, BUG-14 et BUG-16).
- **Champs numériques (BUG-14)** : Les champs affichent les nombres dans la langue de l’interface (virgule décimale en français) et acceptent les deux séparateurs à la saisie. Une capacité de case vide est refusée par le dialogue du stockage, avec un message sous la case ; l’API garde « capacité absente = 5 » pour les scripts (décisions du 2026-10-17).
- **Étiquettes (BUG-16)** : Les préréglages Avery suivent les positions des gabarits d’Avery plutôt que la marge annoncée (0,26 mm d’écart au plus). La mise en page par défaut garde le code-barres, sur 56 mm de large, la plus étroite qui s’imprime. Les avertissements s’affichent à part des erreurs. Le paragraphe de BUG-16 dans le résumé 0.9.0 garde ses quatre phrases, qui disent quoi faire d’un préréglage ou d’un CSV modifié (décisions du 2026-10-17).
- **Numérotation de develop (REL-03)** : Le numéro de develop est un plancher : après 0.9.0, develop passe à 0.10.0-rc.0, donc une correction publiée depuis develop sera 0.10.0, pas 0.9.1. Une action ajoutée à une version après qu’une base a tourné sur un rc de cette version n’apparaît pas sur cette base, comme l’action « scripts » d’API-07 pour une base déjà en 0.9.0-rc.0 : accepté (décisions du 2026-10-17).
- **Suites de P7 (BUG-13, BUG-15)** : Une note tapée en consommant s’ajoutera à la suite des notes existantes au lieu de les remplacer (tâche BUG-17, décision du 2026-10-18). Deux vins qui ne diffèrent que par la note, la description ou l’image seront tous deux importés, pour que leurs bouteilles soient signalées même en imports séparés (tâche BUG-18, décision du 2026-10-17). Les deux sont à placer dans la phase suivante Fait en P8 : la note s’ajoute par le champ `addedNote` de `PATCH /api/bottles`, et `notes` remplace toujours ; une aide sous le champ le dit, au pluriel même sur la page vin. Un vin dont la cave a la clé avant l’import n’est pas réimporté, même modifié depuis ; un jumeau qu’une version antérieure a laissé de côté s’ajoute dans l’app, ce que disent les notes de version ; le guide de l’import explique la règle (décisions du 2026-10-18).
- **Longueur des textes (DATA-10)** : Les notes des bouteilles et les descriptions des vins font 5 000 caractères au plus. La mise à jour, l’import et la restauration de données plus anciennes coupent les textes plus longs, sans le signaler dans le compte rendu de l’import ; les notes de version conseillent une sauvegarde et un export CSV avant la mise à jour, sans action dans UPGRADING. Une note de consommation qui ne tient pas à la suite des notes est refusée avec un message plutôt que coupée. Un emoji compte pour un caractère en base et pour deux ou plus dans l’app : un texte coupé à la mise à jour qui en contient peut devoir être raccourci avant d’être réenregistré, accepté (décisions du 2026-10-18).
- **Tâches de l’audit d’avant 1.0 (P9, P10, P11)** : Les tâches T1 à T16 de l’audit deviennent des tâches de la feuille de route : en P9 (0.11.0) celles qui portent une décision déjà prise, en P10 (0.12.0) les autres, et le rangement des composants par domaine en P11, juste avant la 1.0.0. Les 12 lignes de l’audit qu’aucune tâche ne citait et les 24 points « Trouvé pendant » de P7 et P8 y sont rattachés, sans tâche T17. Ne sont plus à faire : ce que R1 a réglé (l’exception Paraglide et a7 m1, 0b8318d0) ; ce que P7 et P8 ont réglé (a4 UI-07/Reste-3, a6 UI-04/Trouvé-3, UI-04/Reste-2, UI-09/Reste-7b, a4 UI-07/Reste-5, a6 m17, a6 UI-08/Reste-3, a7 m22, a7 QA-04/Reste-1, API-07/17, BUG-13/2, BUG-15/2) ; ce qu’une décision vide de tout travail (a7 DEP-04/Trouvé-1 et DEP-04/Reste-2, a1 DATA-02/Reste-1, DATA-06/Trouvé-1 et DATA-07/Reste-1, a6 UI-08/Trouvé-3d et Trouvé-4a à 4c, a7 m12) ; ce qui est accepté ou seulement informatif (API-07/12, API-07/16, REL-03/2, BUG-14/6, les champs entiers restés en `type="number"` après BUG-14, BUG-15/3, DATA-09/2, REL-04/3). Un nouvel essai après une réponse perdue ajoute encore la note de consommation deux fois : accepté (décisions du 2026-10-23).
- **Version de Cellar (REL-03)** : Le numéro de version de Cellar s’affiche aussi dans l’admin, pas seulement dans Préférences : c’est l’admin qui en a besoin (décision du 2026-10-23).
- **Copie CRLF des préréglages d’étiquettes (BUG-16)** : Une copie de `label_presets.csv` aux fins de ligne CRLF, identique sinon à celle que Cellar a livrée, est reconnue et remplacée comme la copie d’origine : un CSV modifié sous Windows ou produit par une autre app en a souvent (décision du 2026-10-23).
- **Codes de réponse promis en 0.7.0 (API-07, REL-04)** : Les routes qui répondent 200 alors que le résumé 0.7.0 promet 201 pour une création et 204 pour une suppression (`DELETE /api/admin/wine-definitions/{id}`, `DELETE /api/admin/images`, `POST /api/admin/upload-image`, `POST /api/admin/import-images-zip`) sont alignées sur ce résumé, avec une phrase dans les notes de version, plutôt que de corriger seulement la note publiée (décision du 2026-10-23).
- **Prix négatifs (UI-06)** : Un prix d’achat ou une valeur négatifs sont refusés par le formulaire et l’API. Une ligne d’import CSV ou JSON au prix d’achat ou à la valeur négatifs n’est pas refusée : elle est réparée comme les autres réparations de DATA-03, la valeur retirée avec une ligne dans les notes de la bouteille. Une migration répare de même les prix d’achat et valeurs négatifs déjà en base, comme 0006, avec une phrase dans le résumé 0.11.0 (décision du 2026-10-23).
- **Code-barres donné en mode automatique (BUG-19)** : En mode automatique, un code-barres donné à `POST /api/bottles` est gardé quand une seule bouteille est créée, comme PATCH ; donné pour plusieurs bouteilles, il est refusé (422 `barcode_for_one_bottle`), comme PATCH le fait pour plusieurs bouteilles (décision du 2026-10-23).
- **Bouteilles bues de la liste des vins (UI-14)** : La page `/wines` ne charge que les bouteilles encore possédées, pour être plus légère : la saisie groupée de codes-barres ne trouve donc plus une bouteille bue, accepté. `/api/wines` garde les bouteilles bues, et le contrat des scripts ne change pas sur ce point (décision du 2026-10-23).
- **Téléchargement d’une sauvegarde (API-09)** : `GET /api/admin/download-backup` désigne la sauvegarde par `filename`, comme les autres routes de sauvegarde. `?file=` est retiré tout de suite, sans alias, avec l’action conditionnelle « scripts » de la version (entrée 0.11.0 de `releases.json`, selon RELEASING.md) (décision du 2026-10-23).
- **Dialogue de statut partagé (UI-13)** : Un seul dialogue change le statut des bouteilles sur la page vin, le hors cave et le détail d’une bouteille : il propose tous les statuts sauf celui que les bouteilles partagent, « Bue » présélectionné (en premier si toutes sont bues), et un toast confirme sur la page vin. La saisie groupée de codes-barres garde son propre sélecteur, fait des mêmes morceaux partagés (décision du 2026-10-23).
- **Sauvegarde trop grosse (DATA-12)** : Une sauvegarde qui dépasse les limites d’extraction de la restauration (2 Gio décompressés, 10 000 entrées) est toujours écrite, restaurable à la main, et signalée, jamais refusée : `create-backup` et `create-export` répondent `restorable`, l’admin affiche un avertissement, et les sauvegardes automatiques et de sécurité l’écrivent dans les logs (décision du 2026-10-23).
- **Parcours de bout en bout (QA-05)** : `@playwright/test` est accepté en dépendance de développement. `pnpm test:e2e` fait partie de la définition de « fini » d’AGENTS.md, et une release attend tous les jobs de la CI, comme le dit RELEASING.md : `verify`, `e2e`, et `image` depuis REL-05 (décisions du 2026-10-23).
- **Hauteur des codes-barres (BUG-20)** : Le contrôle et le PDF calculent la hauteur des barres par une même fonction. Le plafond de 0,3 fois la largeur est retiré : les barres remplissent la hauteur de l’étiquette au-dessus du texte du code. Le minimum passe de 15 à 10 mm, puisque le banc de l’audit lisait six fois sur six les barres de 10 mm de la DK-11204 ; sous 25 mm, un avertissement reste (décision du 2026-10-28).
- **Noms de rangement uniques (UI-12)** : Les noms de conteneurs, et les suffixes des cases d’un conteneur, sont uniques à l’identique : « Cave » et « cave » peuvent coexister, et l’import CSV, qui ignore les capitales, prend alors le premier, limite acceptée. La migration renomme les doublons « A (2) », le plus ancien gardant son nom et un numéro déjà pris étant sauté, ainsi que les cases d’un conteneur renommé qui commencent par l’ancien nom (« A1 » devient « A (2)1 ») ; une case en double dans un conteneur devient « A1 (2) ». Aucune bouteille ne bouge. L’import JSON d’un ancien export qui contient des doublons reste refusé ; la restauration d’un zip le répare (décisions du 2026-10-28).
- **Suffixe des cases (API-09)** : Une case dont le nom ne commence pas par celui de son conteneur garde son nom entier comme suffixe : « Haut1 » dans « Frigo » devient « FrigoHaut1 », et « Haut1 » et « Bas1 » restent deux cases distinctes. « A1 » dans « A » ne change pas. Enregistrer un conteneur renomme ainsi ses cases importées (décision du 2026-10-28).
- **Actions pour les scripts de 0.11.0 (BUG-19, UI-14, API-09)** : 0.11.0 n’a qu’une action « scripts », qui liste chaque changement cassant de l’API : `next-barcode` en 409 quand la génération est coupée (décision du 2026-10-23), `/api/wines` en `{ definition, bottles }`, et ceux d’API-09. `PUT /api/access-code` répond 204 sans corps, car la valeur enregistrée est secrète. Un ajout, comme `details.problems` dans la 422 `invalid_export`, n’a pas d’action (choix du coordinateur, 2026-10-28).
- **Vin plutôt que définition de vin (UI-15)** : « Vin » remplace « définition de vin » dans tous les textes visibles, dans les deux langues, et pas seulement dans les six titres que nommait l’audit ; l’API garde ses noms (décision du 2026-10-28).
- **Champs en mode sombre (UI-16)** : En mode sombre, le fond des champs et des boutons à contour suit `--input`, comme dans shadcn : relever `--input` à 3:1 éclaircit aussi ce fond et rend visible le contour de ces boutons. La bordure dépasse 3:1 contre la page, pas contre l’intérieur du champ (décision du 2026-10-29).
- **Titres de page (UI-17)** : Chaque page met sa section avant le nom traduit de l’app : « Mes vins - Cave à vin », « Code-barres - Cave à vin ». Les pages de l’admin en ont trois parties : « Sauvegardes - Administration - Cave à vin », et une page de données prend le nom de sa table (« Pays - Administration - Cave à vin »). La page d’un vin et les pages d’erreur gardent « {nom} - Cave à vin » et « {statut} - Cave à vin » (décision du 2026-10-29).
- **Aide du champ code-barres (UI-17)** : Le champ code-barres de `/wines` n’a plus d’exemple : une aide sous le champ, comme celles de `FormField`, dit « Saisissez ou scannez un code-barres, puis appuyez sur Entrée. » (décision du 2026-10-29).
- **Récapitulatif des préférences retiré (UI-17)** : Le bloc « Préférences de l’application », qui répétait en badges les réglages de la page, est retiré dans UI-17, à la demande du mainteneur, alors que la tâche le laissait hors périmètre (décision du 2026-10-29).
- **Couleurs décoratives et statuts (UI-18)** : Le thème n’a qu’une teinte : sur Statistiques et Pénurie, les icônes prennent `text-primary` et les chiffres `text-foreground`, sauf le nombre de bouteilles manquantes, en `text-destructive`. Un vin sans photo affiche `bg-muted` et une icône `text-muted-foreground` ; le lien du site d’un vin est en `text-foreground` souligné, `text-primary-text` au survol depuis UI-20. Succès et avertissement ont des couleurs fixes, `--success` et `--warning` (green-800 et amber-800 en clair, nuances 400 en sombre) ; le `--destructive` clair passe à red-700 (`oklch(0.505 0.213 27.518)`), pour que le texte d’erreur atteigne 4,5:1 sur sa teinte ; les toasts sont des cartes opaques, à bordure et icône colorées. Restent en dur, avec un commentaire : badges de type et de couleur (UI-03), échelle d’occupation, lettres des rangements (neutres depuis UI-33, 1.4.1), échelle de pénurie, badge de pénurie `bg-red-700` (UI-16), pastilles de disponibilité, places pleines de `CaseLoad`, bouton de retrait et légende posés sur une photo, vue caméra du scanner, et primitives shadcn (décisions du 2026-10-29).
- **Avant la 1.0 (P11, P12)** : Les deux défauts de P10 les plus visibles passent avant la 1.0, en petites tâches de P11 avant le rangement : le texte en couleur du thème trop pâle dans les thèmes clairs jaune, orange et vert (UI-20), et la page qui défile derrière un dialogue quand on choisit dans un Select (BUG-21, qui s’est révélé être un effet de Playwright, voir « Pas un défaut (BUG-21) »). Après P11, une revue complète vérifie l’ensemble avant la 1.0.0 (P12). Le dépôt et l’image deviennent publics au tag de la 1.0.0 (décisions du 2026-10-29).
- **Serveur MCP (P14)** : Cellar sert un serveur MCP à l’adresse `/mcp` (transport HTTP « streamable »), dans la 1.2.0, juste après la 1.1.0 (décision « Versions après la 1.0 »). Le SDK officiel est accepté en dépendance : sa ligne v2, `@modelcontextprotocol/server` (avec `@modelcontextprotocol/core`), qui ne dépend que de zod, plutôt que `@modelcontextprotocol/sdk` v1, qui ajoutait à l’image 90 paquets et 18,6 Mo dont Express et Hono, inutilisés (choix du mainteneur, 2026-10-31). L’accès passe par un jeton dédié, généré dans l’admin, stocké haché, affiché une fois et régénérable, en lecture seule par défaut, l’écriture étant une option à cocher. Outils de lecture : chercher des vins, voir un vin avec ses bouteilles et leurs emplacements, retrouver une bouteille par son code-barres, statistiques, pénurie, place libre dans les rangements. Outils d’écriture : ajouter des bouteilles (ou un vin et ses bouteilles), marquer des bouteilles bues (date, note, commentaire), déplacer des bouteilles, modifier les notes. Jamais l’admin : sauvegardes, restauration, effacement, imports et code d’accès restent hors du MCP. Cellar reste prévu pour un réseau local ou un VPN : le MCP vise les assistants qui tournent sur ce réseau (modèles locaux, CLI, applications de bureau) ; un assistant en ligne qui appelle depuis internet ne l’atteint pas, limite documentée et acceptée (décisions du 2026-10-29).
- **Pas un défaut (BUG-21)** : Le défilement derrière un dialogue ne vient que du `locator.click()` de Playwright, relancé pendant l’animation d’ouverture de la liste ; souris, toucher et clavier laissent la page immobile, et le mainteneur ne l’a jamais vu à la main. BUG-21 est clos sans changement de code (décision du 2026-10-29).
- **Titre des erreurs de l’admin (UI-17)** : Une page d’erreur de l’admin garde le menu de l’admin, et son titre le dit : « 404 - Administration - Cave à vin ». Les autres pages d’erreur gardent « {statut} - Cave à vin » (décision du 2026-10-30).
- **Revue d’avant 1.0 (QA-06)** : Le mainteneur suit les recommandations de la synthèse de `verification-pre-1.0` : les constats « avant 1.0 » deviennent les tâches SEC-12, API-12, BUG-22, BUG-23, UI-21, UI-22, DEP-07 et DOC-04 ; les autres sont acceptés pour la 1.0 et peuvent revenir après : S-m1 (message brut d’une erreur d’images de l’admin), V3-m1 (mémoire de l’import d’un zip d’images, avec une phrase dans README-Docker, DOC-04), V5-m6 (noms coupés sur les cartes), V5-m3 (recherche sensible aux accents), V5-m4, V5-m7, V4-m4, V6-m1, V6-m2, V7-m2, le badge d’un ancien préfixe long à 390 px, le HTML de `/wines` sans compression, `--input` sur `muted`, Firefox non essayé, et les points « Trouvé pendant » que la synthèse dit informatifs (décision du 2026-10-30).
- **Réponses figées à la 1.0 (QA-06)** : Ces réponses font partie de l’API 1.0 telles qu’elles sont : `success` et `message` dans les 9 réponses d’admin qui les ont, `GET /api` sans barre finale en 404 HTML de SvelteKit, et le message du 409 « in the cellar », qui compte aussi les bouteilles bues. Les changer après la 1.0 suivra les règles de version de RELEASING.md (décision du 2026-10-30).
- **Contraste des icônes (UI-18, UI-20)** : Les icônes en couleur du thème (`text-primary`) peuvent rester sous 3:1 dans les thèmes clairs jaune et orange (2,26 et 2,75:1) : elles accompagnent toujours un texte qui porte le sens, et ce texte atteint 4,5:1 depuis UI-20 (décision du 2026-10-30).
- **Comportements voulus (QA-06)** : « Retour » sur la page d’un vin mène à `/wines` même après Précédent, et `updatedAt` des conteneurs est à la seconde : ces deux comportements, documentés dans leurs tâches, sont voulus (décision du 2026-10-30).
- **Taille de l’import CSV (API-04)** : La limite de 700 lignes du critère d’API-04 est retirée : le fichier fait 914 lignes hors tests à cause des fonctions ajoutées ensuite (BUG-15, BUG-18, API-08, UI-12), sans défaut de comportement (2 200 lignes importées en 318 ms) (décision du 2026-10-30).
- **Pas de cadre (SEC-12)** : Toutes les réponses envoient `frame-ancestors 'none'` et `X-Frame-Options: DENY`, sans option pour l’autoriser : un tableau de bord de NAS ouvre Cellar par un lien, pas dans un cadre. Les notes de la 1.0.0 le disent (décision du 2026-10-30).
- **Doublons hérités (API-12)** : Un `PUT` qui garde un nom qu’une autre ligne porte à la casse près (doublon d’avant API-03) répond 409 comme les autres, sans cas particulier : on renomme d’abord l’une des deux lignes (décision du 2026-10-30).
- **Points de suspension (UI-22)** : « … » dans les deux langues, jamais « ... » ; `i18n:check` le refuse dans les fichiers de langue et dans les composants (décision du 2026-10-30).
- **Paquets de tar-stream (DEP-07)** : Le mainteneur accepte tar-stream 3.1.9 et les 9 paquets qu’il ajoute à l’arbre et à l’image : bare-fs, bare-stream, bare-url, bare-path, teex, events-universal, streamx 2.28.1, b4a 1.9.0 et bare-events 2.9.2 (décision du 2026-10-30).
- **Nouveau départ à la 1.0 (REL-06)** : Le 2026-10-30, la facturation de GitHub Actions bloque la CI du dépôt privé, et le mainteneur ne paie pas GitHub. Son historique contient une vraie base (`data/cellar.db`, 92 commits) : l’ancien dépôt devient `Lulu300/cellar-archive`, privé, Actions coupées, et le paquet GHCR `cellar` est supprimé. Le nouveau dépôt public `Lulu300/cellar` repart du commit racine 2fff2246 (le code de develop c350b2dd), sans ancien tag. Publiquement, Cellar commence à la 1.0.0 : les versions 0.x et leurs changements cassants ne comptent plus. Seul le serveur de test d’un ami, en 0.12.0, en vient, et le banc local couvre ce passage. Aucun commit ni tag de l’archive ne va dans le dépôt public ; les hachages cités ici avant 2fff2246 renvoient à l’archive.
- **Versions 0.x dans la doc (REL-06)** : README-Docker et docs/API.md ne citent plus de version 0.x ; le comportement reste décrit (une ancienne sauvegarde se restaure toujours), sans numéro de version (décision du 2026-10-30).
- **Nettoyage du dossier d’images (DOC-04)** : Une restauration supprime tout fichier non caché du dossier d’images que la base restaurée ne cite pas, image ou non ; ils passent d’abord dans la sauvegarde de sécurité. C’est voulu et documenté : le dossier appartient à Cellar (décision du 2026-10-30).
- **Deux « Import ZIP » (UI-23)** : Avant la 1.0, chaque bouton de l’admin dit ce qu’il importe ou exporte : l’import d’un export de données (onglet Backups) et l’import d’images (onglet Images) ne portent plus le même libellé, en anglais comme en français (décision du 2026-10-30).
- **Versions après la 1.0** : La 1.1.0 vient vite et reste petite : installation dans le README, liens vers la doc de l’API, PWA et finitions (P13). Le MCP suit aussitôt en 1.2.0 (P14), avec la description OpenAPI de l’API. Les fonctionnalités de « Idées après la 1.0 » sont discutées une par une avec le mainteneur avant d’être placées dans des versions, selon leur taille (décision du 2026-10-30).
- **Doc de l’API (DOC-05, API-14)** : `docs/API.md` reste la référence, liée depuis le README et la page d’admin (1.1.0). Une description OpenAPI générée depuis les schémas zod de l’API (zod 4 sait les convertir, sans dépendance) s’y ajoute en 1.2.0, pour les outils ; une interface comme Swagger UI demanderait une dépendance, à proposer au mainteneur (décision du 2026-10-30).
- **Logo et icônes (UI-27)** : Le logo est le verre du pack que le mainteneur a fait faire (`cellar-logo-pack`, tracé P10, 2026-10-31) ; on en importe ce dont l’app a besoin, sans le script de génération du pack. L’icône de l’écran d’accueil et du manifeste est le verre blanc sur fond bordeaux `#582634`. Le verre remplace aussi le logo de Svelte du favicon et l’icône générique de l’en-tête, où il prend la couleur du texte du thème (décision du 2026-10-31).
- **Page de suivi par version** : Depuis la 1.0.0, la page de suivi (`roadmap.html`) s’ouvre sur la version en cours, puis les suivantes ; tout ce qui a mené à la 1.0.0 (P0 à P12) et l’audit d’avant 1.0 passent dans un historique replié. La feuille de route reste en français (décision du 2026-10-31).
- **Noms trop longs à l’import (API-13)** : Depuis que les noms se mesurent en unités UTF-16, un nom déjà enregistré peut dépasser 500. L’import d’un export (JSON) coupe alors le nom, le type, la couleur ou le producteur à sa limite, sans le signaler et jamais au milieu d’un emoji, comme les notes (décision « Longueur des textes (DATA-10) ») ; l’import CSV signale la ligne sans couper, parce qu’il retrouve les lignes par leur nom. Pas de migration : un nom gardé en base reste entier jusqu’à sa prochaine modification, que le formulaire refuse tant qu’il n’est pas raccourci. Le nom d’une case (conteneur puis suffixe) se mesure contre 500 + 50 unités (décision du mainteneur, et du coordinateur pour les cases, 2026-10-31).
- **Millésimes des statistiques (UI-25)** : Chaque nom sous une barre tient sur une ligne, coupé par « … », et se lit en entier en touchant la barre (décision du mainteneur). Exception : le graphique des millésimes écrit « ’17 » sur deux chiffres, à toutes les largeurs, puisqu’« 2… » ne dirait rien ; l’année entière reste dans la ligne sous le graphique (décision du coordinateur, 2026-10-31).
- **Alerte minimatch (DEP-08)** : GHSA-g3hv-75wg-m249 (modérée) touche minimatch 10.2.6, tiré par archiver 8.0.0 puis readdir-glob 3.0.0, dans l’image. Acceptée pour la 1.1.0 sans override ni masquage, comme les alertes esbuild : Cellar n’appelle que `archive.file()`, jamais `glob()` ni `directory()`, et readdir-glob laisse `optimizationLevel` à 1 alors que la faille demande 2 ou plus. Le correctif, minimatch 11.0.1, était trop récent (installable le 2026-11-03) et readdir-glob n’accepte que `^10.2.2`. On ne retarde pas la 1.1.0 pour lui (mainteneur) ; à revoir à la prochaine revue des dépendances (décision du 2026-10-31).
- **Doc de l’API et MCP à jour** : Désormais, chaque tâche qui change ce que l’API accepte ou répond met à jour docs/API.md et la description OpenAPI (`pnpm openapi`) dans la même branche ; chaque tâche qui change ce que les outils du MCP lisent ou écrivent, ou qui ajoute une fonctionnalité qu’un assistant pourrait utiliser par eux, met à jour les outils du MCP et leur doc, ou le rapport dit pourquoi pas. Règle écrite dans AGENTS.md (décision du mainteneur, 2026-10-31).
- **Versions de 1.3.0 à 1.7.0** : Après la 1.2.0 (MCP) : 1.3.0 la navigation, les photos d’étiquette et la page Achats, la liste d’envies étant ce que les utilisateurs demandent le plus ; 1.4.0 les couleurs des vins et le plan de la cave ; 1.5.0 « À boire » et la fiche de dégustation ; 1.6.0 les producteurs et la revue de l’import CSV ; 1.7.0 les notifications. Chaque fonctionnalité a été détaillée avec le mainteneur avant ce découpage (décision du 2026-10-31).
- **Navigation (UI-28)** : Choisie sur maquette : des sections au survol, Cave (Mes vins, Producteurs, Stockage, Hors cave, Historique), Achats (Liste d’envies, Pénurie), Statistiques (ses sous-pages), Outils (Codes-barres) ; survoler ou viser au clavier une section montre ses pages, un clic ouvre sa première page, et ses sous-pages y sont des onglets, comme l’admin. Une icône d’engrenage regroupe Préférences, Admin (avec le signal « mise à jour disponible ») et Déconnexion. Achats porte un compteur rouge des vins en pénurie, ou à défaut un point sans chiffre de la couleur du thème quand la liste d’envies n’est pas vide, ou rien ; son menu donne le nombre de chaque onglet. Hors cave reste à portée : un lien « N hors cave » sous les filtres de Mes vins. Sur téléphone, l’app installée a une barre d’onglets en bas (Vins, Stockage, Hors cave, Achats, Plus) ; dans le navigateur, le menu ☰ reprend les sections avec leurs titres (décision du 2026-10-31).
- **Photos des vins (FEAT-01)** : Un vin peut avoir plusieurs photos : une principale, montrée dans la liste des vins, les autres seulement sur la page du vin. Sur téléphone, le champ propose « Prendre une photo » (appareil photo, sans HTTPS) et « Choisir un fichier ». Avant l’envoi, un aperçu permet de pivoter et de recadrer ; l’image est réduite (environ 1 600 px au plus grand côté, JPEG), tournée dans le bon sens, et ses métadonnées, dont la position GPS, sont retirées ; partout, ordinateur compris. Les images déjà enregistrées restent telles quelles. Une bibliothèque de recadrage serait une dépendance, à proposer au mainteneur (décision du 2026-10-31).
- **Liste d’envies et achats (FEAT-02)** : La page Pénurie devient « Achats », avec deux onglets, « Liste d’envies » et « Pénurie » (le stock minimum d’aujourd’hui), chacun avec son nombre. Une envie est soit un simple texte, avec une photo si on veut, soit un vin complet créé tout de suite ; toutes deux ont une quantité facultative et une note libre. Depuis une envie liée à un vin, « Ajouter une bouteille » ouvre le formulaire avec l’enchaînement habituel ; au dernier enregistrement, on choisit de retirer le vin de la liste ou non. Depuis une envie en texte, « Créer la fiche du vin » ouvre le formulaire du vin, avec la photo de l’envie reprise, puis enchaîne sur les bouteilles. Une bouteille ajoutée ailleurs, d’un vin de la liste, propose le même retrait au dernier enregistrement. Rien ne sort de la liste sans l’accord de l’utilisateur (décision du 2026-10-31).
- **Version corrective 1.3.1** : Le mainteneur veut ses retouches de la 1.3.0 dans une 1.3.1, avant P16 (2026-11-01). develop était passé à 1.4.0-rc.0, mais aucune image ni base n’a tourné sous ce numéro hors de la CI : develop repasse donc à 1.3.1-rc.0, l’entrée 1.4.0 de `releases.json` laisse la place à 1.3.1, puis revient au démarrage de la 1.4.0. Exception à la règle de RELEASING.md (« une version de correctifs après X.Y.0 est X.Y+1.0 ») : elle ne vaut que parce que rien n’a tourné en 1.4.0-rc.0.
- **Icône de la liste d’envies (1.3.1)** : Le cœur reste libre pour de futurs favoris : la liste d’envies prend le signet de la bibliothèque d’icônes (`Bookmark` de `@lucide/svelte`), en couleur du thème ; vide hors de la liste, plein quand le vin y est. Choix du mainteneur (2026-11-01), à revoir sur les captures si le signet se lit mal.
- **Cartes de vin (UI-32)** : Choisie sur maquette (https://claude.ai/artifact/9GrYNvpP1LUCF8jfT3Rwze, planche « C3 », 2026-11-01) : la carte devient horizontale, photo en portrait de 100 × 140 px à gauche. Règle de base, à ne jamais rompre : toutes les cartes ont la même taille et chaque élément est au même endroit ; chaque champ tient sur une ligne, la description a deux lignes réservées. Un texte coupé défile au survol (le mainteneur préfère ce mouvement sur les cartes). Le classement, le millésime et le prix sont précédés d’icônes, pas de libellés. La grille garde des cartes de 340 px au moins. Densité estimée sur un écran de 1 920 px : 4 cartes par ligne au lieu de 6, mais 8 cartes entières à l’écran au lieu de 6.
- **Actions MCP (FEAT-11)** : Un utilisateur a essayé le MCP : il a demandé un vin pour son repas, puis voulu sortir la bouteille de la cave, et seul « marquer bue » existait. Le mainteneur ajoute à la 1.4.0 quatre groupes d’actions : sortir des bouteilles de la cave, les y remettre dans une case et annuler un « bu » fait par erreur ; modifier un vin (quantité cible, description, producteur…) et les champs des bouteilles (prix, valeur, millésime, apogée, code-barres) ; lister les bouteilles de toute la cave par état et par date ; changer la quantité ou la note d’un souhait, et supprimer une bouteille ajoutée par erreur (action destructive, annoncée comme telle au client). L’admin reste hors du MCP. Les applications Claude web et mobile ne l’atteignent pas : leurs connecteurs partent d’Internet et attendent OAuth ; Claude Code et les clients locaux, avec l’en-tête du jeton, fonctionnent (décision du 2026-11-01).
- **MCP le plus complet possible (FEAT-12)** : Le mainteneur veut que l’assistant qui utilise le MCP ait le plus de contexte possible : les actions, leurs descriptions, la documentation et les erreurs. Une erreur rend donc aussi le détail du refus (les `details` de l’API), et une relecture de tous les outils, du point de vue d’un assistant, complète ce qui manque. Une bouteille marquée bue garde la case où elle était, sans y prendre de place, comme une bouteille hors cave : la remettre en cave la replace dans cette case, et l’assistant comme l’application peuvent dire où elle était. Les bouteilles bues avant la 1.4.0 ont déjà perdu leur case (décision du 2026-11-02). Précisé le même jour : le formulaire d’une bouteille bue dit dans quelle case elle était ; le MCP lit les listes au-delà de 200 (`offset`) ; pas de filtre sur l’apogée (avec « À boire », FEAT-05), ni de création d’origine ou de format, ni de suppression d’un vin, des conteneurs ou des appellations par le MCP.
- **Dépendances après la 1.4.0** : Le mainteneur veut sortir la 1.4.0 vite : la revue des dépendances (DEP-10), qui attendait que les correctifs aient 7 jours (le 2026-11-05 ou 06), part dans la première version publiée après cette date. La 1.4.0 sort avec les dépendances de la 1.3.2 (décision du 2026-11-02).
- **Version corrective 1.4.1** : Le mainteneur veut corriger le survol des boutons dans une 1.4.1, avant la 1.5.0 (2026-11-02) : sur une carte de vin, le survol du nombre de bouteilles se voit à peine, surtout en thème sombre, et d’autres boutons ont peut-être le même défaut ; il veut une règle commune, pour un comportement prévisible et lisible. Comme pour la 1.3.1 : develop était passé à 1.5.0-rc.0 sans qu’aucune image ni base ne tourne sous ce numéro hors de la CI, donc il repasse à 1.4.1-rc.0, et l’entrée 1.5.0 de `releases.json` revient au démarrage de la 1.5.0.
- **Survol des boutons (UI-33)** : Choisi sur captures le 2026-11-02, une règle par sorte de bouton : un bouton plein (principal, secondaire, suppression, interrupteur) mêle au survol 15 % de la couleur du texte de la page à son fond, donc s’assombrit en clair et s’éclaircit en sombre (jetons `--primary-hover`, `--secondary-hover`, `--destructive-hover`) ; un bouton discret (transparent, icône, ligne de menu, section du menu, tri, case du stockage, croix d’un dialogue) prend au survol le fond `accent` entier et son texte, en clair comme en sombre, et les boutons à icône faits main aussi ; un bouton à contour et une liste déroulante gardent le survol de shadcn, la liste déroulante gagnant celui qui lui manquait en clair ; un choix non retenu suit la règle des boutons discrets, un choix retenu celle des boutons pleins, sans zoom ; liens et onglets inchangés ; un focus clavier net (anneau de 3 px en `--ring` entier) sur chaque bouton, lien et onglet ; un bouton désactivé à 50 %, sans survol, avec le curseur normal, faits main compris ; pas d’état appuyé à part, et seules les couleurs changent. L’`accent` n’est pas renforcé. Exception à la règle de `ui/` : `ui/button/button.svelte`, `ui/select/select-trigger.svelte` et `ui/dialog/dialog-content.svelte` portent des classes modifiées à la main, signalées par un commentaire, parce que le défaut est dans leurs variantes. Tous les conteneurs du stockage ont la même pastille neutre.
- **Vue liste (FEAT-10)** : Choisie sur maquette (planche « D3 ») : une vue liste à côté des cartes, sans défilement (le mainteneur n’en veut pas dans la liste) ; un texte long passe à la ligne. Un sélecteur « Cartes / Liste » sur la page et la vue par défaut dans les préférences. Demandée avec UI-32, placée en tête de la 1.4.0 parce que c’est une nouvelle fonction et non un correctif.
- **Couleurs des vins (FEAT-03)** : Chaque couleur de vin a une vraie couleur, enregistrée en base ; les couleurs de départ reçoivent celles des étiquettes d’aujourd’hui. Créée depuis un formulaire, une couleur reçoit une teinte par défaut ou neutre ; dans Admin › Data, le sélecteur s’affiche dès la création ou la modification. Choisi sur maquette : sur la page Stockage, chaque place occupée prend la couleur de son vin ; les camemberts des statistiques prennent les vraies couleurs ; la liste des vins garde l’étiquette, colorée, et ajoute une bande à gauche de la carte ; les listes de bouteilles montrent l’étiquette colorée à côté du nom du vin. Pas de carte teintée (décision du 2026-10-31). Précisé le 2026-11-01 : les couleurs de départ sont les teintes de vin de la maquette (Rouge #7b1e2b, Blanc #ead98b, Rosé #f2a08c, Jaune #d4952a, N/A #9ca3af) ; une couleur créée depuis un formulaire reçoit le gris de N/A, sauf un nom reconnu, qui reprend sa teinte de départ. Changé le 2026-11-02, sur captures : le contour « seulement quand le contraste manque » donnait des bouteilles avec contour, d’autres sans, et un orange entre les deux, ce que le mainteneur refuse ; toute couleur reçoit désormais le même contour, dans sa propre teinte mêlée de 40 % de noir en clair et de 40 % de blanc en sombre, sur le stockage (une silhouette de bouteille sans étiquette ; une place vide est la même silhouette en contour), les étiquettes, la bande des cartes et la légende des statistiques. Une couleur choisie par l’utilisateur peut avoir un contour sous 3:1 (le blanc pur en clair : 2,85:1) : accepté.
- **Plan de la cave (FEAT-04)** : La page Stockage devient le plan : un clic sur une case ouvre la liste de ses bouteilles (vin, millésime, couleur), d’où l’on ouvre une bouteille, la marque bue ou la déplace ; on en coche plusieurs puis « Déplacer vers… » une autre case, sans glisser-déposer. Une case reste un bac, sans place précise. La page d’un vin a un bouton « Voir dans la cave », qui met en évidence les cases où il est. La disposition des conteneurs ne change pas (décision du 2026-10-31). Précisé le 2026-11-02 : le choix de la case d’un déplacement est le même sur les trois écrans qui déplacent (liste des bouteilles d’un vin, scan en lot, plan), groupé par conteneur avec la place libre de chaque case, les cases sans place et la case quittée grisées, sans recherche par nom ; chaque bouteille de la case a un menu « ⋯ » (marquer bue, déplacer, modifier) ; « Voir dans la cave » entoure les cases du vin d’un anneau avec une épingle, sous une ligne « Cases contenant … » et « Tout afficher » ; un visiteur voit les bouteilles d’une case sans pouvoir agir ; le MCP liste les bouteilles d’une case (`list_bottles` avec `caseId`).
- **À boire (FEAT-05)** : Une bouteille, et jamais un vin, peut porter « À boire avant » (une année, un mois facultatif), posé en un clic par « Ce mois-ci », « Cette année » ou « Choisir… », sur une ou plusieurs bouteilles d’un coup. L’année optimale reste facultative et prend le relais quand rien n’est posé. Ordre : date dépassée (signalée, gardée jusqu’à ce que l’utilisateur change ou retire la date), ce mois-ci, cette année, année optimale atteinte, puis par date. Pas d’entrée de menu : un bandeau sur l’accueil (« 3 bouteilles à boire bientôt, dont 1 en retard »), qui déplie la liste ; à revoir sur captures avant le merge. Sur la page Stockage, un repère sur les bouteilles à boire dans un horizon réglé dans les préférences, affiché par un interrupteur dont la valeur par défaut, éteinte, se règle aussi dans les préférences. Une bouteille bue quitte la liste et garde ses valeurs dans son historique (décision du 2026-10-31).
- **Fiche de dégustation (FEAT-06)** : Une seule fiche par bouteille bue : une note sur 5, l’occasion, le plat et une note libre, tous facultatifs ; l’occasion et le plat en texte libre, avec les valeurs déjà saisies proposées. Marquer une bouteille bue ouvre la fiche dans le même dialogue, avec « Enregistrer » et « Plus tard » ; une fiche laissée pour plus tard se signale dans l’historique, d’où on la complète. La note du vin reste l’avis global de l’utilisateur ; la moyenne des dégustations s’affiche à côté. La page du vin liste ses dégustations, la plus récente en premier ; le MCP pourra les lire (décision du 2026-10-31).
- **Producteurs (FEAT-07)** : Le producteur devient une vraie liste : la migration crée un producteur par nom déjà saisi, en regroupant les noms égaux à la casse, aux accents et aux espaces près, et Admin › Data propose « Fusionner deux producteurs » pour les autres doublons, au choix de l’utilisateur. Seul le nom est obligatoire ; la fiche peut porter pays et région, site web, adresse ou contact, description et photo. Elle montre ses vins, les bouteilles en cave et bues, et la moyenne des dégustations. Le champ du formulaire du vin devient une liste avec recherche, qui crée le producteur comme aujourd’hui, comme l’import CSV. Le nom d’un producteur mène à sa fiche ; une page liste les producteurs (Cave › Producteurs) ; la suppression est refusée tant que des vins l’utilisent (décision du 2026-10-31).
- **Revue de l’import CSV (FEAT-08)** : Remplace « Après la 1.0 : compte rendu de l’import ». L’import CSV vérifie d’abord, puis montre trois parties, « Prêt à importer », « Déjà en cave » et « À régler », où l’on règle chaque ligne : choisir parmi plusieurs vins, choisir ou créer une valeur inconnue, corriger une cellule invalide, passer ou importer une ligne déjà en cave, ou ignorer la ligne ; « Importer » écrit tout d’un coup. Les choix des imports précédents ne sont que des suggestions, signalées « pré-rempli d’après vos imports précédents ». À la fin, les lignes ignorées se téléchargent en CSV. L’import d’un export (JSON) reste sans revue (décision du 2026-10-31).
- **Notifications (FEAT-09)** : Admin › Notifications : ntfy (adresse du sujet, jeton facultatif) et un webhook JSON générique, un bouton « Envoyer un test », un jeton jamais réaffiché, la langue des messages (français ou anglais). Chaque événement s’active à part : sauvegarde automatique ratée (actif par défaut), récapitulatif « À boire » chaque semaine ou chaque mois au choix (rien s’il est vide), vin passé sous son stock minimum, récapitulatif hebdomadaire des bouteilles hors cave depuis plus de N jours (N réglable), mise à jour disponible. Cellar vérifie une fois par jour les versions publiées sur GitHub et l’affiche dans l’admin, notification ou pas. D’autres canaux seulement à la demande (décision du 2026-10-31).
- **Idées après la 1.0** : Discutées une par une le 2026-10-31 : chacune a maintenant sa décision et sa tâche (décision « Versions de 1.3.0 à 1.7.0 ») ; le texte ci-dessous garde les premières idées (2026-10-30). « À boire » : mettre en avant les bouteilles à boire, pas seulement par l’année de consommation ; pouvoir marquer une bouteille à boire cette année ou ce mois-ci, idée à étoffer. Plan de la cave : les conteneurs en grille, un clic sur une case montre ses bouteilles ; avec une vraie couleur choisie pour chaque couleur de vin (blanc, rouge…), affichée partout dans l’app, pour voir d’un coup d’œil ce que contient un casier. Liste d’envies : la page Pénurie se partage entre le stock minimum (« j’en veux toujours une, préviens-moi ») et une liste d’envies ou d’achats ; on y ajoute un vin depuis la liste des vins (un petit bouton), ou en tapant son nom (proposé s’il existe, sinon créé dans la base et ajouté) ; le retrait automatique une fois acheté reste à décider. Compte rendu d’import (voir « Après la 1.0 : compte rendu de l’import »). Fiche producteur : facultative, créée d’elle-même quand on ajoute un producteur comme aujourd’hui, complétée si on le souhaite. Fiche de dégustation : à chaque bouteille bue, une appréciation sur 5, l’occasion, l’accord avec le plat et une note, relues sur la fiche du vin et utiles au MCP ; la fiche et chacun de ses champs restent facultatifs, mais l’interface la met en avant pour donner envie de la remplir. Photo de l’étiquette : sur le téléphone, le formulaire du vin ouvre l’appareil photo et réduit l’image avant l’envoi. Notifications par ntfy ou webhook (sauvegarde ratée, bouteilles à boire), avec le choix de ce qu’on reçoit. Écartée : la valeur de la cave dans le temps, car personne ne met ses prix à jour.
- **Après la 1.0 : compte rendu de l’import** : Idée du mainteneur pour la première version après la 1.0, une fois tout ce qu’il faut pour la 1.0 terminé : au lieu de refuser les lignes qui ne s’importent pas, l’import finit par un compte rendu de ce qui est importé et de ce qui ne l’est pas, et permet de refaire à la main les correspondances des lignes refusées, par exemple les bouteilles qui correspondent à plusieurs vins (2026-10-18).

## Vue d’ensemble

| Version | Phase | Objectif | Tâches | Faites |
|---|---|---|---|---|
| 1.0.0 | P0 · Sécurité urgente | Fermer les accès non authentifiés et les failles exploitables avant toute autre chose. Tant que le serveur ne contrôle pas l'accès, le reste a peu de valeur. | SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08, REL-01 | 9 / 9 |
| 1.0.0 | P1 · Filets de sécurité | Mettre en place tests, lint, vérification i18n et une CI bloquante, et assainir les dépendances. Aucun refactoring avant que ce filet existe. | QA-01, QA-02, QA-03, QA-04, DEP-01, DEP-02, SEC-09, SEC-10 | 8 / 8 |
| 1.0.0 | P2 · Bugs fonctionnels | Corriger les bugs confirmés visibles par l’utilisateur. Corrections ciblées, peut avancer en parallèle de P1. | BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-06, BUG-07, BUG-08, BUG-09, DOC-01, BUG-10, BUG-11, BUG-12 | 13 / 13 |
| 1.0.0 | P3 · Mise à niveau du socle | Passer à SvelteKit 3, Vite 8 et TypeScript 6, et aux versions majeures des bibliothèques serveur, avant les gros refactorings pour ne pas réécrire deux fois. | DEP-03, DEP-04, DEP-05, DOC-02 | 4 / 4 |
| 1.0.0 | P4 · Fondations données | Une seule connexion SQLite, des transactions, des contraintes en base, des sauvegardes et restaurations fiables. | DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, REL-02 | 8 / 8 |
| 1.0.0 | P5 · Couche serveur et API | Routes minces : validation zod, puis service de domaine, puis réponse. Supprimer la duplication des CRUD et découper l'import CSV. | API-01, API-02, API-03, API-04, API-05, API-06 | 6 / 6 |
| 1.0.0 | P6 · Frontend | Chargement des données côté serveur, Svelte 5 partout, composants découpés par fonctionnalité, admin en vraies routes. | UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10 | 10 / 10 |
| 1.0.0 | P7 · Corrections d’avant 1.0 | Corriger ce que l’audit d’avant 1.0 (`reviews/audit-pre-1.0/`) juge bloquant : aucune donnée perdue ou faussée sans message, des notes de version justes, un numéro de version fiable pour develop et un contrat d’API figé. Publiée en 0.9.0. | REL-03, BUG-13, BUG-14, BUG-15, DATA-08, DATA-09, BUG-16, API-07, REL-04 | 9 / 9 |
| 1.0.0 | P8 · Suites de P7 | Tâches ouvertes par le mainteneur pendant P7 et P8 : la note de consommation, les vins jumeaux à l’import et la longueur des textes. Prévue pour 0.10.0. | BUG-17, BUG-18, DATA-10 | 3 / 3 |
| 1.0.0 | P9 · Restes de l’audit déjà décidés | Les tâches T1 à T16 de l’audit d’avant 1.0 qui portent une décision déjà prise, avec les points que le mainteneur y a rattachés le 2026-10-23. Prévue pour 0.11.0. Lots, chacun mergé avant le suivant ; les tâches d’un lot ne partagent aucun fichier, hors de `en.json`, `fr.json`, `docs/API.md`, `.gitignore` et du résumé 0.11.0 de `releases.json`, où chacune ajoute ses lignes et où le second merge résout le conflit en gardant les deux côtés : 1. DATA-11, UI-13 (déplacement de la base et dialogue de statut partagé, qui restructurent les fichiers des autres) ; 2. QA-05, DATA-12, DATA-13, BUG-19 ; 3. API-08, BUG-20, UI-11, REL-05 ; 4. UI-12, UI-14 ; 5. API-09 (routes de presque tous les domaines) ; 6. UI-15 (clés i18n de presque tous les composants). Terminée le 2026-10-28 (develop bf183d64), publiée en 0.11.0 le 2026-10-29. | DATA-11, UI-13, QA-05, DATA-12, DATA-13, BUG-19, API-08, BUG-20, UI-11, REL-05, UI-12, UI-14, API-09, UI-15 | 14 / 14 |
| 1.0.0 | P10 · Fin de l’audit | Le reste de l’audit d’avant 1.0 : thème, accessibilité, seeding, documentation, dépendances, lint et tests. Prévue pour 0.12.0. DEP-06 applique la convention de logs déjà décidée (« Petits choix ») mais attend P10 : passer `no-console` en erreur touche presque tous les composants, que P9 réécrit d’abord. Lots, mêmes règles qu’en P9 (résumé 0.12.0) : 1. DEP-06, DATA-14 (DEP-06 change les règles de lint de tout le code) ; 2. UI-16, DOC-03 ; 3. UI-17 ; 4. UI-18 (couleurs et sélecteurs de presque tous les composants). Terminée le 2026-10-29 (develop f14a795f), publiée en 0.12.0 le 2026-10-29. | DEP-06, DATA-14, UI-16, DOC-03, UI-17, UI-18 | 6 / 6 |
| 1.0.0 | P11 · Rangement des composants | Deux petites corrections trouvées en P10, puis le rangement des composants par domaine, à la toute fin, comme le veut la décision « Architecture (revue 7) ». Lots : 1. UI-20, BUG-21 ; 2. UI-19, seule, qui déplace presque tous les composants. Prévue pour la 1.0.0, après la vérification de P12. Terminée le 2026-10-29 (develop 70d9e148), publiée en 1.0.0 le 2026-10-30. | UI-20, BUG-21, UI-19 | 3 / 3 |
| 1.0.0 | P12 · Vérification d’avant 1.0 | Une revue complète en lecture seule après P11, comme l’audit d’avant 1.0 puis sa vérification : tout ce que l’audit demandait est fait, et le nettoyage n’a pas créé de nouveaux problèmes. Le mainteneur juge chaque constat : à corriger avant la 1.0 (tâches ajoutées ici) ou acceptable en l’état. Puis la 1.0.0, avec R2 de l’audit au tag : dépôt et image publics, protection de `main`. Revue faite le 2026-10-30 (QA-06). Lots des corrections, chacun mergé avant le suivant, résumé 1.0.0 : 1. SEC-12, API-12, BUG-22, BUG-23 ; 2. UI-21, UI-22, DEP-07 ; 3. DOC-04 (documentation d’après les deux premiers lots) ; 4. UI-23 ; puis REL-06, la publication, avec le mainteneur. Terminée le 2026-10-30 (develop 89d2c4c1), publiée en 1.0.0 le 2026-10-30. Lots 1 à 4 faits le 2026-10-30, puis la 1.0.0 publiée le même jour (tag v1.0.0 sur 8ad43dff) ; depuis le lot 2, le dépôt public repart d’un nouveau commit racine (décision « Nouveau départ à la 1.0 (REL-06) »). | QA-06, SEC-12, API-12, BUG-22, BUG-23, UI-21, UI-22, DEP-07, DOC-04, UI-23, REL-06 | 11 / 11 |
| 1.1.0 | P13 · Finitions et installation | Pour la 1.1.0, juste après la 1.0.0 : ce que voit d’abord un nouveau visiteur (installation dans le README, liens vers la doc de l’API), l’app installable sur le téléphone (PWA), et les finitions notées pendant P12 (décision « Versions après la 1.0 »). Lots, chacun mergé avant le suivant, résumé 1.1.0 (lots 1 à 3 faits le 2026-10-31, publiée en 1.1.0 le même jour) : 1. DOC-05, UI-27, SEC-13, BUG-24 ; 2. UI-24, UI-25, API-13 ; 3. UI-26, UI-29, DEP-08 ; UI-30 ; puis REL-07. | DOC-05, UI-27, SEC-13, BUG-24, UI-24, UI-25, API-13, UI-26, UI-29, UI-30, DEP-08, REL-07 | 12 / 12 |
| 1.2.0 | P14 · Serveur MCP | Pour la 1.2.0, enchaînée juste après la 1.1.0 : un serveur MCP intégré à Cellar, pour les assistants d’IA du réseau local (décision « Serveur MCP (P14) »), et la description OpenAPI de l’API, tirée des mêmes schémas zod. Lots : 1. SEC-11, API-14 (faits le 2026-10-31) ; 2. API-10, API-15 (faits le 2026-10-31) ; 3. API-11, DOC-06 (faits le 2026-10-31) ; BUG-25 ; puis REL-08. Publiée en 1.2.0 le 2026-10-31. | SEC-11, API-14, API-10, API-11, API-15, DOC-06, BUG-25, REL-08 | 8 / 8 |
| 1.3.0 | P15 · Navigation, photos et achats | Pour la 1.3.0 (décision « Versions de 1.3.0 à 1.7.0 ») : le menu par sections d’abord, parce que les pages qui suivent s’y rangent, puis les photos d’étiquette et la page Achats, dont les envies réutilisent l’envoi de photo. Lots, chacun mergé avant le suivant, résumé 1.3.0 : 1. UI-28 et FEAT-01 en parallèle (faits le 2026-10-31) (le menu et les photos ne touchent pas les mêmes fichiers) ; 2. FEAT-02, qui a besoin des deux (fait le 2026-11-01) ; 3. DEP-09 ; puis REL-09. Publiée en 1.3.0 le 2026-11-01. Si la phase traîne, la page Achats peut partir d’abord avec des envies en texte seul. | UI-28, FEAT-01, FEAT-02, DEP-09, REL-09 | 5 / 5 |
| 1.3.1 | P15b · Correctifs de la 1.3.0 | Pour la 1.3.1, avant P16 (décision « Version corrective 1.3.1 ») : UI-31 (fait le 2026-11-01) ; puis REL-14. Publiée en 1.3.1 le 2026-11-01. | UI-31, REL-14 | 2 / 2 |
| 1.3.2 | P15c · Cartes de vin | Pour la 1.3.2, avant P16 (décisions « Cartes de vin (UI-32) » et « Version corrective 1.3.1 », qui vaut aussi pour la 1.3.2) : UI-32 (fait le 2026-11-01) ; puis REL-15. Publiée en 1.3.2 le 2026-11-01. | UI-32, REL-15 | 2 / 2 |
| 1.4.0 | P16 · Couleurs et plan de la cave | Pour la 1.4.0 : les couleurs des vins, puis le plan de la cave, qui s’appuie dessus. Ordre : FEAT-10 (vue liste, demandée avec UI-32) ; FEAT-03 ; FEAT-11 (actions MCP, demandées après l’essai d’un utilisateur) ; FEAT-04 ; FEAT-12 (MCP plus complet, demandé après FEAT-11) ; FEAT-13 (deux refus, trouvés pendant FEAT-12) ; puis REL-10. DEP-10 passe après la 1.4.0. Publiée en 1.4.0 le 2026-11-02. | FEAT-10, FEAT-03, FEAT-11, FEAT-04, FEAT-12, FEAT-13, REL-10 | 7 / 7 |
| 1.4.1 | P16b · Survol des boutons | Pour la 1.4.1, avant P17 (décision « Version corrective 1.4.1 ») : UI-33 ; puis REL-16. Publiée en 1.4.1 le 2026-11-02. | UI-33, REL-16 | 2 / 2 |
| 1.5.0 | P17 · À boire et dégustation | Pour la 1.5.0 : la vie d’une bouteille jusqu’à ce qu’on la boive. Les deux tâches ajoutent leur repère et leur fiche à la liste d’une case du plan (FEAT-04). Ordre : FEAT-05 et FEAT-06 ; DEP-10 (reportée de la 1.4.0) ; puis REL-11. | FEAT-05, FEAT-06, DEP-10, REL-11 | 0 / 4 |
| 1.6.0 | P18 · Producteurs et revue de l’import | Pour la 1.6.0 : les producteurs d’abord, parce que la revue de l’import doit savoir relier ou créer un producteur. Ordre : FEAT-07 ; FEAT-08 ; puis REL-12. | FEAT-07, FEAT-08, REL-12 | 0 / 3 |
| 1.7.0 | P19 · Notifications | Pour la 1.7.0 : les notifications, qui utilisent « À boire » (FEAT-05), le statut hors cave et la vérification des mises à jour. Ordre : FEAT-09 ; puis REL-13. | FEAT-09, REL-13 | 0 / 2 |

## P0 · Sécurité urgente (1.0.0)

Fermer les accès non authentifiés et les failles exploitables avant toute autre chose. Tant que le serveur ne contrôle pas l'accès, le reste a peu de valeur.

### SEC-01 · Réactiver la protection CSRF

Sévérité **critique** · effort **XS** · statut **Fait**

**Suivi** (2026-10-09) : Mergé dans develop (d2c1e8c..5ad7e8a), pas de PR. Déploiement : créer .env avec ORIGIN.

**Problème** : `csrf.checkOrigin: false` permet à n'importe quel site ouvert sur le réseau local d'envoyer des POST, par exemple vers `/api/admin/wipe-database`, qui ne lit même pas le corps de la requête.

**Fichiers** : `svelte.config.js:23-25`, `docker-compose.yml`, `README-Docker.md`

**À faire**

- Remettre `checkOrigin: true`.
- Définir `ORIGIN` dans docker-compose (ou `PROTOCOL_HEADER`/`HOST_HEADER` derrière un reverse proxy) ; c'est probablement son absence qui avait poussé à couper le contrôle.
- Documenter la variable dans README-Docker.

**Critère d’acceptation** : Un POST cross-origin vers /api/* est refusé (403). L’application fonctionne normalement depuis son URL configurée.

**Sources** : review-2-public-api.md#C2, review-7-infra-architecture.md#C1

### SEC-02 · Authentification côté serveur (session)

Sévérité **critique** · effort **M** · statut **Fait**

**Suivi** (2026-10-09) : Mergé dans develop (2fd6cdf..f734636), pas de PR. Session serveur : cookie cellar_session httpOnly/SameSite=Strict (Secure en HTTPS), jeton haché SHA-256 en base avec expiration ; 401 sur toute écriture et /api/admin/** sans session (contrôle sur route.id) ; /admin et /barcode redirigent vers /wines?login ; GET /api/images public ; changer le code révoque les autres sessions. Mode cron des sauvegardes indisponible jusqu’au jeton de DATA-05 (action de mise à jour 0.2.0).

**Problème** : L'état « connecté » n'est qu'un drapeau `sessionStorage` côté client. `handle` dans hooks.server.ts ne vérifie rien : `curl -X POST /api/admin/wipe-database` vide la base.

**Fichiers** : `src/hooks.server.ts:335`, `src/routes/api/access-code/+server.ts`, `src/lib/stores/auth.ts`, `src/routes/admin/+page.svelte:199-240`

**À faire**

- POST /api/access-code valide : poser un cookie `httpOnly`, `SameSite=Lax` (décision du 2026-10-09 ; et `Secure` derrière HTTPS) contenant un jeton aléatoire, stocké haché en base avec une expiration.
- Dans hooks.server.ts, remplir `event.locals.session` ; renvoyer 401 sur `/api/admin/**` et sur toute méthode autre que GET sans session valide.
- Décision (2026-10-08) : lecture libre, écriture protégée. Les GET hors `/api/admin` restent publics ; toute écriture et tout `/api/admin/**` exigent une session, y compris les GET sensibles (téléchargement de sauvegarde, export CSV, liste des sauvegardes).
- Ajouter `+layout.server.ts` sur /admin qui redirige sans session.
- Le store `auth.ts` lit l’état depuis le serveur (`/api/session`) ; supprimer la logique sessionStorage.
- Le timeout de session est appliqué côté serveur.

**Critère d’acceptation** : Sans cookie, toute mutation et tout /api/admin/** répondent 401. Modifier sessionStorage dans la console ne donne plus accès à rien.

**Sources** : review-2-public-api.md#C1, review-4-admin-frontend.md#C1

### SEC-03 · Durcir le code d'accès

Sévérité **majeur** · effort **S** · dépend de SEC-02 · statut **Fait**

**Suivi** (2026-10-09) : Mergé dans develop (4f54278..59a5f52), pas de PR. Code haché scrypt (format auto-descriptif, paramètres bornés) + timingSafeEqual ; plus de 1234 : premier code choisi au premier lancement (409 ensuite) ; migration du code en clair (1234 supprimé) + VACUUM ; limite par adresse (/64 en IPv6) : 5 par 60 s glissantes, 115 max par jour, 429 + Retry-After ; la restauration garde le code de l’instance ; procédure de réinitialisation dans README-Docker. 3 actions de mise à jour 0.2.0.

**Problème** : Code par défaut `1234` stocké en clair (présent dans chaque sauvegarde), comparaison `===` qui n’est pas à temps constant, aucune limite de tentatives : 10 000 requêtes suffisent.

**Fichiers** : `src/routes/api/access-code/+server.ts:10,77,99,117,124`, `src/lib/db/migrations.ts:528-531`

**À faire**

- Hacher le code avec scrypt (`node:crypto`) et comparer avec `timingSafeEqual`.
- Limiter les tentatives par IP (par exemple 5 par minute, avec backoff).
- Imposer le choix du code au premier lancement au lieu de `1234`.
- Le GET ne crée plus de réglages ; l’initialisation passe dans le seeding.

**Critère d’acceptation** : Le code n’apparaît plus en clair en base. La 6e tentative en moins d’une minute reçoit 429.

**Sources** : review-2-public-api.md#M2

### SEC-04 · Corriger les deux XSS stockées

Sévérité **critique** · effort **XS** · statut **Fait**

**Suivi** (2026-10-09) : Mergé dans develop (4cd3fcc..b2c3e24), pas de PR.

**Problème** : `href={wineDefinition.website}` accepte `javascript:` ; `{@html}` injecte le nom d'un conteneur venu de la base.

**Fichiers** : `src/routes/wines/[id]/+page.svelte:477`, `src/routes/storage/+page.svelte:1033,1111`, `src/lib/components/WineDefinitionDialog.svelte:1157`

**À faire**

- Helper `safeUrl()` qui n’accepte que http/https, appliqué à l’affichage, avec `rel="noopener noreferrer"`.
- Rejeter les autres schémas à l’enregistrement (validation serveur).
- Remplacer `{@html}` par du texte, avec le `<strong>` écrit dans le template.

**Critère d’acceptation** : Un site `javascript:alert(1)` est refusé et ne s’affiche jamais comme lien. Un conteneur nommé `<img src=x onerror=alert(1)>` s’affiche en texte.

**Sources** : review-5-core-ui.md#C1, review-6-feature-pages.md#C2

### SEC-05 · Sécuriser les chemins de fichiers

Sévérité **majeur** · effort **M** · statut **Fait**

**Suivi** (2026-10-09) : Mergé dans develop (7b6e8a4..533f6c7), pas de PR. resolveInDir() dans src/lib/server/paths.ts appliqué aux 9 routes + create-backup/create-export/pdf-labels/barcode-settings/import-images-zip. Préfixe code-barres ^[A-Za-z0-9-]{0,6}$ (minuscules gardées). Test unitaire du helper : script node --test hors dépôt, à porter dans QA-01.

**Problème** : Plusieurs chemins construits à partir d’entrées utilisateur sortent de leur dossier : suppression de CSV, écriture d’export, préfixe de code-barres, et `filename` d’image importé par CSV qui permet de lire ou supprimer `cellar.db`.

**Fichiers** : `src/routes/api/admin/cleanup-csv/+server.ts:19`, `src/routes/api/admin/export-csv/+server.ts:256-260`, `src/routes/api/admin/download-backup/+server.ts:15-23`, `src/routes/api/admin/delete-backup/+server.ts:15-19`, `src/routes/api/admin/images/+server.ts:173,190`, `src/routes/api/admin/download-images/+server.ts:62`, `src/routes/api/barcode/csv/+server.ts:34,165-168`, `src/routes/api/admin/import-csv/+server.ts:347-413`, `src/routes/uploads/[...path]/+server.ts`

**À faire**

- Créer un helper `resolveInDir(dir, name)` : `basename`, regex de nom autorisé, puis vérification que le chemin résolu reste dans le dossier.
- L’appliquer à toutes les routes listées.
- Import CSV/JSON de `wineImages` : liste blanche de colonnes, `path` forcé côté serveur.
- Valider le préfixe de code-barres (`^[A-Za-z0-9-]{0,6}$`, voir les décisions).
- uploads : vérifier `stats.isFile()` et ajouter `X-Content-Type-Options: nosniff`.

**Critère d’acceptation** : Un test unitaire du helper couvre `..`, chemin absolu et octet nul. Aucune route listée ne construit plus un chemin sans passer par lui.

**Sources** : review-3-admin-api.md#M4, review-3-admin-api.md#M5, review-2-public-api.md#M1

### SEC-06 · Uploads et zip robustes

Sévérité **majeur** · effort **S** · statut **Fait**

**Suivi** (2026-10-09) : Mergé dans develop (2942f19..49ce542), pas de PR. Zip : helper unique (erreurs gérées, 10 000 entrées, 2 Gio décompressés) ; 413 avant formData() ; images détectées par magic bytes, y compris admin/upload-image (BMP/SVG/HEIC désormais refusés).

**Problème** : Un zip piégé fait planter le processus Node (aucun écouteur `error` sur yauzl, crash reproduit). `formData()` charge tout en mémoire avant le contrôle de taille. Pas de protection contre les zip bombs. Le type MIME est celui annoncé par le client.

**Fichiers** : `src/routes/api/admin/restore/+server.ts:61-131`, `src/routes/api/admin/import-json/+server.ts:110-173`, `src/routes/api/admin/import-images-zip/+server.ts:42-45`, `src/routes/api/upload/image/+server.ts:22-47`

**À faire**

- `zipfile.on("error", reject)` et gestion des erreurs des readStream.
- Limites de nombre d’entrées et de taille décompressée (`uncompressedSize` est déjà collecté mais pas utilisé).
- Vérifier `Content-Length` avant `formData()`.
- Images : détection par magic bytes, extension déduite du type détecté.

**Critère d’acceptation** : Le zip de test `images/../../x` renvoie 400 sans crash. Un zip bomb est refusé.

**Sources** : review-3-admin-api.md#M1, review-3-admin-api.md#M8, review-2-public-api.md#M4

### SEC-07 · Durcir l’image Docker

Sévérité **majeur** · effort **S** · statut **Fait**

**Suivi** (2026-10-09) : Mergé dans develop (9c5e304..7644fed), pas de PR. USER node (uid 1000), image 747 → 453 Mo (prune --prod, sans sqlite ni git-cliff), BODY_SIZE_LIMIT=512M, docker stop 0,15 s au lieu de 10 s + SIGKILL (timer de sauvegarde unref). Action de mise à jour 0.2.0 : chown des dossiers de données.

**Problème** : Le conteneur tourne en root avec `chmod -R 777`. `BODY_SIZE_LIMIT` est à 10 Go. Les devDependencies sont copiées dans l’image finale, et le paquet `sqlite` y est installé sans servir.

**Fichiers** : `Dockerfile:38,46,54,57,66`, `docker-compose.yml`

**À faire**

- `USER node` et `chown node:node` sur les dossiers des volumes.
- `BODY_SIZE_LIMIT` à 512 Mo (décision du 2026-10-09) : la limite est globale dans adapter-node, et restore, import-json, import-images-zip et upload-image acceptent jusqu’à 500 Mo depuis SEC-06. En dessous, `formData()` échoue en 500 au lieu de 413.
- `pnpm deploy --prod` (ou `prune --prod`) avant de copier node_modules.
- Retirer `sqlite` du runtime ; mesurer la taille de l’image avant et après.
- Arrêt propre : lors des tests de SEC-01 à SEC-08, `node build` restait vivant après SIGTERM et il a fallu `kill -9`. Trouver ce qui retient le processus (timer du planificateur de sauvegardes, connexion SQLite, `SHUTDOWN_TIMEOUT` d’adapter-node) ; `docker stop` doit finir sans attendre le SIGKILL.
- README-Docker : il affirme que le conteneur tourne en non-root, ce qui est faux aujourd’hui ; le corriger avec ce durcissement et revoir les mentions du port 3000 (conteneur) et 3005 (hôte).
- L’image embarque git-cliff (devDependency de REL-01, environ 11 Mo par architecture) : il disparaît avec l’installation de production.
- Passer en non-root change probablement le propriétaire attendu de `docker-data` : ajouter l’action correspondante dans `releases.json` (voir RELEASING.md).

**Critère d’acceptation** : `docker run … id -u` ne renvoie pas 0. L’image est plus légère. Le healthcheck passe.

**Sources** : review-7-infra-architecture.md#M2

### SEC-08 · Mises à jour de sécurité des dépendances

Sévérité **critique** · effort **S** · statut **Fait**

**Suivi** (2026-10-09) : Mergé dans develop (84a4e97..ac32df9), pas de PR. audit --prod : 0 critique, 0 haute.

**Problème** : `pnpm audit` : 128 vulnérabilités (3 critiques, 55 hautes). Les plus importantes touchent du code exécuté en production : jspdf 3.0.2 (inclusion de fichier local et path traversal, utilisé côté serveur), drizzle-orm 0.44 (injection SQL via les identifiants), @sveltejs/kit 2.36 (DoS/SSRF, contournement de BODY_SIZE_LIMIT dans adapter-node), devalue.

**Fichiers** : `package.json`, `pnpm-lock.yaml`, `src/routes/api/barcode/pdf-labels/+server.ts`

**À faire**

- jspdf 3 → 4.2 : seul changement cassant, l’accès au système de fichiers est désactivé par défaut ; vérifier que le PDF n’en dépend pas.
- drizzle-orm 0.44 → 0.45 et drizzle-kit 0.31.11.
- @sveltejs/kit → dernière 2.x (2.70), adapter-node → 5.5, vite → 7.3, vite-plugin-svelte → 6.2.
- Relancer `pnpm audit` ; beaucoup des vulnérabilités restantes disparaîtront avec DEP-01 (paquets inutilisés).

**Critère d’acceptation** : `pnpm audit --prod` ne montre plus aucune vulnérabilité critique ou haute sur un paquet utilisé. Génération PDF et pages principales testées à la main.

**Sources** : pnpm audit (2026-10-08)

### REL-01 · Versions, releases et guide de migration

Sévérité **majeur** · effort **M** · statut **Fait**

**Suivi** (2026-10-09) : Mergé dans develop (ceaf6ed..7e82d21), pas de PR. Critère vérifié en vrai le 2026-10-09 : tag v0.2.0-rc.1 → pré-version GitHub (résumé, actions, changelog) et images :0.2.0-rc.1 + :dev (amd64/arm64). v0.1.0 tagué sur 556c7bb avec sa release.

**Problème** : Chaque push sur main publie `:latest` sans numéro de version, sans release GitHub ni changelog. Rien n’indique les actions à faire lors d’une mise à jour (par exemple créer le `.env` avec `ORIGIN` depuis SEC-01), ni les versions qu’on ne peut pas sauter.

**Fichiers** : `.github/workflows/docker-publish.yml`, `package.json`, `UPGRADING.md`, `CHANGELOG.md`, `cliff.toml`, `scripts/`

**À faire**

- Publier uniquement sur un tag. `vX.Y.Z-rc.N` posé sur develop publie `:dev` et `:X.Y.Z-rc.N`, avec une release GitHub marquée pré-version. `vX.Y.Z` posé sur main publie `:latest`, `:X.Y.Z` et `:X.Y`. La CI refuse un tag posé sur la mauvaise branche ; un push sans tag ne publie rien.
- Source unique et lisible par machine (JSON) des actions de mise à jour : pour chaque version, les actions à faire et un indicateur « arrêt obligatoire ». `UPGRADING.md`, les notes de release, le script et le contrôle au démarrage (REL-02) en dérivent.
- Notes de release : résumé écrit à la main, section « Upgrade actions » (ou « None »), puis changelog détaillé généré par git-cliff depuis les conventional commits. Le même contenu alimente `CHANGELOG.md`.
- La CI échoue si une version contient un commit `BREAKING CHANGE:` (ou `!`) sans entrée dans la source des actions.
- `node scripts/upgrade-path.mjs <de> <vers>` affiche dans l’ordre toutes les actions entre deux versions et les arrêts obligatoires.
- Version de package.json alignée sur le tag. Tag `v0.1.0` sur la version stable actuelle (556c7bb). Première entrée : v0.2.0 (fin de P0) exige `ORIGIN` dans `.env`.
- Notes de release, CHANGELOG.md et UPGRADING.md en anglais.

**Critère d’acceptation** : Un tag rc sur develop publie `:dev` et une pré-version GitHub dont les notes contiennent le résumé, les actions requises et le changelog. `upgrade-path.mjs 0.1.0 0.2.0` affiche l’action `ORIGIN`.

**Sources** : Décision du 2026-10-08 (versions et releases)

## P1 · Filets de sécurité (1.0.0)

Mettre en place tests, lint, vérification i18n et une CI bloquante, et assainir les dépendances. Aucun refactoring avant que ce filet existe.

### QA-01 · Mettre en place Vitest

Sévérité **majeur** · effort **S** · statut **Fait**

**Suivi** (2026-10-10) : f73d895..45cef85 sur develop : Vitest, 165 tests (dont 3 it.fails BUG-01/API-01), base :memory: migrée, scripts/test-*.ts supprimés

**Problème** : Aucun test automatisé. Les fichiers `scripts/test-*.ts` ne sont pas des tests : pas d’assertions, ils écrivent dans la vraie base et ne compilent plus.

**Fichiers** : `package.json`, `scripts/test-*.ts`

**À faire**

- Installer vitest. Fixture : base SQLite `:memory:` sur laquelle on applique les migrations Drizzle.
- Premiers tests : génération de codes-barres, `resolveInDir`, création de bouteilles.
- Reprendre les preuves de P0 : `resolveInDir` avec `..`, `.`, nom caché, chemin absolu (y compris `C:\`), octet nul et caractères de contrôle, sous-dossier, nom vide ; `extractZip` avec `images/../../x`, zip bomb, plus de 10 000 entrées, en-tête qui ment sur la taille et deflate corrompu (vérifier aussi qu’aucun descripteur ne reste ouvert) ; `detectImageType` et `rejectOversizedUpload`.
- Supprimer `scripts/test-*.ts`.
- Reprendre les preuves de SEC-02 et SEC-03 : quelles méthodes et routes exigent une session (chemins encodés compris), expiration et déconnexion, restauration d’une sauvegarde sans table `sessions`, codes 4xx d’access-code et settings ; hachage scrypt et rejet d’un hash mal formé, migration du code en clair (et suppression de `1234`), limite de tentatives avec une horloge simulée (rafale en bord de fenêtre, rythme lent sur 24 h).

**Critère d’acceptation** : `pnpm test` passe en local et en CI, avec au moins un test par module critique cité.

**Sources** : review-1-data.md#M5, review-7-infra-architecture.md#M4

### QA-02 · ESLint et Prettier

Sévérité **mineur** · effort **S** · statut **Fait**

**Suivi** (2026-10-10) : 0bb18bd..8f64f06 sur develop : ESLint + Prettier (4 espaces), pnpm lint 0 erreur / 1634 avertissements, commit de formatage e0ab008 (ignoré par git blame)

**Problème** : Ni lint ni formatage alors que le code contient des `eslint-disable`. 478 `any`, environ 670 `console.*`.

**Fichiers** : `package.json`, `src/lib/utils.ts:8,10`

**À faire**

- eslint-plugin-svelte et typescript-eslint en config flat, plus prettier-plugin-svelte.
- Règles `no-explicit-any` et `no-console` en avertissement au début.
- Un seul commit de formatage, séparé du reste.

**Critère d’acceptation** : `pnpm lint` passe (avertissements tolérés). Le formatage est appliqué.

**Sources** : review-7-infra-architecture.md#M4

### QA-03 · Vérification i18n et clés manquantes

Sévérité **majeur** · effort **S** · statut **Fait**

**Suivi** (2026-10-10) : 45cef85..0bb18bd sur develop : pnpm i18n:check (0 manquante, 0 doublon), 22 clés ajoutées, ~105 inutilisées supprimées

**Problème** : 30 clés utilisées dans le code n’existent ni en fr ni en en : l’interface affiche la clé brute (`toast.error_saving_*`, `admin.clear`…). On trouve aussi 21 clés en double dans les JSON, et un `|| "Réessayer"` qui ne sert jamais.

**Fichiers** : `src/lib/i18n/locales/fr.json`, `src/lib/i18n/locales/en.json`, `src/lib/components/QrScannerDialog.svelte:221`

**À faire**

- Script qui extrait les clés `$_('…')` du code et les compare aux deux JSON (clés manquantes, en double, inutilisées).
- Ajouter les clés manquantes et dédoublonner.
- Lancer le script en CI.
- Clés devenues inutiles avec la suppression du mode cron (SEC-02) : `admin.cron`, `admin.cron_command`, `ui.external_cron_job`.

**Critère d’acceptation** : Le script sort 0 clé manquante et 0 doublon, et fait échouer la CI sinon.

**Sources** : review-4-admin-frontend.md#M8, review-7-infra-architecture.md#M7

### QA-04 · CI bloquante avant publication de l’image

Sévérité **majeur** · effort **S** · dépend de QA-01, QA-02, QA-03 · statut **Fait**

**Suivi** (2026-10-10) : fad097a..fa06516 sur develop : ci.yml (verify : check, lint, test, i18n:check, build) sur PR et push develop ; release.yml ne publie qu’après verify (needs)

**Problème** : La CI pousse `:latest` sur GHCR à chaque push sur main, sans check ni test. Le compose consomme `:latest`, donc un commit cassé part en production au prochain pull.

**Fichiers** : `.github/workflows/release.yml`, `docker-compose.yml`

**À faire**

- Depuis REL-01, le workflow s’appelle `release.yml` et ne publie que sur un tag de version (plus de tag par SHA) : `verify` doit passer avant `release.mjs check` et la publication.
- Job `verify` : `pnpm install --frozen-lockfile`, puis check, lint, test, vérification i18n et build.
- `build-and-push` dépend de `verify` via `needs`.
- Lancer `verify` sur les pull requests et les pushs de develop.
- Trouvé pendant la release 0.6.0 : le job `release` de `release.yml` n’avait pas de `timeout-minutes`. Le 2026-10-13, qemu a planté (« Illegal instruction ») pendant le build arm64 émulé de v0.6.0, et le job est resté bloqué 6 h, la limite par défaut de GitHub, avant d’être annulé, sans rien publier ; le même blocage a touché v0.7.0-rc.1 et v0.7.0, et chaque fois la relance du job en échec a réussi en 8 à 11 min. Fait le 2026-10-13 : `timeout-minutes: 30` sur le job `release`, et RELEASING.md dit de relancer. Reste possible : un runner arm64 natif (`ubuntu-24.04-arm`) au lieu de qemu.

**Critère d’acceptation** : Une PR qui casse un test ne peut pas publier d’image.

**Sources** : review-7-infra-architecture.md#M3

### DEP-01 · Assainir les dépendances

Sévérité **mineur** · effort **S** · statut **Fait**

**Suivi** (2026-10-10) : fa06516..ebb7a2f sur develop, CI verte (run 38060424160) : un seul lockfile, pnpm 10.34.6 épinglé (packageManager) et Node 24 (engines), @lucide/svelte 1.51, 11 paquets retirés, image 440 → ~385 Mo ; action de mise à jour 0.3.0 pour les installations depuis les sources

**Problème** : Deux lockfiles (package-lock.json est figé depuis septembre 2025 et a déjà divergé). Deux paquets d’icônes, dont `lucide-svelte`, déprécié. 8 dépendances jamais importées. Des `@types/*` en dépendances de production, dont deux obsolètes.

**Fichiers** : `package.json`, `package-lock.json`, `.npmrc`

**À faire**

- Supprimer package-lock.json ; ajouter `packageManager: pnpm@10.x` et `engines.node`.
- Retirer : @tanstack/*, @internationalized/date, @tailwindcss/forms, @tailwindcss/typography, adapter-auto, @types/jspdf, @types/csv-parse. Garder zod (pour API-01). Retirer formsnap, sveltekit-superforms et `components/ui/form/` (décision UI-06 : form actions natives).
- Déplacer les `@types/*` restants en devDependencies.
- Migrer les 41 imports `lucide-svelte` vers `@lucide/svelte` 1.x (vérifier les icônes renommées).
- Trouvé pendant SEC-07 : l’image de production garde des paquets utilisés seulement côté client (`lucide-svelte` 29 Mo, `@tanstack/*`, `html5-qrcode`) et esbuild tiré par svelte-i18n. adapter-node les embarque déjà dans `build/` : les passer en devDependencies réduit encore l’image (453 Mo après SEC-07).

**Critère d’acceptation** : Un seul lockfile, aucune dépendance inutilisée (vérifié avec knip ou un grep), un seul paquet d’icônes.

**Sources** : review-7-infra-architecture.md#M5, review-7-infra-architecture.md#M6

### DEP-02 · Mises à jour mineures du front

Sévérité **évolution** · effort **S** · dépend de SEC-08 · statut **Fait**

**Suivi** (2026-10-10) : ebb7a2f..cca7964 sur develop, CI verte (run 38065038292) : svelte 5.57.1, bits-ui 2.19.5, tailwindcss 4.3.3, zod 4.6.5, yauzl 3.4.0, jsbarcode 3.12.3… ; pnpm audit 12 → 4 alertes (0 haute), prod 2 → 1 (csv-parse, majeure → DEP-04) ; parcours testés en navigateur headless

**Problème** : Le front a pris beaucoup de retard dans les versions mineures : svelte 5.38 → 5.57, bits-ui 2.9 → 2.19, tailwindcss 4.1 → 4.3, svelte-check 4.3 → 4.7, zod 4.0 → 4.6. svelte 5.57.1 est aussi le minimum requis par SvelteKit 3.

**Fichiers** : `package.json`

**À faire**

- Mettre à jour svelte, bits-ui, tailwindcss avec @tailwindcss/vite, tailwind-merge, tw-animate-css, svelte-check, zod, yauzl, jsbarcode et tsx.
- Lire les changelogs de bits-ui (les composants shadcn de `ui/` en dépendent).
- Passer en revue les avertissements de dépréciation de SvelteKit 2.70 : ils préparent P3.
- Relancer `pnpm audit` : source-map-js 1.2.2 (tiré par @tailwindcss/vite) corrige la dernière vulnérabilité haute hors superforms ; svelte et yauzl corrigent les modérées de production restantes après SEC-08.

**Critère d’acceptation** : check, test et build passent. Parcours principaux testés à la main : liste des vins, ajout de bouteille, scan, admin.

**Sources** : pnpm outdated (2026-10-08)

### SEC-09 · csv-parse 7 : faille de l’import CSV

Sévérité **majeur** · effort **S** · dépend de QA-01 · statut **Fait**

**Suivi** (2026-10-11) : 6451719..56ac19a sur develop, CI verte (run 38128220966) : csv-parse 6.1.0 → 7.0.3, pnpm audit --prod : aucune alerte. Tests ajoutés pour l’import CSV (dont en-tête __proto__), la restauration des modèles d’étiquettes et le seeding CSV. La faille n’était pas atteignable (group_columns_by_name jamais utilisé).

**Problème** : csv-parse 6.1.0 a une alerte modérée en production (GHSA-8cw4-87c7-c6xx : remplacement de prototype par le chemin `columns`), atteignable par l’import CSV de l’admin, qui lit avec `columns: true`. Seule la 7.0.2 la corrige. L’import exige une session depuis 0.2.0, ce qui limite le risque, mais c’est la dernière alerte de `pnpm audit --prod`.

**Fichiers** : `package.json`, `src/routes/api/admin/import-csv/+server.ts:116-126`, `src/routes/api/admin/restore-label-presets/+server.ts`, `src/lib/db/migrations.ts`

**À faire**

- Décision du 2026-10-10 : tâche dédiée, faite avant P2, au lieu d’attendre DEP-04.
- csv-parse 6 → 7 (dernière 7.x publiée depuis au moins 7 jours), en lisant le changelog de la 7.0.0.
- Vérifier les trois usages : import CSV, restauration des modèles d’étiquettes, migrations.
- Test : un CSV dont un en-tête vaut `__proto__` ne modifie aucun prototype.

**Critère d’acceptation** : `pnpm audit --prod` ne montre plus aucune alerte. Import CSV et restauration des modèles d’étiquettes testés.

**Sources** : pnpm audit (2026-10-10), GHSA-8cw4-87c7-c6xx

### SEC-10 · Épingler les actions GitHub

Sévérité **mineur** · effort **XS** · dépend de QA-04 · statut **Fait**

**Suivi** (2026-10-11) : df0aea1..6451719 sur develop, CI verte (run 38127712952) : 7 actions épinglées par SHA (checkout v7.0.1, setup-node v7.0.0, qemu v4.4.0, buildx v4.4.1, login v4.6.0, metadata v6.2.0, build-push v7.4.0), procédure de mise à jour dans AGENTS.md. Preuve finale faite le 2026-10-11 : le tag v0.4.0-rc.1 (98c6261) a publié normalement (release.yml run 38147452646 : verify et release verts, pré-version GitHub, images :dev et :0.4.0-rc.1).

**Problème** : Les workflows utilisent des tags flottants (`actions/checkout@v7`, `docker/build-push-action@v7`…). Un tag peut être déplacé vers du code publié la veille, voire compromis : la règle des 7 jours ne couvre pas les actions, alors que `release.yml` peut écrire dans GHCR et dans les releases.

**Fichiers** : `.github/workflows/ci.yml`, `.github/workflows/release.yml`

**À faire**

- Décision du 2026-10-10.
- Remplacer chaque `uses:` externe par le SHA complet du commit de sa version, avec la version en commentaire (`@<sha> # v7.0.1`).
- Ne prendre que des versions publiées depuis au moins 7 jours.
- Écrire dans AGENTS.md comment les mettre à jour : vérifier la date de la release, puis changer le SHA et le commentaire ensemble.

**Critère d’acceptation** : Aucun `uses:` externe ne pointe vers un tag. La CI de develop passe, et le tag rc suivant publie normalement.

**Sources** : Décision du 2026-10-10

## P2 · Bugs fonctionnels (1.0.0)

Corriger les bugs confirmés visibles par l’utilisateur. Corrections ciblées, peut avancer en parallèle de P1.

### BUG-01 · Codes-barres : un seul format

Sévérité **critique** · effort **S** · dépend de QA-01 · statut **Fait**

**Suivi** (2026-10-11) : a903ec2..f53220a sur develop, CI verte (run 38130795605) : formatBarcode/formatBarcodeRange (10 caractères, BarcodeRangeError au lieu de tronquer) partout ; stats réutilise getNextBarcodeNumber ; 400 pour une plage hors limites, 409 pour un préfixe épuisé ; codes manuels (EAN-13) ignorés pour le prochain numéro ; validateurs morts supprimés (item d’API-06 fait). Preuve : tests CSV = PDF (98–101) et serveur réel (pdftotext identique au CSV, bouteilles retrouvées). Point ouvert : WineBottleDialog affiche un message générique pour le 409.

**Problème** : Les codes attribués font 10 caractères, mais 5 endroits calculent sur 13. Conséquences : l’export CSV par plage ne retrouve aucune bouteille, le « prochain code » affiché est faux, CSV et PDF divergent. `slice(-n)` tronque sans prévenir, ce qui crée des doublons.

**Fichiers** : `src/lib/utils/barcode.ts:95-113`, `src/routes/api/barcode/csv/+server.ts:44`, `src/routes/api/barcode/stats/+server.ts:41-66`, `src/routes/barcode/+page.svelte:269,358,364`

**À faire**

- Une seule fonction `formatBarcode(prefix, n)` partagée par le client et le serveur, qui lève une erreur au lieu de tronquer.
- `stats` réutilise `getNextBarcodeNumber()`.
- Tests unitaires.
- Trouvé pendant QA-01 : `generateSequentialBarcode` (`src/lib/utils/barcode.ts`) tronque avec `slice(-remainingChars)` : avec un préfixe de 6 caractères, le 10 000e code reprend un code déjà attribué. Un test `it.fails` de `src/lib/utils/barcode.test.ts` le documente : le passer en `it` avec la correction.

**Critère d’acceptation** : Pour la même plage, le CSV et le PDF contiennent les mêmes codes, et l’export CSV retrouve les bouteilles existantes.

**Sources** : review-6-feature-pages.md#C1

### BUG-02 · Admin images : suppression et filtre

Sévérité **majeur** · effort **S** · statut **Fait**

**Suivi** (2026-10-11) : 72c881f..a903ec2 sur develop, CI verte (run 38130725091) : DELETE /api/admin/images prend {imageIds[], force} validé par zod, 409 avec les vins concernés, force = détache puis supprime dans une transaction ; dialogue réécrit en Svelte 5 avec « Supprimer quand même » ; recherche liée au store, « Tout sélectionner » et « Exporter » ne prennent que les images visibles. 16 tests Vitest + parcours navigateur headless (16/16). Point ouvert : une image cochée puis masquée par la recherche reste supprimable.

**Problème** : Le dialogue envoie `imageIds` alors que l’API attend `imageId` : la suppression échoue toujours. La recherche n’est pas `$bindable`, donc « Exporter » et « Tout sélectionner » ignorent le filtre (risque de supprimer des images masquées).

**Fichiers** : `src/lib/components/admin/dialogs/ImageDeleteDialog.svelte:33-41`, `src/routes/api/admin/images/+server.ts:160-164`, `src/lib/components/admin/sections/DataManagementTabs.svelte:44-45,394-395`

**À faire**

- Accepter un tableau côté API, ou boucler côté client, et réintégrer le flux `force`.
- Flux de suppression décidé (2026-10-08) : l’API répond 409 avec la liste des vins concernés, l’UI l’affiche, puis « Supprimer quand même » retire l’image de ces vins et la supprime.
- Propager recherche et sélection via `uiActions.setImageSearchQuery` et `setSelectedImages`, ou des props `$bindable`.
- Corriger les deux dans la même PR.
- Trouvé pendant QA-03 : `ImageDeleteDialog.svelte` envoie `imageIds` alors que l’API lit `imageId`, donc ses toasts de succès ne s’affichent jamais, dont `toast.images_deleted_with_updates` et `toast.images_deleted_no_updates` ajoutées par QA-03 : revoir ces messages avec la correction.

**Critère d’acceptation** : Supprimer deux images filtrées fonctionne. « Tout sélectionner » ne prend que les images visibles.

**Sources** : review-4-admin-frontend.md#M1, review-4-admin-frontend.md#M2

### BUG-03 · Édition d’un format : champ vide

Sévérité **majeur** · effort **XS** · statut **Fait**

**Suivi** (2026-10-11) : 56ac19a..85704fb sur develop, CI verte (run 38129472144) : WineFormatDialog lit .name (prop typée WineFormat). Vérifié en navigateur headless : champ prérempli en édition, modification enregistrée ; champ vide avec l’ancien code.

**Problème** : `WineFormatDialog` lit `editingFormat.format` alors que l’entité expose `name`.

**Fichiers** : `src/lib/components/admin/dialogs/WineFormatDialog.svelte:26`

**À faire**

- Lire `.name`.

**Critère d’acceptation** : Le champ est prérempli à l’ouverture en édition.

**Sources** : review-4-admin-frontend.md#M3

### BUG-04 · Formulaire de vin qui se réinitialise

Sévérité **majeur** · effort **S** · statut **Fait**

**Suivi** (2026-10-11) : e62923a..1daeae1 sur develop (code b647867..8a7e52e), CI verte (run 38139762711). Reproduit d’abord sur develop (Chromium headless, 5 variantes de timing) : choisir une région vidait tout le formulaire en création et le remettait aux valeurs serveur en édition (le bloc $: suivait aussi appellations). Correctif : $: initForm(open, editDefinition), un seul chargement, 6 setTimeout et le drapeau isPopulatingForm supprimés ; compteur de génération pour ignorer une définition qui arrive après fermeture ou changement de vin (avant : PUT vers B avec les données de A). Pas de test Vitest (pas d’outillage de test de composants) : preuves navigateur avant/après.

**Problème** : Le bloc `$: if (open)` dépend de `appellations`, réassignée quand on choisit une région, ce qui relance `resetForm()` ou `populateFormData()` pendant la saisie. Déduit de la lecture du code : à reproduire d’abord.

**Fichiers** : `src/lib/components/WineDefinitionDialog.svelte:256,442-468,569-624`

**À faire**

- Reproduire : création, choix du pays, de la région, puis création d’une appellation.
- Initialiser le formulaire uniquement quand `open` ou `editDefinition` change.
- Supprimer le double `loadFullDefinition()` et les `setTimeout` qui masquaient la course.

**Critère d’acceptation** : Choisir une région ne vide plus les champs déjà remplis.

**Sources** : review-5-core-ui.md#M1

### BUG-05 · Tri de la liste des vins

Sévérité **mineur** · effort **S** · statut **Fait**

**Suivi** (2026-10-11) : b290ea3..4229fcb sur develop (code 6e2d49d..13197ad), CI verte (run 38143920845) : sélecteur « Trier par » + sens (nom, producteur, millésime le plus ancien, prix moyen, note, nombre de bouteilles), calculé sur les bouteilles possédées (wine-group-sort.ts, valeurs absentes en dernier), ancien tri mort supprimé, ownedBottles partagé (3 copies supprimées) ; ajout non demandé gardé : ligne « Millésime : 2010-2020 » sur chaque carte. Preuve : 12 ordres vérifiés en Chromium headless (avant : aucun contrôle, ordre fixe), 10 tests qui échouaient sur l’ancien comparateur.

**Problème** : `toggleSort` n’est appelé nulle part : la liste est toujours triée par nom. Les éléments sont des groupes par définition, donc trier par millésime ou par prix ne regarde que la première bouteille.

**Fichiers** : `src/lib/components/WineListView.svelte:314,322,504`

**À faire**

- Exposer un tri sur des valeurs agrégées (plage de millésimes, prix moyen), ou supprimer le code mort.

**Critère d’acceptation** : Le tri choisi dans l’UI change l’ordre de façon cohérente.

**Sources** : review-5-core-ui.md#M2

### BUG-06 · Historique, hors cave et statistiques

Sévérité **majeur** · effort **S** · statut **Fait**

**Suivi** (2026-10-11) : 783f214..e62923a sur develop (code dd4396a..8f28d39), CI verte (run 38139020152) : historique : onValueChange remet la page à 1 (et réinitialise le tri) ; tri par accesseurs partagé (bottle-sort.ts) pour l’historique et hors cave ; colonne emplacement = storageCase?.name ; settleEach (Promise.allSettled) avec toast des échecs partiels, seules les bouteilles en échec restent sélectionnées, page bornée après rechargement ; camemberts : composant PieChart (Svelte 5), cercle à 100 %. Preuve : Chromium headless avant/après sur node build (0 ligne → lignes, N/A → cases, 200/200/404 → « 2 mises à jour, 1 échec », camembert vide → disque) + tests qui échouaient avant (6/7).

**Problème** : Historique : changer de filtre ne revient pas en page 1, la liste paraît vide. Hors cave : la colonne emplacement vaut toujours N/A, le tri `definition` compare des objets, et `Promise.all` annonce un échec alors qu’une partie des bouteilles a été modifiée. Statistiques : camembert vide s’il n’y a qu’une catégorie.

**Fichiers** : `src/routes/cellar-history/+page.svelte:161-178,231,252`, `src/routes/out-of-cellar/+page.svelte:55,230,446`, `src/routes/statistics/+page.svelte:259-276`

**À faire**

- `onValueChange` remet la page à 1.
- Utiliser `bottle.storageCase?.name` et une table d’accesseurs pour le tri.
- `Promise.allSettled` avec rapport des échecs partiels.
- Dessiner un `<circle>` quand une part vaut 100 %.

**Critère d’acceptation** : Les trois scénarios décrits sont corrigés et vérifiés à la main.

**Sources** : review-6-feature-pages.md#M8, review-6-feature-pages.md#M9, review-6-feature-pages.md#M10

### BUG-07 · Scanner : caméra qui reste allumée

Sévérité **majeur** · effort **S** · statut **Fait**

**Suivi** (2026-10-11) : f53220a..38d7f26 sur develop, CI verte (run 38131350059) : QrScannerDialog réécrit en Svelte 5 ($effect + cleanup, compteur de génération, timer annulé), html5-qrcode importé seulement dans le navigateur et passé en devDependencies (absent de build/server), exception retirée d’AGENTS.md. Preuve : Chromium headless avec caméra factice, 14 scénarios × 3 : develop laisse une piste vidéo active (18 échecs), la branche les arrête toutes.

**Problème** : Le `setTimeout(startScanner, 500)` n’est jamais annulé, et `startScanner` ne revérifie pas `open` après ses `await`. Si on ferme le dialogue pendant le démarrage, le flux vidéo n’est jamais arrêté.

**Fichiers** : `src/lib/components/QrScannerDialog.svelte:47-78,193-197`

**À faire**

- Jeton de génération ou `AbortController`, timer annulé dans le cleanup.
- Migrer vers `$effect` avec une fonction de cleanup.
- Trouvé pendant DEP-01 : `QrScannerDialog.svelte` importe html5-qrcode en tête de fichier, donc le paquet entre dans le bundle serveur et reste dans `dependencies` (exception nommée dans AGENTS.md). Avec la réécriture, l’importer seulement dans le navigateur (`await import()` dans l’effet), le passer en devDependencies et retirer l’exception d’AGENTS.md.

**Critère d’acceptation** : Ouvrir puis fermer immédiatement le scanner éteint le voyant de la caméra.

**Sources** : review-6-feature-pages.md#M5

### BUG-08 · PDF d’étiquettes : rendu vectoriel

Sévérité **majeur** · effort **M** · dépend de BUG-01, SEC-08 · statut **Fait**

**Suivi** (2026-10-11) : 1daeae1..2a609a5 sur develop (code 9589998..0d93ed7), CI verte (run 38141600101) : encodeur Code 128 corrigé (stop, valeurs 15–17, caractères hors jeu B → erreur) et vérifié contre les largeurs de la norme ; barres en pdf.rect(), faux DOM, pngjs, motifs de secours et console.log supprimés ; zones blanches de 10 modules ; schéma zod → 400. Preuve : 81 PDF (tous les modèles), décodage réel html5-qrcode 432/432 et zxing-wasm 648/648 (aussi sur fond sombre) ; ancien PDF : 22 combinaisons modèle × code sur 56 illisibles (code coupé à droite). PDF 30 étiquettes : 11,8 Mo → 113 Ko. Suite : scanner html5-qrcode aveugle sur fond sombre (UI-08).

**Problème** : JsBarcode tourne sur un faux DOM (`global.document` remplacé). En cas d’échec, le code dessine un faux motif ou un « motif de test » sans signaler d’erreur : on imprime des étiquettes illisibles. `addImage(..., "JPEG")` reçoit en plus un PNG.

**Fichiers** : `src/routes/api/barcode/pdf-labels/+server.ts:82-128,192-414,482`

**À faire**

- Dessiner les barres avec `pdf.rect()` à partir de `generateCODE128Pattern()` (déjà dans utils/barcode.ts).
- Supprimer le faux DOM, pngjs, les solutions de secours et les `console.log`.
- Renvoyer une erreur explicite si l’encodage échoue.
- Valider `pageFormat` et des marges positives (400 au lieu de 500).
- Trouvé pendant DEP-02 : `Buffer.slice`, déprécié, dans `pdf-labels/+server.ts` (vers les lignes 449-450) ; un PDF de 4 étiquettes pèse 1,9 Mo.

**Critère d’acceptation** : Un PDF de test se scanne à 100 % avec le scanner de l’application, et une entrée invalide renvoie 400.

**Sources** : review-6-feature-pages.md#M1, review-6-feature-pages.md#M3

### BUG-09 · Import/export CSV : doublons de vins

Sévérité **majeur** · effort **S** · dépend de QA-01 · statut **Fait**

**Suivi** (2026-10-11) : 38d7f26..b5499fc sur develop, CI verte (run 38131425405) : une seule clé wineDefinitionKey (nom, producteur, appellation, classification, couleur ; la région découle de l’appellation et manque aux anciens exports), regionName ajouté à l’export, fichiers toujours préfixés cellar-export- avec nom personnalisé validé (400). Preuve : test aller-retour (échoue sur l’ancien code) et serveur réel : réimport de 13 tables = 0 importé, 529 doublons ignorés, comptes identiques. Point ouvert : un nom avec € ou œ donne 500 au téléchargement (API-06).

**Problème** : La clé de dédoublonnage n’est pas la même à la lecture (`name|region|appellation|classification|color`) et après insertion (`name|producer|appellation|color`). L’export n’inclut pas `regionName`, donc réimporter son propre export duplique tous les vins.

**Fichiers** : `src/routes/api/admin/import-csv/+server.ts:154-184,1331-1336`, `src/routes/api/admin/export-csv/+server.ts:178-207`

**À faire**

- Une seule fonction de clé utilisée partout.
- Ajouter `regionName` à l’export.
- Un export CSV avec nom personnalisé ne se télécharge pas : download-backup exige le préfixe `cellar-export-`. Toujours préfixer le nom du fichier par `cellar-export-` (décision du 2026-10-09).
- Test aller-retour export puis import.

**Critère d’acceptation** : Exporter puis réimporter ne crée aucun doublon.

**Sources** : review-3-admin-api.md#M6

### DOC-01 · README du projet

Sévérité **mineur** · effort **S** · statut **Fait**

**Suivi** (2026-10-11) : b5f8b4b..b290ea3 sur develop (code 9b1a3c5..b7b32b7), CI verte (run 38142810975) : README.md réécrit (plus rien du modèle sv) : présentation (réseau local ou VPN), lien « Docker installation » vers README-Docker.md#quick-start, UPGRADING/CHANGELOG, fonctionnalités vérifiées dans le code (caméra : HTTPS ou localhost), section développement (Node 24, pnpm 10, cinq contrôles, jeton d’installation), renvois vers AGENTS.md et RELEASING.md. Liens et ancres vérifiés. Incohérences de README-Docker.md notées comme constats.

**Problème** : README.md est encore le texte généré par `npx sv create` (« # sv », « Creating a project »). Il ne présente pas Cellar ; seul README-Docker.md documente l’installation.

**Fichiers** : `README.md`, `README-Docker.md`

**À faire**

- Décision du 2026-10-10.
- Présenter Cellar en quelques lignes : gestionnaire de cave auto-hébergé, prévu pour un réseau local ou un VPN.
- Renvoyer vers README-Docker.md pour l’installation et vers UPGRADING.md pour les mises à jour.
- Garder la section développement (Node 24, pnpm 10, `pnpm dev`) et retirer le reste du modèle.
- Trouvé pendant DOC-01, à corriger par DOC-02 dans README-Docker.md : la section CSV dit de déposer les fichiers dans `docker-data/csv-imports/`, alors que l’import prend un fichier envoyé depuis le navigateur (ce dossier ne contient que les CSV de référence) ; `git clone <repository-url>` alors que le dépôt reste privé ; `docker-compose` et `docker compose` mélangés ; titre « Wine Cellar » et « 1GB » d’espace disque sans fondement ; rien sur la caméra du scanner, qui exige HTTPS ou `localhost`.

**Critère d’acceptation** : README.md ne contient plus rien du modèle `sv` et mène à l’installation Docker en un clic.

**Sources** : Décision du 2026-10-10

### BUG-10 · Sauvegardes et exports nommés avec œ, € ou un emoji

Sévérité **majeur** · effort **XS** · statut **Fait**

**Suivi** (2026-10-11) : 43244d6..783f214 sur develop (code 7435821..c74c831), CI verte (run 38138708790) : helper serveur attachmentDisposition (repli ASCII sans " \ % ni caractères de contrôle + filename*=UTF-8'' RFC 8187) dans les 6 routes ; helper client filenameFromContentDisposition (filename* d’abord, paramètres lus hors guillemets) à la place des 6 split('filename='). Preuve : Chromium headless contre node build : develop répond 500 ; la branche télécharge « cellar-backup-Cœur de cave € 🍷-….zip », le restaure depuis la liste (donnée revenue) et télécharge l’export CSV du même nom. Tests de route qui échouaient avant (500).

**Problème** : `download-backup` met le nom brut dans `Content-Disposition` ; Node refuse tout caractère hors Latin-1 (`œ`, `€`, emoji) et la route répond 500 (é, è, à, ç passent). Une sauvegarde nommée « Cœur de cave » est créée et listée, mais ne peut être ni téléchargée ni restaurée depuis la liste, car la restauration passe par ce téléchargement. Un export CSV avec un tel nom ne se télécharge pas, puis ses fichiers sont effacés du serveur.

**Fichiers** : `src/routes/api/admin/download-backup/+server.ts:39`, `src/routes/api/admin/download-images/+server.ts:46`, `src/routes/api/barcode/{csv,pdf-labels,export-all,export-manual}/+server.ts`, `src/lib/components/admin/dialogs/RestoreFromListingConfirmDialog.svelte:48,98`, `src/routes/admin/+page.svelte:218,291`

**À faire**

- Décision du 2026-10-11 : les noms restent libres ; un helper serveur unique produit `attachment; filename="<repli ASCII>"; filename*=UTF-8''<nom encodé>` (RFC 6266), utilisé par les 6 routes qui envoient un fichier. Il couvre aussi le guillemet dans un nom (trouvé pendant SEC-05/06, voir API-06).
- Les clients qui lisent le nom avec `split('filename=')` (`admin/+page.svelte`, vers les lignes 218 et 291) cassent avec `filename*` : lire `filename*` en priorité, avec un seul helper côté client.
- Tests : « Cœur de cave € 🍷 » pour une sauvegarde (téléchargement puis restauration depuis la liste) et pour un export CSV.

**Critère d’acceptation** : Une sauvegarde nommée « Cœur de cave € 🍷 » se télécharge et se restaure depuis la liste, avec son vrai nom dans le navigateur ; un export CSV portant ce nom se télécharge.

**Sources** : Trouvé pendant BUG-09 (2026-10-11)

### BUG-11 · Seeding : ligne d’en-tête importée comme appellation

Sévérité **mineur** · effort **XS** · dépend de QA-01 · statut **Fait**

**Suivi** (2026-10-11) : 64af59a..43244d6 sur develop (code a19f688..846d152), CI verte (run 38138025171) : le seeding saute l’en-tête (from_line: 2, migrations.ts et scripts/import-appellations.ts) ; migration SQL 0004 qui supprime Appellation → Région → Pays seulement s’ils sont enchaînés et inutilisés (tout ou rien, idempotente, s’applique aussi à une sauvegarde restaurée). 9 tests (dont la chaîne et les cas gardés). Preuve : node build sur une base créée par develop : 7/31/450 → 6/30/449 ; base avec un vin sur « Appellation » inchangée ; base neuve sans les entrées. Aucune action utilisateur.

**Problème** : Le seeding nomme lui-même les colonnes de `appellations.csv` sans sauter la première ligne : toutes les installations, depuis la première version, ont un pays « Pays », une région « Région » et une appellation « Appellation » dans les listes.

**Fichiers** : `src/lib/db/migrations.ts:404-420`, `scripts/import-appellations.ts`, `src/lib/db/migrations.test.ts`, `drizzle/`

**À faire**

- Sauter la ligne d’en-tête dans `migrations.ts` et `scripts/import-appellations.ts`.
- Décision du 2026-10-11 : nettoyer les bases existantes au démarrage, sans action de l’utilisateur. Supprimer l’appellation « Appellation » de la région « Région » du pays « Pays », puis cette région, puis ce pays, seulement s’ils sont enchaînés ainsi et qu’aucune donnée ne les référence (vins, autres appellations ou régions) ; sinon ne rien toucher. Idempotent.
- Passer le test `it.fails` de `src/lib/db/migrations.test.ts` en `it`, et tester le nettoyage : entrées inutilisées supprimées, entrées utilisées gardées.

**Critère d’acceptation** : Une base neuve n’a plus ces trois entrées ; une base existante les perd au démarrage si rien ne les utilise.

**Sources** : Trouvé pendant SEC-09 (2026-10-11)

### BUG-12 · Admin images : sélection masquée par la recherche

Sévérité **mineur** · effort **XS** · dépend de BUG-02 · statut **Fait**

**Suivi** (2026-10-11) : 4229fcb..6a2c213 sur develop (code d1ad92d..f7c5451), CI verte (run 38144041646) : visibleSelection (réutilise filterImagesByName) appliqué par AdminService quand la recherche change et après chaque rechargement de la liste (renommage, envoi, import, suppression, échec → sélection vide) ; un seul reloadImages() au lieu de 6 appels. Preuve : Chromium headless contre node build : develop supprime l’image masquée (recherche et renommage), la branche la garde ; 4 tests qui échouaient avant.

**Problème** : Depuis BUG-02, « Tout sélectionner » et « Exporter » suivent la recherche, mais une image cochée à la main puis masquée par la recherche reste sélectionnée et part avec « Supprimer la sélection ».

**Fichiers** : `src/lib/stores/admin/`, `src/lib/services/admin/adminService.ts`, `src/lib/utils/admin/imageHelpers.ts`, `src/lib/components/admin/tabs/ImagesTab.svelte`

**À faire**

- Décision du 2026-10-11 : changer la recherche retire de la sélection les images qu’elle masque.
- Réutiliser `filterImagesByName` (BUG-02) ; test unitaire.

**Critère d’acceptation** : Cocher une image puis la masquer par la recherche : la sélection ne la contient plus, et « Supprimer la sélection » ne la supprime pas.

**Sources** : Trouvé pendant BUG-02 (2026-10-11)

## P3 · Mise à niveau du socle (1.0.0)

Passer à SvelteKit 3, Vite 8 et TypeScript 6, et aux versions majeures des bibliothèques serveur, avant les gros refactorings pour ne pas réécrire deux fois.

### DEP-03 · Migrer vers SvelteKit 3, Vite 8 et TypeScript 6

Sévérité **évolution** · effort **L** · dépend de DEP-02, QA-04 · statut **Fait**

**Suivi** (2026-10-12) : b1205ce..e90ded8 : SvelteKit 3.0.1, Vite 8.3.2, TypeScript 6.0.3, adapter-node 6 ; server.js lit ORIGIN (action 0.5.0 seulement depuis les sources). Reste : retirer l'exception @sveltejs/kit@3.0.1 dès le 2026-10-13.

**Problème** : SvelteKit 3.0 est sorti le 1er octobre 2026. Il faut le faire avant les gros refactorings, sinon on réécrit deux fois : `$lib` devient `#lib` (190 fichiers), svelte.config.js disparaît, `$app/stores` est supprimé, CSRF est toujours actif, `ORIGIN` devient `paths.origin`. Minimums requis : Node 22.17, TS 6, Svelte 5.57.1, Vite 8.0.12, vite-plugin-svelte 7, adapter-node 6.

**Fichiers** : `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `package.json`, `src/**`

**À faire**

- Prérequis : DEP-02 fait (SvelteKit 2.70, sans avertissement de dépréciation) et CI verte.
- Attendre un 3.0.x correctif et vérifier la compatibilité de bits-ui et svelte-check.
- `npx sv migrate sveltekit-3` sur une branche dédiée, puis relire le diff.
- Configuration dans le plugin `sveltekit()` de vite.config.ts ; `csrf.trustedOrigins` ; `paths.origin` remplace `ORIGIN` (mettre à jour le compose). Fait autrement : `paths.origin` est figé au build, alors qu’une même image sert toutes les installations ; `server.js`, nouvelle commande de démarrage de l’image, lit `ORIGIN` et le passe à adapter-node par deux en-têtes internes réécrits à chaque requête. Le compose ne change pas ; seuls ceux qui lancent l’application depuis les sources, ou qui remplacent la commande du conteneur, passent de `node build` à `node server.js` (action de la 0.5.0).
- `json()` devient `Response.json()` (84 routes).
- `handleError` reçoit maintenant aussi les `error()` volontaires.
- adapter-node 6 : les assets statiques viennent d’une liste figée au build. Les images envoyées dans `static/uploads` ne seront plus servies : vérifier que la route `uploads/[...path]` couvre tout.
- Rester sur TypeScript 6 : svelte-check ne supporte TS 7 qu’en mode expérimental.
- Trouvé pendant DEP-02 : `cookie` 0.6.0 (alerte faible de `pnpm audit`) est figé par SvelteKit 2 et part avec SvelteKit 3. tailwind-variants 1.0.0 embarque sa propre copie de tailwind-merge 3.0.2 : passer à tailwind-variants 3 dans la foulée. Restent hors DEP-02 des mises à jour correctives de `@types/qrcode`, `@internationalized/date` et typescript (5.9.3).
- Fait le 2026-10-12 : sv 1.0.1 `migrate sveltekit-3`, `#lib`, `Response.json()`, tailwind-variants 3, TypeScript 6.0.3, vite 8.3.2, adapter-node 6.0.0 ; `scripts/check-origin.mjs` vérifie en CI que l’application construite applique `ORIGIN` et refuse les écritures inter-sites. Reste : retirer `@sveltejs/kit@3.0.1` de `minimumReleaseAgeExclude` dans un commit dédié sur develop dès le 2026-10-13 à 01:34 UTC (publié le 2026-10-06 à 01:34 UTC), puis vérifier `pnpm install --frozen-lockfile` ; la 0.5.0 est sortie avec l’exception, le retrait part dans la 0.6.0 (décision du 2026-10-12). Trouvé pendant DEP-03 : `server.js` dépend de `envPrefix: ""` et de l’export `server` de `build/index.js`, que la documentation d’adapter-node ne décrit pas (la CI le surveille) ; vérifier que la CLI shadcn-svelte accepte les alias `#lib` de `components.json` avant le prochain `add`.
- Fait le 2026-10-13 : `@sveltejs/kit@3.0.1` est retiré de `minimumReleaseAgeExclude` (203abf2) ; `pnpm install --frozen-lockfile` passe encore, et la 0.6.0 est sortie avec ce retrait. Trouvé pendant API-04, documenté par DOC-03 en P10, sans nouveau défaut : `node server.js` lancé sans `BODY_SIZE_LIMIT` garde la limite de 512 Ko d’adapter-node (l’image met 512M) : hors de Docker, un import CSV de 612 Ko répond 413.

**Critère d’acceptation** : check, test et build passent sur SvelteKit 3. Image Docker testée : uploads d’images visibles, CSRF actif.

**Sources** : svelte.dev/docs/kit/migrating-to-sveltekit-3

### DEP-04 · Versions majeures des bibliothèques serveur

Sévérité **évolution** · effort **M** · dépend de QA-01 · statut **Fait**

**Suivi** (2026-10-11) : @types/yauzl eef8ac3 ; nanoid → crypto.randomUUID fe42462..36f0e56 ; better-sqlite3 13.0.3 0f67436..04aa0ff. archiver 8 et yauzl reportés à DATA-05 ; esbuild 0.18/0.19 et @types/better-sqlite3 en prod restent (voir la tâche).

**Problème** : Plusieurs dépendances serveur ont une version majeure de retard : better-sqlite3 12 → 13, archiver 7 → 8, nanoid 5 → 6 (csv-parse 6 → 7 est passé dans SEC-09). Elles touchent directement les sauvegardes, les imports et l’accès aux données.

**Fichiers** : `package.json`, `src/routes/api/admin/**`, `src/lib/db/**`

**À faire**

- Une bibliothèque par PR, en lisant son changelog.
- nanoid : envisager de le remplacer par `crypto.randomUUID()`, ce qui unifie aussi les deux générateurs d’ID.
- archiver et yauzl : à faire avec ou après DATA-05, qui réécrit les sauvegardes.
- Trouvé pendant DEP-02 : esbuild 0.18/0.19 (alerte modérée, outils de dev seulement) vient de drizzle-kit et svelte-i18n : les mettre à jour plutôt qu’ajouter un override. `@types/yauzl` est encore en 2.x alors que yauzl est en 3.x.
- Trouvé pendant DEP-01 : `@types/better-sqlite3` arrive dans les node_modules de production comme pair optionnel de drizzle-orm.
- Fait en P3 (2026-10-11) : better-sqlite3 13.0.3 (binaires précompilés : plus de python3, make ni g++ dans l’image, seuls amd64 et arm64 se construisent), nanoid remplacé par `crypto.randomUUID()` et retiré (un seul générateur d’ID côté serveur, un compteur pour les toasts, car le navigateur n’a pas `crypto.randomUUID` en HTTP sur le réseau local), `@types/yauzl` 3.4.0 ; tests de sauvegarde et de restauration sur un vrai fichier. archiver 8 et yauzl passent dans DATA-05.
- Restent ouverts après DEP-04 : esbuild 0.18 vient de drizzle-kit 0.31.11 (dernière stable ; seules les 1.0 bêta et rc l’abandonnent) et esbuild 0.19 de svelte-i18n 4.0.1, plus publié depuis 2024 : accepté le 2026-10-12, svelte-i18n sera remplacé en P6 (voir les décisions). `@types/better-sqlite3` reste dans l’image (2,6 Mo, pair optionnel de drizzle-orm) : accepté le 2026-10-12 (voir les décisions). Les binaires better-sqlite3 des 8 plateformes ajoutent environ 13 Mo à `node_modules` dans l’image.

**Critère d’acceptation** : Tests de sauvegarde, restauration et import passants.

**Sources** : pnpm outdated (2026-10-08)

### DEP-05 · Scanner : remplacer html5-qrcode

Sévérité **majeur** · effort **M** · dépend de BUG-07, BUG-08 · statut **Fait**

**Suivi** (2026-10-11) : 33eca12..1b22a99 : barcode-detector 3.2.2 (zxing-wasm 3.1.3 servi par l'app), 534/534 étiquettes du banc BUG-08 (fond noir + bordure) en natif, sans natif et WebKit ; EAN/UPC/Code 39/Data Matrix lus. iPhone réel non testé.

**Problème** : html5-qrcode 2.3.8 n’est plus maintenu (dernière version en avril 2023). Son ZXing-js embarqué ne trouve aucun Code 128 dès qu’un élément sombre précède les barres sur la ligne lue (bouteille autour de l’étiquette, bordure d’aperçu) : 0/432 sur fond sombre pendant BUG-08, alors que zxing-wasm lit tout. L’application n’active pas la détection native du navigateur, donc tous les navigateurs passent par ZXing-js.

**Fichiers** : `src/lib/components/QrScannerDialog.svelte`, `src/lib/components/BulkBarcodeDialog.svelte`, `src/routes/api/barcode/pdf-labels/+server.ts`, `package.json`

**À faire**

- Décision du 2026-10-11 (option B) : décoder avec `barcode-detector` (API standard `BarcodeDetector`, zxing-wasm en repli), y compris sur iPhone, et retirer html5-qrcode.
- Garder la gestion caméra de BUG-07 (`$effect`, arrêt des pistes, compteur de génération) ; zone de lecture rectangulaire, adaptée à un code 1D.
- Dessiner la bordure d’aperçu des étiquettes PDF sans croiser les lignes du code-barres.
- Réutiliser le banc de décodage de BUG-08 (PDF rendus, fond sombre, bordure) et la caméra factice de BUG-07 pour la preuve.

**Critère d’acceptation** : Les étiquettes du banc de BUG-08, sur fond sombre et avec bordure, se lisent à 100 % avec le scanner de l’application, y compris dans un navigateur sans BarcodeDetector natif ; html5-qrcode n’est plus dans package.json.

**Sources** : Trouvé pendant BUG-08 (2026-10-11)

### DOC-02 · Corriger README-Docker.md

Sévérité **mineur** · effort **XS** · dépend de DOC-01 · statut **Fait**

**Suivi** (2026-10-11) : 79b8cd0..1506ad1 (README-Docker.md vérifié contre le code, procédure archive de release testée)

**Problème** : README-Docker.md contient des erreurs relevées pendant DOC-01 : c’est la première page qu’un nouvel utilisateur lit.

**Fichiers** : `README-Docker.md`, `README.md`

**À faire**

- Décision du 2026-10-11.
- Section CSV : l’import prend un fichier envoyé depuis le navigateur ; `docker-data/csv-imports/` ne contient que les CSV de référence.
- Remplacer `git clone <repository-url>` (dépôt privé jusqu’à la 1.0.0, décision Visibilité) par une procédure qui fonctionne.
- Une seule forme `docker compose` ; titre « Cellar » ; retirer ou justifier « 1GB ».
- Dire que la caméra du scanner exige HTTPS ou `localhost`, avec un renvoi vers la section reverse proxy.

**Critère d’acceptation** : Chaque commande et chaque affirmation de README-Docker.md est vérifiée contre le code et docker-compose.yml.

**Sources** : Trouvé pendant DOC-01 (2026-10-11)

## P4 · Fondations données (1.0.0)

Une seule connexion SQLite, des transactions, des contraintes en base, des sauvegardes et restaurations fiables.

### DATA-01 · Une seule connexion SQLite

Sévérité **critique** · effort **M** · dépend de DEP-03 · statut **Fait**

**Suivi** (2026-10-12) : 85ac57e..495703e sur develop (code ..9a591e7), CI verte (run 38291348233) : une seule connexion (openDatabase, seul new Database de src), ouverte à la première utilisation, en WAL ; DATA_DIR, DATABASE_PATH, UPLOADS_DIR, CSV_IMPORTS_DIR depuis l’environnement (défauts inchangés) ; sauvegardes après checkpoint ; restauration par copie à côté puis rename atomique, sauvegarde préalable bloquante ; vite build ne crée plus data/. Preuve : base créée par l’image 0.5.0-rc.1 mise à jour sur place (données intactes, WAL, sauvegarde après écriture complète, restauration sans redémarrage). 4 tours de revue.

**Problème** : 22 fichiers ouvrent leur propre `new Database("data/cellar.db")`. Le chemin est écrit en dur environ 30 fois. Pas de WAL ni de `busy_timeout`. Cela rend une restauration propre impossible et expose à des `SQLITE_BUSY`.

**Fichiers** : `src/lib/db/index.ts`, `src/hooks.server.ts:156,230,322,347`, `src/routes/api/admin/**/+server.ts (20 routes CRUD)`

**À faire**

- Module `src/lib/server/db/client.ts` : `getDb`, `closeDb`, `reopenDb`, chemin lu depuis `DATABASE_PATH`, PRAGMA WAL, `busy_timeout` et `foreign_keys`.
- `src/lib/server/config.ts` pour `DATABASE_PATH`, `UPLOADS_DIR`, `CSV_IMPORT_DIR` (`CSV_IMPORTS_DIR` existe déjà dans `src/lib/server/paths.ts`).
- Remplacer tous les `new Database`.
- Partir de `src/lib/server/paths.ts` (SEC-05 : `DATA_DIR`, `IMAGES_DIR`) ; `./static/uploads/wines` reste écrit en dur dans `hooks.server.ts`, `api/admin/auto-backup` et `api/admin/wipe-database`.
- Ouvrir la base à la première utilisation, pas à l’import du module : aujourd’hui `vite build` crée un `data/cellar.db` vide.
- Règle ESLint `no-restricted-imports` : aucune route n’importe le client DB directement (après API-02).
- Trouvé pendant QA-01/QA-02 : 21 modules (routes CRUD de l’admin, migrations et planification des sauvegardes dans `hooks.server.ts`, route restore) ouvrent leur propre connexion sur `./data/cellar.db`. Les tests refusent tout fichier autre que `:memory:` (garde dans `src/test/setup.ts`), donc `handle` et ces routes ne sont pas testables avant cette tâche. `src/test/memory-db.ts` recopie `migrateSchema` : une fabrique de connexion sans effet de bord dans `$lib/db`, réutilisée par les tests, supprimerait cette copie.
- Trouvé pendant SEC-09/BUG-09 : l’import et l’export CSV écrivent leurs fichiers temporaires dans `./data` (chemin relatif) ; leurs tests passent donc par `useScratchWorkDir()` (`src/test/work-dir.ts`), à retirer quand le chemin viendra de la configuration.
- Fait en P4 (2026-10-12) : `DATA_DIR`, `DATABASE_PATH`, `UPLOADS_DIR` et `CSV_IMPORTS_DIR` viennent de l’environnement (`src/lib/server/paths.ts`) ; une seule connexion (`src/lib/db/connection.ts`), ouverte à la première utilisation en WAL, jamais pendant le build ; le dossier de la base est vérifié, et créé s’il manque, au démarrage. La restauration remplace la base par `rename` d’une copie faite à côté puis rouvre la connexion ; elle garde la base en place si celle de la sauvegarde est abîmée, et s’arrête si la sauvegarde préalable échoue. Un zip qui ne peut pas être écrit est refusé au lieu de tuer le processus.
- Trouvé pendant DATA-01, réglé par DOC-03 en P10 : dans README-Docker.md, les commandes qui remettent à zéro le code d’accès (vers les lignes 236 et 248) écrivent `data/cellar.db` en dur au lieu de suivre `DATABASE_PATH` ; rien ne dit qu’un `DATABASE_PATH` en lien symbolique, ou un fichier de base monté seul, casse la restauration (le lien est remplacé, ou `rename` échoue en EBUSY), ni que le WAL est déconseillé sur un partage réseau (NFS, SMB).

**Critère d’acceptation** : `grep "new Database" src` ne renvoie qu’un seul résultat. Les chemins viennent de l’environnement.

**Sources** : review-1-data.md#C1, review-3-admin-api.md#M9, review-7-infra-architecture.md#C2

### DATA-02 · Migrations au démarrage

Sévérité **majeur** · effort **S** · dépend de DATA-01 · statut **Fait**

**Suivi** (2026-10-12) : 495703e..7c44884 sur develop (code ..900368d), CI verte (run 38291672696) : migrations dans le hook init avant toute requête, arrêt (exit 1) et message clair si elles échouent ; ensureMigrated supprimé ; backfill des espacements en migration SQL 0005 ; un CSV de seeding cassé est nommé dans les logs sans bloquer le démarrage (les autres fichiers et réglages sont importés, nouvel essai au démarrage suivant) ; la restauration migre la sauvegarde avant la bascule. Preuve : migration cassée → exit 1 sans HTTP (node et Docker) ; base 0.5.0 mise à jour sur place intacte ; premier healthcheck en 74 ms.

**Problème** : Les migrations tournent à la première requête HTTP. En cas d’échec, l’erreur est avalée et l’application sert des requêtes sur un schéma incohérent. Une promesse rejetée reste en cache.

**Fichiers** : `src/hooks.server.ts:335-356`, `src/lib/db/index.ts:22-27`, `src/lib/db/migrations.ts`

**À faire**

- Lancer les migrations dans le hook `init` (ou dans un script d’entrée Docker) et arrêter le processus si elles échouent.
- Renommer `runSchemaMigrations`.
- Convertir le backfill `migrateLabelPresetSpacing` en migration SQL.
- Trouvé pendant SEC-07 : sur une base neuve, migrations et seeding de la première requête prennent 1,5 à 4 s, plus que le timeout de 3 s du healthcheck, qui ne passe qu’au contrôle suivant. Depuis 0.2.0-rc.3, `exitUnlessDirsWritable()` (`src/lib/server/writable-dirs.ts`) arrête le processus quand un dossier de données n’est pas inscriptible : le garder avant l’ouverture de la base quand les migrations passeront dans `init`. Une migration qui échoue reste seulement journalisée et le conteneur paraît sain : c’est ce que cette tâche doit corriger.
- Fait en P4 (2026-10-12) : les migrations tournent dans le hook `init`, qui arrête le processus en nommant la migration et la raison de SQLite ; le backfill des espacements devient la migration 0005 ; un seeding qui échoue n’empêche plus le démarrage, et chaque fichier CSV est importé malgré un fichier cassé ; la restauration migre la sauvegarde avant qu’elle remplace la base.
- Trouvé pendant DATA-02, reste ouvert : `vite dev` s’arrête au premier appel quand une migration est cassée (`process.exit` dans `init`).

**Critère d’acceptation** : Une migration volontairement cassée empêche le démarrage, avec un message clair.

**Sources** : review-1-data.md#M6, review-7-infra-architecture.md#M1

### DATA-03 · Contraintes et index

Sévérité **majeur** · effort **S** · dépend de DATA-02 · statut **Fait**

**Suivi** (2026-10-12) : 627ad94..0a497c2 sur develop (code ..051ff16), CI verte (run 38292321687) : migration 0006 (code-barres unique partiel, unicité région/appellation, index sur les clés étrangères, CHECK statut et note 1–5, FK parent, SET NULL case et image) avec réparations décidées (fusion des doublons, code gardé sur une bouteille avec note, statuts et notes remplacés avec note) ; migrations avec foreign_keys coupées et garde qui refuse un lien cassé nouveau ; 409 case seulement pour des bouteilles disponibles ; refus clairs 400/409 et import JSON d’un ancien export expliqué. Preuve : base 0.5.0 (et 0.1.0) avec données tordues mise à jour sur place, diff du dump limité aux réparations.

**Problème** : Pas d’unicité sur `barcode` (la séquence peut produire des doublons sur un double clic). Pas d’unicité `(country_id, name)` ni `(region_id, name)`. Aucun index sur les clés étrangères. `availability` est un texte libre.

**Fichiers** : `src/lib/db/schema.ts:19-34,54,107,130,137`, `drizzle/`

**À faire**

- Index unique partiel `wine_bottles(barcode) WHERE barcode IS NOT NULL` (aucun doublon en base aujourd’hui).
- Unicité composite pour régions et appellations, après vérification des doublons existants.
- Index sur les clés étrangères, `CHECK` sur `availability` et `rating`, clé étrangère sur `parentContainerId`.
- Décision (2026-10-08) : `storage_case_id` et `image_id` passent en `ON DELETE SET NULL`. Les garde-fous restent dans les services : on refuse (409) de supprimer une case qui contient des bouteilles disponibles (UI-09), et supprimer une image utilisée demande une confirmation (BUG-02).
- La migration Drizzle 0003 a été prise par SEC-02 (table `sessions`) : générer la suivante avec `pnpm db:generate`.
- Fait en P4 (2026-10-12) : la migration 0006 ajoute l’index unique partiel des codes-barres, l’unicité des régions par pays et des appellations par région, les index des clés étrangères, les `CHECK` du statut et de la note, la clé étrangère de `parent_container_id` et `ON DELETE SET NULL` sur la case et l’image, après avoir réparé les données qu’ils refusent (voir les décisions). Les migrations tournent clés étrangères coupées sur la connexion (dans la transaction de Drizzle, le PRAGMA des migrations générées est ignoré, trouvé pendant DATA-02), avec un garde qui les annule toutes si elles cassent un lien. Les routes répondent 400 ou 409 aux écritures refusées ; l’import JSON accepte les valeurs des anciens exports qui en désignent une valide, et nomme la règle qui refuse une ligne. Le 409 « This case still holds bottles » ne vise plus que les bouteilles disponibles (trouvé pendant DATA-04).
- Trouvé pendant DATA-03, réglé par DATA-14 en P10 : le garde des clés étrangères lance un `foreign_key_check` complet à chaque démarrage.

**Critère d’acceptation** : La migration s’applique sur une copie de la base de production sans erreur.

**Sources** : review-1-data.md#M2, review-1-data.md#Mineur

### DATA-04 · Transactions sur les écritures multiples

Sévérité **critique** · effort **M** · dépend de DATA-01, QA-01 · statut **Fait**

**Suivi** (2026-10-12) : 7c44884..627ad94 sur develop (code ..ed12f85), CI verte (run 38291994910) : transactions synchrones (tx optionnel) pour import JSON, import CSV, wipe, création de N bouteilles, conteneurs, suppression de vin, presets ; import JSON : export incomplet refusé (400), images copiées après le commit, sauvegarde préalable bloquante et nommée à la milliseconde ; EXPORT_TABLES partagé (exports automatiques complets) ; erreurs de clé étrangère → 409. Décision : lignes CSV incomplètes sautées et signalées, seule une erreur de base annule tout. Preuve : test d’échec au milieu par opération (base inchangée), base 0.5.0 mise à jour sur place.

**Problème** : Le dépôt ne contient aucune transaction. Import JSON : la base est vidée puis remplie, et l’import d’un export automatique (incomplet) laisse une base vide. Wipe, import CSV, création de N bouteilles, suppression de conteneur, restore-label-presets : tous laissent des états partiels en cas d’échec.

**Fichiers** : `src/routes/api/admin/import-json/+server.ts:398-427`, `src/routes/api/admin/wipe-database/+server.ts:95-141`, `src/lib/db/services.ts:639-663`, `src/routes/api/storage-containers/[id]/+server.ts:33-85`, `src/routes/api/admin/restore-label-presets/+server.ts:14-20`

**À faire**

- `db.transaction(tx => …)` (synchrone avec better-sqlite3) ; les fonctions d’accès acceptent un `tx` optionnel.
- Import JSON : refuser un export incomplet et copier les images seulement après le commit.
- Exports automatiques complets : une seule liste de tables partagée.
- Erreurs de clé étrangère traduites en 409.
- Fait en P4 (2026-10-12) : une transaction pour la création des bouteilles d’une requête, l’écriture d’un conteneur et de ses cases, la suppression d’un vin, l’import JSON, chaque fichier du seeding, le wipe, la restauration des modèles d’étiquettes et l’import CSV ; une seule liste de tables pour tous les exports ; un import ne commence pas si la sauvegarde préalable échoue, et une ligne refusée répond 400 ; supprimer une case ou un vin qui a encore des bouteilles répond 409 ; les sauvegardes sont nommées à la milliseconde par un seul helper. Lignes incomplètes de l’import CSV : voir les décisions.

**Critère d’acceptation** : Un test qui fait échouer l’insertion au milieu laisse la base inchangée, pour chaque opération listée.

**Sources** : review-1-data.md#M1, review-3-admin-api.md#C1, review-3-admin-api.md#M10

### DATA-05 · Sauvegarde et restauration fiables

Sévérité **critique** · effort **L** · dépend de DATA-01, DATA-02 · statut **Fait**

**Suivi** (2026-10-12) : 0df34a2..42f6aef sur develop (code ..a751db8), CI verte (run 38292986819) : archiver 8.0.0 ; module backup/ (instantané VACUUM INTO, zips .partial renommés à la fin, rétention par type, listBackups) ; restauration validée (en-tête, integrity_check, tables), images filtrées, sessions de la sauvegarde terminées avant la bascule, écritures retenues (503) pendant la restauration ; planificateur unique replanifié aux réglages ; mode cron rétabli avec jeton (Bearer, haché, sans action de mise à jour). Preuve : sauvegardes des images 0.1.0 à 0.5.0 restaurées sans redémarrage, 6 sauvegardes pendant 11 593 écritures toutes integrity_check ok, fréquence appliquée en millisecondes, commande cron documentée testée.

**Problème** : La restauration fait un `copyFile` par-dessus la base ouverte (risque de corruption), sans valider le fichier ni relancer les migrations. Les sauvegardes zippent le .db à chaud. La logique est copiée 6 fois. La planification repose sur un `setTimeout` en mémoire qui ne tient pas compte des changements de réglages, et la rétention mélange sauvegardes et exports.

**Fichiers** : `src/routes/api/admin/restore/+server.ts:198-232`, `src/routes/api/admin/create-backup`, `src/routes/api/admin/auto-backup`, `src/hooks.server.ts:58-260`, `src/routes/api/admin/backup-settings`

**À faire**

- `src/lib/server/backup/` : `snapshotDb()` (via `sqlite.backup()` ou `VACUUM INTO`), `buildArchive`, `listBackups`, `resolveBackupFile`, `retention(kind, keep)`.
- Restauration : valider le fichier (en-tête, `integrity_check`, tables attendues) ; la sauvegarde préalable devient bloquante ; fermer, remplacer par `rename` atomique, rouvrir, relancer les migrations.
- Planificateur démarré dans `init` avec une méthode `reschedule()` appelée par backup-settings ; token obligatoire pour POST auto-backup.
- Trouvé pendant SEC-05/06 : la restauration écrit la sauvegarde préalable avant de valider le zip ; un zip sans `cellar.db` donne 500 au lieu de 400 ; les horodatages à la minute font collisionner deux restaurations ; un sous-dossier dans `images/` fait échouer `copyFile` (EISDIR) après le remplacement de la base ; restore et import-json copient tout `images/*` sans vérifier le type ; les sauvegardes incluent les fichiers cachés du dossier d’images. `resolveBackupFile` existe déjà dans `src/lib/server/paths.ts`.
- Trouvé pendant SEC-02/SEC-07 : une restauration qui échoue après la copie de la base peut laisser un serveur qui répond 500 à toute requête avec cookie ; une erreur d’écriture du zip (EACCES, disque plein) n’est pas gérée et tue le processus ; un `docker stop` pendant une sauvegarde de plus de 10 s laisse un zip partiel ; enregistrer les réglages ne replanifie rien (il faut redémarrer).
- Le mode cron est désactivé dans l’interface et refusé par backup-settings depuis SEC-02, car POST auto-backup exige une session : le réactiver avec le jeton, et retirer l’action de mise à jour correspondante de la documentation si besoin.
- Trouvé pendant SEC-03 : la route restore garde des imports inutilisés ; si `migrateSchema()` échoue après la copie, `keepOnlySession` et la remise du code d’accès de l’instance ne s’exécutent pas : remettre la base d’avant la restauration en cas d’échec.
- Trouvé pendant QA-01 : l’ordre de la restauration (`migrateSchema`, puis `keepOnlySession`, puis remise du code d’accès) n’est testé que pas à pas (`session-restore.test.ts`), pas par POST `/api/admin/restore`, qui écrit dans un chemin `./data` codé en dur : ajouter le test de la route quand le chemin sera injectable.
- Reporté de DEP-04 : archiver 7 → 8 et yauzl, avec la réécriture des sauvegardes. Trouvé pendant DEP-04 : `setSetting` est recopié dans `hooks.server.ts`, `admin/auto-backup` et `admin/backup-settings` alors que `setAppSetting` existe (`services.ts`) ; la route `import-json` n’a aucun test.
- Trouvé pendant QA-02 : les trois exécuteurs de `Promise` asynchrones de `hooks.server.ts`, `admin/auto-backup` et `admin/import-json` portent une exception ESLint `no-async-promise-executor`, à retirer avec la réécriture ; dans `hooks.server.ts`, deux variables initialisées à `null` ne sont jamais lues.
- Trouvé pendant DEP-03 : le futur appel cron de POST `auto-backup` devra envoyer `Content-Type: application/json` (contrôle CSRF de SvelteKit 3 sur les autres types).
- Fait en P4 (2026-10-12) : archiver 8.0.0 ; module `src/lib/server/backup/` (archive, fichiers, restauration, planificateur, jeton) ; une sauvegarde zippe un instantané de la base, écrit sous un nom temporaire. La restauration refuse ce qui n’est pas une sauvegarde Cellar (en-tête, `integrity_check`, tables attendues, table des migrations), ne copie que les images que l’application sert, met fin aux sessions de la sauvegarde avant la bascule et retient les écritures pendant ce temps. Un seul planificateur, replanifié dès l’enregistrement des réglages ; le mode cron revient avec un jeton (voir les décisions) ; les noms qui commencent par `auto-` sont réservés aux sauvegardes automatiques ; au démarrage, seuls les fichiers `.partial` des sauvegardes interrompues sont supprimés. Cela règle aussi ce qu’avait relevé DATA-01 : écritures perdues pendant une restauration, base vide ou étrangère acceptée, code recopié entre `hooks.server.ts` et `auto-backup`, `backupCurrentImages` mort, images restaurées sans `resolveInDir`, sessions de la sauvegarde valides entre `migrateSchema` et `keepOnlySession`. Le wipe n’écrit plus qu’une sauvegarde (deux zips identiques, trouvé pendant DATA-04).
- Restent ouverts après DATA-05 : `temp-restore-*` et `temp-extract-*` restent dans `data/` après un arrêt brutal ; `docker stop` attend 10 s après une sauvegarde (keep-alive d’adapter-node ?).
- Trouvé pendant API-02, reste ouvert : `download-images` construit son zip en mémoire ; l’import JSON copie ses images après avoir relâché le verrou d’écriture, comme la restauration.

**Critère d’acceptation** : Restaurer une sauvegarde ancienne fonctionne sans redémarrage. Une sauvegarde prise pendant des écritures reste valide (`integrity_check` ok). Changer la fréquence s’applique tout de suite.

**Sources** : review-3-admin-api.md#C2, review-3-admin-api.md#M2, review-3-admin-api.md#M3

### DATA-06 · Séquence de codes-barres transactionnelle

Sévérité **majeur** · effort **S** · dépend de DATA-03, DATA-04, BUG-01 · statut **Fait**

**Suivi** (2026-10-12) : 5b2a1c4..a7122f2 sur develop (code ..c7e97ba), CI verte (run 38293520236) : compteur par préfixe dans app_settings, écrit dans la même transaction que les insertions ; prochain numéro = max(départ, compteur+1, plus grand code+1) en une requête SQL (règles des anciens codes inchangées) ; réglages lus une fois par création ; le wipe garde les compteurs, la restauration garde le plus grand ; texte du dialogue corrigé. La course elle-même était fermée par DATA-04 (le test d’acceptation 2×6 → 12 codes distincts sert de garde). Preuve : cave 0.5.0 mise à jour sur place, numérotation identique à l’aperçu 0.5.0, 984 créations concurrentes distinctes.

**Problème** : `getNextBarcodeNumber` lit tous les codes et calcule le maximum en JS, puis les inserts suivent après plusieurs `await` : deux requêtes simultanées obtiennent les mêmes codes.

**Fichiers** : `src/lib/db/services.ts:570,579,915-937`

**À faire**

- Compteur dans `app_settings` incrémenté dans la même transaction que les inserts.
- Lire les réglages une seule fois par création.
- Trouvé pendant QA-01 : avec un préfixe vide, `getNextBarcodeNumber` (`src/lib/db/services.ts`) compte tous les codes numériques, y compris les codes saisis à la main.
- Trouvé par le banc de test 0.3.0 → 0.4.0 : depuis BUG-01 (d92620b), `getNextBarcodeNumber` ne compte que les codes de 10 caractères ; une base dont tous les codes séquentiels ont l’ancien format à 13 caractères (préfixe de 6 + 7 chiffres, générés avant septembre 2025, par exemple une vieille sauvegarde restaurée) repart à 1 au lieu de 375 sur la sauvegarde du banc. Pas de doublon possible (chaînes différentes), mais de nouveaux numéros reprennent ceux d’étiquettes déjà imprimées. Corrigé avant 0.4.0-rc.1 (fix/legacy-barcode-numbering, décision ci-dessous). Limites connues : un ancien code dont le préfixe d’alors était le préfixe actuel suivi de chiffres (`CV2025…` lu avec le préfixe `CV`) compte comme un grand numéro et donne un 409 « préfixe épuisé » ; avec un préfixe vide ou numérique, un EAN-13 manuel qui commence par le préfixe suivi de `000` fait sauter des numéros (jamais de 409). Ces deux limites sont acceptées (décision du 2026-10-11) ; DATA-06 réécrit cette fonction.
- Fait en P4 (2026-10-12) : un compteur par préfixe dans `app_settings`, avancé dans la transaction de la création et seulement quand un code est généré : deux créations simultanées obtiennent des codes distincts. Le wipe garde les compteurs, la restauration garde le plus grand des deux pour chaque préfixe (voir les décisions). Le dialogue des réglages nomme le plus grand numéro déjà donné ; « Found {count} existing bottles » et « Your start number will be used when all numbers are exhausted », faux, sont retirés. Limites connues gardées : des préfixes qui se chevauchent (`CV` et `CV0`) ; avec un préfixe vide, un code manuel à 10 chiffres déplace la séquence (`9999999999` donne 409).

**Critère d’acceptation** : Un test qui lance 2 créations concurrentes de 6 bouteilles obtient 12 codes distincts.

**Sources** : review-1-data.md#M2

### DATA-07 · Nettoyer le seeding, les scripts et les fichiers parasites

Sévérité **mineur** · effort **S** · dépend de DATA-01 · statut **Fait**

**Suivi** (2026-10-12) : 0a497c2..0df34a2 sur develop (code ..e17e8d6), CI verte (run 38292664335) : seed({ force }) unique (importLookupCsv générique + appellations + presets, une transaction par fichier) ; scripts/data seule source des CSV, csv-imports ignoré par git (fichiers modifiés par l’utilisateur jamais écrasés) ; scripts morts, fichiers parasites et db:seed/db:setup supprimés ; .claude/settings.local.json détracké ; drizzle.config suit DATABASE_PATH ; build sans les images uploadées ; en-têtes manuels et BOM UTF-8 lus. Preuve : 6 CSV dans git, installation neuve identique à 0.5.0 (comptes et contenu), mise à jour sur place avec un CSV modifié conservé.

**Problème** : Le seeding existe en 3 exemplaires (7 fonctions d’import quasi identiques). `pnpm db:seed` efface la base de dev réelle. Les CSV existent en triple, car `csv-imports/` est généré dans le dépôt puis commité. Fichiers morts : `wine_images_schema.sql`, `test-labels.pdf` (qui est en fait du JSON), `appellations.csv` à la racine.

**Fichiers** : `src/lib/db/migrations.ts:131-635`, `scripts/`, `csv-imports/`, `appellations.csv`, `wine_images_schema.sql`, `test-labels.pdf`, `.claude/settings.local.json`

**À faire**

- `importLookupCsv(table, column, file)` générique, plus un importeur dédié aux appellations et un aux presets, avec une transaction par fichier ; `seed({ force })`.
- Garder `scripts/data/` comme seule source ; ignorer `csv-imports/` dans git ; lire `CSV_IMPORT_DIR` depuis l’environnement.
- Supprimer les scripts morts ou dangereux et les fichiers parasites.
- `pnpm db:seed` échoue (`Cannot find package '$lib'`) : lancer tsx avec `--tsconfig tsconfig.json` ou retirer les imports `$lib` des scripts.
- Trouvé pendant QA-02 : `.claude/settings.local.json` et `test-labels.pdf` sont suivis par git.
- Trouvé pendant SEC-09 : la ligne d’en-tête de `appellations.csv` importée comme appellation est corrigée par BUG-11 (P2). Avec csv-parse 7, ne pas combiner `encoding: "latin1"` et `trim: true` : le trim retire alors `(`, `)`, `/` ou `_` en bord de champ.
- Trouvé pendant DEP-03 : un `pnpm build` hors Docker embarque dans `build/` les images présentes dans `static/uploads` (adapter-node 6 fige la liste des fichiers statiques au build).
- Trouvé pendant DOC-02 : `docker-setup.sh` dit encore de déposer les CSV dans `docker-data/csv-imports/` et utilise `docker-compose` ; le commentaire de `docker-compose.yml` (« CSV files for initial import ») est faux, et « no trailing slash » dans `docker-compose.yml` et `.env.example` n’est plus nécessaire (adapter-node normalise `ORIGIN`) ; `container_name: wine-cellar` fixe oblige à arrêter l’ancien dossier avant une mise à jour par archive ; `.claude/settings.local.json` part dans chaque archive source de release.
- Trouvé pendant BUG-11 : un `csv-imports/appellations.csv` modifié à la main et sans ligne d’en-tête perd maintenant sa première ligne au seeding (`from_line: 2`) ; la migration 0004 laisse en place une chaîne Pays/Région/Appellation déjà entamée à la main.
- Fait en P4 (2026-10-12) : un seul `seed({ force })` avec `importLookupCsv`, qui sert aussi le wipe (fin des copies `seedInitialData` et `forceSeedInitialData` et des imports inutiles de `migrations.ts`, trouvés pendant DATA-02) ; `csv-imports/` n’est plus suivi par git (`scripts/data/` est la seule source) ; scripts de seeding et de migration, tsx, fichiers parasites et `.claude/settings.local.json` retirés ; drizzle-kit ouvre la base de `DATABASE_PATH` ; les images envoyées ne partent plus dans `build/` ; `appellations.csv` garde sa première ligne quand ce n’est pas un en-tête, et accepte un BOM UTF-8 ; `docker-setup.sh`, les commentaires du compose et `.env.example` corrigés. `wine_bottle_formats.csv` de `csv-imports` n’est plus lu (identique à `wine_formats.csv`) : le dire dans le résumé de la 0.6.0, avec le conseil de déplacer ses lignes ajoutées dans `wine_formats.csv`.
- Gardé : `container_name: wine-cellar` dans `docker-compose.yml` (deux dossiers ne tournent pas ensemble de toute façon, même port 3005) ; à documenter dans le guide de mise à jour par archive si besoin. Restent ouverts après DATA-07 : la chaîne Pays/Région/Appellation de la migration 0004 (trouvée pendant BUG-11, effet minime) ; `appellations.csv` est toujours lu en latin1, donc une copie ré-enregistrée en UTF-8 donne des noms abîmés (« CÃ´tes ») ; le wrapper d’adapter-node de `vite.config.ts` (uploads hors de `build/`) dépend du comportement d’adapter-node 6, sans test.

**Critère d’acceptation** : Plus aucun CSV en double dans git, `scripts/` réduit à l’utile, et le seeding passe sur une base vide.

**Sources** : review-1-data.md#M4, review-1-data.md#M5, review-7-infra-architecture.md#Mineur

### REL-02 · Contrôle de mise à niveau au démarrage

Sévérité **évolution** · effort **M** · dépend de REL-01, DATA-02 · statut **Fait**

**Suivi** (2026-10-12) : 42f6aef..5b2a1c4 sur develop (code ..4c36226), CI verte (run 38293245915) : règles de releases.json partagées entre scripts et app ; au démarrage, version enregistrée après les migrations, actions de mise à jour dans les logs et un bandeau admin à cocher ; refus de démarrer sur une base plus récente (versions exactes) ou si un arrêt obligatoire est sauté ; version d’avant 0.6.0 déduite des migrations (« peut-être déjà faites ») ; avertissement ORIGIN sans bloquer ; la restauration applique le même contrôle (409/400). Preuve : base v0.1.0 → 9 actions dans les logs et l’admin (en/fr), arrêt sauté → exit 1 « Install 0.4.0 first », mise à jour Docker depuis 0.5.0-rc.1.

**Problème** : Après une mise à jour de l’image, rien ne prévient l’utilisateur des actions à faire, et sauter une version qui ne peut pas l’être n’est pas détecté.

**Fichiers** : `src/hooks.server.ts`, `src/lib/server/`, `app_settings`, `src/routes/admin/`

**À faire**

- Enregistrer en base la version de l’application au dernier démarrage réussi.
- Au démarrage (hook `init`, avec DATA-02), comparer avec la version courante à l’aide de la source d’actions de REL-01. Si un arrêt obligatoire est sauté, refuser de démarrer avec un message clair dans les logs du conteneur (« installez d’abord vX ») ; sinon, journaliser les actions de mise à jour.
- Vérifier les prérequis connus, comme les variables d’environnement (`ORIGIN`), et nommer explicitement ce qui manque.
- Bandeau dans l’admin qui liste les actions de mise à jour restantes, que l’utilisateur peut marquer comme faites.
- Fait en P4 (2026-10-12) : au démarrage, `src/lib/server/upgrade.ts` compare la version enregistrée en base à la version courante avec les règles de `releases.json`, partagées avec les scripts ; un arrêt obligatoire sauté, ou une base venue d’une version plus récente, empêche le démarrage sans rien modifier ; la version est enregistrée dès que le schéma est migré ; le bandeau de l’admin liste les actions à cocher ; `ORIGIN` manquant donne un avertissement (voir les décisions). La restauration passe la sauvegarde par le même contrôle (409 si elle est refusée, trouvé pendant DATA-02) et garde la version et les actions de l’instance.

**Critère d’acceptation** : Passer de v0.1.0 à la dernière version affiche les actions à faire dans les logs et dans l’admin. Sauter un arrêt obligatoire empêche le démarrage, avec un message qui indique la version intermédiaire à installer.

**Sources** : Décision du 2026-10-08 (versions et releases)

## P5 · Couche serveur et API (1.0.0)

Routes minces : validation zod, puis service de domaine, puis réponse. Supprimer la duplication des CRUD et découper l'import CSV.

### API-01 · Validation zod et format d’erreur unique

Sévérité **majeur** · effort **M** · dépend de DEP-03 · statut **Fait**

**Suivi** (2026-10-13) : Mergé le 2026-10-13 : 748bf73..1de9097 (14 commits), résumé 0.7.0 fe43641. CI verte. Format d'erreur unique, zod sur chaque corps, IDs seulement, 413 au-delà de 1 Mo.

**Problème** : zod est installé mais jamais importé : 50 `request.json()` sans validation. Exemples : `quantity: 1000000` bloque le serveur, `PUT /definitions/[id]` laisse modifier n’importe quelle colonne, une faute de frappe dans `type` crée un nouveau type. Les formats d’erreur et les codes HTTP varient d’une route à l’autre.

**Fichiers** : `src/routes/api/**`, `src/lib/db/services.ts:322-447`

**À faire**

- `src/lib/shared/schemas/` : un schéma par entité, réutilisable dans les formulaires.
- `src/lib/server/http/` : `parseBody(request, schema)` (400/422 avec détails) et erreurs de domaine (`NotFound`, `Conflict`, `Validation`) traduites en un seul endroit.
- Format `{ error: { code, message, details? } }`, avec les codes 201, 204, 404, 409 et 422.
- N’envoyer et n’accepter que des IDs (plus de « get-or-create » par nom).
- Trouvé pendant SEC-07 : au-delà de `BODY_SIZE_LIMIT`, les routes JSON qui attrapent toutes les erreurs répondent 500 au lieu de 413.
- Trouvé pendant SEC-03 : `PUT /api/settings` ne fait qu’un UPDATE et ne crée jamais un réglage absent.
- Trouvé pendant QA-01 : PUT `/api/settings` répond 500 à un corps qui n’est pas du JSON, et ne crée jamais un réglage absent ; deux tests `it.fails` de `src/routes/api/settings/server.test.ts` le documentent : les passer en `it` avec la correction. Le type du paramètre de `createMultipleWineBottles` (`src/lib/db/services.ts`) exige `formatId` même quand le format est donné par son nom, ce que la route masque avec `as any`.
- Trouvé pendant SEC-09 : l’import CSV insère toutes les colonnes du fichier, sans liste de colonnes autorisées par table. Trouvé pendant BUG-01/BUG-09 : les erreurs d’API (plage de codes-barres, nom d’export invalide) sont en anglais et affichées telles quelles : prévoir un `code` traduisible dans le format d’erreur. BUG-02 a posé le premier schéma zod (DELETE `/api/admin/images`).
- Trouvé pendant DEP-03 : `POST /api/definitions` sans appellation répond 500 ; `label-presets/[id]` (PUT), `admin/appellations` et `admin/regions` (POST) renvoient la ligne relue après l’écriture : si elle a disparu entre-temps (ou si la région de l’appellation a perdu son pays, faute de clés étrangères avant DATA-03), `Response.json(undefined)` donne 500 alors que l’écriture est faite (201 vide avec `json()` en SvelteKit 2).
- Trouvé pendant DATA-02 : `admin/label-presets` (POST, et PUT de `[id]`) accepte des espacements non numériques (`parseFloat` donne NaN, stocké NULL), que plus rien ne répare au démarrage depuis la migration 0005. Trouvé pendant DATA-04 : PUT `/api/bottles/[id]` avec une case inexistante répond 500.
- Trouvé pendant DATA-03 : l’import JSON refuse (400 propre) un ancien export avec doublons, statut inconnu ou note hors de 1 à 5, que la restauration du zip accepte et répare ; l’import CSV refuse tout l’import pour un `parentContainerId` orphelin ou une note supérieure à 5, tronque 4,5 en 4 (`parseInt`) et transforme un statut inconnu en `available` sans `trim` : une normalisation partagée entre importeurs. Un code-barres qui n’est ni texte ni nombre donne 500 (à valider avec zod).
- Fait en P5 (2026-10-13) : une erreur répond `{ error: { code, message, details? } }`, produite en un seul endroit (`apiHandler`, qui traduit aussi les refus de SQLite en 409 ou 422), avec un `code` pris dans une liste fermée que l’interface traduit ; chaque corps JSON passe par `parseBody` et un schéma zod de `src/lib/shared/schemas/` (400, 413 au-delà de 1 Mo, 422 avec les problèmes), chaque envoi de fichier par `parseFormData` (400, 413) ; 201, 204, 404, 409 et 422 partout. L’API ne prend plus que des IDs : plus rien ne crée un type, une couleur, une classification, un format ou une origine par son nom. Restauration, wipe, 401 et 503 des hooks et les 403 de `csrf.ts` répondent au même format ; un 409 `in_use` dit combien de lignes utilisent encore une valeur de référence. Cela règle les points de SEC-03, SEC-07, QA-01, BUG-01/BUG-09, DEP-03, DATA-02 et DATA-04 ci-dessus et le code-barres qui donnait 500 ; ceux des imports (SEC-09, DATA-03) sont faits par API-04.

**Critère d’acceptation** : Plus aucun `request.json()` sans schéma. Un corps invalide renvoie 422, jamais 500.

**Sources** : review-2-public-api.md#M3, review-7-infra-architecture.md#Roadmap-4

### API-02 · Services par domaine

Sévérité **majeur** · effort **L** · dépend de DATA-01, DATA-04, API-01 · statut **Fait**

**Suivi** (2026-10-13) : Mergé le 2026-10-13 : 67f9832..e5490b3 (6 commits), résumé 0.7.0 08b596c. CI verte. Services par domaine (src/lib/server/features), services.ts supprimé, règle de lint, 409 case_full, verrou d'écriture pendant l'import JSON.

**Problème** : `services.ts` (983 lignes) est contourné par 38 routes qui interrogent la base directement. La logique métier est dans les handlers. Les règles du stockage (case occupée, capacité) ne sont appliquées que côté client.

**Fichiers** : `src/lib/db/services.ts`, `src/routes/api/**`

**À faire**

- `src/lib/server/features/<domaine>/{repository,service}.ts` pour geography, catalog, bottles, storage, settings, labels, barcode et backup.
- Les routes ne font plus que : schéma, puis service, puis réponse (environ 10 lignes).
- Règles de stockage côté serveur, en transaction, avec 409.
- Un test par service, écrit au fil du découpage.
- Trouvé pendant DATA-04 : restent hors transaction le PUT des réglages, la création et l’édition des définitions de vin, le PUT d’une bouteille (PATCH d’API-05), les sessions et le code d’accès, et `seed-manufacturer-presets`. Trouvé pendant DATA-06 : PUT `admin/barcode-settings` écrit ses trois réglages hors transaction.
- Trouvé pendant DATA-05 : l’import JSON a la même course que la restauration (une écriture faite entre l’export préalable et la transaction est perdue), car le verrou d’écriture ne couvre que la restauration ; `download-backup` lit tout le fichier en mémoire.
- Fait en P5 (2026-10-13) : `src/lib/server/features/<domaine>/{repository,service}.ts` pour geography, catalog, images, bottles, storage, settings, labels, barcode et backup ; les routes lisent leur entrée, appellent un service et répondent, et une règle de lint leur interdit le client de la base et les repositories ; `services.ts` n’existe plus, et les services lèvent des erreurs de domaine, jamais une erreur HTTP. Le serveur refuse (409 `case_full`) une écriture qui laisse une case avec plus de bouteilles disponibles que sa capacité (voir les décisions). Les écritures relevées par DATA-04 et DATA-06 passent en transaction (sessions et code d’accès, réglages des codes-barres et des sauvegardes, préréglages fabricant tout ou rien, PUT d’une bouteille) ; l’import JSON retient les autres écritures comme la restauration (503 `writes_held`) ; `download-backup` envoie le fichier en flux.

**Critère d’acceptation** : Aucune route n’importe le client DB. `services.ts` n’existe plus.

**Sources** : review-1-data.md#M3, review-6-feature-pages.md#M6

### API-03 · CRUD générique pour les référentiels

Sévérité **majeur** · effort **M** · dépend de API-01, API-02 · statut **Fait**

**Suivi** (2026-10-13) : Mergé le 2026-10-13 : 1ead664..f278989 (4 commits), résumé et action 0.7.0 f279fc8. CI verte. createLookupCrud sert les 8 référentiels sous /api/&lt;table> ; 404/409 ; action conditionnelle pour les scripts (approuvée le 2026-10-13).

**Problème** : 20 routes CRUD admin sont quasi identiques (vérifié par diff), plus 4 routes `wine-*` publiques identiques, sans compter les doublons publics et admin pour countries, regions et appellations.

**Fichiers** : `src/routes/api/admin/{wine-types,wine-colors,wine-formats,wine-classifications,origins,countries,regions,appellations}/**`, `src/routes/api/{wine-types,wine-colors,wine-formats,wine-classifications}`

**À faire**

- Fabrique `createLookupCrud({ table, nameColumn, parent?, usages })` qui renvoie les handlers collection et item.
- Chaque `+server.ts` tient en 2 lignes. Fusionner les routes publiques et admin.
- PUT renvoie 404 si l’entité n’existe pas, DELETE renvoie 409 si elle est utilisée.
- Trouvé pendant DATA-04 : les suppressions de l’admin (pays, régions, types…) vérifient l’usage puis suppriment : une écriture entre les deux donne 500 au lieu de 409.
- Fait en P5 (2026-10-13) : `createLookupCrud` (`src/lib/server/features/shared/lookup-crud.ts`) sert les huit référentiels, chaque fichier de route tient en deux lignes, et les routes `/api/admin/<table>` sont supprimées : `/api/<table>` sert les formulaires et l’admin. Chaque ligne porte son nom en `name` ; POST d’un nom existant renvoie la ligne existante (200, l’admin dit « existe déjà ») ; PUT renvoie la ligne enregistrée, 404 pour un id inconnu et 409 pour un nom pris ; DELETE répond 404 ou 409 `in_use`, et seule la clé étrangère refuse une valeur utilisée (plus de course entre la vérification et la suppression, trouvée pendant DATA-04) ; listes triées par nom, `?withHierarchy` devenu inutile (voir les décisions). Supprimer un vin inconnu répond aussi 404.

**Critère d’acceptation** : 8 référentiels servis par la même fabrique, avec des tests de la fabrique.

**Sources** : review-3-admin-api.md#Refacto-3, review-2-public-api.md#Mineur

### API-04 · Découper l’import CSV

Sévérité **majeur** · effort **L** · dépend de DATA-04, BUG-09, API-01 · statut **Fait**

**Suivi** (2026-10-13) : Mergé le 2026-10-13 : abfff5c..88b1228 (9 commits), résumé 0.7.0 f91b6b4. CI verte. Import CSV en dossier de feature (673 lignes), une transaction, dryRun, 2000 bouteilles en ~0,2 s ; codes-barres automatiques pour les bouteilles en cave seulement (décision du 2026-10-13).

**Problème** : Le fichier fait 1508 lignes, sans transaction, avec 146 `console`. Pour chaque bouteille, il recharge toutes les définitions avec 4 jointures et toutes les bouteilles de la caisse : des millions de lignes jointes pour quelques milliers de bouteilles.

**Fichiers** : `src/routes/api/admin/import-csv/+server.ts`

**À faire**

- Fichiers `tables.ts` (configuration déclarative et ordre déduit des dépendances), `detect.ts`, `parse.ts`, `referenceIndex.ts` (chargé une seule fois), `pipeline.ts` et `bottles.ts`.
- Import complet dans une seule transaction, avec un mode `dryRun` qui renvoie le rapport sans écrire.
- Logger `debug` activable à la place des `console.log`.
- Appeler `rejectOversizedUpload` (src/lib/server/upload.ts) avant `formData()`, comme les autres imports depuis SEC-06.
- Trouvé pendant DEP-04 : les quatre `if (!cleanedData.id) cleanedData.id = randomUUID()` de l’import (vers les lignes 1358, 1435, 1458 et 1481) ne s’exécutent jamais, l’ID étant toujours posé plus haut.
- Trouvé pendant BUG-09 : une ligne dont une référence optionnelle ne se résout pas est insérée sans elle, puis dupliquée aux imports suivants ; le rapprochement des bouteilles recopie la normalisation de `wineDefinitionKey` et remplit le cache des vins avec des clés par nom seul ; un nom d’export personnalisé qui contient un nom de table (« regions ») fait lire le fichier comme cette table ; l’export des bouteilles ne porte que `wineName` et `producer`, donc des vins homonymes se confondent et les bouteilles sans code-barres (dont toutes les bouteilles sorties) sont dupliquées à chaque réimport.
- Fait en P5 (2026-10-13) : l’import CSV devient `src/lib/server/features/csv-import/` (`tables.ts`, `detect.ts`, `parse.ts`, `referenceIndex.ts`, `bottles.ts`, `pipeline.ts`, `service.ts`), en une transaction, avec `dryRun`, `DEBUG=csv-import` et le 413 lu dans `Content-Length` ; les imports CSV et JSON répondent au format d’erreur d’API-01 et passent par un seul normaliseur, qui garde les colonnes des schémas de l’API (jamais un id ni le parent d’un conteneur) avec leurs bornes, et applique aux anciens exports les réparations de DATA-03 (notes décimales, statut, cépages, quantité cible). Une référence inconnue fait sauter sa ligne ; une bouteille est rapprochée de son vin par les colonnes du fichier des vins (l’export des bouteilles porte aussi appellation, classification et couleur), et les homonymes sont signalés ; réimporter son export n’ajoute rien, une bouteille bue garde son code-barres, et seules les bouteilles disponibles reçoivent un code automatique (voir les décisions). Cela règle les points de DEP-04 et BUG-09 ci-dessus, et ceux des imports relevés par SEC-09, DATA-03 et API-01.
- Trouvé pendant API-04, reste ouvert : régions, appellations et cases sont rapprochées par leur nom seul, et la première l’emporte (comme avant) ; un CSV dont les lignes n’ont pas toutes le même nombre de colonnes échoue en entier.

**Critère d’acceptation** : Moins de 700 lignes au total. Un import de 2000 bouteilles prend moins de 5 s. Test aller-retour export puis import.

**Sources** : review-3-admin-api.md#M7, review-3-admin-api.md#Refacto-2

### API-05 · Mises à jour partielles et groupées des bouteilles

Sévérité **majeur** · effort **M** · dépend de API-01, DATA-04 · statut **Fait**

**Suivi** (2026-10-13) : Mergé le 2026-10-13 : 8c4dfcd..a8779f1 (4 commits), résumé 0.7.0 404f2dd. CI verte. PATCH /api/bottles/{id} et PATCH /api/bottles { ids, changes } tout ou rien ; le client n'envoie que les champs changés ; PUT gardé (décision du 2026-10-13).

**Problème** : `PUT /api/bottles/[id]` réécrit toutes les colonnes avec des valeurs par défaut implicites : c’est l’origine du bug corrigé dans bc9a8de. Les mises à jour groupées envoient N PUT en parallèle avec des objets potentiellement périmés, sans atomicité.

**Fichiers** : `src/routes/api/bottles/[id]/+server.ts:20-42`, `src/lib/components/BottleDetailsDialog.svelte:184-211,320-341`, `src/routes/wines/[id]/+page.svelte:324-341`

**À faire**

- `PATCH /api/bottles/[id]` avec un schéma `.partial()`.
- `PATCH /api/bottles` avec `{ ids, changes }` dans une transaction.
- Le client n’envoie que les champs modifiés.
- Trouvé pendant BUG-06 : la mise à jour groupée de « Hors cave » envoie l’objet bouteille entier (`...bottle`, avec `definition` et `storageCase` imbriqués) ; après un échec partiel, une bouteille supprimée ailleurs reste sélectionnée sans ligne.
- Fait en P5 (2026-10-13) : `PATCH /api/bottles/[id]` ne change que les champs de son corps, et `PATCH /api/bottles` applique les mêmes `changes` à toutes les bouteilles de `ids` en une transaction : un id inconnu (404 qui les nomme), un code-barres manuel pour plusieurs bouteilles (422), un code déjà pris ou une case trop pleine (409) n’écrivent rien. PUT reste, comme un PATCH qui donne tous les champs (voir les décisions). Le formulaire de bouteille, les dialogues de statut et d’emplacement, la page d’un vin, le hors cave et la saisie multiple n’envoient plus que les champs changés, chaque action groupée en une requête ; après un refus, les bouteilles supprimées ailleurs quittent la sélection, et la page d’un vin dit pourquoi un changement de statut est refusé (son dialogue ignorait l’erreur, trouvé pendant API-02). Cela règle aussi le point de BUG-06 ci-dessus.

**Critère d’acceptation** : Changer le statut de 10 bouteilles se fait en une seule requête atomique, sans toucher aux autres champs.

**Sources** : review-2-public-api.md#M5, review-5-core-ui.md#M5

### API-06 · Supprimer les endpoints morts et en doublon

Sévérité **mineur** · effort **S** · dépend de API-02 · statut **Fait**

**Suivi** (2026-10-13) : Mergé le 2026-10-13 : aad356c..f924491 (15 commits), résumé 0.7.0 5ec75a3. CI verte. 7 endpoints morts supprimés, noms de fichiers au lieu de chemins, export CSV sans fichiers serveur, garde anti-formule ; csrf.ts gardé (décision du 2026-10-13).

**Problème** : `/api/wines` analyse 9 filtres qui ne servent à rien (`getFilteredWineBottles` ignore ses paramètres). `/api/wines/[id]` n’est appelé par personne. `POST /api/wines` et `POST /api/definitions` créent la même chose. Dossiers `test` vides. Plusieurs fichiers temporaires inutiles dans les exports.

**Fichiers** : `src/routes/api/wines/**`, `src/lib/db/services.ts:752-785`, `src/routes/api/test-barcode`, `src/routes/api/admin/test`, `src/routes/api/barcode/csv`

**À faire**

- Supprimer ces routes ou les fusionner, après un grep des appelants.
- Exports CSV : `new Response(csv)` directement, avec un seul helper d’échappement (qui gère aussi l’injection de formules).
- Trouvé pendant SEC-05/06 : un nom personnalisé avec emoji ou guillemet casse `Content-Disposition` (500) ; `startNumber` et `count` de barcode/csv ne sont pas typés ; `table in AVAILABLE_TABLES` accepte `__proto__` dans export-csv ; `validateBarcodeSettings` n’est appelé nulle part ; `admin/upload-image` et `upload/image` dupliquent l’enregistrement d’une image avec deux générateurs de noms.
- Trouvé pendant QA-01 : `src/routes/api/bottles/+server.ts` importe `createWineBottle`, que rien n’utilise (`src/lib/db/services.ts`).
- Trouvé pendant DEP-02 : imports inutilisés dans `create-backup/+server.ts`, `wipe-database/+server.ts`, `import-csv/+server.ts` et `api/statistics/+server.ts` ; `substr`, déprécié, dans `upload-image/+server.ts`.
- Fait par BUG-01 : `startNumber` et `count` de barcode/csv sont validés, `validateBarcodeSettings` est supprimé. Le `Content-Disposition` cassé par un caractère hors Latin-1 est traité par BUG-10 (P2). Le préfixe `cellar-export-` est écrit à trois endroits (`export-csv`, `create-export`, `paths.ts`).
- Trouvé pendant BUG-04 : `GET /api/definitions` renvoie « Unknown Appellation » et « Unknown Region » pour toutes les définitions, car la route lit `item.appellations` et `item.regions` alors que `getWineDefinitionsWithLocation()` (`services.ts`) aplatit déjà les lignes ; `WineBottleDialog.svelte` utilise cette liste, mais n’affiche que « nom – producteur » : rien n’est visible aujourd’hui. Décision du 2026-10-11 : pas de tâche BUG, à corriger avec API-01 et API-06.
- Fait par DEP-04 : `admin/upload-image` et `upload/image` nomment leurs fichiers avec le même `newImageFileName()`. Trouvé pendant DOC-02 : l’endpoint qui remet les modèles d’étiquettes par défaut existe, mais aucune page ne l’appelle.
- Trouvé pendant BUG-05 : `GET /api/wines` lit encore `sortField` et `sortDirection` (types `SortField`, `SortDirection`, `SortOptions` de `types.ts`, `getFilteredWineBottles`), qu’aucun client n’envoie : tri serveur mort.
- Trouvé pendant DEP-03 : `src/lib/server/csrf.ts` (SEC-01) recouvre presque entièrement le contrôle CSRF de SvelteKit 3, toujours actif hors dev : décision du 2026-10-12 : il reste ; le réexaminer ici avec un test de ce que SvelteKit 3 couvre seul.
- Trouvé pendant DATA-01 : avec un `DATA_DIR` absolu, les réponses de l’admin exposent le chemin du serveur ; renvoyer des noms de fichiers rendrait `stripDataDirPrefix` inutile. Trouvé pendant DATA-03 : `admin/images` remet `imageId` à NULL lui-même alors que `ON DELETE SET NULL` le fait. Trouvé pendant DATA-05 : GET `/api/admin/auto-backup` n’a aucun appelant.
- Fait en P5 (2026-10-13) : supprimés après un grep des appelants : POST `/api/wines`, GET et PUT `/api/wines/[id]`, GET `/api/admin/auto-backup`, `restore-label-presets`, `seed-manufacturer-presets` et `cleanup-csv` ; GET `/api/wines` ne lit plus ni filtres ni tri. L’export CSV renvoie ses fichiers dans la réponse sans rien écrire sur le serveur, et tous les exports CSV passent par `src/lib/server/csv.ts`, avec la garde anti-formule (voir les décisions). Les réponses de l’admin donnent des noms de fichiers (fin de `stripDataDirPrefix`), `backupFilePrefix` écrit le début des noms, la clé étrangère retire seule une image supprimée de ses vins, et les téléchargements de l’admin et de la page codes-barres passent par `saveBlob`. Code client mort supprimé (voir UI-01). Un export de toutes les tables attend 200 ms entre deux fichiers : Chromium perdait ceux d’après le dixième. `csrf.ts` reste (voir les décisions).

**Critère d’acceptation** : Le nombre d’endpoints baisse, aucune régression dans le front.

**Sources** : review-2-public-api.md#M6, review-2-public-api.md#Mineur

## P6 · Frontend (1.0.0)

Chargement des données côté serveur, Svelte 5 partout, composants découpés par fonctionnalité, admin en vraies routes.

### UI-01 · Supprimer le code mort du front

Sévérité **mineur** · effort **S** · dépend de QA-04 · statut **Fait**

**Suivi** (2026-10-13) : Mergé le 2026-10-13 : ed0c1d3..eb24b87 (11 commits), entrée 0.8.0 provisoire 6f94b6f ; knip en CI (décision du mainteneur) 201da50..e6989b7. CI verte. knip 6.39.0 (`pnpm knip` à 0), ~1300 lignes mortes supprimées, aucun changement visible (captures identiques).

**Problème** : Environ 2500 lignes mortes : 5 services admin jamais importés (dont un qui appelle des endpoints inexistants), `WineRegistrationForm.svelte` (647 lignes), `mockData.ts`, `theme.ts`, des stores et helpers non utilisés, et `confirmDeleteImages`.

**Fichiers** : `src/lib/services/admin/*`, `src/lib/components/WineRegistrationForm.svelte`, `src/lib/mockData.ts`, `src/lib/utils/theme.ts`, `src/lib/stores/admin/*`, `src/lib/utils/admin/*`

**À faire**

- Vérifier chaque fichier avec knip ou un grep, puis supprimer.
- Retirer les commentaires du type « Extracted to X ».
- Trouvé pendant QA-02/QA-03 : code mort dans `src/lib/services/admin/` (`imageService.ts`, `geographyService.ts`, `wineDataService.ts`, `wineEntityService.ts`) et `src/lib/components/WineRegistrationForm.svelte` ; en les supprimant, retirer aussi les 11 clés i18n qu’ils sont seuls à utiliser (`pnpm i18n:check` les listera). Le repli `require()` de `src/lib/utils/uuid.ts` : fait par DEP-04, qui supprime le fichier ; alias factice `@/*` dans `svelte.config.js`.
- Trouvé pendant DEP-01 : imports inutilisés dans `src/routes/statistics/+page.svelte` ; `ssr.noExternal: ["nanoid"]` dans `vite.config.ts` : fait par DEP-04, qui retire nanoid.
- Trouvé pendant BUG-02/BUG-03 : `toggleImageSelection` (`imageHelpers.ts`) et `AdminService.toggleImageSelection` font la même chose ; `formatValue` du store de formulaire admin (`formDataStore.ts`) n’est jamais lu ; `entityService.ts` contient une seconde copie inutilisée de `openFormatDialog`. Trouvé pendant BUG-01 : `generateBarcodeFromUUID`, `generateWineBottleBarcode` et `isValidCode128Barcode` décrivent un format de 12 caractères et ne servent qu’à `mockData.ts`.
- Trouvé pendant DATA-07 : `src/lib/mockData.ts` n’est plus importé (son seul utilisateur, `scripts/db-setup.ts`, est supprimé).
- Fait par API-06 (2026-10-13) : les cinq services admin (`imageService.ts`, `geographyService.ts`, `wineDataService.ts`, `wineEntityService.ts`, `entityService.ts`), `WineRegistrationForm.svelte`, `AdminService.performDeleteType`, les chargeurs inutilisés de `utils/admin/api.ts`, leurs types et les 15 clés qu’ils étaient seuls à utiliser sont supprimés. Trouvé pendant API-06 : le type de contenu `.json` du service de sauvegarde (`features/backup/service.ts`) n’est plus jamais servi.
- Fait en P6 (2026-10-13, ed0c1d3..eb24b87) : knip 6.39.0 en devDependency, `knip.config.ts` (compilateur Svelte maison qui transmet imports statiques, `import()` et `Import.membre`, sans quoi knip donne 28 faux positifs ; primitives shadcn-svelte ignorées) et `pnpm knip` à 0 ; environ 1300 lignes supprimées (`mockData.ts`, `utils/theme.ts`, `ProtectedAction.svelte`, deux stores admin, `searchHelpers.ts`, exports et champs de stores jamais lus, commentaires « moved to ») ; le service de sauvegarde sert toujours un zip. Aucun changement visible (captures identiques). Décision du mainteneur : `pnpm knip` est un contrôle de la CI (201da50..e6989b7).

**Critère d’acceptation** : knip ne signale plus aucun fichier ni export inutilisé dans `src/lib`.

**Sources** : review-4-admin-frontend.md#M5, review-5-core-ui.md#M7

### UI-02 · Utilitaires et composants partagés

Sévérité **majeur** · effort **M** · dépend de UI-01 · statut **Fait**

**Suivi** (2026-10-13) : Fait en P6 (2026-10-13, d0c237b..189c18c ; notes de version 53c3aec). Formats par langue, today() local, préférences en runes, BottleTable, SortableHeader, Pagination partagés, saveBlob unique ; changements visibles validés par le mainteneur.

**Problème** : `formatDate`, `formatCurrency` (parfois forcé en `en-US`), les libellés de disponibilité, la pagination (2 algorithmes), les en-têtes triables (14 copies), la logique de thème (3 copies) et les tableaux de bouteilles sont dupliqués partout. La date du jour est calculée en UTC (en France, elle donne la veille entre 0 h et 2 h).

**Fichiers** : `src/routes/**`, `src/lib/components/**`

**À faire**

- `format.ts` qui suit la langue, avec une date du jour locale.
- `bottles/availability.ts`.
- Composants `Pagination`, `SortableHeader` (accessible, avec `aria-sort`) et `BottleTable` (partagé par hors cave, historique, BottleDetails et AllBottles).
- Store `preferences` typé.
- Trouvé pendant BUG-06/BUG-10 : `BottleDetailsDialog.svelte` et `AllBottlesDialog.svelte` gardent leur propre comparateur de bouteilles (réutiliser `compareBottles` de `bottle-sort.ts`) ; les chaînes y sont comparées avec `<`, donc les noms accentués ou en minuscules passent après « Z » (`Intl.Collator`) ; le code blob → `<a download>` est copié six fois dans les pages admin et codes-barres, plus `downloadBackupFile`.
- Trouvé pendant BUG-05 : dans `WineListView.svelte`, le filtre par millésime compte les bouteilles consommées alors que le tri et la ligne « Millésime » des cartes ne comptent que les bouteilles possédées (`ownedBottles`) ; le résumé retombe sur `wine.bottles || []` et le filtre de nombre sur `wine.bottles || [wine]`.
- Fait par API-06 (2026-10-13) : les pages admin et codes-barres enregistrent leurs fichiers avec `saveBlob`. Trouvé pendant API-06 : `BarcodeDialog.svelte` (vers la ligne 101) recopie encore ce téléchargement.
- Trouvé pendant UI-03 : dans `WineListView`, le filtre par origine ne regarde que la première bouteille de chaque vin, et les replis `wine.bottles || [wine]` ne servent jamais. UI-04 a supprimé `bottle-sort.ts` (l’historique et le hors cave trient sur le serveur) : les comparateurs de `BottleDetailsDialog` et `AllBottlesDialog` (qui comparent des valeurs null avec `<`) n’ont plus de fonction partagée à reprendre.
- Fait en P6 (2026-10-13, d0c237b..189c18c) : `src/lib/utils/format.ts` (dates, montants, tailles, millésimes, note) suit la langue par un seul accesseur, `currentLocale()` ; `today()` donne le jour en heure locale (test à 0 h 30 à Paris) ; préférences et thème dans `stores/preferences.svelte.ts` (mêmes clés localStorage) ; `BottleTable`, `SortableHeader` (`aria-sort`, utilisable au clavier), `Pagination` et `AvailabilityBadge` partagés ; un seul `saveBlob` ; `compareText` (`Intl.Collator`) et `compareValues` dans `utils/compare.ts` ; filtres de la liste des vins sur les bouteilles encore possédées. Restent ouverts : `formatDate` affiche en heure locale les jours stockés à minuit UTC (la veille à l’ouest de l’UTC) ; le sélecteur « éléments par page » existe en deux versions (natif dans le hors cave, bits-ui dans l’historique) ; `/api/bottles/non-consumed` renvoie `wineDefinition` quand les autres DTO disent `definition` (audit d’avant 1.0).

**Critère d’acceptation** : Plus aucune copie locale de ces fonctions (vérifié par grep).

**Sources** : review-5-core-ui.md#M6, review-6-feature-pages.md#Mineur

### UI-03 · Types dérivés du schéma

Sévérité **majeur** · effort **M** · dépend de API-01 · statut **Fait**

**Suivi** (2026-10-13) : Mergé le 2026-10-13 : a314f76..d570587 (10 commits), résumé 0.8.0 cf16ac8. CI verte. 0 `any` (336 avant, règle en erreur), types.ts supprimé, DTO dérivés des services dans src/lib/shared/dto.ts ; badges et camemberts colorés par une table clée par le nom normalisé (validé par le mainteneur avec captures).

**Problème** : `types.ts` ne correspond plus au schéma (`type` au lieu de `typeId`, enums contre tables), d’où 478 `any`. Les badges colorés par enum affichent en gris tout type créé par l’utilisateur.

**Fichiers** : `src/lib/types.ts`, `src/lib/components/WineListView.svelte`

**À faire**

- Types de domaine via `$inferSelect` et `z.infer`.
- DTO explicites par endpoint (`WineGroupDTO`, `BottleDTO`).
- Supprimer les enums Type, Color et Format ; badges via une table de correspondance avec une valeur de repli.
- Trouvé pendant BUG-03 : `onOpenFormatDialog` est typé `() => void` dans `DataManagementTabs.svelte` alors qu’il reçoit un format.
- Trouvé pendant BUG-06 : le camembert des couleurs de la page statistiques attend `Rose` alors que la couleur seedée est `Rosé` : les rosés sont dessinés en gris.
- Fait en P6 (2026-10-13, a314f76..d570587) : 0 `any` (336 avant), règle `no-explicit-any` en erreur ; `types.ts` supprimé ; un DTO par endpoint dans `src/lib/shared/dto.ts`, dérivé du service qui construit la réponse (`Jsonified<T>` pour ce que renvoie `fetch`) ; `BottleAvailability` dans `src/lib/shared/` ; badges et camemberts des types et des couleurs colorés par `src/lib/utils/wine-badges.ts`, clé = nom normalisé. Reste ouvert, pour l’audit d’avant 1.0 : `/api/wines` répète en tête de chaque entrée les champs de sa première bouteille (une forme `{ id, definition, bottles }` serait plus simple, mais c’est un changement d’API).

**Critère d’acceptation** : Plus de `any` aux frontières de l’API. `types.ts` est supprimé ou réduit aux DTO.

**Sources** : review-5-core-ui.md#M3

### UI-04 · Load functions page par page

Sévérité **majeur** · effort **L** · dépend de API-02 · statut **Fait**

**Suivi** (2026-10-13) : Mergé le 2026-10-13 : 8d7fee1..c093bbd (11 commits), résumé 0.8.0 fa21c2b. CI verte. Load functions sur toutes les pages hors admin (laissé à UI-07) ; pagination/tri/filtre serveur de l'historique et du hors cave avec l'état dans l'URL ; / en 307 ; page 404 traduite ; /wines passe de 26 à 3 requêtes au premier affichage. Changements visibles validés par le mainteneur ; GET sans appelant gardés.

**Problème** : Le projet a 0 load function utile et 132 `fetch` dans les composants. Le rendu serveur produit des pages vides. `/wines/[id]` télécharge toute la cave pour afficher un seul vin. Chaque composant recharge les référentiels (`/api/origins` est appelé à 7 endroits).

**Fichiers** : `src/routes/**/+page.svelte`

**À faire**

- Ordre : wine-shortage, cellar-history, statistics, out-of-cellar, wines/[id], wines, storage, barcode, puis admin.
- `+page.server.ts` qui appelle les services ; référentiels chargés dans `+layout.server.ts` ; `depends()` et `invalidate()` à la place de `bind:this` et `loadWines()`.
- Filtrage et pagination côté serveur pour l’historique et le hors cave.
- Redirection de `/` faite côté serveur.
- Trouvé pendant API-02 : la carte d’AGENTS.md (vers la ligne 27) décrit encore `src/lib/db/` avec ses services ; proposition : « `src/lib/server/features/<domain>/{repository,service}.ts`: data access and business rules; routes call only the service (lint rule). `src/lib/db/` keeps the schema, the connection and the migrations. »
- Fait en P6 (2026-10-13, 8d7fee1..c093bbd) : `+page.server.ts` pour wines, wines/[id], wine-shortage, statistics, storage, barcode, cellar-history et out-of-cellar ; référentiels et compteur de pénurie dans le layout ; `invalidate('app:cellar')` ; `/` en 307 ; historique et hors cave filtrés, triés et paginés en SQL, état dans l’URL ; page d’erreur `+error.svelte` traduite ; `/wines` passe de 26 à 3 requêtes au premier affichage. L’admin est laissé à UI-07 (décision du 2026-10-13). Restent ouverts : l’état de connexion se charge encore côté client (3 requêtes `auth.init()`) ; les GET `/api/wine-shortage`, `/api/statistics`, `/api/images`, `/api/wines` et `/api/bottles` n’ont plus d’appelant dans l’application mais restent (décision du 2026-10-13, à revoir à l’audit d’avant 1.0).
- Trouvé au banc de fin de P6 (2026-10-16) : la redirection 307 de `/` vers `/wines` faisait échouer les healthchecks du `Dockerfile` et de `docker-compose.yml`, qui attendent un 200 sur `/` : le conteneur restait « unhealthy ». Corrigé (a669c9a6..fbfaf8a9) : `/` répond de nouveau 200 avec une page qui mène à `/wines` par une meta refresh, et une navigation côté client vers `/` redirige ; healthchecks inchangés, sans action de mise à jour (décision du 2026-10-16). Pas dans les notes de version : la 0.7.0 répondait déjà 200. Le même banc relève, pour l’audit d’avant 1.0 : la plus ancienne sauvegarde de l’installation de test garde 81 bouteilles au millésime 0 (pas NULL), que l’export CSV des codes-barres écrit « 0 » depuis au moins la 0.7.0, alors que la 0.1.0 l’écrivait vide ; savoir si 0 veut dire « sans millésime » et comment l’interface l’affiche. Le banc lui-même avait un défaut : une réponse ramenée à une forme commune passait toujours pour identique ; corrigé.

**Critère d’acceptation** : Chaque page affiche ses données dès le rendu serveur, sans `fetch` dans `onMount` pour le chargement initial.

**Sources** : review-5-core-ui.md#M4, review-6-feature-pages.md#M11, review-7-infra-architecture.md#Roadmap-6

### UI-05 · Finir la migration vers Svelte 5

Sévérité **mineur** · effort **M** · dépend de UI-02 · statut **Fait**

**Suivi** (2026-10-14) : Fait en P6 (2026-10-14, e79ba274..87946240 ; notes de version 03000e6a). 10 composants et pages passés en runes, stores auth et toast en classes `.svelte.ts`, événements remplacés par des callbacks ; restent en Svelte 4 les fichiers réécrits par UI-06 et UI-07 : le critère global (0 `export let`, 0 `$:`) se vérifie à la fin du lot 4.

**Problème** : 14 composants sont encore en syntaxe Svelte 4 (`export let`, `$:`, `createEventDispatcher`), dont les plus gros dialogues. 17 fichiers importent `svelte/store`. Ce mélange est la cause de bugs comme BUG-04.

**Fichiers** : `src/lib/components/WineDefinitionDialog.svelte`, `src/lib/components/WineBottleDialog.svelte`, `src/lib/components/WineListView.svelte`, `src/lib/stores/**`

**À faire**

- Migrer composant par composant (`npx sv migrate svelte-5` comme base, puis relecture).
- Remplacer les stores `writable` par des classes `.svelte.ts` utilisant les runes.
- Trouvé pendant QA-02 : `src/lib/components/ui/toast/Toast.svelte` mélange la syntaxe Svelte 4 (`export let`) et Svelte 5 (`onclick`).
- Trouvé pendant UI-01 : environ 180 avertissements ESLint `no-unused-vars` (imports et variables jamais lus dans `+layout.svelte`, `WineListView`, `BottleDetailsDialog`, `storage`, `barcode`, `isDarkMode` des statistiques). Trouvé pendant UI-03 : `wine-shortage/+page.svelte` (vers la ligne 427) écoute `on:close` sur `WineBottleDialog`, qui n’émet jamais cet événement.
- Trouvé pendant UI-02 : sur `wines/[id]`, `preferences.isDark` n’est relu qu’à l’ouverture du dialogue tant que la page est en Svelte 4 ; la migration en runes le rend réactif.
- Fait en P6 (2026-10-14, e79ba274..87946240) : `Toast`, `LocaleDateInput`, `SearchableSelect`, `WineListView`, `BottleDetailsDialog`, `BulkBarcodeDialog` et les pages wines, wines/[id], wine-shortage et statistics en runes ; `stores/auth.svelte.ts` et `stores/toast.svelte.ts` remplacent les stores `writable` ; les dialogues de vin et de bouteille signalent leurs enregistrements par des callbacks ; l’icône « No Image » est dessinée en entier (tracé SVG invalide) ; avertissements ESLint 446 → 401. Restent en Svelte 4 : `WineDefinitionDialog`, `WineBottleDialog`, `ExistingBottleLocations` (UI-06) ; `svelte/store` reste dans l’admin (UI-07) et pour la langue (UI-10). Le critère se vérifie à la fin du lot 4, puis `compilerOptions.runes` peut passer à `true` pour tout le projet. Restent ouverts : sur `wines/[id]`, `confirmConsumption` n’affiche rien si l’appel échoue sur le réseau, et « Retour » (`history.back()`) ne fait rien sur une page ouverte directement ; `winesBelowTarget` (`bottles/repository.ts`) n’a pas d’ordre secondaire, donc les vins ex æquo de la pénurie changent de place ; la barre de navigation déborde à 390 px (et un peu à 1280 px), déjà sur develop.

**Critère d’acceptation** : 0 `export let`, 0 `$:`, 0 `createEventDispatcher` dans `src`.

**Sources** : review-5-core-ui.md#Résumé, review-7-infra-architecture.md#Indicateurs

### UI-06 · Formulaires de vin et de bouteille

Sévérité **majeur** · effort **L** · dépend de UI-03, UI-05, API-01 · statut **Fait**

**Suivi** (2026-10-16) : Mergé le 2026-10-16 : f75b9ea5..628ba20a, résumé 0.8.0 819ad431. Dialogues de vin et de bouteille réécrits en runes (chaque fichier &lt; 400 lignes), form actions sur /wines avec use:enhance, mêmes schémas zod côté client et serveur, erreurs par champ.

**Problème** : `WineDefinitionDialog` (1384 lignes) et `WineBottleDialog` (1088 lignes) mélangent réseau, cache, règles métier et affichage. `handleSubmit` et `handleSaveAndAddAnother` sont copiés (environ 100 lignes chacun) et la remise à zéro existe en 3 copies.

**Fichiers** : `src/lib/components/WineDefinitionDialog.svelte`, `src/lib/components/WineBottleDialog.svelte`

**À faire**

- Extraire `LocationPicker` (pays, région, appellation, dérivés en `$derived`) et `StorageCasePicker` (capacité).
- Une seule fonction d’envoi.
- Décision (2026-10-08) : schémas zod partagés entre client et serveur, form actions SvelteKit natives avec `use:enhance`, et un petit helper maison pour afficher les erreurs par champ. Ni superforms ni remote functions.
- Trouvé pendant BUG-01 : `WineBottleDialog.svelte` (deux gestionnaires d’envoi) et `WineRegistrationForm.svelte` affichent un message générique pour toute erreur autre qu’un code-barres en double : le 409 « préfixe épuisé » n’atteint pas l’utilisateur. Décision du 2026-10-11 : traité ici, pas avant (il faut 9 999 bouteilles avec un préfixe de 6 caractères).
- Trouvé pendant BUG-04 : dans `WineDefinitionDialog`, `SearchableSelect` affiche l’identifiant brut si ses options arrivent après la valeur, puis ne se met plus à jour ; si le chargement de la définition échoue, le formulaire d’édition reste vide mais peut être enregistré (PUT) ; la liste complète des appellations n’est rechargée que si elle est vide (rouvrir en création garde la liste de la dernière région), et une réponse lente la remplace quelle que soit la région ; les indicateurs de chargement sont remis à faux par la première requête terminée ; `resetForm()` est appelé deux fois à l’enregistrement et à l’annulation.
- Trouvé pendant DEP-03 : un vin créé avec une image affiche « No Image » jusqu’au rechargement de la page (déjà le cas sur develop avant SvelteKit 3).
- Trouvé pendant API-01 : les formulaires ne marquent pas les champs que nomment les `details` d’un 422 (seul le code-barres l’est) ; les dialogues « détails des bouteilles » et « toutes les bouteilles » construisent le formulaire d’édition sans `consumedDate` (sans effet aujourd’hui). Trouvé pendant API-05 : `WineBottleDialog` recharge les réglages de code-barres à chaque ouverture, ce qui relance le bloc qui remplit le formulaire et efface ce qui a été tapé avant leur arrivée ; le dialogue de saisie multiple (`BulkBarcodeDialog`) garde les bouteilles lues quand les codes ont été vérifiés et, après un rechargement, décide encore d’après elles des lignes à changer.
- Trouvé pendant UI-03 : dans `WineDefinitionDialog.svelte` (vers la ligne 149), la recherche parmi les images existantes plante dès qu’on tape, car `/api/admin/images` ne donne pas de `name` ; les légendes des images (vers les lignes 1313-1325) sont toujours vides (utiliser `filename`). Trouvé pendant UI-04 : les dialogues rechargent encore les référentiels que le layout fournit déjà.
- Trouvé pendant UI-02 : `openEditBottleDialog` de `BottleDetailsDialog` et d’`AllBottlesDialog` construisent deux copies du même objet.
- Trouvé pendant UI-05 : dans `LocaleDateInput`, modifier une date déjà remplie efface tout le champ dès la première frappe invalide (un retour arrière suffit). Trouvé pendant UI-09 : `/api/storage-cases`, les listes de cases des dialogues et `wineLocations` trient par nom (« A10 » avant « A2 ») au lieu de la position des cases.
- Fait en P6 (2026-10-16, f75b9ea5..628ba20a, résumé 0.8.0 819ad431) : `WineDefinitionDialog` (60 lignes) et `WineBottleDialog` (75) ne gardent que la coquille ; `forms/WineDefinitionForm`, `forms/WineBottleForm`, `LocationPicker`, `StorageCasePicker`, `ImagePicker`, `FormField` et `CaseLoadRow`, tous en runes et sous 400 lignes ; une seule fonction d’envoi, le remontage du formulaire fait la remise à zéro. Les formulaires postent vers les form actions de `src/routes/wines/+page.server.ts` avec `use:enhance` ; `wineFromForm`/`bottleFromForm` et les schémas zod de l’API valident des deux côtés ; `form-action.svelte.ts` et `field-errors.ts` marquent les champs (422 `details`, code-barres, `case_full`). Les points de « À faire » ci-dessus sont corrigés, et il ne reste plus d’`export let`, de `$:` ni de `createEventDispatcher` dans `src` (critère d’UI-05). Les listes de référence viennent du layout, formats et classifications compris ; les appels restants passent par le client typé d’UI-07.
- Reste après UI-06 (pour l’audit d’avant 1.0) : `listContainers` (`features/storage/repository.ts`, GET /api/storage-containers) trie par nom brut, pas comme la page stockage ; `parseFormData` compare tout le corps multipart à 20 Mo, donc une image d’un peu moins de 20 Mo reçoit un 413 ; `/api/storage-occupancy` a retrouvé un appelant (`StorageCasePicker`) et `/api/upload/image` reste utilisé.

**Critère d’acceptation** : Chaque fichier fait moins de 400 lignes, la validation est identique côté client et serveur.

**Sources** : review-5-core-ui.md#Refacto

### UI-07 · Admin : vraies routes et composants génériques

Sévérité **majeur** · effort **L** · dépend de API-03, UI-04 · statut **Fait**

**Suivi** (2026-10-16) : Mergé le 2026-10-16 : 40f51920..e5d39c2b, résumé 0.8.0 901c40b1. Admin en routes /admin/settings, /admin/backups, /admin/data/[entity], /admin/images, chargées côté serveur ; client API typé src/lib/api/client.ts ; composants génériques EntityCollection/EntityListPanel/EntityFormDialog ; admin/+page.svelte supprimé.

**Problème** : `admin/+page.svelte` (1749 lignes) contrôle toute l’administration : environ 45 `$state`, une centaine de props passées sur 3 niveaux, la suppression copiée 8 fois, 3 sources d’état concurrentes. Les flags `isCreatingBackup` et similaires ne passent jamais à true.

**Fichiers** : `src/routes/admin/+page.svelte`, `src/lib/components/admin/**`, `src/lib/stores/admin/**`

**À faire**

- Routes `admin/settings`, `admin/backups`, `admin/data/[entity]` et `admin/images`, avec garde de session dans `+layout.server.ts`.
- Client API typé (`request<T>`, `ApiError`, `downloadBlob`).
- `EntityCollection<T>` en runes, plus `EntityListPanel` et `EntityFormDialog` pilotés par un registre déclaratif des 8 entités.
- Confirmation via une promesse.
- Trouvé pendant BUG-10 : le dialogue de restauration affiche « Import Data » pour une sauvegarde manuelle (il compare le type à `database`, la liste envoie `manual-backup`) ; après une restauration depuis la liste, le toast dit que les données précédentes ont été téléchargées, alors que `/api/admin/restore` ne renvoie rien et que la copie reste seulement dans `data/`. Trouvé pendant BUG-06 : dans l’historique, changer de filtre réinitialise le tri choisi, et « Date de consommation » hors du filtre « Consommées » trie en fait par date d’achat.
- Trouvé pendant BUG-12 : dans `DataManagementTabs.svelte`, les onglets `wine` et `wines` affichent tous deux `admin.wine_definitions` (« Wine Definitions » apparaît deux fois) ; `ImageRenameDialog.svelte` affiche l’identifiant de l’image comme « nom actuel ».
- Fait avant 0.7.0 (4cb0e95, 2026-10-13) : après une restauration ou un import JSON, les dialogues lisaient `result.backups?.database` alors que la réponse porte `backup`, donc la sauvegarde préalable n’était jamais téléchargée malgré le toast « Previous data backed up and downloaded » (relevé pendant BUG-10, API-01 et API-06) ; ils lisent `result.backup`, preuve dans le navigateur pour les quatre parcours. Reste : si ce téléchargement échoue, `downloadBackupFile` (`src/routes/admin/+page.svelte`) ne fait qu’un `console.warn` et les toasts `toast.database_restored` et `toast.json_import_completed` l’annoncent quand même ; les trois dialogues gardent des textes anglais en dur (« Cancel », « Unknown error », « Failed to download backup file », « Automatic backups created and downloaded before import », au pluriel pour une seule sauvegarde). `RestoreFromListingConfirmDialog` reconnaît exports et sauvegardes au préfixe de leur nom, alors que `list-backups` donne déjà leur type.
- Trouvé pendant API-01, API-04 et API-06 : le client typé doit lire une erreur qui n’est pas au format de l’API : réponse non JSON d’un proxy (la page admin ne la gère pas), page HTML 404 de SvelteKit pour un chemin `/api/...` inconnu (le serveur pourrait répondre au format de l’API), connexion coupée (erreur de socket) au lieu d’un 413 quand un corps JSON envoyé par morceaux dépasse 1 Mo. Trouvé pendant API-04 : pas de bouton « essai à blanc » (`dryRun`) pour l’import CSV ; la détection des codes-barres à remplacer et le tri du dialogue des résultats sont recopiés côté client.
- Décision du 2026-10-13 : UI-07 charge l’admin sur le serveur (retiré d’UI-04) et retire le rechargement des référentiels qu’UI-04 fait en quittant `/admin`. Trouvé pendant UI-01 : `admin/+page.svelte` (vers les lignes 1233-1238) passe `isCreatingBackup`, `isCreatingExport`, `isRestoringDatabase`, `isImportingJson` et `isWipingDatabase`, mais les setters de `loadingStateStore.ts` ne sont jamais appelés : les boutons ne montrent aucun état « en cours » et ne se désactivent jamais ; `utils/admin/formatters.ts` (lignes 34, 40, 46-54) a des cas `automatic-*` et « Legacy » qui ne correspondent jamais, avec des libellés anglais en dur ; `stores/admin/types.ts` ne contient plus que `UIActions`, copie à la main du type de `uiActions`.
- Trouvé pendant UI-03 : les branches `result.warning` et `relatedDefinitions` d’`ImageRenameDialog.svelte` ne s’exécutent jamais ; `executeCsvImport` (`admin/+page.svelte`, vers les lignes 1085-1089) lit la réponse de barcode-settings sans tester `response.ok`, donc en cas d’erreur le dialogue de remplacement des codes-barres est sauté sans message ; plusieurs dialogues admin et l’import CSV lisent le corps avant le statut (une page de proxy non JSON donne une erreur de parsing) ; la prop `onUpdateCurrentPage` de `DataManagementTabs.svelte` n’est jamais transmise ; les confirmations de suppression insèrent tels quels un producteur ou un millésime null (`WineDefinitionsTab.svelte:294`, `WineBottlesTab.svelte:240`).
- Trouvé pendant UI-02 : l’admin découpe encore ses listes à la main (`(currentPages.x - 1) * ITEMS_PER_PAGE`) et ne ramène pas la page courante à la dernière quand une liste rétrécit (`Pagination` et `clampPage` le font ailleurs).
- Trouvé pendant UI-08 : `routes/admin/+page.svelte` (vers les lignes 223 et 286) recopie ce que fait `saveResponse` de `components/barcode/api.ts`.
- Fait en P6 (2026-10-16, 40f51920..e5d39c2b, résumé 0.8.0 901c40b1) : `admin/+page.svelte` supprimé ; routes `/admin/settings`, `/admin/backups`, `/admin/data/[entity]` (8 tables plus vins et bouteilles) et `/admin/images`, chargées sur le serveur, chaque `load` vérifiant la session (une première version laissait lire les `__data.json` sans session : trouvé en revue, corrigé et testé) ; `/admin` redirige vers `/admin/settings`. Client typé `src/lib/api/client.ts` (`request<T>`, `requestBlob`, `downloadBlob`, `ApiError`, réponses de proxy non JSON et coupures réseau), plus aucun `fetch` dans l’admin ; `EntityCollection<T>`, `EntityListPanel` et `EntityFormDialog` pilotés par un registre ; `confirm()` par promesse ; états « en cours » qui fonctionnent ; une seule pagination ; `stores/admin`, `utils/admin` et `services/admin` supprimés ; le rechargement des référentiels en quittant `/admin` (UI-04) retiré. Les points de « À faire » ci-dessus sont corrigés, sauf ceux de la ligne suivante.
- Reste après UI-07 (pour l’audit d’avant 1.0) : pas de bouton « essai à blanc » (`dryRun`) pour l’import CSV, et la détection des codes-barres à remplacer reste côté client ; un chemin `/api/...` inconnu répond la page 404 HTML de SvelteKit ; la restauration depuis la liste télécharge le fichier puis le renvoie au serveur ; le tri de l’historique relevé pendant BUG-06 a été rendu volontaire par UI-04, à trancher ; `GET /api/settings` n’a plus d’appelant.

**Critère d’acceptation** : `admin/+page.svelte` supprimé. Les 8 dialogues d’entité et les 13 listes sont remplacés par les composants génériques.

**Sources** : review-4-admin-frontend.md#Refacto

### UI-08 · Page codes-barres et étiquettes

Sévérité **majeur** · effort **M** · dépend de BUG-08, API-01 · statut **Fait**

**Suivi** (2026-10-14) : Fait en P6 (2026-10-14, a85b8cf7..4b05993e ; notes de version dca105a3). Module partagé `src/lib/shared/{barcode,labels}.ts` et `schemas/label.ts`, un seul formulaire d'étiquettes validé par le même code que la route PDF, page découpée en composants runes, `showBorder` dans les presets (migration 0008, prouvée sur une base 0.7.0), QR vectoriels, jsbarcode retiré ; changements visibles validés par le mainteneur.

**Problème** : La page fait 1685 lignes et contient deux copies du formulaire PDF, qui ont déjà divergé. La mise en page et la validation existent en 3 versions (client, serveur, utilitaire non utilisé). Le téléchargement par blob est copié 4 fois.

**Fichiers** : `src/routes/barcode/+page.svelte`, `src/lib/utils/barcode.ts`, `src/routes/api/barcode/**`

**À faire**

- Module partagé `$lib/barcode/` : format, code128, layout, validation (codes structurés) et schéma zod des options d’étiquettes.
- Composants `BarcodeStatsCard`, `CsvRangeCard`, `LabelPdfCard` (avec `LabelSettingsForm` et `PresetManager`) ; un seul état `labelOptions`.
- Enregistrer `showBorder` dans les presets.
- Trouvé pendant QA-02 : `BarcodeDialog.svelte` vide à la main des conteneurs qui contiennent aussi des blocs `{#if}` de Svelte ; l’exception ESLint `svelte/no-dom-manipulating` posée sur tout le fichier est à retirer avec la réécriture.
- Trouvé pendant DEP-02 : un bouton dans un bouton dans `src/routes/barcode/+page.svelte` (vers les lignes 902-906).
- Trouvé pendant BUG-08 : le scanner de l’application (html5-qrcode 2.3.8, ZXing-js embarqué, `findStartPattern` qui tronque ses compteurs) ne lit aucun Code 128 dès qu’un élément sombre précède les barres sur la ligne : fond sombre jusqu’au bord de l’étiquette (0/432) ou bordure d’aperçu activée (40/216), sur l’ancien PDF comme sur le nouveau, dans les navigateurs sans BarcodeDetector natif (iPhone, Firefox) ; zxing-wasm lit tout. Décidé le 2026-10-11 : traité par DEP-05. Les QR codes restent des PNG (environ 500 Ko par PDF, `QRCode.create()` permettrait des vecteurs) ; la liste des formats de page est répétée dans `api/admin/label-presets` et le client ; DK-11204 (54 mm, marge 1 mm) garde un module de 0,33 mm avec 9,3 modules de blanc au lieu de 10 ; `src/routes/barcode/+page.svelte` (vers les lignes 183-206) recopie la règle de largeur du serveur au lieu d’appeler `validateBarcodeFormat` de `$lib/utils/barcode` : la validité concorde, mais l’avertissement « sous la taille recommandée » ne tient pas compte des zones blanches de 10 modules (étiquettes d’environ 80,5 à 82,5 mm).
- Trouvé pendant DEP-05 : le scanner lit Code 128, QR, EAN-13, EAN-8, UPC-A, UPC-E, Code 39 et Data Matrix, et ramène les UPC à la valeur que donnait html5-qrcode (12 chiffres pour un UPC-A, 8 pour un UPC-E). Limites : un UPC-E hors des règles GS1 revient sous un autre code ; d’anciens scans faits avec Chrome sur Mac peuvent avoir gardé 13 chiffres pour un EAN-13 commençant par 0 ; le détecteur natif de macOS lit 12 Data Matrix sur 20 dans le banc vidéo (20/20 avec zxing-wasm) ; une caméra débranchée en plein scan n’affiche aucun message ; une CSP ajoutée plus tard devra autoriser `wasm-unsafe-eval`. Non testé sur un vrai iPhone ni sur Android.
- Trouvé pendant UI-03 : l’import CSV des préréglages d’étiquettes (`migrations.ts`) ne vérifie ni `page_format` ni `code_type` ; `labelSheetSchema` est dans `labels/pdf.ts`, côté serveur, et pourrait rejoindre `src/lib/shared/schemas/`.
- Fait en P6 (2026-10-14, a85b8cf7..4b05993e) : `src/lib/shared/barcode.ts` (ex-`utils/barcode.ts`), `src/lib/shared/labels.ts` (formats de page, grille, `checkLabelLayout`) et `src/lib/shared/schemas/label.ts` : la page et la route PDF valident avec le même code (test de parité sur 15 cas) ; page découpée en composants runes avec un seul état `LabelOptions` ; `BarcodeDialog` en runes, code-barres dessiné depuis `code128Bars` (jsbarcode retiré) ; `showBorder` enregistré dans les presets (migration 0008, prouvée sur une base 0.7.0) ; l’import de `label_presets.csv` valide chaque ligne ; QR codes du PDF en vecteurs (30 QR : 2,5 Mo → 318 Ko). Restent ouverts : la hauteur contrôlée est `labelHeight - 2*padding` alors que le PDF dessine des barres plus courtes (DK-11204 imprime des barres de 10 mm, sous le minimum de 15 mm) ; une plage hors limites ou un préfixe manuel invalide ne désactivent pas le bouton PDF (le serveur répond un 422 traduit) ; le formulaire par défaut (50 × 30 mm) est invalide dès l’ouverture.

**Critère d’acceptation** : Une seule copie du formulaire. Le client et le serveur valident avec le même code.

**Sources** : review-6-feature-pages.md#M3, review-6-feature-pages.md#M4

### UI-09 · Page stockage

Sévérité **majeur** · effort **M** · dépend de API-02 · statut **Fait**

**Suivi** (2026-10-13) : Fait en P6 (2026-10-13, 884b20a6..b2c61204 ; notes de version et action da32262e). Cases identifiées par id et rangées par `position` (migration 0007, ordre de 0.7.0 gardé, prouvé sur une base 0.7.0), dialogue de conteneur en brouillon, occupation définie une fois côté serveur, PUT du conteneur qui remplace la liste des cases ; changements visibles validés par le mainteneur.

**Problème** : Les cases sont retrouvées par leur nom reconstruit (`A1` + `1` et `A` + `11` donnent tous deux `A11`). `removeCase` supprime sur le serveur même si l’utilisateur annule ensuite. L’occupation est calculée différemment selon l’endpoint (avec ou sans les bouteilles sorties). Requêtes N+1.

**Fichiers** : `src/routes/storage/+page.svelte:97,209-463,513,700-915`, `src/routes/api/storage-occupancy`, `src/routes/api/storage-cases/[id]/capacity`

**À faire**

- Identifier les cases par id et par un champ `position`.
- Un seul `ContainerDialog` en mode brouillon, enregistré seulement à la validation.
- Une seule définition de l’occupation (côté serveur).
- Décision (2026-10-08) : supprimer une case qui contient des bouteilles disponibles est refusé (409, message clair) ; les bouteilles déjà sorties perdent seulement leur lien vers la case.
- Séparer `StorageTable` et `StorageGrid`.
- Trouvé pendant DATA-04 : la page stockage affiche un message générique pour le 409 de la suppression d’une case.
- Trouvé pendant UI-04 : `AllBottlesDialog` ne rafraîchit pas l’occupation du stockage après une modification.
- Trouvé pendant UI-02 : `storage/+page.svelte` (vers les lignes 87 et 91) trie encore avec `localeCompare` au lieu de `compareText`.
- Fait en P6 (2026-10-14, 884b20a6..b2c61204) : colonne `position` des cases (migration 0007, qui garde l’ordre affiché jusqu’à 0.7.0, prouvée sur une base 0.7.0) ; la page lit `storageOverview()` et retrouve les cases par id ; une seule occupation côté serveur (`caseLoads`, bouteilles disponibles seulement, sans N+1) ; `PUT /api/storage-containers/{id}` remplace la liste des cases en une transaction (409 `case_holds_bottles` qui nomme la case) ; `ContainerDialog` en brouillon (Annuler n’envoie rien) ; `StorageTable`, `StorageGrid` et `AllBottlesDialog` en runes ; positions gardées par les exports et imports JSON et CSV. Restent ouverts : des cases ajoutées par un CSV à un conteneur existant prennent la position 0 ; le serveur reconstruit le nom des cases (conteneur + suffixe), donc enregistrer renomme une case importée nommée autrement ; un brouillon ouvert longtemps supprime une case vide créée entre-temps (envoyer `updatedAt` et répondre 409) ; une capacité vidée devient 5 ; si le seul conteneur n’a plus de case, la page affiche « aucune donnée » sans bouton d’édition ni de suppression ; l’import CSV identifie les cases par leur nom (`csv-import/tables.ts`), donc deux « A11 » de conteneurs différents se confondent ; `/api/storage-occupancy` n’a plus d’appelant et `DELETE /api/storage-cases/{id}` non plus (gardés jusqu’à l’audit d’avant 1.0).

**Critère d’acceptation** : Annuler une édition ne modifie rien. L’occupation est la même partout.

**Sources** : review-6-feature-pages.md#M6, review-6-feature-pages.md#M7

### UI-10 · Accessibilité et textes en dur

Sévérité **mineur** · effort **M** · dépend de UI-02 · statut **Fait**

**Suivi** (2026-10-17) : Mergé d45670a4..cf40a3a4 (44 commits), résumé 0.8.0 25009393, CI verte. Paraglide remplace svelte-i18n, axe 0 violation, 974 tests. Le mainteneur a validé le merge avec l'exception des 7 jours (e7b049ab, Paraglide 2.27.0 et @inlang/sdk 4.0.0). Exception retirée le 2026-10-16 après 23:07 UTC (0b8318d0) : install --frozen-lockfile et résolution neuve sans lockfile acceptées par la règle des 7 jours, mêmes versions, 976 tests, CI verte.

**Problème** : 0 `aria-label` sur les boutons à icône seule. Le modal de connexion est fait main (sans piège de focus ni fermeture par Échap). Les en-têtes de tri ne sont pas accessibles au clavier, et `min-w-[800px]` casse l’affichage mobile. Il reste de nombreux textes en anglais en dur.

**Fichiers** : `src/routes/+layout.svelte:211-262`, `src/lib/components/**`, `src/routes/**`

**À faire**

- Ajouter des `aria-label` traduits.
- Utiliser le `Dialog` de bits-ui pour la connexion.
- Supprimer le flash du thème avec un script inline dans `app.html`.
- Traduire les textes en dur listés dans les rapports.
- Trouvé pendant SEC-02 : `?login` reste dans l’URL après la connexion, et une action dont la requête reçoit 401 peut afficher son toast d’erreur à côté du dialogue de connexion.
- Trouvé pendant QA-03 : `storage/+page.svelte` affiche en dur « Showing … containers » et « Bottles (x% full) » alors que `storage.showing_containers`, `storage.showing_containers_of` et `storage.bottles_full` existent (les seules clés inutilisées de `pnpm i18n:check`). Pluriels à l’anglaise en français avec `{plural}` (« 2 image(s) supprimée(s) », badge « 5 importé » de `CsvImportResultsDialog`) : passer aux pluriels ICU. Titres composés de deux clés (`WineTypeDialog` : `admin.edit` + `admin.wine_types`) ; erreurs d’API en anglais affichées telles quelles par `result.error || $_(…)` ; majuscules à l’anglaise dans fr.json (« Effacer Tout ») ; `ui.*` sert de fourre-tout à des clés du code-barres et de l’admin. Une fois UI-01 et UI-10 faits, faire échouer `pnpm i18n:check` sur les clés inutilisées.
- Trouvé pendant DEP-02 : textes anglais en dur dans l’interface française : `SearchableSelect.svelte` (vers les lignes 390, 413, 428), `BackupNamingDialog.svelte:102` et `WineBottleDialog.svelte:800` ; deux onglets de l’admin portent le même libellé (`DataManagementTabs.svelte`, vers les lignes 220 et 242).
- Trouvé pendant BUG-01 : textes anglais en dur dans `src/routes/barcode/+page.svelte` (« to », « Preview: », avertissements de taille d’étiquette, aide de l’export). Trouvé pendant BUG-07 : en changeant de caméra sous Firefox ou Safari, un refus d’autorisation affiche l’erreur générique au lieu du message d’autorisation (`QrScannerDialog.svelte`).
- Trouvé pendant BUG-05/DOC-01 : à 390 px, la barre de navigation (`div.flex.items-center.space-x-4`) élargit la page à 1080 px ; la ligne de prix des cartes de vins coupe la moyenne sur les cartes étroites ; « N/A » en dur dans la liste de résultats de la page codes-barres ; sur une adresse `http://` du réseau local, le scanner affiche l’erreur générique au lieu de dire que la caméra exige HTTPS ; l’aide du dialogue de connexion (`en.json`, vers la ligne 48) ne cite que `docker compose logs` pour le jeton d’installation, pas le terminal de `pnpm dev`.
- Décision du 2026-10-12 (svelte-i18n) : remplacer svelte-i18n, plus maintenu, par une bibliothèque i18n suivie (par exemple Paraglide), avec la vérification des clés de QA-03 ; cela retire aussi esbuild 0.19.
- Trouvé pendant DATA-01/DATA-05 : les messages d’erreur de la restauration, en anglais, s’affichent tels quels dans le toast ; `BackupSettingsDialog` garde des textes anglais en dur.
- Trouvé pendant API-04 : les messages par ligne du dialogue des résultats de l’import CSV restent en anglais. Trouvé pendant API-05 : après un 404, le toast dit « This item no longer exists. Reload the page. » alors que la page se recharge seule ; à 1280 px, les boutons d’édition par bouteille de la page d’un vin débordent de leur carte.
- Retour du mainteneur (2026-10-13, après la mise à jour vers 0.6.0 chez un utilisateur) : dans la carte des actions de mise à jour de l’admin (`UpgradeBanner.svelte`), on ne voit pas les cases à cocher, on les trouve en cliquant au hasard. Le bord de la `Checkbox` shadcn utilise `--input` (`oklch(0.9 …)` sur fond clair, `oklch(0.25 …)` sur fond sombre), trop proche du fond : donner aux cases un contraste d’au moins 3:1 (WCAG 1.4.11) partout où `Checkbox` sert, et vérifier les deux thèmes.
- Décision du 2026-10-13 (bibliothèque) : Paraglide JS 2.27.0 en version exacte (installable à partir du 2026-10-16 à 23:07 UTC, avec `@inlang/sdk` 4.0.0), plugin `@inlang/plugin-icu1` 1.1.0 chargé par un chemin local dans `project.inlang/settings.json` (jamais l’URL jsDelivr), sans `@inlang/cli` (qui tire esbuild-wasm 0.19). JSON à plat avec ICU, clés à point (`m['admin.edit']()`), test unitaire des pluriels français dont `=0`. Langue dans un cookie (stratégie cookie, puis langue du navigateur, puis anglais), rendu serveur dans cette langue ; la préférence `wine-cellar-locale` du localStorage est abandonnée, avec une ligne dans les notes de version. C’est la première étape d’UI-10, avant les textes en dur et les pluriels. `scripts/check-i18n.mjs` reste, plus court : clés d’une seule langue, doublons, clés inutilisées bloquantes, textes en dur. Comparatif : scratchpad de la session P6 (`i18n-research/`).
- Trouvé pendant UI-01 : `DYNAMIC_KEYS` de `scripts/check-i18n.mjs` ne liste pas `errors.export_refused_*` (4 clés) ni `errors.invalid_export_*` (5), utilisées par `apiErrorMessage` : le script les dit inutilisées ; les clés `storage.*` restent pour remplacer les textes en dur de la page stockage. Trouvé pendant UI-03 : `ZipImportResultsDialog.svelte` (vers les lignes 110-116) affiche la raison `invalid_filename` sans traduction. Trouvé pendant UI-04 : le rendu serveur est toujours en anglais (réglé par le cookie de langue) ; un chemin SVG malformé provoque des erreurs dans la console (déjà sur develop).
- Trouvé pendant UI-02 : les helpers de `format.ts` lisent la langue avec `get()` et ne se recalculent pas quand elle change (sans effet visible tant que changer de langue recharge les textes ; à régler avec Paraglide, via `currentLocale()` seul) ; `admin.showing_bottles` bricole encore son pluriel avec `plural: 's'`.
- Trouvé pendant UI-05, UI-08 et UI-09 : textes en dur dans `SearchableSelect` (« Clear selection », « + Add new item... », « Cancel », « Enter new item name », « + Add "x" as new item ») et dans `WineListView` (« No Image », dont les `Label for` ne visent aucun `id`) ; suffixe « - My Wine Cellar » du `<title>` de `wines/[id]` ; « Code-Barre » et « code-barres » à harmoniser ; le titre d’`AllBottlesDialog` affiche « Toutes », car `storage.all_bottles` sert aussi d’option de filtre.
- Trouvé pendant UI-06 et UI-07 : toutes les pages débordent horizontalement à 390 px (857 px de large), à cause de la barre de navigation ; sur `/wines/[id]` à 1280 px, les cartes de bouteilles recouvrent le bouton Edit de la carte voisine ; une erreur côté client affiche la page « 500 … check the server logs » en anglais ; le guide de l’import CSV est en anglais ; `toast.image_file_too_large` et `wine_form.image_hint` écrivent « 20 MB » en dur ; les textes d’exemple des champs (« Château Margaux », « 2020 », « 12 ») ont presque la couleur d’une valeur saisie, et on peut les prendre pour des données déjà remplies.
- Fait en P6 (2026-10-16, d45670a4..cf40a3a4, 44 commits, résumé 0.8.0 25009393) : Paraglide JS 2.27.0 remplace svelte-i18n (cookie `cellar_locale`, stratégie cookie puis langue du navigateur puis anglais, `paraglideMiddleware` dans `hooks.server.ts`, `<html lang>` et rendu serveur dans la langue de la requête ; `src/lib/i18n/index.ts` supprimé, `getLocale()` partout, tables de messages écrites en entier à la place des clés construites). `scripts/check-i18n.mjs` lit `m['…']` et refuse clés manquantes, doublons, clés d’une seule langue ou inutilisées, pluriels faits main et textes en dur (texte entre balises, attributs lus, littéraux affichés, toasts) ; `DYNAMIC_KEYS` disparaît. Dialogue de connexion en `Dialog` bits-ui (`LoginDialog.svelte`), toute réponse 401 l’ouvre sauf la déconnexion ; navigation dans un menu sous 1280 px ; thème appliqué avant le premier affichage ; bordure des cases à cocher à 5,9-6,5:1 ; exemples des champs en italique ; `aria-label` traduits ; page d’erreur neutre ; « 20 Mo » lu de `MAX_WINE_IMAGE_BYTES` ; pluriels ICU partout ; `fr.json` en casse de phrase ; l’import CSV renvoie des codes par ligne (`problems`, `reason.code`). Preuves : axe-core 4.14.0 sur 13 pages et le dialogue de connexion, clair et sombre, de 2 critiques, 14 sérieuses et 14 modérées à 0, aussi en français et dialogues ouverts ; « Hardcoded text: 0 » ; débordement à 390 px de 857 px à 0 ; bundle client −2 Ko gzip ; 974 tests. Les points de « À faire » ci-dessus sont corrigés, sauf `errors.not_found` (pas de rechargement automatique reproduit).
- Reste après UI-10 (pour l’audit d’avant 1.0) : en thème clair après un passage en sombre, `themeVariables` (`utils/theme-colors.ts`) ne redéfinit pas `--secondary-foreground` ni `--accent-foreground` jusqu’au rechargement ; les bordures des champs de texte (`--input`, environ 1,3:1) ; deux `h1` par page (logo et titre) ; le bouton « Connexion » s’affiche au premier rendu serveur même connecté, jusqu’à `auth.init()` ; `errors.invalid_export_invalid_row` insère le `{reason}` anglais du serveur ; `admin.supported_formats_list` cite encore BMP (contre SEC-06) ; « Casier » contre « case » dans les `errors.*`, placeholders `search_*` télégraphiques, clés `ui.*` fourre-tout ; à 390 px, l’exemple du champ code-barres de `/wines` est coupé (« Saisissez le ») ; pas de `Vary: Cookie, Accept-Language` sur les pages rendues selon la langue ; `check:watch` ne compile les messages qu’une fois ; l’erreur « pas un CSV » de l’import reste générique ; le premier `prepare` du build Docker affiche un ENOENT sur `project.inlang` (absorbé).

**Critère d’acceptation** : Un audit axe sur les pages principales ne remonte aucune violation critique, et le script i18n ne détecte plus de textes en dur.

**Sources** : review-4-admin-frontend.md#m7, review-5-core-ui.md#Mineur, review-6-feature-pages.md#Mineur

## P7 · Corrections d’avant 1.0 (1.0.0)

Corriger ce que l’audit d’avant 1.0 (`reviews/audit-pre-1.0/`) juge bloquant : aucune donnée perdue ou faussée sans message, des notes de version justes, un numéro de version fiable pour develop et un contrat d’API figé. Publiée en 0.9.0.

### REL-03 · Numéro de version de develop entre deux tags

Sévérité **mineur** · effort **S** · statut **Fait**

**Suivi** (2026-10-17) : 238c0964..244420ac (develop 0.9.0-rc.0, RELEASING : numéro de develop et règle 1.x ; upgradeSteps accepte une version de départ dont l’entrée a été renommée). CI verte.

**Problème** : Pendant P6, un build de develop se déclarait 0.7.0 alors qu’il avait déjà les migrations 0007 et 0008 : revenir à 0.7.0 n’était pas refusé, alors que 0.7.0 écrit ensuite dans un schéma qu’il ne connaît pas, et le bandeau ne montrait pas les actions de la version suivante. Develop est aujourd’hui exactement 0.8.0, mais le défaut revient dès la première migration de P7. Le serveur d’un ami, construit depuis git, est concerné. `RELEASING.md` ne décrit que la règle des versions 0.x.

**Fichiers** : `package.json`, `releases.json`, `RELEASING.md`, `src/lib/server/releases.js:7,77-85`, `src/lib/server/upgrade.ts:133`

**À faire**

- À faire en premier dans P7, avant tout merge qui ajoute une migration.
- Passer develop à `0.9.0-rc.0`, avec l’entrée provisoire de 0.9.0 dans `releases.json`, que `findRelease` exige. `compareVersions('0.9.0-rc.0', '0.8.0')` vaut 1, et `VERSION_PATTERN` accepte `-rc.0`.
- Écrire dans `RELEASING.md` qu’après chaque tag, rc ou final, develop passe au numéro de rc suivant : 0.9.0-rc.2 après 0.9.0-rc.1, 0.10.0-rc.0 après 0.9.0.
- Écrire dans `RELEASING.md` la règle 1.x de la décision « Versions après 0.8.0 (REL-01) », à côté de la règle 0.x, qui reste valable jusqu’à la 1.0.
- Fait en P7 (2026-10-17, 238c0964..244420ac) : develop passe à `0.9.0-rc.0`, entrée 0.9.0 de `releases.json` ; `RELEASING.md` décrit la règle 1.x et la section « Version of develop » : après chaque tag, un commit `chore(release): start …` séparé, une fois le workflow de release passé et avant tout autre merge, passe develop au rc suivant ; le numéro de develop est un plancher (une entrée peut être renommée vers le haut, jamais vers le bas). Trouvé par la revue : `upgradeSteps` exigeait une entrée pour la version de départ, donc une base en `0.10.0-rc.0` aurait bloqué le démarrage si l’entrée devenait 1.0.0 ; corrigé (seule la version lancée a besoin d’une entrée), avec un test. Preuve : une base ouverte par le build 0.9.0-rc.0 fait refuser le démarrage de 0.8.0 (sortie 1, message de REL-02) ; 0.8.0 démarre sur une base neuve.
- Trouvé pendant REL-03 : `src/routes/api/admin/upgrade-actions/server.test.ts:34` prend `0.9.0` comme exemple de version absente (prendre `99.0.0`) ; depuis le correctif d’`upgradeSteps`, une sauvegarde qui porte une version bien formée jamais publiée et plus ancienne (par exemple 0.7.5) est acceptée et traitée par ordre de version au lieu d’être refusée en `unknown_version` ; la version n’est affichée que dans Préférences, pas dans l’admin.

**Critère d’acceptation** : Un build de develop se déclare 0.9.0-rc.0 : relancer 0.8.0 sur une base qu’il a ouverte est refusé avec le message de REL-02. `RELEASING.md` décrit la numérotation de develop et la règle 1.x.

**Sources** : audit-pre-1.0/axe-7-infra.md#m22, audit-pre-1.0/axe-7-infra.md#À faire avant 1.0.0, Décision « Versions après 0.8.0 (REL-01) »

### BUG-13 · Une note masquée écrase les notes des bouteilles

Sévérité **majeur** · effort **XS** · statut **Fait**

**Suivi** (2026-10-17) : 244420ac..b84dc44f (newStatus n’envoie la note qu’avec « Consommée » ; preuve Chromium sur hors cave, page vin et BottleDetailsDialog). CI verte.

**Problème** : Dans le dialogue de changement de statut, une note tapée sous « Consommée » reste envoyée après le passage à un autre statut, où le champ est masqué. Elle remplace alors les notes de toutes les bouteilles sélectionnées, sans message. Le défaut existe depuis 556c7bb, dans le hors cave, la page vin et `BottleDetailsDialog`.

**Fichiers** : `src/lib/utils/bottle-changes.ts:18`, `src/routes/out-of-cellar/+page.svelte:85`, `src/lib/components/BottleDetailsDialog.svelte:164`, `src/routes/wines/[id]/+page.svelte:175`, `src/lib/components/BulkBarcodeDialog.svelte:270-274`

**À faire**

- Dans `newStatus`, n’envoyer la note que pour `CONSUMED` : cela couvre les trois appelants.
- Test dans un `bottle-changes.test.ts` : avec un autre statut, la note n’est pas envoyée.
- Retirer la garde locale `consuming ? consumedNote : ''` de `BulkBarcodeDialog`, devenue inutile.
- Une phrase dans le résumé 0.9.0.
- Fait en P7 (2026-10-17, 244420ac..b84dc44f) : `newStatus` n’envoie la date et la note qu’avec `CONSUMED`, ce qui couvre le hors cave, la page vin et `BottleDetailsDialog` ; garde locale de `BulkBarcodeDialog` retirée ; `bottle-changes.test.ts` (2 tests sur 4 échouent avant). Preuve Chromium sur les trois écrans : avant, le PATCH portait la note masquée et écrasait les notes ; après, `{ availability }` seul et les notes restent ; consommer avec une note l’enregistre toujours.
- Trouvé pendant BUG-13 : sur la page vin, le `catch` de `confirmConsumption` ne prévient pas l’utilisateur (« You could show a toast notification here ») : un échec réseau est silencieux. Une note tapée en consommant remplace les notes existantes des bouteilles sélectionnées : décision du mainteneur, elle s’y ajoutera (tâche BUG-17).

**Critère d’acceptation** : Dans le hors cave, la page vin et `BottleDetailsDialog` : taper une note sous « Consommée », passer à « Disponible », confirmer → les notes existantes des bouteilles sont intactes. Le test échoue avant la correction.

**Sources** : audit-pre-1.0/axe-6-pages.md#M2

### BUG-14 · Champs numériques lus par Cellar

Sévérité **majeur** · effort **S** · statut **Fait**

**Suivi** (2026-10-17) : 84da5930..45cc39a5 puis d6694ec8..4e2c53f0 (readNumber : « 12,5 » et « 12.5 », refus de « 1e » ; champs texte inputmode=decimal ; NumberInput ; suite : nombres affichés dans la langue, messages qui disent quel nombre est attendu, capacité vide refusée par le dialogue). CI verte.

**Problème** : Les champs numériques des formulaires sont des `<input type="number">`, que le navigateur lit selon sa propre langue, pas celle de Cellar. Dans un Chrome anglais, « 12,5 » devient 125 ; « 1e » envoie un champ vide et efface le prix. Les deux s’enregistrent sans erreur. Même défaut pour le millésime, la note, la quantité et la quantité cible, et pour les mesures en millimètres du formulaire d’étiquettes.

**Fichiers** : `src/lib/components/forms/WineBottleForm.svelte:193-203`, `src/lib/components/forms/WineDefinitionForm.svelte:182-209`, `src/lib/components/barcode/LabelSettingsForm.svelte`, `src/lib/shared/schemas/form.ts:20-35`

**À faire**

- Décision « Formulaires de vin et de bouteille (UI-06) » : `type="text" inputmode="decimal"` sur ces champs, pour garder le clavier numérique sur téléphone. Vérifier aussi les autres `type="number"` (admin, stockage, filtres de la liste) et leur appliquer la même lecture là où une saisie peut se perdre.
- `formNumbers` lit « 12,5 » et « 12.5 » comme 12,5 avec un motif strict (chiffres, un seul séparateur), garde le vide comme NULL, et transmet tout autre texte pour que le schéma le refuse avec un message, comme son commentaire le promet déjà (l. 21-22). `Number()` seul accepterait « 1e3 », « 0x10 » ou « Infinity ».
- Le `type="text"` seul ferait refuser « 12,5 » aux Chrome français, qui marchent aujourd’hui : les deux changements partent ensemble.
- Tests de `formNumbers` : virgule, point, vide, « 1e », « 1- », « 1e3 », « 0x10 », « Infinity ».
- DATA-09 touche le même schéma (millésime 0) : merger l’une après l’autre.
- Fait en P7 (2026-10-17, 84da5930..45cc39a5) : `readNumber` (`schemas/form.ts`) lit chiffres, un séparateur point ou virgule et un signe moins ; vide → NULL ; tout autre texte (« 1e », « 1e3 », « 0x10 », « Infinity », un nombre qui déborde en Infinity) est transmis pour que le schéma le refuse. Champs des formulaires de vin et de bouteille en `type="text" inputmode="decimal"` ; composant `ui/NumberInput.svelte` pour les mesures du formulaire d’étiquettes et la capacité des cases (avant : « 1e » enregistrait une capacité de 5 sans rien dire). Restent en `type="number"` : réglages de l’admin (le serveur refuse null en 422), numéro de départ et nombre d’étiquettes, export CSV, nombre de cases, filtres. Preuve Chromium en-US et fr-FR (avec `--lang`) : avant 125 et prix effacé ; après 12,5 et erreur sous le champ.
- Fait en P7, suite (2026-10-17, d6694ec8..4e2c53f0), à la demande du mainteneur : les champs affichent les nombres dans la langue de l’interface (« 12,5 », « 66,675 » en français ; c’était une régression de la première version), par `formatInputNumber` ; le message sous un champ numérique dit quel nombre est attendu et sa plage, lue dans le schéma zod (« Saisissez un nombre entier entre 0 et 9 999. »), avec les nombres au format de la langue (`formatNumber`) ; le dialogue de conteneur refuse une capacité vide ou non entière (« Indiquez un nombre entier de bouteilles entre 1 et 1 000. ») sans rien envoyer, l’API gardant « capacité absente = 5 » pour les scripts.
- Trouvé pendant BUG-14 : à 390 px, le dialogue de bouteille ne fait pas défiler jusqu’au premier champ en erreur (`form-action.svelte.ts`) ; dans `ContainerDialog`, une erreur du serveur ne s’affiche que dans un toast générique ; `bottle_form.places_used` n’écrit pas ses nombres au format de la langue ; `ui/NumberInput.svelte` est un composant maison à la racine de `ui/`, qui ne contient sinon que les primitives shadcn ; la décision UI-06 « Prix et valeurs valent 0 au moins » n’est pas appliquée : `amount` (`schemas/bottle.ts`) accepte un nombre négatif. Rejeté en revue : écrire les bornes avec `{max, number}` d’ICU plutôt que `formatNumber` (six messages par langue), à reconsidérer.

**Critère d’acceptation** : Chrome en-US, app en français : « 12,5 » dans « Prix d’achat » enregistre 12,5 ; « 1e » affiche une erreur sous le champ et laisse le prix inchangé. Chrome fr-FR donne le même résultat.

**Sources** : audit-pre-1.0/axe-5-interface.md#M1, Décision « Formulaires de vin et de bouteille (UI-06) »

### BUG-15 · Import CSV : deux vins qui ne diffèrent que par le type sont fondus

Sévérité **majeur** · effort **S** · statut **Fait**

**Suivi** (2026-10-17) : b84dc44f..84da5930 (typeName dans la clé du vin et dans l’export des bouteilles ; several_wines pour les vins indiscernables ; aller-retour A→B prouvé). CI verte.

**Problème** : La clé d’un vin à l’import CSV n’a pas le type. Deux fiches qui ne diffèrent que par le type, la note, la description ou l’image donnent un seul vin : le second est signalé « Déjà dans la cave », même dans une cave vide, et ses bouteilles sont rattachées au premier sans message. La règle d’API-04 (« les homonymes sont signalés ») est cassée.

**Fichiers** : `src/lib/server/features/csv-import/referenceIndex.ts:14,77-78,93-103`, `src/lib/server/features/csv-import/pipeline.ts:120-124`, `src/lib/server/features/backup/repository.ts (export des bouteilles)`, `src/lib/server/features/csv-import/round-trip.test.ts`

**À faire**

- Ajouter le type (`typeName`) à la clé du vin. Il est déjà exporté pour les vins : l’ajouter à l’export des bouteilles.
- Garder dans l’index tous les vins d’une clé, et répondre `several_wines` quand il y en a plus d’un.
- Les fichiers de bouteilles exportés avant ce changement passent par le chemin « ancien fichier » (`referenceIndex.ts:98-103`) et signalent `several_wines`, ce que permet la décision « Import CSV (API-04) ».
- Test aller-retour : deux vins identiques sauf le type, exportés puis importés dans une cave vide.
- Une phrase dans le résumé 0.9.0 pour la colonne ajoutée (décision « Petits choix »).
- Fait en P7 (2026-10-17, b84dc44f..84da5930) : `typeName` dans la clé du vin (`WINE_KEY`) et dans l’export des bouteilles ; `wineOfBottle()` répond `several_wines` dès que plusieurs vins correspondent ; `recordWineRow()` retient les lignes distinctes des fichiers de vins d’un import (sans tenir compte de l’ordre des colonnes, de la casse ni des colonnes vides), pour signaler les bouteilles des vins qui ne diffèrent que par la note, la description ou l’image ; un export de bouteilles d’avant 0.9.0, sans `typeName`, reste lisible ; un fichier fait main garde la règle « colonne vide = n’importe quel vin », sauf pour les quatre colonnes que tout export écrit, quand le fichier les a toutes. Message `several_wines` reformulé, guide CSV à jour. 8 tests, dont 4 échouent avant. Preuve sur deux serveurs : avant, un seul vin à 5 bouteilles ; après, Champagne 2 et Mousseux 3, et les bouteilles des vins jumeaux par la note sont signalées.
- Trouvé pendant BUG-15 : `pipeline.ts` (`importRow`) saute en `same_name` une ligne de vin dont la clé existe avant de la valider : une ligne invalide (note « abc ») est annoncée « Déjà dans la cave ». Limite, que le mainteneur a choisi de traiter à part (tâche BUG-18) : des vins qui ne diffèrent que par la note ou la description, importés en deux fois (les vins, puis les bouteilles), donnent leurs bouteilles au premier vin sans message. Accepté par le mainteneur : avec un en-tête complet fait main, un `regionName` qui contredit la cave donne « vin inconnu ».

**Critère d’acceptation** : Cave A avec deux vins identiques sauf le type (« Champagne », 2 bouteilles ; « Mousseux », 3 bouteilles) ; export, puis import dans une cave B vide → deux vins, avec 2 et 3 bouteilles. Deux vins qui ne diffèrent que par la note ou la description font signaler leurs bouteilles en `several_wines`, au lieu de les rattacher en silence. Le test échoue avant la correction.

**Sources** : audit-pre-1.0/axe-3-api-admin.md#M3

### DATA-08 · Restaurer une sauvegarde par son nom, et recevoir un zip en flux

Sévérité **majeur** · effort **M** · statut **Fait**

**Suivi** (2026-10-17) : 6d4e5d5c..06388c6e (restauration et import par nom `{filename}` lus sur place ; envoi en corps brut application/zip écrit en flux, 413 avant et pendant ; paraglideMiddleware sans corps ; sauvegarde de 648 Mo restaurée ; RSS +63..74 Mio pour 216 Mo au lieu de ×5,3 ; pas de NODE_OPTIONS : −8 à −15 % de débit permanent). CI verte.

**Problème** : Cellar crée sans avertir des sauvegardes de plus de 500 Mo (environ 120 photos de téléphone suffisent), mais ne peut pas les restaurer : depuis la liste, la page télécharge le zip dans le navigateur puis le renvoie, et le serveur refuse tout envoi de plus de 500 Mo (413). Sous cette limite, restaurer ou importer un zip occupe environ cinq fois sa taille en mémoire (`formData()`, puis `arrayBuffer()`) : 1 Go de plus pour 200 Mo, de quoi faire tuer le conteneur sur un NAS de 2 Go.

**Fichiers** : `src/routes/admin/backups/+page.svelte:144-151`, `src/routes/api/admin/restore/`, `src/routes/api/admin/import-json/`, `src/lib/server/features/backup/service.ts:252,264`, `src/lib/server/features/backup/json-import.ts:57`, `src/lib/server/features/backup/files.ts (resolveBackupFile)`, `src/lib/server/http/body.ts:90-93`, `src/lib/server/zip.ts:8`

**À faire**

- Décision « Taille des requêtes (SEC-07) » : une sauvegarde de la liste se restaure, ou s’importe, côté serveur par son nom (`resolveBackupFile`, puis extraction sur place), sans envoi ni limite de taille du zip ; par exemple `POST /api/admin/restore` et `import-json` avec `{ "name": … }` en JSON. Les limites d’extraction contre les zips piégés (taille décompressée, nombre d’entrées) restent. Cela règle aussi UI-07/Reste-3.
- Un fichier choisi sur le disque est envoyé en corps brut (`application/zip`) et écrit sur disque en flux (`pipeline(Readable.fromWeb(request.body), createWriteStream(tempFile))`). La limite de 500 Mo ne vise plus que ces envois : 413 sur `Content-Length` avant la lecture, et aussi pendant l’écriture, pour un envoi sans `Content-Length` (fichier temporaire supprimé).
- Même chose pour l’import JSON.
- Pour les scripts : une phrase dans le résumé 0.9.0 sur le nouveau corps de `POST /api/admin/restore` et `import-json`, sans action de mise à jour.
- Fait en P7 (2026-10-17, 6d4e5d5c..06388c6e) : `POST /api/admin/restore` et `import-json` prennent soit `{ "filename": … }` en JSON (même champ que `delete-backup`, schéma partagé `backupFileRequest` ; la sauvegarde est lue sur place, sans limite de 500 Mo, et reste dans la liste), soit le zip en corps brut `application/zip`, écrit sur disque en flux (`limitedBody`, `parseZipRequest`) ; tout autre type, dont l’ancien formulaire, reçoit 400. 413 avant la lecture d’après `Content-Length`, et pendant l’écriture sans lui, sans couper la connexion (le corps n’est plus annulé : adapter-node coupait la connexion et le client ne voyait pas le 413, défaut qui touchait aussi le JSON) ; corps interrompu → 400. `hooks.server.ts` donne à `paraglideMiddleware` une requête sans corps : son `request.clone()` gardait tout envoi en mémoire. `no_file` et `not_zip` retirés. La page des sauvegardes envoie le nom (règle UI-07/Reste-3) ou le fichier brut. Preuves : sauvegarde de 648 Mo restaurée depuis la liste (develop : refusée) ; mémoire (RSS) pour un zip de 216 Mo : +1 084 à +1 104 Mio sur develop, +63 à +74 Mio dans l’image de la branche ; 11 échecs laissent la base et le dossier de données identiques.
- Décision du mainteneur pendant DATA-08 : pas de `NODE_OPTIONS=--max-semi-space-size` dans l’image. Mesuré dans l’image (300 vins, 2 100 bouteilles, deux séries entrelacées) : à 1, 124 Mio au repos et presque aucune hausse pendant une restauration, mais −15 % de débit sur toutes les requêtes ; à 4, 130 Mio et +22 Mio, mais −8 % ; sans réglage, 232 Mio et +63 à +74 Mio, sans ralentissement. Un ralentissement permanent des pages n’est pas accepté, et le critère est tenu sans réglage.
- Trouvé pendant DATA-08 : les limites d’extraction de `src/lib/server/zip.ts` (2 Gio décompressés, 10 000 entrées) s’appliquent aussi à une restauration par nom, alors que la création d’une sauvegarde ne prévient pas quand elle les dépasse ; après une restauration, la page télécharge la sauvegarde de sécurité en `response.blob()` (641 Mo en mémoire dans le navigateur, bouton « Restoring… » pendant ce temps : `src/lib/utils/download.ts:22`, `savePreviousData`) ; `json-import.ts` (`readExport`) rend une erreur disque en 422 « unreadable » (R3-m16) ; `GET /api/admin/download-backup` désigne encore le fichier par `?file=` (T9).

**Critère d’acceptation** : Une sauvegarde de 600 Mo créée par Cellar se restaure depuis la liste. Restaurer ou importer en JSON un fichier de 200 Mo choisi sur le disque fait monter la mémoire du serveur (RSS) de moins de la moitié de sa taille, mesuré avant et pendant (aujourd’hui environ cinq fois sa taille). Une restauration qui échoue laisse la base inchangée.

**Sources** : audit-pre-1.0/axe-3-api-admin.md#M1, audit-pre-1.0/axe-3-api-admin.md#M2, Décision « Taille des requêtes (SEC-07) »

### DATA-09 · Millésime 0 lu comme « sans millésime »

Sévérité **majeur** · effort **S** · dépend de REL-03 · statut **Fait**

**Suivi** (2026-10-18) : 11e22ce2..3bbac9b4 (migration 0010 : millésime 0 → NULL ; un 0 envoyé par formulaire, API ou CSV est enregistré sans millésime ; preuve sur une base 0.8.0 : plus aucun « 0 » affiché). CI verte.

**Problème** : Jusqu’à la 0.6.0, l’import CSV écrivait 0 pour un millésime vide, et aucune migration ne l’a converti. La moitié de l’interface lit ce 0 comme « sans millésime » (filtre, page vin), l’autre comme l’an 0 : « Millésime : 0-2018 » sur les cartes, ces vins en tête du tri « plus ancien », décennie « Années 0 » dans les statistiques, « Château X 0 » dans l’admin et sur les étiquettes, « 0 » dans l’export CSV.

**Fichiers** : `src/lib/shared/schemas/bottle.ts:7-16`, `drizzle/`, `src/lib/server/features/csv-import/`, `src/lib/utils/wine-group-sort.ts:31,56`, `src/lib/server/features/bottles/repository.ts:346,358`

**À faire**

- Décision « Millésime 0 (audit d’avant 1.0) » : migration `UPDATE wine_bottles SET vintage = NULL WHERE vintage = 0`, comme 0006 l’a fait pour la note 0. Tous les écrans traitent déjà NULL comme « sans millésime ».
- Le schéma de la bouteille enregistre un millésime 0 comme NULL, sans erreur (seulement le millésime : le schéma `year` sert aussi à `optimum`), pour le formulaire, l’API et l’import CSV, où d’anciens exports contiennent des 0. Mettre à jour le commentaire de `bottle.ts:7-8`.
- Tests : la migration sur une base qui contient des 0 ; un POST, une form action et une ligne CSV au millésime 0 enregistrent NULL.
- Une phrase dans le résumé 0.9.0, sans action de mise à jour.
- BUG-14 touche le même schéma et BUG-16 ajoute aussi une migration : merger l’une après l’autre, après REL-03.
- Fait en P7 (2026-10-18, 11e22ce2..3bbac9b4) : migration 0010 `UPDATE wine_bottles SET vintage = NULL WHERE vintage = 0` (l’optimum n’est pas touché ; une sauvegarde 0.8.0 restaurée passe aussi par elle) ; le schéma `vintage` enregistre un 0 comme NULL pour l’API (POST, PATCH), les form actions et les imports CSV et JSON ; `docs/API.md` à jour. Tests qui échouent avant : migration, POST, form actions, ligne CSV. Preuve sur une base créée par 0.8.0 avec 6 bouteilles au millésime 0 (API et CSV), mise à jour en place : cartes, tri « plus ancien », statistiques, historique, admin, export CSV et CSV d’étiquettes sans aucun « 0 » ; le filtre « Sans millésime » les trouve.
- Trouvé pendant DATA-09 : les tests de millésime « faux » (`!vintage`, `||`) de `wine-filters.ts:46,50`, `out-of-cellar/+page.svelte:247,255` et `wines/[id]/+page.svelte:474,678` ne servent plus ; le PDF d’étiquettes n’imprime que le code, les « étiquettes » du critère étaient les CSV pour logiciel d’étiquettes.

**Critère d’acceptation** : Une base qui contient des bouteilles au millésime 0, mise à jour : plus aucun « 0 » affiché (cartes, tri, statistiques, historique, admin, export CSV, étiquettes), et le filtre « Sans millésime » les trouve. Enregistrer une bouteille au millésime 0 donne une bouteille sans millésime.

**Sources** : audit-pre-1.0/axe-1-donnees.md#M1, Décision « Millésime 0 (audit d’avant 1.0) »

### BUG-16 · Préréglages d’étiquettes livrés faux

Sévérité **majeur** · effort **S** · dépend de REL-03 · statut **Fait**

**Suivi** (2026-10-17) : 45cc39a5..fc2b1aca, d6694ec8, 4e2c53f0..6d4e5d5c (Avery d’après les gabarits, 5 préréglages étroits en QR, migration 0009 limitée aux préréglages non modifiés, refus 422, copie obsolète du CSV remplacée ; suites : bouton grisé avec la raison, mise en page par défaut 56 mm imprimable, avertissements à part, message sous chaque champ). CI verte.

**Problème** : Les préréglages Avery livrés ont 2 mm d’espacement vertical : 27 étiquettes au lieu de 30 sur une planche 5160, jusqu’à 15 mm hors des découpes ; 5161, 5163 et 5164 perdent aussi des étiquettes, et 5162 a une marge haute fausse. Cinq autres préréglages, trop étroits pour un code-barres, sont refusés par le PDF quoi qu’on règle. L’API des préréglages enregistre aussi des mises en page que le PDF refuse. Le défaut existe depuis 0.1.0, et chaque installation a ces préréglages en base.

**Fichiers** : `scripts/data/label_presets.csv:2-7,13,16,20,24,25`, `src/lib/shared/labels.test.ts:36-50,85`, `src/lib/shared/schemas/label.ts:28-31`, `src/lib/server/features/labels/service.ts:30-39`, `drizzle/`

**À faire**

- Corriger les lignes Avery du CSV d’après les gabarits Avery : espacement vertical 0, horizontal 3,175 mm pour 5160 et 8160, marges latérales et haute de 5162 (à vérifier sur la fiche).
- Décision « Page codes-barres (UI-08) » : passer en `qrcode` Brother DK-22210, Dymo 30320, Zebra 2x1, Generic 40x25 et Generic 50x30. DK-11204 garde sa zone blanche de 9,3 modules.
- Migration qui ne met à jour que les préréglages livrés encore identiques à leurs valeurs d’origine (même nom, mêmes mesures) : un préréglage modifié n’est pas touché. DATA-09 ajoute aussi une migration : merger l’une après l’autre, après REL-03.
- Faire porter les tests sur toutes les lignes réelles du CSV : chacune s’imprime, et Avery 5160 donne 3 × 10.
- À l’enregistrement d’un préréglage, appeler `checkLabelLayout`, ou au moins refuser `labels_do_not_fit`.
- Une phrase dans le résumé 0.9.0.
- Fait en P7 (2026-10-17, 45cc39a5..fc2b1aca) : lignes Avery 5160 et 8160, 5161, 5162, 5163, 5164 reprises des gabarits PDF d’Avery (U-0087-01 à U-0091-01, contours mesurés ; espacement vertical 0 ; positions des gabarits plutôt que la marge annoncée de 0,15625″, accepté par le mainteneur) ; Brother DK-22210, Dymo 30320, Zebra 2x1, Generic 40x25 et Generic 50x30 en QR ; tolérance de 0,01 mm dans `labelGrid` (arrondi de 33,867 mm) ; `assertPrintable` dans le service des préréglages : POST et PUT répondent 422 `labels_do_not_fit` ou `label_too_small` ; le seeding saute une ligne non imprimable ; migration 0009 (11 UPDATE, seulement les préréglages qui gardent leur nom et leurs mesures d’origine, et leur code-barres pour les cinq) ; la copie de `label_presets.csv` dans `csv-imports`, que Cellar ne remplaçait jamais, est remplacée si elle est identique octet pour octet à celle de 0.1.0-0.8.0. Preuves : Avery 5160 donne 30 étiquettes à 0,000 mm des découpes (avant 27, jusqu’à 15 mm d’écart) ; les 28 préréglages donnent un PDF ; sur une base 0.8.0, une 5161 modifiée reste telle quelle et une 5163 dont seule la bordure a changé est corrigée.
- Fait en P7, suites (2026-10-17, d6694ec8 et 4e2c53f0..6d4e5d5c), à la demande du mainteneur : « Enregistrer » et « Mettre à jour le préréglage » sont grisés quand la mise en page ne s’imprime pas, avec la raison visible avant le clic (`LabelOptions.layoutPrintable`, même contrôle que l’API) ; la mise en page par défaut passe à 56 mm de large, la plus étroite qui imprime un code de 10 caractères (145 modules en Code 128 B) ; les avertissements s’affichent à part, en jaune ; chaque champ du formulaire d’étiquettes dit sous lui quel nombre il attend (minimum exclu compris), et « Paramètres avancés » reste ouvert tant qu’un de ses champs est invalide.
- Trouvé pendant BUG-16 : la description de l’Avery 8160 dit « Laser » (`scripts/data/label_presets.csv:7`), alors que c’est une planche jet d’encre ; une copie du CSV en fins de ligne CRLF n’est pas reconnue par l’empreinte ; avec un numéro de départ invalide, l’aperçu de la plage (`BarcodeRange.svelte:8-14,22-24`) affiche deux fois « hors plage … 999999 », nombre non formaté ; le numéro de départ n’est pas borné selon ce que le préfixe permet ; dans tous les formulaires, `FormField` ne relie pas le message au champ par `aria-describedby` ; à 390 px, la raison sous les boutons des préréglages est à environ 550 px de la liste des erreurs.

**Critère d’acceptation** : Avery 5160 imprime 30 étiquettes en page 1, alignées sur les découpes ; chaque préréglage livré donne un PDF ; sur une installation existante, les préréglages non modifiés sont corrigés et un préréglage modifié reste tel quel ; un préréglage que le PDF refuserait n’est pas enregistré.

**Sources** : audit-pre-1.0/axe-6-pages.md#M1, audit-pre-1.0/axe-6-pages.md#m3, Décision « Page codes-barres (UI-08) »

### API-07 · Contrat de l’API figé pour la 1.0

Sévérité **mineur** · effort **M** · statut **Fait**

**Suivi** (2026-10-18) : 06388c6e..11e22ce2 (PUT /api/bottles/{id} retiré → 405, action « scripts » 0.9.0 ; docs/API.md : 103 couples route × méthode, à jour de DATA-08 et BUG-16 ; un test de route par couple ; api-doc.test.ts compare le document au code). CI verte.

**Problème** : 31 couples route × méthode n’ont aucun appelant dans l’app et aucun document ne les décrit, alors que les notes de 0.7.0 en recommandent certains aux scripts. Les décisions UI-04, UI-09 et API-06 se contredisaient à leur sujet. La 1.0 fige ce contrat : le mainteneur a choisi une API publique documentée, sans `PUT /api/bottles/{id}`, qui réécrit toutes les colonnes.

**Fichiers** : `src/routes/api/**`, `src/routes/api/bottles/[id]/+server.ts`, `releases.json`, `docs/API.md (nouveau)`, `README-Docker.md`, `src/routes/api/images/+server.ts:5-6`

**À faire**

- Décisions « Mises à jour des bouteilles (API-05) » et « Endpoints et CSRF (API-06) » : retirer `PUT /api/bottles/{id}`, avec l’action conditionnelle « scripts » de 0.9.0 dont API-05 donne la phrase. Reporter sur PATCH les tests de PUT qui couvrent encore un comportement utile.
- Écrire en anglais `docs/API.md`, pour les scripts : chaque route et méthode, avec la session exigée, le corps attendu et la réponse ; y renvoyer depuis README-Docker.
- Un test de route pour chaque route lue qui n’en a pas (tableau de l’axe 2, m1).
- Corriger le commentaire faux de `api/images/+server.ts:5-6`.
- Avant la 1.0, dans la tâche T9 de l’audit : le doublon `DELETE /api/bottles/{id}` et `DELETE /api/admin/wine-bottles/{id}`, et la forme des réponses.
- Fait en P7 (2026-10-18, 06388c6e..11e22ce2) : `PUT /api/bottles/{id}` retiré (405, `Allow: PATCH, DELETE`), action « scripts » de 0.9.0 avec un pied `BREAKING CHANGE:`, tests de PUT reportés sur PATCH ; `docs/API.md` (103 couples route × méthode : session, corps, réponses, erreurs, connexion d’un script, contrôle d’origine, limites, routes retirées), à jour de DATA-08 et BUG-16, lié depuis README-Docker ; 28 couples sans test en ont un, avec les helpers `insertBottles`, `insertImageRow` et `fileOf` de `src/test/` ; `src/routes/api/api-doc.test.ts` compare l’index du document aux méthodes exportées et à `requiresSession`. Preuve : sur une base 0.8.0 mise à jour, l’action s’affiche dans les logs et le bandeau ; PUT répond 405.
- Trouvé pendant API-07 (écarts entre décisions et code, sans tâche) : API-03, le nom d’un référentiel est comparé avec la casse (`lookup-crud.ts:88-92`) ; UI-09, ni unicité des conteneurs et suffixes, ni espace gardé devant un suffixe, ni nom du conteneur dans l’export CSV ; « Restauration », les réglages des sauvegardes automatiques viennent de la sauvegarde et ses actions ne sont pas ajoutées ; action 0.7.0, cinq PUT répondent encore `{ success: true }` (T9).
- Trouvé pendant API-07 : `import-images-zip` accepte `.bmp` sans lire le contenu (`images/service.ts:226,268`, contre SEC-06) ; `admin/backup-token/+server.ts:5` hors `apiHandler` ; des 422 `invalid_body` sans `details` (`backup/service.ts:131`, `images/service.ts:186`, `import-images-zip/+server.ts:11`) ; un ancien préfixe de plus de 6 caractères fait répondre 500 à next-barcode et au PDF (`shared/barcode.ts:192`) ; next-barcode, codes automatiques éteints, répond `200 { barcode: "" }` quand export-all répond 409 ; le préfixe passe par `LIKE` (casse ignorée, `_` et `%` jokers, `barcode/repository.ts:116,164`) ; `topProducers` et les listes par pays ou région font `LIMIT 10` avant de retirer le groupe sans nom (`bottles/repository.ts:363-373`) ; pas d’`ORDER BY` sur wines, definitions, bottles, non-consumed et images ; garde inatteignable dans `getWineShortages` ; URL d’image non encodées (`paths.ts:19-21`) ; 10 Mo par image pour `upload-image`, 20 Mo pour `/api/upload/image` ; `updatedDefinitions` de `PUT /api/admin/images` compte des vins non modifiés ; le test `.zip` de restore et import-json tient compte de la casse ; `POST /api/bottles` ignore sans le dire le code-barres envoyé en mode automatique (m3) ; un PUT de préréglage non imprimable sur un id inconnu répond 422 avant 404.

**Critère d’acceptation** : `PUT /api/bottles/{id}` répond 405, et l’action « scripts » s’affiche à la mise à jour. Chaque route du document a un test de route. Le document et les décisions UI-04, UI-09, API-05 et API-06 disent la même chose.

**Sources** : audit-pre-1.0/axe-2-api-securite.md#m1, Décision « Endpoints et CSRF (API-06) »

### REL-04 · Notes de version justes

Sévérité **mineur** · effort **XS** · statut **Fait**

**Suivi** (2026-10-18) : 3bbac9b4..1a23b8a7 (résumé 0.8.0 : tri accentué limité aux deux tableaux triés dans le navigateur ; action 0.2.0 [2] reformulée en place, redémarrage limité aux versions avant 0.6.0, renvoi vers « Automatic backups » ; release check simulé OK). CI verte.

**Problème** : Deux notes publiées sont fausses. Le résumé 0.8.0 annonce des noms accentués triés « en place », ce qui est faux pour l’historique et le hors cave, que le serveur trie par octets. L’action 0.2.0 sur le mode « External Cron Job » demande de redémarrer le conteneur après l’enregistrement des réglages, ce qui est inutile, et annonce le cron avec jeton pour plus tard, alors qu’il existe depuis 0.6.0.

**Fichiers** : `releases.json`

**À faire**

- Résumé 0.8.0 : retirer « accented names sorted in place », ou le limiter aux tableaux triés dans le navigateur. Le tri de l’historique et du hors cave sera aligné plus tard (décision « Tri de l’historique et du hors cave »).
- Action 0.2.0 d’index 2 : la reformuler en place, comme le permet `RELEASING.md` ; retirer « then restart the container: saving the settings does not start the scheduler », et remplacer la phrase sur le cron à venir par un renvoi vers « Automatic backups » de README-Docker. L’index ne change pas, donc les coches restent valables. Pas de nouvelle action (décision « Sauvegardes par cron (DATA-05) »).
- `CHANGELOG.md` et `UPGRADING.md` sont générés : ne pas les éditer, ils suivront à la prochaine release (`release.mjs prepare`).
- La phrase sur `/` qui « redirige côté serveur », signalée par l’audit, a déjà été retirée avant la release 0.8.0.
- Fait en P7 (2026-10-18, 3bbac9b4..1a23b8a7) : résumé 0.8.0, « accented names sorted in place » remplacé par une phrase limitée à `BottleDetailsDialog` et `AllBottlesDialog`, seuls tableaux triés dans le navigateur avec `compareText` ; action 0.2.0 d’index 2 reformulée en place : « now fails » (une ancienne commande cron reçoit 403 depuis 0.5.0, et 401 avec `Content-Type: application/json`), redémarrage gardé mais limité aux versions avant 0.6.0, où l’enregistrement ne relançait pas encore le planificateur (`reschedule()` depuis 6186e749), renvoi absolu vers « Automatic backups » de README-Docker. Écart à la tâche, validé par le mainteneur le 2026-10-18 : le redémarrage n’est pas retiré, car il reste nécessaire pour qui installe une version 0.2.0 à 0.5.x. Preuve : `release.mjs check v0.9.0-rc.1` simulé dans un clone jetable passe ; une base ramenée à 0.1.0 affiche la nouvelle action dans les logs et le bandeau.
- Trouvé pendant REL-04 : l’action 0.7.0 d’index 0 (« read the saved entry from a PUT instead of `{ success: true }` ») est ambiguë, six PUT répondant encore `{ success: true }` (settings, access-code, upgrade-actions, backup-settings, barcode-settings, `PUT /api/admin/images`) ; le résumé 0.7.0 (« 201 for a creation, 204 for a deletion ») est inexact pour `DELETE /api/admin/wine-definitions/{id}` et `DELETE /api/admin/images` (200), `POST /api/admin/upload-image` et `import-images-zip` (200) ; les deux relèvent de T9. Les pages de release GitHub qui portaient les deux passages corrigés (v0.2.0-rc.2 à rc.4, v0.2.0, v0.8.0-rc.1, v0.8.0) ont été mises à jour le 2026-10-18 avec `gh release edit`, à la demande du mainteneur : seuls ces deux passages changent.

**Critère d’acceptation** : `releases.json` ne contient plus ces deux affirmations, et `node scripts/release.mjs check` passe à la release suivante.

**Sources** : audit-pre-1.0/axe-7-infra.md#m21, audit-pre-1.0/axe-6-pages.md#m2, audit-pre-1.0/synthese.md#R3

## P8 · Suites de P7 (1.0.0)

Tâches ouvertes par le mainteneur pendant P7 et P8 : la note de consommation, les vins jumeaux à l’import et la longueur des textes. Prévue pour 0.10.0.

### BUG-17 · Une note de consommation remplace les notes des bouteilles

Sévérité **majeur** · effort **XS** · statut **Fait**

**Suivi** (2026-10-18) : P8 : 026eb931..cea86ce3. Note de consommation ajoutée après les notes (addedNote sur PATCH /api/bottles), aide sous le champ dans les 4 écrans.

**Problème** : Consommer des bouteilles avec une note (hors cave, page vin, BottleDetailsDialog, BulkBarcodeDialog) remplace les notes existantes de toutes les bouteilles sélectionnées (« Cadeau de Marie » disparaît sous « Bu avec Paul »), sans message. Trouvé pendant BUG-13 ; le comportement date de 556c7bb.

**Fichiers** : `src/lib/utils/bottle-changes.ts (newStatus)`, `src/lib/server/features/bottles/service.ts (changements groupés)`

**À faire**

- Décision « Suites de P7 (BUG-13, BUG-15) » : la note tapée en consommant s’ajoute à la ligne, à la suite des notes existantes de chaque bouteille ; une bouteille sans note reçoit la note seule.
- Choisir où se fait l’ajout (serveur, pour que l’action groupée reste une seule requête) et garder PATCH « remplace les champs donnés » pour les scripts, ou documenter le changement dans docs/API.md et les notes de version.
- Test : deux bouteilles, l’une avec une note, l’autre sans ; consommer avec une note → la première garde sa note suivie de la nouvelle, la seconde a la nouvelle seule.
- Fait en P8 (2026-10-18, 026eb931..cea86ce3) : l’ajout se fait sur le serveur, dans la même transaction que les autres changements. `PATCH /api/bottles` accepte un `addedNote` facultatif à côté de `ids` et `changes`, ajouté à la ligne après les notes de chaque bouteille (la note seule pour une bouteille sans notes) ; `notes` dans `changes` remplace toujours et `PATCH /api/bottles/{id}` ne change pas (docs/API.md). Aide « S’ajoute à la suite des notes de chaque bouteille. » sous le champ, dans les quatre écrans. 7 tests échouent avant. Preuve Chromium sur les quatre écrans : « Gift from Marie\nDrunk with Paul » et « Drunk with Paul » ; un déplacement ne touche pas les notes.
- Trouvé pendant BUG-17 (hors périmètre) : les boutons Confirmer n’ont pas de garde contre un double envoi (`applyChanges` de `BulkBarcodeDialog`, `confirmAvailabilityChange` du hors cave, `confirmConsumption` de `BottleDetailsDialog`) ; avec l’ajout, un nouvel essai après une réponse perdue ajoute la note deux fois. Le dialogue de statut est copié dans les quatre écrans : chaque changement de l’étape de consommation se fait quatre fois.

**Critère d’acceptation** : Consommer des bouteilles avec une note garde leurs notes existantes, suivies de la nouvelle, dans les quatre écrans de changement de statut.

**Sources** : Décision « Suites de P7 (BUG-13, BUG-15) », Tâche BUG-13

### BUG-18 · Import CSV : deux vins qui ne diffèrent que par la note ou la description

Sévérité **mineur** · effort **S** · statut **Fait**

**Suivi** (2026-10-18) : P8 : 698ed96e..026eb931. Les deux jumeaux sont importés, bouteilles signalées several_wines même en import séparé ; phrase dans le guide d'import.

**Problème** : La règle « un vin listé deux fois est importé une fois » fait importer un seul des vins qui ne diffèrent que par la note, la description ou l’image. BUG-15 signale leurs bouteilles quand les fichiers de vins et de bouteilles sont importés ensemble, mais en deux imports (les vins, puis les bouteilles) les bouteilles vont au premier vin sans message.

**Fichiers** : `src/lib/server/features/csv-import/referenceIndex.ts (recordWineRow, wineOfBottle)`, `src/lib/server/features/csv-import/pipeline.ts (importRow)`, `src/lib/server/features/csv-import/round-trip.test.ts`

**À faire**

- Décision « Suites de P7 (BUG-13, BUG-15) » : importer une seconde ligne de même clé quand elle diffère par une autre colonne, pour que les deux vins existent ; une ligne identique (fichier donné deux fois) reste importée une fois.
- Ensuite, les bouteilles de ces vins sont signalées `several_wines` même lors d’un import séparé, puisque la cave a deux vins pour la clé.
- Revoir le test `imports a wine listed twice in the same file once` et la phrase correspondante du guide CSV ; une phrase dans les notes de version.
- Fait en P8 (2026-10-18, 698ed96e..026eb931) : une ligne de vin n’est sautée que si la cave avait sa clé avant l’import, ou si une ligne identique du même import a déjà ajouté un vin ; sinon chaque ligne qui diffère par une autre colonne ajoute un vin (`cellarWinesByKey` et `recordImportedWine` dans `referenceIndex.ts`). Le guide de l’import le dit (`admin.csv_table_wine_definitions_note`), ainsi que docs/API.md ; le guide CSV n’avait pas de phrase à ce sujet. 8 tests échouent avant. Preuve sur serveurs : develop, un seul jumeau et ses 3 bouteilles au premier vin ; branche, deux jumeaux et les 3 bouteilles signalées `several_wines` ; un réimport, même après une note modifiée dans l’app, n’ajoute rien.
- Trouvé pendant BUG-18 (hors périmètre) : dans `importRow` (`pipeline.ts`), une ligne de vin dont la clé existait avant l’import est sautée en `same_name` avant d’être validée, donc une ligne invalide est annoncée « Déjà dans la cave » (déjà vu pendant BUG-15).

**Critère d’acceptation** : Cave A avec deux vins qui ne diffèrent que par la note ; export, import des vins dans une cave B vide, puis des bouteilles dans un second import → deux vins dans B, et les bouteilles signalées `several_wines` au lieu d’aller au premier vin.

**Sources** : Décision « Suites de P7 (BUG-13, BUG-15) », Tâche BUG-15

### DATA-10 · Une limite à taille humaine pour les notes et les descriptions

Sévérité **mineur** · effort **S** · statut **Fait**

**Suivi** (2026-10-18) : P8 : cea86ce3..fa32bc58 (migration 0011). Notes et descriptions limitées à 5 000 caractères, textes plus longs coupés à la mise à jour et à l'import, sauts de ligne en LF, note de consommation trop longue refusée (notes_too_long).

**Problème** : Les notes des bouteilles et les descriptions des vins acceptaient 100 000 caractères, un garde-fou contre les abus posé par API-01 plutôt qu’une taille pensée pour les gens, et les formulaires ne montraient aucune limite. Soulevé pendant BUG-17, où une note ajoutée peut faire dépasser la limite.

**Fichiers** : `src/lib/shared/schemas/common.ts (LONG_TEXT_MAX_LENGTH, longText)`, `src/lib/components/forms/LongTextarea.svelte`, `src/lib/server/features/bottles/service.ts (notes_too_long)`, `drizzle/0011_long_texts_to_5000_characters.sql`

**À faire**

- Décision « Longueur des textes (DATA-10) ».
- Fait en P8 (2026-10-18, cea86ce3..fa32bc58) : `LONG_TEXT_MAX_LENGTH = 5_000` pour `notes`, `description` et `addedNote`, 422 au-delà ; formulaires avec `maxlength` et un compteur (`LongTextarea`, six endroits) ; les sauts de ligne CRLF sont stockés en LF, car le navigateur envoie CRLF quand le champ compte un caractère ; l’import CSV, l’import JSON et la restauration coupent à 5 000 comme la migration 0011, qui passe aussi les CRLF existants en LF ; une note de consommation qui ne tient pas après les notes est refusée (422 `notes_too_long`) sans rien changer, et le dialogue garde la note. Preuve : base 0.9.0 mise à jour en place, textes de 7 000 et 6 500 caractères coupés à 5 000, autres colonnes identiques ; 7 tests échouent sur develop ; captures Chromium des formulaires. Quatre tours de revue.

**Critère d’acceptation** : Une note ou une description de plus de 5 000 caractères est refusée par l’API et ne peut pas être tapée dans les formulaires, qui montrent la limite ; une base 0.9.0 avec une note et une description plus longues est mise à jour en place, les deux coupées à 5 000 caractères et les autres champs inchangés.

**Sources** : Décision « Longueur des textes (DATA-10) », Tâche BUG-17

## P9 · Restes de l’audit déjà décidés (1.0.0)

Les tâches T1 à T16 de l’audit d’avant 1.0 qui portent une décision déjà prise, avec les points que le mainteneur y a rattachés le 2026-10-23. Prévue pour 0.11.0. Lots, chacun mergé avant le suivant ; les tâches d’un lot ne partagent aucun fichier, hors de `en.json`, `fr.json`, `docs/API.md`, `.gitignore` et du résumé 0.11.0 de `releases.json`, où chacune ajoute ses lignes et où le second merge résout le conflit en gardant les deux côtés : 1. DATA-11, UI-13 (déplacement de la base et dialogue de statut partagé, qui restructurent les fichiers des autres) ; 2. QA-05, DATA-12, DATA-13, BUG-19 ; 3. API-08, BUG-20, UI-11, REL-05 ; 4. UI-12, UI-14 ; 5. API-09 (routes de presque tous les domaines) ; 6. UI-15 (clés i18n de presque tous les composants). Terminée le 2026-10-28 (develop bf183d64), publiée en 0.11.0 le 2026-10-29.

### DATA-11 · La base de données sous `src/lib/server`

Sévérité **mineur** · effort **M** · statut **Fait**

**Suivi** (2026-10-23) : 78a4f860..5a051a66

**Problème** : `src/lib/db/` (schéma, connexion, migrations, seeding) est hors de `src/lib/server`, que SvelteKit interdit d’importer côté navigateur : seule la règle de lint des routes empêche un composant de l’importer. 96 fichiers l’importent : 30 fichiers de `src/lib/server` hors tests, 18 tests de `src/lib/server`, 35 tests de routes, 7 fichiers de `src/test`, plus `app.d.ts`, `hooks.server.ts` et son test, `src/lib/shared/dto.ts` et les deux tests du dossier.

**Fichiers** : `src/lib/db/`, `drizzle.config.ts:5`, `eslint.config.js:63-65`, `src/test/setup.ts:26`, `src/lib/shared/dto.ts`, `src/app.d.ts`, `src/hooks.server.ts`, `knip.config.ts`, `AGENTS.md`

**À faire**

- Décision « Architecture (revue 7) », a7 R7-Archi-1 : `src/lib/db` passe sous `src/lib/server` (par exemple `src/lib/server/db/`), pour que SvelteKit refuse son import côté client.
- Lot 1 de P9, avant toute tâche qui touche le code serveur : le déplacement change les imports de presque tout ce code. Un commit qui ne fait que déplacer (`git mv`) et corriger les imports, pour que l’historique suive les fichiers.
- `src/lib/shared/dto.ts` est partagé avec le navigateur : il reste en `import type` du schéma (c’est déjà le cas), sinon le garde de SvelteKit le refusera ; vérifier les autres fichiers de `src/lib/shared`.
- Mettre à jour `drizzle.config.ts`, le `vi.mock` de `src/test/setup.ts`, la règle de lint (`eslint.config.js:63-65`), `knip.config.ts` s’il le faut, et la carte d’AGENTS.md (`src/lib/db/` y est cité cinq fois). Ne pas toucher aux migrations de `drizzle/`.
- Preuve que la garde marche : importer la base depuis un composant fait échouer `pnpm build` (essai jetable, non commité).
- Fait en P9 (2026-10-23, 78a4f860..5a051a66) : `src/lib/db` déplacé en `src/lib/server/db` par un commit qui ne fait que `git mv` et corriger les imports (environ 96) ; `drizzle.config.ts`, la règle de lint, AGENTS.md et le README suivent. Preuve : un import de la base depuis un composant fait échouer `pnpm build` (`server_only_import`) ; `pnpm db:generate` ne crée aucune migration.

**Critère d’acceptation** : `src/lib/db/` n’existe plus ; un composant qui importe la base fait échouer `pnpm build` avec l’erreur « server-only » de SvelteKit ; `pnpm db:generate` ne crée aucune migration ; les portes passent.

**Sources** : T16 de l’audit (audit-pre-1.0/synthese.md#T16), audit-pre-1.0/axe-7-infra.md#R7-Archi-1, Décision « Architecture (revue 7) »

### UI-13 · Dialogues de statut et de déplacement partagés, page vin

Sévérité **mineur** · effort **L** · statut **Fait**

**Suivi** (2026-10-23) : a4b6cb7f..4824634a

**Problème** : Le dialogue de changement de statut est recopié dans quatre écrans (`BottleDetailsDialog`, page vin, hors cave, `BulkBarcodeDialog`) : chaque correction de l’étape de consommation se fait quatre fois (BUG-13, BUG-17), et les copies divergent. Sur la page vin, le Confirmer n’est pas grisé pendant l’envoi (un double clic ajoute la note deux fois), un échec réseau est muet, et une bouteille « Consommée » sans date est bloquée sans message. Après un 404, le toast demande de recharger une liste déjà rechargée.

**Fichiers** : `src/lib/components/BottleDetailsDialog.svelte`, `src/routes/wines/[id]/+page.svelte`, `src/routes/out-of-cellar/+page.svelte`, `src/lib/components/BulkBarcodeDialog.svelte`, `src/lib/utils/bottle-changes.ts`, `src/lib/utils/wine-filters.ts:46,50`, `src/lib/components/forms/StorageCasePicker.svelte`

**À faire**

- Décision « Formulaires de vin et de bouteille (UI-06) » : la date de consommation est facultative, le dialogue propose toujours la date du jour sans l’exiger. Les prix négatifs (a5 m4) sont dans API-09, avec la réparation des imports et la migration que demande la décision « Prix négatifs (UI-06) ».
- Décision « Suites de P7 (BUG-13, BUG-15) » : la note tapée en consommant s’ajoute aux notes (`addedNote`) ; décision « Tâches de l’audit d’avant 1.0 (P9, P10, P11) » : après une réponse perdue, un nouvel essai l’ajoute encore deux fois, accepté. Décision « Messages d’erreur (P7) » pour les messages ajoutés.
- Lot 1 de P9 : cette tâche restructure les écrans que BUG-19, UI-11 et UI-14 modifient ensuite. Elle ne touche pas au code serveur (DATA-11 le déplace en parallèle).
- a5 R5-M6c, R5-Refacto-5 et BUG-17/2 : extraire un `BottleStatusDialog` et un `MoveBottlesDialog` partagés (par exemple dans `components/bottles/`), utilisés par les quatre écrans, avec une seule gestion d’erreur et un seul sélecteur de statut.
- BUG-17/1 : le Confirmer du dialogue partagé est grisé pendant l’envoi (aujourd’hui `wines/[id]/+page.svelte:892` ne l’est pas).
- a5 R5-m3, UI-05/Reste-1 et BUG-13/1 : un échec réseau en changeant le statut s’affiche (catch muet de `confirmConsumption`, `wines/[id]/+page.svelte:191-194`).
- a5 m3 : retirer `if (CONSUMED && !consumedDate) return;` (page vin `:170`, `BottleDetailsDialog.svelte:155`) ; le serveur accepte une bouteille consommée sans date.
- a5 UI-10/Trouvé-8b : après un 404, la liste vient d’être rechargée (`out-of-cellar/+page.svelte:95` puis toast `:99`, `BottleDetailsDialog`) : un message qui ne demande pas de recharger, par exemple « Cette bouteille n’existe plus. La liste est à jour. », dans les deux langues.
- a5 R5-M6g : les cartes des bouteilles disponibles et consommées de la page vin (`:458` et `:662`) deviennent un seul composant.
- a5 m14 : `BottleDetailsDialog` et `BulkBarcodeDialog` chargent les cases comme `StorageCasePicker` (`request()`), sans `fetch` brut, avec la garde contre la course sur la capacité.
- DATA-09/1 : retirer les tests de millésime « faux » (`!vintage`, `||`) devenus inutiles depuis la migration 0 → NULL : `wine-filters.ts:46,50`, `out-of-cellar/+page.svelte:247,255`, `wines/[id]/+page.svelte:474,678`.
- Tests : le dialogue partagé (double envoi, échec réseau, consommée sans date) par des tests de composant ou d’utilitaire, là où le code le permet.
- Fait en P9 (2026-10-23, a4b6cb7f..4824634a) : un seul `BottleStatusDialog` (page vin, hors cave, `BottleDetailsDialog`) et un seul `MoveBottlesDialog` ; `BulkBarcodeDialog` garde son sélecteur mais partage `ConsumptionFields`, `CaseTargetPicker` et `BottleChanges` ; les cases et leur remplissage passent par `case-loads.svelte.ts` (décision « Dialogue de statut partagé (UI-13) »). Une requête à la fois, erreurs affichées, une bouteille bue sans date s’enregistre. Changements visibles acceptés par le vérificateur : titre « Change the status of N bottles », croix qui vide l’emplacement dans le déplacement, « (+N bottles) », note plus haute dans la saisie groupée, le hors cave ne recharge plus après un refus autre que 404.
- Trouvé pendant UI-13 (hors périmètre) : `GET /api/storage-cases/{id}/capacity` et `caseCapacity()` n’ont plus d’appelant dans l’app (à garder comme API publique ?) ; l’aperçu de capacité compte des bouteilles qui ne prennent pas de place (hors cave, déjà dans la case visée), donc « sera trop pleine » peut être faux (antérieur) ; `fetch` bruts restants : `AllBottlesDialog.svelte:56`, `storage/ContainerDialog.svelte:79-95`, `barcode/PresetManager.svelte:80`, `barcode/BarcodeStatsCard.svelte:28` ; `BottleCard` affiche « bu le » pour une bouteille non bue, sur d’anciennes lignes seulement ; `{#each}` sans clé dans `wines/[id]/+page.svelte:305`.

**Critère d’acceptation** : Le dialogue de statut et celui de déplacement n’existent qu’en un exemplaire, utilisé par les quatre écrans. Sur la page vin : un double clic sur Confirmer n’envoie qu’une requête ; un échec réseau affiche un message ; « Consommée » sans date s’enregistre.

**Sources** : T8 de l’audit (audit-pre-1.0/synthese.md#T8), première partie, audit-pre-1.0/axe-5-interface.md#m3, m14, R5-M6c, R5-M6g, R5-m3, R5-Refacto-5, UI-05/Reste-1, UI-10/Trouvé-8b, Trouvé pendant DATA-09 (1), BUG-17 (1, 2), BUG-13 (1), Décisions « Formulaires de vin et de bouteille (UI-06) », « Suites de P7 (BUG-13, BUG-15) », « Tâches de l’audit d’avant 1.0 (P9, P10, P11) », « Messages d’erreur (P7) »

### QA-05 · Playwright : trois ou quatre parcours

Sévérité **mineur** · effort **M** · dépend de UI-13 · statut **Fait**

**Suivi** (2026-10-23) : 3bab106b..6b73f559

**Problème** : Aucun test de bout en bout : les parcours qui traversent plusieurs écrans (ajouter un vin et ses bouteilles, consommer, sauvegarder et restaurer) ne sont vérifiés qu’à la main, alors que UI-14 et UI-19 vont restructurer ces écrans.

**Fichiers** : `package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `playwright.config.ts (nouveau)`, `e2e/ (nouveau)`, `knip.config.ts`, `.gitignore`, `AGENTS.md`

**À faire**

- Décision « Architecture (revue 7) », a7 R7-Archi-7 : Playwright couvre 3 ou 4 parcours, pas plus.
- Après UI-13 (le dialogue de statut est l’un des parcours), avant UI-14 et UI-19, qu’il protège.
- Proposition de parcours : se connecter, ajouter un vin et deux bouteilles depuis la liste ; consommer une bouteille avec une note depuis la page vin et la retrouver dans l’historique ; créer une sauvegarde, effacer la cave, la restaurer depuis la liste ; ranger une bouteille dans une case de la page stockage.
- Chaque test démarre le serveur compilé sur un dossier de données jetable (jamais `data/`), avec `ORIGIN` ; Chromium seul suffit. Version de `@playwright/test` publiée depuis au moins 7 jours, plage à partir de la version installée.
- Un job de CI dédié, qui installe le navigateur et garde les traces en cas d’échec ; `pnpm test:e2e` dans AGENTS.md et dans la liste de ce que lance la CI.
- Fait en P9 (2026-10-23, 3bab106b..6b73f559) : `@playwright/test` (^1.64.1, accord du mainteneur) et quatre parcours dans `e2e/`, lancés par `pnpm test:e2e` contre l’app construite (`e2e/server.mjs`, port 4421, dossier de données jetable) ; job `e2e` dans la CI, qui garde son rapport seulement en cas d’échec ; AGENTS.md le décrit, et `pnpm test:e2e` entre dans la définition de « fini » (décision « Parcours de bout en bout (QA-05) »).
- Points ouverts de QA-05 : le serveur écoute sur 127.0.0.1 et le navigateur ouvre localhost (cela marche) ; `playwright install` a retiré d’anciennes versions de navigateurs du cache de l’utilisateur.

**Critère d’acceptation** : `pnpm test:e2e` lance 3 ou 4 parcours qui passent en local et dans la CI ; casser l’un d’eux (par exemple retirer le bouton Confirmer du dialogue de statut) fait échouer la CI ; aucun fichier de `data/` n’est ouvert.

**Sources** : T16 de l’audit (audit-pre-1.0/synthese.md#T16), audit-pre-1.0/axe-7-infra.md#R7-Archi-7, Décision « Architecture (revue 7) »

### DATA-12 · Sauvegardes et restauration : restes de l’audit

Sévérité **mineur** · effort **L** · dépend de DATA-11 · statut **Fait**

**Suivi** (2026-10-23) : 91b7ee7e..bc1fff17

**Problème** : Une restauration peut couper les sauvegardes automatiques sans le dire et jette les actions de mise à jour de la sauvegarde. L’effacement ne retient pas les écritures faites pendant sa sauvegarde de secours. Les fichiers d’images ne sont jamais retirés. Un nom de sauvegarde accepté donne 500. Des sauvegardes manuelles anciennes passent pour automatiques, celles de sécurité pour manuelles. Un arrêt brutal laisse des centaines de Mo de fichiers temporaires. Cellar crée sans prévenir une sauvegarde qu’il ne pourra pas restaurer, et la page télécharge la sauvegarde de sécurité en mémoire.

**Fichiers** : `src/hooks.server.ts:22`, `src/lib/server/features/backup/service.ts`, `src/lib/server/features/backup/files.ts:30,56,103,108,125`, `src/lib/server/features/backup/json-import.ts:64-65,162,168`, `src/lib/server/features/backup/archive.ts:112`, `src/lib/server/upgrade.ts:262-265`, `src/lib/server/zip.ts:14,18`, `src/lib/utils/download.ts:22`, `src/routes/admin/backups/+page.svelte:128,171`, `src/lib/components/admin/backups/NameBackupDialog.svelte:58`, `src/lib/components/admin/backups/backup-type.ts:12-13`, `src/lib/server/features/backup/restore/upgrade.test.ts`, `README-Docker.md`, `.gitignore`

**À faire**

- Décision « Restauration (audit d’avant 1.0) », a3 m3, m4 et API-07/3 : après une restauration, les réglages des sauvegardes automatiques restent ceux de l’instance, comme le jeton cron que `putBackBackupToken` remet déjà (`backup/service.ts:311` dit l’inverse pour les réglages) ; les actions de mise à jour de la version de la sauvegarde (`planUpgrade`) s’ajoutent à celles de l’instance, marquées « peut-être déjà faite » (`putBackUpgradeState`, `upgrade.ts:262-265`). Revoir les deux tests de `restore/upgrade.test.ts` qui figent l’inverse et `README-Docker.md` (« after a restore »).
- Décision « Admin en pages (UI-07) » : les noms de sauvegarde ne sont vérifiés que par le serveur. a3 m5 : limiter le nom en octets (par exemple 150 en UTF-8, avec le même 422) dans `manualBackupRequest` et l’export CSV ; a4 m5 : retirer ensuite `maxlength={50}` du dialogue.
- a3 m1 : l’effacement retient les écritures (`ROUTES_HOLDING_WRITES`, `holdWrites` autour de la sauvegarde de secours et de `wipeCellar()`).
- a3 m2 : après un effacement, supprimer les fichiers des images supprimées ; après une restauration, ceux qu’aucune ligne de `wine_images` ne cite. Le faire dans `features/backup`, sans modifier `features/images` (DATA-13, même lot).
- a3 m6 : retirer `LEGACY_AUTOMATIC_FILE` ; ces sauvegardes d’avant 0.6.0 sont listées comme manuelles. a4 m6 : les sauvegardes de sécurité (`pre-restore`, `pre-reset`, `pre-import`) ont leur propre libellé dans la liste.
- a3 DATA-05/Reste-1 : au démarrage, supprimer les fichiers et dossiers temporaires laissés par un arrêt brutal (restauration, import JSON, import d’images, `db/index.ts:51`), en un seul endroit, sans toucher aux services qui les créent ; les ajouter à `.gitignore`.
- a3 DATA-05/Reste-4 : l’import JSON (et la restauration, même ordre) copie ses images avant de relâcher le verrou d’écriture.
- a3 R3-m16 et DATA-08/3 : `readExport` ne rend en 422 « unreadable » qu’un fichier illisible ; une erreur disque (EACCES, ENOSPC) reste une 500.
- DATA-08/1 : à la création d’une sauvegarde, prévenir (ou refuser avec un message) quand elle dépasse les limites d’extraction de `zip.ts` (2 Gio décompressés, 10 000 entrées) qu’une restauration lui appliquera.
- DATA-08/2 : après une restauration ou un import, la sauvegarde de sécurité se télécharge par le navigateur (lien ou `<a download>`), sans `response.blob()` qui la garde en mémoire, et le bouton « Restauration… » ne l’attend pas.
- Tests qui échouent avant pour chaque règle serveur ; une phrase dans le résumé 0.11.0 pour la restauration (réglages, actions) et les images retirées.
- Fait en P9 (2026-10-23, 91b7ee7e..bc1fff17) : une restauration garde les réglages de sauvegarde de l’instance et ajoute les actions de la sauvegarde ; un effacement bloque les autres écritures ; après un effacement ou une restauration, les images qu’aucune ligne ne cite sont supprimées, et la copie des images se fait sous le verrou ; noms de sauvegarde et d’export limités à 150 octets (422), et plus coupés à 50 caractères dans l’admin ; sauvegardes de sécurité étiquetées, anciennes sauvegardes « auto » listées comme manuelles ; au démarrage, ce qu’un arrêt a laissé des restaurations, des imports et des téléchargements d’images est retiré, y compris les fichiers WAL d’une restauration arrêtée (défaut trouvé et corrigé pendant la tâche, 08a2abec) ; l’import JSON répond 500 et non 422 pour une erreur disque ; une sauvegarde plus grosse que ce qu’accepte la restauration est signalée (décision « Sauvegarde trop grosse (DATA-12) ») ; le navigateur télécharge la sauvegarde de sécurité sans l’attendre.
- Trouvé pendant DATA-12 (hors périmètre) : « Download » de la liste des sauvegardes charge tout le fichier en mémoire (blob) ; l’import JSON laisse les fichiers d’images de la cave remplacée ; les écritures retenues n’attendent pas une sauvegarde automatique en cours ; une sauvegarde manuelle nommée « pre-… » est étiquetée sauvegarde de sécurité ; la restauration n’ajoute pas les actions en attente propres à la sauvegarde ; le message « illisible » peut finir par « .. » ; la restauration saute les images BMP depuis 0.7.0 ; l’échec du téléchargement de la sauvegarde de sécurité est invisible ; un script qui filtre sur `manual-backup` ne voit pas les sauvegardes de sécurité (documenté).

**Critère d’acceptation** : Restaurer une sauvegarde en mode cron sur une instance en mode interne garde le mode interne, et les actions de la version de la sauvegarde s’affichent « peut-être déjà faites ». Une écriture envoyée pendant l’effacement est refusée en 503 `writes_held`. Après un effacement, le dossier des images est vide. Un nom de 200 caractères accentués reçoit 422, pas 500. Après un `kill -9` pendant une restauration, le redémarrage ne laisse aucun fichier temporaire.

**Sources** : T1 de l’audit (audit-pre-1.0/synthese.md#T1), audit-pre-1.0/axe-3-api-admin.md#m1–m6, DATA-05/Reste-1, DATA-05/Reste-4, R3-m16, audit-pre-1.0/axe-4-front-admin.md#m5, m6, Trouvé pendant DATA-08 (1, 2, 3), API-07 (3), Décisions « Restauration (audit d’avant 1.0) », « Admin en pages (UI-07) »

### DATA-13 · Images : contenu vérifié, zip en flux, renommage sûr

Sévérité **mineur** · effort **M** · dépend de DATA-11 · statut **Fait**

**Suivi** (2026-10-23) : 12048500..a170f3b8

**Problème** : L’import d’images en zip copie les fichiers sans lire leur contenu et accepte le BMP, contre la décision SEC-06 ; deux entrées homonymes s’écrasent. Le zip des images est construit en mémoire et fait planter le serveur sur une image illisible. Renommer une image donne 500 sur un nom long, accepte toute extension et renomme le fichier avant la ligne. Une image est limitée à 20 Mo dans un formulaire, 10 Mo dans l’admin, et une image d’un peu moins de 20 Mo reçoit 413. Une image envoyée puis abandonnée reste sur le disque.

**Fichiers** : `src/lib/server/features/images/service.ts:88-90,181,224,261,277,334,345`, `src/routes/api/admin/images/+server.ts:17`, `src/routes/api/admin/download-images/+server.ts:13`, `src/routes/uploads/[...path]/+server.ts:35-36`, `src/lib/server/paths.ts:19-20`, `src/lib/server/http/body.ts:19-20`, `src/lib/shared/images.ts:2`, `src/lib/components/admin/image-selection.svelte.ts:24-26`, `src/routes/admin/images/+page.svelte`, `src/lib/components/forms/WineDefinitionForm.svelte:61,74`, `src/lib/components/forms/ImagePicker.svelte:48`

**À faire**

- Décision « Formats d’image (SEC-06) », a3 m11 et API-07/5 : chaque entrée du zip passe par `detectImageType` avant la copie ; `.bmp` sort d’`IMAGE_EXTENSIONS` et de la route `/uploads` ; une entrée dont le nom a déjà été copié est signalée, pas écrasée.
- Décision « Formulaires de vin et de bouteille (UI-06) », a5 m5 : une image envoyée puis abandonnée (formulaire fermé sans enregistrer) est supprimée ; l’URL d’aperçu est révoquée au remplacement et au démontage.
- a3 R3-m15, DATA-05/Reste-3 et m12 : `download-images` envoie son zip en flux (comme les sauvegardes depuis 0.7.0), écouteur `error` sur l’archive, `finalize()` attendu : une image illisible donne une erreur, pas un plantage.
- a3 m13 et R3-m12 : un nouveau nom fait 255 octets au plus et garde une extension d’image ; la ligne est renommée dans la même opération que le fichier, avec retour arrière si l’une échoue.
- a3 m14 et API-07/15 : une seule limite, `MAX_WINE_IMAGE_BYTES`, pour `upload-image` et `/api/upload/image`. a5 UI-06/Reste-2 : la limite vise le fichier, pas tout le corps multipart (une image de 20 970 603 octets passe).
- Décision « Sélection d’images (BUG-12) », a3 m15 : la liste des images de l’admin donne les vins qui les utilisent (`winesUsingImages`), et la recherche porte aussi sur leurs noms ; changer la recherche retire toujours de la sélection ce qu’elle masque.
- API-07/14 : les URL d’image sont encodées (`paths.ts:19-20`) : un nom avec espace, `#` ou `?` s’affiche.
- a7 m17, en partie fait (le test de `import-images-zip` existe depuis eeef0440) : un test de `GET /uploads/wines/<nom>` (en-têtes, 404 pour `..`). Ne toucher ni à `features/backup` ni à `zip.ts` (DATA-12, même lot).
- `docs/API.md` (limite, formats, nouvelle réponse de la liste) et une phrase dans le résumé 0.11.0.
- Fait en P9 (2026-10-23, 12048500..a170f3b8) : chaque fichier d’un zip d’images est reconnu par son contenu ; le zip des images part en flux, avec une erreur pour un fichier illisible ; le nom d’une image est limité, et sa ligne et son fichier sont renommés ensemble ; une seule limite de 20 Mo par image, du formulaire comme de l’admin ; l’admin montre et cherche les images par les vins qui les utilisent ; l’URL d’une image est encodée ; une image envoyée pour un vin que le formulaire n’a pas enregistré est supprimée, sans toucher celles d’un enregistrement en cours ; les images BMP déjà importées s’affichent toujours, et les notes de version disent de les convertir.
- Trouvé pendant DATA-13 (hors périmètre) : `restore.ts` refait la détection d’image d’`upload.ts` (`readHead`, `IMAGE_HEAD_BYTES`) ; l’écriture du zip d’images refait celle du zip de sauvegarde ; commentaire périmé de la route `/uploads` ; toast après la fermeture du formulaire quand l’enregistrement échoue ; les résultats de l’import zip ne montrent que les noms de base ; renommer a.jpg en A.jpg échoue sur un disque insensible à la casse ; les images orphelines ne sont pas nettoyées à la fermeture de l’onglet ni au rechargement ; la marge de 64 Ko pour le multipart vaut pour tous les envois de formulaire.

**Critère d’acceptation** : Un zip qui contient un `.bmp` ou un faux `.jpg` (texte) les signale sans les copier ; télécharger les images avec un fichier illisible répond une erreur et le serveur reste en marche ; renommer avec un nom de 300 caractères répond 422 ; une image de 20 970 603 octets s’envoie depuis le formulaire et depuis l’admin ; fermer le formulaire de vin après avoir choisi une image ne laisse aucun fichier dans `uploads/`.

**Sources** : T2 de l’audit (audit-pre-1.0/synthese.md#T2), audit-pre-1.0/axe-3-api-admin.md#m11–m15, R3-m12, R3-m15, DATA-05/Reste-3, audit-pre-1.0/axe-5-interface.md#m5, UI-06/Reste-2, audit-pre-1.0/axe-7-infra.md#m17, Trouvé pendant API-07 (5, 14, 15), Décisions « Formats d’image (SEC-06) », « Formulaires de vin et de bouteille (UI-06) », « Sélection d’images (BUG-12) »

### BUG-19 · Codes-barres : préfixe exact, casse et bouteilles bues

Sévérité **mineur** · effort **M** · dépend de DATA-11, UI-13 · statut **Fait**

**Suivi** (2026-10-23) : 9d2eb92d..1440e075

**Problème** : Le compteur et l’export « du préfixe » passent par `LIKE` : ils ignorent la casse, prennent les préfixes plus longs et traitent `_` et `%` comme des jokers, alors que la numérotation compare exactement. La saisie groupée trouve ambigu un code exact quand un autre ne diffère que par la casse. En mode automatique, POST remplace sans le dire le code donné, et donne un code à une bouteille créée bue. Un ancien préfixe de plus de 6 caractères fait répondre 500. Après une reconnexion, le formulaire de bouteille ne recharge pas les réglages.

**Fichiers** : `src/lib/server/features/barcode/repository.ts:52-58,116,164`, `src/lib/server/features/barcode/service.ts:73,95`, `src/lib/shared/barcode.ts:125,180,191-193`, `src/lib/server/features/bottles/service.ts:75-84,106-111`, `src/lib/components/BulkBarcodeDialog.svelte:99,177-182`, `src/lib/components/BarcodeDialog.svelte:22`, `src/lib/components/forms/WineBottleForm.svelte:81,100-113`

**À faire**

- Décision « Petits choix (audit d’avant 1.0) », a5 m20 : un code est d’abord cherché à l’identique, majuscules comprises, puis sans casse. Mettre ces deux étapes dans une fonction partagée (par exemple dans `bulk-barcode.ts`) ; chaque écran garde ensuite son dernier repli : « se termine par » pour la saisie groupée ici, « contient » pour la recherche de la liste des vins, qui la reprendra dans UI-14.
- Décision « Import CSV (API-04) », a2 m4 : comme l’import, `createBottles` ne donne un code automatique qu’à une bouteille disponible.
- a6 m1 et API-07/10 : le compteur et l’export du préfixe prennent la condition exacte de `highestGeneratedBarcodeNumber` (`substr`, sensible à la casse, chiffres après le préfixe), sans `LIKE`.
- Décision « Code-barres donné en mode automatique (BUG-19) », a2 m3 et API-07/18 : en mode automatique, `POST /api/bottles` garde le code donné quand il crée une seule bouteille, comme PATCH, sans prendre de numéro de la séquence, et répond 422 `barcode_for_one_bottle` quand le code est donné pour plusieurs (aujourd’hui seulement en mode manuel, `bottles/service.ts:76-81`) ; ce contrôle et celui de `updateBottles` passent par une seule fabrique de l’erreur (partie de a2 m8). Test avec un code différent de celui de la séquence.
- a6 m5 : dire dans le commentaire de `repository.ts:52-58` et dans le dialogue des réglages qu’un préfixe vide ou numérique partage ses numéros avec les préfixes numériques plus longs.
- a6 m6 : exporter `QUIET_ZONE_MODULES` et l’utiliser dans `BarcodeDialog` ; le message de `BarcodeRangeError` dit « de 1 à … », comme le service.
- Décision « Préfixe de code-barres (SEC-05) », API-07/8 : un ancien préfixe de plus de 6 caractères donne une erreur de l’API (409 ou 422 avec un code), pas une 500, pour next-barcode et le PDF. API-07/9 : codes automatiques éteints, next-barcode répond comme export-all (409) au lieu de `200 { barcode: "" }`, et le formulaire le gère.
- a5 m6 : le formulaire de bouteille recharge les réglages de code-barres après une connexion réussie. a5 m21 : `wines.flatMap((wine) => wine.bottles)`.
- Tests qui échouent avant ; `docs/API.md` et une phrase dans le résumé 0.11.0 (POST, next-barcode).
- Fait en P9 (2026-10-23, 9d2eb92d..1440e075) : la saisie groupée trouve d’abord le code exact (`findSameBarcode`, repris par UI-14), puis le même code en d’autres capitales, en montrant le vrai code ; comptes et export par plage sur les codes exacts du préfixe ; un code donné à une bouteille créée seule est gardé, refusé pour plusieurs (422 `barcode_for_one_bottle`) ; un ancien préfixe trop long répond 409 `barcode_prefix_too_long` (409 plutôt que 422, choix du responsable) et la page des codes-barres l’affiche au lieu d’une erreur 500 ; `next-barcode` répond 409 `barcode_generation_off` quand la génération est coupée, avec une action de mise à jour (dafbb929, fondue dans l’action « scripts » par API-09) ; marge silencieuse partagée ; la page dit qu’un préfixe partage sa numérotation avec ses prolongements en chiffres ; le formulaire recharge le prochain code après une connexion et propose le champ à une bouteille créée bue.
- Trouvé pendant BUG-19 (hors périmètre) : avec un ancien préfixe trop long, le badge du prochain code déborde et la carte CSV répète le message ; le libellé « Bottles with Barcode » ne correspond pas au nombre affiché ; numéro de départ de l’export CSV codé en dur à 5 ; deux formulations de la session expirée ; l’erreur du champ code-barres reste après le passage à « Bue » (cosmétique).

**Critère d’acceptation** : Avec les codes `CV00000001` et `cv00000002` et le préfixe `CV`, le compteur et l’export n’en comptent qu’un ; avec `CV00000001` et `cv00000001`, la saisie groupée de `CV00000001` trouve une seule bouteille ; `POST /api/bottles` d’une bouteille avec un code donné en mode automatique la crée avec ce code, et de deux bouteilles avec un code répond 422 `barcode_for_one_bottle` ; une bouteille créée « Consommée » n’a pas de code ; next-barcode avec un préfixe de 8 caractères en base ne répond pas 500.

**Sources** : T4 de l’audit (audit-pre-1.0/synthese.md#T4), audit-pre-1.0/axe-6-pages.md#m1, m5, m6, audit-pre-1.0/axe-2-api-securite.md#m3, m4, m8 (fabrique de `barcode_for_one_bottle`), audit-pre-1.0/axe-5-interface.md#m6, m20, m21, Trouvé pendant API-07 (8, 9, 10, 18), Décisions « Petits choix (audit d’avant 1.0) », « Import CSV (API-04) », « Préfixe de code-barres (SEC-05) », « Code-barres donné en mode automatique (BUG-19) »

### API-08 · Import CSV : restes de l’audit

Sévérité **mineur** · effort **L** · dépend de DATA-11, DATA-12, DATA-13 · statut **Fait**

**Suivi** (2026-10-28) : 168a454f..88d7de89

**Problème** : L’API compare les noms des référentiels avec la casse, l’import CSV sans. Régions et appellations sont rapprochées par leur nom seul. Un CSV aux lignes inégales échoue en entier. Le rapport liste chaque ligne sautée et finit en 500 sur un gros fichier, signale une colonne `filename` que le fichier n’a pas et affiche l’identifiant brut de la table. Une ligne de vin invalide est annoncée « Déjà dans la cave ». Côté admin : pas d’essai à blanc, les tables et les codes-barres sont redevinés par le client, l’option « Remplacer tous les codes-barres » reste cochée et coupe sans le dire la détection des doublons, un `.CSV` est refusé.

**Fichiers** : `src/lib/server/features/shared/lookup-crud.ts:89`, `src/lib/server/features/csv-import/`, `src/routes/api/admin/import-csv/+server.ts`, `src/routes/admin/backups/+page.svelte:201-202,216-219`, `src/lib/components/admin/csv-tables.ts`, `src/lib/components/admin/dialogs/CsvImportDialog.svelte`, `src/lib/components/admin/dialogs/BarcodeOverrideDialog.svelte`, `src/lib/components/admin/dialogs/CsvImportResultsDialog.svelte`, `src/lib/components/admin/dialogs/ZipImportResultsDialog.svelte`

**À faire**

- Décision « Référentiels (API-03) », a3 m8 et API-07/1 : le nom d’un référentiel est comparé sans casse (`lower(trim(name))` dans `findOrCreate`), sans migration de fusion.
- Décision « Petits choix (audit d’avant 1.0) », a4 m9 : le rapport donne `table` et `file` séparément, le client compose le titre traduit ; la nouvelle forme de la réponse tient en une phrase des notes de version.
- BUG-15/1 (= BUG-18/1) : dans `importRow`, valider une ligne de vin avant de la sauter en `same_name` : une ligne invalide est signalée comme telle.
- a3 API-04/Reste-1, partie régions et appellations : rapprocher une région avec son pays et une appellation avec sa région quand le fichier les donne ; les cases sont traitées par UI-12 (UI-09/Reste-6).
- a3 API-04/Reste-2 : une ligne de longueur différente est signalée seule (`relax_column_count`), les autres sont importées.
- a3 m9 : au-delà d’un seuil (par exemple 1 000), le rapport donne le nombre de lignes sautées ou en erreur et les premières seulement.
- a3 m10 : l’erreur d’un `imageName` invalide est signalée sur la colonne `imageName`.
- a3 m7 : l’aide de « Remplacer tous les codes-barres » dit que toutes les lignes sont ajoutées, sans recherche de doublons (comportement inchangé). a4 m3 : l’option est décochée à chaque ouverture.
- a4 UI-07/Trouvé-13 et Reste-1a : un bouton « Essai à blanc » envoie `dryRun` et montre le rapport sans rien écrire.
- a4 UI-07/Trouvé-14 et Reste-1b : les tables et la présence de codes-barres viennent du serveur (`tableOfFile`), plus de `includes('bottles')` ni de copie dans `csv-tables.ts`.
- a4 m7 : `.CSV` accepté (`toLowerCase()`). a4 m4 et a5 UI-05/Trouvé-2 (les trois avertissements de `BarcodeOverrideDialog.svelte:16` et `CsvImportDialog.svelte:20`) : retirer `isImportingCsv`, les valeurs par défaut mortes et les commentaires « // Props » des huit dialogues. a4 R4-m8b : une clé aux six `{#each}` restants.
- Tests qui échouent avant ; `docs/API.md` et une phrase dans le résumé 0.11.0.
- Fait en P9 (2026-10-28, 168a454f..88d7de89) : un pays, une région ou une appellation sont trouvés par leur nom sans tenir compte des capitales à l’ajout ; l’import CSV finit ce que demandait l’audit (essai à blanc sans rappel des images, extension `.CSV`, erreur qui nomme le parent, par exemple « Porto (Algarve) ») ; commentaires « quoi » des dialogues retirés, résultats du zip indexés par une clé. 16 tests échouent avant. Changement absent des notes de version : un nom connu sous un parent inconnu est maintenant signalé inconnu au lieu d’être sauté.
- Trouvé pendant API-08 (hors périmètre) : `PUT /api/<table>/{id}` reste sensible à la casse (renommer en « FRANCE » quand « France » existe) ; avertissement `prefer-svelte-reactivity` dans `image-selection.svelte.ts` ; valeur par défaut morte dans `ZipImportInfoDialog.svelte:14` ; pendant un essai à blanc du fichier des bouteilles, le dialogue des codes-barres dit encore « Proceed with Import » ; aucun test automatique de l’essai à blanc, de `.CSV` ni de la remise à zéro de l’option des codes-barres.

**Critère d’acceptation** : Créer « france » par l’API quand « France » existe renvoie « France » ; un CSV dont une ligne a une colonne de trop importe les autres et signale celle-là ; un CSV de 20 000 lignes sautées répond sans 500 ; « Essai à blanc » montre le rapport et la base ne change pas ; une ligne de vin invalide déjà présente est signalée invalide ; `pnpm lint` ne donne plus d’avertissement dans les dialogues d’import.

**Sources** : T3 de l’audit (audit-pre-1.0/synthese.md#T3), audit-pre-1.0/axe-3-api-admin.md#m7–m10, API-04/Reste-1, API-04/Reste-2, audit-pre-1.0/axe-4-front-admin.md#m3, m4, m7, m9, R4-m8b, UI-07/Trouvé-13, Trouvé-14, Reste-1a, Reste-1b, audit-pre-1.0/axe-5-interface.md#UI-05/Trouvé-2 (trois avertissements sur quatre), Trouvé pendant BUG-15 (1) = BUG-18 (1), API-07 (1), Décisions « Référentiels (API-03) », « Petits choix (audit d’avant 1.0) »

### BUG-20 · Étiquettes et scanner : restes de l’audit

Sévérité **mineur** · effort **M** · dépend de DATA-11, BUG-19 · statut **Fait**

**Suivi** (2026-10-28) : e4ef8f15..d6064b61

**Problème** : La hauteur du code-barres contrôlée n’est pas celle que le PDF dessine. Une plage hors limites ou un préfixe invalide laissent le bouton PDF actif, et le numéro de départ n’est pas borné selon le préfixe. Une copie de `label_presets.csv` aux fins de ligne CRLF n’est pas reconnue. L’aperçu de la plage répète son erreur. Le scanner ne dit rien quand la caméra est débranchée, et dit « connexion sécurisée » à un navigateur sûr sans caméra.

**Fichiers** : `src/lib/shared/labels.ts:117,126-130`, `src/lib/server/features/labels/pdf.ts:49-52`, `src/lib/components/barcode/label-options.svelte.ts`, `src/lib/components/barcode/LabelPdfCard.svelte:153-163`, `src/lib/components/barcode/CsvRangeCard.svelte:76`, `src/lib/components/barcode/BarcodeRange.svelte:8-14,22-24`, `src/lib/shared/schemas/label.ts:37`, `src/lib/server/db/migrations.ts`, `scripts/data/label_presets.csv:7`, `src/lib/components/barcode/camera-error.ts:26`, `src/lib/components/QrScannerDialog.svelte:78`

**À faire**

- Décision « Copie CRLF des préréglages d’étiquettes (BUG-16) », BUG-16/2 : l’empreinte de la copie de `label_presets.csv` se calcule sur le texte aux fins de ligne LF, pour qu’une copie en CRLF identique soit reconnue et remplacée ; ajouter l’empreinte du fichier livré corrigé (BUG-16/1) à `OUTDATED_DEFAULTS`. Le fichier est sous `src/lib/server/db/` après DATA-11.
- Décision « Limites acceptées (audit d’avant 1.0) », a6 UI-08/Trouvé-4d : une caméra débranchée pendant un scan (`ended`, `inactive`) affiche un message et « Réessayer ».
- Décisions « Étiquettes (BUG-16) » et « Messages d’erreur (P7) » : un bouton n’est grisé que si la raison est visible avant le clic.
- BUG-16/1 : l’Avery 8160 est décrit « Inkjet » dans le CSV livré ; si les préréglages en base portent cette description, une migration la corrige seulement là où elle est encore celle d’origine, comme 0009.
- a6 UI-08/Reste-1 : le contrôle et le PDF utilisent la même hauteur de barres (une seule fonction).
- a6 UI-08/Reste-2 et BUG-16/4 : le numéro de départ et la plage sont bornés selon ce que le préfixe permet (même règle que `formatBarcodeRange`), dans le schéma partagé ; un préfixe manuel invalide ou une plage hors limites grisent « PDF » et « CSV » avec la raison visible.
- BUG-16/3 : l’aperçu de la plage n’affiche l’erreur qu’une fois, nombres au format de la langue. BUG-16/6 : à 390 px, la raison qui grise les boutons des préréglages est près de ces boutons ou de la liste des erreurs (vérifier à 390 px).
- a6 m16 : distinguer une page non sûre d’un navigateur sans `getUserMedia` (nouvelle clé, par exemple `scanner.no_camera_api`).
- Tests qui échouent avant ; une phrase dans le résumé 0.11.0 (CSV en CRLF, Avery 8160).
- Fait en P9 (2026-10-28, e4ef8f15..d6064b61) : migration 0012 (mode custom de drizzle-kit) : l’Avery 8160 est décrite « jet d’encre », et une copie CRLF de `label_presets.csv` est reconnue ; une seule fonction de hauteur de barres pour le contrôle et le PDF (décision « Hauteur des codes-barres (BUG-20) »), donc la DK-11201, les Dymo 30252 et 99010 et la mise en page par défaut avertissent désormais sous 25 mm ; la plage de codes est bornée par ce que le préfixe permet ; la raison qui grise un bouton de préréglage s’affiche à côté ; le scanner dit quand la caméra s’arrête ou que le navigateur n’a pas d’API caméra. Preuve sur des bases créées par le build 0.10.0 ; 17 tests échouent avant.
- Trouvé pendant BUG-20 (hors périmètre) : en mode automatique, un ancien préfixe avec un caractère hors Code 128 (É) laisse le bouton PDF actif, et le serveur répond 409 `barcode_not_encodable` ; l’exemple de `label_too_small` dans docs/API.md donne un `actual` faux ; `shared/barcode.ts:154-158` construit son expression régulière à chaque appel.

**Critère d’acceptation** : Une copie de `label_presets.csv` d’origine convertie en CRLF est remplacée au démarrage, une copie modifiée ne l’est pas ; avec le préfixe `ABCDEF`, un numéro de départ de 99 999 refuse PDF et CSV avec la raison visible ; DK-11204 contrôle la hauteur que le PDF dessine ; couper la caméra factice de Chromium pendant un scan affiche un message.

**Sources** : T5 de l’audit (audit-pre-1.0/synthese.md#T5), audit-pre-1.0/axe-6-pages.md#m16, UI-08/Reste-1, Reste-2, Trouvé-4d ; m17 et UI-08/Reste-3 déjà faits (BUG-14, 8eafa05a), Trouvé pendant BUG-16 (1, 2, 3, 4, 6), Décisions « Copie CRLF des préréglages d’étiquettes (BUG-16) », « Limites acceptées (audit d’avant 1.0) », « Étiquettes (BUG-16) », « Messages d’erreur (P7) »

### UI-11 · Historique, hors cave, statistiques et manques

Sévérité **mineur** · effort **M** · dépend de DATA-11, UI-13 · statut **Fait**

**Suivi** (2026-10-28) : b1256198..40dcfa73

**Problème** : L’historique et le hors cave trient par octets (casse, accents, vides en tête) ; changer de filtre perd le tri ; « Date de consommation » trie par date d’achat hors « Consommées ». Les deux pages recopient leurs contrôles, avec deux sélecteurs « éléments par page » différents, et leur bouton « Retour » ne fait rien sur une page ouverte directement. Les statistiques fusionnent deux régions homonymes, affichent 0,00 € pour une moyenne sans prix et un cadre vide ; les listes « top 10 » n’ont que 9 lignes ; un prix de 0 devient « N/A » dans les manques. Ces règles n’ont aucun test.

**Fichiers** : `src/lib/server/features/bottles/repository.ts:114-124,150,321,334,336,373,466-468`, `src/lib/server/features/bottles/service.ts:180-211`, `src/lib/server/features/bottles/list.test.ts:61`, `src/routes/cellar-history/`, `src/routes/out-of-cellar/`, `src/routes/statistics/+page.svelte:165,173,301,342,427-432,471`, `src/routes/wine-shortage/+page.svelte:26,64,92,240,366`, `src/routes/wines/[id]/+page.svelte:230`

**À faire**

- Décision « Tri de l’historique et du hors cave (UI-04, UI-07) », a6 m2, a5 UI-02/Trouvé-1b : même ordre que les autres tableaux, sans casse ni accents, vides en dernier (better-sqlite3 n’a pas de collation : tri en mémoire avec `compareValues` avant la pagination, ou clé normalisée) ; aligner `list.test.ts:61`.
- Même décision, a4 UI-07/Trouvé-3, Trouvé-4, Reste-4 et a6 m10 : changer de filtre garde le tri ; sur « Tous », « Date de consommation » trie par cette date, bouteilles non bues en dernier ; sur « En cave », la colonne est retirée. Revoir le test qui fige l’inverse (`cellar-history/page.server.test.ts:51`).
- Décision « Formats et tableaux (UI-02) », a6 m11 et a5 UI-02/Reste-2 : un seul sélecteur « éléments par page » partagé (le Select bits-ui), une seule liste des colonnes importée par le load et la page, `common.back` seul, un seul total.
- a5 UI-05/Reste-2 : « Retour » mène à la page d’où l’on vient, ou à une page par défaut (la liste) quand la page a été ouverte directement, sur le hors cave, l’historique et la page vin (`wines/[id]/+page.svelte:230`, une ligne, après UI-13).
- a6 m15 : les statistiques groupent par `regions.id` et affichent le pays quand deux régions ont le même nom. API-07/11 : retirer le groupe sans nom avant de prendre les 10 premiers (producteurs, pays, régions).
- a6 m14 : une moyenne sans aucun prix affiche N/A ; a6 m8 : pas de cadre « Millésimes récents » vide ; a6 m9 : un prix d’achat de 0 s’affiche 0 dans les manques.
- a6 m12 et API-07/13 : retirer le code mort des manques et des statistiques, dont la garde inatteignable de `getWineShortages`. a5 UI-05/Reste-3 : `winesBelowTarget` a un tri secondaire (nom).
- a6 m4 : tests de service pour `getWineShortages` et `getStatistics` (bouteilles sorties et bues, cible nulle, millésime absent, régions homonymes).
- Une phrase dans le résumé 0.11.0 : le tri annoncé en 0.8.0 vaut maintenant aussi pour l’historique et le hors cave.
- Fait en P9 (2026-10-28, b1256198..40dcfa73) : historique et hors cave triés comme les autres tableaux, tri par défaut gardé au changement de filtre ; contrôles de tableau partagés (`pagination.per_page`) ; « Retour » marche sur une page ouverte directement ; statistiques : régions groupées par identifiant (`/api/statistics` donne `id` et `country`), chiffres des statistiques et du manque corrigés (moyennes N/A, prix à 0, message des millésimes, libellé du pays). Les corrections dans les pages sont prouvées dans Chromium seulement, faute d’outil de test de composants.
- Trouvé pendant UI-11 (hors périmètre) : le tri par statut suit les codes internes, pas les libellés traduits (tous les tableaux de bouteilles) ; `?.` et `|| 0` inatteignables dans la page des statistiques. Point ouvert, voulu : après Précédent ou Suivant du navigateur, le « Retour » de la page mène à `/wines`.

**Critère d’acceptation** : Dans l’historique, « émile », « Zoé » et « Éric » se trient Émile, Éric, Zoé, les vides en dernier, et le tri reste après un changement de filtre ; sur « Tous », le tri par date de consommation met les non bues en dernier ; deux régions « Bourgogne » de deux pays font deux lignes dans les statistiques ; « Retour » sur une page ouverte dans un nouvel onglet mène à la liste ; les tests de service passent et échouent sur les défauts d’avant.

**Sources** : T6 de l’audit (audit-pre-1.0/synthese.md#T6), audit-pre-1.0/axe-6-pages.md#m2, m4, m8–m12, m14, m15, audit-pre-1.0/axe-4-front-admin.md#UI-07/Trouvé-3, Trouvé-4, Reste-4, audit-pre-1.0/axe-5-interface.md#UI-05/Reste-3, UI-02/Trouvé-1b, UI-02/Reste-2, UI-05/Reste-2, Trouvé pendant API-07 (11, 13), Décisions « Tri de l’historique et du hors cave (UI-04, UI-07) », « Formats et tableaux (UI-02) »

### REL-05 · Image Docker et CI : restes de l’audit, version dans l’admin

Sévérité **mineur** · effort **M** · dépend de QA-05 · statut **Fait**

**Suivi** (2026-10-28) : 3238d87a..5ba8e8c4

**Problème** : Ni la CI ni la release ne démarrent l’image avant de la publier. Le healthcheck est défini deux fois, avec des délais différents. L’image de base n’est pas épinglée, le contexte de build emporte `.claude/` et `.omc/`, et l’image garde les dépendances optionnelles de jsPDF et les binaires better-sqlite3 de huit plateformes. `prepare` ne peut pas échouer. La CI ne vérifie pas que `schema.ts` et `drizzle/` concordent, et `check-origin.mjs` peut ouvrir la base du développeur. La version de Cellar ne s’affiche que dans Préférences.

**Fichiers** : `Dockerfile:2,8,19,24-25,31,34,70`, `package.json:14`, `docker-compose.yml:30-39`, `.dockerignore`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `scripts/check-origin.mjs:36`, `src/routes/admin/+layout.svelte`, `src/routes/preferences/+page.svelte:389`, `AGENTS.md`

**À faire**

- Décision « Version de Cellar (REL-03) », REL-03/3 : la version (`__APP_VERSION__`) s’affiche aussi dans l’admin, par exemple sous le titre de `admin/+layout.svelte`, visible sur toutes les pages admin ; même clé de texte que Préférences si possible.
- Décision « Healthcheck et racine (UI-04) », a7 R7-m3 : un seul healthcheck, dans le Dockerfile, avec les délais du compose (10 s, 40 s au démarrage) ; celui de `docker-compose.yml` est retiré. Une phrase dans le résumé 0.11.0 pour qui a copié le compose (sans action : son healthcheck reste valide).
- Décision « Actions GitHub épinglées (SEC-10) » pour toute action ajoutée ou mise à jour.
- a7 m5 : dans `release.yml`, chaque job de la matrice (amd64 sur `ubuntu-24.04`, arm64 sur `ubuntu-24.04-arm`) charge son image, la lance et attend `healthy` avant de la pousser par digest, donc avant `imagetools create` ; la même vérification tourne dans `ci.yml` sur chaque pull request, ce qui la prouve sans tag. `check-origin.mjs` vérifie aussi que `GET /` répond 200.
- a7 m8 : `FROM node:24.x.y-alpine3.zz@sha256:…`, image publiée depuis au moins 7 jours, mise à jour selon la règle de SEC-10 ; une ligne dans AGENTS.md, à côté de celle des actions.
- a7 m7 : `.claude/`, `.omc/` et `docs/` dans `.dockerignore` (ou une liste blanche). a7 m3 : retirer `pnpm run prepare` du Dockerfile (lignes 24-25), le build fait le même travail. a5 UI-10/Reste-14, même script `prepare` (`Dockerfile:8,19`) : plus d’ENOENT sur `project.inlang` au premier `prepare` de `pnpm install` dans le build, sans masquer une vraie erreur.
- a7 m11 et a7 DEP-04/Reste-5 : mesurer `pnpm prune --prod --no-optional` et le retrait des `prebuilds` et `deps/` de better-sqlite3 inutiles ; garder ce qui réduit l’image sans casser better-sqlite3 ni le PDF (taille avant et après dans le rapport).
- a1 m4 : une étape de CI `pnpm db:generate` puis `git diff --exit-code drizzle/`. a1 m3 : `check-origin.mjs` passe à son serveur des chemins de données jetables, jamais `...process.env` seul.
- Fait en P9 (2026-10-28, 3238d87a..5ba8e8c4) : version de Cellar sous le titre de l’admin (décision « Version de Cellar (REL-03) ») ; `check-origin.mjs` sur des données jetables, et `/` doit répondre 200 ; la CI échoue si `schema.ts` change sans sa migration ; image de base `node:24.22.0-alpine3.24` épinglée par son digest ; contexte de build sans worktrees, notes ni docs ; installation et prune sans scripts, `prepare` peut échouer ; prune `--no-optional` (décision « Types en production (DEP-04) ») et fichiers inutiles de better-sqlite3 retirés, avec un arrêt si son binaire manque ; healthcheck dans le Dockerfile seul ; nouveau job `image` (`scripts/check-image.sh`) qui démarre l’image jusqu’à `healthy`, aussi lancé par `release.yml` avant toute publication. Image arm64 de 321,8 à 262,1 Mo, amd64 de 327,4 à 267,3 Mo.
- Trouvé pendant REL-05 (hors périmètre) : la liste de la CI du README oublie knip et le contrôle des migrations (a7 m6, réglé par DOC-03 en P10) ; `release.yml` publie une seconde construction (depuis le cache), pas l’image contrôlée ; le job `image` tourne aussi pendant une release, par la reprise de `ci.yml` (des minutes en plus).

**Critère d’acceptation** : La version s’affiche sur toutes les pages de l’admin ; une image qui ne devient pas `healthy` fait échouer la CI d’une pull request et, dans la release, arrête le job avant tout push (preuve en local : la même étape, lancée sur une image dont le démarrage est cassé, échoue ; sans push ni tag) ; `docker inspect` ne montre qu’un healthcheck ; une modification de `schema.ts` sans migration fait échouer la CI ; la taille de l’image avant et après est donnée.

**Sources** : T13 de l’audit (audit-pre-1.0/synthese.md#T13), audit-pre-1.0/axe-7-infra.md#m3, m5, m7, m8, m11, R7-m3, DEP-04/Reste-5 ; m22 et QA-04/Reste-1 déjà faits (REL-03, matrice de `release.yml`), audit-pre-1.0/axe-5-interface.md#UI-10/Reste-14 (de T15, même script `prepare`), audit-pre-1.0/axe-1-donnees.md#m3, m4, Trouvé pendant REL-03 (3), Décisions « Version de Cellar (REL-03) », « Healthcheck et racine (UI-04) », « Actions GitHub épinglées (SEC-10) »

### UI-12 · Stockage : noms uniques, confirmation partagée et restes d’UI-09

Sévérité **mineur** · effort **L** · dépend de DATA-11, DATA-12, API-08, BUG-20, REL-05 · statut **Fait**

**Suivi** (2026-10-28) : 43e41928..b4afb587

**Problème** : Deux conteneurs, ou deux cases d’un conteneur, peuvent porter le même nom, que l’export CSV des bouteilles et l’import confondent. Le serveur colle le suffixe au nom du conteneur et retire l’espace tapé. Une case importée se range en position 0, un brouillon ancien supprime une case créée entre-temps, un conteneur sans case n’offre aucun bouton. `containerLabel` retire « Column » au milieu d’un nom. Supprimer un conteneur passe par `confirm()` natif, un préréglage d’étiquettes part sans confirmation, et la confirmation de l’admin survit à la navigation.

**Fichiers** : `src/lib/server/db/schema.ts:146,162,168 (après DATA-11)`, `drizzle/`, `src/lib/server/features/storage/service.ts:106-107,176-179,209`, `src/lib/server/features/storage/repository.ts:16-17`, `src/lib/shared/schemas/storage.ts:5,18-31`, `src/lib/shared/storage.ts:6`, `src/lib/server/features/csv-import/tables.ts:45-48`, `src/lib/server/features/backup/repository.ts:180`, `src/lib/components/storage/`, `src/routes/storage/+page.svelte:114`, `src/lib/components/admin/confirm.svelte.ts`, `src/routes/admin/+layout.svelte:50`, `src/routes/+layout.svelte`, `src/lib/components/barcode/PresetManager.svelte:247`

**À faire**

- Décision « Page stockage (UI-09) », a1 m1, a6 m19, UI-09/Reste-2 et API-07/2 : un nom de conteneur est unique et les suffixes sont uniques dans un conteneur (409) ; une migration renomme les doublons existants (« A (2) »), jamais fusionnés, puis pose les index uniques ; pas de séparateur automatique : seuls les espaces de fin d’un suffixe sont retirés, un espace tapé devant est gardé ; l’exemple du champ passe à « Cave A, Frigo » ; l’export CSV des bouteilles donne aussi `containerName`.
- Décision « Champs numériques (BUG-14) », a6 UI-09/Reste-4 : l’API garde « capacité absente = 5 » pour les scripts, et le dialogue refuse déjà une capacité vide (BUG-14) : rien d’autre à faire. BUG-14/2 : une erreur du serveur s’affiche sous le champ concerné du `ContainerDialog`, sans le toast générique `invalid_body` en plus.
- Décision « Messages d’erreur (P7) » pour tous les messages ajoutés.
- a4 m1, a6 m18 et a6 R6-m6c : la confirmation générique passe dans le layout racine et se ferme à la navigation (`beforeNavigate`) ; elle remplace le `confirm()` natif de `ContainerDialog` et précède la suppression d’un préréglage (`PresetManager`).
- a6 UI-09/Reste-6 et la partie « cases » de a3 API-04/Reste-1 (voir API-08) : l’import CSV retrouve une case par son conteneur et son nom. a6 UI-09/Reste-1 : une case importée dans un conteneur existant prend le plus grand numéro + 1, sauf si le fichier donne `position`.
- a6 UI-09/Reste-3, en partie fait (une case qui a des bouteilles n’est plus supprimée) : le PUT d’un conteneur peut porter son `updatedAt` (facultatif, pour ne pas casser les scripts) et reçoit 409 si le conteneur a changé entre-temps, au lieu de supprimer une case vide créée par un autre onglet.
- a6 UI-09/Reste-5 : un conteneur sans case montre un bouton pour en ajouter. a6 m13 : une case de grande capacité dessine 24 places au plus, puis « +N ». a6 m7 : `containerLabel` ne retire « Column » qu’en tête (`/^Column /`).
- a5 UI-06/Reste-1 : `listContainers` trie comme le service (`compareText(containerLabel(…))`).
- Tests qui échouent avant (migration avec doublons, 409, import par conteneur) ; `docs/API.md` et une phrase dans le résumé 0.11.0 (renommage des doublons, nouvelle colonne, 409).
- Fait en P9 (2026-10-28, 43e41928..b4afb587) : noms de conteneurs et suffixes de cases uniques à l’identique, par les migrations 0013 (mode custom, qui renomme les doublons) et 0014 (index uniques), et un 409 (décision « Noms de rangement uniques (UI-12) ») ; l’import CSV trouve une case par son conteneur et son nom, et marque le conteneur modifié quand il ajoute une case ; toutes les confirmations passent par un dialogue du layout racine (`src/lib/components/layout/`), affiché au-dessus du dialogue qui la demande ; les refus s’affichent sous leur champ dans le dialogue de conteneur. La correction de `caseSuffix` (« Haut1 » et « Bas1 » donnaient le même suffixe, donc un 409) est passée dans API-09.
- Trouvé pendant UI-12 (hors périmètre) : `DELETE /api/storage-cases/{id}` ne change pas l’`updatedAt` du conteneur, donc un brouillon ancien reçoit 404 au lieu de 409 ; le dialogue de conteneur grise « Enregistrer » pour un nom vide sans dire pourquoi (antérieur) ; un nom de case en double rougit aussi le champ de capacité (`ContainerDialog.svelte:175,183`) ; `updatedAt` à la seconde près (documenté) ; paramètre inutilisé dans `WineBottleDialog.svelte:36` ; `AllBottlesDialog.svelte:123` ne vide pas la bouteille modifiée ; `BulkBarcodeDialog` fait 485 lignes.

**Critère d’acceptation** : Une base avec deux conteneurs « A » et deux cases « A1 » est mise à jour en « A » et « A (2) », sans perte de bouteille ; créer un second conteneur « A » répond 409 ; un suffixe «  haut » donne « Frigo haut » ; un export de bouteilles puis un import dans une cave vide remet chaque bouteille dans sa case ; supprimer un conteneur ou un préréglage passe par la confirmation de Cellar, qui disparaît si l’on quitte la page.

**Sources** : T7 de l’audit (audit-pre-1.0/synthese.md#T7), audit-pre-1.0/axe-6-pages.md#m7, m13, m18, m19, R6-m6c, UI-09/Reste-1–6, audit-pre-1.0/axe-1-donnees.md#m1, audit-pre-1.0/axe-5-interface.md#UI-06/Reste-1, audit-pre-1.0/axe-4-front-admin.md#m1 (déplacé de T8, même correction que a6 m18), audit-pre-1.0/axe-3-api-admin.md#API-04/Reste-1 (partie cases), Trouvé pendant BUG-14 (2), API-07 (2), Décisions « Page stockage (UI-09) », « Champs numériques (BUG-14) », « Messages d’erreur (P7) »

### UI-14 · Liste des vins : découpage, filtres dans l’URL, données allégées

Sévérité **mineur** · effort **L** · dépend de UI-13, BUG-19, UI-11, QA-05 · statut **Fait**

**Suivi** (2026-10-28) : 746aaed6..17f43a5d

**Problème** : `WineListView` fait 957 lignes (filtres, recherche par code-barres, grille, cartes, six dialogues). Ses filtres vivent dans l’état local : revenir d’un vin les perd. La recherche refiltre et retrie tout à chaque frappe ; les filtres région et pays comparent des noms, et confondent deux régions homonymes ; la recherche par code-barres sélectionne des bouteilles bues que le dialogue ne montre pas. `/wines` envoie chaque bouteille, bues comprises, avec une copie de son vin et les champs de la première bouteille en tête : 1,4 Mo pour 700 bouteilles. « Ajouter une bouteille » reprend le vin d’un ajout annulé.

**Fichiers** : `src/lib/components/WineListView.svelte`, `src/routes/wines/+page.svelte:16-31,27,92-96`, `src/routes/wines/+page.server.ts:24`, `src/routes/wines/[id]/+page.svelte`, `src/lib/server/features/catalog/service.ts:142-157`, `src/lib/server/features/bottles/repository.ts:89-101`, `src/lib/components/WineDefinitionDialog.svelte`, `src/lib/components/WineBottleDialog.svelte`, `src/lib/components/BulkBarcodeDialog.svelte`, `src/routes/wine-shortage/+page.svelte:79-88`, `docs/API.md:417`

**À faire**

- Décision « Petits choix (audit d’avant 1.0) », a5 R5-Refacto-filtres-URL : les filtres et la recherche de la liste sont dans l’URL (`page.url`, `goto` avec `replaceState`) : revenir d’un vin les retrouve, un lien les partage.
- Même décision : la recherche par code-barres de la liste reprend la fonction partagée de BUG-19 (exacte, puis sans casse), puis garde son repli « contient ».
- a5 R5-Refacto-6a et R5-Refacto-structure : découper `WineListView` (par exemple `WineFilters`, `WineGrid`, `WineCard`, `BarcodeSearch`, dans `components/wines/`) ; UI-19 rangera ensuite les dossiers.
- a5 R5-Refacto-6c et R5-m23 : un délai d’attente (environ 200 ms) avant de refiltrer sur la recherche ; l’URL de l’image d’une carte lue une fois.
- a5 R5-m11 : les filtres région et pays comparent des ids (`valueField="id"`).
- a5 R5-m7 : la recherche par code-barres ne sélectionne que des bouteilles que le dialogue montre (possédées).
- a5 m22, R5-m24 et a5 UI-03/Reste-1 : `listWines` ne joint plus le vin à chaque bouteille (le groupe le porte ; `BulkBarcodeDialog` le prend dans le groupe) et ne répète plus en tête les champs de la première bouteille ; décision « Bouteilles bues de la liste des vins (UI-14) » : la page `/wines` ne charge que les bouteilles possédées (la saisie groupée ne trouve plus une bouteille bue, accepté), et `/api/wines` garde les bouteilles bues. `docs/API.md` et une phrase dans le résumé 0.11.0 pour les champs retirés de `/api/wines`, avec l’action conditionnelle « scripts » de la version, puisqu’un script peut les lire (même règle qu’API-09).
- a5 m1 : « Ajouter une bouteille » ne reprend pas le vin d’un ajout annulé ; a5 R5-M1/setTimeout : retirer le délai de 100 ms (`wines/+page.svelte:27`), l’`await invalidate` suffit.
- a5 m2 : les dialogues de vin et de bouteille n’ont qu’un rappel `onSaved(addAnother)`, sans `show… = false` redondants ; sur la page vin, un seul `WineBottleDialog` piloté par `{ mode, bottle }`.
- Mesurer la taille de `/wines` avant et après sur une cave de 100 vins et 700 bouteilles dont 300 bues.
- Fait en P9 (2026-10-28, 746aaed6..17f43a5d) : liste des vins découpée, filtres dans l’URL, données plus légères : `/wines/__data.json` passe de 757 010 à 309 985 octets (2,44 fois moins), critère lu sur les données de la page (choix du coordinateur), le HTML ne gagnant que 1,69 fois ; `/api/wines` donne chaque vin en `{ definition, bottles }`, avec une action de mise à jour et un pied `BREAKING CHANGE:`, fondue ensuite dans l’action « scripts » par API-09.
- Trouvé pendant UI-14 (hors périmètre) : le HTML rendu par le serveur pèse environ 560 Ko pour 100 cartes (classes des `Badge`, SVG de remplacement), pour UI-18 ou plus tard ; le nom `showTablePage`, pour UI-19 ; avertissements de lint antérieurs (`{#each}` sans clé dans `wines/[id]`, `console` dans `AllBottlesDialog`).

**Critère d’acceptation** : Chercher « Bug04 », ouvrir le vin, revenir : la recherche et les filtres sont toujours là, et l’URL les porte ; deux régions « Bourgogne » de deux pays se filtrent séparément ; `/wines` pèse au moins deux fois moins qu’avant sur la cave de mesure, et `/api/wines` renvoie encore les bouteilles bues ; aucun composant de la liste ne dépasse 400 lignes ; les parcours de QA-05 passent.

**Sources** : T8 de l’audit (audit-pre-1.0/synthese.md#T8), seconde partie, audit-pre-1.0/axe-5-interface.md#m1, m2, m22, R5-m7, R5-m11, R5-m23, R5-m24, R5-M1/setTimeout, R5-Refacto-structure, R5-Refacto-filtres-URL, R5-Refacto-6a, R5-Refacto-6c, UI-03/Reste-1, Décisions « Petits choix (audit d’avant 1.0) », « Bouteilles bues de la liste des vins (UI-14) »

### API-09 · API : format des réponses et cohérence

Sévérité **mineur** · effort **L** · dépend de DATA-12, DATA-13, API-08, BUG-19, BUG-20, UI-11, UI-12, UI-14 · statut **Fait**

**Suivi** (2026-10-28) : 70a1afbb..f84e3d91

**Problème** : Une route `/api` inconnue répond une page 404 HTML, une méthode non servie un 405 en texte. Cinq PUT répondent encore `{ success: true }` alors que l’action 0.7.0 promet la ligne enregistrée ; des créations et suppressions répondent 200 malgré le résumé 0.7.0 ; des 422 n’ont pas de `details` ; un préréglage inconnu reçoit 422 avant 404. Une bouteille a deux routes DELETE aux contrats différents, `backup-token` est hors `apiHandler`, `non-consumed` nomme le vin `wineDefinition`, `download-backup` prend `?file=`. Des replis morts, des champs à plat et des noms trompeurs restent. Baisser la durée de session laisse croire qu’elle écourte les sessions ouvertes. Un prix d’achat ou une valeur négatifs sont acceptés, contre la décision UI-06.

**Fichiers** : `src/hooks.server.ts`, `src/routes/api/settings/+server.ts:20`, `src/routes/api/access-code/+server.ts:54`, `src/routes/api/admin/`, `src/routes/api/bottles/non-consumed/`, `src/routes/admin/backups/+page.svelte:56`, `src/test/download.ts:8`, `src/routes/api/bottles/+server.ts:21`, `src/lib/shared/schemas/bottle.ts:7-8,24-27`, `src/lib/server/features/shared/imported-rows.ts`, `drizzle/`, `src/routes/api/upload/image/+server.ts`, `src/lib/server/features/images/service.ts`, `src/lib/server/features/bottles/service.ts:170,175`, `src/lib/server/features/bottles/repository.ts:67,91,97-98,188,198`, `src/lib/server/features/catalog/`, `src/lib/server/features/storage/service.ts:209,226`, `src/lib/server/features/labels/service.ts:42-43,67-68`, `src/lib/server/db-errors.ts:88`, `src/lib/server/session.ts:100`, `src/lib/components/AllBottlesDialog.svelte:27,59,96`, `docs/API.md`, `releases.json`

**À faire**

- Décision « Codes de réponse promis en 0.7.0 (API-07, REL-04) », REL-04/2 : `DELETE /api/admin/wine-definitions/{id}` et `DELETE /api/admin/images` répondent 204, `POST /api/admin/upload-image` et `import-images-zip` 201 ; une phrase dans les notes de version.
- Décision « Action de mise à jour 0.7.0 (API-01, API-03, API-06) », a2 m6, API-07/4 et REL-04/1 : les PUT de `settings`, `access-code`, `admin/upgrade-actions`, `admin/backup-settings` et `admin/barcode-settings` renvoient la valeur enregistrée, comme l’action 0.7.0 le dit déjà ; aussi `PUT /api/admin/images` (REL-04/1) ; le wipe rend `backup` comme la restauration, sans `message` ni `success`. Le reste de a2 m6 : 404 pour un vin inconnu dans `wineLocations`, `details` du 409 `in_use` comme ailleurs.
- Décision « Endpoints et CSRF (API-06) » (API publique documentée), a2 m5 : l’admin supprime une bouteille par `DELETE /api/bottles/{id}` ; `DELETE /api/admin/wine-bottles/{id}` reste, documenté, mais avec le même contrat (404 pour une bouteille inconnue), et `deleteWineBottleIfAny` disparaît.
- a2 R2-m5a (partie 404 et 405), a4 UI-07/Trouvé-11 et UI-07/Reste-2 : dans `handle`, une réponse 404 ou 405 sous `/api/` qui n’est pas du JSON est réécrite au format `{ error: { code, message } }`. La partie CSRF de R2-m5a est dans DOC-03.
- Reste de a2 m6 : `POST /api/bottles` ne renvoie plus de `message` anglais, `POST /api/upload/image` plus de `success: true` ; `deleteWineDefinition` vérifie en transaction les bouteilles qui l’utilisent (409 `in_use`) comme `deleteDefinitionAndBottles`, ou son commentaire (`catalog/service.ts:104`) est corrigé.
- a2 m7 et API-07/6 : `backup-token` passe par `apiHandler`. API-07/7 : les 422 `invalid_body` ont des `details` (`backup/service.ts:122`, `images/service.ts:185,239,253`, `import-images-zip`). API-07/19 : un PUT de préréglage sur un id inconnu répond 404 avant tout contrôle.
- a5 UI-02/Reste-3 : `GET /api/bottles/non-consumed` nomme le vin `definition` ; `AllBottlesDialog` ne le renomme plus.
- Décisions « Taille des requêtes (SEC-07) » et « Téléchargement d’une sauvegarde (API-09) », DATA-08/4 : `GET /api/admin/download-backup` désigne le fichier par `filename`, comme les autres routes de sauvegarde ; `?file=` est retiré sans alias, avec l’action conditionnelle « scripts » de l’entrée 0.11.0 de `releases.json` (RELEASING.md) ; la page des sauvegardes envoie `filename`.
- Décisions « Prix négatifs (UI-06) » et « Formulaires de vin et de bouteille (UI-06) », a5 m4 et BUG-14/5 : `.min(0)` sur `amount` (prix d’achat et valeur actuelle) dans `schemas/bottle.ts`, dont le commentaire des lignes 7-8 est mis à jour ; une ligne d’import CSV ou JSON au prix d’achat ou à la valeur négatifs est réparée dans `imported-rows.ts` (valeur retirée, une ligne dans les notes de la bouteille, comme les réparations de DATA-03) ; une migration répare de même les prix d’achat et valeurs négatifs déjà en base, comme 0006 ; une phrase dans le résumé 0.11.0. Dans ce lot seul, la migration ne croise celle d’aucune autre tâche.
- a2 m8, a1 m8 et R1-m4a : jointures internes au lieu des replis morts (`?? 'Unknown'`, `'Standard'`, `'Unknown Region'`), plus de champs à plat dans `getDefinitionWithLocation` (vérifier d’abord qu’ils sont encore renvoyés) ; la fabrique de l’erreur `barcode_for_one_bottle` est faite par BUG-19. a2 m9 : commentaire d’`uploads`, noms des deux fonctions d’export des codes-barres inversés, `caseCapacitySchema`.
- a2 m2 : le texte de la durée de session dit qu’elle s’applique aux prochaines connexions et comment fermer les autres sessions (changer le code d’accès), en anglais et en français.
- Chaque changement de forme de réponse : `docs/API.md`, son test `api-doc.test.ts`, une phrase dans le résumé 0.11.0 ; ce qui casse un script existant complète l’action conditionnelle « scripts » de 0.11.0 qu’UI-14 a créée : une seule action « scripts » par version, comme en 0.7.0.
- Fait en P9 (2026-10-28, 70a1afbb..f84e3d91) : un chemin inconnu sous `/api/` répond 404 `not_found` en JSON, une méthode non servie 405 `method_not_allowed` avec `Allow` ; les PUT renvoient ce qu’ils ont enregistré, sans `success` ni `message`, sauf `PUT /api/access-code`, qui répond 204 ; 201 et 204 comme promis en 0.7.0 ; 404 pour une bouteille ou un vin inconnus ; chaque 422 `invalid_body` a ses `details` ; `non-consumed` nomme le vin `definition` ; `download-backup` prend `?filename=` (`?file=` reçoit 422) ; jointures internes au lieu des replis « Inconnu » (8 clés retirées) ; le texte de la durée de session dit qu’elle vaut pour les prochaines connexions ; prix et valeurs négatifs refusés, mis dans les notes à l’import et par la migration 0015 (mode custom) ; suffixe des cases corrigé (décision « Suffixe des cases (API-09) ») ; une seule action « scripts » pour 0.11.0 (décision « Actions pour les scripts de 0.11.0 (BUG-19, UI-14, API-09) »). 55 tests échouent avant.
- Trouvé pendant API-09 (hors périmètre) : `success` et `message` restent dans les réponses de `create-backup`, `create-export`, `restore`, `import-json`, `auto-backup`, `export-csv`, `import-csv`, `upload-image` et `import-images-zip` ; le message 409 de la suppression d’un vin dit « en cave » mais compte aussi les bouteilles bues ; les erreurs des champs de formulaire ne sont pas reliées à leur champ (`aria-describedby`) ; `GET /api` sans barre finale répond probablement encore la page 404 HTML (lu, pas essayé) ; sur une base modifiée à la main avec des références cassées, les vins concernés quittent les listes et `GET /api/definitions/{id}` répond 404 (suite des jointures décidées) ; la ligne de réparation est coupée quand une note approche 5 000 caractères (documenté).

**Critère d’acceptation** : `GET /api/nope` et `DELETE /api/wines` répondent au format d’erreur de l’API ; chaque PUT de réglage renvoie la valeur enregistrée ; les quatre routes du résumé 0.7.0 répondent 201 ou 204 ; supprimer une bouteille inconnue par l’une ou l’autre route répond 404 ; `download-backup?file=` répond 422 et l’action « scripts » de 0.11.0 le dit ; un prix d’achat ou une valeur négatifs sont refusés avec un message sous le champ, une ligne d’import qui en a est importée sans eux avec une ligne dans ses notes, et une base qui en contient est réparée à la mise à jour ; `api-doc.test.ts` et les tests de route passent, et échouent sur les réponses d’avant.

**Sources** : T9 de l’audit (audit-pre-1.0/synthese.md#T9), audit-pre-1.0/axe-2-api-securite.md#m2, m5–m9, R2-m5a (partie 404 et 405), audit-pre-1.0/axe-1-donnees.md#m8, R1-m4a, audit-pre-1.0/axe-4-front-admin.md#UI-07/Trouvé-11, UI-07/Reste-2, audit-pre-1.0/axe-5-interface.md#UI-02/Reste-3, m4 (de T8), Trouvé pendant DATA-08 (4), API-07 (4, 6, 7, 19), REL-04 (1, 2), BUG-14 (5), Décisions « Codes de réponse promis en 0.7.0 (API-07, REL-04) », « Action de mise à jour 0.7.0 (API-01, API-03, API-06) », « Endpoints et CSRF (API-06) », « Taille des requêtes (SEC-07) », « Téléchargement d’une sauvegarde (API-09) », « Prix négatifs (UI-06) », « Formulaires de vin et de bouteille (UI-06) »

### UI-15 · Textes et i18n : restes de l’audit

Sévérité **mineur** · effort **L** · dépend de API-09 · statut **Fait**

**Suivi** (2026-10-28) : e6e43806..114ec88c

**Problème** : 75 clés i18n répètent le même texte sous plusieurs noms, et 57 clés `ui.*` forment un fourre-tout. L’anglais garde « Wine Definition », le français mêle apostrophes et points de suspension, « Casier » et « case », des placeholders télégraphiques, un `{reason}` anglais et le BMP. Huit toasts enveloppent le 401 au lieu de laisser le dialogue de connexion. `formatDate` peut afficher la veille. Une action de mise à jour cochée disparaît du bandeau au premier rechargement. `check-i18n.mjs` n’a aucun test.

**Fichiers** : `src/lib/i18n/locales/en.json`, `src/lib/i18n/locales/fr.json`, `scripts/check-i18n.mjs`, `vite.config.ts:68`, `src/lib/stores/toast.svelte.ts:22`, `src/routes/admin/images/+page.svelte:63,79,117,142`, `src/routes/admin/backups/+page.svelte`, `src/lib/components/barcode/PresetManager.svelte`, `src/lib/utils/format.ts:12`, `src/lib/components/admin/UpgradeBanner.svelte:15-17`, `src/lib/components/forms/CaseLoadRow.svelte:28`

**À faire**

- Décision « Petits choix (audit d’avant 1.0) », a5 m19 : les mots isolés (Annuler, Confirmer, Pays, Région, Millésime, Notes…) n’ont qu’une clé, dans `common.*` ; retirer les 75 copies (environ 45 fichiers). Garder deux clés seulement quand le contexte peut changer la traduction.
- Même décision, a5 m18 : « Add wine », « Edit wine », « Duplicate wine », « Save wine », « Update wine », « Wine » en anglais.
- Même décision, a4 m2 : une action de mise à jour cochée reste visible jusqu’à la visite suivante (le bandeau garde la liste lue au montage).
- Décision « Accessibilité et langue (UI-10) », a5 UI-10/Trouvé-1b : un 401 ouvre le dialogue de connexion sans toast, même enveloppé (« Échec de … : … ») : les huit appels de `admin/images`, `admin/backups` et `PresetManager`.
- Lot 6 de P9, seul : la fusion des clés touche presque tous les composants ; elle vient après les autres tâches de P9 pour reprendre aussi leurs nouveaux textes.
- a5 UI-10/Trouvé-2f et UI-10/Reste-9 : répartir les 57 clés `ui.*` dans les espaces de leur page ou dans `common.*`.
- a5 m17 : une seule typographie dans `fr.json` (apostrophe ’, « … », …) ; a5 UI-10/Reste-7 : « case » partout ; Reste-8 : placeholders `search_*` en phrases ; Reste-5 : `errors.invalid_export_invalid_row` n’insère plus de `{reason}` anglais (un code traduit) ; Reste-6 : `admin.supported_formats_list` sans BMP ; Reste-13 : l’erreur « pas un CSV » dit ce qui est attendu.
- a5 UI-02/Reste-1 : `formatDate` affiche un jour stocké à minuit UTC avec `timeZone: 'UTC'`. BUG-14/3 : `bottle_form.places_used` formate aussi la capacité.
- a5 m16 : des tests Vitest de `check-i18n.mjs` sur un dossier de cas (clé manquante, clé construite par un gabarit, texte entre balises, attributs, `alert`/`confirm`/`prompt`, qu’il apprend à détecter), avec l’`include` de Vitest élargi si besoin.
- Décision « Messages d’erreur (P7) » pour les messages réécrits.
- Fait en P9 (2026-10-28, e6e43806..114ec88c) : de 1 180 à 1 102 clés, plus aucune `ui.*` ; « vin » au lieu de « définition de vin » partout (décision « Vin plutôt que définition de vin (UI-15) ») ; une seule typographie française (’, « … », …, 219 valeurs) et « case » partout ; `check-i18n.mjs` échoue sur un même texte anglais et français sous deux clés (exceptions commentées : `common.barcode` et `navigation.barcode`, `placeholders.producer_example` et `placeholders.wine_name_example`), sur la typographie française et sur le texte d’`alert`, `confirm` et `prompt`, avec des tests sur `scripts/check-i18n-cases/` ; un 401 n’ouvre que le dialogue de connexion (images, sauvegardes, préréglages) ; `formatDate` en UTC ; une action cochée reste dans le bandeau jusqu’à la visite suivante ; capacité formatée ; l’erreur « pas un CSV » dit quoi corriger ; une ligne refusée d’un export JSON est décrite dans la langue de l’interface, grâce à `details.problems` ajouté à la 422 `invalid_export` (choix du coordinateur, sans action). Effets visibles acceptés : capitale de phrase sur les clés fusionnées (« Select none »), « Close the form » devient « Close this window », heure sur les cartes d’images, raison de l’échec dans le toast de suppression d’un préréglage.
- Trouvé pendant UI-15 (hors périmètre) : plusieurs dialogues affichent encore « session expirée » à côté du dialogue de connexion (`BarcodeSettingsDialog`, `BackupSettingsDialog`, `SessionTimeoutDialog`, `CsvExportDialog`, refus du code-barres dans `WineBottleForm`, `container-draft.svelte.ts`) ; `{count}` non formaté dans `common.selected_count`, `admin.and_more` et `bottle_form.places_free` ; `check-i18n` ne voit pas `placeholder={'…'}` ni `caption:` ; `rowProblemsText` sépare les problèmes par « ; » ; pas d’espace insécable avant « : » ni dans « » ; capitales anglaises mêlées (« Storage Cases », « All Wines », « In Cave ») et français télégraphique (« Voir détails de la bouteille ») ; `invalid_row` nomme la table brute (`wineDefinitions`) ; clés qui ne diffèrent qu’en anglais (`forms.duplicate_wine_bottle` et `forms.duplicate_bottle`, `common.add_bottle` et `forms.add_wine_bottle`, `auth.session_expired` et `errors.unauthenticated`) ; « Producteur : » vide sur la page vin (antérieur) ; le composant `UpgradeBanner` n’a pas de test à lui.

**Critère d’acceptation** : `pnpm i18n:check` passe et ses tests échouent si l’on retire une détection ; aucun texte identique en anglais et en français n’a deux clés hors de `common.*` (vérifié par un script ou un test) ; plus de clé `ui.*` ; un 401 pendant la suppression d’une sauvegarde n’affiche que le dialogue de connexion ; une date du 1er janvier s’affiche 1er janvier dans un navigateur en UTC-5.

**Sources** : T11 de l’audit (audit-pre-1.0/synthese.md#T11), audit-pre-1.0/axe-5-interface.md#m16–m19, UI-10/Trouvé-1b, Trouvé-2f, Reste-5–9, Reste-13, UI-02/Reste-1, audit-pre-1.0/axe-4-front-admin.md#m2, Trouvé pendant BUG-14 (3), Décisions « Petits choix (audit d’avant 1.0) », « Accessibilité et langue (UI-10) », « Messages d’erreur (P7) »

## P10 · Fin de l’audit (1.0.0)

Le reste de l’audit d’avant 1.0 : thème, accessibilité, seeding, documentation, dépendances, lint et tests. Prévue pour 0.12.0. DEP-06 applique la convention de logs déjà décidée (« Petits choix ») mais attend P10 : passer `no-console` en erreur touche presque tous les composants, que P9 réécrit d’abord. Lots, mêmes règles qu’en P9 (résumé 0.12.0) : 1. DEP-06, DATA-14 (DEP-06 change les règles de lint de tout le code) ; 2. UI-16, DOC-03 ; 3. UI-17 ; 4. UI-18 (couleurs et sélecteurs de presque tous les composants). Terminée le 2026-10-29 (develop f14a795f), publiée en 0.12.0 le 2026-10-29.

### DEP-06 · Dépendances, lint et tests : restes de l’audit

Sévérité **mineur** · effort **M** · statut **Fait**

**Suivi** (2026-10-29) : 40cc8d47..ae17dccb

**Problème** : Des correctifs publiés depuis plus de 7 jours attendent, et `@types/node` n’est pas déclaré. ESLint garde cinq règles en avertissement avec des commentaires périmés, et aucune règle n’écrit la convention de logs. `scripts/` n’est pas typé, et `release.mjs check` n’a pas de test, comme `safeUrl`. Les tests laissent des copies de migrations dans le dossier temporaire du système. Les pages rendues selon la langue n’envoient pas `Vary`, et `check:watch` ne recompile pas les messages.

**Fichiers** : `package.json`, `pnpm-lock.yaml`, `eslint.config.js:37-44`, `tsconfig.json:7`, `components.json:11`, `scripts/release.mjs`, `src/lib/utils/url.ts`, `src/test/database.ts:30`, `src/lib/server/zip.ts:1-4`, `src/lib/server/features/backup/json-import.ts:1-2`, `src/routes/uploads/[...path]/+server.ts`, `src/lib/shared/schemas/bottle-list.ts:4`, `src/routes/api/admin/upgrade-actions/server.test.ts:34`

**À faire**

- Décision « Petits choix (audit d’avant 1.0) », a7 m15 : le serveur écrit dans les logs du conteneur (`console`, règle coupée pour le code serveur, `debugLogger` pour le détail activable), le code du navigateur n’utilise pas `console` : `no-console` en erreur côté client après revue des appels (environ 30, dans les composants et `stores/auth.svelte.ts`) ; corriger les avertissements restants et rendre aux cinq règles leur niveau d’erreur, sans modifier les primitives de `ui/` (décision « Code mort et knip (UI-01) ») : les exclure de la règle concernée (`select-group.svelte`) ; écrire la convention dans AGENTS.md.
- Décisions « Fraîcheur des dépendances (SEC-08) », « Plages de versions (DEP-02) » et « Actions GitHub épinglées (SEC-10) », a7 m14 : revue groupée des correctifs publiés depuis au moins 7 jours, une mise à jour par commit, portes à chaque fois ; vérifier `@types/better-sqlite3` contre better-sqlite3. À refaire avant le tag 1.0.0. a7 m13 : `@types/node` 24.x en devDependency.
- Lot 1 de P10 : les règles de lint en erreur touchent le code de presque tous les composants ; UI-17 et UI-18 viennent après.
- a7 m16 : tests des contrôles de `release.mjs check` (ceux de `check-i18n.mjs` viennent d’UI-15, a5 m16). a5 m7 : `url.test.ts` pour `safeUrl` (`javascript:`, `JAVASCRIPT:`, `data:`, espaces, URL relative → null ; http et https → URL).
- a7 m20 : la route `/uploads` lit l’image par une fonction de `features/images` ; imports `node:` dans `zip.ts`, `json-import.ts` et la route.
- a7 R7-M4c : les scripts `.mjs` et `drizzle.config.ts` vérifiés par le typage (`checkJs` ou un `tsconfig` pour `scripts/`). a7 DEP-03/Trouvé-5 : vérifier que la CLI shadcn-svelte accepte les alias `#lib`, et retirer `"hooks": "#lib/hooks"` de `components.json` (dossier absent).
- a1 m6 : les copies de migrations des tests vont dans le dossier temporaire du fichier de test, que `setup.ts` supprime.
- a5 UI-05/Trouvé-2, quatrième avertissement : `BOTTLE_SORT_COLUMNS` de `bottle-list.ts:4` n’est utilisé que comme type. REL-03/1 : le test de `upgrade-actions` prend `99.0.0` comme version absente.
- a5 UI-10/Reste-11 : `Vary: Cookie, Accept-Language` sur les pages rendues selon la langue ; Reste-12 : `check:watch` recompile les messages. Reste-14 est dans REL-05 (même script `prepare`).
- Fait en P10 (2026-10-29, 40cc8d47..ae17dccb, 33 commits) : `Vary: Cookie, Accept-Language` sur les pages et l’API, pas sur `/uploads`, dont les images gardent leur cache d’un an après une connexion ou un changement de langue (avec un test) ; plus aucun `console` dans le code du navigateur (19 appels revus), `no-console` en erreur hors du code serveur et de `scripts/`, les cinq règles en avertissement repassées en erreur, une seule exclusion dans `ui/` (`select-group.svelte`, `no-useless-assignment`) ; règle 9 d’AGENTS.md pour les logs ; `pnpm check` type aussi `scripts/` et `drizzle.config.ts` ; tests de `release.mjs` (13) et de `safeUrl` (12) ; les copies de migrations des tests vont dans le dossier du test ; `/uploads` lit par `features/images`. Mises à jour publiées depuis au moins 7 jours, une par commit (drizzle-orm 0.45.4, zod 4.6.7, svelte 5.57.2, @sveltejs/kit 3.1.0, vite 8.3.5, vitest 5.0.5, eslint 10.13.0, bits-ui 2.20.0, @inlang/paraglide-js 2.29.1…), `@types/node` 24.19.2 déclaré, actions/setup-node 7.1.0, image `node:24.22.1-alpine3.24`. Écartés : TypeScript 7 (DEP-03), @types/node 25 et 26 (Node 24), docker/login-action 4.7.0 (6 jours). `"hooks"` reste dans `components.json`, car la CLI shadcn-svelte refuse de tourner sans.
- Trouvé pendant DEP-06 (hors périmètre) : `pnpm dlx` ignore `minimumReleaseAge` ; un essai de la CLI shadcn dans une copie jetable a tiré svelte 5.57.3, vieux de 3 jours, sans rien changer au projet ; les règles des agents demandent maintenant `--config.minimum-release-age=10080`. Paraglide 2.29 envoie aussi `Vary` sur l’API, sans effet connu, et le test de `Vary` des pages vérifie son comportement plutôt que celui de Cellar. runed 0.35.1 annonce attendre @sveltejs/kit 2 (déjà le cas avant).

**Critère d’acceptation** : `pnpm lint` ne donne aucun avertissement, et un `console.log` ajouté dans un composant le fait échouer ; `pnpm check` vérifie aussi `scripts/` ; les tests de `release.mjs` et de `safeUrl` passent ; une série de tests ne laisse aucun `cellar-migrations-*` dans le dossier temporaire du système ; `/wines` envoie `Vary`.

**Sources** : T15 de l’audit (audit-pre-1.0/synthese.md#T15), audit-pre-1.0/axe-7-infra.md#m13–m16, m20, R7-M4c, DEP-03/Trouvé-5, audit-pre-1.0/axe-1-donnees.md#m6, audit-pre-1.0/axe-5-interface.md#m7, UI-10/Reste-11, 12, UI-05/Trouvé-2 (avertissement de `bottle-list.ts`), Trouvé pendant REL-03 (1), Décisions « Petits choix (audit d’avant 1.0) », « Fraîcheur des dépendances (SEC-08) », « Plages de versions (DEP-02) », « Actions GitHub épinglées (SEC-10) », « Code mort et knip (UI-01) »

### DATA-14 · Données, seeding et migrations : restes de l’audit

Sévérité **mineur** · effort **M** · dépend de DATA-11 · statut **Fait**

**Suivi** (2026-10-29) : 145c4e07..5c38c5e6

**Problème** : Le seeding insère des noms vides venus d’un CSV édité, et lit `appellations.csv` en latin1. Une migration en échec ne dit pas laquelle. Le garde des clés étrangères lance un `foreign_key_check` complet à chaque démarrage. Le fichier `migrations.ts` ne contient que le seeding. Des requêtes et les horodatages `{ id, createdAt, updatedAt }` sont recopiés entre domaines. Le wrapper d’adapter-node de `vite.config.ts` n’a pas de test.

**Fichiers** : `src/lib/server/db/migrations.ts (après DATA-11)`, `src/lib/server/db/connection.ts:55-65,90`, `src/lib/server/db/schema.ts`, `src/lib/server/features/backup/repository.ts:88,102`, `src/lib/server/features/*/repository.ts`, `src/lib/server/features/shared/lookup-crud.ts`, `src/lib/server/features/csv-import/pipeline.ts`, `src/lib/server/access-code.ts`, `vite.config.ts`

**À faire**

- a1 m2 : le seeding saute, avec un avertissement dans les logs, une ligne dont un nom est vide après `trim`. a1 DATA-07/Reste-2 : `appellations.csv` lu en UTF-8 (une copie UTF-8 ne donne plus « CÃ´tes ») ; vérifier le fichier livré.
- a1 m5 : le message d’une migration en échec liste les migrations en attente (journal de `drizzle/` plus récent que `__drizzle_migrations`), puisque Drizzle les annule ensemble.
- a1 DATA-03/Reste-1 : le contrôle des clés étrangères ne tourne que s’il y a des migrations en attente.
- a1 R1-m8b : `migrations.ts` devient `seed.ts`, et `migrations.test.ts` sépare seeding et migrations SQL.
- a1 m7 et a7 m19 : l’export CSV reprend `regionsWithCountry` et `appellationsWithRegion` ; `$defaultFn` dans `schema.ts` pour `id`, `createdAt` et `updatedAt` (défauts appliqués par Drizzle, sans migration), et retirer les 11 copies et les deux `timestamps()`.
- a1 DATA-07/Reste-3 : un test vérifie que le build ne contient pas `build/client/uploads` (wrapper d’adapter-node de `vite.config.ts`).
- Fait en P10 (2026-10-29, 145c4e07..5c38c5e6) : le seeding saute une ligne au nom vide et donne son numéro dans les logs ; `appellations.csv` est livré en UTF-8, les copies en latin1 se lisent encore, et une copie non modifiée de l’ancien fichier dans `csv-imports` est remplacée au démarrage ; une migration en échec nomme les migrations en attente (`lastAppliedMigration()`, partagé avec `upgrade.ts`), avec une phrase dans README-Docker ; `foreign_key_check` seulement s’il y a des migrations en attente ; `migrations.ts` devient `seed.ts` (tests séparés, aides dans `src/test/seed-files.ts`) ; `$defaultFn` pour `id`, `createdAt` et `updatedAt`, sans migration, et les 11 copies et les deux `timestamps()` retirés ; l’export CSV reprend `regionsWithCountry` et `appellationsWithRegion` ; `vite.config.test.ts` vérifie l’absence de `build/client/uploads`. Une ligne d’export JSON sans id ni dates reste refusée (422), défaut trouvé par la relecture. Il n’existe pas de `regions.csv` : les régions viennent d’`appellations.csv`, qui a servi de preuve.
- Trouvé pendant DATA-14 (hors périmètre) : `vite.config.test.ts` pourrait reprendre `scratchFolder` ; le paramètre `out` d’`adapterWithoutUploads` ne sert qu’au test ; un journal de migrations absent donne une erreur brute (une image livrée l’a toujours) ; l’export CSV passe en jointure interne, qui ne peut écarter que des lignes d’une base modifiée à la main.

**Critère d’acceptation** : Un `appellations.csv` avec une ligne de noms vides démarre sans l’insérer et le dit dans les logs ; un `appellations.csv` en UTF-8 donne « Côtes » ; une migration cassée nomme les migrations en attente ; `pnpm db:generate` ne crée aucune migration après `$defaultFn` ; plus de `createdAt: now, updatedAt: now` recopié à la création dans `src/lib/server` (les `set: { updatedAt: now }` des upserts restent, ou passent par `$onUpdateFn`).

**Sources** : T12 de l’audit (audit-pre-1.0/synthese.md#T12), audit-pre-1.0/axe-1-donnees.md#m2, m5, m7, DATA-03/Reste-1, DATA-07/Reste-2, DATA-07/Reste-3, R1-m8b, audit-pre-1.0/axe-7-infra.md#m19

### UI-16 · Thème : color-scheme, contrastes et palette

Sévérité **mineur** · effort **S** · dépend de UI-13, DEP-06 · statut **Fait**

**Suivi** (2026-10-29) : 3999d4d0..83c4f022

**Problème** : Le mode sombre ne déclare pas `color-scheme` : les contrôles natifs restent clairs, contournés à la main. Le texte des boutons de trois thèmes clairs, le badge de pénurie et le rouge du mode sombre manquent de contraste ; après un passage du sombre au clair, deux couleurs gardent leur valeur sombre ; les bordures des champs sont trop pâles. La palette « blue » de `theme-colors.ts` recopie `app.css` sans test.

**Fichiers** : `src/app.css:15-16,24-25,42-74`, `src/lib/utils/theme-colors.ts:9-12,273-290`, `src/routes/+layout.svelte:106`, `src/lib/components/BulkBarcodeDialog.svelte:419`

**À faire**

- a5 m8 : `color-scheme: light` sur `:root`, `dark` sur `.dark`, puis retirer les contournements des sélecteurs natifs qui restent après UI-13.
- a5 m9 : `primary-foreground` sombre pour les thèmes clairs jaune, orange et vert ; plus de surcharge de `destructive` en sombre ; badge de pénurie en `bg-red-700`.
- a5 UI-10/Reste-1 : le thème clair redéfinit `--secondary-foreground` et `--accent-foreground`. UI-10/Reste-2 : bordures des champs (`--input`) à 3:1 au moins, en clair et en sombre.
- a7 R7-m5c (de T16) : `theme-colors.ts` lit la palette par défaut au lieu de la recopier, ou un test vérifie qu’elle reste égale à `app.css`.
- Mesurer les contrastes avant et après (Chromium, thèmes clair et sombre).
- Fait en P10 (2026-10-29, 3999d4d0..83c4f022) : `color-scheme` clair et sombre, contournement de `BulkBarcodeDialog` retiré ; texte foncé sur les boutons des thèmes clairs vert, orange et jaune (de 2,56 à 4,78:1 au pire) ; plus de surcharge de `--destructive` en sombre (texte d’erreur de 4,3 à 7:1) ; badge de pénurie en `bg-red-700` (6,4:1) ; `--input` à 3:1 au moins (au lieu de 1,2 à 1,35:1) ; passer du sombre au clair donne les couleurs d’un rechargement ; un test garde la palette par défaut égale à `app.css`. Mesures dans Chromium : 83 paires sur 176 en échec avant, 8 après, toutes « bordure contre intérieur du champ » en sombre, conséquence de la décision « Champs en mode sombre (UI-16) ».
- Trouvé pendant UI-16 (hors périmètre) : en clair, `--input` est juste sous 3:1 sur les surfaces `muted` ; les bordures des sélecteurs natifs, `FilterSelect`, `QrScannerDialog`, `LocaleDateInput` et le `border-gray-300` de la page codes-barres sont laissés à UI-18 ; pas vérifié dans Firefox.

**Critère d’acceptation** : En mode sombre, les sélecteurs natifs sont sombres sans contournement ; le texte des boutons de tous les thèmes, le badge de pénurie et les bordures des champs atteignent les ratios WCAG (4,5:1 pour le texte, 3:1 pour les bordures), mesurés ; passer du sombre au clair donne les mêmes couleurs qu’un rechargement.

**Sources** : T10 de l’audit (audit-pre-1.0/synthese.md#T10), partie thème, audit-pre-1.0/axe-5-interface.md#m8, m9, UI-10/Reste-1, UI-10/Reste-2, audit-pre-1.0/axe-7-infra.md#R7-m5c (de T16)

### DOC-03 · Documentation : restes de l’audit

Sévérité **mineur** · effort **S** · dépend de DEP-06 · statut **Fait**

**Suivi** (2026-10-29) : ef9b9b87..8afaf04a

**Problème** : Les listes « ce que lance la CI » sont incomplètes, AGENTS.md promet plus que la règle de lint des routes, et une phrase de la feuille de route dit que le 403 du contrôle CSRF de SvelteKit suit le format de l’API. README-Docker réinitialise le code d’accès avec `data/cellar.db` en dur et ne dit rien d’un `DATABASE_PATH` en lien symbolique ni du WAL sur un partage réseau. `BODY_SIZE_LIMIT` n’est pas documenté hors Docker. Le compose garde des restes de « Wine Cellar », `docker-setup.sh` est orphelin, l’avertissement ORIGIN donne le port du conteneur, et la feuille de route affiche « - undefined ».

**Fichiers** : `README.md:36-42`, `RELEASING.md:67`, `AGENTS.md:18,29`, `README-Docker.md:236,248`, `docker-compose.yml:40-42`, `docker-setup.sh`, `src/lib/server/upgrade.ts:324`, `server.js`, `docs/roadmap/tasks.mjs (UI-10, API-01)`

**À faire**

- Décisions « Contrôle CSRF maison (SEC-01, DEP-03) » et « Endpoints et CSRF (API-06) », partie CSRF de a2 R2-m5a : `docs/API.md` décrit déjà le 403 texte de SvelteKit ; corriger la phrase de la tâche API-01 (« 403 du contrôle CSRF ») en « les 403 de `csrf.ts` », et ajouter à README-Docker, près d’`ORIGIN`, qu’une écriture de script sans `Origin` reçoit le 403 texte de SvelteKit et quel `Content-Type` envoyer.
- Décision « Visibilité (REL-01) » : jusqu’à la 1.0.0, la doc ne suppose pas qu’on peut télécharger l’image ; R2 réécrit ces passages au tag.
- a7 m4 : retirer la virgule en trop de la tâche UI-10 (une puce vide, rendue par le mot undefined dans ROADMAP.md) ; en option, faire refuser une puce vide par `build.mjs`.
- a7 m6 : `pnpm knip` (et `check-origin`, et `pnpm test:e2e` de QA-05) dans les listes de README.md, RELEASING.md et AGENTS.md ; décrire tout ce que vérifie `i18n:check`. a7 m18 : AGENTS.md dit « Routes call a feature’s modules, never its repository; a lint rule enforces it ».
- a1 DATA-01/Reste-1 : la réinitialisation du code d’accès lit `DATABASE_PATH`. DATA-01/Reste-2 : un `DATABASE_PATH` en lien symbolique ou un fichier monté seul casse la restauration (`renameSync`) : monter le dossier. DATA-01/Reste-3 : WAL déconseillé sur un partage réseau (NFS, SMB).
- a7 DEP-03/Reste-2 : `BODY_SIZE_LIMIT` documenté pour `node server.js` dans README.md (ou un défaut de 512 Mo dans `server.js`, comme l’image).
- a7 m10 : retirer les labels « Wine Cellar » du compose, et supprimer `docker-setup.sh` ou le citer dans le Quick start. a7 m9 : l’exemple de l’avertissement ORIGIN prend le port de l’hôte (`http://192.168.1.20:3005`).
- Fait en P10 (2026-10-29, ef9b9b87..8afaf04a) : README-Docker réinitialise le code d’accès par `DATABASE_PATH` et `DATA_DIR`, dit de monter le dossier plutôt qu’un fichier ou un lien symbolique, déconseille le WAL sur un partage réseau et explique le 403 texte de SvelteKit pour un script sans `Origin` ; l’exemple d’`ORIGIN` prend le port de l’hôte ; labels « Wine Cellar » retirés du compose ; `docker-setup.sh` supprimé (il refaisait l’étape 2 du Quick start, sans le `chown`) ; `BODY_SIZE_LIMIT` documenté pour `node server.js`, sans nouveau défaut ; listes de la CI de README.md, RELEASING.md et AGENTS.md alignées sur `ci.yml`, description complète d’`i18n:check`, règle des routes exacte ; tâches UI-10 et API-01 corrigées, et `build.mjs` refuse un élément vide.
- Trouvé pendant DOC-03 (hors périmètre) : la définition de « fini » d’AGENTS.md ne cite ni le contrôle des migrations ni `check-origin` ; trois passages de README-Docker et le commentaire du compose supposent encore qu’on peut télécharger l’image (R2 les réécrit au tag, décision « Visibilité (REL-01) ») ; le commentaire d’en-tête de `check-i18n.mjs` est incomplet ; port 3000 dans `upgrade.test.ts:351`.

**Critère d’acceptation** : ROADMAP.md n’a plus de puce vide ; les listes de la CI de README.md, RELEASING.md et AGENTS.md citent les mêmes contrôles que `ci.yml` ; README-Docker ne contient plus `data/cellar.db` en dur et parle des liens symboliques, du WAL réseau et du 403 CSRF des scripts.

**Sources** : T14 de l’audit (audit-pre-1.0/synthese.md#T14), audit-pre-1.0/axe-7-infra.md#m4, m6, m9, m10, m18, DEP-03/Reste-2, audit-pre-1.0/axe-1-donnees.md#DATA-01/Reste-1, Reste-2, Reste-3, audit-pre-1.0/axe-2-api-securite.md#R2-m5a (partie CSRF), Décisions « Contrôle CSRF maison (SEC-01, DEP-03) », « Endpoints et CSRF (API-06) », « Visibilité (REL-01) »

### UI-17 · Accessibilité, connexion au premier rendu et pages d’erreur

Sévérité **mineur** · effort **L** · dépend de DEP-06, UI-16 · statut **Fait**

**Suivi** (2026-10-29) : b32f67dd..f65ef675

**Problème** : L’état de connexion se charge dans le navigateur : le premier rendu montre « Connexion » même connecté. `SearchableSelect` n’est pas utilisable au clavier, la page des préférences a des libellés sans champ et des boutons à bascule sans état, les pages ont deux `h1` et des titres absents ou identiques. Les messages d’erreur ne sont pas reliés à leur champ, et un formulaire ne défile pas jusqu’à la première erreur. Une erreur du layout racine affiche la page anglaise par défaut, une erreur dans l’admin perd sa navigation, et les préférences plantent sans stockage local.

**Fichiers** : `src/routes/+layout.svelte:53,121`, `src/routes/+layout.server.ts`, `src/lib/stores/auth.svelte.ts`, `src/lib/components/ui/SearchableSelect.svelte`, `src/routes/preferences/+page.svelte`, `src/lib/stores/preferences.svelte.ts:52,65`, `src/error.html (nouveau)`, `src/routes/admin/+error.svelte (nouveau)`, `src/routes/admin/+layout.svelte:20`, `src/routes/barcode/+page.svelte`, `src/lib/components/forms/FormField.svelte:30`, `src/lib/components/forms/form-action.svelte.ts`

**À faire**

- a6 UI-04/Reste-1 et a5 UI-10/Reste-4 (même cause) : le layout serveur transmet l’état de la session ; le premier rendu montre le bon menu, sans les deux requêtes de `auth.init()`.
- a5 m11 : `SearchableSelect` devient une liste accessible au clavier (le `Combobox` de bits-ui, ou rôles ARIA, flèches et `aria-activedescendant`). UI-19 le sortira ensuite de `ui/`.
- a5 m12 : préférences en `role="radiogroup"` et `aria-checked`, groupes nommés ; a5 m13 : un `<title>` par page (« Section - Cellar »), admin compris ; a5 UI-10/Reste-3 : un seul `h1` par page (le logo n’en est plus un).
- BUG-16/5 : `FormField` relie le message au champ (`aria-describedby`, `aria-invalid`). BUG-14/1 : à l’envoi refusé, le formulaire défile jusqu’au premier champ en erreur et lui donne le focus (390 px compris).
- a5 m15 : un `src/error.html` neutre et bilingue, avec un lien vers `/wines`. a4 m8 : un `admin/+error.svelte` qui garde la navigation de l’admin.
- a5 m10 : préférences avec `try/catch` autour du stockage local (valeurs par défaut, choix gardé pour la session), avec un test.
- a5 UI-10/Reste-10 : à 390 px, l’exemple du champ code-barres de `/wines` tient dans le champ (texte plus court ou aide sous le champ).
- Fait en P10 (2026-10-29, b32f67dd..f65ef675, 19 commits) : le layout serveur transmet `authenticated` et `accessCodeSet`, le premier rendu montre le bon menu et `auth.init()` disparaît (`auth.checkSession()` pour un retour vers `?login`) ; `SearchableSelect` devient une combobox ARIA écrite à la main, utilisable au clavier seul ; préférences en groupes radio (`ChoiceGroup.svelte`, `radio-group.ts`) qui marchent sans stockage local ; un titre par page (`pageTitle()`) et un seul `h1` ; `FormField` relie message et aide au champ (`ErrorMessage.svelte`) et pose `aria-invalid` lui-même ; un envoi refusé défile jusqu’au premier champ en erreur et lui donne le focus, à 390 px compris ; `src/error.html` neutre et bilingue, `admin/+error.svelte` qui garde la navigation ; aide sous le champ code-barres de `/wines` ; récapitulatif des préférences retiré (décisions du 2026-10-29). axe 4.14.0 : 16 violations critiques avant, aucune critique ni sérieuse après (8 modérées `region`), sur les 84 analyses du vérificateur.
- Trouvé pendant UI-17 (hors périmètre) : constats modérés `region` d’axe ; dans `SearchableSelect`, « ajouter » n’est atteignable qu’après une saisie, et Tab ne choisit pas l’option en surbrillance ; les toasts d’erreur s’empilent ; l’aide d’`ImagePicker` n’est pas reliée à son champ ; une erreur dans une page de données de l’admin perd les liens des tables.

**Critère d’acceptation** : Connecté, `curl` de `/wines` montre le lien Admin dès le HTML serveur ; `SearchableSelect` s’ouvre, se parcourt et se choisit au clavier seul ; axe ne remonte aucune violation sérieuse sur la liste, la page vin, les préférences et l’admin ; un envoi refusé à 390 px amène au premier champ en erreur ; une erreur forcée dans le layout racine affiche `error.html`.

**Sources** : T10 de l’audit (audit-pre-1.0/synthese.md#T10), partie accessibilité, audit-pre-1.0/axe-5-interface.md#m10–m13, m15, UI-10/Reste-3, Reste-4, Reste-10, audit-pre-1.0/axe-4-front-admin.md#m8, audit-pre-1.0/axe-6-pages.md#UI-04/Reste-1, Trouvé pendant BUG-14 (1), BUG-16 (5)

### UI-18 · Couleurs du thème et sélecteurs partout

Sévérité **mineur** · effort **M** · dépend de UI-17 · statut **Fait**

**Suivi** (2026-10-29) : cf08c858..328c5bca

**Problème** : Douze `<select>` natifs restent à côté du Select bits-ui, et environ 350 classes de couleur sont écrites en dur (`text-gray-500`, `bg-red-50`…) au lieu des couleurs du thème : elles ignorent le thème choisi et rendent mal en sombre.

**Fichiers** : `src/lib/components/admin/backups/BackupList.svelte:56`, `src/lib/components/admin/dialogs/`, `src/lib/components/admin/EntityFormDialog.svelte:90`, `src/lib/components/admin/FilterSelect.svelte:17`, `src/lib/components/barcode/PresetManager.svelte:136`, `src/lib/components/QrScannerDialog.svelte:282`, `src/lib/components/`, `src/routes/`

**À faire**

- a7 R7-m8b : remplacer les `<select>` natifs qui restent après UI-11 et UI-13 par le Select de `ui/select`.
- a7 R7-m8c : remplacer les classes de couleur en dur par les variables du thème (`text-muted-foreground`, `bg-destructive/10`…) ; garder en dur seulement une couleur qui a un sens fixe (badges de type, statuts), avec un commentaire.
- Lot 4 de P10, seul : touche presque tous les composants. Vérifier chaque écran dans un thème clair et en sombre (captures avant et après).
- Fait en P10 (2026-10-29, cf08c858..328c5bca, 12 commits) : les 9 `<select>` natifs remplacés par `forms/OptionSelect.svelte` (déclencheur nommé, choix par la première lettre), que `FilterSelect` enveloppe ; le séparateur « Tab » de l’export CSV envoie une vraie tabulation (l’ancienne option envoyait les deux caractères `\t`), avec un test ; classes de couleur en dur de 342 à 35 dans les `.svelte` (de 414 à 105 avec les `.ts`), celles qui restent ayant un sens fixe et un commentaire ; `--success` et `--warning` fixes, `--destructive` clair en red-700, toasts en cartes opaques (décision « Couleurs décoratives et statuts (UI-18) ») ; un test vérifie les statuts sur leur teinte à 4,5:1. 15 captures sur 69 identiques au pixel, les autres différences listées dans le rapport ; axe : 3 violations sérieuses avant, aucune après.
- Trouvé pendant UI-18 (hors périmètre) : choisir une option d’un Select dans un dialogue fait défiler la page derrière (déjà vrai avant, maintenant dans plus de dialogues) ; du texte en `text-primary` reste sous 4,5:1 dans les thèmes clairs jaune, orange et vert (`BottleDetailsDialog:138`, `BarcodeSearch:144`, `SearchableSelect:87`, variante `link` de `ui/button`) ; trois éléments décoratifs du thème clair jaune sont sous 3:1 (icône de dialogue 2,46, icône des statistiques et piste de l’interrupteur 2,70, le bouton de l’interrupteur restant à 7,76:1) ; neuf Select écrits à la main pourraient reprendre `OptionSelect` (pour UI-19) ; `csvDelimiterOptions` vit dans un fichier sur les tables ; le bloc « sans photo » est dupliqué ; `FilterSelect` garde son nom « All … » après un choix ; constat modéré `h4` d’axe (antérieur).

**Critère d’acceptation** : `grep -rnoE "<select\b" src --include=*.svelte` ne trouve plus rien ; les classes de couleur en dur restantes sont listées et justifiées dans le rapport ; les captures des écrans principaux en clair et en sombre ne montrent pas de régression.

**Sources** : T16 de l’audit (audit-pre-1.0/synthese.md#T16), audit-pre-1.0/axe-7-infra.md#R7-m8b, R7-m8c

## P11 · Rangement des composants (1.0.0)

Deux petites corrections trouvées en P10, puis le rangement des composants par domaine, à la toute fin, comme le veut la décision « Architecture (revue 7) ». Lots : 1. UI-20, BUG-21 ; 2. UI-19, seule, qui déplace presque tous les composants. Prévue pour la 1.0.0, après la vérification de P12. Terminée le 2026-10-29 (develop 70d9e148), publiée en 1.0.0 le 2026-10-30.

### UI-20 · Texte en couleur du thème lisible dans tous les thèmes

Sévérité **mineur** · effort **S** · dépend de UI-18 · statut **Fait**

**Suivi** (2026-10-29) : f82c3f64..58dc6e2f

**Problème** : Du texte en `text-primary` reste sous 4,5:1 dans les thèmes clairs jaune, orange et vert, où la couleur du thème est trop pâle sur fond blanc (de 2,56 à 4,14:1) : le détail d’une bouteille, la recherche par code-barres, la liste avec recherche et la variante `link` des boutons.

**Fichiers** : `src/lib/components/BottleDetailsDialog.svelte:138`, `src/lib/components/wines/BarcodeSearch.svelte:144`, `src/lib/components/ui/SearchableSelect.svelte:87`, `src/lib/components/ui/button/`

**À faire**

- Trouvé pendant UI-18 : chaque texte en `text-primary` atteint 4,5:1 dans les huit thèmes, clair et sombre, sans changer la couleur des boutons ni des icônes (par exemple une variable de texte du thème, plus foncée en clair, ou `text-foreground` souligné comme le lien du site, décision « Couleurs décoratives et statuts (UI-18) »).
- Chercher les autres textes en `text-primary` (grep), et reprendre la mesure de contraste d’UI-16 et d’UI-18 avant et après.
- Lot 1 de P11, avec BUG-21.
- Fait en P11 (2026-10-29, f82c3f64..58dc6e2f) : une variable `--primary-text` (Tailwind `text-primary-text`) pour le texte en couleur du thème ; elle vaut `--primary` sauf dans les sept modes qui manquaient 4,5:1, où seule la luminosité change (vert, orange, jaune, rouge et rose clairs, rouge et rose sombres) ; `--primary` ne change pas, donc boutons, icônes, anneaux et interrupteur gardent leur couleur. Le texte passe en `text-primary-text` dans `BottleDetailsDialog`, `BottleTable`, `SearchableSelect`, la variante `link` de `ui/button`, `BarcodeSearch`, la pénurie et le lien du site d’un vin ; `theme-colors.test.ts` vérifie 4,5:1 sur tous les fonds de chaque mode. Mesures dans Chromium : 47 paires sur 208 sous 4,5:1 avant, aucune après (pire cas 2,26 en jaune clair, 4,62 après) ; sur les pages, 35 sur 144 avant, aucune après ; 236 paires de captures, seules différences le texte en couleur du thème des sept modes.
- Trouvé pendant UI-20 (hors périmètre) : les icônes en `text-primary` restent sous 3:1 en jaune clair (2,26) et orange clair (2,75), le jaune déjà accepté par UI-18 ; le texte bleu sombre est à 4,50008:1, sans marge (couleur inchangée) ; aucun composant n’utilise la variante `link` des boutons ; une future étape e2e qui choisit une option juste après l’ouverture d’un Select fera défiler la page, comme l’a montré BUG-21.

**Critère d’acceptation** : Aucun texte en couleur du thème sous 4,5:1, mesuré dans Chromium dans les huit thèmes clairs et sombres ; les captures avant et après ne montrent pas d’autre changement.

**Sources** : Trouvé pendant UI-18, Décision « Avant la 1.0 (P11, P12) »

### BUG-21 · La page défile derrière un dialogue quand on choisit dans un Select

Sévérité **mineur** · effort **S** · dépend de UI-18 · statut **Fait**

**Suivi** (2026-10-29) : pas un défaut, sans commit

**Problème** : Choisir une option d’un Select bits-ui placé dans un dialogue fait défiler la page derrière le dialogue. C’était déjà vrai dans le dialogue d’ajout de bouteilles ; depuis qu’UI-18 a remplacé les sélecteurs natifs, cela touche plus de dialogues.

**Fichiers** : `src/lib/components/ui/select/`, `src/lib/components/forms/OptionSelect.svelte`, `src/lib/components/ui/dialog/`

**À faire**

- Trouvé pendant UI-18 : reproduire (dialogue d’ajout de bouteilles, dialogues de l’admin), trouver la cause (focus rendu au déclencheur, verrou de défilement du dialogue et du Select, portail) et la corriger à un seul endroit, sans toucher aux primitives `ui/` si une option de bits-ui suffit.
- Un parcours e2e ou un test qui échoue avant la correction.
- Lot 1 de P11, avec UI-20.
- Fait en P11 (2026-10-29), sans changement de code : pas un défaut. Le `locator.click()` de Playwright, relancé pendant l’animation d’ouverture de la liste, appelle `scrollIntoView({block:'start'})` (playwright-core 1.64.1 alterne l’alignement à chaque nouvel essai) ; souris, toucher et clavier laissent la page immobile, dans Chromium et WebKit, à 1280 et 390 px, et le mainteneur ne l’a jamais vu à la main. La sonde d’UI-18 cliquait juste après l’ouverture. Trouvé pendant BUG-21 (hors périmètre) : dans l’émulation mobile de WebKit, toucher une option laisse la liste ouverte (Chromium la choisit) ; à vérifier sur un vrai iPhone.

**Critère d’acceptation** : Choisir une option dans le Select d’un dialogue ne fait plus défiler la page derrière, à 1280 et à 390 px, prouvé par un test qui échoue avant la correction.

**Sources** : Trouvé pendant UI-18, Décision « Avant la 1.0 (P11, P12) »

### UI-19 · Composants rangés par domaine

Sévérité **évolution** · effort **L** · dépend de UI-18, UI-14, QA-05, UI-20, BUG-21 · statut **Fait**

**Suivi** (2026-10-29) : a5713927..d79c72a1

**Problème** : Dix gros composants restent à la racine de `src/lib/components/`, sans arborescence par domaine, et `ui/` mêle les primitives shadcn-svelte et des composants maison (`SearchableSelect`, `LocaleDateInput`, `locale-date.ts`, `NumberInput`).

**Fichiers** : `src/lib/components/`, `src/lib/components/ui/SearchableSelect.svelte`, `src/lib/components/ui/LocaleDateInput.svelte`, `src/lib/components/ui/locale-date.ts`, `src/lib/components/ui/NumberInput.svelte`, `knip.config.ts`, `AGENTS.md`

**À faire**

- Décision « Architecture (revue 7) » : le rangement des composants par domaine n’est pas abandonné, il vient à la toute fin, en tâche dédiée.
- a7 R7-Archi-3 et R7-FdR-8 : un dossier par domaine (par exemple `components/wines`, `bottles`, `storage`, `barcode`, `admin`, `layout`, `forms`), plus rien de spécifique à la racine de `components/`. Des commits qui ne font que déplacer (`git mv`) et corriger les imports.
- a7 R7-m8a et BUG-14/4 : `SearchableSelect`, `LocaleDateInput`, `locale-date.ts` et `NumberInput` sortent de `ui/`, qui ne garde que ce qu’écrit la CLI shadcn-svelte (décision « Code mort et knip (UI-01) »).
- Mettre à jour la carte d’AGENTS.md ; les parcours de QA-05 doivent passer sans changement.
- Fait en P11 (2026-10-29, a5713927..d79c72a1, 10 commits) : plus aucun composant à la racine de `src/lib/components/`. `WineDefinitionDialog` et `WineListView` vont dans `wines/` ; `BottleDetailsDialog` et `WineBottleDialog` dans `bottles/` ; `BarcodeDialog`, `BulkBarcodeDialog`, `bulk-barcode.ts` et `QrScannerDialog` dans `barcode/` ; `AllBottlesDialog` dans `storage/` ; `InlineMarkdown` dans `admin/` ; `PieChart` dans `statistics/` (nouveau) ; `ExistingBottleLocations`, `SearchableSelect`, `LocaleDateInput`, `locale-date.ts` et `NumberInput` dans `forms/` ; `ui/toast/`, écrit à la main (le registre de shadcn-svelte n’a que `sonner`), dans `layout/`. Le reste de `ui/` correspond au registre. Des commits qui ne font que `git mv` et corriger les imports (14 renommages exacts, 6 qui ne diffèrent que par leurs imports, dont deux `./input` relatifs devenus `#lib/components/ui/input/index.js`), `git log --follow` remonte à l’origine de chaque fichier ; carte d’AGENTS.md à jour ; parcours e2e inchangés, et 27 étapes dans l’app construite sans erreur.
- Trouvé pendant UI-19 (hors périmètre) : plusieurs primitives de `ui/` ont été retouchées à la main depuis la CLI et n’ont pas les fichiers plus récents du registre (`dialog-portal.svelte`, `select-portal.svelte`) ; l’état `visible` de `layout/Toast.svelte` semble redondant ; le store des toasts vit dans `src/lib/stores/`, loin de ses composants ; trois imports relatifs sans extension `.js` ; dépendances croisées entre dossiers, antérieures (`wines/BarcodeSearch` utilise surtout `barcode/`, des fichiers de `bottles/` ne servent qu’à `barcode/`).

**Critère d’acceptation** : `src/lib/components/` n’a plus de composant spécifique à sa racine, `ui/` ne contient que des primitives shadcn-svelte, les portes et les parcours de QA-05 passent, et le diff ne contient que des déplacements et des imports.

**Sources** : T16 de l’audit (audit-pre-1.0/synthese.md#T16), audit-pre-1.0/axe-7-infra.md#R7-Archi-3, R7-FdR-8, R7-m8a, Trouvé pendant BUG-14 (4), Décision « Architecture (revue 7) »

## P12 · Vérification d’avant 1.0 (1.0.0)

Une revue complète en lecture seule après P11, comme l’audit d’avant 1.0 puis sa vérification : tout ce que l’audit demandait est fait, et le nettoyage n’a pas créé de nouveaux problèmes. Le mainteneur juge chaque constat : à corriger avant la 1.0 (tâches ajoutées ici) ou acceptable en l’état. Puis la 1.0.0, avec R2 de l’audit au tag : dépôt et image publics, protection de `main`. Revue faite le 2026-10-30 (QA-06). Lots des corrections, chacun mergé avant le suivant, résumé 1.0.0 : 1. SEC-12, API-12, BUG-22, BUG-23 ; 2. UI-21, UI-22, DEP-07 ; 3. DOC-04 (documentation d’après les deux premiers lots) ; 4. UI-23 ; puis REL-06, la publication, avec le mainteneur. Terminée le 2026-10-30 (develop 89d2c4c1), publiée en 1.0.0 le 2026-10-30. Lots 1 à 4 faits le 2026-10-30, puis la 1.0.0 publiée le même jour (tag v1.0.0 sur 8ad43dff) ; depuis le lot 2, le dépôt public repart d’un nouveau commit racine (décision « Nouveau départ à la 1.0 (REL-06) »).

### QA-06 · Revue complète d’avant 1.0

Sévérité **majeur** · effort **L** · dépend de UI-19 · statut **Fait**

**Suivi** (2026-10-29) : revue sur cf48032d, rapport b3f2e4a0

**Problème** : Depuis l’audit d’avant 1.0 et sa vérification, P9 à P11 ont touché presque tout le code. Avant de publier la 1.0.0 et d’ouvrir le dépôt, il faut vérifier que tout ce que l’audit demandait est fait et que le nettoyage n’a pas créé de nouveaux problèmes.

**Fichiers** : `src/`, `drizzle/`, `docs/`, `README.md`, `README-Docker.md`, `AGENTS.md`, `RELEASING.md`, `.github/workflows/`, `Dockerfile`, `docs/roadmap/reviews/`

**À faire**

- En lecture seule, sur le `develop` d’après P11, comme l’audit d’avant 1.0 : mêmes axes, chaque constat réfuté ou confirmé par un vérificateur indépendant, avec sa preuve.
- Reprendre chaque ligne de traçabilité de l’audit et chaque constat (A1 à A7) : fait, fait autrement, ou pas fait.
- Chercher les régressions et les nouveaux problèmes : sécurité, données et migrations (mise à jour depuis 0.1.0 et depuis 0.12.0 sur le banc), API et documentation, interface (axe, contrastes, 390 px, clair et sombre), image Docker.
- Écrire le rapport dans `docs/roadmap/reviews/` ; le mainteneur juge chaque constat : tâche ajoutée à P12 avant la 1.0, ou acceptable en l’état.
- Fait en P12 (2026-10-30, revue sur cf48032d, rapport b3f2e4a0 dans `docs/roadmap/reviews/verification-pre-1.0/`) : 7 auditeurs et 7 vérificateurs, un par axe de l’audit. Portes vertes (lint à 0 avertissement, 1 456 tests, 4 parcours e2e) ; banc 0.1.0 et 0.12.0 vers 1.0.0-rc.1 à 176 sur 176. Sur 1 100 verdicts : 930 fait, 49 fait autrement, 6 partiel, 97 pas fait (presque tous des « Trouvé pendant » hors périmètre), 2 régressé, 16 sans objet. Traçabilité de l’audit (738 lignes) : aucune « pas fait » ; les 7 Majeurs et les bloquants B1 à B8 sont faits. Aucun Critique ni Majeur nouveau ; 23 Mineurs, dont 4 régressions (V4-m6, V4-m7, V5-m5, V3-m2). Le mainteneur a suivi toutes les recommandations de la synthèse (décision « Revue d’avant 1.0 (QA-06) ») : SEC-12, API-12, BUG-22, BUG-23, UI-21, UI-22, DEP-07 et DOC-04 avant la 1.0, le reste accepté.

**Critère d’acceptation** : Le rapport est écrit, chaque constat a une preuve et le jugement du mainteneur, et les tâches qu’il a choisies sont ajoutées à P12.

**Sources** : Décision « Avant la 1.0 (P11, P12) », audit-pre-1.0/synthese.md

### SEC-12 · Interdire l’encadrement de Cellar

Sévérité **mineur** · effort **S** · dépend de QA-06 · statut **Fait**

**Suivi** (2026-10-30) : 0292716e..010dcc83

**Problème** : Aucune réponse n’envoie `X-Frame-Options` ni `frame-ancestors` : une page d’une autre app du même NAS (même hôte, autre port) peut encadrer l’admin connecté et détourner des clics, jusqu’à « Wipe All Data ».

**Fichiers** : `src/hooks.server.ts`, `src/hooks.server.test.ts`, `docs/API.md`

**À faire**

- V2-m1 : chaque réponse envoie `Content-Security-Policy: frame-ancestors 'none'` (ou `'self'` si Cellar s’encadre lui-même quelque part) et `X-Frame-Options: DENY` pour les anciens navigateurs, dans `handle`, sans casser les images de `/uploads` ni les téléchargements.
- Un test du `handle` et une preuve dans Chromium : une page d’un autre port qui encadre l’admin reste vide.
- Lot 1 de P12.
- Fait en P12 (2026-10-30, 0292716e..010dcc83, commits de l’historique archivé, voir « Nouveau départ à la 1.0 (REL-06) ») : `frame-ancestors 'none'` et `X-Frame-Options: DENY` sur chaque réponse de `handle` ; une page d’un autre port reste vide dans Chromium (décision « Pas de cadre (SEC-12) »).
- Trouvé pendant SEC-12 : les réponses qui ne passent pas par `handle` (403 brut de SvelteKit, fichiers statiques, exception dans `handle`) n’ont pas l’en-tête.

**Critère d’acceptation** : Une page d’un autre port ne peut plus afficher Cellar dans un cadre (preuve dans Chromium) ; toutes les pages, l’API et `/uploads` envoient l’en-tête ; testé.

**Sources** : verification-pre-1.0/synthese.md#V2-m1, Décision « Revue d’avant 1.0 (QA-06) »

### API-12 · API : longueur des textes et casse des référentiels

Sévérité **mineur** · effort **S** · dépend de QA-06 · statut **Fait**

**Suivi** (2026-10-30) : c629b212..8fc8ebf5

**Problème** : Les 5 000 caractères sont comptés en points de code par zod et en unités UTF-16 ailleurs : l’API accepte une note d’emoji que son propre PATCH refuse ensuite, et un aller-retour CSV la coupe sans le dire. `PUT /api/<table>/{id}` compare les noms avec la casse : renommer « Testland » en « FRANCE » crée un second « france », contre la décision « Référentiels (API-03) ».

**Fichiers** : `src/lib/shared/schemas/common.ts`, `src/lib/shared/schemas/`, `src/lib/server/features/geography/`, `src/lib/server/features/catalog/`, `src/lib/server/features/csv-import/`, `docs/API.md`

**À faire**

- V1-m1 : une seule mesure de la longueur, la même que l’export et l’import CSV et que l’interface (`.length`, unités UTF-16), dans `longText`, sans migration ; tests avec emoji à la limite, à la création, au PATCH et en aller-retour CSV.
- Trouvé pendant API-08 : `PUT /api/<table>/{id}` refuse en 409 un nom qui ne diffère d’un autre que par la casse, comme `POST` ; tests.
- Lot 1 de P12.
- Fait en P12 (2026-10-30, c629b212..8fc8ebf5, commits de l’historique archivé, voir « Nouveau départ à la 1.0 (REL-06) ») : une seule mesure des textes longs, en unités UTF-16, dans l’API et les imports ; 2 500 emoji passent, 2 501 répondent 422, et une note revient entière d’un aller-retour CSV ; renommer en un nom existant à la casse près répond 409 (décision « Doublons hérités (API-12) »).
- Trouvé pendant API-12 : `name` et `optionalText` comptent encore en points de code.

**Critère d’acceptation** : Une note de 5 000 unités avec des emoji est acceptée ou refusée de la même façon partout, et revient entière d’un aller-retour CSV ; renommer un pays en un nom existant à la casse près répond 409 ; testé.

**Sources** : verification-pre-1.0/synthese.md#V1-m1, Décision « Revue d’avant 1.0 (QA-06) »

### BUG-22 · Téléchargements de sauvegardes dans l’admin

Sévérité **mineur** · effort **S** · dépend de QA-06 · statut **Fait**

**Suivi** (2026-10-30) : 76043435..8904c5b6

**Problème** : Régression de DATA-12 : après une restauration, un import JSON ou un effacement, un téléchargement raté de la sauvegarde de sécurité laisse le seul toast de succès. Le bouton « Download » de la liste des sauvegardes charge tout le fichier dans le navigateur, ce qui peut échouer pour plusieurs centaines de Mo.

**Fichiers** : `src/lib/components/admin/backups/`, `src/lib/components/admin/jobs.svelte.ts`, `src/routes/admin/`

**À faire**

- V4-m6 et UI-07/Trouvé-7 : un échec du téléchargement de la sauvegarde de sécurité se voit (message d’erreur qui dit où retrouver le fichier), avec un test qui échoue avant.
- Trouvé pendant DATA-12 : « Download » laisse le navigateur télécharger le fichier lui-même (lien direct ou contrôle de la réponse avant `<a download>`), sans le charger en mémoire, par le même helper que le téléchargement de sécurité.
- Lot 1 de P12.
- Fait en P12 (2026-10-30, 76043435..8904c5b6, commits de l’historique archivé, voir « Nouveau départ à la 1.0 (REL-06) ») : un téléchargement de sécurité raté affiche une erreur qui dit où retrouver le fichier, session expirée comprise ; « Download » laisse le navigateur enregistrer le fichier (0 octet en mémoire de la page pour 600 Mo, contre 629 Mo avant).
- Trouvé pendant BUG-22 : une sauvegarde déjà supprimée donne un toast contradictoire (« n’existe plus » et « reste dans la liste ») ; après un 401, `invalidateAll` recharge la page et le dialogue de l’admin perd son message.

**Critère d’acceptation** : Un téléchargement de sécurité qui échoue affiche une erreur ; « Download » d’une sauvegarde de plus de 500 Mo ne la charge pas dans la mémoire de la page (preuve dans Chromium) ; testé.

**Sources** : verification-pre-1.0/synthese.md#V4-m6, Décision « Revue d’avant 1.0 (QA-06) »

### BUG-23 · Tab ne change plus la valeur d’un OptionSelect

Sévérité **mineur** · effort **S** · dépend de QA-06 · statut **Fait**

**Suivi** (2026-10-30) : fc3ea2aa..3c17a6f4

**Problème** : Régression d’UI-18 : Tab au clavier sur le délimiteur d’« Export to CSV Files » ou de « CSV Import » le passe à « Tab », parce que la recherche par lettre de `OptionSelect` lit aussi la touche Tab : l’export sort en tabulations et l’import rejette chaque ligne, sans le dire.

**Fichiers** : `src/lib/components/forms/OptionSelect.svelte`

**À faire**

- V4-m7 : la recherche par lettre ne réagit qu’aux caractères imprimables, jamais à Tab, Échap ou aux touches de modification ; Tab quitte le champ sans changer sa valeur.
- Un test (composant ou e2e) qui échoue avant la correction.
- Lot 1 de P12.
- Fait en P12 (2026-10-30, fc3ea2aa..3c17a6f4, commits de l’historique archivé, voir « Nouveau départ à la 1.0 (REL-06) ») : la recherche par lettre de bits-ui recevait toutes les touches quand la liste était fermée ; `OptionSelect` ne lui donne ses options que pour un caractère imprimable. Étape e2e dans `backup.spec`, liste fermée et ouverte.
- Trouvé pendant BUG-23 : le comportement vient de bits-ui lui-même (recherche par lettre d’une liste fermée), à signaler en amont.

**Critère d’acceptation** : Tab sur un OptionSelect fermé ou ouvert ne change pas sa valeur, dans les dialogues CSV et ailleurs ; la première lettre choisit toujours ; testé.

**Sources** : verification-pre-1.0/synthese.md#V4-m7, Décision « Revue d’avant 1.0 (QA-06) »

### UI-21 · Admin : dialogues au téléphone et guide de l’import CSV

Sévérité **mineur** · effort **S** · dépend de QA-06 · statut **Fait**

**Suivi** (2026-10-30) : 2fff2246..e67f206e

**Problème** : À 375 × 667, « Export to CSV Files », « Import Images from ZIP » et les réglages de sauvegarde en mode cron dépassent l’écran : titre et bouton d’action hors d’atteinte. Dans le guide de l’import CSV, les exemples de noms de fichiers sont entre 3,58 et 4,42:1, et sa liste défilante est inatteignable au clavier (deux violations sérieuses d’axe dans l’admin).

**Fichiers** : `src/lib/components/admin/dialogs/CsvExportDialog.svelte`, `src/lib/components/admin/dialogs/ZipImportInfoDialog.svelte`, `src/lib/components/admin/dialogs/BackupSettingsDialog.svelte`, `src/lib/components/admin/dialogs/CsvImportDialog.svelte`

**À faire**

- V4-m1 : même hauteur maximale et même défilement que `CsvImportDialog` ; vérifier tous les dialogues de l’admin à 375 × 667.
- V4-m2 : exemples à 4,5:1 au moins dans les 16 modes. V4-m3 : la liste défilante reçoit le focus (`tabindex="0"`, nom accessible).
- Lot 2 de P12.
- Fait en P12 (2026-10-30, 2fff2246..e67f206e) : `layout/ScrollingDialogContent` donne aux longs dialogues de l’admin un corps qui défile et des boutons toujours visibles à 375 × 667, erreurs à côté des boutons ; guide de l’import CSV à 5,26:1 au moins dans les 16 modes, liste défilante au clavier ; aucune violation sérieuse ni critique d’axe-core sur 372 ouvertures.
- Trouvé pendant UI-21 : détail des bouteilles, toutes les bouteilles, préréglages, codes-barres en lot et effacement ont encore leur mise en page à la main ; en français, le titre du dialogue ZIP passe 3 px sous la croix ; ordre des titres (modéré) ; `85vh` plutôt que `dvh`.

**Critère d’acceptation** : Aucun dialogue de l’admin ne dépasse un écran de 375 × 667 sans défiler jusqu’à son bouton ; axe-core ne remonte aucune violation sérieuse ni critique dans l’admin, dialogues ouverts, en clair et en sombre.

**Sources** : verification-pre-1.0/synthese.md#V4-m1, Décision « Revue d’avant 1.0 (QA-06) »

### UI-22 · Interface : restes de la revue d’avant 1.0

Sévérité **mineur** · effort **S** · dépend de QA-06 · statut **Fait**

**Suivi** (2026-10-30) : 05cee3b1..e290bebd

**Problème** : Le champ nombre du filtre « Nb bouteilles » n’a pas de nom accessible (seule violation critique d’axe de l’app). À 390 et 768 px, « Changer emplacement » et « Changer la disponibilité » du détail des bouteilles sortent du dialogue. « Mise à jour... » est écrit dans `ConfirmButtons` et `BulkBarcodeDialog` (régression d’UI-13 sur le hors cave), et `abbreviate` des statistiques coupe par « ... » sans infobulle. « Enregistrer » d’un conteneur est grisé sans message pour un nom vide.

**Fichiers** : `src/lib/components/wines/`, `src/lib/components/bottles/BottleDetailsDialog.svelte`, `src/lib/components/forms/ConfirmButtons.svelte`, `src/lib/components/barcode/BulkBarcodeDialog.svelte`, `src/routes/statistics/+page.svelte`, `src/lib/components/storage/ContainerDialog.svelte`, `src/lib/i18n/locales/`

**À faire**

- V5-m1 : un nom accessible traduit pour le champ du filtre « Nb bouteilles ».
- V5-m2 : à 390 et 768 px, les actions du détail des bouteilles restent dans le dialogue, visibles sans défilement horizontal.
- V5-m5 et V6-m3 : « Mise à jour… » par une clé de texte partagée ; `abbreviate` coupe par « … » et le nom complet reste lisible (`title` ou légende) ; si possible, `i18n:check` refuse « ... » écrit dans un composant.
- Trouvé pendant UI-12, décision « Messages d’erreur (P7) » : un nom de conteneur vide dit pourquoi « Enregistrer » est grisé.
- Lot 2 de P12.
- Fait en P12 (2026-10-30, 05cee3b1..e290bebd, commits de l’historique archivé, voir « Nouveau départ à la 1.0 (REL-06) ») : nom accessible du champ « Nb bouteilles », actions du détail des bouteilles visibles à 390 px, « Mise à jour… » par `common.updating`, `abbreviate` coupe par « … » avec le nom entier en `title`, raison d’un nom de conteneur vide ; « … » dans les deux langues et `i18n:check` refuse « ... » (décision « Points de suspension (UI-22) »).
- Trouvé pendant UI-22 : d’autres boutons sont grisés sans raison (préréglages d’étiquettes, connexion, code d’accès, liste de recherche) ; au toucher, un nom coupé des statistiques reste illisible.

**Critère d’acceptation** : axe-core ne remonte aucune violation critique ni sérieuse sur la liste, la page vin, les préférences, les statistiques et le stockage ; les actions du détail des bouteilles sont visibles à 390 px ; plus aucun « ... » visible ; un nom de conteneur vide montre sa raison.

**Sources** : verification-pre-1.0/synthese.md#V5-m1, Décision « Revue d’avant 1.0 (QA-06) »

### DEP-07 · Revue des dépendances d’avant le tag 1.0.0

Sévérité **mineur** · effort **S** · dépend de QA-06 · statut **Fait**

**Suivi** (2026-10-30) : e0dd937e..9ea78102

**Problème** : `pnpm audit --prod` sort en 1 : une alerte critique et une haute sur dompurify 3.4.16, dépendance optionnelle de jsPDF jamais chargée et absente de l’image, mais un audit rouge sur un dépôt rendu public. DEP-06 prévoyait une revue des dépendances juste avant le tag (bits-ui 2.20.1 entre autres).

**Fichiers** : `package.json`, `pnpm-lock.yaml`, `.github/workflows/`, `Dockerfile`

**À faire**

- V7-m1 : dompurify 3.4.17 ou plus (publiée depuis au moins 7 jours), par une mise à jour de jsPDF ou un `overrides` de pnpm si jsPDF ne suit pas.
- Décisions « Fraîcheur des dépendances (SEC-08) », « Plages de versions (DEP-02) » et « Actions GitHub épinglées (SEC-10) » : correctifs publiés depuis au moins 7 jours, une mise à jour par commit, portes à chaque fois ; image de base et actions comprises.
- Lot 2 de P12.
- Fait en P12 (2026-10-30, e0dd937e..9ea78102) : dompurify 3.4.17, bits-ui 2.20.2, tar-stream 3.1.9 (décision « Paquets de tar-stream (DEP-07) »), pnpm 10.34.8, @babel/runtime 7.29.10, text-decoder 1.2.7 ; `pnpm audit --prod` vide ; une sauvegarde zip se crée et se restaure.
- Écarts justifiés : correctifs de SvelteKit, Svelte, adapter-node et Paraglide de moins de 7 jours ; image node 24.22.2 éligible vers le 2026-11-04 ; docker/login-action 4.7.0 et tar-stream 3.2 sont des mineures.

**Critère d’acceptation** : `pnpm audit --prod` ne remonte rien ; chaque dépendance, action et image de base est à son dernier correctif publié depuis au moins 7 jours, ou l’écart est justifié dans le rapport.

**Sources** : verification-pre-1.0/synthese.md#V7-m1, Décision « Revue d’avant 1.0 (QA-06) »

### DOC-04 · Documentation : restes de la revue d’avant 1.0

Sévérité **mineur** · effort **S** · dépend de SEC-12, API-12, BUG-22, BUG-23, UI-21, UI-22, DEP-07 · statut **Fait**

**Suivi** (2026-10-30) : 7c3dfddb..bb97876c

**Problème** : `docs/API.md` dit que la restauration laisse les autres images, alors qu’elle les supprime depuis DATA-12, et se trompe sur ses compteurs ; son exemple de `label_too_small` répond 200. README-Docker envoie vers « Backup & Restore » de la page admin, qui s’ouvre sur Settings, et ne dit rien de la mémoire d’un gros zip d’images. RELEASING.md garde « in 0.x during the clean-up » et la section « First release: v0.1.0 ».

**Fichiers** : `docs/API.md`, `README-Docker.md`, `RELEASING.md`

**À faire**

- V3-m2 : les phrases de la restauration (images, compteurs) suivent le code. Trouvé pendant BUG-20 : un exemple de `label_too_small` qui répond vraiment 422.
- V4-m5 : README-Docker nomme l’onglet Backups de l’admin. V3-m1 (accepté) : une phrase sur la mémoire qu’il faut pour importer un gros zip d’images.
- RELEASING.md pour la 1.0 : plus de « 0.x » au présent, la section « First release: v0.1.0 » réduite à ce qui reste utile. Reprendre aussi ce que les lots 1 et 2 ont changé dans l’API (SEC-12, API-12).
- Lot 3 de P12, après les lots 1 et 2.
- Fait en P12 (2026-10-30, 7c3dfddb..bb97876c) : docs/API.md décrit la restauration réelle (images écrasées, fichiers non cités supprimés, compteur de codes-barres au plus grand) et un `label_too_small` qui répond vraiment 422 ; README-Docker nomme l’onglet Backups et la mémoire d’un zip d’images (jusqu’à 5 fois sa taille) ; RELEASING.md part de la 1.0.0, première version publique sans version précédente. Chaque phrase rejouée contre l’app compilée.
- Trouvé pendant DOC-04 : `release.mjs` échoue (« Tag v0.12.0 not found ») tant que `releases.json` garde les versions 0.x ; README-Docker et docs/API.md citent encore des versions 0.x ; deux boutons « Import ZIP » (onglets Backups et Images, UI-23) ; une restauration supprime aussi les fichiers non images du dossier d’images (décision « Nettoyage du dossier d’images (DOC-04) »).

**Critère d’acceptation** : Chaque phrase citée par V3-m2, V4-m5 et l’exemple de `label_too_small` est juste, rejouée contre l’app compilée ; RELEASING.md décrit les versions à partir de la 1.0.

**Sources** : verification-pre-1.0/synthese.md#V3-m2, Décision « Revue d’avant 1.0 (QA-06) »

### UI-23 · Admin : deux boutons « Import ZIP »

Sévérité **mineur** · effort **S** · dépend de DOC-04 · statut **Fait**

**Suivi** (2026-10-30) : bcd62570..950e848a

**Problème** : L’onglet Backups et l’onglet Images ont chacun un bouton « Import ZIP » (« Importer ZIP ») : le premier importe un export de données avec ses images, le second des images à rattacher aux vins. README-Docker doit nommer l’onglet pour les distinguer (DOC-04).

**Fichiers** : `src/lib/components/admin/backups/BackupActions.svelte`, `src/routes/admin/images/+page.svelte`, `src/lib/components/admin/dialogs/CsvImportDialog.svelte`, `src/lib/i18n/locales/`, `README-Docker.md`, `docs/API.md`, `e2e/`

**À faire**

- Décision « Deux « Import ZIP » (UI-23) » : deux libellés distincts, en anglais et en français, qui disent ce que le bouton importe ; même règle pour « Export ZIP » si l’onglet Images et l’onglet Backups le partagent.
- Les textes qui citent ces boutons suivent : guide de l’import CSV, README-Docker, docs/API.md, parcours e2e.
- Lot 4 de P12, avant REL-06.
- Fait en P12 (2026-10-30, bcd62570..950e848a) : « Importer un export » (Backups, titre de sa carte) et « Importer des images depuis un ZIP » (Images, titre de son dialogue) ; « Exporter ZIP » gardé, seul l’onglet Images l’a (décision du mainteneur) ; l’aide de l’export CSV renvoie à « Export complet » au lieu d’un bouton qui n’existait pas.
- Trouvé pendant UI-23 : « Edit » ouvre deux réglages différents, « Clear All » vide les filtres de Data et la sélection de l’export CSV ; « Export complet » s’appelle aussi « Create JSON Export » et « Create Export » ; le bouton de téléchargement d’un export se nomme « Download backup » ; le dialogue des résultats d’import d’images a un titre générique.

**Critère d’acceptation** : Aucun libellé de bouton de l’admin n’est porté par deux actions différentes ; chaque texte qui cite un de ces boutons le nomme comme l’interface ; portes vertes.

**Sources** : Trouvé pendant DOC-04, Décision « Deux « Import ZIP » (UI-23) »

### REL-06 · Publication de la 1.0.0

Sévérité **évolution** · effort **S** · dépend de DOC-04, UI-23 · statut **Fait**

**Suivi** (2026-10-30) : 0cebc545..8ad43dff, tag v1.0.0

**Problème** : La 1.0.0 rend le dépôt et l’image publics : la documentation doit alors dire comment télécharger l’image, et `main` doit être protégée.

**Fichiers** : `README.md`, `README-Docker.md`, `docker-compose.yml`, `releases.json`, `CHANGELOG.md`, `UPGRADING.md`, `docs/API.md`, `.github/`

**À faire**

- Décisions « Visibilité (REL-01) » et « Protection des branches (QA-04) », R2 de l’audit : réécrire les passages de README-Docker et du compose qui évitent de télécharger l’image ; résumé 1.0.0 complet.
- Avec le mainteneur, qui seul change les réglages de GitHub : dépôt public, paquet GHCR public, protection de `main` ; puis la release finale selon RELEASING.md, banc de mise à jour compris.
- Décision « Nouveau départ à la 1.0 (REL-06) » : `releases.json` ne garde que l’entrée 1.0.0, sans action de mise à jour ; son résumé est réécrit comme celui d’une première version publique (ce que fait Cellar, pas ce qui change depuis la 0.12.0) ; `CHANGELOG.md` et `UPGRADING.md` régénérés par `release.mjs prepare`. Décision « Versions 0.x dans la doc (REL-06) » : README-Docker et docs/API.md sans numéro de version 0.x.
- Banc local de la 0.12.0 vers la 1.0.0 avant le tag (images Docker locales). `main` naît à la release (`git switch -c main`, RELEASING.md) ; ensuite le mainteneur en fait la branche par défaut et la protège. Le paquet GHCR, recréé par la première release, doit être public.
- Fait en P12 (2026-10-30, 0cebc545..8ad43dff) : `releases.json` ne garde que la 1.0.0, avec un résumé de première version publique ; plus de version 0.x dans README-Docker ni docs/API.md ; démarrage rapide par `docker compose pull`, sections « Image tags » et « Building from source » ; tests de passage depuis une version absente de `releases.json` (`src/test/releases.ts`). Banc local 0.12.0 et 0.1.0 vers 1.0.0 à 176 sur 176, après adaptation du banc à un `releases.json` qui commence à la 1.0.0. `main` créée sur 8ad43dff, branche par défaut, force-push et suppression refusés ; tag v1.0.0, release 41128928220 verte ; paquet public, `docker pull ghcr.io/lulu300/cellar:1.0.0` sans connexion (tags `1.0.0`, `1.0`, `latest`, amd64 et arm64). develop passe à 1.1.0-rc.0 (89d2c4c1).
- Trouvé pendant REL-06 : docs/API.md cite un onglet « Admin › Barcodes » qui n’existe pas ; des commentaires citent encore des versions 0.x (`ci.yml`, `upgrade.ts`, `imported-rows.ts`) ; une sauvegarde nommée `auto` reçoit le message « cannot start with auto- ».

**Critère d’acceptation** : v1.0.0 est publiée sur `main` ; le dépôt et l’image sont publics, `docker pull ghcr.io/lulu300/cellar:1.0.0` marche sans connexion ; `main` est protégée.

**Sources** : Décisions « Visibilité (REL-01) », « Protection des branches (QA-04) », audit-pre-1.0/synthese.md#R2

## P13 · Finitions et installation (1.1.0)

Pour la 1.1.0, juste après la 1.0.0 : ce que voit d’abord un nouveau visiteur (installation dans le README, liens vers la doc de l’API), l’app installable sur le téléphone (PWA), et les finitions notées pendant P12 (décision « Versions après la 1.0 »). Lots, chacun mergé avant le suivant, résumé 1.1.0 (lots 1 à 3 faits le 2026-10-31, publiée en 1.1.0 le même jour) : 1. DOC-05, UI-27, SEC-13, BUG-24 ; 2. UI-24, UI-25, API-13 ; 3. UI-26, UI-29, DEP-08 ; UI-30 ; puis REL-07.

### DOC-05 · Installation dans le README et liens vers la doc de l’API

Sévérité **mineur** · effort **S** · dépend de REL-06 · statut **Fait**

**Suivi** (2026-10-31) : 82231d52..3161fec9

**Problème** : Le README ne dit comment installer Cellar que par un lien vers README-Docker, et ne cite pas la doc de l’API, que rien dans l’app ne montre non plus. Des restes d’avant 1.0 trompent le lecteur : un onglet « Admin › Barcodes » qui n’existe pas dans docs/API.md, des commentaires qui citent des versions 0.x.

**Fichiers** : `README.md`, `README-Docker.md`, `docs/API.md`, `src/routes/admin/`, `src/lib/i18n/locales/`, `.github/workflows/ci.yml`, `src/lib/server/upgrade.ts`, `src/lib/server/features/shared/imported-rows.ts`

**À faire**

- Une section « Installation » dans le README : le compose d’exemple (image `ghcr.io/lulu300/cellar:latest`, sans `build`), le `.env` avec `ORIGIN`, `docker compose pull` et `up -d`, puis les liens vers README-Docker (mise à jour, reverse proxy, sauvegardes) ; le compose d’exemple et `docker-compose.yml` ne se contredisent pas.
- Décision « Doc de l’API (DOC-05, API-14) » : un lien vers `docs/API.md` (adresse GitHub de `main`) dans le README et dans la page d’admin, traduit.
- Trouvé pendant REL-06 : « Admin › Barcodes » dans docs/API.md nomme le vrai chemin ; les commentaires de `ci.yml`, `upgrade.ts` et `imported-rows.ts` ne citent plus de version 0.x.
- Lot 1 de P13.
- Fait en P13 (2026-10-31, b5bee4d6..3161fec9) : section « Installation » du README (compose sans `build`, `.env` avec `ORIGIN`, `pull` puis `up -d`), rejouée dans un dossier vide sans le code source (seuls le nom du conteneur, le port et `ORIGIN` adaptés) ; un test garde le compose du README identique à `docker-compose.yml` ; lien « API documentation » dans l’en-tête de l’admin et dans le README ; « Admin › Settings › Barcode Settings » dans docs/API.md ; commentaires de `ci.yml`, `upgrade.ts` et `imported-rows.ts` sans version 0.x (décision du coordinateur : seulement ces trois fichiers, les versions qui sont des données restent).
- Trouvé pendant DOC-05 : des commentaires citent encore des versions 0.x dans une vingtaine d’autres fichiers de `src/` et `scripts/` (`access-code.ts`, `db/connection.ts`, `db/index.ts`, `writable-dirs.ts`, `schemas/bottle.ts`, `routes/+page.ts`, `scripts/upgrade-path.mjs`, des tests), ainsi que les en-têtes des migrations 0009 à 0015, qu’on ne modifie jamais ; la plupart expliquent des chemins de mise à jour encore suivis par les serveurs en 0.x.

**Critère d’acceptation** : Le README montre comment installer Cellar en quelques lignes, rejouées sur une machine sans le code source ; la doc de l’API est liée depuis le README et l’admin ; plus de « Admin › Barcodes » ni de version 0.x dans le code et la doc.

**Sources** : Trouvé pendant REL-06, Décision « Versions après la 1.0 »

### UI-27 · Application installable sur le téléphone (PWA)

Sévérité **évolution** · effort **S** · dépend de REL-06 · statut **Fait**

**Suivi** (2026-10-31) : 90ae1d6e..abe7196f

**Problème** : Sur le téléphone, Cellar s’ouvre dans un onglet du navigateur. Avec un manifeste et des icônes, il s’installe sur l’écran d’accueil et s’ouvre en plein écran, comme une application, sans store.

**Fichiers** : `src/app.html`, `static/`, `src/routes/`, `README-Docker.md`

**À faire**

- Un manifeste web (nom, icônes, couleurs, affichage `standalone`, langue) et les icônes tirées du pack du mainteneur (décision « Logo et icônes (UI-27) ») : fond bordeaux, versions `maskable` comprises, et `apple-touch-icon` ; `theme-color` suit le thème clair ou sombre.
- Le verre remplace le favicon (logo de Svelte) et l’icône `Wine` de l’en-tête, en `currentColor`.
- Pas de mode hors ligne ni de cache des données : un service worker seulement si un navigateur l’exige pour proposer l’installation, sans rien mettre en cache de l’API.
- README-Docker dit comment l’installer, et que l’installation complète sur Android demande HTTPS (reverse proxy), un raccourci sur l’écran d’accueil marchant partout.
- Lot 1 de P13.
- Fait en P13 (2026-10-31, 90ae1d6e..abe7196f) : manifeste « Cellar » (`standalone`, `#582634`), icônes bordeaux du pack copiées telles quelles et déclarées `any` et `maskable` (le verre tient dans la zone sûre : 37,4 % du centre pour 40 %), `apple-touch-icon`, favicon SVG et ICO ; `theme-color` suit le mode clair ou sombre choisi dans les préférences ; `CellarLogo.svelte` remplace l’icône `Wine` de l’en-tête ; pas de service worker ni de cache. Chromium : aucune erreur d’installabilité, l’app installée s’ouvre en `standalone`. README-Docker : « Install on a phone ». Captures validées par le mainteneur ; les deux noms restent (« Cellar » sous l’icône, « Cave à vin » dans l’en-tête).

**Critère d’acceptation** : Chromium reconnaît l’app comme installable en HTTPS ou sur `localhost` (manifeste valide, icônes) ; installée, elle s’ouvre en plein écran ; rien de l’API n’est mis en cache.

**Sources** : Décision « Versions après la 1.0 »

### SEC-13 · En-têtes anti-cadre sur toutes les réponses

Sévérité **mineur** · effort **S** · dépend de REL-06 · statut **Fait**

**Suivi** (2026-10-31) : 3588a50c..4885e697

**Problème** : Trouvé pendant SEC-12 : les réponses qui ne passent pas par `handle` (403 brut de SvelteKit, fichiers statiques servis par adapter-node, exception dans `handle`) n’envoient ni `frame-ancestors` ni `X-Frame-Options`.

**Fichiers** : `server.js`, `src/hooks.server.ts`, `src/hooks.server.test.ts`

**À faire**

- Décision « Pas de cadre (SEC-12) » : chaque réponse du serveur envoie les deux en-têtes, statiques et erreurs comprises, ou le rapport justifie celles qui ne peuvent pas ; testé.
- Lot 1 de P13.
- Fait en P13 (2026-10-31, 3588a50c..4885e697) : `server.js` envoie `frame-ancestors 'none'` et `X-Frame-Options: DENY` sur chaque réponse, avant tout gestionnaire, et `hooks.server.ts` ne le fait plus ; vérifié sur l’app compilée pour les pages, les fichiers statiques, `/uploads`, les 400, 401, 403, 404 et un vrai 500 ; la CI vérifie les en-têtes de l’app compilée (`check-origin.mjs`). Restent sans en-têtes les requêtes que Node refuse lui-même (méthode inconnue, en-têtes trop gros) et le 500 d’adapter-node pour un en-tête de réponse invalide, qu’aucun navigateur ne peut afficher dans un cadre.
- Trouvé pendant SEC-13 : `pnpm dev` et `pnpm preview` ne passent pas par `server.js` et n’envoient donc plus ces en-têtes ; si l’option `kit.csp` de SvelteKit est un jour activée, sa politique doit garder `frame-ancestors 'none'`.

**Critère d’acceptation** : Une page statique, une image de `/uploads`, un 403 et une erreur serveur envoient les deux en-têtes (preuve sur l’app compilée) ; testé.

**Sources** : Trouvé pendant SEC-12, Décision « Pas de cadre (SEC-12) »

### BUG-24 · Messages des sauvegardes

Sévérité **mineur** · effort **S** · dépend de REL-06 · statut **Fait**

**Suivi** (2026-10-31) : b813d1de..19fa8f25

**Problème** : Une sauvegarde nommée `auto` reçoit « cannot start with auto- », qui ne lui correspond pas. Le téléchargement d’une sauvegarde déjà supprimée dit à la fois qu’elle n’existe plus et qu’elle reste dans la liste. Après un 401 dans un dialogue de l’admin, `invalidateAll` recharge la page et le dialogue perd son message.

**Fichiers** : `src/lib/server/features/backups/`, `src/lib/components/admin/backups/`, `src/lib/components/admin/jobs.svelte.ts`, `src/lib/i18n/locales/`

**À faire**

- Trouvé pendant REL-06 : le message du nom réservé dit vraiment pourquoi `auto` est refusé.
- Trouvé pendant BUG-22 : une sauvegarde absente donne un seul message cohérent ; un 401 dans un dialogue de l’admin garde le message visible jusqu’à la reconnexion.
- Chaque correction avec un test qui échoue avant ; lot 1 de P13.
- Fait en P13 (2026-10-31, 0b471075..19fa8f25) : un nom `auto` ou `auto-…` est refusé avec `details.kind: 'reserved'` et un message qui dit pourquoi ; une sauvegarde supprimée avant son téléchargement donne un seul message et la liste se recharge ; après un 401 pendant l’effacement, la page ne se recharge plus et le dialogue de connexion garde son avis « session expirée ». Tests qui échouent avant (7 unitaires, une étape e2e pour le 401), preuves Chromium avant et après.
- Trouvé pendant BUG-24 : le message `errors.invalid_file_name` ne cite ni `\` ni les caractères de contrôle, qu’il refuse aussi.

**Critère d’acceptation** : Chacun des trois cas montre un message juste et unique, prouvé dans Chromium ; testé.

**Sources** : Trouvé pendant BUG-22, Trouvé pendant REL-06

### UI-24 · Libellés ambigus de l’admin

Sévérité **mineur** · effort **S** · dépend de DOC-05 · statut **Fait**

**Suivi** (2026-10-31) : d035629a..0bc1e599

**Problème** : Trouvé pendant UI-23 : « Edit » ouvre deux réglages différents ; « Clear All » vide les filtres de Data et la sélection de l’export CSV ; « Export complet » s’appelle aussi « Create JSON Export » et « Create Export », et son toast « JSON export created » ; le bouton de téléchargement d’un export se nomme « Download backup » ; les résultats d’import d’images ont un titre générique ; en français, le titre du dialogue ZIP passe 3 px sous la croix.

**Fichiers** : `src/lib/components/admin/`, `src/routes/admin/`, `src/lib/i18n/locales/`, `README-Docker.md`

**À faire**

- Décision « Deux « Import ZIP » (UI-23) », étendue : un libellé ne désigne qu’une action ; une même action garde un seul nom, du bouton au toast ; les boutons à icône seule ont un nom accessible juste.
- Les textes qui citent ces libellés suivent (README-Docker, docs/API.md).
- Lot 2 de P13.
- Fait en P13 (2026-10-31, d035629a..0bc1e599) : les 25 libellés validés par le mainteneur (deux « Edit » qui disent ce qu’ils changent, « Sauvegarde complète » et « Export complet » de bout en bout, sauvegarde ou export selon la ligne, « Effacer les filtres » et « Tout désélectionner », « Exporter la sélection », import d’images nommé) ; les titres de dialogue passent à la ligne avant la croix, de 360 px à 1 280 px (le titre ZIP français était à 2,8 px sous la croix) ; deux fonctions de téléchargement d’images réunies.
- Trouvé pendant UI-24 : en français à 320 px, les dialogues d’effacement et de restauration débordent encore, titre compris (`WipeDialog.svelte`, `ReplaceDataDialog.svelte`) ; en anglais seulement, « Wine Formats » contre « Bottle Formats » et « Wine Classifications » contre « Classifications » ; « All Appellations », « All Formats » et « All Availability » en majuscules à côté de « All colors ».

**Critère d’acceptation** : Aucun libellé de l’admin ne désigne deux actions ; « Export complet » garde un nom ; le titre ZIP ne touche plus la croix ; i18n:check vert.

**Sources** : Trouvé pendant UI-23, Trouvé pendant UI-21

### UI-25 · Boutons grisés sans raison et noms coupés au toucher

Sévérité **mineur** · effort **S** · dépend de DOC-05 · statut **Fait**

**Suivi** (2026-10-31) : 881bd286..4ff030c4

**Problème** : Trouvé pendant UI-22 : des boutons restent grisés sans dire pourquoi (préréglages d’étiquettes, connexion, code d’accès, liste de recherche), contre la décision « Messages d’erreur (P7) ». Dans les statistiques, un nom coupé ne se lit en entier qu’au survol, impossible au toucher.

**Fichiers** : `src/lib/components/barcode/PresetManager.svelte`, `src/lib/components/layout/LoginDialog.svelte`, `src/lib/components/admin/dialogs/AccessCodeDialog.svelte`, `src/lib/components/forms/SearchableSelect.svelte`, `src/routes/statistics/`, `src/lib/i18n/locales/`

**À faire**

- Décision « Messages d’erreur (P7) » : chaque bouton grisé dit pourquoi, comme le nom de conteneur vide depuis UI-22.
- Un nom coupé des statistiques se lit en entier au toucher (légende, toucher long ou autre, au choix de la tâche).
- Lot 2 de P13.
- Fait en P13 (2026-10-31, 881bd286..4ff030c4) : chaque bouton grisé des quatre composants dit pourquoi dans une ligne discrète liée par `aria-describedby`, comme depuis UI-22 ; dans les statistiques, un composant `BarChart` remplace quatre copies : chaque barre est un bouton, et un toucher, un clic ou le clavier donne le nom entier et le nombre sous le graphique ; noms sur une ligne coupés par « … », millésimes en « ’17 » (décision « Millésimes des statistiques (UI-25) »). Captures validées par le mainteneur.
- Trouvé pendant UI-25 : d’autres boutons grisés sans raison visible, `admin/EntityFormDialog.svelte:108`, `admin/dialogs/SessionTimeoutDialog.svelte:91`, `admin/dialogs/ImageRenameDialog.svelte:81`, `admin/dialogs/CsvImportDialog.svelte:278` et `:282` (et, avec un nombre à 0 à côté, `barcode/BulkBarcodeDialog.svelte:291`, `barcode/BarcodeStatsCard.svelte:82`) ; quand toute la liste de `SearchableSelect` est désactivée, « Annuler » l’est aussi ; le changement de code d’accès et l’enregistrement d’un préréglage n’ont pas d’état « en cours » et partent deux fois sur un double clic ; un ZIP d’images cassé ne dit que « Some values are invalid. ».

**Critère d’acceptation** : Aucun bouton grisé sans raison visible dans ces quatre composants ; au toucher (Chromium en émulation mobile), un nom coupé se lit en entier.

**Sources** : Trouvé pendant UI-22, Décision « Messages d’erreur (P7) »

### API-13 · Longueur des noms en unités UTF-16

Sévérité **mineur** · effort **S** · dépend de DOC-05 · statut **Fait**

**Suivi** (2026-10-31) : 1241bf5f..4f4b22ad

**Problème** : Trouvé pendant API-12 : `name` et `optionalText` comptent encore en points de code, alors que `longText` et l’interface comptent en unités UTF-16 : un nom d’emoji accepté par l’API peut dépasser la limite d’un formulaire.

**Fichiers** : `src/lib/shared/schemas/common.ts`, `src/lib/server/features/csv-import/`, `docs/API.md`

**À faire**

- Décision « Longueur des textes (DATA-10) » et API-12 : une seule mesure, en unités UTF-16, pour tous les textes, par le même helper ; tests avec emoji à la limite ; docs/API.md suit.
- Lot 2 de P13.
- Fait en P13 (2026-10-31, 1241bf5f..4f4b22ad) : un seul contrôle `maxLength` (unités UTF-16) dans `schemas/common.ts` pour les noms, le producteur, les cépages, la description d’un préréglage, les notes, les descriptions et les suffixes de case ; API, deux imports et formulaires refusent ou acceptent les mêmes noms (tests à 499, 500 et 501 unités) ; décision « Noms trop longs à l’import (API-13) » ; une sauvegarde de la 1.0.0 avec un nom de 501 unités se restaure et se met à jour entière.
- Trouvé pendant API-13 : le code d’accès compte encore en points de code (`routes/api/access-code/+server.ts`, `server/access-code.ts`, `utils/access-code.ts`), laissé exprès pour ne bloquer aucun propriétaire ; le contrôle maison ne donne plus `maxLength` à `z.toJSONSchema` (pour API-14) ; un export de la 1.0.0 avec un conteneur de plus de 275 emojis et des cases reste refusé par l’import JSON, avec un message clair (la sauvegarde ZIP le restaure).

**Critère d’acceptation** : Un nom d’emoji à la limite est accepté ou refusé de la même façon par l’API, l’import et les formulaires ; testé.

**Sources** : Trouvé pendant API-12

### UI-26 · Mise en page commune des derniers dialogues

Sévérité **mineur** · effort **S** · dépend de UI-24 · statut **Fait**

**Suivi** (2026-10-31) : 3e2c2f08..d411e522

**Problème** : Trouvé pendant UI-21 : le détail des bouteilles, toutes les bouteilles, les préréglages, les codes-barres en lot et l’effacement des données ont encore leur mise en page faite à la main, sans `layout/ScrollingDialogContent` ; ordre des titres signalé par axe-core (modéré) ; `85vh` plutôt que `dvh`, qui déborde avec la barre d’adresse d’un téléphone.

**Fichiers** : `src/lib/components/layout/ScrollingDialogContent.svelte`, `src/lib/components/bottles/BottleDetailsDialog.svelte`, `src/lib/components/storage/AllBottlesDialog.svelte`, `src/lib/components/barcode/`, `src/lib/components/admin/`

**À faire**

- Ces dialogues passent à `ScrollingDialogContent` ; la hauteur maximale suit la hauteur visible (`dvh`) ; l’ordre des titres est juste.
- Lot 3 de P13.
- Trouvé pendant UI-24 : en français à 320 px, les dialogues d’effacement et de restauration débordent, titre compris.
- Fait en P13 (2026-10-31, 3e2c2f08..d411e522) : les cinq dialogues sur `layout/ScrollingDialogContent` (hauteur `85dvh`, titre, description, barre d’outils fixe, pied facultatif) ; effacement et restauration tiennent à 320 px en français (boutons qui passent à la ligne, ligne de séparation, accord du coordinateur) ; ordre des titres corrigé (import CSV, guide et résultats ZIP) ; `ScrollRegion` suit l’attribut `disabled`. À 375 × 667, chaque dialogue garde son titre et ses boutons, en anglais et en français.
- Trouvé pendant UI-26 : les cases des lignes de `BulkBarcodeDialog.svelte` n’ont pas de nom accessible (axe : critique, déjà avant) ; `/admin/backups` et l’en-tête défilent de côté à 320 px en français ; encore des hauteurs en `vh` (`WineDefinitionDialog.svelte:37`, `WineBottleDialog.svelte:44`, `ContainerDialog.svelte:106` et `:173`) ; après l’échec d’un envoi en lot, le focus retombe sur la page ; le titre de l’effacement a un ⚠️ dans son texte en plus de son icône ; à décider par le mainteneur : la pagination de « Toutes les bouteilles » dans le pied du dialogue.

**Critère d’acceptation** : À 375 × 667, chacun de ces dialogues garde son titre et ses boutons visibles ; axe-core ne remonte plus l’ordre des titres ; captures avant et après.

**Sources** : Trouvé pendant UI-21

### UI-29 · Derniers boutons grisés sans raison et doubles envois

Sévérité **mineur** · effort **S** · dépend de UI-25 · statut **Fait**

**Suivi** (2026-10-31) : ba526f92..ee658a53

**Problème** : Trouvé pendant UI-25 : des boutons de l’admin et des codes-barres restent grisés sans dire pourquoi, contre la décision « Messages d’erreur (P7) », et deux boutons envoient leur requête deux fois sur un double clic.

**Fichiers** : `src/lib/components/admin/`, `src/lib/components/barcode/`, `src/lib/components/forms/SearchableSelect.svelte`, `src/lib/components/admin/dialogs/AccessCodeDialog.svelte`, `src/lib/components/barcode/PresetManager.svelte`, `src/lib/i18n/locales/`

**À faire**

- Décision « Messages d’erreur (P7) », comme UI-22 et UI-25 : une raison visible pour `admin/EntityFormDialog.svelte:108`, `admin/dialogs/SessionTimeoutDialog.svelte:91`, `admin/dialogs/ImageRenameDialog.svelte:81`, `admin/dialogs/CsvImportDialog.svelte:278` et `:282` ; pour `barcode/BulkBarcodeDialog.svelte:291` et `barcode/BarcodeStatsCard.svelte:82`, dire si le nombre à 0 affiché à côté suffit ou ajouter la raison.
- « Annuler » de `SearchableSelect` reste utilisable quand la liste est désactivée.
- Le changement de code d’accès et l’enregistrement d’un préréglage passent en état « en cours » : un double clic n’envoie qu’une requête ; testé.
- Lot 3 de P13 (accord du mainteneur, 2026-10-31).
- Fait en P13 (2026-10-31, ba526f92..ee658a53) : une raison visible pour les formulaires de Data (nom, pays d’une région, région d’une appellation), la durée de session (1 à 168, bornes partagées dans `shared/session-timeout.ts`, et le serveur refuse aussi 200 ou −3), le renommage d’image et l’import CSV ; le bouton de vérification en lot pointe vers le nombre de codes ; « Annuler » de `SearchableSelect` reste utilisable ; code d’accès et préréglage passent en « Mise à jour… » et « Enregistrement… » : un double clic n’envoie qu’une requête (preuve Chromium, aucun parcours e2e n’atteint ces écrans). Textes validés par le mainteneur.
- Trouvé pendant UI-29 : d’autres boutons gardent leur libellé pendant leur requête (`EntityFormDialog.svelte`, `ImageRenameDialog.svelte`, `SessionTimeoutDialog.svelte`, `BarcodeSettingsDialog.svelte`, `BackupSettingsDialog.svelte`, `NameBackupDialog.svelte`) ; un dialogue rouvert pendant sa requête en reçoit le résultat (`AccessCodeDialog.svelte` montre l’ancienne erreur, `PresetManager.svelte` ferme le dialogue rouvert) ; en français, la durée de session lit « 1,5 » comme 15 (limite acceptée).

**Critère d’acceptation** : Aucun bouton grisé de l’admin et des codes-barres sans raison visible avant le clic, en anglais et en français (captures) ; un double clic sur ces deux boutons n’envoie qu’une requête ; testé.

**Sources** : Trouvé pendant UI-25, Décision « Messages d’erreur (P7) »

### UI-30 · Pagination de « Toutes les bouteilles » dans le pied du dialogue

Sévérité **mineur** · effort **S** · dépend de UI-26 · statut **Fait**

**Suivi** (2026-10-31) : 3383927e..06a8e887

**Problème** : Trouvé pendant UI-26 : dans le dialogue « Toutes les bouteilles » de la page Stockage, la pagination suit la liste et disparaît quand on la fait défiler.

**Fichiers** : `src/lib/components/storage/AllBottlesDialog.svelte`, `src/lib/components/layout/ScrollingDialogContent.svelte`

**À faire**

- La pagination passe dans le pied du dialogue (`footer` de `ScrollingDialogContent`), toujours visible ; accord du mainteneur le 2026-10-31, juste avant la release si c’est rapide.
- Fait en P13 (2026-10-31, 3383927e..06a8e887) : la pagination passe dans le pied du dialogue, seulement quand la liste a plus d’une page, et reste visible pendant qu’on fait défiler la liste, à 375 × 667 comme sur ordinateur.
- Trouvé pendant UI-30 : après un changement de page, la liste garde sa position de défilement, et l’on peut arriver au milieu de la nouvelle page.

**Critère d’acceptation** : À 375 × 667 et sur ordinateur, la pagination reste visible pendant qu’on fait défiler la liste, et change bien de page ; captures avant et après.

**Sources** : Trouvé pendant UI-26

### DEP-08 · Revue des dépendances d’avant la 1.1.0

Sévérité **mineur** · effort **S** · dépend de DEP-07 · statut **Fait**

**Suivi** (2026-10-31) : 77c47838..52c6fe0d

**Problème** : Écarts laissés par DEP-07 : correctifs de SvelteKit, Svelte, adapter-node et Paraglide trop récents, image node 24.22.2 éligible vers le 2026-11-04, docker/login-action 4.7.0 (mineure).

**Fichiers** : `package.json`, `pnpm-lock.yaml`, `.github/workflows/`, `Dockerfile`

**À faire**

- Comme DEP-07 : correctifs publiés depuis au moins 7 jours, une mise à jour par commit, portes à chaque fois ; une mineure seulement avec une raison dans le rapport ; `pnpm audit --prod` vide.
- Lot 3 de P13, juste avant la release.
- Fait en P13 (2026-10-31, 77c47838..52c6fe0d) : kysely 0.28.18 (lockfile seulement, hors image) ; docker/login-action 4.7.0, mineure prise pour undici 6.29.1 (GHSA-2m5v-pch6-74hx, validation TLS) dans l’action qui pousse les images ; aucun paquet de l’image n’avait de correctif de 7 jours, l’image garde ceux de la 1.0.0 et Node 24.22.1 (24.22.2, pas de sécurité, installable le 2026-11-04) ; `pnpm audit --prod` ne remonte que l’alerte minimatch acceptée (décision « Alerte minimatch (DEP-08) »). Correctifs encore trop récents à reprendre : svelte 5.57.3, typescript-eslint 8.72.1, paraglide 2.29.2 et 2.29.3, kit 3.1.1, adapter-node 6.0.1, plugin-icu1 1.3.5, pnpm 10.34.9.
- Trouvé pendant DEP-08 : `ci.yml` tourne sur `ubuntu-latest` (lignes 15, 73, 88), qui passe à Ubuntu 26 depuis le 2026-10-19, alors que `release.yml` fixe `ubuntu-24.04`.

**Critère d’acceptation** : `pnpm audit --prod` ne remonte rien ; chaque dépendance, action et image de base est à son dernier correctif publié depuis au moins 7 jours, ou l’écart est justifié.

**Sources** : Trouvé pendant DEP-07

### REL-07 · Publication de la 1.1.0

Sévérité **évolution** · effort **S** · dépend de DOC-05, UI-27, SEC-13, BUG-24, UI-24, UI-25, API-13, UI-26, UI-29, DEP-08, UI-30 · statut **Fait**

**Suivi** (2026-10-31) : Publiée le 2026-10-31 : tag v1.1.0 sur 76220e38, release 41214334798 verte, image publique 1.1.0 / 1.1 / latest (amd64, arm64) ; banc 1.0.0 vers 1.1.0 à 176 sur 176.

**Problème** : La 1.1.0 apporte aux utilisateurs l’installation dans le README, l’app installable sur le téléphone et les finitions de P13.

**Fichiers** : `releases.json`, `CHANGELOG.md`, `UPGRADING.md`

**À faire**

- Résumé 1.1.0 complété à chaque tâche ; banc de la 1.0.0 vers la 1.1.0 ; release selon RELEASING.md, avec le mainteneur.
- Fait en P13 (2026-10-31, 76220e38) : banc local de la 1.0.0 vers la 1.1.0 à 176 sur 176 (désormais depuis la 1.0.0 seulement, à la demande du mainteneur) ; CI 41214006197 verte ; `main` avancée sur 76220e38, tag v1.1.0, release 41214334798 verte ; `docker pull ghcr.io/lulu300/cellar:1.1.0` sans connexion (tags `1.1.0`, `1.1`, `latest`, amd64 et arm64). develop passe à 1.2.0-rc.0.

**Critère d’acceptation** : v1.1.0 est publiée sur `main` et son image se télécharge sans connexion ; develop passe à 1.2.0-rc.0.

**Sources** : Décision « Versions après la 1.0 »

## P14 · Serveur MCP (1.2.0)

Pour la 1.2.0, enchaînée juste après la 1.1.0 : un serveur MCP intégré à Cellar, pour les assistants d’IA du réseau local (décision « Serveur MCP (P14) »), et la description OpenAPI de l’API, tirée des mêmes schémas zod. Lots : 1. SEC-11, API-14 (faits le 2026-10-31) ; 2. API-10, API-15 (faits le 2026-10-31) ; 3. API-11, DOC-06 (faits le 2026-10-31) ; BUG-25 ; puis REL-08. Publiée en 1.2.0 le 2026-10-31.

### SEC-11 · Jeton d’accès du MCP

Sévérité **évolution** · effort **M** · dépend de REL-07 · statut **Fait**

**Suivi** (2026-10-31) : 65cfcca0..092fde71

**Problème** : Un assistant d’IA ne peut pas se connecter comme le navigateur, avec le code d’accès et un cookie : il lui faut un jeton dédié, qui ne donne accès qu’au MCP.

**Fichiers** : `src/lib/server/db/schema.ts`, `drizzle/`, `src/lib/server/features/`, `src/routes/api/admin/`, `src/routes/admin/`, `docs/API.md`

**À faire**

- Décision « Serveur MCP (P14) » : un jeton généré dans l’admin, stocké haché, affiché une fois, régénérable, sur le modèle du jeton du mode cron (décision « Sauvegardes par cron (DATA-05) ») ; lecture seule par défaut, écriture en option ; le jeton n’ouvre que `/mcp`.
- Migration par `pnpm db:generate` ; une restauration garde le jeton de l’instance, comme le jeton cron (décision « Restauration (audit d’avant 1.0) ») ; tests des refus (jeton absent, faux, révoqué, écriture sans l’option).
- Fait en P14 (2026-10-31, 65cfcca0..092fde71) : jeton MCP sur le modèle du jeton cron, par des aides partagées (`server/bearer-token.ts`) ; haché dans `app_settings` avec l’option d’écriture, sans migration ; `hooks.server.ts` passe chaque requête de `/mcp` par `authenticateMcp` (401 avec `WWW-Authenticate: Bearer` sans jeton valable, `locals.mcpAccess = { write }` sinon), le jeton refusé sur `/api` et le cookie refusé sur `/mcp` ; `assertMcpWrite` pour les outils d’écriture ; une restauration garde jeton et option ; carte « Accès MCP » dans Admin › Réglages, avec « Copier » (qui sélectionne le jeton en HTTP), validée par le mainteneur avec deux retouches. L’option d’écriture est un réglage à part, gardé quand on régénère ou révoque (accord du mainteneur).

**Critère d’acceptation** : Un jeton créé dans l’admin ouvre `/mcp` et rien d’autre ; régénéré, l’ancien est refusé ; sans l’option d’écriture, une écriture est refusée ; testé.

**Sources** : Décision « Serveur MCP (P14) »

### API-14 · Description OpenAPI de l’API

Sévérité **évolution** · effort **M** · dépend de REL-07 · statut **Fait**

**Suivi** (2026-10-31) : 95cf4b69..ce160a2b

**Problème** : docs/API.md se lit, mais aucun outil ne peut le lire : une description OpenAPI permet de générer un client, de tester l’API ou de la parcourir dans un outil.

**Fichiers** : `src/lib/shared/schemas/`, `scripts/`, `docs/`, `src/routes/api/`

**À faire**

- Décision « Doc de l’API (DOC-05, API-14) » : une description OpenAPI 3.1 générée depuis les schémas zod de l’API (`z.toJSONSchema`, sans dépendance), publiée avec la doc ; un test vérifie qu’elle couvre chaque route, comme `api-doc.test.ts` pour docs/API.md.
- Une interface de lecture (Swagger UI ou autre) seulement avec l’accord du mainteneur pour sa dépendance.
- Lot 1 de P14.
- Trouvé pendant API-13 : le contrôle `maxLength` en unités UTF-16 est un contrôle maison que `z.toJSONSchema` ne traduit pas ; la description OpenAPI doit remettre les longueurs maximales.
- Fait en P14 (2026-10-31, 95cf4b69..ce160a2b) : `docs/openapi.json` (OpenAPI 3.1, 106 opérations), généré par `pnpm openapi` depuis `server/openapi.ts` et les schémas zod (`z.toJSONSchema`), sans dépendance ; un test échoue si le fichier n’est plus à jour, si une route manque ou si les règles de session et du jeton cron divergent ; les longueurs maximales en unités UTF-16 sont rendues à `z.toJSONSchema` ; le jeton MCP est décrit dans une note, puisqu’il n’ouvre aucune route de `/api` ; schémas de requête des routes réunis dans `server/http/request-schemas.ts`. Validé une fois par Redocly CLI 2.71.0 (0 erreur, 121 avertissements de style). Les réponses ne sont pas décrites, faute de schémas : docs/API.md reste la référence.
- Trouvé pendant API-14 : le préfixe des codes-barres est décrit jusqu’à 100 caractères alors que le service n’en accepte que 6 (`request-schemas.ts`, `features/barcode/service.ts`, `shared/barcode.ts`) ; avec un cache Vitest chaud, une nouvelle route passe les tests de couverture en local jusqu’au vidage du cache (la CI n’est pas touchée) ; les tables de l’export CSV ne sont pas listées, le schéma les vérifiant par un `refine` ; servir la description depuis l’app (`GET /api/openapi.json`) reste à décider par le mainteneur.

**Critère d’acceptation** : La description OpenAPI couvre chaque route de l’API et se valide avec un outil standard ; elle est à jour à chaque build ; testé.

**Sources** : Décision « Doc de l’API (DOC-05, API-14) »

### API-10 · Serveur MCP : outils de lecture

Sévérité **évolution** · effort **L** · dépend de SEC-11 · statut **Fait**

**Suivi** (2026-10-31) : c318671a..315b3a82

**Problème** : Avec une API propre, Cellar peut répondre aux assistants d’IA du réseau local : « quel vin ce soir avec un poulet rôti ? », « combien me reste-t-il de Bourgogne ? ».

**Fichiers** : `package.json`, `src/routes/mcp/`, `src/lib/server/features/mcp/`, `src/lib/shared/schemas/`, `docs/API.md`, `README-Docker.md`

**À faire**

- Décision « Serveur MCP (P14) » : `@modelcontextprotocol/server` v2 (version publiée depuis au moins 7 jours, en `dependencies`), transport HTTP « streamable » à `/mcp`, monté dans une route SvelteKit ; vérifier ce que le SDK ajoute à l’image et qu’il s’intègre au contrôle d’origine de `hooks.server.ts`.
- Outils de lecture, qui appellent les services (jamais les repositories) et décrivent leurs paramètres à partir des schémas zod partagés : chercher des vins, voir un vin avec ses bouteilles et leurs emplacements, retrouver une bouteille par son code-barres, statistiques, pénurie, place libre dans les rangements.
- Documenter la configuration d’un client (Claude Code, une application de bureau, un modèle local) et la limite : réseau local ou VPN seulement.
- Pour brancher le MCP (rapport de SEC-11) : la route est `src/routes/mcp/+server.ts`, exactement à `/mcp`, jamais dans un groupe de routes ; elle lit `locals.mcpAccess` par une aide qui refuse `undefined` ; chaque POST passe par `runWrite`, si bien qu’une lecture reçoit aussi 503 pendant une restauration, un import ou un effacement, et qu’une réponse en flux sort du verrou avant la fin : à trancher ici ; vérifier que le SDK ne journalise jamais les en-têtes ; une route ajoutée sous `/api` entre dans `server/openapi.ts`, puis `pnpm openapi`.
- Fait en P14 (2026-10-31, c318671a..315b3a82) : `@modelcontextprotocol/server` 2.4.0 (+2 paquets, +8,5 Mo) ; `createMcpHandler(...).fetch` reçoit directement `event.request` dans `src/routes/mcp/+server.ts` (POST seulement), sans session, protocole 2026-07-28 et repli pour 2024-10-07 à 2025-11-25 ; six outils de lecture (`search_wines`, `get_wine`, `find_bottle_by_barcode`, `get_statistics`, `get_wine_shortage`, `get_free_space`) dans `features/mcp/`, réponses JSON compactes par les services ; `/mcp` sort de `runWrite` (les lectures continuent pendant une restauration, un import ou un effacement, comme les GET de l’API ; décision du coordinateur) ; prouvé avec le client du SDK, l’Inspector et Claude Code ; 401 sans jeton, avec un mauvais jeton ou un cookie seul ; jamais de jeton dans les journaux, `DEBUG=mcp` compris. docs/API.md « The MCP server », README-Docker « AI assistants (MCP) ».
- Trouvé pendant API-10 : un DELETE sans `Content-Type` ni `Origin` reçoit le 403 de SvelteKit sur toutes les routes (pas sur `/mcp`) ; le test « pas de jeton dans les journaux » de SEC-11 sérialise par `JSON.stringify`, qui imprime une `Error` comme `{}` (`hooks.server.test.ts`) ; le cache Vitest cache encore une route arrivée par un rebase ; `find_bottle_by_barcode` avec un suffixe très court et `get_wine` pour un vin à longue histoire n’ont pas de taille maximale de réponse.

**Critère d’acceptation** : Un client MCP réel, configuré avec l’adresse et le jeton, liste les outils et obtient des réponses justes sur des données inventées ; sans jeton, `/mcp` répond 401 ; les portes et les parcours passent.

**Sources** : Décision « Serveur MCP (P14) »

### API-11 · Serveur MCP : outils d’écriture

Sévérité **évolution** · effort **M** · dépend de API-10 · statut **Fait**

**Suivi** (2026-10-31) : db6a032c..970563f5

**Problème** : Pour noter une bouteille bue ou ajouter un achat sans ouvrir l’interface, l’assistant doit pouvoir écrire, seulement quand le jeton le permet.

**Fichiers** : `src/lib/server/features/mcp/`, `docs/API.md`

**À faire**

- Décision « Serveur MCP (P14) » : ajouter des bouteilles (ou un vin et ses bouteilles), marquer des bouteilles bues (date, note, commentaire), déplacer des bouteilles, modifier les notes ; mêmes règles et mêmes validations que l’API, par les services.
- Outils marqués comme écritures pour le client (annotations du protocole), refusés quand le jeton est en lecture seule ; aucun outil d’admin.
- Pour brancher les écritures (rapport d’API-10, accord du coordinateur) : `runAsWrite(task)` dans `server/write-gate.ts`, sur lequel `runWrite` s’appuie (un seul verrou) ; chaque outil d’écriture, annoté `readOnlyHint: false` (et `destructiveHint`, `idempotentHint` selon le cas), appelle `assertMcpWrite(access)` puis `runAsWrite(() => appel du service)` dans `answer()`, le verrou couvrant l’écriture seulement ; l’accès vient de `requireMcpAccess(locals)` et passe par requête (`authInfo` de `mcpHandler.fetch` ou un serveur par requête) ; tests : refus avec un jeton en lecture seule, refus pendant `holdWrites`, `holdWrites` attend une écriture en cours ; le test « tous les outils sont en lecture » change ; docs/API.md suit.
- Fait en P14 (2026-10-31, db6a032c..970563f5) : outils d’écriture `add_wine`, `add_bottles`, `mark_bottles_drunk`, `move_bottles`, `update_bottle_notes` et `rate_wine` (la note sur 5 du vin, gardée par le mainteneur ; pas de note sur une bouteille bue avant FEAT-06) ; outils de lecture `list_choices` et `search_appellations` (50 au plus), et les identifiants des cases dans `get_free_space` ; `runAsWrite` dans `write-gate.ts`, sur lequel `runWrite` s’appuie ; un jeton en lecture seule voit les écritures mais reçoit un message qui dit où les autoriser ; refus pendant une restauration ou un import, lectures qui continuent ; arguments inconnus refusés ; date du jour selon l’horloge du serveur, et la description demande à l’assistant de donner le jour de l’utilisateur. Prouvé par le client du SDK et dans l’interface ; aucun changement de `/api`.
- Trouvé pendant API-11 : `TZ` n’est pas documenté, et le conteneur tourne en UTC (README-Docker, `docker-compose.yml`, `Dockerfile`, `features/mcp/service.ts`, `features/backup/scheduler.ts`) ; un refus pour une référence inconnue ne dit pas laquelle, dans l’API comme dans le MCP (`db-errors.ts`, `http/handler.ts`) ; les outils de lecture acceptent encore des arguments inconnus.

**Critère d’acceptation** : Avec un jeton en écriture, un client MCP réel ajoute des bouteilles, en marque une bue et la déplace, et l’interface montre le résultat ; avec un jeton en lecture seule, chaque écriture est refusée ; testé.

**Sources** : Décision « Serveur MCP (P14) »

### API-15 · Servir la description OpenAPI depuis Cellar

Sévérité **évolution** · effort **S** · dépend de API-14 · statut **Fait**

**Suivi** (2026-10-31) : b1eeec7c..56076766

**Problème** : Trouvé pendant API-14 : la description OpenAPI n’existe que dans le dépôt GitHub ; un outil branché sur un serveur ne peut pas lire celle de la version qui y tourne.

**Fichiers** : `src/routes/api/`, `src/lib/server/openapi.ts`, `docs/API.md`, `docs/openapi.json`

**À faire**

- `GET /api/openapi.json` renvoie la description de la version installée, en lecture sans session comme les autres lectures ; elle se décrit elle-même dans docs/API.md et dans la description (accord du mainteneur, 2026-10-31).
- Lot 2 de P14.
- Fait en P14 (2026-10-31, b1eeec7c..56076766) : `GET /api/openapi.json`, sans session, sert `openApiDocument()` calculé au chargement du module (`docs/` n’entre pas dans l’image) ; un test le compare à `docs/openapi.json` ; 107 opérations ; docs/API.md, README et AGENTS.md suivent.

**Critère d’acceptation** : Sur l’app compilée, `GET /api/openapi.json` renvoie le même document que `docs/openapi.json` ; les tests de couverture le voient ; testé.

**Sources** : Trouvé pendant API-14, Décision « Doc de l’API (DOC-05, API-14) »

### DOC-06 · Exemples de configuration des reverse proxies

Sévérité **mineur** · effort **S** · dépend de API-10 · statut **Fait**

**Suivi** (2026-10-31) : 31014c23..997080d4

**Problème** : README-Docker explique quoi régler derrière un reverse proxy (`ORIGIN`, en-têtes, port), mais sans aucune configuration à copier ; le serveur MCP ajoute ses propres besoins (en-tête `Authorization`, réponses en flux sans mise en tampon, délais longs). Le serveur d’un ami du mainteneur tourne derrière SWAG (nginx).

**Fichiers** : `README-Docker.md`, `docs/`

**À faire**

- Exemples complets et commentés pour nginx, SWAG (fichier `proxy-confs` de linuxserver), Caddy et Traefik (labels Docker), plus une ligne pour Nginx Proxy Manager et le reverse proxy de Synology si leurs réglages diffèrent : HTTPS, `ORIGIN` ou en-têtes, taille des envois (import ZIP, restauration), délais des longues opérations, et la règle de `/mcp` (Authorization transmis, pas de mise en tampon, délai long).
- Chaque exemple rejoué avec l’image officielle du proxy devant une app compilée, sur des ports à part : page, écriture (contrôle d’origine), envoi d’un gros fichier et une requête MCP ; SWAG et Synology, s’ils ne se rejouent pas sans domaine, sont dits « non rejoués » avec la raison.
- Lot 3 de P14, après API-10, pour que la règle de `/mcp` soit la vraie.
- Ce que `/mcp` demande au proxy (rapport d’API-10) : transmettre tels quels `Authorization`, `Accept`, `Content-Type`, `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` ; accepter POST ; couper la mise en tampon (`proxy_buffering off`), les réponses aux clients 2025 étant en `text/event-stream` ; HTTP/1.1 vers l’app et un délai de lecture d’au moins 60 s (un flux `subscriptions/listen` reste ouvert, avec un signe de vie toutes les 15 s) ; corps limité à 4 Mio par le SDK ; les clients MCP n’envoient pas d’`Origin`.
- Fait en P14 (2026-10-31, 31014c23..997080d4) : `docs/reverse-proxy.md`, lié depuis README-Docker : ce que Cellar demande (HTTPS et `ORIGIN`, envois jusqu’à 512 Mo, délais par proxy, règle de `/mcp`, port réservé au proxy), puis nginx, SWAG (`cellar.subdomain.conf`, avec ses inclusions et une `location = /mcp`), Caddy (`512MiB`) et Traefik (labels, `readTimeout` 600 s) ; une ligne pour Nginx Proxy Manager (d’après ses modèles) et Synology, non rejoués. Les quatre rejoués avec l’image officielle et le texte même de la doc : page, écritures depuis Chromium, POST d’une autre origine refusé, `/mcp` sans jeton en 401, client 2025 en flux et client 2026-07-28 avec un flux tenu 75 s, restauration de 210 Mo. SWAG avec son vrai démarrage et son nginx, seul le certificat étant fourni.
- Trouvé pendant DOC-06 : Node coupe tout envoi qui dure plus de 300 s (`requestTimeout` par défaut, ni adapter-node ni `server.js` ne le changent) : une restauration de 500 Mo demande au moins 1,8 Mo/s, en direct comme derrière Caddy ou Traefik. Pendant la relecture, un essai de SWAG sans `ONLY_SUBDOMAINS` a contacté le serveur de production de Let’s Encrypt (compte créé sans e-mail, certificat refusé pour `.localhost`).

**Critère d’acceptation** : README-Docker (ou un fichier lié) donne une configuration à copier pour nginx, SWAG, Caddy et Traefik ; celles qui se rejouent servent l’app, ses écritures, un gros envoi et le MCP ; testé à la main, preuves gardées.

**Sources** : Demande du mainteneur (2026-10-31)

### BUG-25 · Envois coupés au bout de 5 minutes

Sévérité **majeur** · effort **S** · dépend de DOC-06 · statut **Fait**

**Suivi** (2026-10-31) : e25a144b..29c63864

**Problème** : Trouvé pendant DOC-06 : Node coupe toute requête dont le corps met plus de 300 s à arriver (`requestTimeout` par défaut, que ni adapter-node ni `server.js` ne changent) ; une restauration ou un import ZIP de 500 Mo demande donc au moins 1,8 Mo/s, en direct comme derrière Caddy ou Traefik, sinon 408.

**Fichiers** : `server.js`, `server.test.ts`, `docs/reverse-proxy.md`, `README-Docker.md`

**À faire**

- `server.js` donne au serveur un délai assez long pour les plus gros envois documentés sur une connexion lente du réseau local, sans le supprimer ; testé ; docs/reverse-proxy.md et README-Docker suivent (la limite devient celle du proxy). Demande du mainteneur, juste avant la release 1.2.0.
- Fait en P14 (2026-10-31, e25a144b..29c63864) : `server.requestTimeout` à 30 minutes dans `server.js` (500 Mo à 0,3 Mo/s), réglé après `listen`, ce que Node relit à chaque contrôle ; jamais 0 ; test qui échoue avant ; sur l’app compilée, une restauration envoyée à 100 Ko/s pendant plus de 5 minutes recevait 408 avant et aboutit après ; docs/reverse-proxy.md (Traefik à 2 400 s), README et AGENTS.md suivent.

**Critère d’acceptation** : Sur l’app compilée, un envoi lent qui dure plus de 5 minutes aboutit ; testé ; la doc des proxies dit la nouvelle limite.

**Sources** : Trouvé pendant DOC-06

### REL-08 · Publication de la 1.2.0

Sévérité **évolution** · effort **S** · dépend de SEC-11, API-14, API-10, API-11, API-15, DOC-06, BUG-25 · statut **Fait**

**Suivi** (2026-10-31) : Publiée le 2026-10-31 : tag v1.2.0 sur 89510c66, release 41236223388 verte après relance d’un échec de cache, image publique 1.2.0 / 1.2 / latest (amd64, arm64) ; bancs 1.1.0 et 1.0.0 vers 1.2.0 à 176 sur 176.

**Problème** : La 1.2.0 apporte aux utilisateurs ce que sa phase a livré.

**Fichiers** : `releases.json`, `CHANGELOG.md`, `UPGRADING.md`

**À faire**

- Résumé 1.2.0 complété à chaque tâche ; banc depuis la version précédente ; release selon RELEASING.md, avec le mainteneur.
- Fait en P14 (2026-10-31, 89510c66) : bancs locaux de la 1.1.0 et de la 1.0.0 vers la 1.2.0, 176 sur 176 chacun ; CI 41235975809 verte ; `main` avancée, tag v1.2.0 ; la release 41236223388 a d’abord échoué sur l’écriture du cache GitHub Actions (build arm64, `not_found`), cause extérieure, puis est passée en relançant les tâches en échec, comme le dit RELEASING.md ; image publique sans connexion (`1.2.0`, `1.2`, `latest`, amd64 et arm64). develop passe à 1.3.0-rc.0.

**Critère d’acceptation** : v1.2.0 est publiée sur `main` et son image se télécharge sans connexion ; develop passe à la rc suivante.

**Sources** : Décision « Versions après la 1.0 »

## P15 · Navigation, photos et achats (1.3.0)

Pour la 1.3.0 (décision « Versions de 1.3.0 à 1.7.0 ») : le menu par sections d’abord, parce que les pages qui suivent s’y rangent, puis les photos d’étiquette et la page Achats, dont les envies réutilisent l’envoi de photo. Lots, chacun mergé avant le suivant, résumé 1.3.0 : 1. UI-28 et FEAT-01 en parallèle (faits le 2026-10-31) (le menu et les photos ne touchent pas les mêmes fichiers) ; 2. FEAT-02, qui a besoin des deux (fait le 2026-11-01) ; 3. DEP-09 ; puis REL-09. Publiée en 1.3.0 le 2026-11-01. Si la phase traîne, la page Achats peut partir d’abord avec des envies en texte seul.

### UI-28 · Menu par sections et barre d’onglets

Sévérité **évolution** · effort **M** · dépend de REL-08 · statut **Fait**

**Suivi** (2026-10-31) : 18f05048..d3745b78

**Problème** : Le menu a neuf entrées et ne peut plus en accueillir : Achats et Producteurs arrivent. Sur téléphone, l’app installée n’a qu’un menu ☰.

**Fichiers** : `src/routes/+layout.svelte`, `src/lib/components/layout/`, `src/routes/`, `src/lib/i18n/locales/`, `e2e/`

**À faire**

- Décision « Navigation (UI-28) » : sections au survol (Cave, Achats, Statistiques, Outils), engrenage, onglets des pages de section, signal d’Achats, lien « N hors cave » sous les filtres de Mes vins, menu ☰ par sections, barre d’onglets dans l’app installée seulement (`display-mode: standalone`).
- Les menus s’ouvrent au survol, au clavier et au toucher (un appui sur une section sans survol ouvre sa première page) ; Échap les ferme ; noms accessibles justes.
- Les adresses d’aujourd’hui continuent de marcher (redirections quand une page change d’adresse) ; les e2e suivent.
- Maquette de référence : https://claude.ai/artifact/VTtcWTR5pnofZW3i7kCEkr (variante B, sans Producteurs dans Outils). Captures en clair et en sombre, ordinateur et téléphone, montrées au mainteneur avant le merge.
- Fait en P15 (2026-10-31, 18f05048..d3745b78) : modèle du menu dans `layout/navigation.ts` (Cave avec le nombre hors cave, Achats avec la pénurie en rouge, Statistiques en lien direct, Outils › Codes-barres, engrenage Préférences, Admin, Déconnexion), composants `NavSectionMenu`, `NavRow`, `NavCount`, `NavList`, `SectionTabs` (partagé avec l’admin) et `TabBar` (app installée, sous 768 px) ; barre du haut dès 768 px avec une souris, menu ☰ sur tout écran tactile ; pénurie sous `/purchases/shortage` (308 depuis `/wine-shortage`) ; lien « N hors cave » sur Mes vins ; « Codes-barres » au pluriel. Captures validées par le mainteneur, avec ses choix pour les sections d’une page ; pas de changement d’API ni de MCP.
- Trouvé pendant UI-28 : les toasts (en haut à droite, z-index 9999, `ToastContainer.svelte`) couvrent les menus ouverts quelques secondes après une action ; le cache Vitest d’un worktree cache des routes arrivées par un rebase (le script des portes le vide désormais avant les tests).

**Critère d’acceptation** : Chaque page s’atteint depuis le menu au survol, au clavier et au toucher ; Achats montre le compteur, le point ou rien selon les cas ; l’app installée a sa barre d’onglets et le navigateur du téléphone n’en a pas ; les anciennes adresses répondent ; captures validées par le mainteneur.

**Sources** : Décision « Navigation (UI-28) »

### FEAT-01 · Photos des vins : plusieurs photos, prises au téléphone, recadrées et allégées

Sévérité **évolution** · effort **L** · dépend de REL-08 · statut **Fait**

**Suivi** (2026-10-31) : fd3ad192..f9675842

**Problème** : Un vin n’a qu’une image, envoyée telle quelle, jusqu’à 20 Mo, avec ses métadonnées (dont la position GPS) ; sur téléphone, rien n’invite à photographier l’étiquette.

**Fichiers** : `src/lib/server/db/schema.ts`, `drizzle/`, `src/lib/server/features/images/`, `src/lib/components/forms/ImagePicker.svelte`, `src/routes/wines/`, `src/lib/i18n/locales/`, `docs/API.md`

**À faire**

- Décision « Photos des vins (FEAT-01) » : plusieurs photos par vin, dont une principale ; migration qui garde l’image actuelle comme principale ; sauvegardes, exports et imports suivent.
- « Prendre une photo » (`capture`) et « Choisir un fichier » ; aperçu avec rotation et recadrage ; réduction, orientation et retrait des métadonnées dans le navigateur, avant l’envoi.
- Le recadrage : écrit à la main sur un canvas, ou une bibliothèque proposée au mainteneur avec sa taille et sa licence ; aucune dépendance sans son accord.
- Le même envoi servira aux photos des envies (FEAT-02) : un composant partagé.
- Fait en P15 (2026-10-31) : `wine_definitions.image_id` reste la photo principale et la table `wine_photos` garde les autres (migration générée, aucune ligne déplacée) ; champ « Photo principale » ; page du vin avec vignettes, « En faire la photo principale » et « Supprimer la photo » ; `PhotoCapture.svelte` (prendre ou choisir, aperçu, rotation, recadrage écrit à la main, JPEG d’environ 1 600 px sans métadonnées) et `ImagePicker.svelte` ; sauvegardes et exports gardent toutes les photos, l’import CSV la principale, l’import ZIP d’images reconnaît chaque photo par son nom ; une photo de 6,1 Mo avec GPS envoyée en 449 Ko sans EXIF ; une base 1.2.0 se met à jour, se restaure et s’importe avec son image devenue principale. `get_wine` du MCP inchangé (pas d’images). Captures validées par le mainteneur. Pas encore essayé sur un vrai téléphone.
- Trouvé pendant FEAT-01 : une erreur pendant le rendu d’une page répond 500 sans rien journaliser (`hooks.server.ts`, `+error.svelte`) ; `node server.js` sans `BODY_SIZE_LIMIT` limite les envois à 512 Ko (seulement hors de l’image Docker).

**Critère d’acceptation** : Sur un téléphone (Chromium en émulation, puis un vrai téléphone si possible), une photo prise est pivotée, recadrée, envoyée réduite et sans métadonnées GPS ; un vin garde plusieurs photos, la principale dans la liste ; une sauvegarde de la version précédente se restaure et se met à jour ; testé.

**Sources** : Décision « Photos des vins (FEAT-01) »

### FEAT-02 · Page Achats : liste d’envies et pénurie

Sévérité **évolution** · effort **L** · dépend de UI-28, FEAT-01 · statut **Fait**

**Suivi** (2026-10-31) : af695367..77ef76ca

**Problème** : La page Pénurie ne connaît que le stock minimum. Les utilisateurs veulent noter les vins qu’ils ont envie d’acheter, puis passer de l’envie à la bouteille sans tout ressaisir.

**Fichiers** : `src/lib/server/db/schema.ts`, `drizzle/`, `src/lib/server/features/`, `src/routes/wine-shortage/`, `src/routes/`, `src/lib/components/`, `src/lib/i18n/locales/`, `docs/API.md`

**À faire**

- Décision « Liste d’envies et achats (FEAT-02) » : table des envies (texte ou vin, quantité, note, photo) par migration ; API, sauvegardes, exports et imports suivent.
- Onglets « Liste d’envies » et « Pénurie » sous Achats (UI-28), avec leur nombre ; signal du menu.
- Envie liée à un vin : « Ajouter une bouteille », enchaînement habituel, retrait proposé au dernier enregistrement ; envie en texte : « Créer la fiche du vin », photo reprise, puis les bouteilles ; bouteille ajoutée ailleurs d’un vin de la liste : même proposition.
- Ajouter une envie depuis la liste des vins (un petit bouton) ou en tapant un nom (proposé s’il existe).
- À reprendre (rapports d’UI-28 et de FEAT-01) : l’onglet « Liste d’envies » s’ajoute à `purchasesSection()` de `layout/navigation.ts` (menu, onglets, ☰, « Plus » et barre d’onglets suivent) ; s’il devient le premier onglet, changer la redirection de `src/routes/purchases/+page.server.ts` ; le point des envies demande un mode « point » dans `NavCount` et un repli dans `alertOf` quand aucun vin n’est en pénurie ; le nombre d’envies se charge dans le load de la mise en page racine ; la photo d’une envie passe par `PhotoCapture.svelte` et `uploadImage`, et son identifiant d’image devient l’`imageId` du vin créé.
- Fait en P15 (2026-11-01, af695367..77ef76ca) : table `wishes` (`0017_wishes.sql`) : un vin ou un texte, jamais les deux, un vin au plus une fois (409 `duplicate_wish`), photo pour un texte seulement ; routes `/api/wishes` ; Achats s’ouvre sur « Liste d’envies » (choix du mainteneur), puis « Pénurie », chacun avec son nombre ; signal du menu en trois états ; cœur sur la page du vin et, après retour du mainteneur, en bouton rond sur le coin de la photo des cartes ; « Créer la fiche du vin » reprend nom et photo puis lie l’envie ; le retrait est proposé quand le dialogue se ferme après au moins une nouvelle bouteille (jamais après une modification) ; Admin › Images nomme les envies qui utilisent une photo ; sauvegardes et exports JSON gardent les envies, pas les CSV ; MCP `get_wishlist`, `add_wish`, `remove_wish`. Une base 1.2.0 se met à jour, se restaure et s’importe.
- Trouvé pendant FEAT-02 : le toast `toast.images_deleted_with_updates` dit que les vins n’ont plus d’image, alors que depuis FEAT-01 un vin prend sa photo suivante (`en.json`, `fr.json`, `ImageDeleteDialog.svelte`).

**Critère d’acceptation** : Une envie en texte avec photo devient un vin puis des bouteilles, et sort de la liste seulement si l’utilisateur le choisit ; une bouteille ajoutée hors de la liste propose le retrait ; les deux onglets et le signal du menu donnent les bons nombres ; une sauvegarde de la version précédente se restaure ; testé, e2e compris.

**Sources** : Décision « Liste d’envies et achats (FEAT-02) »

### DEP-09 · Revue des dépendances d’avant la 1.3.0

Sévérité **mineur** · effort **S** · dépend de DEP-08 · statut **Fait**

**Suivi** (2026-11-01) : 9884e09c..b74a23ee

**Problème** : Écarts laissés par DEP-08 : correctifs devenus éligibles du 2026-11-01 au 2026-11-05 (svelte 5.57.3, typescript-eslint 8.72.1, paraglide 2.29.x, kit 3.1.1, adapter-node 6.0.1, plugin-icu1 1.3.5, pnpm 10.34.9), image node 24.22.2, alerte minimatch acceptée (décision « Alerte minimatch (DEP-08) »).

**Fichiers** : `package.json`, `pnpm-lock.yaml`, `.github/workflows/`, `Dockerfile`

**À faire**

- Comme DEP-07 et DEP-08 : correctifs publiés depuis au moins 7 jours, une mise à jour par commit, portes à chaque fois ; revoir l’alerte minimatch (readdir-glob ou archiver acceptent-ils minimatch 11 ?) ; `pnpm audit --prod` vide ou chaque alerte justifiée.
- Trouvé pendant DEP-08 : `ci.yml` tourne sur `ubuntu-latest`, qui passe à Ubuntu 26, alors que `release.yml` fixe `ubuntu-24.04`.
- Lot 3 de P15, juste avant la release.
- Choix du mainteneur (2026-11-01) : publier la 1.3.0 sans attendre ; DEP-09 ne prend que ce qui est éligible le jour même, le reste passe à DEP-10 (P16).
- Fait en P15 (2026-11-01, fe9cc7b6..b74a23ee) : dix correctifs du fichier de verrouillage, tous hors des paquets du serveur dans l’image (esbuild, tabbable, uuid, zimmerframe, magic-string…) ; `ci.yml` sur `ubuntu-24.04` comme `release.yml` ; aucune dépendance directe, action ni image de base n’avait de correctif de 7 jours ; l’image garde les paquets et Node 24.22.1 de la 1.2.0 ; l’alerte minimatch reste acceptée (readdir-glob 3.0.0 et archiver 8.0.0 n’ont pas bougé). La liste datée de ce qui devient éligible du 2026-11-01 au 2026-11-06 est pour DEP-10.
- Trouvé pendant DEP-09 : alerte basse GHSA-gcqx-w48m-w2h4 sur deepmerge 4.3.1, par vite-plugin-svelte, outil de développement seulement, sans correctif publié ; DEP-08 n’avait parcouru que les dépendances du serveur : DEP-10 parcourt tout le fichier de verrouillage (`scripts/lockfile-patches.mjs` des preuves de DEP-09).

**Critère d’acceptation** : Chaque dépendance, action et image de base est à son dernier correctif publié depuis au moins 7 jours, ou l’écart est justifié ; `pnpm audit --prod` vide ou chaque alerte justifiée.

**Sources** : Trouvé pendant DEP-08, Décision « Alerte minimatch (DEP-08) »

### REL-09 · Publication de la 1.3.0

Sévérité **évolution** · effort **S** · dépend de UI-28, FEAT-01, FEAT-02, DEP-09 · statut **Fait**

**Suivi** (2026-11-01) : Publiée le 2026-11-01 : tag v1.3.0 sur 5bb5dfdd, release 41256588054 verte, image publique 1.3.0 / 1.3 / latest (amd64, arm64) ; bancs 1.2.0 et 1.0.0 vers 1.3.0 à 176 sur 176 après avoir appris au banc le champ wishes.

**Problème** : La 1.3.0 apporte aux utilisateurs ce que sa phase a livré.

**Fichiers** : `releases.json`, `CHANGELOG.md`, `UPGRADING.md`

**À faire**

- Résumé 1.3.0 complété à chaque tâche ; banc depuis la version précédente ; release selon RELEASING.md, avec le mainteneur.
- Fait en P15 (2026-11-01, 5bb5dfdd) : bancs de la 1.2.0 et de la 1.0.0 vers la 1.3.0, d’abord à 174 sur 176 : le nouveau champ `wishes` de `GET /api/admin/images` (FEAT-02) ; listes d’images identiques sans lui, vérifié par empreintes ; le banc ignore désormais ce champ à partir de la 1.3.0 (copie d’avant : `upgrade-test.sh.bak-before-1.3`), puis 176 sur 176 chacun. CI 41256340804 verte ; `main` avancée, tag v1.3.0, release 41256588054 verte ; image publique sans connexion (`1.3.0`, `1.3`, `latest`, amd64 et arm64). develop passe à 1.4.0-rc.0. Publiée sans attendre les correctifs du 2026-11-05, au choix du mainteneur (DEP-10).

**Critère d’acceptation** : v1.3.0 est publiée sur `main` et son image se télécharge sans connexion ; develop passe à la rc suivante.

**Sources** : Décision « Versions après la 1.0 »

## P15b · Correctifs de la 1.3.0 (1.3.1)

Pour la 1.3.1, avant P16 (décision « Version corrective 1.3.1 ») : UI-31 (fait le 2026-11-01) ; puis REL-14. Publiée en 1.3.1 le 2026-11-01.

### UI-31 · Menu et bouton d’envie : écarts, badge, icône et survol

Sévérité **mineur** · effort **S** · dépend de REL-09 · statut **Fait**

**Suivi** (2026-11-01) : 2b08f1f6..a1f3170f

**Problème** : Retours du mainteneur sur la 1.3.0 : au survol de la section voisine, le fond de survol recouvre le badge rouge de « Achats », et les sections du menu ne sont séparées que de quelques pixels ; le cœur de la liste d’envies prendra le sens de « favori » le jour où les favoris existeront ; sur une carte de vin, le bouton d’envie garde le curseur par défaut, et en thème sombre, sans photo, son survol ne change rien de visible.

**Fichiers** : `src/lib/components/layout/NavCount.svelte`, `src/lib/components/layout/NavSectionMenu.svelte`, `src/lib/components/layout/`, `src/lib/components/wishlist/WishButton.svelte`, `src/lib/components/layout/navigation.ts`, `src/routes/purchases/wishlist/+page.svelte`, `src/lib/components/wines/WineCard.svelte`

**À faire**

- Menu : un peu plus d’écart entre les sections de la barre du haut, et le badge (nombre rouge ou point) toujours au-dessus du fond de survol ou de sélection des sections voisines ; la barre d’onglets du téléphone garde le même ordre d’empilement.
- Liste d’envies : le signet de la bibliothèque d’icônes (`@lucide/svelte`) remplace le cœur partout (bouton des cartes et de la page d’un vin, menu, onglet et page vide de la liste), en couleur du thème comme les autres icônes ; vide hors de la liste, plein quand le vin y est (décision « Icône de la liste d’envies (1.3.1) »).
- Bouton d’envie : curseur main au survol, et un survol visible dans tous les cas : clair et sombre, avec et sans photo.
- Fait en P15b (2026-11-01, 2b08f1f6..9a3668df) : badge du menu en z-10 et écart entre sections de 2 à 6 px ; `Bookmark` à la place de `Heart` (bouton, menu, page vide de la liste, texte d’aide) ; curseur main ; pastille de la photo couleur du thème au survol, signet plein avec un survol visible hors de la photo. Planche des vraies icônes montrée au mainteneur (le carré vert de la première venait de la photo factice). Deux revues, toutes leurs remarques réglées ; CI 41297343082 verte.
- Trouvé pendant UI-31 : avec les réglages par défaut de Tailwind 4, tous les autres boutons gardent la flèche au survol : `iconButton` et `smallIconButton` de `wines/WineCard.svelte`, « Modifier » de `routes/wines/[id]/+page.svelte`, et le `Button` de shadcn (`components/ui/button/button.svelte`), donc tous les boutons de l’app.

**Critère d’acceptation** : Captures avant et après, ordinateur et téléphone, clair et sombre : badge au premier plan au survol de la section voisine, signet vide et plein, survol visible sans photo en sombre ; testé.

**Sources** : Retours du mainteneur, 2026-11-01

### REL-14 · Publication de la 1.3.1

Sévérité **évolution** · effort **S** · dépend de UI-31 · statut **Fait**

**Suivi** (2026-11-01) : 2c3defa7

**Problème** : La 1.3.1 apporte les retouches de UI-31 sans attendre la 1.4.0.

**Fichiers** : `releases.json`, `CHANGELOG.md`, `UPGRADING.md`, `package.json`

**À faire**

- Résumé 1.3.1 ; bancs depuis la 1.3.0 et la 1.0.0 ; release selon RELEASING.md, publiée sans repasser par le mainteneur (son accord du 2026-11-01) ; puis develop repasse à 1.4.0-rc.0 avec l’entrée 1.4.0 de `releases.json`.
- Fait en P15b (2026-11-01, 2c3defa7) : bancs de la 1.3.0 et de la 1.0.0 vers la 1.3.1, 176 sur 176 chacun ; CI 41297833466 verte ; `main` avancée, tag v1.3.1, release 41298096554 verte ; image publique sans connexion (`1.3.1`, `1.3`, `latest`, amd64 et arm64). develop repasse à 1.4.0-rc.0 (efc0c725), avec l’entrée 1.4.0 de `releases.json`.

**Critère d’acceptation** : v1.3.1 est publiée sur `main` et son image se télécharge sans connexion ; develop repasse à 1.4.0-rc.0.

**Sources** : Décision « Version corrective 1.3.1 »

## P15c · Cartes de vin (1.3.2)

Pour la 1.3.2, avant P16 (décisions « Cartes de vin (UI-32) » et « Version corrective 1.3.1 », qui vaut aussi pour la 1.3.2) : UI-32 (fait le 2026-11-01) ; puis REL-15. Publiée en 1.3.2 le 2026-11-01.

### UI-32 · Cartes de vin identiques, sans texte coupé pour de bon

Sévérité **mineur** · effort **M** · dépend de REL-14 · statut **Fait**

**Suivi** (2026-11-01) : 1a00c279..18897dd0

**Problème** : Retours du mainteneur sur la 1.3.1 : le nom d’une carte est coupé dès qu’il est un peu long, sans autre moyen de le lire qu’une infobulle sur ordinateur ; quand la fenêtre rétrécit, les cartes se serrent au lieu de perdre une colonne (la grille ajoute des colonnes par paliers et garde des cartes de 230 à 260 px) ; « modifier » et « dupliquer » prennent la place du nom ; seuls les boutons d’envie montrent la main au survol.

**Fichiers** : `src/lib/components/wines/WineCard.svelte`, `src/lib/components/wines/WineListView.svelte`, `src/app.css`, `src/lib/components/ui/button/button.svelte`, `src/lib/i18n/locales/`, `e2e/`

**À faire**

- Carte horizontale de la maquette C3 (https://claude.ai/artifact/9GrYNvpP1LUCF8jfT3Rwze, planche « C3 ») : photo principale en portrait, 100 × 140 px, à gauche ; à droite, le nom, puis producteur · région sur une ligne, puis les badges (type, couleur, note), puis la fiche classement, millésime et prix, chacun derrière une icône (`Award`, `Calendar`, `Coins` de `@lucide/svelte`) avec son libellé pour les lecteurs d’écran et au survol de l’icône ; dessous, deux lignes réservées à la description, « Aucune description » sinon ; en bas, une barre : nombre de bouteilles, ajouter une bouteille, signet, modifier, dupliquer.
- Toutes les cartes ont exactement la même taille : chaque champ tient sur une ligne, la description a toujours deux lignes réservées. Un texte réellement coupé (mesuré, pas deviné) s’estompe à droite et défile au survol de la carte ; aucun mouvement avec `prefers-reduced-motion`. Sur un écran sans survol, le nom a deux lignes réservées. Images masquées : la photo disparaît, les cartes restent identiques entre elles.
- Grille : des cartes de 340 px au moins (`auto-fill`), une colonne sur téléphone ; plus de paliers de colonnes fixes. Retirer les règles `.wine-cards-grid` et `.wine-card-*` de `app.css` si plus rien ne s’en sert.
- Curseur main sur tous les boutons de l’app (Trouvé pendant UI-31) : une règle de base, comme le recommande Tailwind 4, plutôt que bouton par bouton.
- Fait en P15c (2026-11-01, 1a00c279..6137093a) : carte C3 dans `WineCard.svelte` avec un composant `ScrollingText` (mesure du texte coupé, dégradé, défilement au survol, rien avec `prefers-reduced-motion`, clics transmis au lien de la carte) ; toutes les cartes à 272 px de haut (292 px sur écran tactile), avec ou sans images, dans 12 vues mesurées ; grille de 340 px au moins ; main sur tous les boutons par une règle de base. Écarts validés par le mainteneur : badges dans l’ordre type, couleur, note ; « Aucune description disponible » ; pas d’infobulle sur la description. Deux revues, tout réglé sauf l’infobulle du nom qui couvre toute la carte (antérieure, gardée) ; CI 41313969577 verte.
- Trouvé pendant UI-32 : l’infobulle du nom (`title`) s’affiche au survol de toute la carte, parce que le lien du nom la couvre (`wines/WineCard.svelte`) ; antérieur à la 1.3.2.

**Critère d’acceptation** : Captures avant et après, téléphone et ordinateur, clair et sombre, avec et sans images : cartes de même hauteur avec des noms, classements et descriptions de longueurs différentes ; défilement au survol d’un texte coupé seulement ; grille qui perd une colonne en rétrécissant ; main sur les boutons ; testé.

**Sources** : Décision « Cartes de vin (UI-32) »

### REL-15 · Publication de la 1.3.2

Sévérité **évolution** · effort **S** · dépend de UI-32 · statut **Fait**

**Suivi** (2026-11-01) : 856f70ee

**Problème** : La 1.3.2 apporte les nouvelles cartes de vin sans attendre la 1.4.0.

**Fichiers** : `releases.json`, `CHANGELOG.md`, `UPGRADING.md`, `package.json`

**À faire**

- Résumé 1.3.2 ; bancs depuis la 1.3.1 et la 1.0.0 ; release selon RELEASING.md, avec le mainteneur ; puis develop repasse à 1.4.0-rc.0 avec l’entrée 1.4.0 de `releases.json`.
- Fait en P15c (2026-11-01) : bancs de la 1.3.1 et de la 1.0.0 vers la 1.3.2, 176 sur 176 chacun ; CI 41314278090 verte ; `main` avancée, tag v1.3.2, release 41314659498 verte ; image publique sans connexion (`1.3.2`, `1.3`, `latest`, amd64 et arm64). develop repasse à 1.4.0-rc.0 (80ea8300), avec l’entrée 1.4.0 qui annonce aussi la vue liste.

**Critère d’acceptation** : v1.3.2 est publiée sur `main` et son image se télécharge sans connexion ; develop repasse à 1.4.0-rc.0.

**Sources** : Décision « Version corrective 1.3.1 »

## P16 · Couleurs et plan de la cave (1.4.0)

Pour la 1.4.0 : les couleurs des vins, puis le plan de la cave, qui s’appuie dessus. Ordre : FEAT-10 (vue liste, demandée avec UI-32) ; FEAT-03 ; FEAT-11 (actions MCP, demandées après l’essai d’un utilisateur) ; FEAT-04 ; FEAT-12 (MCP plus complet, demandé après FEAT-11) ; FEAT-13 (deux refus, trouvés pendant FEAT-12) ; puis REL-10. DEP-10 passe après la 1.4.0. Publiée en 1.4.0 le 2026-11-02.

### FEAT-10 · Vue liste des vins, au choix avec les cartes

Sévérité **évolution** · effort **M** · dépend de REL-15 · statut **Fait**

**Suivi** (2026-11-01) : d9a6a731..f0e43641

**Problème** : Le mainteneur veut pouvoir parcourir la cave en liste, une ligne par vin, à côté de la vue en cartes, et choisir dans les préférences la vue qui s’ouvre par défaut.

**Fichiers** : `src/lib/components/wines/`, `src/lib/stores/preferences.svelte.ts`, `src/routes/preferences/`, `src/lib/i18n/locales/`, `e2e/`

**À faire**

- Maquette D3 (https://claude.ai/artifact/9GrYNvpP1LUCF8jfT3Rwze, planche « D3 ») : sur ordinateur, un tableau (vignette, vin avec producteur · classement dessous, région, couleur, millésime, prix, bouteilles, note, actions) ; sur téléphone, une ligne par vin (nom, producteur · région, couleur, millésime, bouteilles, prix, menu d’actions). Rien n’est coupé : un texte long passe à la ligne et la ligne grandit. Les mêmes actions que la carte, au clavier aussi.
- Un sélecteur « Cartes / Liste » sur la page, comme l’interrupteur des images ; dans les préférences, la vue qui s’ouvre par défaut. Tri, filtres et pagination identiques dans les deux vues.
- Fait le 2026-11-01 (d9a6a731..f0e43641, statut 8a351216, CI 41326345750) : `WineTable.svelte` d’après la maquette D3, `?view=list|cards` dans l’adresse (lu par `readWineListQuery`) avec un groupe de boutons radio partagé avec les préférences, la vue par défaut dans les préférences, les valeurs dérivées d’un vin partagées avec la carte (`wine-facts.ts`), le menu d’actions par le `dropdown-menu` de shadcn. Sur décision du mainteneur, la colonne Note montre « — » pour un vin sans note (un lecteur d’écran entend « Aucune note ») et le prix garde la moyenne ; un nom de couleur long est limité à 6rem et passe à la ligne. Aucun texte coupé en 20 vues, 24 actions sur 24 à la souris et au clavier, lien des lignes vérifié dans WebKit ; pas de changement de l’API ni du MCP (préférence d’affichage du navigateur). Quatre revues.
- Trouvé pendant FEAT-10 : avec la préférence « Liste », la page montre les cartes puis la liste après l’hydratation, parce que la préférence vit dans localStorage, comme l’interrupteur des images ; accepté, une préférence d’affichage en cookie le réglerait (tâche à part). Sur la page Stockage (`src/routes/storage/+page.svelte`), le choix Tableau / Grille n’est pas gardé dans l’adresse et ses boutons n’ont pas le rôle radio. Le signet de la liste d’envies (`src/lib/components/wishlist/WishButton.svelte`) perd le focus clavier après un appui, parce qu’il est désactivé pendant l’envoi, sur les cartes comme dans la liste. La clé `wine_details.rating` sert aussi à `WineListToolbar.svelte` et `WineTable.svelte`, hors de `common.*`. La vérification d’accès du menu d’actions de la liste n’a pas de test.

**Critère d’acceptation** : La vue liste montre tous les vins filtrés sans texte coupé, sur téléphone et ordinateur, en clair et en sombre ; le sélecteur change de vue et la préférence choisit celle d’arrivée ; captures ; testé.

**Sources** : Décision « Vue liste (FEAT-10) »

### FEAT-03 · Une vraie couleur pour chaque couleur de vin

Sévérité **évolution** · effort **M** · dépend de FEAT-10 · statut **Fait**

**Suivi** (2026-11-02) : cbd4fe8f..39143a78

**Problème** : Les couleurs de vin ne sont que des noms ; les étiquettes et les graphiques tirent leur teinte d’une palette fixe (`wine-badges.ts`) où le Blanc sort brun et le Rosé magenta, et la page Stockage montre toutes les bouteilles en rouge.

**Fichiers** : `src/lib/server/db/schema.ts`, `drizzle/`, `src/lib/server/db/seed.ts`, `src/lib/utils/wine-badges.ts`, `src/lib/components/storage/`, `src/routes/statistics/`, `src/lib/components/wines/`, `src/lib/components/table/`, `src/routes/admin/`

**À faire**

- Décision « Couleurs des vins (FEAT-03) » : colonne de couleur (migration), valeurs de départ, sélecteur dans Admin › Data, teinte par défaut à la création rapide ; exports et imports suivent.
- Stockage (places occupées, contour seulement quand le contraste manque, calculé depuis la couleur ; remplacé le 2026-11-02 par un contour sur toutes les couleurs, voir la décision), statistiques, étiquette et bande des cartes de vin, étiquette de la vue liste (`WineTable.svelte`, FEAT-10), étiquette à côté du nom dans les listes de bouteilles.
- Maquette de référence : https://claude.ai/artifact/NiDbVPAQ4f4FS76h4QuTjn ; diff de la maquette dans les notes du coordinateur. La requête de la vue du stockage reste légère (une requête à part plutôt que dans `caseLoads`).
- Trouvé pendant FEAT-02 : sur ordinateur à 1 280 px, le nom d’une carte de vin est coupé au-delà d’environ 9 lettres, parce que « modifier » et « dupliquer » partagent la ligne du titre (`wines/WineCard.svelte`) ; à régler avec la bande de couleur, en montrant les captures au mainteneur. Réglé par UI-32 (1.3.2) : la bande de couleur s’adapte à la carte C3.
- Fait le 2026-11-02 (cbd4fe8f..39143a78, statut e6af4069, CI 41430040449) : colonne `hex` de `wine_colors` (migrations 0018 et 0019, qui donne les couleurs de départ par le nom), `startingHex` partagé par le seed, les créations sans teinte et les imports JSON et CSV ; une requête à part pour les couleurs des cases du stockage ; `wine-color.ts` (contraste, contour, texte) et `WineColorBadge.svelte` ; sélecteur de teinte dans Admin › Data ; `colorHex` dans l’API (API.md et OpenAPI) ; MCP inchangé (les outils parlent des couleurs par leur nom ; `get_statistics` donne aussi `hex`). Trois revues. Reste : la migration 0019 ne reconnaît que la casse, les espaces autour du nom et le é de Rosé ; un nom comme « Rosè » reçoit le gris à la mise à jour et se corrige dans l’admin (jugé improbable).

**Critère d’acceptation** : Une couleur choisie dans l’admin se voit sur le stockage, les statistiques, les cartes et les listes de bouteilles, en clair, en sombre et avec une coloration des préférences ; un blanc pâle et un rouge foncé restent visibles grâce au contour ; captures avant et après ; testé.

**Sources** : Décision « Couleurs des vins (FEAT-03) »

### FEAT-11 · Nouvelles actions du serveur MCP

Sévérité **évolution** · effort **M** · dépend de FEAT-03 · statut **Fait**

**Suivi** (2026-11-02) : d163a28a..40464b95

**Problème** : Un assistant peut recommander une bouteille mais pas la sortir de la cave : le MCP ne sait que la marquer bue. Il ne peut pas non plus changer un vin ou une bouteille au-delà des notes, ni parcourir l’historique de toute la cave.

**Fichiers** : `src/lib/server/features/mcp/`, `src/lib/server/features/bottles/`, `src/lib/server/features/catalog/`, `src/lib/server/features/wishlist/`, `docs/API.md`, `README-Docker.md`

**À faire**

- Décision « Actions MCP (FEAT-11) » : sortir des bouteilles de la cave, les remettre dans une case, annuler un « bu » ; modifier un vin et les champs des bouteilles ; lister les bouteilles par état et par date ; modifier un souhait ; supprimer une bouteille. Chaque action passe par les services et les règles de l’API (case pleine, code-barres en double, écritures suspendues pendant une restauration), refuse un argument inconnu et donne ses annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`).
- Documentation : la liste des outils dans `docs/API.md`, la phrase de README-Docker qui dit ce qu’un assistant peut faire, et une ligne sur les applications Claude web et mobile, dont les connecteurs partent d’Internet et ne joignent pas un serveur du réseau local (passer par Claude Code ou un client local avec l’en-tête du jeton).
- Fait le 2026-11-02 (d163a28a..40464b95, statut 63451f23, CI 41434787934) : sept outils, `list_bottles`, `update_wine`, `update_bottles`, `take_bottles_out` (la bouteille garde sa case, comme dans l’application), `put_bottles_back` (dans une case donnée ou celle qu’elle a gardée ; une bouteille bue n’a plus de case), `update_wish` et `delete_bottles` (destructif, tout ou rien) ; `editDefinition` remplace `rateDefinition`, `deleteBottlesById` et `changeWish` dans les services. Textes d’Admin › Réglages › Accès MCP mis à jour (la suppression y est dite), API.md et README-Docker (les connecteurs des applications Claude ne joignent pas le réseau local). Parcours JSON-RPC réel : 34 vérifications sur 34, jeton en lecture seule compris. Une revue.
- Trouvé pendant FEAT-11 : les erreurs du MCP ne rendent que le message du refus, jamais ses `details` (`answer()` de `src/lib/server/features/mcp/server.ts`) : avec plus de 10 bouteilles inconnues, l’assistant ne sait pas lesquelles retirer (`not_found`, `existingBottles` de `src/lib/server/features/bottles/service.ts`) ; il ne sait pas quelles bouteilles dépassent la taille des notes (`notes_too_long`, même fichier) ; il doit relire la liste d’envies pour trouver un souhait déjà là (`duplicate_wish`, `src/lib/server/features/wishlist/service.ts`). Piste : ajouter les `details` en JSON au texte de l’erreur. README.md (ligne 8) dit seulement qu’un assistant peut lire la cave : encore vrai, sans parler des écritures.

**Critère d’acceptation** : Depuis un client MCP réel (Claude Code), on demande un vin, on sort la bouteille de la cave, on la remet dans une case, on change la quantité cible du vin et le prix d’une bouteille, on liste ce qui a été bu dans le mois ; un jeton en lecture seule refuse chaque écriture ; testé.

**Sources** : Décision « Actions MCP (FEAT-11) »

### FEAT-04 · Plan de la cave : les bouteilles d’une case

Sévérité **évolution** · effort **M** · dépend de FEAT-11 · statut **Fait**

**Suivi** (2026-11-02) : e7aafe34..f6915ee4

**Problème** : Sur la page Stockage, une case montre combien de bouteilles elle contient, mais pas lesquelles ; un clic ne fait rien, et déplacer une bouteille passe par son formulaire.

**Fichiers** : `src/routes/storage/`, `src/lib/components/storage/`, `src/routes/wines/[id]/`, `src/lib/server/features/storage/`, `src/lib/i18n/locales/`

**À faire**

- Décision « Plan de la cave (FEAT-04) » : un clic sur une case ouvre ses bouteilles (dialogue `layout/ScrollingDialogContent`), avec ouvrir, marquer bue et déplacer ; sélection multiple et « Déplacer vers… » ; une case pleine refuse avec un message clair.
- « Voir dans la cave » sur la page d’un vin : la page Stockage met en évidence ses cases.
- Fait le 2026-11-02 (e7aafe34..f6915ee4, statut daa0307d, CI 41450581232) : `CaseBottlesDialog.svelte` (une colonne Vin, le millésime après le producteur, pour tenir à 390 px), `CaseTargetPicker.svelte` groupé par conteneur avec une règle de comptage testée (`case-move.ts`), `BottleDialogs` et `BottleChangeDialogs` partagés par les dialogues de bouteilles, `?wine=` sur la page Stockage ; `GET /api/storage-cases/{id}/bottles` et `caseId` de `list_bottles` sur une même fonction de service (API.md, OpenAPI). Deux revues.
- Trouvé pendant FEAT-04 : l’encadré « Emplacements » de la page d’un vin (`storageLocations` de `src/routes/wines/[id]/+page.svelte`) compte une bouteille hors cave dans la case qu’elle a gardée, contrairement à tous les comptes des cases. `src/lib/components/ui/select/select-item.svelte` (fichier de la CLI shadcn) ne transmet pas sa prop `label` à bits-ui : la recherche au clavier d’un Select porte sur la valeur (un identifiant dans le choix de case), pas sur le texte affiché.

**Critère d’acceptation** : Depuis la page Stockage, on voit les bouteilles d’une case et on en déplace trois d’un coup vers une autre case, au doigt comme à la souris ; « Voir dans la cave » met en évidence les bonnes cases ; testé, e2e compris.

**Sources** : Décision « Plan de la cave (FEAT-04) »

### FEAT-12 · Un MCP plus complet : erreurs détaillées, descriptions relues, case d’une bouteille bue

Sévérité **évolution** · effort **M** · dépend de FEAT-04 · statut **Fait**

**Suivi** (2026-11-02) : 16db2372..c94bfe33

**Problème** : Après FEAT-11, une erreur du MCP ne rend que son message : avec plus de 10 bouteilles inconnues, l’assistant ne sait pas lesquelles retirer. Une bouteille marquée bue perd sa case : pour annuler un « bu », ni l’assistant ni l’application ne savent où elle était.

**Fichiers** : `src/lib/server/features/mcp/`, `src/lib/server/features/bottles/`, `src/lib/components/bottles/`, `docs/API.md`, `README-Docker.md`

**À faire**

- Décision « MCP le plus complet possible (FEAT-12) ». Erreurs : `answer()` de `src/lib/server/features/mcp/server.ts` ajoute les `details` du refus au texte (`not_found` et ses `ids`, `notes_too_long`, `duplicate_wish` et son `wishId`) ; API.md le dit.
- Relecture de chaque outil (nom, description, paramètres, réponses, refus) du point de vue d’un assistant qui ne connaît pas Cellar : ce qu’il faut appeler avant, ce qui ne peut pas s’annuler, l’outil voisin à préférer. Un outil qui manque encore est proposé au mainteneur, pas ajouté d’office.
- Une bouteille bue garde sa case (`withConsumptionRule` de `src/lib/server/features/bottles/service.ts`), sans y compter, comme une bouteille hors cave ; `put_bottles_back` sans `caseId` la remet dans cette case ; le dialogue de statut de l’application propose cette case quand on remet une bouteille bue en cave. Vérifier chaque compte et chaque liste des cases (stockage, plan de FEAT-04, place libre, choix de la case, suppression d’une case, encadré « Emplacements » de la page d’un vin, qui compte déjà à tort les bouteilles hors cave : Trouvé pendant FEAT-04).
- Fait le 2026-11-02 (16db2372..c94bfe33, statut e0d96b9e, CI 41465272710) : chaque refus du MCP donne son message puis « Details: <JSON> » ; consignes du serveur réécrites et 24 outils relus (38 textes changés), sans nouvel outil ; `location` et `caseId` seulement pour une bouteille en cave, `formerLocation` et `formerCaseId` pour une bouteille hors cave ou bue ; `offset` sur `search_wines` et `list_bottles` ; une bouteille bue garde sa case (`withConsumptionRule`), y revient et refuse une case remplie entre-temps ; le formulaire nomme la case d’une bouteille bue ; l’encadré « Emplacements » ne compte que les bouteilles en cave (`storageLocations` de `wine-facts.ts`) ; l’import CSV garde la case d’une bouteille bue quand elle existe dans le conteneur de la ligne. Parcours JSON-RPC réel : 21 sur 21. Deux revues.
- Trouvé pendant FEAT-12 : le refus `case_full` (`CaseFullError` de `src/lib/server/features/storage/service.ts`) donne le nom de la case mais pas son identifiant, et l’ajouter change la réponse 409 de l’API ; `missing_reference` (`refusedWriteError` de `src/lib/server/db-errors.ts`) ne dit pas quel identifiant manque, donc un `add_bottles` avec un `formatId` ou un `originId` faux ne sait pas lequel corriger.

**Critère d’acceptation** : Une erreur du MCP donne au client la liste complète des bouteilles en cause ; chaque description d’outil est relue et la documentation suit ; une bouteille bue par erreur revient dans sa case, depuis le MCP comme depuis l’application, sans changer les comptes des cases ; testé.

**Sources** : Décision « MCP le plus complet possible (FEAT-12) », Trouvé pendant FEAT-11

### FEAT-13 · Deux refus qui disent tout : case pleine et référence inconnue

Sévérité **évolution** · effort **S** · dépend de FEAT-12 · statut **Fait**

**Suivi** (2026-11-02) : ff00d9a5..73d37adb

**Problème** : Après FEAT-12, deux refus ne donnent pas assez de contexte à un assistant : une case pleine ne donne que son nom, et une référence inconnue ne dit pas quel identifiant manque.

**Fichiers** : `src/lib/server/features/storage/service.ts`, `src/lib/server/db-errors.ts`, `src/lib/server/features/mcp/`, `docs/API.md`, `docs/openapi.json`

**À faire**

- Décision « MCP le plus complet possible (FEAT-12) » : `case_full` (`CaseFullError`) ajoute l’identifiant de la case à ses `details`, à côté du nom, de la capacité et des bouteilles ; un ajout à la réponse 409 de l’API, sans rien retirer.
- `missing_reference` (`refusedWriteError` de `src/lib/server/db-errors.ts`) dit quelle référence manque (le champ, par exemple `formatId` ou `originId`, et la valeur donnée) quand on peut le savoir, dans le message et les `details` ; sinon il garde le message d’aujourd’hui.
- API.md, OpenAPI et les descriptions du MCP suivent.
- Fait le 2026-11-02 (ff00d9a5..73d37adb, statut b90f803b, CI 41473379597) : `case_full` donne `caseId` ; `MissingReferenceError` et `namingMissingReferences` (`src/lib/server/db-errors.ts`) : après le refus de la clé étrangère, les six écritures des vins, des bouteilles et des souhaits trouvent, d’après les clés étrangères du schéma, quel identifiant ne mène à rien, et le nomment dans le message et les `details` ; le MCP renomme `definitionId` en `wineId` et `storageCaseId` en `caseId`. Parcours JSON-RPC réel : 10 sur 10. Une revue.
- Trouvé pendant FEAT-13 : `case_holds_bottles` (`CaseHoldsBottlesError` de `src/lib/server/features/storage/service.ts`) ne donne pas `caseId`, contrairement à `case_full` ; `missing_reference` ne nomme toujours pas le champ pour les photos d’un vin (`src/lib/server/features/images/repository.ts`, `src/routes/api/definitions/[id]/photos/`, `src/routes/api/definitions/[id]/main-photo/`) ni pour le pays d’une région et la région d’une appellation dans l’admin (`src/lib/server/features/shared/lookup-crud.ts`, `src/lib/server/features/geography/service.ts`) ; une bouteille dont la case enregistrée n’existe plus (base modifiée à la main seulement) voit chaque modification refusée (`changesFor` de `src/lib/server/features/bottles/service.ts`).

**Critère d’acceptation** : Un `add_bottles` avec un `formatId` faux est refusé en nommant `formatId` ; un déplacement vers une case pleine donne l’identifiant de la case ; testé, dans l’API et par le MCP.

**Sources** : Trouvé pendant FEAT-12

### REL-10 · Publication de la 1.4.0

Sévérité **évolution** · effort **S** · dépend de FEAT-10, FEAT-03, FEAT-11, FEAT-04, FEAT-12, FEAT-13 · statut **Fait**

**Suivi** (2026-11-02) : 58fa59cd, v1.4.0

**Problème** : La 1.4.0 apporte aux utilisateurs ce que sa phase a livré.

**Fichiers** : `releases.json`, `CHANGELOG.md`, `UPGRADING.md`

**À faire**

- Résumé 1.4.0 complété à chaque tâche ; banc depuis la version précédente ; release selon RELEASING.md, avec le mainteneur.
- Fait le 2026-11-02 : le banc apprend les champs ajoutés par la 1.4.0 (`hex`, `colorHex`, et `definition.color` de `/api/bottles/non-consumed`) ; bancs de la 1.3.2 et de la 1.0.0 vers la 1.4.0, 176 sur 176 chacun ; CI 41474340796 verte sur 58fa59cd ; `main` avancée, tag v1.4.0, release 41474951685 verte ; image publique sans connexion (`1.4.0`, `1.4`, `latest`, amd64 et arm64). develop passe à 1.5.0-rc.0 (65f2952e). Sortie sans DEP-10, à la demande du mainteneur.

**Critère d’acceptation** : v1.4.0 est publiée sur `main` et son image se télécharge sans connexion ; develop passe à la rc suivante.

**Sources** : Décision « Versions après la 1.0 »

## P16b · Survol des boutons (1.4.1)

Pour la 1.4.1, avant P17 (décision « Version corrective 1.4.1 ») : UI-33 ; puis REL-16. Publiée en 1.4.1 le 2026-11-02.

### UI-33 · Un survol lisible et prévisible sur tous les boutons

Sévérité **mineur** · effort **M** · dépend de REL-10 · statut **Fait**

**Suivi** (2026-11-02) : f5432028..5623eda6

**Problème** : Sur une carte de vin, le survol du nombre de bouteilles change si peu sa teinte qu’on ne voit pas que le bouton réagit, surtout en thème sombre, alors que les boutons voisins (ajouter, liste d’envies, modifier, dupliquer) se voient. D’autres boutons de l’application ont sans doute le même défaut.

**Fichiers** : `src/lib/components/ui/button/`, `src/app.css`, `src/lib/components/`

**À faire**

- Corriger au moins le bouton du nombre de bouteilles des cartes (`WineCard.svelte`), en clair et en sombre.
- Relever le survol, le focus clavier, l’état appuyé et l’état désactivé de chaque sorte de bouton de l’application (variantes shadcn et boutons faits main), en clair et en sombre, avec le contraste mesuré entre l’état normal et le survol ; proposer au mainteneur une règle par sorte de bouton, sur captures, avant de l’appliquer partout.
- Appliquer la règle choisie par les variantes et les jetons partagés plutôt que bouton par bouton ; ce que la règle ne couvre pas est listé.
- Ajouté par le mainteneur le 2026-11-02 : sur la page Stockage, les noms des conteneurs A à E ont une couleur fixe (`CONTAINER_COLORS` de `src/lib/components/storage/storage.ts`) et les suivants presque aucune en thème sombre ; tous prennent la même pastille neutre, lisible en clair et en sombre, puisque depuis FEAT-03 la couleur de cette page est celle du vin.
- Fait le 2026-11-02 (f5432028..5623eda6, statut a3ce136f, CI 41510767315) : jetons `--primary-hover`, `--secondary-hover`, `--destructive-hover` et `--input-hover` dans `src/app.css`, avec des valeurs par schéma dans `theme-colors.ts` (vert clair mêlé vers le blanc ; jaune, vert, ardoise et orange sombres plus marqués, pour qu’aucun survol principal ne faiblisse) ; `ui/button`, `ui/select/select-trigger` et `ui/dialog/dialog-content` modifiés avec un commentaire ; nouveau `src/lib/components/layout/button-states.ts` (anneau, désactivé, bouton discret, choix retenu, bouton à icône) pour les boutons faits main ; un choix retenu (pastille, case mise en avant) passe de 10 % à 30 % de la teinte au survol ; `ContainerBadge.svelte` neutre remplace `CONTAINER_COLORS`. Mesures avant → après : nombre de bouteilles et boutons secondaires 1,01-1,02 → 1,40-1,46 ; principal 1,12-1,22 → 1,23-1,32 (schémas jaune, vert, ardoise, orange 1,11-1,27 → 1,27-1,38) ; suppression 1,00-1,08 → 1,21-1,26 ; boutons discrets 1,00-1,13 → 1,22-1,32 ; focus 1,0-2,4 → 4,5-6,2. Tests : `theme-colors.test.ts` (chaque schéma, clair et sombre) et `button-states.test.ts`, qui échouent sur develop. Trois revues.
- Trouvé pendant UI-33 : un bouton désactivé d’une carte ou d’une ligne de vin laisse passer le pointeur vers le lien de la carte (`disabled:pointer-events-none` de `ui/button/button.svelte` ; `wine-list.ts`, `WineCard.svelte`, `WineTable.svelte`, `WishButton.svelte`) ; le choix Tableau / Grille du stockage n’est pas un groupe radio comme `ChoiceButtons.svelte` (`src/routes/storage/+page.svelte`) ; les cases à cocher n’ont pas de survol (`ui/checkbox/checkbox.svelte`) ; champs, cases à cocher et badges gardent l’anneau à moitié (`ring-ring/50`, 2,1-2,4:1 : `ui/input`, `ui/textarea`, `ui/checkbox`, `ui/badge`) ; l’anneau du jaune clair reste à 2,7:1 et celui de l’orange clair à 3,4:1 (`ring` de `theme-colors.ts`) ; les icônes couleur du thème sur un choix retenu sont sous 3:1 (coche des pastilles de `src/routes/preferences/+page.svelte`, icône d’action de `BulkBarcodeDialog.svelte`) ; la barre d’onglets de l’application installée (`TabBar.svelte`) n’a pas été relevée ; en sombre, le fond du bouton d’effacement de la recherche se distingue à peine du champ (`SearchField.svelte`, l’icône porte le survol) ; le bord des pastilles de conteneur fait 2,87-2,98:1 sur l’en-tête clair du tableau (`ContainerBadge.svelte`, `StorageTable.svelte`) ; la section courante du menu ne change pas au survol (`NavSectionMenu.svelte`, accepté) ; les vignettes de `ImagePicker.svelte` gardent un anneau de 2 px au survol.

**Critère d’acceptation** : Chaque bouton montre un survol et un focus visibles en clair et en sombre, selon la règle choisie par le mainteneur ; captures avant et après ; mesures ; testé.

**Sources** : Décision « Version corrective 1.4.1 »

### REL-16 · Publication de la 1.4.1

Sévérité **évolution** · effort **S** · dépend de UI-33 · statut **Fait**

**Suivi** (2026-11-02) : 499ff1fc, tag v1.4.1

**Problème** : La 1.4.1 apporte le survol corrigé sans attendre la 1.5.0.

**Fichiers** : `releases.json`, `CHANGELOG.md`, `UPGRADING.md`, `package.json`

**À faire**

- Résumé 1.4.1 ; bancs depuis la 1.4.0 et la 1.0.0 ; release selon RELEASING.md ; puis develop repasse à 1.5.0-rc.0 avec l’entrée 1.5.0 de `releases.json`.
- Fait le 2026-11-02 : bancs de la 1.4.0 et de la 1.0.0 vers la 1.4.1, 176 sur 176 chacun, sans changer le banc ; CI 41511510998 verte sur 499ff1fc ; `main` avancée, tag v1.4.1, release 41512097830 verte ; image publique sans connexion (`1.4.1`, `1.4`, `latest`, amd64 et arm64). develop repasse à 1.5.0-rc.0 (dd6d437c) avec l’entrée 1.5.0 gardée.

**Critère d’acceptation** : v1.4.1 est publiée sur `main` et son image se télécharge sans connexion ; develop repasse à 1.5.0-rc.0.

**Sources** : Décision « Version corrective 1.4.1 »

## P17 · À boire et dégustation (1.5.0)

Pour la 1.5.0 : la vie d’une bouteille jusqu’à ce qu’on la boive. Les deux tâches ajoutent leur repère et leur fiche à la liste d’une case du plan (FEAT-04). Ordre : FEAT-05 et FEAT-06 ; DEP-10 (reportée de la 1.4.0) ; puis REL-11.

### FEAT-05 · À boire : les bouteilles à boire bientôt

Sévérité **évolution** · effort **L** · dépend de REL-10 · statut **À faire**

**Problème** : Seule l’année optimale, souvent inconnue, dit quand boire une bouteille ; rien ne la met en avant, et une bouteille peut passer son heure sans qu’on s’en rende compte.

**Fichiers** : `src/lib/server/db/schema.ts`, `drizzle/`, `src/lib/server/features/bottles/`, `src/routes/+page.svelte`, `src/routes/wines/`, `src/lib/components/bottles/`, `src/lib/components/storage/`, `src/routes/preferences/`, `src/lib/i18n/locales/`, `docs/API.md`

**À faire**

- Décision « À boire (FEAT-05) » : champ « À boire avant » (migration), boutons en un clic, sélection multiple ; ordre et date dépassée ; API, exports et imports suivent.
- Bandeau de l’accueil qui déplie la liste ; captures sur téléphone et ordinateur montrées au mainteneur, qui n’est pas encore convaincu par la forme, avant le merge.
- Repère sur la page Stockage et dans la liste d’une case (FEAT-04), horizon et interrupteur réglés dans les préférences.

**Critère d’acceptation** : Des bouteilles marquées « ce mois-ci », une date dépassée et une année optimale atteinte apparaissent dans le bon ordre dans le bandeau et sur le stockage quand l’interrupteur est allumé ; une bouteille bue disparaît de la liste et garde sa date ; le mainteneur a validé les captures ; testé.

**Sources** : Décision « À boire (FEAT-05) »

### FEAT-06 · Fiche de dégustation

Sévérité **évolution** · effort **M** · dépend de REL-10 · statut **À faire**

**Problème** : Marquer une bouteille bue ne garde que sa date : rien sur l’occasion, le plat ou ce qu’on en a pensé, alors que c’est ce qu’on veut relire avant d’en racheter, et ce qu’un assistant pourrait utiliser par le MCP.

**Fichiers** : `src/lib/server/db/schema.ts`, `drizzle/`, `src/lib/server/features/bottles/`, `src/lib/components/bottles/`, `src/routes/wines/[id]/`, `src/routes/cellar-history/`, `src/lib/server/features/mcp/`, `docs/API.md`

**À faire**

- Décision « Fiche de dégustation (FEAT-06) » : table des dégustations (migration), une par bouteille ; fiche dans le dialogue « bue », « Plus tard » et signal dans l’historique ; liste et moyenne sur la page du vin ; API, sauvegardes, exports et imports suivent.
- La fiche dans la liste d’une case (FEAT-04) ; les dégustations lisibles par les outils de lecture du MCP (API-10).
- Mise en avant sans contrainte : la fiche s’ouvre déjà dépliée, aucun champ n’est obligatoire.

**Critère d’acceptation** : Une bouteille bue avec sa fiche montre la note, l’occasion, le plat et la note libre sur la page du vin, et la moyenne à côté de la note du vin ; une fiche laissée pour plus tard se complète depuis l’historique ; un client MCP lit les dégustations ; testé.

**Sources** : Décision « Fiche de dégustation (FEAT-06) »

### DEP-10 · Revue des dépendances d’après la 1.4.0

Sévérité **mineur** · effort **S** · dépend de DEP-09 · statut **À faire**

**Problème** : Ce que DEP-09 n’a pas pu prendre, la 1.3.0 étant publiée avant que les correctifs soient éligibles (choix du mainteneur) : node 24.22.2, SvelteKit, adapter-node, Paraglide, minimatch 11 et la suite.

**Fichiers** : `package.json`, `pnpm-lock.yaml`, `.github/workflows/`, `Dockerfile`

**À faire**

- Comme DEP-08 et DEP-09 : correctifs publiés depuis au moins 7 jours, une mise à jour par commit, portes à chaque fois ; l’alerte minimatch revue ; `pnpm audit --prod` vide ou chaque alerte justifiée. Reportée de la 1.4.0 (décision « Dépendances après la 1.4.0 ») : dans la première version publiée après le 2026-11-06, juste avant sa release.

**Critère d’acceptation** : Chaque dépendance, action et image de base est à son dernier correctif publié depuis au moins 7 jours, ou l’écart est justifié.

**Sources** : Trouvé pendant DEP-09

### REL-11 · Publication de la 1.5.0

Sévérité **évolution** · effort **S** · dépend de FEAT-05, FEAT-06, DEP-10 · statut **À faire**

**Problème** : La 1.5.0 apporte aux utilisateurs ce que sa phase a livré.

**Fichiers** : `releases.json`, `CHANGELOG.md`, `UPGRADING.md`

**À faire**

- Résumé 1.5.0 complété à chaque tâche ; banc depuis la version précédente ; release selon RELEASING.md, avec le mainteneur.

**Critère d’acceptation** : v1.5.0 est publiée sur `main` et son image se télécharge sans connexion ; develop passe à la rc suivante.

**Sources** : Décision « Versions après la 1.0 »

## P18 · Producteurs et revue de l’import (1.6.0)

Pour la 1.6.0 : les producteurs d’abord, parce que la revue de l’import doit savoir relier ou créer un producteur. Ordre : FEAT-07 ; FEAT-08 ; puis REL-12.

### FEAT-07 · Producteurs : une liste et une fiche

Sévérité **évolution** · effort **L** · dépend de REL-11 · statut **À faire**

**Problème** : Le producteur n’est qu’un texte sur chaque vin : pas de fiche, des doublons à la casse près, et aucun moyen de voir d’un coup les vins d’un producteur.

**Fichiers** : `src/lib/server/db/schema.ts`, `drizzle/`, `src/lib/server/features/`, `src/routes/`, `src/lib/components/`, `src/lib/server/features/csv-import/`, `src/lib/i18n/locales/`, `docs/API.md`

**À faire**

- Décision « Producteurs (FEAT-07) » : table des producteurs et migration des noms existants (regroupés à la casse, aux accents et aux espaces près), testée sur une base réelle de la version précédente faite de données inventées ; fusion dans Admin › Data.
- Fiche, page Cave › Producteurs, lien depuis la carte et la page du vin, champ avec recherche et création dans le formulaire, import CSV ; API, sauvegardes, exports et imports suivent, sans casser les scripts qui envoient `producer` en texte (sinon action de mise à jour, à faire valider).
- Statistiques par producteur (UI-28) branchées sur la nouvelle table.

**Critère d’acceptation** : Après la mise à jour, chaque vin a son producteur, les variantes de casse sont fusionnées et les autres doublons se fusionnent dans l’admin ; la fiche montre ses vins, ses bouteilles en cave et bues, et la moyenne des dégustations ; testé, migration comprise.

**Sources** : Décision « Producteurs (FEAT-07) »

### FEAT-08 · Revue de l’import CSV avant d’écrire

Sévérité **évolution** · effort **L** · dépend de FEAT-07 · statut **À faire**

**Problème** : Une ligne que l’import ne sait pas placer (plusieurs vins possibles, valeur inconnue ou invalide) est refusée pour de bon : il faut corriger le fichier et recommencer.

**Fichiers** : `src/lib/server/features/csv-import/`, `src/routes/api/admin/`, `src/lib/components/admin/dialogs/CsvImportDialog.svelte`, `src/lib/i18n/locales/`, `docs/API.md`

**À faire**

- Décision « Revue de l’import CSV (FEAT-08) » : écran de revue en trois parties, chaque cas réglable à la main, puis un import en une transaction ; suggestions des imports précédents signalées ; téléchargement des lignes ignorées.
- Les producteurs (FEAT-07) se relient ou se créent comme les autres valeurs ; l’import d’un export JSON ne change pas.
- Le compte rendu garde l’API de vérification (`dryRun`) utilisable par les scripts ; tout changement de réponse est documenté.

**Critère d’acceptation** : Un fichier avec une bouteille qui correspond à deux vins, une appellation inconnue et un millésime invalide s’importe entièrement après trois choix à l’écran, sans retoucher le fichier ; une suggestion d’un import précédent est signalée comme telle ; les lignes ignorées se téléchargent ; testé, e2e compris.

**Sources** : Décision « Revue de l’import CSV (FEAT-08) », Décision « Après la 1.0 : compte rendu de l’import »

### REL-12 · Publication de la 1.6.0

Sévérité **évolution** · effort **S** · dépend de FEAT-07, FEAT-08 · statut **À faire**

**Problème** : La 1.6.0 apporte aux utilisateurs ce que sa phase a livré.

**Fichiers** : `releases.json`, `CHANGELOG.md`, `UPGRADING.md`

**À faire**

- Résumé 1.6.0 complété à chaque tâche ; banc depuis la version précédente ; release selon RELEASING.md, avec le mainteneur.

**Critère d’acceptation** : v1.6.0 est publiée sur `main` et son image se télécharge sans connexion ; develop passe à la rc suivante.

**Sources** : Décision « Versions après la 1.0 »

## P19 · Notifications (1.7.0)

Pour la 1.7.0 : les notifications, qui utilisent « À boire » (FEAT-05), le statut hors cave et la vérification des mises à jour. Ordre : FEAT-09 ; puis REL-13.

### FEAT-09 · Notifications par ntfy ou webhook

Sévérité **évolution** · effort **L** · dépend de REL-12 · statut **À faire**

**Problème** : Une sauvegarde automatique ratée ne se voit que dans les journaux du conteneur ; rien ne rappelle les bouteilles à boire, les vins à racheter ou les bouteilles restées hors cave, ni qu’une nouvelle version existe.

**Fichiers** : `src/lib/server/`, `src/routes/admin/`, `src/routes/api/admin/`, `src/lib/components/admin/`, `src/lib/i18n/locales/`, `README-Docker.md`, `docs/API.md`

**À faire**

- Décision « Notifications (FEAT-09) » : onglet Admin › Notifications, ntfy et webhook, test, jeton jamais réaffiché, langue ; chaque événement activable ; récapitulatifs planifiés comme les sauvegardes automatiques.
- Vérification quotidienne des versions publiées sur GitHub, affichée dans l’admin et sur l’engrenage (UI-28) ; README-Docker dit comment la couper, pour un serveur sans accès à Internet.
- Les adresses et jetons ne sortent jamais dans les journaux ; un échec d’envoi est journalisé sans bloquer l’app.

**Critère d’acceptation** : Un serveur ntfy de test et un webhook de test reçoivent chacun des événements activés, dans la langue choisie, et rien des événements coupés ; une sauvegarde ratée envoie son message ; la mise à jour disponible s’affiche dans l’admin ; testé.

**Sources** : Décision « Notifications (FEAT-09) »

### REL-13 · Publication de la 1.7.0

Sévérité **évolution** · effort **S** · dépend de FEAT-09 · statut **À faire**

**Problème** : La 1.7.0 apporte aux utilisateurs ce que sa phase a livré.

**Fichiers** : `releases.json`, `CHANGELOG.md`, `UPGRADING.md`

**À faire**

- Résumé 1.7.0 complété à chaque tâche ; banc depuis la version précédente ; release selon RELEASING.md, avec le mainteneur.

**Critère d’acceptation** : v1.7.0 est publiée sur `main` et son image se télécharge sans connexion ; develop passe à la rc suivante.

**Sources** : Décision « Versions après la 1.0 »
