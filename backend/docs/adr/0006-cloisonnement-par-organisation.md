# ADR 0006 — Cloisonnement par organisation

Statut : accepté (2026-11-13). Remplace le « base unique + agency_id » de l'ADR 0002/0003.

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
