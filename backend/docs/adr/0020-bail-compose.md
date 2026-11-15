# ADR 0020 — Bail composé et échéances en lignes

Statut : accepté (2026-11-15). Amende l'ADR 0007 (échéancier) et l'ADR 0008 (données de juridiction). Parties : ADR 0019. Référentiels : ADR 0018. Invariants sous verrou : ADR 0017.

## Contexte

Le modèle de données proposé rattache un bail à un seul lot et porte le loyer et la provision en deux colonnes. Il ne sait pas louer un appartement et son parking ensemble, ajouter un complément de loyer, facturer au trimestre, suivre une colocation dont un colocataire part, ni réviser un loyer sans réécrire l'historique. Des colonnes propres au droit français (`rent_control`, `revision_index`, `furnished`) contredisent l'ADR 0008.

## Décision

### Patrimoine (Properties)
- `properties` (site : immeuble, maison, ensemble) et `units` (lot louable). Une maison est un site à un seul lot.
- `units.parent_unit_id` pour une annexe (cave, parking rattaché).
- Type de lot par référentiel ; caractéristiques non utilisées par le calcul en `characteristics` (JSON validé par type de lot et juridiction).
- Aucun statut « loué » ou « vacant » stocké : il se déduit des baux.

### Bail (Leases)
- `leases` : référence, `regime_key` (régime légal déclaré par la juridiction, par exemple `fr.residential.furnished`), statut, dates, jour d'échéance, périodicité, `jurisdiction_data` (JSON validé par le schéma du régime), `custom_fields`, `lock_version`.
- `lease_units` : un bail couvre un ou plusieurs lots, avec le lot principal et la période d'occupation. Deux baux actifs ne se chevauchent pas sur un lot : vérifié sous verrou par l'Action (ADR 0017).
- `lease_parties` : locataires, colocataires, garants et occupants, avec rôle, solidarité et période. Le départ d'un colocataire ferme sa ligne.
- `lease_terms` : une ligne par composante et par période de validité (`component_term_id`, montant, devise, TVA en points de base, indexée ou non, `valid_from`, `valid_to`, motif). Composantes par référentiel avec sens système : `rent`, `charges_provision`, `charges_flat`, `rent_supplement`, `deposit`, `tax_recoverable`. Une révision ferme une ligne et en ouvre une ; le loyer à une date est la somme des lignes valides.
- Avenants : même mécanisme, `mandate_terms` pour le mandat. Les tables d'avenants à valeurs « avant » et « après » en texte disparaissent ; l'historique se lit dans le journal (ADR 0016).

### Échéances (Rent, amende l'ADR 0007)
- `installments` : période (début, fin), date d'échéance, état. Clé unique `(lease_id, period_start)` pour l'idempotence.
- `installment_lines` : une ligne par composante appelée, avec le libellé et le montant figés. Une proratisation, une régularisation ou un arriéré est une ligne.
- Les soldes restent dans le grand livre ; les lignes décrivent ce qui est appelé, pas ce qui est payé.

## Options écartées

- **Colonnes par composante** (`rent`, `charges`, `parking`…) : une migration par nouvelle composante et par pays.
- **Composantes en JSON sur le bail** : montants non contraints, aucun historique de révision.
- **Un bail par lot** pour l'appartement et son parking : deux quittances, deux dépôts, un préavis qui doit viser deux baux.

## Conséquences

- Rent génère les échéances depuis les `lease_terms` valides sur la période.
- La révision d'indice devient une Action qui ferme et ouvre des lignes ; la juridiction fournit l'indice et la règle.
- Les écrans de bail affichent le loyer « actuel » calculé, et l'historique des composantes.
