# ADR 0016 — Journal d'activité et historique des entités

Statut : accepté (2026-11-13). Complète l'ADR 0002 (sécurité) et l'ADR 0004 (console opérateur).
Amendement accepté (2026-11-19, ADR 0035) : actions `banking.account.created|replaced|closed` (la modification du libellé passe par le trait `Auditable`), `banking.statement.imported|voided|downloaded`, `banking.line.ignored|restored|settled`, `banking.match.created|undone`, `banking.suggestions.accepted`, `banking.rule.created|updated|disabled`, `banking.reconciliation.validated`, `banking.verify.anomaly` ; `OrganizationBankAccount` et `BankStatementLine` sont `Auditable` avec `auditExcluded` (empreintes, libellé, contrepartie, références) ; propositions (`bank_suggestions`) hors `Auditable`, cache recalculable ; aucun libellé ni IBAN dans l'audit, les logs ni les notifications.
Amendement (2026-11-19, ADR 0033, lot 1) : actions `messaging.conversation.opened|closed|reopened|assigned|muted|unmuted`, `messaging.message.redacted` et `messaging.messages.erased`, et `documents.file.purged` avec `early` pour le retrait d'une pièce avant la fin de sa conservation. `ConversationMessage` est `Auditable` avec `body` et `redaction_reason` exclus : le texte d'un message n'entre jamais dans le journal.
Amendement (2026-11-19, ADR 0033, lot 3) : actions `messaging.support_access.requested|granted|refused|revoked|expired|emergency|reviewed`, `messaging.ticket.auto_resolved`, `console.support_access.read|denied` (ressource et périmètre dans `metadata`, jamais de contenu). Les lectures du support sont journalisées une par une, y compris le refus faute d'accès.
Amendement (2026-11-19, ADR 0034) : actions `charges.expense.recorded|approved|cancelled`, `charges.exercise.computed|issued|discarded`, `charges.statement.issued|rectified|plan_recorded|downloaded`, `charges.file.shared|unshared`, `charges.prescription.acknowledged` ; `rent.refund.recorded` ; ni montant, ni nom, ni libellé libre dans `metadata`.

Amendement (2026-11-19, ADR 0033, revue du lot 3) : la console ne sert le détail (`changes`, `metadata`, identité de l'auteur, `ip`, `user_agent`, identifiant du sujet) d'une entrée portant une `organization_id` qu'à l'opérateur qui a un accès de support vivant sur cette organisation (périmètre `settings`) ; sans cet accès l'entrée est expurgée (action, date, organisation, type du sujet, `request_id`, route). Les entrées sans organisation restent servies en entier. `SupportTicket` exclut `subject` et `organization_name` du différentiel.

## Contexte

La console opérateur doit pouvoir consulter :
- qui a fait quoi, quand, d'où et par quel canal ;
- l'historique de chaque entité, avec les valeurs avant et après.

Chaque saisie de chaque module doit y figurer, sans que chaque module réécrive cette mécanique. Un journal d'audit en ajout seul existe déjà (`app/Shared/Audit`) pour les événements de sécurité.

## Décision

### Une seule table : `audit_logs`

Le journal d'audit sert aux événements de sécurité et à l'historique des entités. Une ligne contient :

| Colonne | Contenu |
|---|---|
| `id` | UUID v7 (ADR 0015) |
| `occurred_at` | horodatage en microsecondes |
| `action` | `{domaine}.{verbe}` : `auth.login.succeeded`, `lease.updated`… |
| `actor_user_id` | auteur (null pour le système ou un anonyme) |
| `organization_id` | organisation concernée, si elle est connue (ADR 0006) |
| `subject_type`, `subject_id` | entité concernée : alias de la morph map et UUID |
| `changes` | pour une modification : `{attribut: {old, new}}` |
| `metadata` | contexte libre, sans secret |
| `request_id` | identifiant de corrélation de la requête (`X-Request-Id`) |
| `route` | nom de la route HTTP, ou null hors HTTP |
| `ip`, `user_agent` | origine |

### Deux façons d'écrire, aucune à réécrire

1. **Automatique** : un modèle qui utilise le trait `App\Shared\Audit\Auditable` journalise ses créations, modifications, suppressions et restaurations, avec le différentiel des attributs.
   - L'écriture a lieu dans la transaction de l'opération : si elle est annulée, la ligne de journal l'est aussi. Hors transaction, une modification pourrait rester sans sa ligne de journal : une Action qui écrit un modèle `Auditable` ouvre donc toujours une transaction.
   - Exclus d'office : horodatages, attributs `#[Hidden]` ou chiffrés (`encrypted*`, `AsEncrypted*`). Ils sont notés comme modifiés, avec la valeur `[masqué]`.
   - Le modèle peut ajouter ses propres exclusions (`auditExcluded()`) et ses attributs masqués (`auditMasked()` : téléphone, IBAN, pièce d'identité).
   - Une modification qui ne touche que des attributs exclus n'est pas journalisée.
2. **Explicite** : `RecordAudit::handle($action, subject: $modele, metadata: […])` pour un événement métier ou de sécurité qui n'est pas une écriture de modèle (connexion, signature, export, consultation sensible).

Règles pour les modules :
- Tout modèle métier utilise `Auditable`. Une exception (table de cache, compteur) se justifie en revue.
- Une écriture de masse par le query builder (`->update()` ou `->delete()` sur une requête) contourne les événements Eloquent. Elle est interdite sur un modèle `Auditable`, sauf si elle est suivie d'un `RecordAudit` explicite qui décrit l'opération.
- Jamais de secret dans `metadata` : jeton, mot de passe, code OTP, IBAN en clair. Un e-mail d'une personne inconnue est stocké en HMAC (`RecordAudit::fingerprint`).

### Consultation par la console

- `GET /api/v1/console/activity` est réservé au jeton opérateur (`space:operator`, ADR 0004). On y filtre par auteur, entité (type et identifiant), action (préfixe), organisation, identifiant de requête et période (intervalle semi-ouvert). La pagination est par curseur, triée de la plus récente à la plus ancienne.
- `GET /api/v1/console/activity/{id}` renvoie le détail, différentiel compris.
- Une entrée qui porte une organisation n'est servie en entier qu'avec un accès de support vivant sur celle-ci (ADR 0033, décision 9) ; sinon elle est expurgée, y compris sous le filtre `organization`. Le consentement de l'organisation ne se contourne donc pas par le journal.
- L'historique d'une entité est le même endpoint filtré sur `subject_type` et `subject_id`.
- Chaque consultation de la console est elle-même journalisée (`console.activity.listed`, `console.activity.viewed`).

### Immutabilité

- Le modèle interdit modification et suppression. Le query builder du modèle interdit `update` et `delete`.
- La base l'impose aussi, quel que soit le chemin (`DB::table`, `toBase()`, `increment`, `truncate`) : déclencheurs `BEFORE UPDATE OR DELETE` et `BEFORE TRUNCATE` sous PostgreSQL, équivalents sous SQLite et MySQL, posés par la migration de la table.
- Les chaînes venues du client (user-agent, métadonnées, différentiel) sont ramenées en UTF-8 valide avant écriture : une ligne invalide ne pourrait plus être lue ni retirée.
- En production, le compte SQL de l'application n'a que `INSERT` et `SELECT` sur `audit_logs`. C'est une action d'exploitation.

## Options écartées

- **Table d'historique par module** (`lease_histories`…) : même code réécrit 20 fois, et aucune vue transverse pour la console.
- **Deux tables (sécurité et activité)** : la console devrait fusionner deux sources pour suivre un incident. La séparation n'apporte rien tant que les deux ont le même cycle de vie.
- **Paquet tiers (spatie/laravel-activitylog)** : il suppose des identifiants entiers par défaut et une table modifiable. Il ajoute une dépendance pour ce que fournissent un trait et une table.
- **Écriture asynchrone en file** : on perdrait la garantie « journalisé si et seulement si commité ».
- **Event sourcing** : hors de proportion avec le besoin (consultation et preuve).

## Conséquences

- Volume : une ligne par écriture. Une politique de rétention (durée par type d'action, conforme RGPD et aux obligations de conservation) reste à fixer avant la production. Aucune purge n'existe pour l'instant.
- Les données personnelles des différentiels portant une organisation ne sont visibles que d'un opérateur qui a un accès de support vivant sur elle ; celles de la plateforme restent visibles des opérateurs. D'où les attributs masqués, la consultation réservée à la console et la journalisation des lectures.
- `request_id` relie le journal, les logs applicatifs et les erreurs (ADR 0014 : membre `request_id` des problèmes 5xx).

## Amendement du 2026-11-19 (ADR 0033, lots 5 et 6)

Actions ajoutées, via `RecordAudit` (jamais de texte, d'adresse ni de nom de fichier dans `metadata`) : `notifications.campaign.created|updated|scheduled|sent|cancelled|test_sent|attachment_added|attachment_removed|content_purged|addresses_purged`, `notifications.mail.unsubscribed` ; `documents.file.scanned` (résultat `clean|infected|unverifiable`) ; `messaging.conversation.content_purged`, `messaging.ticket.content_purged`, `messaging.ticket.attachments_purged`. La rétention du journal reste à fixer.

## Amendement du 2026-11-20 (ADR 0036)

- Actions ajoutées, sans motif, adresse, assureur, numéro de contrat, code ni texte libre : `leases.document.shared|unshared`, `leases.notice_request.submitted|acknowledged|withdrawn|closed|proof_downloaded`, `leases.notice_requests.erased`, `leases.insurance.submitted|accepted|rejected|withdrawn|reminded`, `identity.email_change.requested|confirmed|cancelled`, `identity.phone.updated`, `parties.contact_update.requested|applied|dismissed`, `inspections.inspection.recorded|updated|published`, `inspections.remark.created|answered`, `inspections.remarks.erased`, `payments.account.onboarded`, `payments.online_payment.created|processing|succeeded|failed|cancelled|expired`.
- Revue de sécurité : `leases.insurance.downloaded` (téléchargement d'une attestation par l'équipe), `payments.online_payment.mismatch` (succès du PSP au montant ou à la devise discordants, ou sans l'un d'eux), `rent.card_payment.rejected` (encaissement carte refusé après toutes les tentatives). Même règle : aucune donnée personnelle dans `metadata`.

## Amendement du 2026-11-20 (ADR 0040)

- Actions ajoutées, sans montant ni donnée personnelle : `mandates.terms.amended` (existante, plus `signed_file_id`), `mandates.document.shared|unshared`, `documents.library.filed|archived|restored`, `organizations.member.scope_refused` ; les conditions par défaut (`mandate_term_defaults`) sont journalisées par le trait `Auditable`. La simulation d'honoraires ne journalise rien : elle n'écrit rien.

## Amendement du 2026-11-21 (ADR 0037)

- Actions ajoutées : `identity.operator.roles_changed`, `console.account.searched|viewed|sessions_revoked|suspended|suspension_reviewed`, `identity.account.reactivated|two_factor_reset`, `console.organization.viewed`, `organizations.organization.suspended|reactivated`, `operations.approval.requested|approved|rejected|cancelled|expired|executed|failed`, `subscriptions.plan_version.created|published|archived`, `subscriptions.override.granted|revoked`, `subscriptions.subscription.created|trial_ended`, `privacy.request.received|verified|extended|forwarded|exported|completed|refused|handled`, `privacy.export.downloaded`, `operations.backup.recorded`. Aucune adresse, nom, motif ni texte libre en clair ; l'adresse recherchée est une empreinte.
- Conservation proposée, à confirmer : approbations 5 ans ; demandes RGPD et journal de preuve 5 ans après clôture ; export RGPD 30 jours ; exécutions planifiées : la dernière seulement ; rapports de sauvegarde 13 mois (purge non implémentée).

## Amendement du 2026-11-21 (ADR 0039)

- Actions ajoutées. `investments.acquisition.created`, `investments.loan.created|imported|prepaid|attested|fee_added|voided` ; `tax.summary.finalized|rectified|published|downloaded|exported`, `tax.verify.anomaly` ; `reporting.forecast.assumptions_updated`, `reporting.export.generated` (types `prets-immobiliers` et `rentabilite-par-bien`, nombre de lignes). Ni montant, ni libellé libre, ni référence de contrat dans `metadata` ; `forecast_assumptions` exclut du journal d'avant/après ses lots de vacance et ses dépenses ponctuelles.
