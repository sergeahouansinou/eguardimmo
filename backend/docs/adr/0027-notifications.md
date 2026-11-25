# ADR 0027 — Notifications : centre in-app, e-mail et push mobile

Statut : accepté (2026-11-18). Complète l'ADR 0005 (module Notifications), l'ADR 0003 (espaces), l'ADR 0004 (jetons mobiles), l'ADR 0007 (événements) et l'ADR 0024 (période de grâce du locataire).
Amendement accepté (2026-11-18, ADR 0029) : huit types produits par Maintenance — `maintenance.request_received`, `maintenance.approval_decided`, `maintenance.approval_expired`, `maintenance.reschedule_requested` (audience staff : propriétaire, administrateur, gestionnaire) ; `tenant.request_qualified`, `tenant.visit_scheduled`, `tenant.request_declined`, `tenant.work_completed` (audience tenant, locataires du bail). Clés d'idempotence : `request:{intervention}`, `approval:{approval}:{état}`, `visit:{visit}:{lock_version}`, `qualified:{intervention}`, `declined:{intervention}`, `completed:{intervention}`. Gabarits sans texte libre ni montant, push générique.
Amendement accepté (2026-11-19, ADR 0030) : type `reporting.reports_due` produit par Reporting (`ReportsDue`, audience staff : propriétaire, administrateur, gestionnaire ; défaut in_app seul). Clé d'idempotence : `due:{mandant}:{début de période}`. Gabarit sans nom de mandant ni montant, push générique. La notification du propriétaire à la publication d'un compte rendu (`ManagementReportPublished`) est reportée au lot 3 (espace propriétaire).
Amendement accepté (2026-11-19, ADR 0032) : audience `owner` (colonne `notifications.party_id`, clé de lecture = accès vivant et fenêtre calculée par `MandateDirectory::visibleToOwner`), types `owner.*` de la décision 6 de l'ADR 0032, gabarits sans montant, nom ni IBAN, `NOTIFICATIONS_OWNER_URL` ; exception à « l'e-mail n'est jamais obligatoire » pour `owner.account_change_*` (alerte de sécurité). Implémentation aux lots 2 et 3 ; le lot 1 livre seulement la clé de lecture.
Amendement accepté (2026-11-19, ADR 0033, lot 1) : types `messaging.message_received` (audience staff : propriétaire, administrateur, gestionnaire, ou le seul gestionnaire assigné ; in_app et e-mail), `tenant.message_received` et `owner.message_received` (in_app, e-mail et push) produits par Messaging (`ConversationMessagePosted`). Clé de dédoublonnage `conversation:{fil}:{dernière lecture du destinataire ou never}` : une notification par fil tant qu'il n'est pas lu. Le locataire est visé par sa seule fiche (`NotificationInput::partyId`), le mandant par ses comptes `holder` et `representative`. Gabarits sans texte du message, push générique. Revue de sécurité du lot 1 : types `messaging.message_redacted`, `tenant.message_redacted` et `owner.message_redacted` (retrait d'un message par l'organisation, seul auteur prévenu par `NotificationInput::recipientId`, in_app et e-mail, clé `conversation:{fil}:redacted:{message}`, sans texte ni motif) ; fenêtre de lecture vérifiée par `LeaseDirectory::visibleToTenant` et `MandateDirectory::visibleToOwner` avant d'écrire.
Amendement accepté (2026-11-19, ADR 0033, lot 3) : audience `account` (aucune organisation : `notifications.organization_id` nul, imposé par un `CHECK`, lecture par `user_id` seul) et type `account.support_replied` (le seul demandeur, clé coalescente `ticket:{id}` portant sa dernière lecture) ; types d'équipe `support.access_requested|access_used|access_emergency` (rôles `owner` et `admin`, centre et e-mail non désactivables, exception à « l'e-mail n'est jamais obligatoire » comme `owner.account_change_*`) ; gabarits sans motif ni nom d'opérateur ; `NOTIFICATIONS_ACCOUNT_URL` pour les liens.
Amendement accepté (2026-11-19, ADR 0034) : types `tenant.charge_statement_issued` (in_app et e-mail, clé `charge_statement:{id}`) et `staff.charges_regularization_due` (propriétaire, administrateur, gestionnaire ; in_app) ; gabarits sans montant ni PDF.

## Contexte

Les écrans des applications (cloche de l'en-tête, page « Toutes les notifications », préférences du compte) existent avec des données de démonstration. Aucun module n'écoute les événements de Rent, Recovery et Leases, et le seul e-mail déclenché par un événement (`SendBundleLink`, Recovery) est un écouteur minimal. Il faut un centre de notifications par compte, un e-mail et un push mobile pilotés par des préférences, sans que le contenu ou l'existence d'une notification franchisse une organisation.

## Décision

### Modèle
- `notifications` : une ligne par destinataire et par événement. Colonnes : `user_id` (compte destinataire, clé étrangère vers `users`), `organization_id` (clé étrangère vers `organizations`), `audience` (`staff` : membre d'une organisation ; `tenant` : locataire), `type`, `dedup_key`, `title`, `body`, `link`, `lease_id` (clé de lecture du locataire, sans clé étrangère), `in_app`/`email`/`push` (canaux retenus à la création, figés), `read_at`, `archived_at`, `emailed_at`, `pushed_at`. Titre et corps sont rendus en français **à la création** par un gabarit du type (`Support/Templates`) : modifier un gabarit ne réécrit pas l'historique. Le lien est relatif (`/finances/impayes`, `/baux/{id}`) ; l'application l'ouvre dans son propre domaine.
- Aucune suppression physique : lu = `read_at`, archivé = `archived_at` (posé à la suppression du compte, ADR 0004). Les clés étrangères vers `users` sont sûres parce qu'un compte n'est jamais effacé (`SoftDeletes`).
- Les trois modèles (`Notification`, `NotificationPreference`, `PushToken`) appartiennent à un **compte**, pas à une organisation : ils rejoignent la liste hors organisation de `ArchTest.php`. L'isolation est portée par la clé de lecture ci-dessous, pas par le scope d'organisation.

### Catalogue initial

| Type | Source | Audience | Rôles destinataires | Canaux par défaut | Non désactivable |
|---|---|---|---|---|---|
| `rent.overdue` loyer en retard | `InstallmentOverdue` | staff | propriétaire, administrateur, gestionnaire, comptable | in_app, e-mail, push | – |
| `rent.payment_recorded` paiement enregistré | `PaymentRecorded` | staff | idem | in_app | – |
| `rent.payment_cancelled` paiement annulé | `PaymentCancelled` | staff | idem | in_app, e-mail | in_app |
| `recovery.bundle_sent` dossier transmis | `RecoveryBundleSent` | staff | idem (lecture du recouvrement, ADR 0023) | in_app | in_app |
| `compliance.certificate_to_renew` pièce à renouveler | `CertificateDeadlineReached` | staff | propriétaire, administrateur, gestionnaire | in_app, e-mail | – |
| `compliance.certificate_expired` pièce expirée | `CertificateDeadlineReached` | staff | idem | in_app, e-mail, push | in_app |
| `lease.signed` bail signé | `LeaseSigned` | staff | propriétaire, administrateur, gestionnaire (jamais le comptable : la note du bail lui est masquée, ADR 0020) | in_app | – |
| `tenant.notice_issued` avis d'échéance émis | `NoticeIssued` | tenant | locataires du bail | in_app, e-mail, push | – |
| `tenant.receipt_issued` quittance émise | `ReceiptIssued` | tenant | idem | in_app, e-mail, push | – |
| `tenant.payment_recorded` paiement enregistré | `PaymentRecorded` | tenant | idem | in_app, e-mail | – |
| `tenant.payment_cancelled` paiement annulé | `PaymentCancelled` | tenant | idem | in_app, e-mail | in_app |
| `tenant.lease_signed` bail signé | `LeaseSigned` | tenant | idem | in_app, e-mail | – |

- Un type appartient à une seule audience : le texte et les préférences diffèrent entre l'équipe et le locataire.
- L'avis d'échéance n'est pas notifié à l'équipe : c'est elle qui l'émet, un lot de 200 avis produirait 200 notifications sans information.
- Le locataire n'est pas notifié d'un impayé : la relance relève de Recovery et de ses formalités.
- Le canal e-mail n'est jamais obligatoire : seule la présence dans le centre (`in_app`) est verrouillée pour les événements qui modifient une situation financière ou probante.
- **Hors vague 1, à faire** : « invitation reçue » (les deux invitations envoient déjà leur propre e-mail et l'invité peut ne pas avoir de compte, il faudra un événement d'Identity/Organizations et une résolution du compte par adresse vérifiée) et « message reçu » (Messaging n'émet aucun événement). Le catalogue est une énumération : un type s'ajoute avec son gabarit, sans migration.

### Destinataires et cloisonnement
- Résolus **au moment de l'événement**, sous le contexte de l'organisation de l'événement (`CurrentOrganization::run`) : équipe par `Organizations\PublicApi\MembershipDirectory::activeTeam()` filtrée par rôle ; locataires par `Leases\PublicApi\LeaseParticipants::tenantsAt()` puis `Parties\PublicApi\PartyLinks::accountsOf()` (compte rattaché à la partie, ADR 0024). Jamais d'adresse ni de compte fournis par un client.
- **Clé de lecture**, appliquée à chaque lecture et à chaque marquage « lu » : le destinataire est le compte connecté, et la ligne n'est visible que si
  - audience `staff` : le compte est **encore membre actif** de l'organisation de la ligne et son rôle **actuel** lit ce type ;
  - audience `tenant` : le bail figure parmi `LeaseDirectory::visibleToTenant()` (rattachement, rôle de locataire, période de grâce de 12 mois, ADR 0024).
  Un ex-membre, un rôle rétrogradé ou un locataire hors grâce ne voit donc plus rien, même de ce qu'il a reçu. Une ligne hors clé répond 404 `notification_not_found`, comme une ligne inconnue.
- Le filtre par organisation de l'API (`?organization=`) ne fait que restreindre la lecture ; il ne donne accès à rien de plus.

### Canaux et préférences
- Canaux : `in_app`, `email`, `push`. Préférence par **compte × type × canal** (`notification_preferences`, clé unique) ; seules les valeurs qui s'écartent des défauts du catalogue sont stockées. Un canal verrouillé ne se désactive pas : `PUT` répond 422 `notification_channel_mandatory`.
- Une notification n'est créée que si au moins un canal est actif : canal désactivé, rien n'est écrit pour lui. Les canaux retenus sont figés sur la ligne.
- L'e-mail part par le mailer Laravel existant (SMTP, aucun fournisseur imposé), vers l'adresse **vérifiée** du compte. Le lien du message est `https://` complet, seul sur sa ligne, construit depuis `NOTIFICATIONS_ORGANIZATION_URL` / `NOTIFICATIONS_TENANT_URL` ; sans base `https://` valide, le message part sans lien.
- Hors périmètre, écartés : résumé quotidien ou hebdomadaire et plages de silence (présents dans la maquette, sans valeur tant que les envois sont peu nombreux).

### Push mobile
- `push_tokens` : `user_id`, `access_token_id` (identifiant du jeton Sanctum mobile qui l'a enregistré, sans clé étrangère : la table est celle de Sanctum), `platform` (`ios`, `android`), `token` **chiffré** par `APP_KEY` (cast `encrypted`), `token_hash` (SHA-256, unique : un jeton d'appareil n'appartient qu'à un compte à la fois), `device_name`, `revoked_at`. Sur iOS comme sur Android, l'application fournit un jeton d'enregistrement FCM (le SDK Firebase enveloppe APNs) : un seul pilote.
- Enregistrement : `POST /me/push-tokens`, réservé à une session portant la capacité `mobile` (sinon 403). Rejouable (même jeton : mise à jour) ; un jeton déjà connu d'un autre compte lui est retiré. Le jeton n'est **jamais renvoyé** ensuite (la ressource expose l'identifiant, la plateforme, le nom et la date).
- Révocation : `DELETE /me/push-tokens/{id}` (le sien seulement, 404 sinon), suppression du compte, et **à l'envoi** : un jeton n'est utilisé que si son jeton Sanctum existe encore et n'a pas expiré. La déconnexion (`DELETE /auth/token`), la révocation d'appareil (`DELETE /me/devices/{id}`) et le changement de mot de passe suppriment le jeton Sanctum : plus aucun push n'y part, sans modifier Identity. La commande quotidienne `notifications:prune-push-tokens` marque ensuite ces jetons révoqués et efface leur valeur chiffrée.
- Pilote : interface `PushDriver` (justifiée par deux implémentations réelles, ADR 0026) ; `FcmDriver` (HTTP v1, jeton OAuth2 d'un compte de service signé RS256 avec `firebase/php-jwt`, mis en cache) et `FakeDriver` (tests). `NOTIFICATIONS_PUSH_DRIVER` vaut `none` par défaut : rien ne part. Activation : `fcm` avec `NOTIFICATIONS_FCM_PROJECT_ID` et `NOTIFICATIONS_FCM_CREDENTIALS` (chemin d'un fichier hors dépôt) ; aucun secret dans le code.
- **Contenu minimal** : titre générique `eGuardImmo`, texte générique du type (« Un loyer est en retard »), jamais de montant, de nom, de référence de bail ni d'adresse ; la charge utile porte seulement `notification_id` et le lien relatif.
- Un échec de push (réseau, 5xx, jeton refusé) n'arrête jamais le reste : le pilote renvoie un résultat (`sent`, `invalid_token`, `failed`), jamais d'exception ; `invalid_token` révoque le jeton ; l'échec est journalisé avec l'identifiant de la notification, sans jeton ni donnée personnelle.

### Idempotence, file, débit
- **Une notification par événement et par destinataire** : clé unique `(user_id, type, dedup_key)`. La clé dérive de l'objet (`overdue:{échéance}`, `payment_recorded:{paiement}`, `certificate:{pièce}:{état}:{échéance}`…). Un événement rejoué ne crée rien et n'envoie rien : `emailed_at` et `pushed_at` rendent aussi chaque envoi idempotent.
- Écouteurs et envois **en file** (5 essais, attente croissante). Les événements restent émis après commit (ADR 0007). Rattrapage : un événement perdu côté Rent est rattrapé par `rent:generate` (impayés) ; les pièces à échéance par `documents:flag-certificates`, quotidienne, qui réémet pour les échéances atteintes dans les 7 derniers jours — la clé d'idempotence rend la réémission sans effet.
- Débit : routes de lecture 120/min, d'écriture 60/min, enregistrement d'un jeton 10/min, par compte ; plafond de push par compte et par heure (`NOTIFICATIONS_PUSH_PER_HOUR`, 20) au-delà duquel seul le push est omis.

### Écouteurs migrés ou non
- `Recovery\Listeners\SendBundleLink` **reste dans Recovery**. Son destinataire est un commissaire de justice, partie sans compte, donc hors préférences ; l'événement porte un jeton en clair qu'il ne faut pas copier dans une table de notifications ; ses tests décrivent le comportement observable. Notifications écoute le même événement pour le seul avis `recovery.bundle_sent` de l'équipe (jamais le jeton).

### API (`/api/v1`, `auth:sanctum` + `no-operator-token`)
`GET /notifications` (curseur, `?unread=1`, `?organization=`), `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `GET|PUT /notifications/preferences`, `POST /me/push-tokens`, `DELETE /me/push-tokens/{id}`. Erreurs RFC 9457 (ADR 0014) ; ressources dédiées. Le contrat de liste reprend le modèle du shell : `id`, `tone`, `title`, `detail`, `unread`, `href`.

### Dépendances (amende l'ADR 0005)
Notifications → Identity (`User`, exception d'authentification), Organizations (`MembershipDirectory`, `OrganizationDirectory`), Leases (`LeaseDirectory`, `LeaseParticipants`), Parties (`PartyLinks`). Rent, Recovery, Leases, Documents ⇢ événements ⇢ Notifications. Identity ⇢ `AccountDeleted` ⇢ Notifications. Aucun module n'appelle Notifications.

## Options écartées

- **Une table de notifications par organisation** : un compte multi-organisations lirait N tables ; la clé de lecture suffit.
- **Rattacher la visibilité à l'organisation à la création seulement** : un ex-membre garderait l'historique de l'organisation qu'il a quittée.
- **Copier le corps du message au moment de la lecture** (rendu à la volée) : une notification changerait de sens après une modification de gabarit ou de donnée.
- **Montants et noms dans le push** : l'écran verrouillé d'un téléphone n'est pas un canal confidentiel.
- **Révoquer les jetons push par des écouteurs dans Identity** : plusieurs chemins suppriment un jeton Sanctum (déconnexion, appareil, mot de passe, expiration) ; la vérification à l'envoi les couvre tous sans créer de lien Identity → Notifications.
- **Migrer `SendBundleLink`** : destinataire sans compte, jeton en clair dans l'événement, aucun gain pour l'utilisateur.
- **Résumé quotidien, plages de silence** : écartés (voir plus haut).
- **Fournisseur imposé (OneSignal, Brevo…)** : le mailer SMTP existant et FCM suffisent ; un fournisseur s'ajoutera derrière `PushDriver` s'il se justifie.
- **Un pilote APNs direct** : FCM l'enveloppe ; deux pilotes sans besoin démontré.

## Conséquences

- Nouveaux événements, additifs : `Rent\Events\{NoticeIssued, ReceiptIssued, PaymentRecorded, PaymentCancelled}` et `Documents\Events\CertificateDeadlineReached` (avec la commande `documents:flag-certificates`) ; `Parties\PublicApi\PartyLinks::accountsOf()`.
- Configuration : `NOTIFICATIONS_ORGANIZATION_URL`, `NOTIFICATIONS_TENANT_URL`, `NOTIFICATIONS_PUSH_DRIVER`, `NOTIFICATIONS_FCM_PROJECT_ID`, `NOTIFICATIONS_FCM_CREDENTIALS`, `NOTIFICATIONS_PUSH_PER_HOUR`. Sans file de travail (`queue:work`), rien ne part : la file est déjà requise par Rent.
- Le périmètre de biens d'un membre (`scope`, Organizations) n'est appliqué nulle part dans les autres modules ; les notifications suivent le rôle seul, comme le reste, jusqu'à ce que ce périmètre soit tenu côté lectures.
- Tests : un cas nominal par type produit par un événement réel, préférences respectées, canaux verrouillés, destinataires par rôle, 401/404 inter-comptes, ex-membre sans accès, push par `FakeDriver` (envoi, jeton révoqué, jeton invalide), idempotence au rejeu, lu/non lu, curseur.

## Amendement du 2026-11-19 (ADR 0032, lot 3)

- Audience `owner` : colonne `notifications.party_id` (sans clé étrangère) ; destinataires = comptes `holder` et `representative` du mandant (`OwnerLinks::accountsOfMandant`) ; lecture par `MandateDirectory::visibleToOwner` (accès actif et fenêtre, hors `co_owner`) ; préférences : types `owner.*` seulement pour un compte qui a un accès vivant.
- Types : `owner.approval_requested|approval_expired|approval_recorded|report_published|payout_executed|payout_returned|account_change_requested|account_change_approved|account_change_contested` ; équipe : `ownerfunds.account_change_requested|contested` (rôles `owner`, `admin`, `comptable`), `mandates.end_requested` (rôles `owner`, `admin`, `manager`).
- Non désactivables : centre sur `owner.approval_requested`, `owner.payout_returned` et les types d'équipe de compte ; centre et e-mail sur `owner.account_change_*`. Gabarits sans montant, nom ni IBAN ; `NOTIFICATIONS_OWNER_URL` pour les liens.

## Amendement du 2026-11-19 (ADR 0033, lots 5 et 6)

- Types `tenant.announcement` et `owner.announcement` : annonce d'une diffusion lue dans le centre (`dedup_key = campaign:{id}`, `party_id` = fiche de la ligne d'envoi). « Lu » = lecture in_app de l'annonce ; aucun pixel ni lien de suivi dans les e-mails.
- Transport : Mailtrap par relais SMTP (flux transactionnel pour les notifications, flux Bulk pour les diffusions, `MAIL_PROVIDER`, `MAIL_BULK_MAILER`) ; sans `MAIL_PROVIDER` aucun envoi réel de diffusion (503 `campaign_sending_disabled`). Événements par `POST /webhooks/mail/mailtrap` : signature HMAC-SHA256 du corps brut (`Mailtrap-Signature`, `MAIL_WEBHOOK_SECRET_MAILTRAP`), comparaison en temps constant, idempotence sur l'identifiant d'événement ; un rebond dur ou une plainte alimente la liste de suppression de la plateforme, une désinscription du fournisseur celle de l'organisation.
- Désinscription : `GET /mail/unsubscribe/{token}` affiche une page sans effet, `POST` désinscrit (RFC 8058, un clic) ; jeton signé (`MAIL_UNSUBSCRIBE_KEY`), expirant (`MAIL_UNSUBSCRIBE_TTL_DAYS`), idempotent.
- Plafonds : `CAMPAIGN_DAILY_RECIPIENTS` (2 000 destinataires par 24 h et par organisation) et 10 envois par heure, vérifiés sous verrou d'organisation.

## Amendement du 2026-11-20 (ADR 0036)

- Seize types ajoutés. Équipe (`owner`, `admin`, `manager`) : `leases.notice_requested` (clé `notice_request:{id}`, centre verrouillé), `leases.notice_unacknowledged` (`…:late`), `leases.insurance_submitted` (`insurance:{id}`, centre seul), `inspections.remark_received` (`remark:{id}`), `parties.contact_update_requested` (`contact_update:{id}`, centre seul). Locataire : `tenant.notice_acknowledged|closed` (`notice_request:{id}:{état}`, fiche déclarante, centre verrouillé), `tenant.insurance_accepted|rejected` (`insurance:{id}:{état}`, fiche déposante), `tenant.insurance_expiring|expired|reminder` (locataires du bail, centre, e-mail, push), `tenant.document_shared` (`lease_document:{id}`, bail ou fiche visée), `tenant.inspection_published` (`inspection:{id}`), `tenant.inspection_remark_answered` (`remark:{id}:answered`, auteur), `tenant.online_payment_failed` (`online_payment:{id}:failed`, payeur).
- Gabarits sans motif, montant, nom, assureur ni adresse ; push générique. Le succès d'un paiement reste notifié par `tenant.payment_recorded`. L'e-mail de sécurité d'un changement d'adresse part d'Identity, hors centre.

## Amendement du 2026-11-20 (ADR 0040)

- Type ajouté : `owner.document_shared` (clé de déduplication `document:{id}`, destinataire : le mandant), gabarit sans nom de fichier ni montant, push générique.

## Amendement du 2026-11-21 (ADR 0037)

- Types ajoutés : `organizations.suspended` et `organizations.reactivated` (`owner`, `admin`, centre et e-mail non désactivables), `privacy.request_forwarded` (`owner`, `admin`, non désactivable), `account.privacy_completed`, `account.export_ready` et `account.privacy_received` (audience `account`, envoyé dès la réception d'une demande, y compris saisie par courrier, non désactivable). Il n'y a pas de centre de notifications pour les opérateurs : alertes par `CONSOLE_TEAM_ADDRESS`.

## Amendement du 2026-11-21 (ADR 0039)

- Type ajouté : `owner.tax_statement_published` (audience `owner`, clé de déduplication `tax_statement:{id}`, destinataire : le mandant), gabarit sans montant, lien `/fiscalite`, push générique ; émis par l'événement `TaxStatementPublished`.

## Amendement du 2026-11-25 (ADR 0042)

- Catalogue étendu (`account.marketing`, `account.service_message`, rappels `account.reminder_*`, `reminders.*`, `tenant.reminder_rent_due|unpaid`), relance de courtoisie du locataire désactivée par défaut, et réglage de plateforme coupant un canal non verrouillé pour tous ; seule exception à « adresse vérifiée » : `account.reminder_email_unverified`.
