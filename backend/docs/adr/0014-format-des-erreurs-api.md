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
