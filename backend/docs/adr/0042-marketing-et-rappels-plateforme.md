# ADR 0042 — Console : campagnes marketing de la plateforme, notifications et rappels automatiques

Statut : proposé (2026-11-25), implémentation demandée par l'utilisateur ; les points de la dernière section restent à valider. Amende l'ADR 0027 (catalogue, relance du locataire, réglage de plateforme), l'ADR 0033 (diffusions émises par la plateforme) et l'ADR 0037 (familles « marketing » et « notifications » de la console ; paramètres de notification modifiables en ligne).

## Contexte

La console doit envoyer des campagnes (e-mail avec images, ou push) à des groupes ou à des personnes, et régler les notifications et rappels automatiques. L'existant ne couvre que les diffusions d'une organisation (texte brut) et un catalogue de notifications non réglable.

## Décision

1. **Hébergement : module Notifications** (ADR 0005, campagnes). Il réutilise le fournisseur d'e-mail, le canal push, la désinscription, la liste d'opposition et le webhook.
2. **Aucun nouveau lien entre modules.** Les groupes et les déclencheurs de rappel passent par deux registres de `app/Shared` (même principe que `ApprovalHandlers`) : chaque module interroge ses propres tables dans ses `Queries/` et s'enregistre dans son `ServiceProvider`.
   - `App\Shared\Audience\AudienceRegistry` : `register(string $code, Closure(?int $inactivityDays): iterable<string> $accountIds)`.
   - `App\Shared\Reminders\ReminderRegistry` : `register(string $code, Closure(ReminderWindow): iterable<ReminderHit>)` ; `ReminderWindow{from,to}` ; `ReminderHit{subjectId, since, accountId?, organizationId?, leaseId?, params}`.
3. **Gardes** : `/api/v1/console/*` avec `auth:sanctum`, `space:operator`, `operator:admin`, `Cache-Control: private, no-store`, et `operator-proof` sur **chaque écriture** (ADR 0037, invariant 4).
4. **Consentement** (à confirmer par un juriste) : catégorie `marketing` (type `account.marketing`, **aucun canal par défaut**, adhésion par les préférences du compte) ; catégorie `service` (type `account.service_message`, tous canaux par défaut, désactivables). Chaque e-mail porte le lien et les en-têtes de désinscription (RFC 8058) ; la désinscription coupe l'e-mail de la catégorie pour le compte.
5. **Destinataires : des comptes seulement**, jamais une adresse libre. Vérifiés, non supprimés, non suspendus. Aucune adresse n'est copiée dans les lignes d'envoi (empreinte seule).
6. **HTML** assaini côté serveur (`symfony/html-sanitizer`) ; images en `cid:` uniquement (embarquées : aucune route publique, aucune image distante, aucun pixel ni lien suivi). Une image déposée mais non citée part en pièce jointe. JPEG, PNG, GIF, contenu vérifié.
7. **Rappels** : catalogue fermé en code, **tous désactivés** à l'installation. Fenêtre `[maintenant - délai - répétition × (max - 1) - 7 j ; maintenant - délai]` : activer un rappel ne relance pas l'arriéré ancien. Échéance à venir (`before`) : `[maintenant ; maintenant + délai]`. Clé `{code}:{sujet}:{date de départ}:{occurrence}`. Commande `notifications:send-reminders` chaque jour à 09:00, plafonnée par passage.
8. **Réglage de plateforme** des notifications existantes : un canal non verrouillé peut être coupé pour tous ; un canal verrouillé (ADR 0027) ne le peut jamais.
9. **Relance du locataire** (amende l'ADR 0027) : rappel de courtoisie, désactivé par défaut, sans montant, qui n'est pas une mise en demeure.

## Données (UUID v7, `datetime(6)`, `Checks::add`, hors organisation, liste `ArchTest`)

- `platform_campaigns` : `channel`, `category`, `audience`, `inactivity_days`, `recipient_user_ids` JSON, `subject`, `html`, `push_title`, `push_body`, `link`, `status` (`draft|sending|sent`), `recipient_count`, `created_by_user_id`, `sent_by_user_id`, `sending_started_at`, `sent_at`, `lock_version`.
- `platform_campaign_images` : `campaign_id`, `path`, `name`, `mime`, `size_bytes`.
- `platform_campaign_deliveries` : `campaign_id`, `user_id`, `email_hash`, `status`, `provider_message_id`, `attempted_at`, `sent_at`, `bounced_at`, `unsubscribed_at`, `error_code` ; unique `(campaign_id, user_id)`.
- `reminder_rules` : `code` unique, `enabled`, `delay_days`, `repeat_every_days`, `max_occurrences`, `channels` JSON, `updated_by_user_id`, `last_run_at`, `last_sent_count`. Absence de ligne = valeurs par défaut.
- `notification_platform_settings` : `(type, channel)` unique ; une ligne = canal coupé.

Envoi : comme l'ADR 0033 (réservation conditionnelle `queued` → `sending`, paquets de 100, jamais de renvoi d'une issue inconnue ; reprise `notifications:resume-platform-campaigns` toutes les 10 minutes). Plafond par campagne `MARKETING_MAX_RECIPIENTS` (20 000), refus et non troncature. `REMINDERS_MAX_PER_RUN` (2 000). Débits : écritures 30/min, envoi 10/h, test 10/h, estimation 15/min.

## API (`/api/v1/console`, noms `notifications.console.*`)

### Marketing

- `GET /marketing/options` → `data{channels:[{channel:"email"|"push", enabled, reason|null}], categories:[{code,label,description}], audiences:[{code,label,description,accepts_inactivity_days}], limits{subject:140, push_title:65, push_body:240, html_bytes:200000, images:5, image_bytes:2097152, total_image_bytes:6291456, selected_recipients:500}}`.
- Groupes : `all_accounts`, `agency_members`, `individual_landlords`, `tenants`, `owners`, `travelers`, `inactive_accounts` (avec `inactivity_days` 7 à 365), `selected` (liste d'adresses).
- `GET /marketing/campaigns?status&cursor&per_page` → `data:[Summary]`, `meta{has_more,next_cursor}`.
- `Summary` : `id, channel, category, title, audience, audience_label, status, recipient_count, sent_count, failed_count, skipped_count, created_at, sent_at|null`. `title` = objet (e-mail) ou titre (push). `failed_count` = `failed|bounced|unknown` ; `skipped_count` = `suppressed|skipped_no_device|skipped_no_email`.
- `Detail` = `Summary` + `subject|null, html|null, push_title|null, push_body|null, link|null, inactivity_days|null, recipient_emails:[string], images:[{id,name,mime,size,url,inline}], lock_version, stats{queued,sending,sent,failed,bounced,suppressed,unknown,skipped_no_device,skipped_no_email,unsubscribed}`. `images[].url` = `/api/v1/console/marketing/campaigns/{id}/images/{image}`.
- `POST /marketing/campaigns` (multipart ou JSON) : `channel`, `category`, `audience`, `inactivity_days?`, `recipient_emails[]?`, `subject`, `html` (e-mail) ; `push_title`, `push_body`, `link?` (push ; chemin relatif commençant par un seul `/`) ; `images[{ref}]` fichiers, `ref` = `[a-z0-9-]{1,36}`, cité dans le HTML par `cid:{ref}`, réécrit en `cid:{id}` par le serveur. → 201 `data: Detail`, `meta{unknown_recipients:[string]}`.
- `POST /marketing/campaigns/{id}` : mêmes champs + `lock_version`, `removed_image_ids[]?` (brouillon seul ; `channel` immuable) → 200, même forme.
- `GET /marketing/campaigns/{id}` → `data: Detail`.
- `GET /marketing/campaigns/{id}/images/{image}` → binaire, `nosniff`, privé.
- `GET /marketing/campaigns/{id}/estimate` → `data{total, eligible, excluded_no_consent, excluded_unreachable}`.
- `POST /marketing/campaigns/{id}/test` : à l'opérateur connecté seulement → `data{sent_to}`.
- `POST /marketing/campaigns/{id}/send` : `lock_version` → 202 `data: Detail`.
- Codes : `platform_campaign_not_found` 404, `platform_campaign_not_editable` 409, `platform_campaign_stale` 409, `platform_campaign_no_recipient` 409, `platform_campaign_no_device` 409, `platform_campaign_too_large` 422, `campaign_sending_disabled` 503 (existant), `push_sending_disabled` 503.

### Notifications et rappels

- `GET /notifications/types` → `data:[{type,label,group,audience,audience_label,channels:[{channel,label,enabled,locked,default}]}]` (sans les types de rappel ni les deux types de campagne). `enabled` = non coupé par la plateforme.
- `PUT /notifications/types` : `changes:[{type,channel,enabled}]` → même réponse. Canal verrouillé : 422 `notification_channel_mandatory`.
- `GET /notifications/reminders` → `data:[Reminder]` ; `Reminder` : `code,label,description,category` (`account|journey|tenant|team`), `category_label, timing` (`after|before`), `enabled, delay_days, delay_min, delay_max, repeat_every_days|null, max_occurrences, occurrences_limit, channels:[string], available_channels:[string], last_run_at|null, last_sent_count|null, updated_at|null`.
- `PUT /notifications/reminders/{code}` : `enabled, delay_days, repeat_every_days|null` (1 à 180), `max_occurrences` (1 à `occurrences_limit` : 5, et 2 pour `email_unverified` ; 1 imposé sans répétition), `channels[]` (au moins un, parmi `available_channels`) → `data: Reminder`. Code inconnu : 404 `reminder_not_found`.

### Catalogue des rappels (défaut, bornes en jours)

| Code | Type de notification | Module | Catégorie | Défaut (bornes) | Répétition / max | Déclencheur |
|---|---|---|---|---|---|---|
| `account_inactive` | `account.reminder_inactive` | Identity | account | 14 (7–365) | 30 / 2 | aucune activité (connexion, jeton, session) |
| `email_unverified` | `account.reminder_email_unverified` | Identity | account | 2 (1–30) | 5 / 2 | inscription non confirmée ; **e-mail seul**, seule exception à l'adresse vérifiée |
| `space_not_created` | `account.reminder_space` | Identity | journey | 3 (1–60) | – / 1 | compte confirmé sans aucun espace, intention ni agence, ni bailleur, ni voyageur |
| `agency_not_created` | `account.reminder_agency` | Organizations | journey | 3 (1–60) | 7 / 2 | intention agence, aucune agence |
| `landlord_space_not_created` | `account.reminder_landlord` | Organizations | journey | 3 (1–60) | 7 / 2 | intention bailleur, aucun espace bailleur |
| `property_missing` | `reminders.property_missing` | Properties | journey | 7 (1–90) | 14 / 2 | organisation sans bien |
| `listing_missing` | `reminders.listing_missing` | Listings | journey | 14 (1–180) | 30 / 2 | organisation sans aucune annonce |
| `listing_draft` | `reminders.listing_draft` | Listings | journey | 5 (1–90) | 7 / 2 | annonce restée en brouillon |
| `lead_unanswered` | `reminders.lead_unanswered` | Listings | team | 2 (1–30) | 3 / 2 | demande sur une annonce sans réponse |
| `invitation_pending` | `reminders.invitation_pending` | Identity | team | 3 (1–30) | – / 1 | invitation locataire en attente non expirée |
| `recovery_stalled` | `reminders.recovery_stalled` | Recovery | team | 15 (3–180) | 15 / 3 | dossier ouvert sans acte depuis le délai |
| `rent_due_soon` | `tenant.reminder_rent_due` | Rent | tenant | 3 (1–15), `before` | – / 1 | échéance non soldée à venir |
| `rent_unpaid` | `tenant.reminder_rent_unpaid` | Rent | tenant | 5 (1–90) | 7 / 3 | échéance non soldée et dépassée |
| `trial_ending` | `reminders.trial_ending` | Subscriptions | team | 3 (1–14), `before` | – / 1 | essai bientôt terminé |

Destinataires d'équipe : `owner`, `admin`, `manager` (`reminders.trial_ending` : `owner`, `admin` ; `recovery_stalled` : plus `accountant`). Tous les rappels restent désactivables par le destinataire ; gabarits sans montant ni nom.

Aucun rappel ne part au titre d'une organisation suspendue (équipe comme locataires). Le rappel d'adresse non confirmée ne part pas vers un compte suspendu.

## Options écartées

- **Nouveau module Marketing** : doublerait envoi, désinscription et push (ADR 0033).
- **Notifications → chaque module métier** pour trouver les cibles : liens et cycles nouveaux.
- **Images hébergées sur une route publique** : surface publique et suivi d'ouverture possible.
- **Adresses libres ou import de liste** : prospection sans consentement.
- **Marketing sans adhésion préalable** : risque juridique ; à rouvrir seulement sur avis écrit.
- **Programmation différée d'une campagne** : reportée.

## À valider

1. Base légale du marketing de la plateforme (adhésion préalable retenue ; CPCE art. L34-5) et frontière « information de service ».
2. Relance de courtoisie envoyée par la plateforme aux locataires et aux équipes des organisations : qualification (sous-traitant), information dans les CGV, opposition d'une organisation (non prévue ici).
3. E-mail à une adresse non vérifiée pour terminer une inscription.
