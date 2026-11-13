# ADR 0001 — Monolithe modulaire par contexte métier

Statut : accepté (2026-11-13). Liste des modules : ADR 0005. Cloisonnement : ADR 0006. Flux financiers et événements : ADR 0007. Règles par pays : ADR 0008.

## Contexte

Refonte d'eGuardImmo : l'application doit rester maintenable, et le code produit en grande partie par des agents IA ne doit pas dériver. Les retours de la communauté Laravel en 2026 convergent vers le monolithe modulaire, avec des frontières vérifiées en CI.

## Décision

- Un seul déploiement Laravel, découpé en modules `app/Modules/{Contexte}/`, créés par `php artisan make:module`.
- Structure d'un module : `Actions/`, `Data/`, `Enums/`, `Events/`, `Listeners/`, `Models/`, `Policies/`, `PublicApi/`, `Queries/` (lectures, dont les lectures inter-organisations), `Http/{Controllers,Requests,Resources}`, `Http/routes.php`, `Database/{Migrations,Factories}` et `{Contexte}ServiceProvider.php`. Au besoin, `Jurisdictions/{Pays}/` (ADR 0008).
- Flux : route → contrôleur mono-action → FormRequest → DTO → Action `final` (`handle()`) → Eloquent → API Resource.
- `ModuleServiceProvider` découvre les providers et les migrations des modules ; `routes/api.php` monte chaque `Http/routes.php` sous `/api/v1` ; `bootstrap/app.php` découvre les `Listeners/`.
- Les modèles et les couches internes sont privés au module. Les échanges entre modules passent par `PublicApi/` (classe `final` qui renvoie des DTO), `Events/`, `Data/` et `Enums/`. Exception : `Identity\Models\User`, modèle d'authentification.
- `app/Shared` : noyau technique sans dépendance vers les modules (premier élément : `MoneyCast`, montants en unités mineures avec moneyphp).
- Eloquent directement : pas de Repository ni d'interface ajoutée sans besoin démontré.
- `Relation::requireMorphMap()` est actif : chaque module déclare ses alias de morph.
- Garde-fous : Pest `arch()` (presets `php`, `security`, `strict` et règles par module), PHPStan niveau 8, Pint (`declare_strict_types`, `final_class`), `AGENTS.md`.

## Options écartées

- **Microservices, CQRS, event sourcing** : aucun besoin démontré, coût opérationnel élevé.
- **Couches techniques globales** (`app/Actions`, `app/Services`, layout Laravel par défaut) : l'ancien backend montre la dérive vers des fourre-tout.
- **nwidart/laravel-modules** : dépendance lourde (modules comme paquets, manifestes) pour un besoin couvert par environ 30 lignes de provider.
- **Preset `laravel` de Pest** : il impose `App\Models`, `App\Http`… et ne s'applique donc pas à des modules ; ses règles sont reprises module par module dans `tests/Architecture/ArchTest.php`.
- **Deptrac** : un outil et une configuration de plus, alors que Pest `arch()` couvre le besoin dans la suite de tests existante.

## Conséquences

- Un contexte s'extrait ou se supprime avec son dossier.
- Une clé étrangère SQL vers la table d'un autre module demande un ADR : c'est le premier couplage qui fissure un monolithe modulaire. Seule exception admise : `organization_id` (ADR 0006).
- Les tests Pest ne passent pas par PHPStan (syntaxe dynamique) ; ils sont couverts par Pest lui-même.
