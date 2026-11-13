# ADR 0015 — Identifiants UUID v7

Statut : accepté (2026-11-13). S'applique à toutes les tables applicatives (modules et `app/Shared`).

## Contexte

Le socle Identity utilisait des identifiants entiers auto-incrémentés. Ces identifiants posent trois problèmes :
- ils se devinent et s'énumèrent dans les URL (`/me/devices/12`) ;
- ils révèlent des volumes (nombre de comptes, de baux) ;
- ils collisionnent quand des lignes de plusieurs sources sont fusionnées. C'est le cas de la reprise de l'ancienne base (ADR 0009) et d'éventuelles créations hors ligne côté mobile.

Décision de l'utilisateur le 2026-11-13 : des UUID partout à la place des entiers.

## Décision

- Toute clé primaire applicative est un **UUID v7**, généré par l'application avec le trait Laravel `HasUuids` (`Str::uuid7()`). Le v7 est ordonné dans le temps : les index B-tree restent compacts et le tri par identifiant suit l'ordre de création.
- Migrations :
  - `$table->uuid('id')->primary()` pour la clé ;
  - `foreignUuid()` pour les clés étrangères ;
  - `uuidMorphs()` ou `nullableUuidMorphs()` pour les relations polymorphes.

  Sur PostgreSQL la colonne est native (`uuid`) ; sur MySQL et SQLite elle est en `char(36)`.
- Les jetons Sanctum utilisent `Identity\Models\PersonalAccessToken` (UUID). Le jeton en clair reste au format `{id}|{secret}`.
- Routes : `whereUuid('param')` pour tout identifiant d'URL. Un identifiant mal formé répond 404, et non 500.
- Typage PHP : un identifiant est une `string`, jamais un `int`.
- Les tables techniques du framework (`cache`, `jobs`, `job_batches`, `failed_jobs`, `sessions.id`) restent telles que Laravel les crée. `sessions.user_id` passe en UUID.
- Vérifié par `ArchTest.php` : tout modèle d'un module utilise `HasUuids`.

## Options écartées

- **Entiers auto-incrémentés** : énumérables, et ils fuient des volumes. Écartés par l'utilisateur.
- **Entier interne et UUID public** (deux colonnes) : jointures plus rapides, mais double vocabulaire dans le code et risque de fuite de l'entier. Le gain de performance n'est pas démontré au volume visé.
- **UUID v4** : aléatoire, il fragmente les index et rend le tri par identifiant inutile.
- **ULID** : propriétés proches du v7, mais hors norme RFC 9562 et non natif dans PostgreSQL.

## Conséquences

- La base de dev doit être recréée une fois : `php artisan migrate:fresh`. Rien n'est déployé, aucune donnée réelle n'est concernée.
- La reprise (ADR 0009) conserve l'ancien identifiant entier dans une colonne `legacy_id` indexée pour les correspondances. Il ne sert jamais de clé.
- `CurrentOrganization` et `organization_id` (ADR 0006) sont des UUID.
- Les clients (web, mobile, console) traitent les identifiants comme des chaînes opaques.
