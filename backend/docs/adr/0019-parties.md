# ADR 0019 — Parties

Statut : accepté (2026-11-15). Amende l'ADR 0005 (nouveau module Parties). Personnalisation : ADR 0018.
Amendement (2026-11-16, ADR 0024) : `user_id` n'est posé que par l'acceptation d'une invitation émise par l'organisation (jamais par correspondance d'e-mail) ; index unique `(organization_id, user_id)` ; révocable par l'organisation et par le titulaire du compte, et à l'anonymisation de la partie.
Amendement (2026-11-19, ADR 0033, lot 1) : `AnonymizeParty` émet `Parties\Events\PartyAnonymized` ; Messaging remplace par `[effacé]` les textes de la contrepartie et purge ses pièces ; `PartyLinks::accountsOf` et `OwnerLinks::accountsOfMandant` servent à vérifier le destinataire d'un fil ouvert par l'équipe. Revue de sécurité : l'effacement est en file avec reprises, rattrapé par `messaging:erase-anonymized-parties`, et couvre aussi le sujet d'un fil ouvert par la contrepartie et le motif de restriction ; les pièces sont purgées immédiatement (ADR 0033, amendement du 2026-11-19).

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

## Amendement du 2026-11-20 (ADR 0036)

- `contact_update_requests` (Parties) : demande du locataire de transmettre ses coordonnées à une organisation, avec des valeurs lues côté serveur sur le compte (jamais reçues du client) et chiffrées. L'équipe l'applique (Action d'ajout de point de contact) ou l'écarte ; expiration et purge à 90 jours (`parties:purge-contact-updates`). Une anonymisation de la fiche efface aussi, côté Leases et Inspections, les textes libres et l'adresse de réexpédition qui s'y rattachent (`PartyAnonymized`).
