# ADR 0006 — Cloisonnement par organisation

Statut : accepté (2026-11-13). Remplace le « base unique + agency_id » de l'ADR 0002/0003.
Amendement (2026-11-16, ADR 0024) : la lecture locataire inter-organisations (`Leases\Queries\TenantLeases`) a pour clé le couple (organisation, partie) rattaché au compte, jamais un identifiant du client ; la résolution du détail se fait ensuite sous `CurrentOrganization::run()`, une fois par organisation. Un bail hors de cette clé répond 404, comme un bail inconnu.

## Contexte

L'ancienne application cloisonnait par `agency_id`, vérifié contrôleur par contrôleur. Trois failles en sont sorties : création de mandat sans garde d'agence, messagerie, biens propres d'agence invisibles. Le bailleur autonome n'avait pas de place claire et a été ajouté après coup (`agencies.kind`).

## Décision

### L'organisation
- Toute donnée métier appartient à une **organisation** (module Organizations) : une agence (`kind = agency`) ou un bailleur autonome (`kind = individual`).
- Un propriétaire qui s'inscrit seul crée une organisation `individual` dont il est l'administrateur. Côté serveur, il gère par l'espace organisation, comme une agence ; côté interface, depuis l'application Propriétaire (ADR 0010).
- Les biens qu'un propriétaire confie à une agence appartiennent à l'organisation de l'agence ; il les consulte par l'espace propriétaire (ADR 0003).
- Une organisation `individual` n'a qu'un membre et n'accède pas aux fonctions d'agence : mandats, honoraires, carte professionnelle, registre des mandats. Ce refus est contrôlé par l'API (policy sur le type d'organisation), pas seulement masqué dans l'interface.

### Le mécanisme (refus par défaut)
- Chaque table métier porte `organization_id` non nul. C'est la seule clé étrangère inter-modules admise sans nouvel ADR.
- Le contexte est porté par `App\Shared\Tenancy\CurrentOrganization` (une instance par requête ou par job). Seul le middleware de l'espace organisation le pose, après avoir vérifié l'appartenance de l'utilisateur à `{organization}`. Un job reçoit l'id de l'organisation et l'exécute dans `CurrentOrganization::run()`.
- Les modèles utilisent le trait `BelongsToOrganization` :
  - scope global filtrant sur l'organisation courante ;
  - **sans contexte, la requête lève une exception** au lieu de tout renvoyer ;
  - à la création, `organization_id` vient du contexte, jamais du client ;
  - `organization_id` ne se modifie jamais.
- Les lectures inter-organisations (espace locataire, espace propriétaire, Reporting de la console) passent par `AcrossOrganizations`, utilisable seulement dans les classes `Queries/` d'un module. Chacune de ces requêtes filtre sur la relation de l'utilisateur (partie au bail, mandant) et a ses tests d'accès croisé.

### Garde-fous automatiques (`tests/Architecture/ArchTest.php`)
- Tout modèle de module utilise `BelongsToOrganization`, sauf une liste explicite de modèles hors organisation (User, Organization, référentiels Geography…).
- `AcrossOrganizations` n'est utilisable que depuis `App\Modules\{M}\Queries\` et les tests.

## Options écartées

- **Vérification dans chaque contrôleur ou policy seule** : c'est le modèle qui a produit les trois failles de l'ancien projet.
- **Une base par organisation** (stancl/tenancy multi-base) : migrations ×N, rapports transverses impossibles, et un locataire ou un propriétaire voit plusieurs organisations.
- **Scope global qui renvoie tout sans contexte** : une commande ou un job oublié lirait toutes les organisations sans erreur.
- **`agency_id`** : le nom excluait le bailleur autonome.

## Conséquences

- Les seeders, commandes et jobs doivent poser le contexte ; sinon ils échouent, ce qui est voulu.
- Chaque endpoint de l'espace organisation a un test : la ressource d'une autre organisation renvoie 404.
- Implémenté dans `app/Shared/Tenancy/` ; tests dans `tests/Feature/Shared/TenancyTest.php`.

## Amendement du 2026-11-20 (ADR 0036)

- Les lectures `AcrossOrganizations` des espaces locataire de Leases, Inspections, Payments et Parties vivent uniquement dans leurs `Queries/` et passent par la clé de l'ADR 0024 (`tenantStanding` pour les écritures) ; hors clé, la ressource est introuvable (404). Les relations d'un modèle lu hors organisation ne se chargent pas par `with()` : elles se rattachent à la main sous le contexte de l'organisation concernée.
- `EmailChangeRequest` (compte, sans organisation) et `PaymentProviderEvent` (webhook reçu avant toute résolution d'organisation) rejoignent la liste des modèles hors organisation de `ArchTest`.

## Amendement du 2026-11-21 (ADR 0037)

- Modèles hors organisation : `OperatorApproval`, `ScheduledTaskRun`, `BackupReport`, `PrivacyRequest`, `PrivacyRequestEvent`, `Plan`, `PlanVersion`, `PlanPrice`, `PlanEntitlement`. `PrivacyRequestForward`, `Subscription` et `OrganizationEntitlementOverride` portent `organization_id`.
- Les lectures de la console passent par `AcrossOrganizations` dans les `Queries/` d'Organizations, Subscriptions et Privacy, en comptes ou en champs minimaux, jamais en secret, IBAN ni pièce d'identité.

## Amendement du 2026-11-21 (ADR 0039)

- `Tax\Queries\OwnerTaxStatements` lit en `AcrossOrganizations`, restreint par la clé `ownerScope` (organisation, mandant) ; c'est le seul accès inter-organisations de l'ADR 0039. Les vues financières de Reporting restent dans l'organisation courante (`BelongsToOrganization`, `Reading`).
