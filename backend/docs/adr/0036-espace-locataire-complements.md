# ADR 0036 — Espace locataire : documents, compte, congé, assurance, états des lieux, paiement en ligne

Statut : accepté (2026-11-19), recommandations validées telles quelles. Complète l'ADR 0024 (vagues 3 et 4 : paiements, documents) et décide ce qui empêche `apps/locataire` de quitter le mode « Bientôt disponible ». Touche les ADR 0003, 0004, 0005, 0006, 0007, 0008, 0011, 0014, 0016, 0019, 0020, 0021, 0022, 0026 et 0027. Amendements proposés en fin de document, **non appliqués**. Textes légaux : Légifrance refuse la lecture automatisée (403) ; les règles françaises citées viennent des fiches officielles de service-public.gouv.fr (F1168 vérifiée le 16/04/2026, F31269 le 09/06/2026, F31300 le 16/04/2025), qui résument la loi sans en être le texte : **à confirmer sur Légifrance** par le juriste (ADR 0011). Le reste est marqué « à confirmer ».

## Contexte

Constaté dans le code (2026-11-19) :

- **Front** (`apps/locataire/src/espace/capabilities.ts`) : toutes les familles ont `familyHasApiSource = false` ; seules des routes exactes sont réelles (loyers lus, interventions, messages, compte, sécurité, notifications, support). Restent gatés : `/documents`, `/bail/conge`, `/compte/modifier`, `/assurance[/deposer]`, `/etats-des-lieux[/{id}]`, `/loyers/payer[/simulation/{id}]`, `/loyers/prelevement`, `/loyers/regularisation`.
- **Contrat attendu par les écrans** (`data/schemas/*.ts`, `data/source.tsx`) : `giveNotice` (date de départ, motif libre `achat|mutation|perso|autre`, nouvelle adresse, case de confirmation, envoi annoncé « par lettre recommandée électronique ») ; `depositAttestation` (assureur, n° de contrat, début, fin, fichier PDF/JPEG/PNG 10 Mo) avec rappels J-30 et J-6 ; `updateProfile` (prénom, nom, profession, mobile, e-mail, titulaire du compte bancaire, photo, code à 6 chiffres) ; `documentSchema` (groupes `contrat`, `quittances`, `autres`) ; `inspectionSchema` (pièces, compteurs, photos, signatures, sans contestation) ; `startPayment` (`carte|virement|prelevement`, identifiants `PAY-AAAA-NNNN`, échéance `AAAA-MM`) et mandat SEPA saisi dans l'app (IBAN).
- **Serveur** :
  - Leases : `POST /org/…/leases/{lease}/notice` (`RecordNotice`) enregistre un préavis **par bail** (une seule colonne `notice_*`), durée par `LeaseRegime::tenantNoticeMonths(jurisdiction_data)` ; le préavis réduit dépend d'un champ **du bail** (`tense_zone`, `tenant_notice_reason`), pas de la lettre. Seuls des régimes `Fr` existent. `leases.signed_file_id` porte la pièce signée, jamais exposée au locataire. `LeaseNoticeRecorded` n'a aucun écouteur.
  - Documents : `DocumentStore` (type vérifié sur le contenu, 10 Mo, EXIF retirés, `retentionUntil`), `certificates` (type `home_insurance` au référentiel, rappel à 30 jours) **sans état de validation** ; `IssuedDocuments` (type `letter`, `attestation`) ; aucun parcours de signature (ADR 0011) n'est encore codé.
  - Identity : `users` = `name`, `email` ; ni téléphone, ni changement d'adresse ; `reauthenticated` et `web-session` existent.
  - Rent : `PaymentMethod` = `transfer|cheque|cash|direct_debit` ; aucun module Payments, Inspections ; aucun PSP.
  - Messaging : routes `/tenant/conversations…` **livrées** (ADR 0033, lot 1). L'audit des pages gatées qui les dit absentes est dépassé.
- **Juridictions ouvertes** (ADR 0008) : France, Belgique (Bruxelles, Wallonie), Luxembourg, Québec. Seule la France a des régimes de bail.

## Décision

### 1. Invariants (repris de l'ADR 0024, étendus aux écritures)

1. **Clé de lecture et d'écriture** : couple (organisation, bail) de `LeaseDirectory::visibleToTenant()` et fiche rattachée au compte (`PartyLinks`), évalués à chaque requête. Hors clé : **404** comme une ressource inconnue.
2. **Granularité** : ce qui décrit le bail (documents partagés, état de couverture d'assurance, états des lieux, paiement de la dette) se lit par tout locataire du bail ; ce qui émane d'une personne (demande de congé, attestation déposée, remarque d'état des lieux, justificatif) ne se lit que par **sa fiche** et l'équipe. Garants et occupants : rien.
3. **Le locataire demande, l'agence acte.** Aucune écriture de l'espace ne modifie le bail, la fiche, le grand livre ou une pièce : elle crée une demande que l'équipe traite par ses Actions existantes.
4. **Grâce** (12 mois, ADR 0024) : lecture, paiement d'une dette et remarque sur l'état des lieux de sortie ; ni congé, ni dépôt d'attestation.
5. Resources propres à l'espace (`Http/Resources/Tenant/`), `Cache-Control: private, no-store`, jamais d'identifiant de fiche d'autrui, de note interne, de motif saisi par l'équipe.
6. Gardes communes : `auth:sanctum`, `no-operator-token`, `space:tenant`, `verified`, middleware de réponse privée du module.

### 2. Documents du locataire

- **Pas d'agrégateur serveur.** La page `/documents` compose quatre lectures existantes ou nouvelles : quittances et avis (`/tenant/rent/…`, existant), documents du bail (Leases, ci-dessous), attestations d'assurance (décision 5), états des lieux (décision 6). Un point d'entrée unique ferait appeler Rent et Inspections par Leases (cycle) ou lire des fichiers par Reporting.
- **`lease_documents`** (Leases, sur le modèle de `mandate_documents`, ADR 0032) : `lease_id`, `party_id` nullable (pièce adressée à un seul colocataire), `stored_file_id` ou `issued_document_id`, `kind` (`amendment`, `diagnostic`, `letter`, `attestation`, `other`), `shared_by_user_id`, `shared_at`, `revoked_at`. **Partage explicite** par l'équipe (`owner`, `admin`, `manager`), révocable ; le retrait du partage ne supprime pas le fichier. **Exception** : la pièce signée du bail (`signed_file_id`) est visible d'office.
- **Partage vers un tiers** (lien public vers une quittance) : non. Le locataire télécharge et transmet lui-même.
- **Téléchargement** : `DocumentStore::stream` sous `CurrentOrganization::run`, audit `documents.file.downloaded` dans la même transaction (règle ADR 0032), `file_unavailable` si le contenu manque.

### 3. Compte : coordonnées et préférences

- **Le compte appartient à la personne, la fiche à l'organisation** (ADR 0019). Modifier son compte ne réécrit jamais une fiche.
- `PATCH /me` : `name` seul. **Écartés** du contrat front : profession, titulaire de compte bancaire, photo de profil (aucun usage, donnée personnelle de plus) ; l'IBAN relève du mandat de prélèvement chez le PSP (décision 7).
- **Changement d'e-mail** (Identity, amende l'ADR 0004) : `POST /me/email-change` (`reauthenticated`, `web-session`) envoie un code à 6 chiffres à la **nouvelle** adresse (haché, 15 minutes, 5 essais, un seul vivant) ; `POST /me/email-change/confirmation` remplace l'adresse, pose `email_verified_at`, **révoque les autres sessions et jetons** (comme le changement de mot de passe) et prévient l'ancienne adresse par un e-mail de sécurité. Adresse déjà prise : même réponse 202, aucun code valable, le titulaire de cette adresse est prévenu (pas d'énumération). Les invitations en attente adressées à l'ancienne adresse ne sont plus acceptables (ADR 0024) : l'agence réinvite.
- **Téléphone** : `users.phone` (E.164, chiffré), **déclaratif** (`phone_verified_at` nul), jamais utilisé pour l'authentification ; `PUT /me/phone` (`reauthenticated`). Pas de SMS tant qu'aucun fournisseur n'est choisi (question 5).
- **Transmission aux agences** : `contact_update_requests` (Parties) créée à la demande du locataire, par rattachement, avec les valeurs **lues côté serveur** sur le compte (jamais reçues du client), chiffrées ; l'équipe applique (Action existante d'ajout de point de contact) ou écarte ; expiration et purge à 90 jours.
- **Préférences** : `/notifications/preferences` existant ; seuls s'ajoutent les types de la décision 9. « Rappel de loyer impayé » et « Actualités eGuardImmo » du front disparaissent (ADR 0027 et 0033).
- **Export RGPD** (`dataExportRequestedOn`) : hors périmètre, ADR distinct commun aux espaces.

### 4. Demande de congé

**Constat légal (France, à confirmer)** : préavis du locataire de 3 mois (vide), 1 mois en meublé (art. 25-8), en bail mobilité (art. 25-12) et, en vide, en zone tendue ou pour un motif listé (premier emploi, mutation, perte d'emploi, nouvel emploi après perte d'emploi, santé, RSA ou AAH, logement social) **précisé et justifié dans la lettre**, sinon 3 mois ; formes admises : lettre recommandée avec avis de réception, acte de commissaire de justice, remise en main propre contre récépissé ou émargement, lettre recommandée électronique avec accord préalable du destinataire particulier ; le délai court du jour de la réception ou de la remise ; un simple e-mail ne vaut pas congé ; le congé donné ne se retire pas sans l'accord du bailleur ; art. 8-2 (violences) à part.

- **Objet** : `lease_notice_requests` (Leases) — une demande **par fiche** (le congé d'un colocataire ne lie pas les autres) : `lease_id`, `party_id`, `reason_key` (liste fermée fournie par la juridiction), `requested_departure_on`, `proof_file_id` (justificatif, catégorie `supporting`), `forwarding_address` (chiffrée, facultative, utile à l'art. 22), `letter_document_id` (lettre émise, ADR 0022), `consent_version`, `client_id`, `status` (`submitted`, `acknowledged`, `withdrawn`, `closed`), `received_on` (date posée par l'agence), `acknowledged_by_user_id`, `closed_outcome` (`recorded`, `superseded`). Une demande vivante par (bail, fiche) : colonne générée unique.
- **Lettre** : au dépôt, PDF de la lettre de congé (Gotenberg, instantané, type `letter`, ADR 0022/0026) portant identité, adresse du logement, motif, mention du justificatif, date souhaitée ; empreinte SHA-256. Scellement PAdES et horodatage qualifié quand le parcours de l'ADR 0011 existera ; d'ici là, empreinte et journal.
- **Transmission (v1)** : la demande arrive à l'agence avec la lettre ; **l'agence accuse réception** dans l'application (`acknowledge`, date de réception ≤ aujourd'hui et ≥ dépôt) : ce récépissé daté fait courir le préavis **si le juriste le qualifie de remise contre récépissé** (point 1). Sans accusé sous 2 jours ouvrés, le locataire est prévenu et l'écran propose la lettre à envoyer en recommandé. La date de départ affichée avant l'accusé est **indicative**. LRE qualifiée par prestataire : question 2.
- **Préavis par juridiction** (amende l'ADR 0008) : le contrat `LeaseRegime` remplace `tenantNoticeMonths(jurisdictionData)` par `tenantNoticeReasons(jurisdictionData)` (clé, libellé, mois, justificatif exigé) et `tenantEarliestDeparture(bail, reçu le, motif)`. Le motif devient une donnée **de la demande**, plus du bail (`tenant_notice_reason` de `jurisdiction_data` lu en repli de lecture jusqu'à sa reprise, puis retiré). `tense_zone` reste sur le bail tant que Geography n'existe pas. Bail hors `Fr` : 422 `lease_jurisdiction_unsupported`, jamais de repli.
- **Retrait** : par le locataire tant que `submitted` ; après accusé, seulement par accord avec l'agence (via la messagerie, l'agence clôt).
- **Traitement** : l'équipe enregistre l'effet par les routes existantes (`notice` quand tous les locataires ont donné congé, `parties/{leaseParty}/end` pour un colocataire) en citant `notice_request_id` ; l'Action clôt la demande dans la même transaction.
- **Motif « violences » (art. 8-2)** : hors parcours en ligne en v1 (question 4) ; l'écran oriente vers l'agence ou un conseil.
- **Données sensibles** : motif en code, justificatif lisible par `owner`, `admin`, `manager` seulement (jamais le comptable ni le mandant), téléchargement journalisé ; ni motif ni justificatif dans les notifications, l'audit ou les Resources des colocataires.

### 5. Attestation d'assurance habitation

**Constat légal (France, à confirmer)** : le locataire s'assure contre les risques locatifs et en justifie à la remise des clés puis chaque année à la demande du bailleur (art. 7 g ; meublé art. 25-3 ; mobilité art. 25-12) ; à défaut, après mise en demeure restée sans effet un mois, le bailleur peut souscrire pour son compte (prime récupérable, majoration plafonnée) ou agir en résiliation.

- **Dépôt ≠ pièce** : `lease_insurance_submissions` (Leases) : `lease_id`, `party_id`, `stored_file_id` (catégorie `certificate`), `insurer`, `policy_number`, `starts_on`, `ends_on`, `client_id`, `status` (`pending`, `accepted`, `rejected`, `withdrawn`), `decided_by_user_id`, `decided_at`, `rejection_reason` (`unreadable`, `wrong_person`, `wrong_address`, `expired`, `missing_rental_risks`, `other`) et note facultative de 500 caractères.
- **Acceptation** par l'équipe : crée dans la même transaction une pièce `certificates` (type `home_insurance`, sujet `lease`) par `Documents\PublicApi\Certificates::record()` (nouveau) ; rappels, état et écran Conformité restent ceux de l'ADR 0021. Un dépôt refusé ne devient jamais une pièce : pas de faux « valide ».
- **Lecture** : chaque colocataire voit l'**état de couverture du bail** (`valid`, `expiring`, `missing`, date de fin) et **ses** dépôts ; jamais l'attestation d'un autre.
- **Relance par l'agence** : `POST /org/…/leases/{lease}/insurance/reminder`, une par 7 jours et par bail (429 sinon) ; notification seulement. **Ce n'est pas une mise en demeure** : la mention le dit à l'équipe.
- **Rappels automatiques** : J-30 (délai du type) et jour d'échéance, par `CertificateDeadlineReached` ; le J-6 du front est retiré.

### 6. États des lieux : module Inspections, créé maintenant au périmètre minimal

**Constat légal (France, à confirmer)** : état des lieux contradictoire, papier ou électronique, remis à chaque partie (art. 3-2, décret n° 2016-382) ; le locataire peut demander de compléter l'état d'entrée dans les 10 jours, et pour le chauffage pendant le premier mois de la période de chauffe ; la comparaison entrée/sortie fixe le délai de restitution du dépôt (1 ou 2 mois, art. 22).

- **Création du module Inspections** (prévu par l'ADR 0005) : cycle de vie et obligations propres (fenêtre de complément, comparaison entrée/sortie, conservation), absents de Documents et de Leases.
- **Périmètre v1** : l'équipe enregistre un état des lieux réalisé hors application (papier, outil tiers, commissaire de justice) : `inspections` (`lease_id`, `kind` `entry|exit`, `performed_on`, `performed_by` `parties|agent|bailiff`, `stored_file_id` PDF, `signatories` déclarés (nom, qualité, date), `exit_matches_entry` nullable, `published_at`, `lock_version`). Le locataire lit et télécharge une fois publié.
- **Remarques du locataire** : `inspection_remarks` (`inspection_id`, `party_id`, `author_user_id`, `kind` `complement|heating|comment`, `body` 2 000 caractères, jusqu'à 6 photos par `DocumentStore` sans EXIF, `client_id`, `status` `open|answered`, réponse de l'équipe `accepted|refused|noted` avec texte). Ajout seul, jamais modifiées. `complement` : entrée seulement, jusqu'à `performed_on + 10 jours` inclus ; `heating` : entrée seulement, tant que le bail a moins de 13 mois (approximation de la première période de chauffe, point 6) ; `comment` : sortie, pendant la grâce. Hors fenêtre : 409 `inspection_remark_window_closed`. La remarque est une **trace** ; elle ne modifie pas le PDF et ne remplace pas la saisine de la commission de conciliation.
- **Signature dans l'application, saisie pièce par pièce, compteurs, photos structurées** : reportées à un ADR de saisie (mobile, hors ligne) qui s'appuiera sur le parcours hybride de l'ADR 0011. Le front n'affiche pièces et compteurs que s'ils existent.

### 7. Paiement en ligne par PSP : contrat et plan seulement

- **Module Payments** (ADR 0005) : intention de paiement, appel au PSP, webhook, rapprochement. **eGuardImmo ne détient jamais les fonds** (ADR 0011) : chaque organisation a son compte chez le PSP (compte connecté, KYB par le PSP), l'argent va de la carte ou du compte du locataire au compte de l'organisation.
- **Interface `PaymentGateway`** justifiée par deux implémentations réelles (PSP retenu, `FakeGateway` pour les tests et le développement), comme `PushDriver` (ADR 0027).
- **Parcours** : page de paiement **hébergée par le PSP** (aucune donnée de carte chez nous) ; authentification forte par le PSP (DSP2). `POST /tenant/online-payments` (`lease`, `installments[]`, `method`, `client_id`) : le montant est le **reste dû lu au grand livre** (`RentLedger`), la devise celle de l'organisation ; réponse `{id, status, redirect_url}`. Une intention vivante par (bail, ensemble d'échéances) : rejeu 200. Le retour du PSP n'est jamais cru : l'écran interroge `GET /tenant/online-payments/{id}`.
- **Webhook** `POST /webhooks/payments/{provider}` (public, dans `ROUTES_PUBLIQUES`, `throttle:600,1`) : signature vérifiée sur le corps brut (401 sinon), `payment_provider_events` unique sur l'identifiant d'événement, transitions `pending → processing → succeeded|failed|cancelled|expired` monotones, puis `PaymentConfirmed` après commit (ADR 0007) avec clé `psp:{provider}:{référence}`.
- **Rent** écoute `PaymentConfirmed` en file et enregistre l'encaissement par `RecordPayment` avec cette clé d'idempotence (nouveau moyen `card`, et `direct_debit` porté par le PSP) ; imputation, quittance et notifications existantes s'enchaînent. Rattrapage `payments:reconcile` quotidien : relit au PSP les intentions `pending` de plus de 24 h et signale les paiements confirmés non imputés. Un remboursement ou un impayé de prélèvement (`charge.refunded`, rejet SEPA) passe par `CancelPayment` côté équipe, jamais automatiquement en v1.
- **Frais** : à la charge de l'organisation ; aucune surfacturation au locataire (point 8).
- **Moyens** : carte d'abord ; prélèvement SEPA (mandat chez le PSP, jamais imposé au locataire, art. 4 c à confirmer) ensuite ; virement : coordonnées de l'agence affichées hors PSP, reporté tant qu'Organizations ne les expose pas.
- **Comparatif PSP** (faits à confirmer auprès des fournisseurs, DPA compris) :

| Option | Pour | Contre |
|---|---|---|
| **Stripe Connect, comptes Standard** (recommandé) | carte, SEPA, Bancontact, débit préautorisé canadien : couvre les quatre juridictions et l'EUR et le CAD ; l'agence est le commerçant ; mode test complet ; webhooks signés documentés | société américaine (transferts hors UE, clauses à vérifier) ; solde chez le PSP avant virement à l'agence (compatibilité avec le compte de fonds de tiers, point 8) |
| Mollie Connect for Platforms | société néerlandaise, données UE, Bancontact et SEPA | marchands de l'EEE, du Royaume-Uni et de la Suisse seulement d'après des sources secondaires : un second PSP pour le Québec |
| GoCardless | spécialiste du prélèvement (SEPA, débit canadien), frais bas | pas de carte : un second PSP resterait nécessaire |
| Lemonway, Mangopay | établissements européens orientés places de marché, fonds de tiers cantonnés | modèle de porte-monnaie électronique, KYC des payeurs plus lourd, intégration plus longue |

- **Mise en œuvre** limitée au lot 6 (contrat, `FakeGateway`, webhook, écoute Rent) tant que le PSP n'est pas validé ; bac à sable au lot 7, production au lot 8 après DPA et avis juridique.

### 8. Lien avec Messaging

- Aucune route nouvelle : les fils `tenant` (ADR 0033) se rattachent déjà au bail. Congé, assurance et remarques d'état des lieux **ne passent pas par un message** (ni structure, ni échéance, ni preuve) ; l'écran propose « écrire à l'agence » avec l'objet prérempli sur le bail concerné. La mention « un message n'est pas un congé » reste.

### 9. Notifications (amende l'ADR 0027)

| Type | Audience | Destinataires | Clé | Défaut |
|---|---|---|---|---|
| `leases.notice_requested` | staff | `owner`, `admin`, `manager` | `notice_request:{id}` | in_app (verrouillé), e-mail |
| `leases.notice_unacknowledged` | staff | idem | `notice_request:{id}:late` | in_app, e-mail |
| `tenant.notice_acknowledged`, `tenant.notice_closed` | tenant | la fiche déclarante | `notice_request:{id}:{état}` | in_app (verrouillé), e-mail |
| `leases.insurance_submitted` | staff | `owner`, `admin`, `manager` | `insurance:{id}` | in_app |
| `tenant.insurance_accepted`, `tenant.insurance_rejected` | tenant | la fiche déposante | `insurance:{id}:{état}` | in_app, e-mail |
| `tenant.insurance_expiring`, `tenant.insurance_expired`, `tenant.insurance_reminder` | tenant | locataires du bail | `certificate:{id}:{état}:{échéance}`, `insurance_reminder:{bail}:{date}` | in_app, e-mail, push |
| `tenant.document_shared` | tenant | locataires du bail, ou la fiche visée | `lease_document:{id}` | in_app, e-mail |
| `tenant.inspection_published` | tenant | locataires du bail | `inspection:{id}` | in_app, e-mail |
| `inspections.remark_received` | staff | `owner`, `admin`, `manager` | `remark:{id}` | in_app, e-mail |
| `tenant.inspection_remark_answered` | tenant | l'auteur | `remark:{id}:answered` | in_app, e-mail |
| `tenant.online_payment_failed` | tenant | le payeur | `online_payment:{id}:failed` | in_app, e-mail |
| `parties.contact_update_requested` | staff | `owner`, `admin`, `manager` | `contact_update:{id}` | in_app |

Gabarits sans motif, montant, nom, assureur ni adresse ; push générique. Le succès d'un paiement est déjà notifié par `tenant.payment_recorded` (Rent). L'e-mail de sécurité du changement d'adresse part d'Identity (comme la vérification), hors centre.

### 10. API (`/api/v1`, noms préfixés par le module)

| Module | Locataire | Équipe (`/org/{organization}`) |
|---|---|---|
| Leases | `GET /tenant/leases/{lease}/documents`, `…/documents/{document}/download` (60/min, 30/min) ; `GET /tenant/leases/{lease}/notice-options` ; `GET /tenant/notice-requests[/{id}]`, `…/{id}/letter` ; `POST /tenant/leases/{lease}/notice-requests` (`reauthenticated`, `web-session`, 3/jour) ; `DELETE /tenant/notice-requests/{id}` ; `GET /tenant/leases/{lease}/insurance` ; `POST /tenant/leases/{lease}/insurance-submissions` (5/h, 10/jour) ; `GET /tenant/insurance-submissions/{id}/download` ; `DELETE /tenant/insurance-submissions/{id}` | `GET\|POST /leases/{lease}/documents`, `DELETE …/documents/{document}` ; `GET /notice-requests[/{id}]`, `…/{id}/proof`, `POST …/{id}/acknowledge` ; `notice_request_id` accepté par `notice` et `parties/{leaseParty}/end` ; `GET /insurance-submissions`, `POST …/{id}/accept\|reject` ; `GET /leases/{lease}/insurance`, `POST …/insurance/reminder` |
| Identity | `PATCH /me` ; `PUT /me/phone` ; `POST\|DELETE /me/email-change` (3/h) ; `POST /me/email-change/confirmation` (`throttle:auth`) | – |
| Parties | `GET\|POST /tenant/contact-updates` (5/jour) | `GET /parties/{party}/contact-updates`, `POST …/{id}/apply\|dismiss` |
| Inspections | `GET /tenant/inspections[/{id}]`, `…/{id}/document`, `GET\|POST …/{id}/remarks` (10/jour, photos 20/h), `GET /tenant/inspection-files/{file}` | `GET\|POST /leases/{lease}/inspections`, `GET\|PATCH /inspections/{id}`, `POST …/{id}/publish`, `GET …/{id}/remarks`, `POST /inspection-remarks/{id}/answer` |
| Payments | `GET /tenant/online-payments/options?lease=`, `POST /tenant/online-payments` (10/h, 30/jour), `GET …/{id}` (120/min), `POST …/{id}/cancel` | `GET\|POST /payments/account` (`owner`, `admin`, 2FA, preuve récente), `GET /online-payments` ; public : `POST /webhooks/payments/{provider}` |

- Rôles d'équipe : `owner`, `admin`, `manager` pour toute décision ; le comptable lit les paiements en ligne, rien d'autre ici.
- Formes : listes à curseur (`PaginatesWithCursor`) ; `client_id` UUID v7 sur chaque création (rejeu 200, contenu différent 409 `idempotency_key_reused`) ; fichiers en `multipart/form-data`.
- **Codes** (ADR 0014) : Leases `lease_document_not_found` 404, `notice_request_not_found` 404, `lease_notice_not_allowed` 409 (bail non signé, terminé, en grâce, préavis déjà enregistré, ligne close), `notice_request_exists` 409, `notice_request_locked` 409, `notice_departure_too_early` 422, `notice_reason_unsupported` 422, `notice_proof_required` 422, `lease_jurisdiction_unsupported` 422, `insurance_submission_not_found` 404, `insurance_submission_not_pending` 409, `insurance_period_invalid` 422, `insurance_reminder_too_soon` 429 ; Identity `email_change_code_invalid` 422 (code faux, expiré ou adresse prise, sans les distinguer), `email_change_attempts_exceeded` 429, `phone_invalid` 422 ; Parties `contact_update_not_found` 404, `contact_update_not_pending` 409 ; Inspections `inspection_not_found` 404, `inspection_remark_window_closed` 409, `inspection_not_publishable` 409 ; Payments `online_payment_not_found` 404, `payment_nothing_due` 409, `payment_account_not_ready` 409, `payment_provider_unavailable` 503 (`Retry-After`, rien d'écrit), `webhook_signature_invalid` 401.

### 11. Preuve, audit, conservation

- **Journal de preuve** de la demande de congé : `lease_notice_request_events` en ajout seul (déclencheur qui refuse `UPDATE` et `DELETE`, ADR 0017) : dépôt, lettre émise (empreinte), accusé (auteur, date de réception), retrait, clôture ; IP, user-agent, méthode de réauthentification, version du consentement.
- **Audit** (ADR 0016, sans motif, adresse, assureur, numéro de contrat, code ni texte libre) : `leases.document.shared|unshared`, `leases.notice_request.submitted|acknowledged|withdrawn|closed`, `leases.notice_request.proof_downloaded`, `leases.insurance.submitted|accepted|rejected|withdrawn|reminded`, `identity.email_change.requested|confirmed|cancelled`, `identity.phone.updated`, `parties.contact_update.requested|applied|dismissed`, `inspections.inspection.recorded|published`, `inspections.remark.created|answered`, `payments.online_payment.created|succeeded|failed`, `payments.account.onboarded`.
- **Conservation proposée (à confirmer)** : justificatif de congé, fin du bail + 3 ans ; lettre de congé et journal, fin du bail + 5 ans ; dépôt d'assurance refusé ou retiré, 1 an ; attestation acceptée, fin du bail + 3 ans ; état des lieux et remarques, fin du bail + 3 ans après restitution du dépôt ; adresse de réexpédition, restitution du dépôt + 1 an ; codes de changement d'adresse, 24 h ; intention de paiement aboutie, 10 ans (pièce comptable), échouée, 13 mois.
- **Anonymisation** (`PartyAnonymized`) : textes libres des remarques remplacés par `[effacé]`, adresse de réexpédition effacée ; pièces suivant leur `retentionUntil` (règle ADR 0029/0033).

### 12. Modèle de données (UUID v7, `datetime(6)`, `Checks::add`, jamais `ENUM`)

- **Leases** : `lease_documents`, `lease_notice_requests`, `lease_notice_request_events`, `lease_insurance_submissions`.
- **Identity** : `users.phone` (chiffré), `users.phone_verified_at`, `email_change_requests` (`user_id`, `email` chiffré, `email_hash`, `code_hash`, `attempts`, `expires_at`, `consumed_at`).
- **Parties** : `contact_update_requests`.
- **Inspections** (nouveau) : `inspections`, `inspection_remarks`, `inspection_remark_files`.
- **Payments** (nouveau) : `payment_accounts` (organisation, fournisseur, identifiant de compte connecté, état), `online_payments` (organisation, bail, payeur, échéances JSON, montant et devise, moyen, état, référence PSP unique, `client_id`), `payment_provider_events` (fournisseur, `event_id` unique, type, reçu le, traité le).
- **Rent** : `PaymentMethod::Card`, `rent_payments.provider_reference` unique nullable.
- **Réglages** (`.env.example` d'abord) : `PAYMENTS_GATEWAY` (`fake` par défaut, `none` en production tant que non validé), `PAYMENTS_{PROVIDER}_SECRET_KEY`, `PAYMENTS_{PROVIDER}_WEBHOOK_SECRET`, `TENANT_NOTICE_ACK_BUSINESS_DAYS` (2).

## Options écartées

- **Le locataire enregistre lui-même le préavis** (`RecordNotice` depuis l'espace) : il fixerait la date de réception d'un acte que l'agence n'a peut-être pas reçu, et un préavis par bail ignore le colocataire qui part seul.
- **Congé par message de la conversation** : sans structure, échéance ni preuve ; contraire à la mention de l'ADR 0033.
- **Congé par simple PDF à imprimer** : aucune trace, aucun suivi par l'agence.
- **Motif de préavis réduit stocké sur le bail** (état actuel) : le motif tient à la lettre et à la personne, pas au contrat.
- **Assurance acceptée sans revue** (pièce créée au dépôt) : une photo illisible ou l'attestation d'un autre logement compterait comme « valide ».
- **Assurance dans Documents avec routes locataire** : Documents devrait lire Leases (`visibleToTenant`), or Leases → Documents existe : cycle.
- **États des lieux comme simples documents partagés** : ni fenêtre de complément, ni comparaison entrée/sortie pour le dépôt.
- **Module Inspections complet tout de suite** (saisie, photos par pièce, signature) : sans parcours de signature (ADR 0011) ni application mobile hors ligne, gros chantier pour un besoin couvert v1 par le PDF.
- **Synchronisation automatique compte → fiche** : un tiers réécrirait le dossier de l'organisation, sur plusieurs organisations à la fois. **Aucune transmission** : l'agence garderait une adresse périmée.
- **Code de changement envoyé à l'ancienne adresse seulement** : ne prouve pas la possession de la nouvelle.
- **Formulaire de carte intégré** (champs chez nous) : périmètre PCI DSS étendu.
- **Encaissement sur un compte de la plateforme** : agrément d'établissement de paiement (ADR 0011).
- **Agrégateur `/tenant/documents`** : cycle (Leases → Rent, Inspections) ou lecture de fichiers par Reporting.
- **Lien de partage public d'un document** : fuite par transfert du lien.
- **Profession, photo, titulaire de compte dans le profil** : aucun usage, minimisation.

## Conséquences

- **Front** (`apps/locataire`) : sources API par famille, puis `familyHasApiSource` à `true` famille par famille ; contrat à adapter : identifiants UUID (fin de `PAY-AAAA-NNNN` et `AAAA-MM`), motifs de congé servis par `notice-options`, libellé « lettre recommandée électronique » remplacé par « demande transmise à votre agence, accusé de réception daté », justificatif de motif, `profileInputSchema` réduit (nom, mobile, e-mail), état de dépôt d'assurance (`pending`, `rejected` avec motif), remarques d'état des lieux, statuts de paiement du serveur, préférences alignées sur les types. `/loyers/regularisation` reste gaté (Accounting n'a pas la régularisation).
- **Rent** : écouter `LeaseNoticeRecorded` et la fin d'une ligne de colocataire pour régénérer les échéances « à venir » (reste à faire de l'ADR 0026) avant d'ouvrir le congé en production.
- **Exploitation** : `queue:work` (webhooks, notifications), Gotenberg (lettre), commandes `leases:flag-unacknowledged-notices` (horaire), `payments:reconcile` (quotidienne), `identity:purge-email-changes` et `parties:purge-contact-updates` (quotidiennes).
- **Risques** : l'accusé de l'agence est un point de passage obligé ; un PSP américain impose un mécanisme de transfert ; le partage explicite des documents demande un geste à l'agence (bail signé excepté).

## Plan de lots

Backend d'abord, front ensuite ; chaque lot sort par `composer check` ou `pnpm -r check` sans test ignoré ; `/security-review` sur les lots 2, 4, 6, 7 et 8. Tests communs à toute route : 401, 403 sans profil, jeton opérateur, 404 sur le bail d'un autre locataire et d'une autre organisation, grâce J+12 mois et J+12 mois + 1 jour (29 février), nombre de requêtes constant (1, 10, 100 éléments), Resources sans identifiant de fiche (test de structure).

| Lot | Contenu | Critères de sortie |
|---|---|---|
| 1. Documents du bail | `lease_documents`, pièce signée visible, routes locataire et équipe, `tenant.document_shared` | pièce adressée à un colocataire invisible des autres ; partage retiré → 404 ; téléchargement journalisé ; contenu absent sans audit « téléchargé » |
| 2. Compte | `PATCH /me`, téléphone, changement d'e-mail, `contact_update_requests` | code faux, expiré, cinquième essai ; adresse prise sans énumération (réponses identiques) ; autres sessions et jetons révoqués ; ancienne adresse prévenue ; valeurs transmises lues du compte, jamais du corps |
| 3. Assurance | dépôts, revue, `Certificates::record`, relance, audience `tenant` de `CertificateDeadlineReached` | acceptation → pièce et état `valid` ; refus → aucune pièce ; colocataire ne télécharge pas l'attestation d'un autre ; relance 429 à J+6 ; dépôt refusé en grâce |
| 4. Congé | contrat `LeaseRegime` par motif, demandes, lettre PDF, journal de preuve, accusé, clôture par `notice` et `parties/{leaseParty}/end`, retard d'accusé | durées vide/meublé/mobilité/zone tendue et motif justifié (tables datées) ; justificatif exigé ; demande vivante unique ; retrait refusé après accusé ; journal non modifiable (déclencheur testé) ; comptable 403 sur le justificatif ; bail `Be` 422 ; lettre identique à son instantané |
| 5. Inspections | module, enregistrement, publication, remarques, photos sans EXIF | fenêtre de 10 jours aux bornes (J+10 accepté, J+11 refusé) ; remarque d'un colocataire invisible des autres ; non publié → 404 ; liens de l'ADR 0005 vérifiés par `ArchTest` |
| 6. Paiements, contrat | module Payments, `PaymentGateway`, `FakeGateway`, intentions, webhook, `PaymentConfirmed` → Rent, rapprochement | webhook rejoué : un seul encaissement ; signature fausse 401 ; montant recalculé côté serveur ; retour PSP ignoré ; rattrapage d'un événement perdu ; transitions non monotones refusées |
| 7. PSP en bac à sable | pilote du PSP retenu, compte connecté de test, onboarding | paiement de bout en bout en mode test, rejet SCA, webhooks réels signés ; aucune clé dans le dépôt |
| 8. Production | DPA, avis juridique, `PAYMENTS_GATEWAY` activé | points 8 et 9 du juriste levés par écrit |
| F1 à F5 | fronts des lots 1 à 5 | `pnpm -r check` ; vérification navigateur sur l'API réelle (dépôt, accusé côté agence, notification reçue) ; famille passée à `familyHasApiSource: true` |
| F6 | `/loyers/payer`, statut, prélèvement | parcours en bac à sable dans le navigateur ; la page de simulation disparaît |

## Points à valider par un juriste

1. Art. 15 de la loi n° 89-462 : un dépôt en ligne suivi d'un accusé daté de l'agence vaut-il « remise en main propre contre récépissé ou émargement » ? Agence mandataire comme destinataire du congé ; LRE (CPCE art. L100) et accord préalable du destinataire particulier.
2. Liste des motifs de préavis réduit, pièces justificatives admises et moment de la justification ; zone tendue déclarée sur le bail (décret n° 2013-392) faute de Geography.
3. Colocation : congé individuel, fin de la solidarité du sortant (art. 8-1) ; cotitularité des époux et partenaires (C. civ. art. 1751).
4. Données sensibles (santé, RSA/AAH, violences) : base légale, minimisation, durée ; exclusion de l'art. 8-2 du parcours en ligne.
5. Assurance : une relance par notification n'est pas une mise en demeure ; souscription pour compte en meublé et en colocation ; contenu minimal d'une attestation acceptable.
6. États des lieux (art. 3-2, décret n° 2016-382) : forme électronique d'une demande de complément, borne de la période de chauffe, valeur d'un état réalisé hors application et déposé en PDF.
7. Dépôt de garantie (art. 22) : recueil de l'adresse de réexpédition au congé, délais de 1 et 2 mois et majoration.
8. Paiement : fonds encaissés pour le compte de tiers par une agence (loi Hoguet, garantie financière) via un compte connecté dont le solde est tenu par le PSP ; interdiction de surfacturer le paiement par carte ; prélèvement jamais imposé (art. 4 c) ; DSP2.
9. PSP et transferts hors UE (DPA, sous-traitants ultérieurs, Loi 25 pour le Québec, ADR 0011).
10. Durées de conservation de la décision 11.
11. Belgique, Luxembourg, Québec : préavis du locataire, indemnités et formes (non codés ; aucun régime de bail n'y existe).

## Questions fermées pour l'utilisateur

Ma recommandation est toujours la première.

1. **Créer le module Inspections maintenant, au périmètre minimal (PDF publié, remarques du locataire) ?** Alternatives : états des lieux en simples documents partagés ; module complet avec saisie et signature.
2. **Congé v1 par demande en ligne et accusé daté de l'agence, LRE qualifiée reportée après avis juridique ?** Alternative : LRE via prestataire dès v1 (coût par envoi, accord du destinataire).
3. **Congé toujours individuel (une demande par fiche), le bail se résilie quand tous les locataires ont donné congé ?** Alternative : un colocataire donne congé pour tous.
4. **Motif « violences » (art. 8-2) hors parcours en ligne en v1 ?** Alternative : inclus, avec la même confidentialité.
5. **Téléphone déclaratif, sans vérification par SMS ?** Alternative : vérification par SMS (nouveau fournisseur).
6. **Coordonnées transmises aux agences par une demande que l'équipe applique ?** Alternatives : synchronisation automatique ; aucune transmission.
7. **Attestation d'assurance validée par l'agence avant de devenir une pièce ?** Alternative : acceptation automatique, refus a posteriori.
8. **Les colocataires voient l'état de couverture du bail, jamais l'attestation d'un autre ?** Alternative : attestations visibles de tous les locataires du bail.
9. **PSP : Stripe Connect, comptes Standard ?** Alternatives : Mollie plus un PSP canadien ; GoCardless (prélèvement seul) ; Lemonway ou Mangopay.
10. **Carte d'abord, prélèvement SEPA ensuite, virement hors application ?** Alternative : prélèvement SEPA en premier.
11. **Partage explicite des documents par l'agence, bail signé visible d'office ?** Alternative : tous les fichiers du bail visibles d'office.
12. **Paiement d'une dette permis pendant la grâce ?** Alternative : paiement en ligne réservé au bail en cours.

## Amendements nécessaires (non appliqués)

- **ADR 0003** : `/tenant` gagne des écritures limitées (demande de congé, dépôt d'attestation, remarque d'état des lieux, paiement en ligne, demande de transmission de coordonnées).
- **ADR 0004** : changement d'adresse e-mail vérifié par code envoyé à la nouvelle adresse, révocation des autres sessions ; téléphone déclaratif sur `users`.
- **ADR 0005** : création d'Inspections → Leases (`LeaseDirectory::visibleToTenant`, `LeaseParticipants`), Parties (`PartyLinks`), Documents (`DocumentStore`), Organizations (`MembershipDirectory`) ; Payments → Leases (`visibleToTenant`), Rent (`RentLedger`), Organizations (`MembershipDirectory`) ; Leases → Documents (`Certificates::record`, `IssuedDocuments`) ; Inspections, Payments, Leases, Parties ⇢ nouveaux événements ⇢ Notifications ; Payments ⇢ `PaymentConfirmed` ⇢ Rent ; Parties ⇢ `PartyAnonymized` ⇢ Inspections, Leases. Aucun module n'appelle Inspections ni Payments.
- **ADR 0006** : lectures `AcrossOrganizations` dans les `Queries/` locataire de Leases, Inspections, Payments et Parties, par la clé de l'ADR 0024.
- **ADR 0007** : Payments, `payment_provider_events`, clé `psp:{provider}:{référence}`, `payments:reconcile`.
- **ADR 0008** : contrat `LeaseRegime` du préavis du locataire par motif (`tenantNoticeReasons`, `tenantEarliestDeparture`) ; retrait de `tenant_notice_reason` de `jurisdiction_data`.
- **ADR 0011** : PSP retenu ; LRE en option ; lettre de congé non scellée tant que le service de scellement n'existe pas.
- **ADR 0014** : codes de la décision 10.
- **ADR 0016** : actions d'audit de la décision 11.
- **ADR 0019** : `contact_update_requests` dans Parties.
- **ADR 0020** : `lease_documents`, `lease_notice_requests`, `lease_notice_request_events`, `lease_insurance_submissions` dans Leases.
- **ADR 0021** : assurance habitation de sujet `lease`, créée seulement par acceptation d'un dépôt ; rappels à l'audience `tenant`.
- **ADR 0022** : lettre de congé, pièce émise de type `letter` avec instantané.
- **ADR 0024** : vagues 3 et 4 précisées par cet ADR ; confidentialité entre colocataires des demandes, dépôts et remarques ; « reste à décider » sur les échéances d'un colocataire sorti à trancher avec le lot 4.
- **ADR 0026** : moyen `card`, `provider_reference`, écoute de `PaymentConfirmed` ; régénération des échéances après préavis ou départ d'un colocataire.
- **ADR 0027** : types et clés de la décision 9.

## Amendement du 2026-11-20 (revue de sécurité de l'implémentation)

Décisions prises à la correction des 10 constats de la revue indépendante (0 critique, 0 haut, 4 moyens, 6 faibles) :

1. **Pièces partageables** : `ShareLeaseDocument` n'accepte qu'un fichier de sujet `lease:{ce bail}` et de catégorie `supporting` ou `certificate` (sinon 422 `lease_document_invalid`). Le locataire télécharge en mode **générique** de `DocumentStore` (`streamGeneric`), qui refuse les fichiers de sujet `tenant_space`.
2. **Sujet `tenant_space:{bail}`** : tout fichier déposé par un locataire (justificatif de congé, attestation, photo de remarque) porte ce sujet, qui n'a pas d'entrée dans la table des morphs. Seules les routes dédiées de leur module le servent ; la route générique `documents/{id}` répond 404, y compris au comptable. L'attestation d'assurance se télécharge par `GET /org/{org}/insurance-submissions/{id}/download` (audit `leases.insurance.downloaded`).
3. **Adresse de réexpédition** : conservée chiffrée dans la demande de congé seulement ; ni l'instantané de la lettre, ni le PDF ne la portent. Conservation : restitution du dépôt + 1 an ; effacée à l'anonymisation de la fiche.
4. **Paiement en ligne, double débit** : sous verrou du bail (`LeaseDirectory::lock`), une échéance déjà couverte par une intention vivante ou réussie, de n'importe quelle fiche du bail, refuse la demande : 409 `payment_installments_in_progress`. `options` ne propose plus ces échéances (raison `payment_in_progress` quand il n'en reste aucune). Rent n'impute jamais deux fois : la clé `psp:{fournisseur}:{référence}` reste l'unique garde.
5. **`succeeded` exige montant et devise**, égaux à l'intention. Sinon rien ne bouge : journal `critical` et audit `payments.online_payment.mismatch`, aucun encaissement.
6. **Rattachement et refus** : `PaymentConfirmed` porte `party_id`, que Rent utilise pour l'encaissement. Un refus définitif de Rent (après les tentatives de la file) journalise `critical` et audite `rent.card_payment.rejected` au lieu d'attendre silencieusement le rejeu de 30 jours.
7. **Passerelle** : défaut `none` ; `fake` et le secret simulé sont refusés au démarrage en production (hors commandes de build), de même qu'un `PAYMENTS_RETURN_URL` qui n'est pas en `https://`.
8. **Colocataire sorti (tranche l'« à décider » de l'ADR 0024 pour ces lectures)** : `TenantStandingData::exitedOn` et `TenantLeaseKeyData::exitedOn` portent la sortie de **sa propre ligne** (semi-ouverte). Ne sont plus visibles : les échéances dues à partir de ce jour (liste, détail, avis), les pièces partagées à partir de ce jour ; le paiement en ligne de telles échéances est refusé (409 `payment_nothing_due`), alors que celles d'avant restent payables pendant la grâce. **Reste ouvert** : encaissements, quittances, régularisations de charges, fils de messagerie et interventions d'un colocataire sorti ne sont pas bornés par sa date de sortie.
9. **Rapprochement** : `payments:reconcile` lit les intentions vivantes par pages de `payments.reconcile_batch` (500, identifiant croissant) jusqu'à épuisement ; une intention que le PSP ignore encore après `payments.expire_unknown_after_days` (7) expire localement (un succès tardif l'emporte toujours, audité `late`).

Amendements à reporter : ADR 0014 (`payment_installments_in_progress`, `lease_document_invalid`), ADR 0016 (`leases.insurance.downloaded`, `payments.online_payment.mismatch`, `rent.card_payment.rejected`), ADR 0024 (borne des échéances et pièces par la sortie de la ligne).
