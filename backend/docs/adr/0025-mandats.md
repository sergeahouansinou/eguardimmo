# ADR 0025 — Mandats de gestion

Statut : accepté (2026-11-16). Complète l'ADR 0005 (module Mandates), l'ADR 0017 (invariants sous verrou), l'ADR 0018 (référentiels, champs personnalisés), l'ADR 0019 (mandant = partie) et l'ADR 0020 (conditions à période de validité).
Amendement accepté (2026-11-18, ADR 0031) : `fee_base` (`rent` ou `rent_and_charges`), `fee_minimum_amount` et `fee_tax_mode` (`excl_tax` ou `incl_tax`) sur `mandate_terms`, sans valeur par défaut sur les mandants existants (avenant obligatoire avant la première facturation d'honoraires) ; `payout_day` lu par l'aperçu de reversement ; le compte du mandant survit au mandat.

## Contexte

Une agence gère des lots pour le compte d'un propriétaire. Le mandat fixe le mandant, les lots couverts, la durée, la reconduction, le préavis et les honoraires. Un lot n'a qu'un gérant à une date donnée ; le module Leases lira le mandat actif qui couvre un lot.

## Décision

### Modèle (Mandates)
- `mandates` : référence séquentielle par organisation (`M-AAAA-NNNN`, `ContinuousCounter` sous verrou, table `mandate_sequences`), mandant (`mandant_party_id`, une partie du module Parties, sans clé étrangère SQL), type par référentiel Catalog `mandate_type` (sens système `rental_management`, `management_with_syndic`, `short_term_management`, `tenant_search`, `other`), statut `draft | active | suspended | terminated | expired`, période `[starts_on, ends_on)`, reconduction tacite (`tacit_renewal`, `renewal_months`), préavis (`notice_months`), signature, résiliation, `custom_fields`, note interne, `lock_version`, `archived_at`.
- `mandate_units` : un lot couvert sur `[valid_from, valid_to)`, sans clé étrangère SQL vers `units` (lecture par `UnitDirectory`).
- `mandate_terms` : une ligne par période de validité, jamais réécrite (ADR 0020). Honoraires en points de base (`percentage`) ou en forfait (`flat`, entier en unités mineures + devise), jour de reversement, plafond de travaux sans accord. Un avenant ferme la ligne ouverte et en ouvre une (`replaces_id`, motif `initial | amendment`). Une colonne virtuelle unique garantit une seule ligne ouverte par mandat.
- Bornes en base : `ends_on` et `valid_to` sont exclusifs ; l'API expose `end_date` inclusif. CHECK via `Checks::add` (ADR 0017).

### Invariants
- **Non-chevauchement** : un lot n'est couvert que par un mandat non brouillon à la fois dans l'organisation. À l'activation, à l'ajout d'un lot et au renouvellement, l'Action lit `FOR UPDATE` mandat et lignes, prend les verrous des lots dans l'ordre (`mandate_unit_locks`, tri par identifiant, modèle de `lease_unit_locks`), puis relit les couvertures par jointure explicite. Conflit : 409 `mandate_overlap`. Les brouillons ne réservent rien.
- **Écriture concurrente** : `lock_version` obligatoire sur chaque écriture, 409 `mandate_stale_version` sinon.
- **Mandant** : une partie vivante de l'organisation, jamais une identité dupliquée.
- **Agence seulement** : une organisation `individual` est refusée par le serveur (403 `mandate_agency_only`).

### Actions
Créer un brouillon, modifier (structure réservée au brouillon, champs de gestion toujours modifiables), ajouter, terminer ou retirer un lot, activer (signature), suspendre, reprendre, résilier (préavis), renouveler, avenant aux honoraires, archiver, restaurer, expirer (`mandates:expire`, quotidienne : reconduit les mandats tacites, expire les autres, retombe sur l'expiration si la reconduction chevauche).

### Résiliation
La date de préavis ne dépasse pas aujourd'hui, la fin effective suit le préavis et ne prolonge jamais le mandat. Le délai `notice_months` est respecté sauf résiliation amiable déclarée (`amicable`).

### Lecture inter-modules
`PublicApi/MandateDirectory` : `find`, `findMany`, `coveringUnit(s)` (mandat non brouillon qui couvre un lot à une date, avec les honoraires du jour, suspendu signalé), `mandants`. Ne renvoie que des DTO.

### API (`/org/{organization}/mandates…`)
Lecture : propriétaire, administrateur, gestionnaire, comptable (sans la note interne ni la note de résiliation), débit 120/min. Écriture : propriétaire, administrateur, gestionnaire, débit 60/min. Codes RFC 9457 dans `Enums/ErrorCode` (ADR 0014).

## Options écartées

- **Clé étrangère vers `parties` et `units`** : interdit entre modules (ADR 0005) ; l'existence se vérifie par PublicApi.
- **Honoraires en colonnes du mandat** : aucun historique d'avenant ; `mandate_terms` suit le modèle de `lease_terms`.
- **Détection du chevauchement par contrainte d'unicité ou lecture sans verrou** : impossible sur des périodes, et un instantané REPEATABLE READ laisse passer deux activations simultanées.
- **Brouillons qui réservent le lot** : un brouillon abandonné bloquerait la gestion du lot.
- **Événements de mandat (`MandateActivated`…)** : aucun consommateur aujourd'hui ; ajouter l'événement avec le premier (Leases).
- **TVA sur honoraires modélisée** : dépend du pays (ADR 0008), laissée à Invoicing.
- **Contrôle que le mandant est propriétaire du lot** : le patrimoine ne porte pas encore de propriétaire ; non contrôlé, à reprendre quand le patrimoine portera un propriétaire.

## Conséquences

- Mandates → Properties (`UnitDirectory`), Parties (`PartyDirectory`), Catalog (`TermDirectory`, `CustomFieldValidator`), Organizations (`MembershipDirectory` : agence seulement, rôle du membre), Documents (`DocumentStore::exists` : pièce signée). Leases → Mandates reste à brancher via `MandateDirectory`.
- Le référentiel `mandate_type` est ajouté au Catalog ; les valeurs de plateforme se sèment par `PlatformCatalog`.
- La commande `mandates:expire` doit être planifiée une fois par jour.

## Amendement du 2026-11-19 (ADR 0032, lot 3)

- Demande de fin de mandat par le mandant : table `mandate_end_requests` (une `pending` par mandat), `POST|DELETE /owner/mandates/{mandate}/end-request` (2FA et preuve récente, 10/min), `GET /org/{organization}/mandates/{mandate}/end-request` côté agence, événement `MandateEndRequested`. Le mandat n'est jamais modifié ; seul un mandat actif non archivé accepte la demande. La résiliation reste celle de cet ADR.

## Amendement du 2026-11-20 (ADR 0040)

- `mandate_terms` gagne `letting_fee_basis_points`, `works_fee_basis_points` (entiers en points de base, enregistrés ; facturation encore manuelle) et `signed_file_id` (avenant signé, pièce `clean` déposée pour le mandat, exigée à chaque avenant et partagée d'office avec le mandant). `fee_base` est requis à la création d'un mandat.
- Table `mandate_term_defaults` (une ligne par organisation, `lock_version`, préremplissage seul : jamais appliquée à un mandat existant) : `GET|PUT /org/{organization}/mandates/term-defaults`.
- L'agence écrit `mandate_documents` (partage et retrait) par `GET|POST /org/{organization}/mandates/{mandate}/documents` et `DELETE …/documents/{document}` ; événement `MandateDocumentShared`.

## Amendement du 2026-11-21 (ADR 0032)

- `mandate_end_requests.status` gagne `dismissed` (rejet par l'agence) et `fulfilled` (clôturée par `terminate`) ; colonnes `decided_at`, `decided_by_user_id`, `decision_note` (500 caractères, jamais dans le journal ni les notifications). La demande vivante reste la seule `pending` par mandat.
- Cycle de vie : `pending` → `cancelled` (mandant), `dismissed` (agence, `POST /org/{organization}/mandates/{mandate}/end-request/dismiss`, rejouable en 200) ou `fulfilled` (`terminate`). Une demande déjà annulée ou satisfaite ne se rejette pas (`mandate_end_request_not_pending` 409). Événement `MandateEndRequestDecided` ⇢ Notifications (`owner.mandate_end_dismissed`, `owner.mandate_end_fulfilled`).

## Amendement du 2026-11-21 (lecture de la dernière demande de fin de mandat)

- `GET /org/{organization}/mandates/{mandate}/end-request` renvoie la demande **la plus récente** du mandat, quel que soit son statut (`pending`, `dismissed`, `fulfilled`, `cancelled`), classée par `created_at` puis `id` décroissants ; `data: null` si le mandat n'a jamais eu de demande. Champs : `id`, `mandate_id`, `status`, `reason`, `requested_at`, `cancelled_at`, `decided_at`, `decision_note`. Le client déduit « demande vivante » de `status = pending`.
- L'espace propriétaire garde la demande vivante seule (`pending`) et lit une Resource distincte, sans `decision_note` : la note de l'agence ne sort jamais vers le mandant.
