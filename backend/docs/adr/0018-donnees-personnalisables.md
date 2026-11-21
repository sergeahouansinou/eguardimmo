# ADR 0018 — Données personnalisables

Statut : accepté (2026-11-15). Amende l'ADR 0001 et l'ADR 0005 (nouveau module Catalog, clé étrangère admise vers ses référentiels) et l'ADR 0013 (droits des plans). Moteur : ADR 0017.
Amendement accepté (2026-11-19, ADR 0034) : vocabulaire de plateforme `charge_rubric` (une valeur par rubrique du décret n° 87-713, ni extensible ni personnalisable) ; métadonnée `recoverable_by_default` sur `expense_category`.

## Contexte

Le modèle de données proposé fige plus de 60 listes dans le schéma (types de lots, catégories de dépenses, de documents, de contacts, familles d'équipements…) et n'offre aucun champ libre. Chaque demande d'un client (catégorie « Ramonage », numéro de place de parking, code du portail) deviendrait une migration et une version.

Une liberté totale casse en revanche la fiscalité, les quittances et les rapports, qui doivent savoir ce que signifie chaque valeur.

## Décision

### Frontière
- **Personnalisable par l'organisation** : valeurs des référentiels, champs supplémentaires, étiquettes, étapes des procédures (ADR 0021), composantes du loyer (ADR 0020), modèles de courriers et d'états des lieux, réglages.
- **Jamais personnalisable** : montants, devises, écritures, statuts légaux et machines à états, numérotation des pièces émises, preuves de signature, journal d'audit, règles des juridictions, droits des plans.

### Référentiels (`terms`)
- Un vocabulaire est déclaré en code (clé, sens admis, extensible ou non, hiérarchique ou non). Ses valeurs sont en base dans `terms` : `organization_id` nul pour une valeur fournie par la plateforme, renseigné pour une valeur ajoutée par l'organisation.
- Colonnes : `vocabulary`, `key` (stable, jamais renommée), `labels` (JSON par langue), `semantic_key`, `parent_id`, `position`, `metadata` (JSON, schéma déclaré par le vocabulaire), `is_system`, `archived_at`. Unicité `(organization_id, vocabulary, key)`.
- **Toute valeur d'un vocabulaire qui pilote un comportement porte un `semantic_key`** parmi ceux que le code connaît. « Ramonage » ajouté par une agence se rattache à `expense.maintenance` : la déclaration fiscale le classe sans code nouveau.
- L'organisation renomme, masque ou réordonne une valeur de la plateforme par `term_overrides`, sans toucher la ligne d'origine.
- Une valeur utilisée s'archive, elle ne se supprime pas.
- Une table métier référence une valeur par `{nom}_term_id`. **C'est la deuxième clé étrangère inter-modules admise sans nouvel ADR**, après `organization_id` : la table est un référentiel stable dont aucune ligne ne disparaît. L'Action vérifie que la valeur appartient au bon vocabulaire et que son organisation est nulle ou celle du contexte.

### Champs personnalisés
- `custom_field_definitions` par organisation et par type d'objet : `entity`, `key` (immuable), `labels`, `type` (`text`, `number`, `money`, `date`, `bool`, `select`, `multiselect`, `term`, `url`), `options`, `required`, `position`, `archived_at`.
- Valeurs dans une colonne `custom_fields` (JSON, `{}` par défaut) sur chaque table extensible, validées côté serveur contre les définitions actives. Tables extensibles au départ : lots, sites, parties, baux, mandats, équipements, interventions.
- Le type d'un champ ne change plus dès qu'une valeur existe. Archiver une définition masque le champ sans effacer les valeurs. Un montant personnalisé est stocké en unités mineures avec sa devise.
- **Aucune règle métier ne lit un champ personnalisé.** Ce qui sert au calcul devient une colonne par une migration.
- Filtre sur un champ personnalisé : `JSON_EXTRACT` sur les lignes de l'organisation, déjà réduites par l'index `organization_id`. Si une mesure montre un besoin, une table de projection typée (`custom_field_index`) s'ajoute ; la colonne JSON reste la source.

### Étiquettes
- `tags` et `taggings` (polymorphe, morph map) : étiquettes libres par organisation sur tout objet extensible.

### Réglages
- Table `settings` dans `app/Shared` : `scope_type` (`platform`, `organization`, `membership`, `user`), `scope_id`, `key`, `value` (JSON). Chaque module déclare ses clés dans son ServiceProvider (type, défaut, validation, portées admises). Une clé non déclarée est refusée.
- Remplace les tables de réglages et de préférences de notification à colonnes fixes.

### Droits des plans (amende l'ADR 0013)
- `plan_entitlements` : une ligne par droit et par version de plan (`feature_key`, `enabled`, `limit_value`, nul pour illimité), à la place des colonnes `max_*`.
- `organization_entitlement_overrides` pour une dérogation commerciale accordée par la console : datée, motivée, journalisée.
- Le registre des modules est du code. La base ne garde que l'activation par organisation.

### Module Catalog
Nouveau module du socle : référentiels, surcharges, définitions de champs personnalisés, étiquettes. Tout module peut l'appeler par sa PublicApi.

## Options écartées

- **EAV généralisé** (une ligne par attribut et par valeur) : requêtes illisibles, aucun typage, exports lents.
- **Tables ou schémas créés par le client** : migrations, sauvegardes et tests impossibles à maintenir.
- **Listes en enum PHP pour tout** : chaque catégorie client demande une version.
- **Valeurs libres sans sens système** : la fiscalité et les rapports ne savent plus classer.
- **Une table de référentiel par liste** : vingt tables identiques, vingt écrans d'administration.

## Conséquences

- Le modèle de données remplace ses colonnes `kind`, `type`, `category` et `family` à valeurs fixes par des `{nom}_term_id`, sauf pour les statuts.
- Un seeder idempotent fournit les valeurs de la plateforme par juridiction ; un test vérifie que chaque `semantic_key` utilisé par le code existe.
- Les exports et la recherche lisent les définitions des champs personnalisés.

## Amendement du 2026-11-20 (ADR 0040)

- Écart assumé : les conditions par défaut des mandats forment un modèle de conditions typé dans Mandates (`mandate_term_defaults`), pas un réglage personnalisable. Écart existant signalé, non traité ici : `accounting_settings` reste un réglage à colonnes fixes.

## Amendement du 2026-11-21 (ADR 0037)

- `organization_entitlement_overrides` (fonction, activé, limite, début, fin d'au plus 12 mois, motif de la liste fermée) sont créées et retirées par double validation ; elles ne modifient jamais le plan publié.
