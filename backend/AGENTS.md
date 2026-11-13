# eGuardImmo — backend (refonte)

API REST Laravel **13**, PHP **8.4**, Sanctum, Pest 5, PHPStan (Larastan) niveau 8, Pint.
Laravel 11+ : middleware, routes et événements se déclarent dans `bootstrap/app.php`. Il n'y a ni `Kernel.php` ni `RouteServiceProvider` : n'en crée pas.

Décisions d'architecture : [docs/adr/](docs/adr/). Socle : [0001](docs/adr/0001-monolithe-modulaire.md). Liste des modules et liens autorisés : [0005](docs/adr/0005-decoupage-des-modules.md). Avant de créer un module ou un lien entre modules, lire 0005.

## Commandes

```bash
composer check               # pint --test + phpstan + pest : obligatoire avant de rendre la main
composer lint:fix            # formate avec Pint
php artisan test --testsuite=Architecture
php artisan make:module Leases   # squelette d'un nouveau module, toujours via cette commande
```

## Où mettre quoi

| Besoin | Emplacement |
|---|---|
| Nouveau contexte métier | `php artisan make:module {Nom}`, jamais à la main |
| Opération métier | `app/Modules/{M}/Actions/{Verbe}{Nom}.php` : classe `final`, méthode `handle()`, dépendances `readonly`, transaction si plusieurs écritures |
| Entrée HTTP | `Http/Controllers/{Nom}Controller.php` : mono-action `__invoke`, aucune logique métier |
| Validation | `Http/Requests/{Nom}Request.php` : `rules()` en liste blanche, `authorize()`, `toData()` qui construit le DTO |
| Sortie JSON | `Http/Resources/{Nom}Resource.php`. Ne jamais renvoyer un modèle brut |
| Routes | `Http/routes.php` du module, montées automatiquement sous `/api/v1`. Chaque route a `auth:sanctum` et un nom préfixé par le module (`leases.show`). Une route publique s'ajoute explicitement dans `ROUTES_PUBLIQUES` de `tests/Feature/RoutesTest.php` |
| DTO | `Data/` : classe `final readonly` |
| Autorisation | `Policies/{Modèle}Policy.php`, liée au modèle par `#[UsePolicy]` |
| Modèle Eloquent | `Models/`, factory liée par `#[UseFactory]` dans `Database/Factories/` |
| Migrations | `php artisan make:migration create_x_table --path=app/Modules/{M}/Database/Migrations`. Sans `--path`, le fichier part dans `database/migrations`, réservé au framework (cache, jobs) |
| Effets de bord inter-modules | Event dans `Events/` ; le module consommateur l'écoute dans ses `Listeners/` (découverte automatique) |
| Lecture par un autre module | `PublicApi/` : classe `final` qui renvoie des DTO, jamais de modèle |
| Lecture pour un espace | `Queries/` : seul endroit où `AcrossOrganizations` est permis (espaces locataire, propriétaire, console) |
| Règle qui dépend du pays | `Jurisdictions/Eu/` (commun UE), `Jurisdictions/{Pays}/` (`Fr`, `Be`, `Lu`, `Ca`), `Jurisdictions/{Pays}/{Subdivision}/` (`Be/Bru`, `Be/Wal`, `Ca/Qc`), derrière un contrat du module. Le bail suit le lieu du bien, la facturation le siège de l'organisation. Pays choisi à la création parmi le registre des juridictions complètes ; jamais de `if ($pays === …)`, jamais de repli ([ADR 0008](docs/adr/0008-juridictions.md)) |
| Modèle métier | trait `App\Shared\Tenancy\BelongsToOrganization` + colonne `organization_id` ; un modèle hors organisation s'ajoute explicitement à la liste de `ArchTest.php` |
| Polymorphisme | morph map déclarée dans le `{M}ServiceProvider` (`Relation::requireMorphMap()` est actif) |
| Montants | `Money\Money` (moneyphp) + `App\Shared\Money\MoneyCast` : entier en unités mineures + colonne devise ISO 4217 vérifiée. Jamais de `float` ; XOF n'a pas de décimales. Dans une Resource, sérialiser explicitement `{amount, currency}` |

## Frontières (vérifiées par `tests/Architecture/ArchTest.php`)

- Un module n'importe jamais les `Actions`, `Http`, `Policies`, `Database`, `Listeners` ni `Models` d'un autre module. Exception : `Identity\Models\User`, modèle d'authentification.
- Depuis un autre module, seuls sont autorisés : `PublicApi`, `Data`, `Enums`, `Events`. Tout autre dossier (y compris un nouveau `Services/`, `Jobs/`…) est privé, et ces quatre dossiers n'exposent jamais un modèle.
- `app/Shared` ne dépend d'aucun module.
- Pas de clé étrangère SQL vers la table d'un autre module sans ADR (exception : `organization_id`).
- Pas de lien entre modules absent de l'ADR 0005, pas de cycle. Reporting lit en SQL sans importer de modèle et n'écrit jamais.

## Cloisonnement ([ADR 0006](docs/adr/0006-cloisonnement-par-organisation.md))

- Toute donnée métier appartient à une organisation (agence ou bailleur autonome). Le contexte est posé par `space:organization`, ou par `CurrentOrganization::run()` dans un job, une commande ou un seeder.
- Sans contexte, une requête sur un modèle métier lève une exception : c'est voulu, ne pas le contourner.
- `organization_id` ne vient jamais du client et ne se modifie jamais.

## Normes ([ADR 0011](docs/adr/0011-normes-france-et-europe.md))

- Référence : France et Union européenne ; repères Belgique, Luxembourg et Québec dans l'ADR 0011, à vérifier avant chaque module. Facture électronique via plateforme agréée, horodatage via prestataire qualifié eIDAS, encaissement via PSP : jamais de version maison.
- Signature : solution hybride (ADR 0011) — parcours et journal de preuve dans Documents, scellement PAdES par un service pyHanko ou DSS (jamais une bibliothèque PHP), horodatage qualifié externe ; signature qualifiée via prestataire en option.
- Avant un module listé dans l'ADR 0011, vérifier le texte officiel en vigueur.

## Argent et événements ([ADR 0007](docs/adr/0007-flux-financiers-et-evenements.md))

- Le grand livre (Accounting) est la seule source des soldes. Une écriture financière passe par sa PublicApi dans la transaction de l'appelant.
- Tout événement implémente `ShouldDispatchAfterCommit` (vérifié par `ArchTest.php`).
- Un listener qui touche à l'argent est en file, idempotent (clé unique en base) et doublé d'une tâche planifiée de rattrapage.
- Webhook de paiement : signature vérifiée, idempotence sur la référence du fournisseur.
- Ne jamais affaiblir ni contourner une règle d'architecture pour faire passer la suite : si une règle bloque un vrai besoin, il faut un ADR.

## Espaces ([ADR 0003](docs/adr/0003-espaces-et-profils.md))

- Un compte, plusieurs profils. Espaces : `/api/v1/tenant`, `/owner` (mandants, consultation), `/org/{organization}` (organisations `agency` depuis l'app Agence, `individual` depuis l'app Propriétaire), `/marketplace` (SeBook : lectures publiques listées, actions avec compte vérifié), `/console` (jeton opérateur uniquement), chacun avec son middleware `space:*`.
- Contrôleurs fins rangés par espace dans le module : `Http/Controllers/{Tenant,Owner,Organization,Console}/`. Ils partagent Actions et `Queries/` ; chaque espace a ses Resources.
- Le rôle opérateur ne se code jamais en dur (pas d'adresse e-mail dans le code).

## Sécurité API ([ADR 0002](docs/adr/0002-securite-api.md))

- Applications web d'espace (`apps/locataire`, `apps/proprietaire`, `apps/agence`, `apps/sebook`, ADR 0010) : session Sanctum en cookie (SPA). Console : jeton opérateur détenu par son serveur (ADR 0004). Mobile : jeton Sanctum, 30 jours. Aucun jeton dans le navigateur.
- Toute route d'authentification (login, OTP, mot de passe oublié, inscription) porte `throttle:auth`.
- Nouvelle variable de sécurité : l'ajouter d'abord dans `.env.example`.

## Règles de code

- `declare(strict_types=1)` et classes `final` partout (Pint et le preset strict de Pest l'imposent).
- Pas de Repository ni d'interface sans besoin démontré : Eloquent directement.
- Jamais d'affectation de masse depuis le client : `tenant`, `user_id`, `role`, prix et statut sont fixés côté serveur.
- Chaque route protégée a ses tests : 401 sans jeton, 403 sans droit, 403/404 sur la ressource d'un autre locataire.
- Tests en Pest dans `tests/Feature/{Module}/`, chemin nominal compris.
- Aucun commentaire par défaut ; en français s'il en faut un.
