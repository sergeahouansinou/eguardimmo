# ADR 0019 — Parties

Statut : accepté (2026-11-15). Amende l'ADR 0005 (nouveau module Parties). Personnalisation : ADR 0018.

## Contexte

Le modèle de données proposé décrit les personnes dans six tables (locataire, mandant, candidat, garant, prestataire, signataire) et en texte libre ailleurs (syndic, assureur, artisan). Conséquences : un candidat qui devient locataire est recopié, un garant qui loue à son tour est saisi deux fois, un IBAN existe en plusieurs exemplaires, et l'effacement RGPD doit se faire en six endroits.

## Décision

- Module **Parties** dans le socle. Une **partie** est une personne ou une société connue d'une organisation : `parties` (`kind`, nom, prénom, raison sociale, forme juridique par référentiel, date de naissance, adresse en JSON, langue, `user_id` facultatif, `custom_fields`, `lock_version`, `anonymized_at`, `archived_at`).
- Le compte de connexion reste dans Identity. `user_id` relie une partie au compte de la personne, sans clé étrangère.
- Données rattachées, chacune en lignes :
  - `party_identifiers` : `scheme` (`siren`, `siret`, `vat`, `neq`, `bce`, `rcs_lu`, pièce d'identité…), valeur chiffrée si elle est personnelle, pays ;
  - `contact_points` : e-mails et téléphones, avec le principal ;
  - `bank_accounts` : IBAN chiffré, quatre derniers chiffres, titulaire, période de validité. Un changement d'IBAN crée une ligne, il ne réécrit pas l'ancienne.
- **Le rôle naît de la relation**, pas d'une colonne : partie au bail (ADR 0020), propriétaire d'un lot, mandant d'un mandat, prestataire d'une intervention, signataire d'une demande de signature. Les catégories de contacts (artisan, syndic, assureur) sont un référentiel ou des étiquettes.
- Le candidat devient un **dossier de candidature** (`applications`, module Leases) qui pointe vers une partie.
- Propriété d'un lot : `unit_ownerships` (module Properties) avec quote-part en points de base, nature du droit (pleine propriété, nue-propriété, usufruit) et période. L'indivision et le démembrement se décrivent sans exception.
- **Effacement RGPD** : la partie est anonymisée (nom, coordonnées, identifiants, IBAN effacés ; `anonymized_at` posé). Les écritures, quittances et factures restent intactes grâce à leur instantané (ADR 0022). Parties écoute `Identity\Events\AccountDeleted`.

## Dépendances (amende l'ADR 0005)
- Properties, Mandates, Leases, Maintenance, Payments, Invoicing, Recovery, Accounting, Documents → Parties.
- Identity ⇢ AccountDeleted ⇢ Parties.

## Options écartées

- **Une table par rôle** (modèle initial) : doublons, effacement multiple, aucune vue d'une personne.
- **Héritage de tables** (table mère et tables filles par rôle) : une personne a plusieurs rôles à la fois et en change.
- **Partie partagée entre organisations** : une agence ne doit pas voir la fiche qu'une autre agence tient sur la même personne (ADR 0006). La personne se retrouve d'une organisation à l'autre par son compte, pas par sa fiche.

## Conséquences

- Les tables `tenants`, `principals`, `candidates`, `guarantors`, `suppliers` du modèle proposé disparaissent.
- Un écran « Contacts » unique remplace les carnets séparés ; les fiches locataire et mandant deviennent des vues filtrées par relation.
