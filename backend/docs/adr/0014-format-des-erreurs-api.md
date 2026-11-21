# ADR 0014 — Format des erreurs et codes HTTP de l'API

Statut : accepté (2026-11-13). S'applique à toutes les routes `/api/v1` et `/auth` (ADR 0002, 0004).

## Contexte

Le gestionnaire d'exceptions (`bootstrap/app.php`) force seulement le JSON. Le module Identity a déjà trois formats :

- Laravel par défaut : `{message}`, et `{message, errors}` pour une validation ;
- format maison `{message, code}` : exceptions `SocialLoginRefused`, `InvalidIdentityToken`, `ProviderUnavailable`, middlewares `space`, `reauthenticated` et rappel OAuth.

Les clients sont les applications web (ADR 0010), l'application mobile et la console. Ils doivent réagir à une erreur précise : `no_account` mène à l'inscription, `reauthentication_required` ouvre la confirmation, `email_unverified` envoie vers la vérification. Ils ne peuvent pas se fonder sur un texte, qui change et sera traduit. Chaque nouveau module ajoutera ses propres erreurs : il faut un format unique avant le prochain module.

## Décision

### Format : RFC 9457 (`application/problem+json`) avec un `code` stable

```json
{
  "type": "https://api.eguardimmo.test/problems/account_exists_link_required",
  "title": "Compte existant",
  "status": 409,
  "detail": "Un compte existe déjà avec cette adresse. Connectez-vous pour lier Google.",
  "code": "account_exists_link_required"
}
```

| Membre | Règle |
|---|---|
| `code` | Extension. Identifiant stable en `snake_case` anglais, unique dans l'API. C'est **le seul contrat** sur lequel un client se branche. Un code publié ne change jamais de sens ; un code retiré n'est pas réutilisé. |
| `type` | `{APP_URL}/problems/{code}`. Une page de documentation pourra y répondre plus tard ; un client ne le lit pas. |
| `title` | Libellé court et fixe par code, en français. |
| `status` | Le code HTTP de la réponse. |
| `detail` | Message destiné à l'utilisateur final, en français, sans donnée interne. Les URL qu'il contient sont complètes, avec `https://`. |
| `errors` | Extension, seulement pour une validation (422) : `{champ: [messages]}`. On garde la forme Laravel, que react-hook-form et Flutter consomment directement. |
| `retry_after` | Extension, pour 429 et 503 : nombre de secondes, en plus de l'en-tête `Retry-After`. |
| `request_id` | Extension, sur toute réponse d'erreur : identifiant de corrélation, identique à l'en-tête `X-Request-Id` et au `request_id` du journal d'activité ([ADR 0016](0016-journal-d-activite.md)). Le support le demande à l'utilisateur pour retrouver la requête. |

Pas de `instance`.

### Codes HTTP

| Situation | Statut | Code par défaut |
|---|---|---|
| Corps illisible, JSON invalide | 400 | `bad_request` |
| Non authentifié, jeton expiré ou révoqué | 401 | `unauthenticated` |
| Authentifié mais sans droit (espace, capacité, e-mail non vérifié, ré-authentification) | 403 | code précis obligatoire : `space_forbidden`, `email_unverified`, `operator_token_required`, `reauthentication_required`… |
| Ressource absente **ou appartenant à un autre utilisateur ou à une autre organisation** | 404 | `not_found` (jamais 403 : on ne révèle pas l'existence de la ressource) |
| Méthode non permise | 405 | `method_not_allowed` |
| Conflit avec l'état existant (doublon, déjà lié) | 409 | code précis |
| Validation ou donnée métier refusée | 422 | `validation_failed` avec `errors`, ou code métier précis |
| Limite de débit, verrou de compte | 429 | `too_many_requests`, avec `Retry-After` |
| Dépendance externe injoignable ou non vérifiable (fournisseur d'identité, PSP, horodatage) | 503 | code précis, avec `Retry-After` |
| Toute autre erreur | 500 | `server_error`, `detail` générique, aucune trace ni nom d'exception |

Succès :

- Le corps des réponses de succès reste `{data: …}` via les API Resources.
- Une création répond **201**. Cela vaut aussi pour la délivrance d'un jeton, y compris `POST /api/v1/auth/token` quand il renvoie un défi 2FA, le client lisant `two_factor`.
- Une demande traitée sans révéler son résultat (inscription, mot de passe oublié) répond **202**.
- Une suppression répond **204**.

### Mise en œuvre

- Un seul rendu, dans `bootstrap/app.php` (`withExceptions`). Il traduit en problème les exceptions du framework : `AuthenticationException`, `AuthorizationException`, `ModelNotFoundException`, `NotFoundHttpException`, `ValidationException`, `ThrottleRequestsException`, `HttpException`, et les autres en 500.
- Une erreur métier est une `App\Shared\Http\ApiProblem` : exception `final` qui porte `problemCode`, `status`, `title`, `detail` et les en-têtes. Elle ne fait aucun rendu elle-même. Le preset `strict` de Pest interdit les classes abstraites et le projet écarte les interfaces : une seule classe, pas de hiérarchie.
- Chaque module déclare ses codes dans un enum public `Enums/ErrorCode` (ADR 0005 : `Enums` fait partie de l'API publique d'un module), avec `status()`, `title()`, `detail()` et `problem()`. On lève `throw ErrorCode::NoAccount->problem()`. Les types TypeScript des clients pourront en être générés.
- Les middlewares et les contrôleurs lèvent une exception au lieu de construire un `JsonResponse` d'erreur. Un contrôleur peut encore renvoyer un `JsonResponse` de succès.
- `ArchTest.php` vérifie que :
  - aucune classe d'un module n'implémente `Throwable` ;
  - aucun middleware d'un module n'utilise `JsonResponse`.
- Les flux qui redirigent un navigateur (rappel OAuth) ne renvoient pas de JSON. Ils passent le `code` dans l'URL du hub (`?erreur={code}`), avec la même liste de codes.

## Options écartées

- **Garder le format maison `{message, code}`** : c'est le plus simple, et il est déjà en place dans Identity. Mais il ne suit aucune norme : générateurs OpenAPI, bibliothèques HTTP et passerelles ne le reconnaissent pas. Il cohabite aussi avec le `{message}` de Laravel, donc chaque client doit gérer deux formes.
- **Réponses par défaut de Laravel seulement** (`{message}`, `errors`) : sans code stable, les clients devraient comparer des textes, ce qui casse à la première traduction (Belgique, Québec, ADR 0008).
- **Objet d'erreur JSON:API** (`{errors: [{status, code, title, detail, source}]}`) : il impose une liste même pour une erreur unique et suppose JSON:API pour les succès, ce que l'API n'utilise pas.
- **RFC 9457 sans `code`, avec un `type` à analyser** : les clients devraient découper une URI. L'extension `code` est permise par la RFC et bien plus simple à consommer.
- **403 pour la ressource d'autrui** : il confirme que la ressource existe. On répond 404, déjà appliqué aux appareils.

## Conséquences

- Identity a été migré le 2026-11-13 :
  - `SocialLoginRefused`, `InvalidIdentityToken` et `ProviderUnavailable` sont remplacés par `Identity\Enums\ErrorCode` ;
  - `EnsureSpace`, `EnsureRecentReauthentication` et `RevokeCurrentToken` lèvent au lieu de répondre ;
  - le rappel OAuth redirige vers le hub avec `?erreur=invalid_state` au lieu d'un 403 JSON ;
  - `provider_unavailable` porte `Retry-After: 30` ;
  - les trois endpoints de jeton mobile répondent 201.
- Réponses Fortify (`/auth/*`) : celles qui passent par une exception (validation, limite de débit, authentification) suivent le format sans changement côté Fortify. Ses réponses de succès restent celles du module.
- Le client HTTP partagé des applications (`packages/`) lit `application/problem+json`, se branche sur `code` et affiche `detail`. Il ne montre jamais un message pour un 500 au-delà du texte générique.
- La traduction des `detail` (néerlandais pour Bruxelles et la Flandre, anglais pour le Québec) reste à décider. Le `code` permet aux clients de traduire eux-mêmes en attendant.
- Un nouveau code d'erreur fait partie du contrat public : il s'ajoute à l'enum du module et à la documentation de l'API dans la même modification.

## Amendement du 2026-11-20 (ADR 0036)

- Codes ajoutés. Leases : `lease_document_not_found`, `notice_request_not_found`, `lease_notice_not_allowed`, `notice_request_exists`, `notice_request_locked`, `notice_departure_too_early`, `notice_reason_unsupported`, `notice_proof_required`, `lease_jurisdiction_unsupported`, `insurance_submission_not_found`, `insurance_submission_not_pending`, `insurance_submission_not_allowed`, `insurance_period_invalid`, `lease_notice_invalid`. Inspections : `inspection_not_found`, `inspection_remark_not_found`, `inspection_remark_window_closed`, `inspection_not_publishable`, `inspection_published`, `inspection_stale_version`, `inspection_remark_answered`. Payments : `online_payment_not_found`, `payment_nothing_due`, `payment_account_not_ready`, `payment_provider_unavailable` (503, `Retry-After`), `payment_not_cancellable`, `payment_method_unsupported`, `webhook_signature_invalid` (401). `idempotency_key_reused` (409) s'applique à toute création par `client_id`.
- Revue de sécurité : Payments `payment_installments_in_progress` (409) ; Leases `lease_document_invalid` (422). Le motif `payment_in_progress` s'ajoute aux raisons d'indisponibilité des options de paiement.

## Amendement du 2026-11-20 (ADR 0040)

- Codes ajoutés. Mandates : `mandate_amendment_signature_required` (422), `mandate_document_invalid` (422), `mandate_document_not_found` (404), `mandate_term_defaults_not_found` (404). Documents : `document_not_clean` (409), `library_document_not_found` (404), `library_kind_subject_mismatch` (422). Organizations : `member_scope_unsupported` (422). OwnerFunds : `owner_funds_mandate_not_found` (404). Réutilisés : `mandate_stale_version`, `mandate_agency_only`, `owner_funds_agency_only`, `fee_base_missing`.

## Amendement du 2026-11-21 (ADR 0037)

- Codes ajoutés. Identity : `operator_role_required` (403), `operator_proof_required` (422), `operator_proof_invalid` (422), `operator_account_protected` (403), `last_operator_administrator` (409), `account_suspended` (403), `account_not_found` (404), `account_already_suspended` (409), `account_not_suspended` (409), `two_factor_not_enabled` (409), `suspension_review_forbidden` (403). Operations : `approval_not_found` (404), `approval_self_forbidden` (403), `approval_role_forbidden` (403), `approval_not_pending` (409), `approval_expired` (409), `approval_pending_exists` (409), `approval_stale` (409). Organizations : `organization_suspended` (403), `organization_already_suspended` (409), `organization_not_suspended` (409). Subscriptions : `plan_not_found` (404), `plan_version_not_editable` (409), `plan_draft_exists` (409), `plan_version_publication_pending` (409), `plan_version_invalid` (422), `subscription_not_found` (404), `feature_not_in_plan` (403), `plan_quota_reached` (409), `override_invalid` (422). Privacy : `privacy_request_not_found` (404), `privacy_request_closed` (409), `privacy_request_exists` (409), `privacy_export_expired` (410), `privacy_identity_not_verified` (409), `privacy_account_required` (409), `privacy_already_extended` (409), `privacy_export_unavailable` (404), `privacy_deadline_passed` (409), `privacy_erasure_requires_approval` (409), `reauthentication_required` (403, dépôt d'une demande d'accès, de portabilité ou d'effacement).

## Amendement du 2026-11-21 (ADR 0039)

- Codes ajoutés. Investments : `loan_not_found` (404), `acquisition_not_found` (404), `investments_landlord_only` (403), `investments_idempotency_key_required` (422), `loan_terms_invalid` (422), `loan_schedule_inconsistent` (422), `acquisition_scope_mixed` (422), `investments_target_invalid` (422), `investments_file_invalid` (422), `loan_in_use` (409), `loan_version_conflict` (409), `loan_state_invalid` (409), `acquisition_exists` (409), `loan_attestation_exists` (409), `investments_idempotency_key_reused` (409).
- Tax : `tax_summary_not_found` (404), `tax_mandant_not_found` (404), `tax_landlord_only` (403), `tax_agency_only` (403), `tax_idempotency_key_required` (422), `tax_year_unsupported` (422), `tax_jurisdiction_unsupported` (422), `tax_taxpayer_unsupported` (422), `tax_export_too_large` (422), `tax_interest_source_conflict` (409), `tax_period_not_closed` (409), `tax_owner_funds_not_ready` (409), `tax_summary_stale_version` (409), `tax_summary_exists` (409), `tax_summary_not_rectifiable` (409), `tax_summary_not_publishable` (409), `tax_idempotency_key_reused` (409), `tax_pdf_unavailable` (503).
- Reporting : `reporting_landlord_only` (403), `forecast_assumptions_stale` (409), `profitability_period_invalid` (422), `finance_too_large` (422, plus de 500 lots ou de 20 pages de baux), `export_type_unknown` (404) ; `export_too_large` (422) sert aussi aux exports financiers.

## Amendement du 2026-11-21 (quotas de plan)

- `plan_quota_reached` (409) ajoute au corps `feature` (clé de la fonction), `limit` (limite effective) et `current` (nombre d'objets au moment du refus) ; `feature_not_in_plan` (403) ajoute `feature`. Aucun code nouveau.

## Amendement du 2026-11-21 (plafond d'organisations)

- Organizations : `organization_limit_reached` (403), refus de `POST /organizations` quand le compte a déjà créé `ORGANIZATIONS_MAX_OWNED_PER_USER` organisations (5 par défaut). Sans `Retry-After` : ce n'est pas une limite de débit.
