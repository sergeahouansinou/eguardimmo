# ADR 0017 — MySQL et intégrité en base

Statut : accepté (2026-11-15) pour le moteur, décision de l'utilisateur. Règles d'intégrité : proposées. Complète l'ADR 0006 (cloisonnement) et l'ADR 0015 (UUID).

## Contexte

Aucun ADR ne fixait le moteur de production. Le développement et les tests tournent sur SQLite ; l'ADR 0015 et l'ADR 0016 décrivent PostgreSQL, MySQL et SQLite. L'ancienne base à reprendre est en MySQL (ADR 0009).

L'audit du modèle de données (2026-11-15) relève aussi que l'appartenance d'une ligne enfant à l'organisation de son parent n'est garantie que par le code.

## Décision

### Moteur
- **MySQL 8.4 LTS**, InnoDB, `utf8mb4` et `utf8mb4_0900_ai_ci`.
- `sql_mode` strict (`STRICT_ALL_TABLES`, `ONLY_FULL_GROUP_BY`, `NO_ZERO_DATE`), `time_zone = '+00:00'`.
- Les tests d'intégration tournent sur MySQL 8.4 (conteneur, Colima en local). SQLite reste toléré pour les tests unitaires sans requête.

### Types
- UUID (ADR 0015) : `char(36)` en `ascii` et `ascii_bin`. En `utf8mb4` chaque clé occuperait 144 octets dans chaque index au lieu de 36.
- Horodatages : `datetime(6)` en UTC (`datetimes()`, `dateTime(precision: 6)`), jamais `timestamp`, limité à 2038. Les durées de conservation (10 ans en comptabilité) dépassent cette borne.
- Montants : `bigint` en unités mineures et `char(3)` pour la devise. Quotes-parts : entier en points de base. Taux de taxe : entier en cent-millièmes (`pcm`, 100 000 = 100 %), la TVQ de 9,975 % ne s'écrivant pas en points de base (amendement du 2026-11-18, ADR 0028).
- Statuts : `varchar` avec contrainte `CHECK` (appliquée depuis MySQL 8.0.16), jamais le type `ENUM`, dont l'évolution réécrit la table.
- Données semi-structurées : type `JSON` (ADR 0018), jamais pour un montant, une date d'échéance ou un statut.

### Intégrité entre organisations
- `organization_id` sur toutes les tables métier, tables enfants comprises.
- Dans un module, le parent porte `UNIQUE (organization_id, id)` et l'enfant une clé étrangère composite `(organization_id, parent_id)`. Un enfant ne peut plus pointer vers le parent d'une autre organisation, quel que soit le chemin d'écriture.
- Entre modules, la règle de l'ADR 0001 ne change pas : référence par UUID sans clé étrangère, contrôle par la PublicApi du module cible.

### Invariants sans contrainte native
MySQL n'a ni contrainte d'exclusion, ni contrainte différée, ni sécurité au niveau des lignes. Chacun de ces invariants est porté par une Action unique, sous verrou, et vérifié par une tâche de rattrapage :
- deux baux actifs ne se chevauchent pas sur un même lot : `SELECT … FOR UPDATE` sur les occupations du lot avant l'écriture ;
- une écriture comptable est équilibrée : contrôle avant validation de la transaction dans le seul service d'écriture d'Accounting, plus un contrôle quotidien ;
- le filtre par organisation : portée globale `BelongsToOrganization`, tests d'accès croisé par endpoint (ADR 0006) et test d'architecture interdisant `withoutGlobalScopes` hors `Queries/`.

### Journal
- `audit_logs` reste non partitionné au démarrage. MySQL interdit les clés étrangères sur une table partitionnée et impose la clé de partition dans la clé primaire : un partitionnement par année se fera à la première alerte de volume, avec une clé primaire `(id, occurred_at)`.
- MySQL ne déclenche rien sur `TRUNCATE` : l'immutabilité repose sur les déclencheurs `BEFORE UPDATE` et `BEFORE DELETE` et sur le compte SQL de l'application, limité à `INSERT` et `SELECT` sur cette table (ADR 0016).

## Options écartées

- **PostgreSQL** : `jsonb` indexable, contraintes d'exclusion et différées, sécurité au niveau des lignes. Écarté par l'utilisateur. Les invariants concernés passent par le code ci-dessus.
- **SQLite en production** : un seul écrivain, pas de verrou de ligne.
- **UUID en `binary(16)`** : index plus compacts, mais conversions dans chaque requête, lecture impossible en console SQL, et contraire aux conventions Laravel adoptées par l'ADR 0015.

## Conséquences

- Les migrations Identity existantes utilisent `timestamp` et l'UUID en `utf8mb4` : à corriger avant le premier déploiement, sans coût de données puisque rien n'est déployé.
- `phpunit.xml` et l'intégration continue passent les tests d'intégration sur MySQL.
- Une base vide se recrée par `php artisan migrate:fresh` après ces corrections.

## Amendement du 2026-11-21 (ADR 0037)

- `operators` en `datetime(6)`. Déclencheurs d'ajout seul sur `privacy_request_events` et `backup_reports` (mise à jour interdite), d'immuabilité des versions publiées (`plan_versions`, `plan_prices`, `plan_entitlements`), des demandes RGPD closes et des transmissions traitées.
- Colonnes générées uniques pour « une demande vivante » : `operator_approvals`, `privacy_requests`, `plan_versions` (un brouillon par plan). Vérifiées sous SQLite ; à vérifier sous MySQL avant la mise en production.
