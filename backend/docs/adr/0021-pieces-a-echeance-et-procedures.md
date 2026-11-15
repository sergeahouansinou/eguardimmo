# ADR 0021 — Pièces à échéance et procédures configurables

Statut : accepté (2026-11-15). Référentiels : ADR 0018. Historique : ADR 0016.

## Contexte

Le modèle de données proposé consacre une table à chaque pièce valable jusqu'à une date (diagnostics, carte professionnelle, garantie financière, responsabilité civile, assurance habitation, justificatifs fiscaux) et code en dur les étapes des procédures (sortie du locataire, conformité). Un nouveau type de pièce (contrôle d'ascenseur, entretien de chaudière) ou une étape propre à une agence demanderait une migration.

## Décision

### Pièces à échéance (Documents)
- `certificates` : objet concerné (polymorphe : organisation, lot, partie, équipement, bail), type par référentiel `certificate_type`, référence, émetteur (partie), date d'émission, date d'échéance, `data` (JSON validé par le schéma du type), document, `replaces_id`.
- Le type porte la durée par défaut, le délai de rappel, la durée de conservation et le schéma de `data` (classe énergie pour un DPE, montant garanti pour une garantie financière). Un type qui pilote une règle (DPE et interdiction de louer, carte professionnelle) a un `semantic_key`.
- Le renouvellement crée une pièce qui remplace la précédente : l'historique reste.
- L'état (valide, à renouveler, expiré) se calcule depuis les dates ; il n'est pas stocké.

### Rappels (Notifications)
- `reminders` : objet concerné, date, canal, destinataires, envoi, abandon. Sert aux pièces à échéance, aux tâches, aux plans d'entretien et aux procédures.

### Procédures configurables
- `checklist_templates` par organisation et par contexte (`lease_exit`, `lease_entry`, `recovery`, `compliance`), versionnés.
- `checklist_template_items` : clé, libellés, obligatoire, `system_step`, décalage en jours, position.
- `checklist_items` : étapes instanciées sur un objet, avec statut, échéance, auteur et date de réalisation.
- Une étape portant un `system_step` (par exemple `deposit_settlement`) déclenche le code correspondant et ne peut être retirée. Les autres sont libres.
- Même mécanisme pour les étapes de pipeline (candidatures, interventions) : chaque étape personnalisée se rattache à un état système.

## Options écartées

- **Une table par type de pièce** (modèle initial) : sept tables pour un même besoin, une migration par nouveau type.
- **Étapes en dur dans le code** : aucune agence ne suit la même procédure de sortie.
- **Étapes entièrement libres** : la restitution du dépôt et la clôture du bail ont des effets comptables et légaux qui ne peuvent pas disparaître.

## Conséquences

- `diagnostics`, `professional_cards`, `financial_guarantees`, `liability_insurances`, `home_insurances` et `supporting_documents` du modèle proposé disparaissent.
- L'écran Conformité de l'agence lit les pièces de type conformité de l'organisation.
