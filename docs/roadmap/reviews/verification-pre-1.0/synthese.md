# Vérification d’avant 1.0 : synthèse

Commit revu : `cf48032d` (`chore(release): 1.0.0-rc.1`, develop, 2026-10-29), le code de la fin de P11. Revue en lecture seule (QA-06, P12) : rien n’a été corrigé, mergé, poussé ni tagué. Commit de référence de l’audit : `9df0d08c` (2026-10-16).

Dans ce fichier, `$S` = `/private/tmp/claude-501/-Users-lulu-NAS-Lulu-Lulu-Workspace-Git-Projects-cellar/4833445d-eb41-45bc-9468-f0d0ae313214/scratchpad`. Les preuves brutes sont sous `$S/p12/<agent>/`.

## Méthode

- Les sept axes de l’audit d’avant 1.0, avec ses fichiers d’axe et sa présentation. Un auditeur par axe, chacun dans sa worktree jetable sur `cf48032d`, sur ses ports (45N0-45N4 pour l’axe N) et avec ses propres données inventées.
- **Passe 1** : chaque ligne de traçabilité de l’audit, chaque constat de l’audit (a1 à a7, Majeurs et Mineurs) et ses « Points restés ouverts », et, pour chaque tâche de P7 à P11, son critère d’acceptation et ses points « Trouvé pendant » et « Reste », reçoivent un verdict : fait, fait autrement (avec la décision qui le permet), partiel, pas fait, régressé, ou sans objet (seulement quand l’audit disait déjà « Sans objet »). Chaque verdict a sa preuve dans le code de `cf48032d` ou dans un essai. Les « Décisions prises » font foi : ce qu’une décision accepte n’est pas un constat.
- **Passe 2** : nouveaux constats sur l’axe, d’abord dans ce que P7 à P11 ont changé, avec une reproduction sur l’app compilée ou dans le code. Chaque constat dit s’il est une régression, avec la tâche et le commit.
- **Interface** (axes 4, 5, 6) : Chromium headless de Playwright, clair et sombre, 1280 et 390 px, anglais et français ; axe-core 4.14.0, installé dans le dossier de travail seulement (`--config.minimum-release-age=10080`), comme preuve.
- **Axe 7** : image Docker construite et lancée sous des noms `cellarreview-*`, puis supprimée. Le banc de mise à jour n’a pas été rejoué par la revue : il est cité tel que « main » l’a passé pour 1.0.0-rc.1.
- **Vérification** : un vérificateur par axe, qui n’a pas écrit le rapport, a tenté de réfuter chaque verdict et chaque constat. Il a rejoué les preuves sur sa propre instance (ports 45N5-45N9), puis écrit le fichier d’axe final en appliquant ses corrections. Il a aussi signalé les désaccords que les preuves ne tranchent pas.
- **Synthèse** : l’agent principal a fusionné les doublons entre axes, vérifié lui-même les renvois restés sans propriétaire, puis écrit ce fichier.

| Axe | Fichier | Auditeur | Vérificateur |
|---|---|---|---|
| 1 Données et scripts | `axe-1-donnees.md` | `$S/p12/a1/` : base de `9df0d08c` migrée et comparée à une base neuve, migration cassée, `db:generate` | `$S/p12/v1/` : mêmes essais, sur ses propres données |
| 2 API publique, auth, sécurité | `axe-2-api-securite.md` | `$S/p12/a2/` : matrice 401/403/429 sur toutes les routes, http et https | `$S/p12/v2/` : son propre inventaire de 103 couples, encadrement, traversées |
| 3 API d’administration | `axe-3-api-admin.md` | `$S/p12/a3/` : cycle sauvegarde, effacement, restauration ; zips piégés ; 500 Mo ; mémoire | `$S/p12/v3/` : mêmes essais, mémoire sur serveurs neufs |
| 4 Front d’administration | `axe-4-front-admin.md` | `$S/p12/a4/` : 128 pages et 168 dialogues dans 8 combinaisons, 16 thèmes | `$S/p12/v4/` : BUG-21 à la souris, au toucher et au clavier, dialogues au téléphone |
| 5 Interface principale | `axe-5-interface.md` | `$S/p12/a5/` : pages, dialogues et thèmes, BUG-14 en en-US | `$S/p12/v5/` : 148 analyses axe, 1 632 mesures de contraste |
| 6 Pages et codes-barres | `axe-6-pages.md` | `$S/p12/a6/` : 2 180 étiquettes décodées, scanner à caméra factice | `$S/p12/v6/` : 474 étiquettes, Avery 5160, tris, mise à jour d’une base 0.7.0 |
| 7 Infra, CI, Docker, releases, docs | `axe-7-infra.md` | `$S/p12/a7/` : image construite et lancée, `pnpm audit`, notes de version | `$S/p12/v7/` : mêmes essais, retour arrière refusé |

## Portes

Lancées une fois par l’agent principal dans une worktree jetable sur `cf48032d` (`$S/p12/gates/summary.txt`, un journal par porte dans le même dossier). Toutes vertes :

| Porte | Résultat | À l’audit (`9df0d08c`) |
|---|---|---|
| `pnpm check` | 0 erreur | 0 |
| `pnpm lint` | 0 erreur, 0 avertissement | 0 erreur, 104 avertissements |
| `pnpm test` | 1 456 tests sur 158 fichiers | 976 sur 110 |
| `pnpm i18n:check` | tous les compteurs à 0 | 0 texte en dur |
| `pnpm knip` | rien | rien |
| `pnpm build` | ok | ok |
| `pnpm test:e2e` | 4 parcours sur 4 | (n’existait pas) |

Chromium de Playwright, absent du cache, a été téléchargé une fois par `pnpm exec playwright install chromium`, comme AGENTS.md le prévoit. Le CI de develop sur `cf48032d` (run 40961826369) et le workflow Release de v1.0.0-rc.1 (run 40962610649) sont verts (`$S/p12/v7/75-ci-runs.txt`).

Banc de mise à jour de « main » (`$S/p11/bench-1.0.0-rc.1/`) : 0.1.0 → 1.0.0-rc.1 et 0.12.0 → 1.0.0-rc.1, 176 vérifications passées et 0 échec chacun, 13 actions au journal et au bandeau (cité et contrôlé par l’axe 7).

## Résultats en chiffres

Verdicts finaux, après vérification :

| Axe | Lignes | Fait | Fait autrement | Partiel | Pas fait | Régressé | Sans objet | Constats |
|---|---|---|---|---|---|---|---|---|
| 1 | 97 | 87 | 5 | 0 | 4 | 0 | 1 | 1 Mineur |
| 2 | 149 | 137 | 7 | 0 | 4 | 0 | 1 | 1 Mineur |
| 3 | 166 | 141 | 4 | 0 | 18 | 1 | 2 | 2 Mineurs |
| 4 | 106 | 85 | 4 | 0 | 14 | 1 | 2 | 7 Mineurs |
| 5 | 258 | 217 | 8 | 3 | 24 | 0 | 6 | 7 Mineurs |
| 6 | 162 | 131 | 10 | 0 | 18 | 0 | 3 | 3 Mineurs |
| 7 | 162 | 132 | 11 | 3 | 15 | 0 | 1 | 2 Mineurs |
| **Total** | **1 100** | **930** | **49** | **6** | **97** | **2** | **16** | **23 Mineurs, 22 après fusion, plus 1 de la synthèse** |

Par origine :

- **Traçabilité de l’audit, 738 lignes** : 691 fait, 28 fait autrement, 1 partiel (UI-10, à cause de V5-m1), 0 pas fait, 2 régressé (API-04 sur la taille du code, UI-07/Trouvé-7 = V4-m6), 16 sans objet. Les 24 « Partiel » et 85 « Non fait » de l’audit sont faits, ou faits autrement par une décision, sauf UI-10.
- **Constats de l’audit, 111 (7 Majeurs, 104 Mineurs)** : 109 fait, 1 fait autrement (a6 m19), 1 partiel (a5 m22 : le HTML de `/wines` pèse encore 1,1 Mo, sans compression). Les 7 Majeurs et les bloquants B1 à B8 de la synthèse de l’audit sont faits et rejoués.
- **Critères des 31 tâches de P7 à P11** : 29 fait, 2 fait autrement (UI-13 : la saisie groupée garde son sélecteur, décision « Dialogue de statut partagé (UI-13) » ; BUG-21 : clos comme « pas un défaut » par une note datée de la tâche, voir les désaccords).
- **« Trouvé pendant » et « Reste » de ces tâches** : la plupart des 97 « pas fait » sont là. Ce sont des points que la feuille de route liste déjà comme hors périmètre, sans tâche ni décision. Le vérificateur les a classés « pas fait » et non « fait autrement » quand aucune décision ne les accepte.
- **« Ce qui doit changer à la 1.0.0 » (axe 7)** : 4 fait, 1 fait autrement, 1 partiel (RELEASING.md), 2 pas fait (dépôt et image publics, protection de `main`), prévus au tag par les décisions « Visibilité (REL-01) », « Protection des branches (QA-04) » et « Avant la 1.0 (P11, P12) ».

Prouvé en direct, en plus des critères :
- **Sécurité** (axe 2, rejoué par le vérificateur sur son propre inventaire de 103 couples route × méthode, qui est aussi celui de `docs/API.md`) :
  - sans session, les 65 écritures de l’API, les 4 form actions de `/wines` et tout `/api/admin/**` répondent 401 ;
  - avec `Origin` étrangère ou `null`, les 69 écritures répondent 403 ;
  - le 6e mauvais code répond 429 ;
  - le cookie est `HttpOnly; Secure; SameSite=Lax` derrière https ;
  - aucune traversée de chemin sur 30 variantes, aucune valeur de la base dans un `{@html}`.
- **Données** (axe 1) :
  - une base de `9df0d08c` mise à jour a le même schéma qu’une base neuve : 17 tables, 42 index, 13 clés étrangères, 2 CHECK, 16 migrations ;
  - une migration cassée arrête le démarrage sans rien appliquer ;
  - `pnpm db:generate` n’ajoute rien.
- **Sauvegardes** (axe 3) :
  - le cycle sauvegarde → effacement → restauration rend tout, images aux mêmes empreintes, et garde les réglages de l’instance ;
  - 37 zips piégés sont refusés, base intacte ;
  - une sauvegarde de 572 Mio se restaure par son nom en 1,9 s, pour +47 Mio de mémoire.
- **Étiquettes** (axe 6) : 2 180 puis 474 étiquettes décodées en page 1 ; Avery 5160 donne 3 × 10 étiquettes sur les découpes.
- **Image** (axe 7) :
  - `healthy` en 5 s, uid 1000, 337 Mo (0.10.0 : 406 Mo) ;
  - ni devDependencies, ni kysely, ni `@types` ;
  - `ORIGIN` appliqué ;
  - 0.12.0 refuse une base ouverte par 1.0.0-rc.1, sans la modifier.
- **Interface** (axes 4, 5, 6) :
  - aucune violation sérieuse d’axe-core hors des trois constats V4-m2, V4-m3 et V5-m1 ;
  - aucun défilement horizontal de page à 390 px, sauf avec un ancien préfixe de plus de 6 caractères ;
  - aucun texte en couleur du thème sous 4,5:1 sur 1 632 mesures dans les 16 thèmes.

## Régressions

Quatre constats, plus deux lignes de passe 1. Toutes sont Mineures.

| Id | Axe | Ce qui a régressé | Depuis |
|---|---|---|---|
| V4-m6 | 4 (et 3) | L’échec du téléchargement de la sauvegarde de sécurité ne se voit plus (UI-07/Trouvé-7, corrigé à l’audit). C’est aussi la ligne « pas fait » de DATA-12 à l’axe 3. | a700cc93, DATA-12 |
| V4-m7 | 4 | Tab au clavier sur le délimiteur des dialogues CSV le passe à « Tab » | 4614db09, UI-18 |
| V5-m5 = V6-m3 | 5, 6 | « Mise à jour... » à trois points ASCII, écrits dans le composant : régression sur le hors cave seulement (« Mise à jour… » par `out_of_cellar.updating` à `9df0d08c`) ; ailleurs, le motif existait déjà | ba910245, UI-13 |
| V3-m2 | 3 | `docs/API.md:1901` dit que la restauration laisse les autres images, alors qu’elle les supprime depuis DATA-12. `:1918-1919` sur les compteurs n’a jamais été juste. | 857acda9, DATA-12 |
| API-04 (ligne) | 3 | Critère « import CSV en moins de 700 lignes » : 914 lignes. Le comportement tient : 2 200 lignes en 318 ms. | 1a7204ed, BUG-15, puis BUG-18, API-08 et UI-12 |
| UI-07/Trouvé-7 (ligne) | 4 | = V4-m6 | |

## Constats

Aucun Critique, aucun Majeur. Les recommandations sont les miennes ; le mainteneur juge chaque ligne.

Critères de recommandation :
- **avant 1.0** : une régression visible, un trou de sécurité, une perte de données même rare, un contrat d’API ou une documentation publique faux au moment où la 1.0 les fige et rend le dépôt public, une violation critique ou sérieuse d’accessibilité, ou une fonction inutilisable ; et seulement si la correction est petite.
- **acceptable** : le reste, à reprendre après la 1.0 si le mainteneur le veut.

| Id | Sév. | Axe | Constat | Preuve | Recommandation | Raison |
|---|---|---|---|---|---|---|
| V4-m6 | Mineur, régression | 4 | Après une restauration, un import JSON ou un effacement, un téléchargement raté de la sauvegarde de sécurité laisse le seul toast de succès | `$S/p12/v4/restore-fail.log` | avant 1.0 | Filet de sécurité corrigé à l’audit puis perdu ; un contrôle de la réponse avant le lien `<a download>` suffit. À faire avec le « Download » de la liste (voir les points connus). Atténuation : le toast dit que le fichier reste dans la liste. |
| V4-m7 | Mineur, régression | 4 | Tab sur le délimiteur d’« Export to CSV Files » ou de « CSV Import » le passe à « Tab » : export en tabulations, import qui rejette chaque ligne | `$S/p12/v4/tab-delimiter.log` | avant 1.0 | Régression d’UI-18 sur un parcours au clavier, qui produit des fichiers faux sans le dire ; correction dans `OptionSelect` (recherche par lettre seulement à l’ouverture). |
| V5-m5 / V6-m3 | Mineur, régression en partie | 5, 6 | « Mise à jour... » écrit dans `ConfirmButtons` et `BulkBarcodeDialog` ; `abbreviate` des statistiques coupe par « ... » sans infobulle (« Austra... ») | `$S/p12/v6/updating.log`, `$S/p12/v5/extras/v5m5-updating-text.png` | avant 1.0 | Quelques lignes. Le hors cave a perdu « … » avec UI-13, contre la typographie que fixe AGENTS.md ; `i18n:check` ne le voit pas. |
| V3-m2 | Mineur, régression en partie | 3 | `docs/API.md`, restauration : deux phrases contredisent le code (images non citées supprimées ; compteurs au plus grand des deux) | `$S/p12/v3/cycle.log` | avant 1.0 | Documentation publique de l’API que la 1.0 fige ; deux phrases. |
| V2-m1 | Mineur | 2 | Aucun `X-Frame-Options` ni `frame-ancestors` : une page d’une autre app du même NAS (même hôte, autre port) peut encadrer l’admin connecté et détourner des clics (« Wipe All Data ») | `$S/p12/v2/frame.log`, `$S/p12/v2/frame-localhost.png` | avant 1.0 | Sécurité, une ligne dans `handle` ; le dépôt devient public. Mineur, car il faut une page piégée sur le même site et plusieurs clics, et le wipe écrit d’abord une sauvegarde. |
| V1-m1 | Mineur | 1 | Les 5 000 caractères sont comptés en points de code par zod et en unités UTF-16 ailleurs : l’API accepte une note d’emoji que son propre PATCH refuse ensuite, et un aller-retour CSV la coupe sans le dire (jusqu’à la moitié) | `$S/p12/v1/probe.log` | avant 1.0 | Contrat d’API figé à la 1.0, perte silencieuse de texte ; une seule mesure dans `longText` (un `refine` sur `.length`). La décision « Longueur des textes (DATA-10) » ne couvre que les textes coupés par la mise à jour. |
| V5-m1 | Mineur | 5 | Le champ nombre du filtre « Nb bouteilles » n’a pas de nom accessible (axe `label`, critique) | `$S/p12/v5/flows/flows.log` | avant 1.0 | Seule violation critique d’axe de l’app ; laisse UI-10 en « partiel » ; un `aria-label`. |
| V4-m2 | Mineur | 4 | Guide de l’import CSV : exemples de noms de fichiers entre 3,58 et 4,42:1 dans les 16 modes (axe, sérieux) | `$S/p12/v4/themes.log` | avant 1.0 | Violation sérieuse, alors que le critère d’UI-17 vise l’admin sans violation sérieuse ; une classe. |
| V4-m3 | Mineur | 4 | Liste défilante du guide de l’import CSV inatteignable au clavier (axe `scrollable-region-focusable`, sérieux) | `$S/p12/v4/dialogs.json` | avant 1.0 | Même raison ; un `tabindex="0"`. |
| V5-m2 | Mineur | 5 | À 390 et 768 px, « Changer emplacement » et « Changer la disponibilité » du détail des bouteilles sont hors du dialogue, dans une zone qui défile en largeur, sans indice | `$S/p12/v5/flows/details-actions-fr-390.png` | avant 1.0 | Action principale de la liste des vins, cachée au téléphone ; mise en page à revoir sur une ligne. |
| V4-m1 | Mineur | 4 | À 375 × 667, « Export to CSV Files », « Import Images from ZIP » et les réglages de sauvegarde en mode cron dépassent l’écran : titre et bouton d’action hors d’atteinte | `$S/p12/v4/dialogs.json` | avant 1.0 | Action impossible au téléphone ; la même classe que `CsvImportDialog` (`max-h` et défilement). |
| V4-m5 | Mineur | 4 | README-Docker envoie vers « Backup & Restore » de la page admin, qui s’ouvre sur Settings (onglet Backups non nommé) | `$S/p12/v4/curl-checks.log` | avant 1.0 | Documentation publique fausse ; trois phrases. |
| V7-m1 | Mineur | 7 | `pnpm audit --prod` sort en 1 : une alerte critique et une haute sur dompurify 3.4.16, dépendance optionnelle de jsPDF jamais chargée et absente de l’image | `$S/p12/v7/51-audit-prod.txt` | avant 1.0 | Rien d’exploitable, mais un audit rouge sur le dépôt rendu public ; dompurify 3.4.17 est éligible depuis le 2026-10-19. À faire dans la revue des dépendances déjà prévue avant le tag (DEP-06). |
| S-m1 | Mineur | 3 (renvoi de l’axe 2) | `POST /api/admin/upload-image` et l’import d’un zip d’images renvoient le `error.message` brut de Node, chemin absolu du serveur compris (`EACCES … /uploads/wines/…`), alors que `POST /api/upload/image` répond un 500 générique | `$S/p12/v2/leak-4525.log`, `src/lib/server/features/images/service.ts:262-267,344` | acceptable | Session exigée, le chemin est celui du serveur de l’admin lui-même ; déjà à `9df0d08c`. À aligner sur le 500 générique avec V3-m1 après la 1.0. |
| V3-m1 | Mineur | 3 | L’import d’un zip d’images et l’envoi groupé d’images lisent tout le formulaire en mémoire : 2,5 à 4,8 fois la taille, soit 1 à 2 Go pour un zip de 450 Mo | `$S/p12/v3/memory-fresh.log` | acceptable | Rien n’est écrit avant la lecture : au pire, le conteneur redémarre, sans perte. Le passage en flux est un vrai chantier. Une phrase dans README-Docker sur la mémoire d’un gros zip d’images suffirait pour la 1.0. |
| V5-m6 | Mineur | 5 | À 1024 et 1280 px, le nom de chaque vin est coupé sur sa carte (environ 100 px disponibles, 100 titres sur 100 coupés) | `$S/p12/v5/flows/flows.log` | acceptable | Présent avant l’audit, visible chaque jour sans plainte ; la correction est un choix de mise en page. Le nom complet est dans `title` et sur la page du vin. |
| V5-m3 | Mineur | 5 | La recherche et les listes à choix ignorent la casse mais pas les accents (« chateau » ne trouve aucun « Château ») | `$S/p12/v5/flows/flows.log` | acceptable | Amélioration de recherche ; aucune décision ne l’exige. |
| V5-m4 | Mineur | 5 | Titre du détail des bouteilles « Nom - » pour un vin sans producteur | `$S/p12/v5/flows/v5m4-title-no-producer.png` | acceptable | Cosmétique. |
| V5-m7 | Mineur | 5 | « Ce sera la première bouteille pour ce vin » pour un vin qui a déjà des bouteilles sans case | `$S/p12/v5/extras/first-bottle-message.txt` | acceptable | Texte seulement ; rien de faux en base. |
| V4-m4 | Mineur | 4 | La liste « Wines » de l’admin met les vins sans producteur en tête et trie par octets | `$S/p12/v4/wines-order.json` | acceptable | Liste d’administration sans tri réglable ; aucune décision ne la vise. |
| V6-m1 | Mineur | 6 | Camembert des décennies des statistiques : parts en gris presque identiques (contraste 1,00 à 1,02 entre voisines), légende illisible | `$S/p12/v6/decade-contrast.log` | acceptable | Graphique décoratif ; les chiffres restent lisibles ailleurs sur la page. |
| V6-m2 | Mineur | 6 | CSV des codes-barres : la colonne `location` ne donne que le nom de la case, que deux conteneurs peuvent partager | `$S/p12/v6/run1/api.log` | acceptable | Il faut deux cases de même nom dans deux conteneurs, ce que la décision UI-12 rend rare ; l’export des bouteilles a déjà le conteneur. |
| V7-m2 | Mineur | 7 | L’image embarque 286 source maps du serveur (6 Mo, environ 2 %) | `$S/p12/v7/30-image-content.txt` | acceptable | Taille seulement ; utiles pour lire une trace avec `--enable-source-maps`. |
| API-04 (ligne régressée) | métrique | 3 | Import CSV : 914 lignes hors tests, au-delà des 700 du critère d’API-04 | `axe-3-api-admin.md`, ligne API-04 | acceptable | Les ajouts viennent de fonctions demandées après coup (BUG-15, BUG-18, API-08, UI-12), sans défaut de comportement. Écrire une décision qui retire ou relève la limite. |

Fusions entre axes :
- V5-m5 (axe 5) et V6-m3 (axe 6) : un seul constat. L’axe 5 le disait non régressé, l’axe 6 régressé en partie. La preuve de l’axe 6 tranche, pour le hors cave seulement.
- V4-m6 (axe 4) et la ligne « Échec du téléchargement de la sauvegarde de sécurité invisible » de DATA-12 (axe 3) : un seul constat.
- V3-m3 de l’auditeur de l’axe 3 : fondu par son vérificateur dans la ligne API-04.
- Icônes `text-primary` sous 3:1 en jaune et orange clairs : même point connu aux axes 4 et 5 (voir les désaccords).
- `success` et `message` des réponses d’admin : même point connu aux axes 2 et 3.

## Points connus restés ouverts

Ces lignes de passe 1 sont « pas fait » ou « partiel » sans être des constats. La feuille de route les connaît déjà, comme « Trouvé pendant » hors périmètre. La liste complète, avec les preuves, est dans chaque fichier d’axe. Je ne cite ici que ceux qui méritent un jugement. Pour tous les autres (environ 80), ma recommandation est **acceptable** : ils sont informatifs (noms internes, imports sans extension, primitives retouchées), propres au code (duplications, `fetch` bruts, tests manquants) ou cosmétiques.

| Point | Axe | Recommandation | Raison |
|---|---|---|---|
| Dépôt et image publics, README-Docker réécrit ; protection de `main` | 7 | avant 1.0, au tag | Prévu par les décisions « Visibilité (REL-01) », « Protection des branches (QA-04) » et « Avant la 1.0 (P11, P12) ». |
| RELEASING.md garde « in 0.x during the clean-up » et la section « First release: v0.1.0 » (partiel) | 7 | avant 1.0 | Document public de la 1.0 ; l’audit l’appelait déjà historique. |
| Revue des dépendances « à refaire avant le tag 1.0.0 » (partiel : bits-ui 2.20.1, dompurify 3.4.17) | 7 | avant 1.0 | Prévue par DEP-06 ; couvre V7-m1. |
| « Enregistrer » d’un conteneur grisé sans message pour un nom vide (Trouvé pendant UI-12) | 6 | avant 1.0 | Contraire à la décision « Messages d’erreur (P7) » : un bouton n’est grisé que si la raison est visible. |
| Exemple de `label_too_small` faux dans `docs/API.md` : la requête montrée répond 200 (Trouvé pendant BUG-20) | 6 | avant 1.0 | Documentation publique de l’API. |
| `PUT /api/<table>/{id}` compare les noms avec la casse : renommer « Testland » en « FRANCE » crée un second « france » (Trouvé pendant API-08) | 3 | avant 1.0 | La décision « Référentiels (API-03) » dit que le nom est comparé sans la casse ; le contrat se fige à la 1.0. |
| « Download » de la liste des sauvegardes charge le fichier dans le navigateur (Trouvé pendant DATA-12) | 3, 4 | avant 1.0, avec V4-m6 | Même fichier et même helper que V4-m6 ; une sauvegarde de plusieurs centaines de Mo peut faire échouer le navigateur. |
| `success` et `message` dans 9 réponses d’admin ; `GET /api` sans barre en 404 HTML ; message 409 « in the cellar » qui compte les bues (Trouvé pendant API-09) | 2, 3 | acceptable, avec une décision | La 1.0 fige ces réponses : écrire qu’elles en font partie plutôt que les casser après. |
| Icônes `text-primary` sous 3:1 en jaune et orange clairs (Trouvé pendant UI-18 et UI-20) | 4, 5 | acceptable, avec une décision | Icônes à côté d’un texte qui porte le sens ; compléter la décision « Couleurs décoratives et statuts (UI-18) » pour qu’elle dise que leur contraste est accepté. |
| « Retour » après Précédent mène à `/wines` ; `updatedAt` des conteneurs à la seconde | 5, 6 | acceptable, avec une décision | Comportements voulus et documentés, mais sans ligne dans « Décisions prises ». |
| Badge d’un ancien préfixe de plus de 6 caractères : la page codes-barres défile de 443 px en largeur à 390 px (Trouvé pendant BUG-19) | 6 | acceptable | Seuls les préfixes d’avant SEC-05 ; le message dit déjà de changer le préfixe. |
| HTML de `/wines` à 1,1 Mo sans compression (a5 m22, partiel) | 5 | acceptable | Réseau local ; gzip le ramène à 54 Ko derrière un proxy. Le critère d’UI-14 est tenu sur `__data.json`. |
| `--input` sous 3:1 sur `muted` ; Firefox jamais essayé | 5 | acceptable | Décision « Champs en mode sombre (UI-16) » pour la bordure ; Chromium seul en CI. |
| Journal de migrations absent → erreur brute au démarrage (Trouvé pendant DATA-14) | 1 | acceptable | L’image livre toujours `drizzle/`. |

## Désaccords entre auditeur et vérificateur

- **SEC-08 et V7-m1 (axe 7).** Pour l’auditeur, la ligne a régressé : `pnpm audit --prod`, à 0 à l’audit, échoue depuis la publication des avis le 2026-10-22. Pour le vérificateur, elle est faite : le critère ne vise que les paquets utilisés, et dompurify n’est ni chargé ni dans l’image. Le code n’a pas changé. Ils s’accordent sur la correction : dompurify 3.4.17 dans la revue d’avant le tag. Je retiens « fait » et le constat V7-m1.
- **API-04, « moins de 700 lignes » (axe 3).** Pour l’auditeur, c’est une régression et un constat (V3-m3). Pour le vérificateur, c’est un verdict « régressé » sur la métrique seule, sans constat. Je suis le vérificateur et recommande une décision sur la limite.
- **a3 M2, mémoire d’une restauration ou d’un import (axe 3).** Pour l’auditeur, M2 est partiel, car l’import d’un zip d’images garde un facteur 3 à 4. Pour le vérificateur, M2 est fait : M2 et DATA-08 ne visent que la restauration et l’import JSON. La mémoire des images est rapportée dans les deux cas (V3-m1).
- **UI-07/Trouvé-7 = V4-m6 (axe 4).** L’auditeur le rangeait en « déjà connu », comme un choix de DATA-12. Le vérificateur en fait une régression : aucune décision ne l’accepte, et l’entrée DATA-12 le liste comme point ouvert. Je retiens la régression.
- **Icônes `text-primary` sous 3:1 (axes 4 et 5).** Pour l’auditeur, c’est fait autrement, par la décision « Couleurs décoratives et statuts (UI-18) » et la note d’UI-20. Pour le vérificateur, ce n’est pas fait : la décision fixe la couleur, pas le contraste, et rien ne couvre l’orange clair (2,75:1). Il faut une ligne de décision.
- **BUG-21 (axe 4).** Le verdict est « fait autrement » des deux côtés : 36 essais réels, la page ne bouge pas, seul `locator.click()` de Playwright la fait défiler. Mais ce verdict repose sur une note datée de la tâche, pas sur « Décisions prises », et la décision « Avant la 1.0 (P11, P12) » le décrit encore comme un défaut. Une ligne de décision clorait le point.
- **Titre de la page d’erreur de l’admin (axe 4).** `admin/+error.svelte` donne « 404 - Administration - Cave à vin ». La décision « Titres de page (UI-17) » dit que les pages d’erreur gardent « {statut} - Cave à vin ». Il faut dire laquelle des deux règles s’applique dans le layout de l’admin.
- **R2-m5a (axe 2).** `GET /api` (sans barre) répond encore en HTML. L’auditeur et le vérificateur gardent « fait » : la demande visait les réponses sous `/api/`. Une lecture stricte donnerait « partiel ».
- **Critère d’UI-14 (axe 5).** « `/wines` pèse au moins deux fois moins » : c’est tenu sur `__data.json` (2,39 fois moins), choix inscrit dans le « Fait en P9 », mais pas sur le HTML (1,69). Les deux gardent « fait », et le reste va dans a5 m22.
- **Fait autrement sans décision.** Les vérificateurs des axes 2, 3, 4, 5, 6 et 7 ont reclassé en « pas fait » des points que l’auditeur disait « fait autrement » au seul titre d’une note « hors périmètre » ou d’un commentaire du code. C’est la règle du verdict, pas un fait contesté. Pour les garder, il faut une ligne de « Décisions prises » ; ceux qui le méritent sont dans le tableau précédent.

## Constats écartés

- `status.json` garde `audit-T1` à `audit-T16` en « todo » (renvoi de l’axe 1) : voulu. `build.mjs:32-42` déduit leur état de celui des tâches qui les citent, et la page de suivi les montre faites.
- `PORT=` vide fait planter `node server.js` (renvoi de l’axe 1) : c’est le contrôle d’adapter-node sur une variable mal posée ; l’image fixe `PORT=3000`.
- « `label_presets.csv`: 0 added » après un effacement, dans le journal e2e (renvoi de l’axe 4) : l’effacement garde les préréglages (`backup/repository.ts:25-29`), il n’y a donc rien à ajouter.
- Un démarrage refusé (0.12.0 sur une base de 1.0.0-rc.1) laisse un `-wal` vide et un `-shm` (renvoi de l’axe 7) : `cellar.db` reste inchangé. Ce sont les fichiers que SQLite crée à l’ouverture, et le vérificateur les a vus identiques avant et après.
- Noms accentués d’un zip fait par `zip` de macOS sans locale UTF-8, lus en CP437 (axe 3) : dépend de l’outil qui fait le zip.
- `{@html}` dans les dialogues d’import de l’admin (axes 2 et 6) : seuls des messages des fichiers de langue et des constantes y passent, comme à l’audit.
- Restauration d’une sauvegarde d’une version plus récente (renvoi de l’axe 1) : refusée par 409 (axe 3, `$S/p12/v3/traps.log`).

## Nettoyage

- Agents : 7 auditeurs et 7 vérificateurs, plus l’agent principal, soit 15. Chaque agent a arrêté ses serveurs et vérifié chaque PID dans son fichier d’axe ou son dossier de preuves. À la fin, `lsof` ne trouve aucune écoute sur 4510-4579.
- Conteneurs : ceux de l’axe 7 (`cellarreview-a7*`, `cellarreview-v7*`) sont supprimés, avec leurs images. `docker ps -a`, `docker images` et `docker volume ls` filtrés sur `cellarreview` sont vides.
- Worktrees : toutes les worktrees jetables (`wt-gates`, `wt-a1` à `wt-a7`, `wt-a1-old`, `wt-v1` à `wt-v7`, `wt-v1-old`) sont supprimées. Seule reste `.claude/worktrees/review-pre-1-0`, sur la branche `docs/review-pre-1.0`.
