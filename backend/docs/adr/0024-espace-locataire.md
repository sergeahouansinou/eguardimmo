# ADR 0024 — Espace locataire

Statut : accepté (2026-11-16). Amende les ADR 0003 (espaces), 0004 (inscription du locataire), 0005 (dépendances), 0006 (lectures inter-organisations) et 0019 (`parties.user_id`). Livraison en cinq vagues : (1) lecture des baux et rattachement du compte, (2) quittances et avis d'échéance, (3) paiements, (4) demandes d'intervention et documents, (5) mobile. Cet ADR fixe la vague 1 et les règles des suivantes.
Amendement accepté (2026-11-19, ADR 0032) : aucun changement de comportement ; l'index unique `(organization_id, user_id)` de `parties.user_id` ne vaut que pour le rattachement locataire et `PartyLinks` reste locataire ; le rattachement propriétaire passe par `owner_accesses` ; le helper de jeton d'invitation (`TenantInvitationToken::generate`, `hash`, `hint`) est partagé avec `owner_invitations`.
Amendement accepté (2026-11-19, ADR 0032) : l'invitation locataire est aussi plafonnée par organisation sur 24 heures (`TENANT_INVITATION_DAILY_MAX`, 100 par défaut, 429 `invitation_daily_limit_reached`) et le nom de l'organisation est neutralisé (Markdown, HTML, caractères de contrôle) dans le message.
Amendement accepté (2026-11-19, ADR 0033, lot 1) : le locataire échange avec son agence sous `/tenant/conversations…` ; la clé est le triplet (organisation, fiche rattachée au compte, bail de `LeaseDirectory::visibleToTenant`), évaluée à chaque requête, grâce de 12 mois comprise en lecture **et en écriture** ; un colocataire ne lit pas le fil d'une autre fiche.
Amendement accepté (2026-11-19, ADR 0034) : `/tenant/charge-statements` (liste, détail, PDF, pièces partagées) ; clé `LeaseDirectory::visibleToTenant`, hors clé ou hors grâce : 404 `charge_statement_not_found`.

## Contexte

Un locataire est une partie (ADR 0019) connue d'une organisation, partie à un bail (ADR 0020). Il peut louer chez plusieurs organisations. Son compte (Identity) n'a aucun lien avec ces fiches : l'ADR 0003 prévoit l'espace `/api/v1/tenant` sans dire comment un compte devient « le locataire de cette fiche ». L'ancien projet rapprochait par e-mail, ce qui permet de lire le bail d'un autre en créant un compte à son adresse.

## Décision

### Rattachement d'un compte à une partie
- **La source de vérité est `parties.user_id`** (ADR 0019, sans clé étrangère). Une partie n'a qu'un compte, un compte n'a qu'une partie par organisation : index unique `(organization_id, user_id)`. Jamais de rattachement par correspondance d'e-mail.
- **Invitation, portée par Identity** (table `tenant_invitations`, modèle `TenantInvitation`) : l'organisation invite une partie à une adresse. Le jeton (48 caractères, haché SHA-256, 7 jours, usage unique) part par e-mail. Une partie n'a jamais qu'une invitation en attente ou acceptée (colonne générée unique `live_party_id`) ; réinviter remplace l'invitation en attente et rend l'ancien jeton inutilisable.
- **Acceptation** (`POST /tenant-invitations/acceptance`, compte connecté, `verified`, `no-operator-token`, `throttle:auth`) : le compte doit avoir une adresse **vérifiée** égale à l'adresse invitée, et **consentir explicitement** (`consent: true`, version du texte conservée dans `consent_version`). L'acceptation de l'invitation et le rattachement de la partie sont **une seule transaction** : si le compte est déjà rattaché à une autre fiche de l'organisation, tout est annulé et l'invitation reste en attente. Un jeton connu mais porté par un autre compte reçoit 403 `tenant_invitation_email_mismatch` sans rien rattacher ; un jeton inconnu, expiré ou déjà utilisé reçoit 404 `tenant_invitation_invalid`, sans les distinguer.
- **Aperçu avant consentement** (`POST /tenant-invitations/preview`) : même contrôle de l'adresse, renvoie le nom de l'organisation et l'expiration, rien sur la fiche.
- **Côté organisation** (`/org/{organization}/parties/{party}/tenant-access`, rôles `owner`, `admin`, `manager`, `throttle:20,1`) : `POST` invite (adresse facultative, sinon l'e-mail principal de la partie), `GET` donne l'état (`none`, `invited`, `linked`, adresse masquée), `DELETE` révoque l'invitation en attente ou le rattachement. Une personne physique, non archivée, non anonymisée et non déjà rattachée ; une société est refusée (422 `tenant_access_person_required`).
- **Côté locataire** (`/tenant/links`) : `GET` liste ses rattachements (identifiant de la fiche, organisation), `DELETE /tenant/links/{party}` révoque le sien. La révocation, par l'une ou l'autre partie, remet `user_id` à null, passe l'invitation à `revoked` (`revoked_by` : `organization`, `account` ou `system`) et n'efface rien du bail ni de ses pièces. L'anonymisation de la partie (RGPD) révoque aussi, par `system`.
- **Audit** (ADR 0016) : `identity.tenant_invitation.issued|accepted|revoked`, `parties.tenant_access.linked|unlinked`, plus le journal automatique des modèles. Adresse et jeton ne sont jamais en clair dans le journal.
- **Profil** : `Parties` inscrit dans `ProfileRegistry` un profil `tenant` (« Locataire ») tant que le compte a au moins un rattachement vivant ; `space:tenant` n'exige rien d'autre. Sans bail visible, la liste est vide.
- **Inscription** (amende l'ADR 0004) : le compte se crée par l'inscription ordinaire (e-mail, Google ou Apple), sans intention de profil ; le profil locataire n'existe qu'après acceptation. Le lien du courriel pointe vers `/invitation-locataire/{jeton}` du hub.

### Lecture inter-organisations (amende l'ADR 0006)
- `Leases\Queries\TenantLeases` lit avec `AcrossOrganizations` ; la clé de lecture est le couple **(organisation, partie)** rattaché au compte (`Parties\PublicApi\PartyLinks`), jamais un identifiant du client. Un bail hors de cette clé, hors période de grâce ou d'une autre organisation répond **404 `lease_not_found`**, comme un bail inconnu.
- La résolution (lots, parties, composantes, nom de l'organisation) passe par `CurrentOrganization::run()` **une fois par organisation** et réutilise les `PublicApi` existantes : le nombre de requêtes croît avec le nombre d'organisations, jamais avec le nombre de baux (testé).
- Seule lecture inter-organisations hors espace : la recherche d'une invitation par le hachage de son jeton (`Identity\Queries\TenantInvitations`), comme celle des invitations de membres (`Organizations\Queries\Memberships`).

### Ce qu'un locataire voit
- Baux de statut `signed` ou `terminated` (jamais brouillon ni annulé) où une de ses fiches a le rôle `tenant`. Garants et occupants n'ont pas d'espace dans cette vague.
- **Période de grâce : 12 mois** après le dernier jour d'occupation, jour compris (`GracePeriod`). Le dernier jour est le plus proche de `ends_on`, du départ préavisé et de la fin de sa propre ligne (un colocataire parti compte depuis son départ). Un bail sans fin n'ouvre aucune grâce. Réponse : `access.until` (dernier jour d'accès) et `access.in_grace`. Même règle exprimée deux fois, en SQL (`dernier jour >= aujourd'hui − 12 mois`) et en date (`until`) ; un test les compare jour par jour autour du 29 février.
- Bail : référence, régime, phase, dates, périodicité, échéance, mode de paiement, préavis (dates et auteur, pas le motif), lots occupés (référence, type, étage, surface, adresse du site), **conditions financières en vigueur** à la date de référence (aujourd'hui, ramenée dans la vie du bail), parties en vigueur (nom, rôle, solidarité, `is_me`).
- **Jamais** : note interne, motif de résiliation, `custom_fields`, `jurisdiction_data`, garanties (plafond, fin, bénéficiaire), identifiants de fiches d'autrui, coordonnées, pièce signée (vague 4), `lock_version`. Resources dédiées dans `Http/Resources/Tenant/`.
- Les mêmes règles valent pour toutes les vagues : une ressource est lue par la clé (organisation, partie), filtrée par la grâce, minimisée par une Resource propre à l'espace.

### Messagerie
- L'assistance de la plateforme existe déjà (`/support/tickets`, `space = tenant`, ADR 0005) et ne dépend pas d'une organisation : le locataire l'utilise telle quelle, sans route dupliquée.
- Messaging ne prévoit **aucun échange locataire ↔ organisation** (les conversations ne relient que des membres d'une même organisation). Il n'est pas créé ici : ce serait un nouveau produit (destinataire, confidentialité, modération), à décider avec la vague 4.
- Le support n'exige pas encore le profil locataire pour déclarer `space = tenant` : sans effet de sécurité (étiquette de classement), à durcir avec la vague 4.

### API de la vague 1
| Méthode et chemin | Garde |
|---|---|
| `GET /tenant/leases`, `GET /tenant/leases/{lease}` | `space:tenant`, `throttle:60,1` |
| `GET /tenant/links`, `DELETE /tenant/links/{party}` | `space:tenant`, `throttle:30,1` |
| `POST /tenant-invitations/preview`, `POST /tenant-invitations/acceptance` | compte vérifié, `throttle:auth` |
| `GET\|POST\|DELETE /org/{organization}/parties/{party}/tenant-access` | `owner`, `admin`, `manager` |

Toutes ces routes exigent `auth:sanctum` et `no-operator-token`. Les codes d'erreur sont dans `Identity\Enums\ErrorCode` et `Parties\Enums\ErrorCode` (ADR 0014).

### API des vagues 2 et 3 (loyers, 2026-11-17)
| Méthode et chemin | Contenu |
|---|---|
| `GET /tenant/rent/installments`, `…/{installment}` | échéances appelées (`issued`, `partially_paid`, `paid`), reste dû au grand livre, avis et quittance valable ; filtres `lease`, `status`, curseur |
| `GET /tenant/rent/installments/{installment}/notice/download` | PDF de l'avis |
| `GET /tenant/rent/receipts`, `…/{receipt}`, `…/{receipt}/download` | quittances émises, annulées comprises (`is_void`) ; PDF refusé (409 `rent_receipt_void`) si annulée |
| `GET /tenant/rent/payments`, `…/{payment}` | encaissements du bail (montant, mode, date, imputations non annulées) |

Mêmes gardes que la vague 1 (`auth:sanctum`, `no-operator-token`, `space:tenant`, `verified`, `throttle:60,1`), Resources dans `Rent/Http/Resources/Tenant/`.

- **Clé de lecture** : `Leases\PublicApi\LeaseDirectory::visibleToTenant()` renvoie les couples (organisation, bail) que `TenantLeases` juge visibles (rattachement, rôle de locataire, grâce). Rent restreint ses lectures `AcrossOrganizations` à ces couples (`TenantRentScope`) ; aucune dépendance nouvelle (Rent → Leases existait, ADR 0026). Hors clé, ou grâce échue : 404 `rent_*_not_found`, comme une pièce inconnue.
- **Granularité : le bail, pas la partie.** `installments.party_id` et `payments.party_id` ne désignent que le premier locataire ; un colocataire solidaire doit lire la même dette. Tout locataire d'un bail visible lit donc ses échéances, quittances et encaissements, comme il lit déjà ses colocataires (vague 1). Un garant ou un occupant n'a rien.
- **Échéances** : jamais « à venir » (pas encore une créance, modifiable) ni annulées (l'appel de loyer est contrepassé, un avis resté en ligne tromperait). Une échéance annulée avec un avis déjà téléchargé reste connue de l'organisation seule.
- **Quittances annulées** : listées et signalées, pas délivrées en PDF (une quittance nulle servirait de preuve de paiement).
- **Jamais** : identifiants de fiches (`party_id`, `unit_id`, locataires de l'instantané), empreintes, écritures comptables, motifs d'annulation, référence et note d'un encaissement, clé d'idempotence, auteur de la saisie, état interne de la quittance (`pending`, `on_demand`).
- **PDF** : lus dans le contexte de l'organisation de la pièce (`CurrentOrganization::run`), même flux que l'organisation (`private, no-store`, audit `documents.file.downloaded`).
- **Requêtes** : une lecture par type de pièce plus un contexte par organisation, indépendantes du nombre de pièces (testé).
- **Reste à décider** : un colocataire sorti garde, pendant sa grâce, la vue des échéances postérieures à son départ (elles ne sont pas filtrées par sa date de sortie).

## Dépendances (amende l'ADR 0005)
- Parties → Identity (`TenantInvitations`, `ProfileRegistry`) et Parties → Organizations (`OrganizationDirectory` : nom, rien d'autre).
- Leases → Parties (`PartyLinks`) et Leases → Organizations (`OrganizationDirectory`).
- Identity ne dépend d'aucun module : elle porte l'invitation, mais c'est Parties qui héberge les routes d'acceptation, de prévisualisation et de révocation, et pose `user_id`, pour ne pas créer le cycle Identity → Parties → Identity.

## Options écartées

- **Rattachement par e-mail** (ancien projet) : prise de contrôle par inscription à l'adresse d'autrui (ADR 0004, liaison automatique écartée pour la même raison). Même une adresse vérifiée ne suffit pas sans invitation de l'organisation.
- **Invitation portée par Organizations** : décision de l'utilisateur ; Organizations gère l'équipe, pas les personnes accompagnées.
- **Table de liens compte ↔ partie dans Identity** : deux sources de vérité avec `parties.user_id`, qui sert déjà l'anonymisation à la suppression du compte.
- **Identity → Parties pour poser le lien** : cycle de dépendances.
- **Rattacher par événement après commit** : une invitation consommée sans lien en cas d'échec du listener.
- **Une partie partagée entre organisations** (ADR 0019) : le locataire se retrouve d'une organisation à l'autre par son compte, pas par une fiche commune.
- **Un profil `tenant` par organisation** : le serveur ne garde pas de profil actif (ADR 0003) ; la liste `/tenant/leases` couvre toutes les organisations.
- **Accès sans limite après la fin du bail, ou coupé à la fin** : 12 mois, décision de l'utilisateur, pour consulter quittances et décompte de sortie.
- **Archivage de la fiche ou du bail comme coupure d'accès** : l'archivage est un rangement de l'organisation ; seule la révocation retire le rattachement.
- **Routes support dupliquées sous `/tenant`** : même ressource, deux URL.
- **Garants, occupants et sociétés dans l'espace locataire** : un représentant de société et un garant n'ont ni les mêmes droits ni les mêmes données ; à traiter à part.

## Conséquences

- Migrations : `tenant_invitations` (Identity) et l'index unique `(organization_id, user_id)` de `parties` (Parties). Aucune donnée existante n'est touchée.
- Les vagues 2 à 4 lisent par la même clé (organisation, partie), avec leur grâce et leurs Resources propres ; le module Rent expose une lecture dédiée à l'espace sans que le locataire passe par ses routes d'organisation.
- **Organisation suspendue ou archivée** : `Organization` n'a aujourd'hui aucun statut. Quand il existera, `TenantLeases` et la révocation devront l'honorer en un seul point ; non gérable avant.
- La révocation ne prévient pas encore la personne par e-mail ; à ajouter avec les notifications.
- Chaque nouvelle route de l'espace est testée : 401, 403 sans profil, 404 d'un autre locataire et d'une autre organisation, jeton opérateur, grâce à J+12 mois et J+12 mois +1 jour, nombre de requêtes constant.

## Amendement du 2026-11-20 (ADR 0036)

- Les vagues 3 et 4 sont précisées par l'ADR 0036 : documents partagés, congé, assurance, états des lieux, coordonnées, paiement en ligne. Ce qui décrit le bail se lit par tout locataire du bail ; ce qui émane d'une personne (demande de congé, attestation, remarque, justificatif) ne se lit que par sa fiche et l'équipe, colocataires compris.
- Ajout à `LeaseDirectory` : `tenantStanding(userId, leaseId, today)` rend (organisation, bail, fiche, `active`) ; `active` est faux pendant la grâce de 12 mois (ni congé, ni dépôt d'attestation). Reste à décider, avec la régénération des échéances : les échéances d'un colocataire sorti.
- Revue de sécurité : « reste à décider » tranché pour les échéances et les pièces. `TenantStandingData::exitedOn` et `TenantLeaseKeyData::exitedOn` portent la sortie (semi-ouverte) de la ligne propre au compte ; échéances dues à partir de ce jour et pièces partagées à partir de ce jour disparaissent des lectures, et leur paiement en ligne est refusé. Reste à borner : encaissements, quittances, régularisations de charges, messagerie, interventions.
