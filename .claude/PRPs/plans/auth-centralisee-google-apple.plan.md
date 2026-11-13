# Plan : authentification centralisée + Google / Apple

## Summary
Une seule page de connexion (`auth.<domaine>`) ouvre une session Sanctum partagée par les quatre applications d'espace (`apps/locataire`, `apps/proprietaire`, `apps/agence`, `apps/sebook`, ADR 0010). La console a sa propre connexion par jeton (ADR 0004 révisé). Inscription et connexion se font par e-mail, Google ou Apple, avec 2FA. L'app mobile Flutter obtient un jeton Sanctum depuis un mot de passe ou depuis un `id_token` Google/Apple vérifié par l'API.

## User Story
En tant que propriétaire, gestionnaire d'agence, locataire ou opérateur, je veux me connecter une seule fois, avec mon e-mail, Google ou Apple, et accéder à tous mes espaces, pour ne pas multiplier les comptes ni les connexions.

## Problem → Solution
L'API n'a aujourd'hui que `GET /api/v1/me`, sans connexion, inscription ni profils. La solution : un hub d'authentification Fortify + Socialite dans le module Identity, une app Next.js `auth/`, une garde commune (`packages/api`) branchée dans les trois applications d'espace, une connexion par jeton pour la console et des endpoints jetons pour le mobile.

## Metadata
- **Complexity** : XL, découpé en 4 phases livrables séparément
- **Décisions** : ADR 0002, 0003, 0004, 0006 et 0010 (`backend/docs/adr/`)
- **Estimated Files** : environ 45 côté backend, 20 pour `apps/auth`, 10 pour la garde partagée, les quatre apps d'espace et la console

---

## Phases

| # | Phase | Dépend de | Statut |
|---|---|---|---|
| P1 | Socle backend : Fortify (e-mail/mdp, 2FA, reset, vérif e-mail), jetons mobile, audit, opérateur et jeton console, `/me/profiles`, middleware `space:*` | — | pending |
| P2 | Google + Apple : web (Socialite) et mobile (`id_token`), liaison de comptes | P1 | pending |
| P3 | Monorepo pnpm, app `apps/auth`, garde des 3 apps d'espace, connexion de la console | P1 (P2 pour les boutons) | pending |
| P4 | Exigences App Store : suppression de compte, révocation Apple | P2 | pending |

---

## UX Design

### Before
Aucune connexion possible.

### After
```
agence.<d> ──(pas de session)──► auth.<d>/connexion?return_to=https://agence.<d>/
                                       │  [Continuer avec Google] [Continuer avec Apple]
                                       │  e-mail + mot de passe ─► (2FA si activée)
                                       ▼
                         session .<d> posée ─► return_to (liste blanche) ─► agence.<d>/
locataire.<d>, proprietaire.<d> : même hub, même session, sans nouvelle connexion
console ──► sa propre page : e-mail + mot de passe + TOTP ─► jeton opérateur gardé par le serveur Next
Mobile : bouton natif Google/Apple ─► id_token ─► POST /api/v1/auth/social/{p}/token ─► jeton 30 j
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Connexion web | inexistante | hub unique `auth.<d>` | SSO pour les quatre applications d'espace |
| Inscription | inexistante | e-mail, Google ou Apple, avec choix bailleur autonome (→ `proprietaire.<d>`), agence (→ `agence.<d>`) ou voyageur (retour sur `sebook.<d>`) | locataire : invitation seulement ; mandant : invité par son agence |
| Console | inexistante | connexion propre, TOTP à chaque fois, jeton 4 h | session cookie refusée sur `/console` |
| Mobile | inexistante | jeton Sanctum (mdp ou `id_token`) | défi 2FA si activée |

---

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | `backend/AGENTS.md` | où mettre quoi, frontières, règles |
| P0 | `backend/docs/adr/0002-securite-api.md`, `0003-espaces-et-profils.md`, `0004-authentification-centralisee.md` | décisions acceptées, ne pas les rouvrir |
| P0 | `backend/tests/Architecture/ArchTest.php` | règles qui feront échouer la suite |
| P1 | `backend/app/Providers/HttpSecurityServiceProvider.php:53-60` | limiteur `auth` à réutiliser |
| P1 | `backend/tests/Feature/RoutesTest.php` | liste blanche `ROUTES_PUBLIQUES`, noms de routes par module |
| P1 | `backend/app/Modules/Identity/**` | modèle User, provider, route `/me`, factory |
| P2 | `backend/tests/Feature/HttpSecurityTest.php` | style de test (Pest, constantes de limites) |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Fortify headless | https://laravel.com/docs/13.x/fortify | `views=false`, réponses JSON, `Fortify::authenticateUsing`, features 2FA (`confirm`, `confirmPassword`) |
| Sanctum SPA | https://laravel.com/docs/13.x/sanctum#spa-authentication | `GET /sanctum/csrf-cookie`, `X-XSRF-TOKEN`, `credentials: 'include'`, même domaine parent |
| Socialite | https://laravel.com/docs/13.x/socialite | `redirect()`, `user()`, `stateless()` |
| Apple provider | https://socialiteproviders.com/Apple/ | `userByIdentityToken($token, $nonce)` ; client_secret JWT de 6 mois maximum, à générer à la demande |
| Liaison sûre | https://workos.com/blog/oauth-auto-link-email-account-takeover | clé `(iss, sub)`, `email_verified` des deux côtés |
| Cas réel 2026 | https://app.opencve.io/cve/CVE-2026-53516 | better-auth : liaison OAuth vers un compte local non vérifié = prise de contrôle |
| App Store 4.8 / 5.1.1(v) | https://developer.apple.com/app-store/review/guidelines/ | Apple requis si Google est proposé ; suppression de compte depuis l'app |

---

## Patterns to Mirror

### ROUTE (module, espace, nom préfixé)
```php
// SOURCE: backend/app/Modules/Identity/Http/routes.php:7
Route::middleware('auth:sanctum')->get('/me', ShowMeController::class)->name('identity.me');
```

### CONTROLLER (mono-action, final, Resource)
```php
// SOURCE: backend/app/Modules/Identity/Http/Controllers/ShowMeController.php
final class ShowMeController
{
    public function __invoke(Request $request): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        return new UserResource($user);
    }
}
```

### LIMITEUR AUTH
```php
// SOURCE: backend/app/Providers/HttpSecurityServiceProvider.php:53-60
RateLimiter::for('auth', function (Request $request): array { /* 5/min compte+IP, 20/min IP */ });
```

### TEST (Pest, 401 / nominal / champs sensibles)
```php
// SOURCE: backend/tests/Feature/Identity/ShowMeTest.php
it('retourne l\'utilisateur porteur d\'un vrai jeton, sans champ sensible', function (): void {
    $user = User::factory()->create();
    $jeton = $user->createToken('test')->plainTextToken;
    $this->withToken($jeton)->getJson('/api/v1/me')->assertOk()->assertJsonMissingPath('data.password');
});
```

### ERREURS
Aucune exception maison pour l'instant. Toutes les réponses sont en JSON (`bootstrap/app.php`, `shouldRenderJsonWhen(fn () => true)`). Pour une erreur métier : `abort(403|404|409|422)` avec un message en français. Les validations passent par une FormRequest (422 standard Laravel).

### LOGS / AUDIT
Rien n'existe encore. La phase P1 crée `App\Shared\Audit` (voir la tâche 1.2). Ne jamais journaliser un mot de passe, un jeton, un `id_token` ni un secret 2FA.

---

## Files to Change (synthèse)

| Zone | Action | Contenu |
|---|---|---|
| `backend/composer.json` | UPDATE | `laravel/fortify`, `laravel/socialite`, `socialiteproviders/apple` (le dry-run passe sur Laravel 13) |
| `backend/config/fortify.php`, `config/services.php` | CREATE/UPDATE | prefix `auth`, `views=false`, limiters ; clés google/apple par variables d'env |
| `backend/app/Shared/Audit/*` + migration | CREATE | journal append-only |
| `backend/app/Modules/Identity/Fortify/*` | CREATE | adaptateurs Fortify qui délèguent aux Actions |
| `backend/app/Modules/Identity/{Actions,Data,Enums,Events,Http,Models,Database}/*` | CREATE | voir les tâches |
| `backend/app/Modules/Identity/Http/Middleware/EnsureSpace.php` | CREATE | `space:tenant\|owner\|organization\|operator` |
| `backend/tests/Feature/Identity/*`, `tests/Feature/RoutesTest.php` | CREATE/UPDATE | tests du comportement |
| `auth/` (nouvelle app Next.js) | CREATE | hub de connexion |
| `packages/api/src/session/*` | CREATE | garde partagée : `/me/profiles`, redirection vers le hub |
| `apps/{locataire,proprietaire,agence}/src/proxy.ts` | CREATE | branchent la garde partagée sur leur espace |
| `console/` (nouvelle app Next.js) | CREATE | page de connexion, session serveur détenant le jeton opérateur |
| `backend/.env.example`, `auth/.env.example` | UPDATE | toutes les nouvelles variables |

## NOT Building
- Les modules Organizations, Mandates, Properties et Leases. Les profils locataire, propriétaire et organisation se branchent par le registre de profils quand ils existent ; `/me/profiles` renvoie ce qui est connu. La création de l'organisation (agence ou `individual`) à l'inscription est faite par Organizations en écoutant `UserRegistered`.
- Les invitations locataire : seul le point d'extension est posé (refus explicite en attendant).
- Les passkeys (Fortify 1.42 les supporte) : candidat pour plus tard, hors périmètre.
- Les fournisseurs autres que Google et Apple.
- Le design final des écrans : le hub reprend le design system de `packages/ui`, sans maquette dédiée.

---

## Step-by-Step Tasks

### Phase P1 — socle backend

#### 1.1 Installer Fortify (headless)
- **ACTION** : `composer require laravel/fortify`, publier la config et les migrations 2FA, puis **déplacer** la migration dans `app/Modules/Identity/Database/Migrations/`.
- **IMPLEMENT** : `config/fortify.php`, avec `guard=web`, `prefix='auth'`, `views=false`, `limiters.login='auth'`, `limiters.two-factor='auth'`, features `registration`, `resetPasswords`, `emailVerification`, `updatePasswords`, `twoFactorAuthentication(['confirm' => true, 'confirmPassword' => true])`. Ne **pas** enregistrer `App\Providers\FortifyServiceProvider` : la configuration se fait dans `IdentityServiceProvider::boot()`.
- **IMPLEMENT (suite)** :
  - `config/cors.php` : `paths` = `['api/*', 'auth/*', 'sanctum/csrf-cookie']`.
  - `SANCTUM_STATEFUL_DOMAINS` liste `auth.`, `locataire.`, `proprietaire.`, `agence.` et `sebook.` (jamais la console).
  - `bootstrap/app.php` : ajouter `$middleware->authenticateSessions()` (invalide les autres sessions au changement de mot de passe).
  - Session : `SESSION_ENCRYPT=true`, plus une durée **absolue** (horodatage de connexion en session, déconnexion au-delà de `config('identity.session_absolute_minutes', 720)`, 60 pour un opérateur).
- **GOTCHA** :
  - `fortify:install` crée `app/Actions/Fortify/*` et un provider dans `App\Providers` : les supprimer, puisqu'ils violent l'architecture (dossier global, règle `handle()`).
  - Les routes Fortify utilisent le groupe `web` (session, CSRF), alors que `bootstrap/app.php` n'a pas de `web:` et que `statefulApi()` ne vaut que pour `api`. Tester dès P1 une **vraie** requête cross-origin depuis `auth.<d>` (préflight CORS, cookie `XSRF-TOKEN`, session).
  - Avec `views=false`, Fortify ne répond en JSON que si la requête envoie `Accept: application/json` : le client du hub l'envoie toujours.
  - Laravel 13 : `validateCsrfTokens()` est **déprécié**, utiliser `preventRequestForgery(except: [...])`. `config/sanctum.php` référence encore `ValidateCsrfToken` : l'aligner.
- **VALIDATE** : `php artisan route:list --path=auth` liste login, logout, register, forgot-password, reset-password, two-factor-challenge et user/*.

#### 1.2 Journal d'audit (Shared)
- **ACTION** : créer la table `audit_logs` (id, occurred_at, actor_user_id nullable, action string indexée, subject_type nullable, subject_id nullable, ip, user_agent tronqué, metadata json) et `App\Shared\Audit\AuditLog` (modèle sans `updated_at`, mises à jour et suppressions interdites par exception dans `booted()`), plus `App\Shared\Audit\RecordAudit` avec `handle(string $action, ?int $actorId, array $metadata = [])`.
- **GOTCHA** :
  - `Shared` ne doit pas dépendre des modules : `actor_user_id` est un entier, pas une relation vers `User`.
  - **Aucun trigger SQL** : la prod n'a pas le droit SUPER (piège connu de l'ancien projet). L'immutabilité est applicative et testée.
  - Les modèles Eloquent ne sont autorisés que dans `Modules/*/Models` (ArchTest, règle « modèles Eloquent uniquement dans Models »). Ajouter `App\Shared\Audit` dans l'`ignoring()` de cette règle, explicitement et avec un test.
- **IMPLEMENT (journalisation)** :
  - Un e-mail journalisé l'est par **HMAC** avec une clé dédiée `AUDIT_HMAC_KEY`, jamais en SHA-256 nu (sinon réversible par dictionnaire).
  - Ne jamais journaliser `state`, `code` OAuth, URL de rappel, `id_token`, jeton, secret ou code 2FA.
- **VALIDATE** : un test prouve qu'un `update()` ou un `delete()` sur `AuditLog` lève une exception.

#### 1.3 Adaptateurs Fortify → Actions Identity
- **ACTION** : dans `Identity/Fortify/`, créer `CreateNewUser`, `ResetUserPassword`, `UpdateUserPassword` et `AuthenticateUser`, qui appellent les Actions `RegisterUser`, `ResetPassword` et `AttemptPasswordLogin` (méthode `handle()`, DTO dans `Data/`).
- **IMPLEMENT** :
  - `RegisterUser` : valide `intended_profile ∈ {individual_landlord, agency, traveler}` (`traveler` : compte SeBook sans profil de gestion) (enum `Identity\Enums\IntendedProfile`) et refuse `tenant` (422 « inscription locataire sur invitation »). Il crée l'utilisateur et émet l'événement `Identity\Events\UserRegistered(userId, intendedProfile)`. Mot de passe : `Password::defaults()`.
  - `AttemptPasswordLogin` : même message et même durée de réponse que le compte existe ou non (`Hash::check` contre un hash factice si l'utilisateur est absent). Il audite `auth.login.succeeded` et `auth.login.failed` (e-mail par HMAC, jamais en clair).
  - **Anti-énumération** :
    - `register` avec un e-mail déjà pris répond comme un succès (202 « vérifiez vos e-mails ») et envoie au titulaire un e-mail « un compte existe déjà ».
    - `forgot-password` répond 202 identique, que le compte existe ou non : surcharger `FailedPasswordResetLinkRequestResponse` de Fortify.
  - **Révocation** : `ResetPassword` et `UpdatePassword` suppriment tous les `personal_access_tokens`, suppriment les lignes `sessions` du `user_id` (sauf la courante pour un update) et régénèrent `remember_token`. Même chose à l'activation ou désactivation de la 2FA et au changement d'e-mail.
- **GOTCHA** : la règle arch « actions avec `handle()` » ne vise que `Actions/`. `Fortify/` est un dossier privé du module (dérivé automatiquement par l'ArchTest).

#### 1.4 Modèle User et 2FA
- **ACTION** : migration Identity rendant `password` nullable, plus les colonnes `two_factor_*` (migration Fortify déplacée). `User` reçoit `TwoFactorAuthenticatable` ; `#[Hidden]` ajoute `two_factor_secret` et `two_factor_recovery_codes`.
- **IMPLEMENT (2FA et comptes sans mot de passe)** : l'activation de la 2FA exige une confirmation de mot de passe (`confirmPassword`). Un compte créé par Google/Apple n'a pas de mot de passe : il doit en **définir un** (parcours « définir un mot de passe », lien e-mail) avant d'activer la 2FA. C'est obligatoire pour un opérateur. La vérification TOTP passe par `TwoFactorAuthenticationProvider::verify` de Fortify (anti-rejeu), et un code de secours utilisé est consommé.
- **IMPLEMENT (audit 2FA)** : auditer l'activation, la désactivation, l'usage d'un code de secours et la régénération des codes.
- **VALIDATE** :
  - `/me` ne renvoie aucun champ `two_factor_*` (assertion `assertJsonMissingPath`) ;
  - un jeton émis avant un reset de mot de passe donne 401 après.

#### 1.5 Opérateurs
- **ACTION** : table `operators` (user_id unique, granted_at, granted_by_user_id nullable), modèle `Identity\Models\Operator`, commande `identity:grant-operator {email}` et `identity:revoke-operator {email}` (auditées). Aucune adresse e-mail dans le code.
- **GOTCHA** : la commande vit dans `app/Console/Commands` (règle arch « commandes artisan ») et appelle une Action `GrantOperator` du module Identity. Or `Actions` est privé au module : soit `Identity\PublicApi\OperatorAdministration` (classe final), soit la commande est placée dans le module (`Identity/Console/`) et chargée par `IdentityServiceProvider::boot()` (`$this->commands([...])`). **Choisir la seconde**, cohérente avec « tout le module dans son dossier ». La commande s'exécute en CLI uniquement, demande une confirmation interactive et notifie par e-mail tous les opérateurs existants.
- **VALIDATE** : un test donne le rôle à un e-mail existant (succès), à un e-mail inconnu (échec, code ≠ 0) et vérifie qu'une entrée d'audit est créée.

#### 1.6 Middleware `space:*` et `/me/profiles`
- **ACTION** :
  - Middleware `Identity\Http\Middleware\EnsureSpace` avec l'alias `space`, enregistré dans `IdentityServiceProvider` via `Route::aliasMiddleware`.
  - `space:operator` exige :
    - un **jeton Sanctum** portant la capacité `operator` (`$request->user()->currentAccessToken()` est un `PersonalAccessToken`, pas un `TransientToken`) : une session par cookie est refusée, même celle d'un opérateur ;
    - un opérateur actif, avec `two_factor_confirmed_at` non nul ;
    - sinon : 403 JSON `{code: 'operator_token_required'}`.
  - `POST /api/v1/console/auth/token` (public, `throttle:auth`, audité) : e-mail, mot de passe **et** code TOTP (ou code de secours) dans la même requête ; réponse identique que le compte existe ou non. Délivre un jeton à capacité `operator`, expirant après `CONSOLE_TOKEN_TTL_MINUTES` (240). `DELETE /api/v1/console/auth/token` le révoque. Les jetons console sont révoqués avec les autres à chaque changement de mot de passe, d'e-mail ou de 2FA, et au retrait du rôle opérateur.
  - `/api/v1/console/*` n'est pas dans `SANCTUM_STATEFUL_DOMAINS` ni dans les origines CORS : la console l'appelle de serveur à serveur.
  - Tous les `space:*` exigent `email_verified_at` non nul. `space:organization` exigera aussi l'appartenance, la 2FA pour le rôle admin et posera `CurrentOrganization` (ADR 0006) quand le module Organizations existera.
  - `space:tenant|owner|organization` interroge un registre de fournisseurs de profils (`Identity\PublicApi\ProfileRegistry`, où les futurs modules enregistrent un callable) et renvoie 403 si aucun ne donne le profil.
  - **Ré-authentification récente** (liaison Google/Apple, suppression de compte) : mot de passe confirmé (Fortify `password.confirm`) ou code TOTP via `POST /auth/reauthenticate/two-factor` (`throttle:auth`), qui pose `auth.reauthenticated_at` en session ; c'est ce que désigne « step-up 2FA » plus bas.
  - `GET /api/v1/me/profiles` renvoie `[{space, label, meta}]`, avec `name('identity.profiles')`.
- **GOTCHA** : l'app mobile a aussi des jetons Sanctum ; seule la capacité `operator` ouvre la console. `POST /api/v1/auth/token` (mobile) ne délivre jamais cette capacité.
- **VALIDATE** :
  - 401 sans session ;
  - 403 sans profil ;
  - 403 pour un compte non vérifié ;
  - 403 sur `/console` pour un opérateur connecté par session cookie ;
  - 403 sur `/console` avec un jeton mobile sans capacité `operator` ;
  - jeton console refusé sans code TOTP valide, refusé pour un non-opérateur, avec la même réponse ;
  - 401 avec un jeton console expiré ou révoqué ;
  - 200 avec un jeton console valide.

#### 1.7 Jetons mobile (mot de passe)
- **ACTION** :
  - `POST /api/v1/auth/token` (email, password, device_name) → `{token}`, ou `{two_factor: true, challenge}` si la 2FA est active. `challenge` est un jeton chiffré de 5 minutes, à usage unique, mis en cache.
  - `POST /api/v1/auth/token/two-factor` (challenge + code ou recovery_code) → `{token}`.
  - `DELETE /api/v1/auth/token` révoque le jeton courant.
  - Les routes publiques ont `throttle:auth` et sont ajoutées à `ROUTES_PUBLIQUES` dans `RoutesTest`.
- **IMPLEMENT (durcissement)** :
  - Le `challenge` est invalidé après 5 codes faux (compteur en cache) et consommé dès un succès.
  - Le jeton est créé avec les capacités `['mobile']` (jamais `['*']`).
  - `device_name` : chaîne de 1 à 100 caractères, imprimables uniquement.
  - `GET /api/v1/me/devices` liste les jetons, `DELETE /api/v1/me/devices/{id}` en révoque un. Pas de rotation du jeton de 30 jours (ADR 0002, accepté).
- **IMPLEMENT (limiteur par compte)** : nouveau limiteur `auth-compte`, avec 10 échecs par heure et par compte (e-mail normalisé) **quelle que soit l'IP**, et un verrouillage progressif. Il s'ajoute à `auth` (e-mail+IP, IP) contre la force brute distribuée (ASVS 2.2.1).
- **GOTCHA** : `RoutesTest` exige `auth:sanctum` sur toute route `api/*` hors liste blanche. Ajouter exactement `api/v1/auth/token` et `api/v1/auth/token/two-factor`, et ajouter un test qui exige `throttle:auth` sur chaque route publique.
- **VALIDATE** :
  - le chemin nominal délivre un jeton ;
  - un mauvais mot de passe donne 422 avec le même message que pour un compte inconnu ;
  - le 6ᵉ essai donne 429 ;
  - un jeton révoqué donne 401 ;
  - un code 2FA faux donne 422 ;
  - un challenge rejoué donne 422.

#### 1.8 Throttle sur les routes Fortify
- **ACTION** : dans `IdentityServiceProvider::boot()`, `$this->app->booted(...)` ajoute `throttle:auth` aux routes nommées `register`, `password.email`, `password.update` et `verification.send`. `login` passe par `limiters.login='auth'`.
- **GOTCHA** : le défi 2FA web n'envoie pas d'`email`. Avec le limiteur `auth`, la clé deviendrait `|IP`, partagée derrière un NAT. Garder pour `limiters.two-factor` un limiteur dédié `two-factor`, indexé sur `session('login.id')`, avec 5 essais par minute.

#### 1.9 Notifications de sécurité
- **ACTION** : envoyer un e-mail (passant par le gabarit maître) en cas de connexion depuis un nouvel appareil (nouveau jeton mobile ou nouvelle session web avec un user-agent inconnu), de changement de mot de passe, d'e-mail ou de 2FA, et d'attribution du rôle opérateur.
- **VALIDATE** : `Notification::fake()`, une notification par événement, aucune pour un appareil connu.
- **VALIDATE** : `RoutesTest` vérifie, pour chacun de ces noms, la présence de `throttle:auth` (ou du limiteur Fortify).

### Phase P2 — Google et Apple

#### 2.1 Configuration
- **ACTION** : `composer require laravel/socialite socialiteproviders/apple`. `config/services.php` lit les variables suivantes :
  - Google : `GOOGLE_CLIENT_ID_WEB`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CLIENT_IDS_MOBILE` (iOS et Android, séparés par des virgules) ;
  - Apple : `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH`, `APPLE_SERVICES_ID` (web), `APPLE_BUNDLE_ID` (mobile) ;
  - `AUTH_RETURN_TO_ALLOWED_HOSTS`.
- **IMPLEMENT** : déclarer `firebase/php-jwt` **explicitement** dans `composer.json` (ne pas dépendre d'une dépendance transitive).
- **GOTCHA** :
  - Le `client_secret` Apple est généré à chaque demande (JWT ES256 signé avec la `.p8`, `exp` de 5 minutes, `aud=https://appleid.apple.com`), avec deux variantes : `sub=Services ID` pour le web, `sub=Bundle ID` pour le mobile. Jamais de secret stocké qui expire au bout de 6 mois.
  - **Vérifier dans `vendor/socialiteproviders/apple` après installation** comment le provider obtient le secret (configuration ou calcul) ; le surcharger au besoin. Le nom du driver et l'enregistrement par l'événement `SocialiteWasCalled` sont aussi à lire dans le code.
  - La `.p8` est hors dépôt, montée par chemin, en permissions 0400, hors docroot, et listée dans `.gitignore` et `.dockerignore` (`*.p8`).

#### 2.2 Données
- **ACTION** : table `social_identities` (user_id, provider enum `google|apple`, subject string, email nullable, email_verified bool, apple_refresh_token nullable, last_used_at), avec `unique(provider, subject)`. Modèle `Identity\Models\SocialIdentity` : cast `apple_refresh_token => 'encrypted'` (clé `APP_KEY`) et présent dans `#[Hidden]`. La rotation de `APP_KEY` passe par `APP_PREVIOUS_KEYS`, procédure documentée dans `AGENTS.md`.

#### 2.3 Résolution (cœur, testée à fond)
- **ACTION** : l'Action `ResolveSocialLogin::handle(SocialProfileData $profil, SocialIntent $intent): User`, où `SocialIntent` vaut `login`, `register(individual_landlord|agency)` ou `link(userId)`.
- **IMPLEMENT** :
  - si `(provider, subject)` existe, renvoyer l'utilisateur ;
  - si l'intent est `link`, rattacher au compte connecté, sauf si l'identité appartient déjà à un autre compte (409) ;
  - si un compte a le même e-mail : rattacher **seulement si** `profil.emailVerified` et `user.email_verified_at` sont tous deux vrais, sinon 409 `account_exists_link_required` ;
  - si aucun compte n'existe : avec `register(individual_landlord|agency)`, créer un utilisateur vérifié, sans mot de passe, avec son identité, puis émettre `UserRegistered` ; avec `login`, renvoyer 404 `no_account` (le hub propose alors l'inscription) ;
  - auditer `auth.social.{linked|registered|login}`.
- **IMPLEMENT (règles complémentaires)** :
  - Un compte local non vérifié dont l'e-mail correspond n'est jamais rattaché. L'inscription sociale sur cet e-mail est refusée (409) tant que le titulaire n'a pas vérifié son e-mail ; une fois vérifié, les mots de passe et sessions antérieurs à la vérification sont purgés.
  - `email_verified` Apple arrive en chaîne `"true"` ou en booléen : normaliser strictement, toute autre valeur vaut faux.
  - Un e-mail relais privé Apple (`@privaterelay.appleid.com`) ne déclenche **jamais** de rattachement par e-mail : rattachement par `sub` seulement.
  - Un changement d'e-mail chez le fournisseur ne modifie jamais l'e-mail du compte local.
  - Messages 404 `no_account` et 409 `account_exists_link_required` : énumération limitée à qui contrôle déjà le compte Google/Apple concerné. Risque accepté, sous `throttle:auth`.
- **GOTCHA** : Apple ne fournit le nom qu'à la première autorisation. Le lire depuis le payload `user` du premier rappel, ne jamais l'écraser par une valeur vide.

#### 2.4 Flux web
- **ACTION** :
  - `GET /auth/social/{provider}/redirect?intent=login|register&profile=&return_to=` (groupe `web`, `throttle:auth`).
    - Il génère un **binder** aléatoire de 32 octets et le pose dans un cookie `__Host-`-like `eg_oauth_binder` (`HttpOnly`, `Secure`, **`SameSite=None`** pour que le POST Apple l'envoie, durée 10 minutes, hôte `api.<d>` seul).
    - Il construit un `state` = `Crypt::encryptString(json_encode([...]))` contenant intent, profil, return_to, `sha256(binder)`, un nonce aléatoire et `exp` à 10 minutes. Jamais `Crypt::encrypt`, qui sérialise.
    - Le nonce est enregistré en cache.
  - **Liaison** : `POST /auth/social/{provider}/link` est authentifié, protégé par CSRF et exige un mot de passe confirmé récemment ou un step-up 2FA. Il renvoie l'URL de redirection avec `intent=link` et `user_id` dans le `state`. L'intent `link` n'est **jamais** accepté sur la route GET.
  - `GET|POST /auth/social/{provider}/callback` :
    - déchiffre le `state` ;
    - exige le cookie binder dont le hash correspond, puis le supprime ;
    - consomme le nonce **atomiquement** (`Cache::pull`, absent = 403) ;
    - pour `link`, exige `Auth::id() === state.user_id` ;
    - puis `Socialite::driver($p)->stateless()->user()` → `ResolveSocialLogin`.
  - En mode `stateless()`, Socialite ne génère ni ne vérifie aucun `state` : le passer avec `->with(['state' => $state])` à la redirection et le lire soi-même au rappel.
  - Si le compte a une 2FA, appliquer la logique de défi Fortify (`login.id` en session, redirection vers `auth.<d>/deux-facteurs`). Sinon `Auth::login`, `session()->regenerate()` (anti-fixation), puis 303 vers `return_to`.
  - Le rappel répond avec `Referrer-Policy: no-referrer` et ne journalise jamais son URL.
- **GOTCHA** :
  - Apple rappelle en **POST cross-site** (`form_post`). Le cookie de session `SameSite=Lax` n'est pas envoyé, d'où le binder en `SameSite=None`. La route de rappel est exclue de la protection anti-falsification par `$middleware->preventRequestForgery(except: ['auth/social/*/callback'])` (`validateCsrfTokens` est déprécié en Laravel 13). Le binder lié au navigateur et le `state` à usage unique la remplacent : **sans binder, CSRF de connexion et prise de contrôle par liaison**.
  - `return_to` est validé à la redirection, au rappel **et** côté Next (`/continuer`, connexion par e-mail) par la même règle :
    - `parse_url`, schéma `https` (`http` seulement si `APP_ENV=local`) ;
    - hôte **égal exactement** à une entrée de `AUTH_RETURN_TO_ALLOWED_HOSTS`, sans suffixe ni joker ;
    - port attendu ;
    - rejet de `user:pass@`, de `\`, de `//hôte`, des caractères de contrôle et du double encodage.
    - Sinon retour vers `https://auth.<d>/`. C'est la parade contre l'open redirect.
- **VALIDATE** : tests par mock du driver Socialite. `Socialite::fake()` est à confirmer après installation, et il contourne le `state` : la logique `state` et binder se teste **sur les routes**. Cas couverts :
  - un `state` altéré donne 403 ;
  - un `state` rejoué donne 403 ;
  - un `state` expiré donne 403 ;
  - un rappel sans cookie binder, ou avec le binder d'un autre navigateur, donne 403 ;
  - `intent=link` via GET est refusé ;
  - un `link` avec `user_id` différent de la session donne 403 ;
  - un `return_to` piégé (`https://evil.example`, `https://agence.<d>.evil.example`, `//evil.example`, `https://user@evil`) renvoie vers le hub ;
  - les cas de liaison du 2.3 ;
  - un compte à 2FA est redirigé vers le défi.

#### 2.5 Flux mobile (`id_token`)
- **ACTION** : `POST /api/v1/auth/social/{provider}/token` (id_token, nonce pour Apple, authorization_code pour Apple, device_name, intent, profile) avec `throttle:auth`, en route publique listée.
- **IMPLEMENT** :
  - `VerifyIdentityToken::handle(provider, idToken, ?rawNonce)` récupère le JWKS (Google `https://www.googleapis.com/oauth2/v3/certs`, Apple `https://appleid.apple.com/auth/keys`) via `Http`, avec un cache de 1 h et un rechargement forcé une fois si le `kid` est inconnu. Il vérifie RS256, `iss`, `aud` (dans la liste mobile), `exp` (tolérance de 60 s) et, pour Apple, `nonce` = sha256(rawNonce).
  - `firebase/php-jwt` est déjà tiré par le provider Apple.
  - Apple : échanger `authorization_code` contre un `refresh_token`, stocké chiffré, pour la révocation en P4.
- **IMPLEMENT (vérification stricte)** :
  - Algorithme imposé : `JWK::parseKeySet($jwks, 'RS256')` puis `JWT::decode`. Refuser `alg: none` et HS256 (confusion d'algorithme).
  - `kid` obligatoire.
  - Rechargement forcé du JWKS **au plus une fois par minute** (sinon un `kid` aléatoire sert de vecteur DoS).
  - `Http::timeout(3)` sur une URL `https` en dur.
  - `iss` en égalité stricte : Google `https://accounts.google.com` ou `accounts.google.com`, Apple `https://appleid.apple.com`.
  - `sub` présent, `azp` contrôlé pour Google, `nonce` exigé pour Apple **et** pour Google (nonce envoyé par l'app au SDK).
  - Seul un JWKS valide est mis en cache.
- **IMPLEMENT (2FA)** : si le compte a la 2FA, renvoyer `{two_factor: true, challenge}` exactement comme au 1.7, jamais de jeton direct.
- **GOTCHA** :
  - Si le JWKS est injoignable, répondre 503 `provider_unavailable`. **Ne jamais** traiter une panne comme un jeton invalide, ni mettre la panne en cache (trois états : valide, invalide, non vérifiable).
  - L'`aud` Google diffère selon iOS, Android et web : accepter la liste `GOOGLE_CLIENT_IDS_MOBILE` uniquement sur cet endpoint.
- **VALIDATE** : tests avec un JWKS factice (paire RSA générée dans le test, `Http::fake`) couvrant :
  - signature invalide ;
  - `aud` étranger ;
  - jeton expiré ;
  - nonce faux ;
  - `email_verified` faux, sans liaison ;
  - JWKS en panne, qui donne 503 ;
  - `alg` HS256 ou `none` refusé ;
  - `kid` inconnu répété : un seul rechargement par minute ;
  - compte à 2FA : un `challenge` et non un jeton ;
  - chemin nominal, qui délivre un jeton.

### Phase P3 — app `auth/` et gardes

#### 3.1 App Next.js `auth/`
- **ACTION** : `pnpm dlx create-next-app@latest auth` dans `apps/`, branchée sur `packages/config`, `packages/ui` et `packages/api`, puis la même base : Zod, react-hook-form, TanStack Query, en-têtes de sécurité, `env.schema.ts`.
- **IMPLEMENT** : pages `/connexion`, `/inscription` (choix propriétaire ou agence), `/mot-de-passe-oublie`, `/reinitialiser`, `/verification-email`, `/deux-facteurs` et `/continuer`.
  - Client API : `fetch` avec `credentials: 'include'`. Appeler d'abord `GET /sanctum/csrf-cookie`, puis envoyer `X-XSRF-TOKEN` sur chaque POST.
  - Les boutons Google et Apple sont des **liens** vers `api.<d>/auth/social/{p}/redirect?...`, jamais des `fetch`.
  - Schémas Zod dans `src/schemas/auth.ts`.
- **IMPLEMENT (en-têtes)** : CSP stricte (`default-src 'self'`, `connect-src` vers `api.<d>` uniquement, `frame-ancestors 'none'`), `X-Frame-Options: DENY`. La page de connexion est la cible principale du framing et du phishing.
- **GOTCHA** :
  - Le cookie `XSRF-TOKEN` doit être lisible par JS sur `.<d>` : Laravel le pose sur `SESSION_DOMAIN`.
  - Aucun sous-domaine de contenu utilisateur sous `<d>`, et un DNS sans joker : un sous-domaine compromis peut planter un cookie de session sur `.<d>` (cookie tossing).
  - En local, utiliser `auth.eguardimmo.test:3001` ; avec `localhost` la session ne se partage pas.
- **VALIDATE** : `pnpm check`, puis en navigateur intégré : connexion par e-mail, retour vers `return_to`, rejet d'un `return_to` étranger.

#### 3.0 Passage en monorepo (ADR 0010)
- **ACTION** : `pnpm-workspace.yaml` (`apps/*`, `packages/*`, catalogue de versions), `portail/` déplacé en `apps/agence/`, socle extrait vers `packages/config`, socle du design system (`packages/tokens`, `packages/ui`, Storybook, ADR 0012), création de `apps/locataire`, `apps/proprietaire` et `apps/sebook` depuis la même base.
- **GOTCHA** : `portail/` contient un `.git` créé par `create-next-app` : le retirer demande l'accord de l'utilisateur.
- **VALIDATE** : `pnpm -r check` vert ; ESLint refuse un import d'une app vers une autre.

#### 3.2 Garde des applications d'espace
- **ACTION** : la garde vit dans `packages/api` ; chaque `apps/*/src/proxy.ts` (Next 16 : `proxy.ts` remplace `middleware.ts`) la branche avec son espace. Elle appelle `GET {API}/api/v1/me/profiles` en transmettant le cookie. Sur 401, redirection vers `AUTH_URL/connexion?return_to=<url courante>`. Sans le profil de l'app, page « vous n'avez pas accès à cet espace » avec les liens vers ceux auxquels l'utilisateur a droit.

#### 3.3 Connexion de la console
- **ACTION** : créer `apps/console` (même base). Page `/connexion` (e-mail, mot de passe, code TOTP). Le serveur Next appelle `POST /api/v1/console/auth/token`, garde le jeton dans une session serveur chiffrée et ne pose qu'un cookie HttpOnly, `Secure`, `SameSite=Strict`, sans attribut `Domain`. Toutes les données passent par des routes serveur de la console qui ajoutent `Authorization: Bearer`.
- **GOTCHA** : le jeton ne doit jamais atteindre le navigateur (ni props, ni JSON client). Sur `console.<d>`, les routes serveur vérifient `Origin` ; sur un domaine distinct, `SameSite=Strict` suffit contre une XSS du portail.
- **GOTCHA** : la garde côté Next n'est que du confort d'UX. La sécurité reste dans l'API (`space:*`), car masquer une page n'est pas un contrôle d'accès.

### Phase P4 — App Store

#### 4.1 Suppression de compte
- **ACTION** : `DELETE /api/v1/me` exige une ré-authentification de moins de 5 minutes (re-saisie du mot de passe, step-up 2FA ou `id_token` social frais) et déclenche `DeleteAccount::handle(userId)`. L'anonymisation libère l'e-mail (réinscription possible). Les `social_identities` sont supprimées **après** la révocation Apple, pour qu'aucun tiers ne récupère l'identité. Il révoque tous les jetons Sanctum, appelle `https://appleid.apple.com/auth/revoke` pour chaque identité Apple, anonymise l'utilisateur et émet `Identity\Events\AccountDeleted`. L'opération est auditée.
- **GOTCHA** : **pas de suppression physique** de données métier (règle globale). Les modules métier écoutent `AccountDeleted` et anonymisent ou conservent selon leurs obligations, par exemple les quittances déjà émises.

---

## Testing Strategy

### Tests clés (Pest, `tests/Feature/Identity/`)
| Test | Entrée | Attendu | Limite ? |
|---|---|---|---|
| connexion inconnue / mauvais mdp | e-mails existant et inexistant | même 422, même message | énumération |
| throttle connexion | 6 essais en 1 min | 429 | oui |
| inscription locataire | intended_profile=tenant | 422 | oui |
| `state` social altéré, rejoué ou expiré | — | 403 | oui |
| liaison e-mail non vérifié | Google `email_verified=false` | 409, pas de liaison | prise de contrôle |
| liaison compte local non vérifié | local `email_verified_at` null | 409 | CVE-2026-53516 |
| JWKS en panne | `Http::fake` 500 | 503, rien en cache | trois états |
| `return_to` étranger | `https://evil.example` | redirection vers le hub | open redirect |
| console par session cookie | opérateur connecté à une app d'espace | 403 `operator_token_required` | XSS same-site |
| audit immuable | `update()` / `delete()` | exception | oui |

### Edge Cases Checklist
- [ ] e-mail relais Apple (`@privaterelay.appleid.com`)
- [ ] nom Apple absent après la première connexion
- [ ] même identité Google liée à un 2ᵉ compte → 409
- [ ] compte sans mot de passe : « mot de passe oublié » permet d'en définir un
- [ ] utilisateur supprimé : jetons révoqués, plus de connexion sociale
- [ ] connexions concurrentes avec le même `state` : une seule réussit

---

## Validation Commands

```bash
cd backend && composer check
```
EXPECT : Pint OK, PHPStan 0 erreur, Pest vert, sans test ignoré.

```bash
cd auth && pnpm check
```
```bash
pnpm -r check
```
EXPECT : lint, typecheck, test et build OK.

```bash
cd backend && php artisan migrate:fresh && php artisan route:list --path=auth
```
EXPECT : les migrations Identity et Shared passent ; les routes Fortify et sociales sont présentes.

### Manual Validation (navigateur intégré, `*.eguardimmo.test`)
- [ ] Connexion par e-mail sur `auth.`, retour sur `app.` avec la session partagée.
- [ ] Console : connexion refusée sans code TOTP, puis accès avec le code ; la session des apps d'espace ne donne aucun accès à `/console`.
- [ ] Google en vrai, avec les identifiants de test de l'utilisateur : inscription propriétaire, puis reconnexion.
- [ ] Apple : nécessite un domaine https vérifié chez Apple, donc à valider en préproduction (impossible en `.test`).

## Acceptance Criteria
- [ ] Les 4 phases sont livrées et `composer check` / `pnpm check` sont verts.
- [ ] Chaque route publique d'authentification a `throttle:auth` et figure dans `ROUTES_PUBLIQUES`.
- [ ] Aucun secret dans le dépôt (`.p8`, client secrets) ; tout est dans `.env.example`, sans valeur.
- [ ] `/security-review` et la revue OWASP passent sans constat haut.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rappel Apple en POST cross-site sans session | Haute | Haut | `state` chiffré et à usage unique, cookie binder `SameSite=None`, exemption anti-falsification sur le seul rappel |
| CSRF de connexion / liaison OAuth | Moyenne | Critique | binder lié au navigateur, `link` en POST authentifié seulement (revue sécurité C1) |
| XSS sur `app.` qui atteint la console via le cookie partagé | Moyenne | Critique | `/console` n'accepte que le jeton console détenu par le serveur Next, jamais la session cookie (ADR 0004 révisé) |
| Prise de contrôle par liaison e-mail | Moyenne | Critique | double `email_verified`, clé `(provider, sub)`, tests dédiés |
| Session non partagée en local | Haute | Moyen | sous-domaines `*.eguardimmo.test` |
| Rejet App Store (4.8 / 5.1.1) | Moyenne | Haut | Apple au même niveau que Google, suppression de compte en P4 |
| Panne JWKS prise pour un refus | Moyenne | Moyen | 503 explicite, jamais mis en cache |

## Actions manuelles (utilisateur)
- **Google Cloud** : écran de consentement OAuth, puis 3 identifiants client (web avec l'URI `https://api.<d>/auth/social/google/callback`, iOS, Android avec le SHA-1).
- **Apple Developer** : App ID avec la capacité Sign in with Apple, un Services ID (domaine et URL de retour), une clé `.p8` (Key ID, Team ID), et l'enregistrement du domaine d'envoi pour le relais e-mail privé.
- **DNS** : `api.`, `auth.`, `locataire.`, `proprietaire.`, `agence.` et `sebook.` sous le même domaine parent ; la console de préférence sur un domaine enregistrable distinct (nom à choisir).
