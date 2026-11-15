# ADR 0005 — Découpage des modules métier

Statut : accepté (2026-11-13). Complète l'ADR 0001. Cloisonnement : ADR 0006. Flux financiers : ADR 0007.
Amendements proposés (2026-11-15) : module Catalog et clé étrangère vers ses référentiels (ADR 0018), module Parties et ses dépendances (ADR 0019).
Amendements acceptés (2026-11-15) : Messaging → Identity (annuaire des opérateurs) et Messaging → Organizations (appartenance, équipe) ; Recovery → Accounting, Documents, Parties, Leases et Recovery ⇢ RecoveryBundleSent ⇢ Notifications (ADR 0023). Les demandes d'assistance (support) sont des données de plateforme, hors organisation, rattachées au besoin à l'organisation du demandeur.

## Contexte

L'ancienne API compte 55 contextes dans `api/app/Immo`. Une première proposition les regroupait en 13 modules. La revue a relevé des modules fourre-tout (Leases, Billing, Marketplace), un abonnement placé à deux endroits et des capacités sans propriétaire (preuve documentaire, invitations, lectures transverses).

Règle de découpe : on sépare quand le **cycle de vie** ou l'**obligation légale** diffère, pas pour multiplier les modules.

## Décision

21 modules, plus `app/Shared` (technique, sans métier).

| Famille | Module | Responsabilité | Reprend de l'ancienne API |
|---|---|---|---|
| Socle | Identity | comptes, connexion, 2FA, profils, opérateurs | Users, Roles, Privileges |
| Socle | Organizations | agences et bailleurs autonomes, membres, rôles, invitations, carte professionnelle et garantie financière | Agencies, AgencyUsers, Collaborators |
| Socle | Geography | pays, départements, communes, adresses | Countries, Departments, Cities, Communes, Addresses |
| Socle | Documents | stockage probant, parcours de signature et journal de preuve (ADR 0011), scellement PAdES, horodatage qualifié, chaîne de hash | Signatures, Seals |
| Gestion | Properties | biens, unités, inventaire, médias | Properties, Inventory, Videos |
| Gestion | Mandates | mandats de gestion propriétaire ↔ organisation, registre des mandats | Mandates |
| Gestion | Leases | baux, parties au bail, renouvellements | Leases, Tenants, Contracts, UserAnnounce |
| Gestion | Inspections | états des lieux d'entrée et de sortie | Inspections |
| Gestion | Rent | échéancier, avis d'échéance, quittances | Receipts |
| Gestion | Payments | encaissements via PSP (Stripe, prélèvement SEPA), webhooks, rapprochement ; ne détient jamais les fonds | Payments |
| Gestion | Invoicing | factures d'honoraires, avoirs, facture électronique et e-reporting via plateforme agréée (ADR 0011) | Invoices, CreditNotes |
| Gestion | Recovery | impayés, relances, frais de recouvrement | Recovery |
| Gestion | Accounting | grand livre (source de vérité des soldes), dépenses, régularisation de charges | Finance, Expenses, ChargeRegularization |
| Gestion | Tax | fiscalité du bailleur par juridiction (France d'abord), conformité | Fiscality, Compliance |
| Gestion | Maintenance | interventions, prestataires, demandes | Maintenance, ServiceRequests, Suppliers |
| Marché | Listings | annonces publiques de SeBook, favoris, prospects | Marketplace, Favorites, Leads, Adcards, UserRequests |
| Marché | Bookings | réservations courte durée sur SeBook, disponibilités, avis | Reservations, Reviews |
| Plateforme | Messaging | conversations temps réel | Messaging |
| Plateforme | Notifications | e-mail, push, campagnes | Notifications, Campaigns |
| Plateforme | Subscriptions | abonnement SaaS des organisations | Billing (si SaaS, à vérifier) |
| Plateforme | Reporting | tableaux de bord et exports, lecture seule | Reports, Analytics |

### Hors modules
- **Telemetry** : pas de module. Les erreurs vont dans un outil externe (choix ouvert : GlitchTip auto-hébergé ou Sentry).
- **À classer** après lecture de l'ancien code : Base, States, Tools, Workbench, Housekeeping, Shifts.

### Dépendances autorisées
Notation : `A → B` = A appelle la PublicApi de B ; `A ⇢ évt ⇢ B` = B écoute un événement de A.

- Organizations → Identity ; Subscriptions → Organizations
- Properties → Geography ; Mandates → Properties ; Leases → Properties, Mandates
- Rent, Invoicing → Accounting (même transaction, ADR 0007)
- Tax → Accounting ; Bookings → Listings
- Leases, Inspections, Rent, Invoicing → Documents
- Leases ⇢ BailSigné ⇢ Rent
- Payments ⇢ PaiementConfirmé ⇢ Rent, Bookings, Subscriptions
- Rent ⇢ AvisImpayé ⇢ Recovery
- Properties ⇢ BienPublié ⇢ Listings
- Leases, Rent, Recovery, Maintenance, Bookings ⇢ événements ⇢ Notifications

Tout nouveau lien entre modules s'ajoute ici. Un cycle (A → B et B → A) est refusé : on passe par un événement.

### Reporting, exception aux frontières
Reporting lit les tables des autres modules en SQL (query builder ou vues), sans importer leurs modèles, et n'écrit jamais. Les tableaux de bord agrègent plusieurs modules ; passer par cinq PublicApi produirait des N+1. Ses requêtes sont filtrées par organisation comme les autres (ADR 0006).

## Options écartées

- **13 modules** (première proposition) : Leases mêlait mandat, bail, état des lieux et signature ; Billing mêlait quittances réglementées, factures d'honoraires et passerelles de paiement ; l'abonnement apparaissait dans Agencies et Platform.
- **Paiements dans Rent** : Bookings et Subscriptions dépendraient de Rent pour encaisser.
- **Signature et scellement dans Shared** : c'est du métier (valeur probante, chaîne par organisation), pas de la technique.
- **Module Telemetry maison** : refaire un Sentry n'est pas le métier d'eGuardImmo.

## Conséquences

- Les modules se créent au fil des besoins par `php artisan make:module`, pas tous d'avance.
- La chaîne de hash de Documents s'ordonne par une séquence par organisation prise sous verrou, jamais par horodatage : l'ancienne chaîne, triée à la seconde, est invérifiable.
