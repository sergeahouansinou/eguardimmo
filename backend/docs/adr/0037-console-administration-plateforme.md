# ADR 0037 — Console d'administration de la plateforme : rôles, double validation, organisations, comptes, abonnements, RGPD, exploitation

Statut : accepté (2026-11-20), recommandations validées telles quelles ; backend livré (lots 1 à 8, 2026-11-21), amendements appliqués aux ADR 0003, 0004, 0005, 0006, 0011, 0013, 0014, 0016, 0017, 0018, 0027 et 0033 ; fronts F0 à F8 restants. Décide ce qui empêche `apps/console` de quitter le mode « Bientôt disponible » (26 pages gatées sur 30). Le support et l'accès aux données d'une organisation restent ceux de l'ADR 0033 ; le journal, celui de l'ADR 0016. Touche les ADR 0003, 0004, 0005, 0006, 0011, 0013, 0014, 0016, 0017, 0018, 0027 et 0033. Amendements appliqués le 2026-11-21 (liste en fin de document). Aucun texte légal n'a été relu pour cet ADR : tout point de droit (RGPD, facturation, CGV) est **à confirmer** par le DPO, un juriste ou un expert-comptable (ADR 0011).

## Contexte

Constaté dans le code (2026-11-20). Chemins serveur relatifs à `backend/`.

- **Front** : `apps/console/src/espace/capabilities.ts:22-38` n'ouvre que `audit` et `support` ; la source API répond `unavailable` pour tout le reste (`apps/console/src/console/api/source.ts:20-62`). La console appelle l'API par son serveur, jeton en session serveur, cookie `HttpOnly; Secure; SameSite=Strict` (`apps/console/src/server/login.test.ts:31`), IP du client relayée par clé (`app/Shared/Http/ConsoleRelay.php:17-33`).
- **Contrat attendu par les écrans** (`apps/console/src/console/schemas/`) :
  - organisations : types `bailleur|agence|proprietaire`, états `active|essai|suspendue` (`organisations.ts:4-6`) ; fiche avec titulaire et e-mail, membres et dernière connexion, usage, accès (`:58-95`) ; création, modification, suspension, changement de plan, demande d'accès ouverte par l'opérateur (`:98-131`) ;
  - comptes : liste parcourable avec statistiques et export CSV (`comptes.ts:16-45`, `console/demo/api/comptes.ts:61-85`), fiche avec connexions, mobile, sécurité (`comptes.ts:47-77`), suspension, réinitialisation 2FA, révocation de sessions, « accès justifié » ouvert par l'opérateur seul (`console/demo/api/comptes.ts:132-179`) ;
  - modules : version, état `operational|degraded`, responsable, drapeaux, pause des envois, activation par organisation (`modules.ts:16-93`, `console/demo/catalog.ts:18-38`) ;
  - abonnements : plans à audience `organisation|proprietaire`, essai de 0 à 90 jours, limites, MRR, échecs de paiement (`abonnements.ts:17-89`) ;
  - RGPD : trois types `acces|effacement|rectification`, étapes, messages (`rgpd.ts:4-83`) ;
  - santé : disponibilité, p95, connexions, disque, réplication, incidents et communication (`sante.ts:39-107`) ;
  - sauvegardes : liste, tests, demande de restauration en production avec second validateur (`sauvegardes.ts:18-75`, `console/demo/api/sauvegardes.ts:32-35`) ;
  - paramètres : domaines, expéditeur, quotas, 2FA, clés matérielles, liste blanche IP, durées de session et d'« accès justifié » de 5 à 120 min (`parametres.ts:12-69`) ; préférences de notification avec une adresse e-mail écrite en dur (`parametres.ts:76`) ;
  - équipe : rôles `administrateur|ingenierie|support|conformite|finance`, invitation, changement de rôle (`equipe.ts:4-99`) ; le rôle `support` y « modifie » organisations, comptes et modules (`:45-52`).
- **Serveur, console** : `POST /console/auth/token`, `GET /console/me`, `GET /console/activity[/{id}]`, `DELETE /console/auth/token` (`app/Modules/Identity/Http/routes.php:57-65`) ; support, accès de support, lectures `team` et `settings` sous `support-access:*` (`app/Modules/Messaging/Http/routes.php:78-95`). Rien d'autre.
- **Identity** : un opérateur est une ligne `operators` sans rôle (`app/Modules/Identity/Models/Operator.php:12-18`), en `timestamp` (`Database/Migrations/2026_11_13_190200_create_operators_table.php:16-18`, contraire à l'ADR 0017) ; attribution par `identity:grant-operator {email}` journalisée avec hôte et utilisateur système (`Console/GrantOperatorCommand.php:14-34`), tous les opérateurs prévenus (`Actions/GrantOperator.php:37`). `space:operator` exige capacité `operator`, opérateur actif et 2FA confirmée (`Http/Middleware/EnsureSpace.php:41-42`) ; le jeton est délivré après TOTP (`Actions/IssueConsoleToken.php:36-53`). `reauthenticated` et `TwoFactorProofs` lisent la **session** (`Http/Middleware/EnsureRecentReauthentication.php:56`, `PublicApi/TwoFactorProofs.php:13-18`) : un jeton console n'en a pas. `VerifyTwoFactorCode` refuse le rejeu d'un code pendant 150 s (`Actions/VerifyTwoFactorCode.php:17,39`). `RevokeUserCredentials` révoque jetons et sessions (`Actions/RevokeUserCredentials.php:16-21`). `users` n'a aucune colonne de suspension (`Database/Migrations/`).
- **Organizations** : `organizations` = `kind` (`agency|individual`), `name`, `country`, `two_factor_required` ; ni état, ni plan (`Database/Migrations/2026_11_15_100000_create_organizations_table.php:14-25`) ; création en libre-service (`Http/routes.php:21`) ; aucun événement (`Events/` vide).
- **Catalog** n'est pas un catalogue de modules : référentiels, champs personnalisés, étiquettes, routes `/org/{organization}/catalog` seulement (`app/Modules/Catalog/Http/routes.php:30-56`, ADR 0018). L'ADR 0018 fixe : « le registre des modules est du code ; la base ne garde que l'activation par organisation », droits en `plan_entitlements`, dérogations `organization_entitlement_overrides` « accordées par la console, datées, motivées, journalisées » (`docs/adr/0018-donnees-personnalisables.md:40-43`).
- **Subscriptions** n'existe pas (`app/Modules/`). L'ADR 0013 (accepté) fixe la grille, l'essai de 15 jours, « aucune donnée supprimée ni masquée » au dépassement, plans en table versionnée, quotas vérifiés dans l'Action créatrice, Stripe Billing envisagé, factures d'abonnement via plateforme agréée, une grille identique agences et bailleurs (`0013-plans-d-abonnement.md:27-46`). L'ADR 0028 exclut l'abonnement d'Invoicing (`0028-factures-et-avoirs.md:25`). Payments existe pour les comptes connectés des organisations, sans PSP branché (ADR 0036 § 7, ADR 0011 amendement).
- **RGPD existant** : anonymisation d'une fiche par l'organisation (`app/Modules/Parties/Http/routes.php:77-78`), rattrapage côté Messaging (`routes/console.php:34`) ; suppression de compte sans effacement, « réponse à une demande d'effacement RGPD à définir » (`0004-authentification-centralisee.md:49`) ; rétention du journal non fixée (`0016-journal-d-activite.md:78`).
- **Exploitation** : sonde `/up` (`bootstrap/app.php:16`) ; file et cache `database` (`.env.example:40,42`) ; 37 tâches planifiées sans suivi d'exécution (`routes/console.php:7-43`) ; Gotenberg par URL (`.env.example:114`) ; antivirus `MalwareScanner` (`app/Modules/Documents/Support/MalwareScanner.php:18-20`) ; transport e-mail `MAIL_PROVIDER` (`.env.example:209`) ; Telemetry hors modules, outil externe (`0005-decoupage-des-modules.md:64`). `SUPPORT_TEAM_ADDRESS` est absente de `.env.example` (reportée, ADR 0033).
- **Décisions déjà prises** : console hors du hub, jeton côté serveur (ADR 0004 § Console) ; rôle opérateur par commande artisan, jamais par adresse e-mail (ADR 0003, l. 30) ; aucune lecture de données d'organisation sans consentement, journal expurgé par `ActivityDisclosure` (`app/Shared/Audit/ActivityDisclosure.php:13-29`, ADR 0033 § 9) ; journal non modifiable (ADR 0016, ADR 0017).

## Décision

### 1. Invariants

1. **Gardes** de toute route `/api/v1/console/*` : `auth:sanctum`, `space:operator`, **`operator:{rôles}`** (nouveau, Identity) et `Cache-Control: private, no-store`. Une route console sans `operator:` fait échouer `tests/Feature/RoutesTest.php` (extension du contrôle `:101-104`).
2. **Données de plateforme** (eGuardImmo responsable de traitement, à confirmer) : comptes, opérateurs, organisation **en tant que cliente** (nom, type, pays, date de création, état, titulaire), abonnement et droits, demandes de support, demandes RGPD portant sur un compte, journal sans organisation. **Données d'organisation** (eGuardImmo sous-traitant) : tout le reste, équipe comprise ; lues seulement sous `support-access:{périmètre}` (ADR 0033), journal expurgé sinon. **Agrégats** nécessaires aux quotas (nombre de lots, de baux, de membres) : permis, jamais le contenu (à confirmer).
3. **Aucune écriture au nom d'une organisation.** La console n'écrit que l'état de plateforme : suspension, droits, catalogue de plans, sécurité d'un compte, demandes RGPD, approbations.
4. **Preuve 2FA à chaque écriture** : le corps porte `two_factor_code` (ou `recovery_code`), vérifié par `VerifyTwoFactorCode` (anti-rejeu existant) via le middleware `operator-proof` ; sans preuve 422 `operator_proof_required`, preuve fausse 422 `operator_proof_invalid` (verrouillage de compte existant). Les lectures n'en demandent pas.
5. **Double validation** des actions sensibles (décision 4) ; un opérateur ne valide jamais sa propre demande ; aucune action console sur un compte opérateur (403 `operator_account_protected`, artisan seulement).
6. **Minimisation** : Resources `Http/Resources/Console/` par module ; pas de liste parcourable des comptes, pas d'export CSV de masse ; aucune version, hôte, chemin ou secret dans une réponse.
7. **Journal** : chaque écriture `RecordAudit` `console.*` dans la transaction ; chaque consultation de fiche (`console.account.viewed`, `console.organization.viewed`) ; adresse recherchée en empreinte (`RecordAudit::fingerprint`) ; aucune donnée personnelle dans `metadata`.
8. **Aucune adresse e-mail ni identité d'opérateur dans le code** : rôles par artisan, boîtes d'équipe en variables d'environnement.

### 2. Carte des blocs

| Bloc | Décision | Hébergé par | Lot |
|---|---|---|---|
| Accueil | agrégats en comptes seulement | Reporting (`/console/overview`, lecture SQL des faits, ADR 0006) | 8 |
| Organisations | lecture plateforme, suspension par double validation ; création, modification, changement de plan **écartés** | Organizations | 5 |
| Comptes | recherche exacte, fiche, sessions, suspension, 2FA | Identity | 3 |
| Modules | registre des fonctions en code, activation = droits du plan + dérogations ; version, état, responsable, drapeaux, pause **écartés** (un seul déploiement, ADR 0001) | Subscriptions | 4 |
| Abonnements, plans | catalogue versionné, essai, droits, dérogations ; **facturation et encaissement : ADR distinct**, « Bientôt disponible » | Subscriptions (nouveau) | 4 |
| RGPD | registre des demandes, échéances, export du compte, transmission aux organisations, effacement par double validation ; registre des traitements et durées **hors application** | Privacy (nouveau) | 6 |
| Santé | sondes internes trois états ; métriques d'infrastructure et incidents **hors application** | Operations (nouveau) | 7 |
| Sauvegardes | **jamais depuis l'application** ; preuves déclarées par une commande lancée par le script de sauvegarde | Operations | 7 |
| Paramètres | lecture seule des valeurs effectives non secrètes ; modification par déploiement | Operations | 7 |
| Équipe | lecture ; attribution, rôles, révocation par artisan | Identity | 1 |
| Notifications | pas de centre opérateur (ADR 0033 § 8) ; « Bientôt disponible » puis retrait | – | – |
| Aide | contenu statique du front (`HelpPage`) : dégater, aucun serveur | front | F0 |
| Support, journal | existants (ADR 0033, ADR 0016) | Messaging, Identity | 1 (rôles) |

### 3. Rôles d'opérateur (Identity)

- `operator_roles` (`operator_id`, `role`, `granted_at`, `granted_by_user_id`, unique `(operator_id, role)`) ; enum `OperatorRole` : `admin`, `support`, `compliance`, `billing`, `engineering`. Le code fixe ce que chaque rôle permet ; **qui** est opérateur et avec quel rôle n'est jamais dans le code.
- Attribution : `identity:grant-operator {email} --role=…`, `identity:set-operator-roles {email} --role=…`, `identity:revoke-operator {email}` ; journalisées (`via`, hôte, utilisateur système) ; tous les opérateurs prévenus. La migration donne `admin` aux opérateurs actifs (aucun blocage), à réduire ensuite.
- Matrice (L lecture, É écriture, D demande, V validation) :

| Domaine | admin | support | compliance | billing | engineering |
|---|---|---|---|---|---|
| Support, accès de support (existants) | L É | L É | – | – | – |
| Journal d'activité | L | L | L | – | – |
| Organisations (fiche plateforme, droits) | L | L | L | L | – |
| Suspension, réactivation d'organisation | D V | D | V | – | – |
| Comptes : recherche, fiche | L | L | L | – | – |
| Comptes : révocation de sessions, suspension | É | É | – | – | – |
| Comptes : réactivation, réinitialisation 2FA | D V | D | V | – | – |
| Revue a posteriori (suspension de compte, urgence de support) | V | – | V | – | – |
| Plans, abonnements, dérogations | L V | – | – | L D V | – |
| RGPD | L | – | L É D V | – | – |
| Santé, paramètres | L | L | – | – | L |
| Équipe | L | – | – | – | – |

### 4. Double validation (Operations)

- `operator_approvals` : `action` (liste fermée `ApprovableAction`), `subject_type`, `subject_id`, `organization_id` nullable, `payload` JSON (identifiants et codes validés, jamais de texte libre), `reason` (10 à 500 caractères, exclu du journal), `ticket_reference` facultative, `requested_by_user_id`, `requested_proof` (`totp|recovery_code`), `status` (`pending`, `approved`, `rejected`, `expired`, `cancelled`, `failed`), `decided_by_user_id`, `decided_proof`, `decided_at`, `executed_at`, `failure_code`, `expires_at` (24 h), `lock_version` ; une demande vivante par `(action, subject_id)` (colonne générée unique).
- **Exécution à la validation**, dans la transaction de la validation : le module propriétaire de l'action enregistre son exécuteur dans `App\Shared\Approval\ApprovalHandlers` (même schéma que `ActivityDisclosure` : Operations n'importe aucun module) ; l'exécuteur relit l'état sous verrou ; état changé entre-temps : `failed` + 409 `approval_stale`, rien d'écrit.
- Règles : validateur ≠ demandeur (403 `approval_self_forbidden`), rôle habilité (403 `approval_role_forbidden`), preuve 2FA aux deux étapes, rejeu idempotent, expirée 409 `approval_expired`. Le demandeur peut annuler.
- **Actions** : `organizations.suspend`, `organizations.reactivate`, `identity.account.reactivate`, `identity.account.reset_two_factor`, `subscriptions.plan_version.publish`, `subscriptions.override.grant`, `subscriptions.override.revoke`, `privacy.erasure.execute`.
- **Immédiates, un seul opérateur** (elles restreignent) : révocation des sessions d'un compte ; suspension d'un compte, **revue a posteriori** par un second opérateur (`compliance` ou `admin`), comme l'urgence de l'ADR 0033.
- **Équipe d'un seul opérateur** : `operations:execute-approval {id}` sur le serveur, journalisée `via: artisan` (accès shell = second facteur organisationnel), jamais par HTTP.
- **Alerte** : demande en attente → e-mail sans contenu à `CONSOLE_TEAM_ADDRESS` ; compteur `GET /console/approvals?status=pending` interrogé par la console.

### 5. Organisations (Organizations, contrôleurs `Console/`)

- `GET /console/organizations` (curseur ; filtres `kind`, `state`, `plan`, `subscription_status` ; recherche par préfixe de nom, 3 caractères au moins) : identifiant, nom, type, pays, création, état, plan et statut d'abonnement (`Subscriptions\PublicApi\Subscriptions`), nombre de membres actifs (`Queries/` avec `AcrossOrganizations`, compte seul).
- `GET /console/organizations/{organization}` : en plus, `two_factor_required`, titulaire (prénom, nom, identifiant de compte ; l'adresse se lit sur la fiche du compte, journalisée), droits effectifs, nombre d'accès de support vivants. Équipe, réglages, identité légale : routes `support-access:*` existantes.
- `GET /console/organizations/{organization}/support-accesses` (Messaging) : accès passés et vivants (opérateur, périmètre, durée, nombre de lectures), sans motif pour `billing`.
- **Suspension** (double validation) : motif `fraud|abuse|legal_order|security`, **jamais l'impayé** (ADR 0013). Effet : `organizations.suspended_at`, `suspension_reason` ; le middleware `organization` refuse toute écriture (403 `organization_suspended`), lectures et exports restent ouverts ; espaces locataire et mandant inchangés (à confirmer) ; `owner` et `admin` prévenus (centre et e-mail non désactivables). Réactivation : double validation.
- **Écartés** : création (libre-service existant), modification (donnée de l'organisation), changement de plan (fait par l'organisation, ADR 0013 ; geste commercial = dérogation), accès ouvert par l'opérateur seul (ADR 0033).

### 6. Comptes (Identity, contrôleurs `Console/`)

- `GET /console/accounts?email=` (adresse exacte normalisée) ou `?id=` : zéro ou un résultat, 30/min.
- `GET /console/accounts/{user}` (`withTrashed`) : nom, adresse, création, vérification, dernière connexion, supprimé, suspendu, 2FA (activée, codes de secours restants), nombre d'appareils et de jetons, **types** de profil et **nombre** d'organisations (jamais les noms des agences d'un locataire ou d'un mandant). Connexions : journal existant filtré par auteur.
- `POST …/{user}/session-revocation` : `RevokeUserCredentials`. `POST …/{user}/suspension` : `users.suspended_at`, `suspension_reason`, jetons et sessions révoqués ; une connexion au mot de passe juste répond 403 `account_suspended` (hub, mobile, console) ; `POST …/{user}/suspension/review`.
- **Réinitialisation 2FA** (double validation, motif + `verification_method` `known_channel|video_call|document_seen`, aucune pièce conservée) : efface secret, confirmation et codes de secours, révoque jetons et sessions, envoie un e-mail de sécurité à l'adresse du compte. Réactivation : double validation.
- **Écartés** : liste et statistiques des comptes, export CSV, « accès justifié » de l'opérateur, téléphone et langue dans la fiche.

### 7. Modules, plans et abonnements (Subscriptions, nouveau)

- **Registre des fonctions** : enum `Feature` (groupes `socle`, `gestion`, `suivi`, `pilotage` ; fonctions du socle obligatoires). **Activation** = droits de la version de plan + dérogations, aucune table d'activation à part.
- **Tables** : `plans` (`code`, `name`), `plan_versions` (`version`, `status` `draft|published|archived`, `trial_days` fixé à 15 par l'ADR 0013, `public_signup`, `published_at` ; une version publiée ne se modifie plus, déclencheur ADR 0017), `plan_prices` (`currency` EUR et CAD, `monthly`, `yearly` en unités mineures), `plan_entitlements` (ADR 0018), `subscriptions` (`organization_id` unique, `plan_version_id`, `status` `trialing|free|active|past_due|cancelling|ended`, `trial_ends_at`, période, devise), `organization_entitlement_overrides` (fonction, activée, limite, `starts_at`, `ends_at`, motif, `approval_id`).
- **Cycle** : Organizations émet `OrganizationCreated` (nouveau) ⇢ Subscriptions crée l'abonnement `trialing` 15 jours, droits complets ; `subscriptions:end-trials` (horaire) → `free` ; `subscriptions:verify` (quotidienne) rattrape une organisation sans abonnement. Grille ADR 0013 chargée par un seeder de plateforme.
- **Application** : middleware `entitled:{feature}` (alias déclaré par `SubscriptionsServiceProvider`, comme `support-access`) sur les routes d'une fonction ; quotas par `Subscriptions\PublicApi\Entitlements::assertWithin(organisation, fonction, nombre actuel)`, appelé dans l'Action créatrice sous son propre verrou : 403 `feature_not_in_plan`, 409 `plan_quota_reached` (avec le plan suffisant). Lecture et export jamais bloqués. **Subscriptions n'appelle aucun module** : l'appelant compte ses objets.
- **Console** : `GET /console/plans[/{plan}]`, `POST /console/plans/{plan}/versions` (brouillon), `PATCH /console/plan-versions/{version}` (brouillon seul), publication et archivage par double validation ; `GET /console/subscriptions` (essais finissants, statuts) ; dérogations par double validation. MRR et ARR calculés à la lecture (jamais stockés), nuls tant qu'aucun encaissement n'existe.
- **Facturation de la plateforme** : ADR distinct, prérequis à toute page de paiement : PSP de la plateforme (Stripe Billing envisagé par l'ADR 0013 ; pas les comptes connectés de l'ADR 0036, l'argent va ici à eGuardImmo), émission des factures B2B via plateforme agréée, TVA et autoliquidation, TPS et TVQ (ADR 0013). D'ici là : « Bientôt disponible ».

### 8. RGPD (Privacy, nouveau)

- **Partage des rôles** (à confirmer) : eGuardImmo répond pour les données de plateforme ; pour les données d'une organisation, il transmet et assiste (RGPD art. 28), sans lire.
- `privacy_requests` : `requester_user_id` ou adresse chiffrée et empreinte (demande reçue hors application), `kind` `access|rectification|erasure|portability|restriction|objection`, `channel` `account|email|letter`, `received_at`, `due_at` (+1 mois), `extended_until` (+2 mois, motif), `identity_verified_by` (méthode), `status` `received|in_progress|completed|refused`, `refusal_reason`, `support_ticket_id` (échanges par la demande de support, pas de second fil), `forwarded_count`. `privacy_request_events` en ajout seul (déclencheur ADR 0017) : journal de preuve.
- **Entrée** : `POST /privacy/requests` (tout compte vérifié, `no-operator-token`, 3/jour) ; saisie par `compliance` d'une demande reçue par courrier.
- **Accès, portabilité** : export JSON produit par Privacy depuis `Identity\PublicApi\AccountDataExport`, `Messaging\PublicApi\SupportTicketsOf`, `Notifications\PublicApi\AccountNotificationData` (nouveaux, lecture) ; téléchargé **par le demandeur seul** dans son espace, 30 jours ; l'opérateur ne voit que « généré ».
- **Données des organisations** : transmission à chaque organisation liée au compte (adhésions, rattachements locataire, accès mandant, lus comme pour `/me/profiles`) : `GET /org/{organization}/privacy-requests` pour `owner` et `admin` (nom et adresse du demandeur, type, échéance), notification `privacy.request_forwarded` non désactivable ; l'organisation traite par ses outils (anonymisation de fiche, exports) et marque `handled`. La console voit le nombre et l'état, jamais le contenu.
- **Effacement** (double validation) : flux `DeleteAccount` existant puis `AccountDeleted` ; complété par l'effacement des comptes supprimés (question 11).
- **Hors application** : registre des traitements (art. 30), analyses d'impact, tableau des durées de conservation : documents du DPO. APDP : non applicable au lancement (ADR 0033, point 9).

### 9. Santé (Operations, nouveau)

- `/up` reste la sonde de la supervision externe.
- `GET /console/health` (6/min, résultat mis en cache 30 s, 2 s au plus par sonde) : `ok|down|unknown` et latence pour la base (`SELECT 1`) ; file (`jobs` par file, âge du plus ancien, `failed_jobs` sur 24 h) ; tâches planifiées (dernière exécution, durée, échec, retard sur la fréquence) ; clamd (`Documents\PublicApi\ScannerStatus`, `PING`) ; Gotenberg (`/health`) ; e-mail (fournisseur configuré, dernier événement de webhook, rebonds sur 24 h, sans appel à l'API du fournisseur) ; passerelle de paiement (`none|fake|provider`). Délai ou erreur non qualifiée : `unknown`, jamais `ok` ni `down` (ADR 0011).
- `scheduled_task_runs` (une ligne par commande, mise à jour par `ScheduledTaskStarting|Finished|Failed`) : état technique, hors `Auditable`, hors organisation.
- **Hors application** : disponibilité, p95, taux de 5xx, connexions, disque, mémoire, réplication (supervision et suivi d'erreurs externes, ADR 0005) ; **incidents et page de statut** (une application en panne ne peut pas annoncer sa panne). La console affiche un lien (`CONSOLE_MONITORING_URL`, `CONSOLE_STATUS_PAGE_URL`).

### 10. Sauvegardes

- **Jamais depuis l'application** : ni déclenchement, ni liste de fichiers, ni restauration. Un jeton opérateur volé ne doit pas pouvoir écraser la production, et l'application est indisponible quand on en a besoin.
- Exécutées par l'hébergement : base et stockage des documents, chiffrées, hors site, dans l'UE ; test de restauration mensuel en environnement isolé ; procédure de restauration écrite (runbook) avec double validation humaine hors application.
- **Preuves** : le script de sauvegarde lance `operations:record-backup` sur l'hôte (aucune route HTTP) : type, début, durée, taille, succès, empreinte du manifeste, cible de test et résultat. `GET /console/backups` en lecture ; alerte de la santé si la dernière sauvegarde réussie a plus de 26 h.

### 11. Paramètres et profil opérateur

- La configuration reste **déployée** (`.env`, revue) : modifier depuis la console 2FA, liste blanche ou verrous donnerait ce pouvoir à un jeton volé.
- `GET /console/settings` : valeurs effectives non secrètes (durée du jeton console, session absolue, horaires du support, plafonds de diffusion, antivirus actif, fournisseur d'e-mail configuré oui/non, passerelle) ; DNS SPF, DKIM, DMARC relevés par la supervision, pas par l'application.
- Liste blanche IP de la console : au mandataire inverse de la console (infrastructure).
- Mot de passe, 2FA et codes de secours de l'opérateur : pages de sécurité du hub (même compte, ADR 0004) ; le changement révoque le jeton console. `GET /console/me` existant pour l'affichage.
- **Écartés** : clés matérielles (WebAuthn absent de Fortify), durée d'« accès justifié » (remplacée par le consentement de l'ADR 0033).

### 12. Équipe et notifications

- `GET /console/operators` (`admin`) : nom, adresse, rôles, 2FA confirmée, dernière connexion console, état. Invitation et changement de rôle depuis la console : écartés (question 1).
- Pas de centre de notifications pour les opérateurs ; alertes par `CONSOLE_TEAM_ADDRESS` (approbations), la supervision externe (santé) et `SUPPORT_TEAM_ADDRESS` (support, à ajouter à `.env.example`).

### 13. API (`/api/v1/console`, noms préfixés par le module)

| Module | Routes |
|---|---|
| Identity | `GET /accounts`, `GET /accounts/{user}`, `POST /accounts/{user}/session-revocation\|suspension`, `POST /accounts/{user}/suspension/review`, `GET /operators` |
| Operations | `GET\|POST /approvals`, `GET /approvals/{id}`, `POST /approvals/{id}/approve\|reject\|cancel`, `GET /health`, `GET /backups`, `GET /settings` |
| Organizations | `GET /organizations`, `GET /organizations/{organization}` |
| Messaging | `GET /organizations/{organization}/support-accesses` |
| Subscriptions | `GET /plans[/{plan}]`, `POST /plans/{plan}/versions`, `PATCH /plan-versions/{version}`, `GET /subscriptions`, `GET /organizations/{organization}/entitlements` |
| Privacy | `GET\|POST /privacy-requests`, `GET /privacy-requests/{id}`, `POST /privacy-requests/{id}/verify\|extend\|forward\|complete\|refuse` ; hors console : `POST /privacy/requests`, `GET /privacy/requests[/{id}]`, `GET /privacy/requests/{id}/export`, `GET\|POST /org/{organization}/privacy-requests[/{id}/handled]` |
| Reporting | `GET /overview` |

- Débits par opérateur : lectures 60/min, recherche de compte 30/min, écritures 20/h, approbations 30/h, santé 6/min.
- **Codes** (ADR 0014) : Identity `operator_role_required` 403, `operator_proof_required` 422, `operator_proof_invalid` 422, `operator_account_protected` 403, `account_suspended` 403, `account_not_found` 404, `account_already_suspended` 409, `two_factor_not_enabled` 409, `suspension_review_forbidden` 403 ; Operations `approval_not_found` 404, `approval_self_forbidden` 403, `approval_role_forbidden` 403, `approval_not_pending` 409, `approval_expired` 409, `approval_pending_exists` 409, `approval_stale` 409 ; Organizations `organization_suspended` 403 ; Subscriptions `plan_not_found` 404, `plan_version_not_editable` 409, `feature_not_in_plan` 403, `plan_quota_reached` 409, `override_invalid` 422 ; Privacy `privacy_request_not_found` 404, `privacy_request_closed` 409, `privacy_request_exists` 409, `privacy_export_expired` 410.

### 14. Audit et conservation

- Actions (ADR 0016, sans adresse, nom, motif ni texte libre) : `identity.operator.roles_changed`, `console.account.searched|viewed|sessions_revoked|suspended|suspension_reviewed`, `identity.account.reactivated|two_factor_reset`, `console.organization.viewed`, `organizations.organization.suspended|reactivated`, `operations.approval.requested|approved|rejected|cancelled|expired|executed|failed`, `subscriptions.plan_version.created|published|archived`, `subscriptions.override.granted|revoked`, `subscriptions.subscription.created|trial_ended`, `privacy.request.received|verified|extended|forwarded|exported|completed|refused`, `privacy.export.downloaded`, `operations.backup.recorded`.
- **Conservation proposée (à confirmer)** : approbations 5 ans ; demandes RGPD et journal de preuve 5 ans après clôture ; export RGPD 30 jours ; exécutions planifiées : dernière seulement ; rapports de sauvegarde 13 mois.

### 15. Modèle de données (UUID v7, `datetime(6)`, `Checks::add`, jamais `ENUM`)

- **Identity** : `operator_roles` ; `operators` passé en `datetime(6)` ; `users.suspended_at`, `users.suspension_reason`, `users.suspension_reviewed_by_user_id`, `users.suspension_reviewed_at`.
- **Organizations** : `organizations.suspended_at`, `organizations.suspension_reason` ; événement `OrganizationCreated`.
- **Subscriptions** (nouveau) : `plans`, `plan_versions`, `plan_prices`, `plan_entitlements`, `subscriptions`, `organization_entitlement_overrides`.
- **Privacy** (nouveau) : `privacy_requests`, `privacy_request_events`, `privacy_request_forwards` (`organization_id`, `handled_at`).
- **Operations** (nouveau) : `operator_approvals`, `scheduled_task_runs`, `backup_reports`.
- Hors organisation (liste `ArchTest`) : `OperatorRole`, `OperatorApproval`, `Plan`, `PlanVersion`, `PlanPrice`, `PlanEntitlement`, `PrivacyRequest`, `PrivacyRequestEvent`, `ScheduledTaskRun`, `BackupReport`. `Subscription`, `OrganizationEntitlementOverride`, `PrivacyRequestForward` portent `organization_id` : écriture console sous `CurrentOrganization::run`, listes par `Queries/`.
- **Réglages** (`.env.example` d'abord) : `CONSOLE_TEAM_ADDRESS`, `CONSOLE_MONITORING_URL`, `CONSOLE_STATUS_PAGE_URL`, `OPERATIONS_APPROVAL_TTL_HOURS` (24), `OPERATIONS_BACKUP_MAX_AGE_HOURS` (26), `PRIVACY_EXPORT_TTL_DAYS` (30), `SUPPORT_TEAM_ADDRESS`.

## Options écartées

- **Rôle opérateur unique** (actuel) : un agent du support lirait la facturation et validerait ses propres actions ; aucune séparation des tâches.
- **Invitations et rôles d'opérateur depuis la console** : un jeton volé créerait un opérateur complice ; rouvre l'ADR 0003 pour un besoin couvert par artisan.
- **Double validation propre à chaque module** (une table de demandes par action) : huit copies du même cycle.
- **Fenêtre de réauthentification liée au jeton console** : état côté serveur à inventer ; un code par écriture coûte 30 s au pire.
- **Création, modification, changement de plan d'une organisation par l'opérateur** : écriture au nom d'un client, contraire à l'ADR 0033 et à l'ADR 0013.
- **Suspension pour impayé** : contraire à l'ADR 0013 (repli sur Gratuit, rien de masqué).
- **Liste parcourable et export CSV des comptes** : copie de masse de données personnelles sans finalité.
- **« Accès justifié » ouvert par l'opérateur seul** (écrans `comptes` et `organisations`) : écarté par l'ADR 0033.
- **Catalogue de modules dans Catalog** : Catalog porte les référentiels des organisations (ADR 0018) ; les fonctions d'un plan relèvent de l'abonnement.
- **Version, état et responsable par module** : un seul déploiement (ADR 0001) ; l'état vient des sondes.
- **Subscriptions → Organizations** (ADR 0005) : le quota de membres créerait un cycle Organizations ↔ Subscriptions.
- **Plans tenus par Stripe seul** : dépendance du droit d'usage à un tiers injoignable ; l'ADR 0013 veut une table versionnée.
- **Abonnement facturé par Invoicing** : exclu par l'ADR 0028 ; Invoicing émet pour une organisation, pas pour eGuardImmo.
- **Demandes RGPD comme demandes de support** : ni échéance légale, ni journal de preuve, ni transmission aux organisations.
- **L'opérateur lit les données d'une organisation pour répondre à une demande RGPD** : eGuardImmo n'est pas responsable de ce traitement (à confirmer) ; transmission à l'organisation.
- **Incidents et page de statut dans la console** : tombent avec l'application.
- **Métriques d'infrastructure collectées par Laravel** : refaire une supervision (ADR 0005, Telemetry).
- **Restauration demandée ou exécutée depuis la console**, même avec second validateur : surface d'attaque destructrice sur la production.
- **Paramètres de sécurité modifiables en ligne** : affaiblissement à distance par un jeton volé.

## Conséquences

- **Front** (`apps/console`) : `aide` dégatée tout de suite ; puis par famille, avec les contrats adaptés : types `agency|individual` et états `active|suspended` + statut d'abonnement ; formulaires de création, modification, changement de plan et « accès justifié » retirés ; comptes par recherche exacte ; modules = fonctions et droits ; plans sans audience `proprietaire`, essai fixé à 15 jours, versions ; RGPD à six types et sans fil propre ; santé = sondes + liens externes ; sauvegardes = preuves en lecture ; paramètres en lecture ; équipe en lecture, rôles à cinq codes ; écran « approbations » (nouveau) ; champ de code 2FA sur chaque action ; référence de demande `SUP-AAAA-NNNNN` (format serveur, `app/Modules/Messaging/Support/ReferenceSequence.php:19`) au lieu de `SUP-\d{3,6}` ; adresse e-mail retirée de `parametres.ts:76`. `notifications` et les incidents restent gatés.
- **Modules** : Identity, Organizations, Messaging modifiés ; Subscriptions, Privacy, Operations créés par `make:module` ; Properties, Leases, Inspections, Documents et Organizations appellent `Entitlements` dans leurs Actions de création.
- **Exploitation** : planification `subscriptions:end-trials` (horaire), `subscriptions:verify`, `privacy:flag-due` (quotidienne, échéance à 7 jours), `privacy:purge-exports`, `operations:expire-approvals` (horaire) ; script de sauvegarde appelant `operations:record-backup` ; supervision et page de statut externes à choisir ; compte SQL limité à `INSERT`/`SELECT` sur `audit_logs`, `privacy_request_events`.
- **Risques** : double validation bloquante pour une petite équipe (commande de secours) ; code TOTP saisi à chaque écriture (ergonomie) ; quotas appliqués module par module (un oubli = quota contourné : test d'architecture sur les Actions de création listées) ; transmission RGPD dépendante de la réactivité des organisations.

## Plan de lots

Backend d'abord, front ensuite ; chaque lot sort par `composer check` ou `pnpm -r check` sans test ignoré ; `/security-review` sur les lots 1, 2, 3, 5 et 6. Tests communs à toute route console : 401 sans jeton, 403 avec une session par cookie, 403 jeton opérateur d'un compte sans 2FA confirmée, 403 rôle absent, 422 écriture sans preuve, 404 sur identifiant inconnu (`whereUuid`), `no-store`, aucune version ni hôte dans le corps, nombre de requêtes constant (1, 10, 100 lignes).

| Lot | Contenu | Critères de sortie |
|---|---|---|
| 1. Rôles et preuve | `operator_roles`, `operator:` et `operator-proof`, `operators` en `datetime(6)`, rôles sur les routes existantes (journal, support), commandes artisan, `GET /operators` | `RoutesTest` refuse une route console sans `operator:` ; code TOTP rejoué refusé ; opérateurs actifs migrés en `admin` ; révocation : jeton console supprimé et audit dans la même transaction |
| 2. Double validation | `operator_approvals`, `ApprovalHandlers`, routes, expiration, commande de secours, alerte | auto-validation 403 ; rôle non habilité 403 ; expirée 409 ; demande vivante unique ; état périmé → `failed` sans écriture ; exécuteur en échec → rien de partiel |
| 3. Comptes | recherche, fiche, révocation, suspension et revue, réactivation et 2FA par approbation | compte opérateur 403 ; compte supprimé lisible, sans action ; 2FA réinitialisée → jetons et sessions révoqués, e-mail de sécurité ; suspendu refusé au hub, au mobile et à la console ; empreinte de l'adresse dans l'audit |
| 4. Subscriptions | module, grille ADR 0013 (EUR, CAD), droits, `OrganizationCreated`, essai, fin d'essai, dérogations, `entitled:`, `Entitlements`, routes console | montants en unités mineures ; version publiée immuable (déclencheur testé) ; quota refusé à la création, jamais à la lecture ni à l'export ; rattrapage d'une organisation sans abonnement ; liens de l'ADR 0005 vérifiés par `ArchTest` |
| 5. Organisations | liste, fiche, droits, accès de support, suspension et réactivation | aucune donnée d'équipe hors `support-access:team` ; suspendue → écritures 403, lectures 200 ; `owner` et `admin` prévenus |
| 6. Privacy | registre, échéances, export de compte, transmission, effacement par approbation, journal de preuve | export téléchargeable par le demandeur seul ; opérateur sans accès au contenu ; échéance du 31 janvier au 28 ou 29 février ; journal non modifiable (déclencheur testé) ; organisation d'un autre compte 404 |
| 7. Exploitation | sondes, `scheduled_task_runs`, `operations:record-backup`, `GET /backups`, `GET /settings` | sonde injoignable `unknown` ; délai borné ; aucune valeur secrète servie ; sauvegarde de plus de 26 h signalée |
| 8. Accueil | `GET /overview` (Reporting) | comptes seulement ; requêtes constantes |
| F0 à F8 | dégater `aide`, puis fronts des lots 1 à 8 | `pnpm -r check` ; vérification navigateur sur l'API réelle (approbation à deux opérateurs, suspension, réinitialisation 2FA) ; famille passée à `familyHasApiSource: true` |

## Points à valider par un juriste ou le DPO

1. Qualification d'eGuardImmo : responsable de traitement pour comptes, abonnement, support et journal de plateforme ; sous-traitant pour les données des organisations ; lecture d'agrégats d'usage sans consentement.
2. Demandes des personnes : délai d'un mois prolongeable de deux, vérification d'identité, format de portabilité, transmission aux organisations au titre de l'art. 28.
3. Comptes supprimés : durée de conservation, effacement à J+30 (question 11), obligations contraires.
4. Suspension d'une organisation : fondement contractuel (CGV), préavis, effet sur les locataires et mandants de l'organisation.
5. Réinitialisation 2FA : vérification d'identité acceptable sans conserver de pièce.
6. Facturation de l'abonnement : facture électronique B2B via plateforme agréée, bailleurs particuliers (B2C, e-reporting), TVA, autoliquidation, guichet unique, TPS et TVQ.
7. Durées de conservation de la décision 14 et du journal d'audit (ADR 0016).
8. Sauvegardes : localisation UE, chiffrement, Loi 25 pour le Québec.

## Questions fermées pour l'utilisateur

Ma recommandation est toujours la première.

1. **Rôles fermés `admin`, `support`, `compliance`, `billing`, `engineering`, attribués par artisan ?** Alternatives : rôle unique (actuel) ; invitations et rôles depuis la console sous double validation.
2. **Double validation pour suspension et réactivation d'organisation, réactivation de compte, réinitialisation 2FA, publication de plan, dérogations, effacement RGPD ; révocation de sessions et suspension de compte immédiates, la suspension revue a posteriori ?** Alternatives : tout en double validation ; seulement la 2FA.
3. **Équipe d'un seul opérateur : commande artisan de secours journalisée ?** Alternative : actions sensibles bloquées tant qu'un second opérateur n'existe pas.
4. **Un code TOTP dans chaque écriture console ?** Alternative : fenêtre de 10 minutes liée au jeton après une preuve.
5. **Suspension d'organisation = écritures refusées, lectures et exports ouverts, espaces locataire et mandant inchangés, jamais pour impayé ?** Alternative : blocage total.
6. **Pas de création, modification ni changement de plan d'une organisation par l'opérateur (libre-service et dérogation) ?** Alternative : création assistée avec invitation du titulaire.
7. **Recherche de compte par adresse exacte ou identifiant, sans liste ni export ?** Alternative : liste filtrable paginée (écran actuel).
8. **Créer Subscriptions maintenant sans encaissement, facturation par un ADR distinct ?** Alternatives : attendre le PSP ; plans tenus par Stripe Billing.
9. **Modules → Subscriptions (`entitled:`, `Entitlements`), Subscriptions n'appelle aucun module (amende l'ADR 0005) ?** Alternative : garder Subscriptions → Organizations et contrôler le quota de membres a posteriori.
10. **Créer Privacy (registre, échéances, export du compte, transmission aux organisations) ?** Alternatives : demandes de support catégorisées ; registre tenu hors application.
11. **Comptes supprimés : nom remplacé, adresse en empreinte, secret 2FA et appareils effacés à J+30 ?** Alternative : conservation actuelle (tout gardé).
12. **Santé : sondes internes dans la console, métriques, incidents et page de statut externes ?** Alternative : incidents gérés dans la console.
13. **Sauvegardes jamais depuis l'application, preuves déclarées par `operations:record-backup` ?** Alternative : preuves hors application seulement.
14. **Paramètres en lecture seule, configuration par déploiement ?** Alternative : paramètres de sécurité modifiables sous double validation.
15. **Ordre des lots : rôles (1), double validation (2), comptes (3), abonnements (4), organisations (5), RGPD (6), exploitation (7), accueil (8) ?** Alternative : organisations et abonnements d'abord.

## Amendements nécessaires (appliqués le 2026-11-21)

- **ADR 0003** : rôles d'opérateur en liste fermée, attribués par artisan ; la console écrit l'état de plateforme (suspension, droits, sécurité d'un compte) et jamais au nom d'une organisation.
- **ADR 0004** : preuve TOTP par écriture console ; suspension de compte (`account_suspended`) ; réinitialisation 2FA par double validation ; effacement des comptes supprimés (selon la question 11).
- **Revue de sécurité (2026-11-21)** : empreinte `content_sha256` du contenu d'une version dans la demande de publication (recalculée à la validation, `approval_stale` si elle diffère) ; modification d'une version refusée tant qu'une publication est en attente ; réauthentification pour les demandes d'accès, de portabilité et d'effacement (décision hors ADR : `access` produit un export) ; `identity:revoke-operator` et `identity:set-operator-roles` refusent de retirer le dernier administrateur sauf `--force`.
- **ADR 0005** : modules Privacy et Operations (famille Plateforme) ; Subscriptions précisé ; « Subscriptions → Organizations » remplacé par Organizations, Properties, Leases, Inspections, Documents → Subscriptions (`Entitlements`) et Organizations ⇢ `OrganizationCreated` ⇢ Subscriptions ; Privacy → Identity (`AccountDataExport`, profils du compte), Messaging (`SupportTicketsOf`), Notifications (`AccountNotificationData`), Organizations, Parties (organisations liées au compte), lecture seule ; Privacy, Organizations ⇢ nouveaux événements ⇢ Notifications ; Operations → Identity (opérateurs, rôles, preuve), Documents (`ScannerStatus`) ; Reporting lit en SQL les comptes de `organizations`, `users`, `subscriptions`, `support_tickets`, `privacy_requests` pour `/console/overview`. Aucun module n'appelle Privacy ni Operations.
- **ADR 0006** : modèles hors organisation de la décision 15 ; lectures console `AcrossOrganizations` dans `Queries/` d'Organizations, Subscriptions et Privacy.
- **ADR 0011** : facturation de l'abonnement de la plateforme (PSP de la plateforme, plateforme agréée) par un ADR distinct.
- **ADR 0013** : plans en `plan_versions` et `plan_prices`, publication par double validation, dépendances inversées, aucune suspension pour impayé.
- **ADR 0014** : codes de la décision 13.
- **ADR 0016** : actions de la décision 14 ; durées de conservation ; `subscriptions.plan_version.updated` porte l'avant/après du contenu ; un modèle qui n'a pas d'attribut `organization_id` mais qui est une organisation fournit `auditOrganizationId()` (sinon le journal le divulguerait sans accès de support).
- **ADR 0017** : `operators` en `datetime(6)` ; déclencheurs d'ajout seul sur `privacy_request_events` et d'immuabilité des versions publiées.
- **ADR 0018** : `organization_entitlement_overrides` créées et retirées par double validation.
- **ADR 0027** : types `organizations.suspended|reactivated` (`owner`, `admin`, centre et e-mail non désactivables), `privacy.request_forwarded` (`owner`, `admin`, non désactivable), `account.privacy_completed|export_ready` (audience `account`).
- **ADR 0033** : périmètre `settings` sans « plan, modules » (données de plateforme) ; la phrase « ce qui existe aujourd'hui dans la console (liste des organisations, abonnements) » ne correspond à aucune route serveur ; route console des accès par organisation.
- **Reprise des quotas (2026-11-21)** : `Entitlements::assertWithin` est appelé par `CreateUnit`, `RestoreUnit`, `CreateLease`, `RestoreLease`, `RecordInspection` et `InviteMember` ; corps `plan_quota_reached` enrichi de `feature`, `limit`, `current` (ADR 0013, 0014). L'alias `entitled:` n'est posé sur aucune route : les plans actuels activent toutes les fonctions et seuls les quotas varient. Locataires, stockage et signatures ne sont pas câblés (raisons à l'ADR 0013).

## Amendement du 2026-11-25 (ADR 0042)

- La console gagne les familles « marketing » et « notifications » (rôle `admin`, preuve 2FA sur chaque écriture) ; les réglages de notification et les règles de rappel sont modifiables en ligne.
