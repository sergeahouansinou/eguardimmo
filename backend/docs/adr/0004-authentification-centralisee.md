# ADR 0004 — Authentification centralisée et connexion Google / Apple

Statut : accepté (2026-11-13), révisé le même jour : la console sort du hub (section « Console »). Complète l'ADR 0002 (Sanctum) et l'ADR 0003 (espaces). Plan : `../.claude/PRPs/plans/auth-centralisee-google-apple.plan.md`.

## Décision

### Hub de connexion unique pour les applications d'espace
- Domaines : `api.<domaine>` pour Laravel, `auth.<domaine>` pour l'app `apps/auth`, puis `locataire.`, `proprietaire.` et `agence.<domaine>` pour les applications d'espace (ADR 0010).
- Une seule session Sanctum, en cookie HttpOnly sur `SESSION_DOMAIN=.<domaine>`, partagée par le hub et les quatre applications d'espace (locataire, propriétaire, agence, SeBook). Se connecter une fois ouvre les espaces auxquels on a droit (ADR 0003).
- Chaque application renvoie vers `auth.<domaine>/connexion?return_to=…`. `return_to` est vérifié contre une liste blanche côté serveur et côté client.
- Aucun sous-domaine de contenu utilisateur sous `<d>`, et un DNS sans joker (cookie tossing).

### Console : hors du hub, par jeton détenu côté serveur
- La console (`console/`, Next.js) a **sa propre page de connexion** : e-mail, mot de passe et code TOTP, exigés à **chaque** connexion. Pas de Google ni d'Apple.
- Le serveur Next de la console obtient de l'API un **jeton Sanctum opérateur** (`POST /api/v1/console/auth/token`, `throttle:auth`, audité), à durée courte (`CONSOLE_TOKEN_TTL_MINUTES`, 240 par défaut) et à capacité `operator`. Il le garde dans sa session serveur ; le navigateur ne reçoit qu'un cookie HttpOnly, `SameSite=Strict`, limité à l'hôte de la console. La console appelle l'API de serveur à serveur.
- L'API n'accepte sur `/api/v1/console/*` que ce jeton : **une session par cookie y est refusée**, même celle d'un opérateur. Une XSS sur une application d'espace ne peut donc pas atteindre la console avec le cookie partagé.
- La console est servie de préférence sur un **domaine enregistrable distinct** de `<d>` : son cookie devient cross-site par rapport aux applications d'espace. Sinon, sur `console.<d>`, ses routes serveur vérifient l'en-tête `Origin`.
- En local, utiliser des sous-domaines `*.eguardimmo.test` (fichier hosts). Un cookie ne se partage pas entre `localhost:3000` et `localhost:3001` avec un domaine parent.

### Moteur
- **Laravel Fortify** (headless, sans vues) pour la connexion, l'inscription, le mot de passe oublié, la vérification d'e-mail, la 2FA TOTP avec codes de secours et la confirmation de mot de passe. Ses classes d'adaptation vivent dans `app/Modules/Identity/Fortify/` et délèguent à des Actions `handle()`.
- **Laravel Socialite** + `socialiteproviders/apple` pour Google et Apple, côté web.
- **Mobile** : le SDK natif (Google Sign-In, Sign in with Apple) fournit un `id_token`. L'API le vérifie elle-même : signature JWKS en cache, `iss`, `aud`, `exp`, `nonce` pour Apple, `email_verified`. Elle délivre ensuite un jeton Sanctum de 30 jours.

### Inscription
- Google, Apple ou e-mail : inscription libre pour les profils **propriétaire** (bailleur autonome), **agence** et **voyageur** (SeBook, compte sans profil de gestion).
- **Locataire** : uniquement en acceptant une invitation ; Google/Apple sont alors permis. Branché quand le module d'invitations existe.
- Les comptes sans mot de passe sont autorisés (`password` nullable). Ils doivent définir un mot de passe avant d'activer la 2FA, ce qui est obligatoire pour un opérateur.
- Anti-énumération : inscription et mot de passe oublié répondent de la même façon, que l'e-mail existe ou non.
- Tout changement de mot de passe, d'e-mail ou de 2FA révoque les jetons mobiles et les autres sessions.

### Liaison de comptes (anti-prise de contrôle)
- Une identité sociale se clé sur `(provider, sub)`, jamais sur l'e-mail.
- **Liaison automatique** à un compte existant par e-mail : seulement si le fournisseur affirme `email_verified=true` **et** que l'e-mail du compte local est vérifié. Sinon, refus ; l'utilisateur se connecte autrement puis lie Google/Apple depuis son profil.
- **2FA** : une connexion sociale d'un compte à 2FA passe par le défi 2FA.

### Apple
- Le `client_secret` (JWT) est généré à la demande depuis la clé `.p8` : pas de rotation manuelle tous les 6 mois.
- Le nom n'est fourni qu'à la première connexion : il faut l'enregistrer à la création.
- Les adresses relais privées imposent d'enregistrer le domaine d'envoi d'e-mails chez Apple.
- Le rappel web arrive en POST cross-site (`form_post`). Le cookie `SameSite=Lax` n'y est pas envoyé : l'état OAuth est donc porté par un `state` chiffré, à usage unique, **lié au navigateur** par un cookie binder `SameSite=None; Secure` dont le hash figure dans le `state`. Sans binder, un attaquant ferait ouvrir son propre rappel à la victime (CSRF de connexion, prise de contrôle par liaison).
- La liaison d'un compte Google/Apple à un compte existant ne part que d'une requête POST authentifiée, avec ré-authentification récente.
- La suppression de compte depuis l'app (exigence App Store 5.1.1(v)) révoque le jeton Apple. `DELETE /api/v1/me` (décision du 2026-11-14) :
  - elle exige une preuve récente : code 2FA, mot de passe ou `id_token` d'un fournisseur lié (à usage unique), ou une session web confirmée depuis moins de 10 minutes. Avec la 2FA active, le mot de passe ne suffit jamais, même confirmé en session ;
  - limite de débit par compte (`throttle:reauth`), et le verrou de compte s'applique aussi à la confirmation de mot de passe de Fortify ;
  - tout se passe sous verrou de la ligne `users` : une liaison sociale concurrente attend, une seconde suppression ne fait rien ;
  - le compte n'est **jamais effacé** : il est marqué supprimé (`deleted_at`). Son e-mail et le `subject` de ses identités sociales reçoivent le suffixe `-deleted-{id}`, ce qui permet de se réinscrire plus tard avec la même adresse ou le même compte Google ou Apple ;
  - les données du compte sont conservées telles quelles (nom, adresse d'origine lisible avant le suffixe, empreinte du mot de passe, secret 2FA, appareils), par décision du 2026-11-14. La durée de conservation et la réponse à une demande d'effacement RGPD restent à définir ;
  - jetons, sessions, liens de réinitialisation et rôle opérateur sont révoqués, puis `Identity\Events\AccountDeleted` est émis : chaque module décide d'anonymiser ou de conserver selon ses obligations ;
  - la révocation Apple ne bloque jamais la suppression (décision du 2026-11-15) : en cas d'échec (Apple injoignable, refus, configuration `.p8` cassée), le compte est quand même supprimé, l'échec est signalé (`report`, audit `identity.apple.revocation_deferred`) et le jeton reste chiffré sur l'identité. La commande `identity:revoke-deferred-apple-tokens`, planifiée toutes les heures, retente ; elle sort en échec tant qu'il reste un jeton non révoqué.

- Contrat web avec le hub (décision du 2026-11-15) :
  - les e-mails pointent vers les pages du hub : `/mot-de-passe/nouveau?jeton=…&email=…` pour la réinitialisation, `/verification-email/confirmer?jeton=<lien signé de l'API>` pour la vérification. Le hub n'appelle que le lien signé de son propre domaine d'API ;
  - `POST /api/v1/auth/password-reset/status` (`throttle:auth`, public) répond `valid` ou `expired` sans consommer le jeton. Il répond pareil, au même coût de calcul, pour un compte inconnu, un mauvais jeton et un jeton expiré ;
  - `GET /api/v1/me/security` (session requise) donne la 2FA (activée, codes de secours restants sur 8), la présence d'un mot de passe, les comptes Google et Apple liés, les appareils mobiles et la fin de la confirmation récente. Les secrets ne sortent jamais ;
  - l'inscription n'ouvre pas de session : elle répond pareil que l'adresse existe ou non, une session ouverte révélerait l'existence du compte. Le renvoi du lien de vérification et le clic sur ce lien demandent donc une connexion préalable ;
  - Fortify ne distingue pas un défi 2FA expiré d'un code faux : les deux répondent 422.

## Options écartées

- **Keycloak** : un service Java de plus à opérer, thémer et synchroniser, et il remplace Sanctum. Ses avantages (fonctionnement entre domaines différents) ne servent pas tant que tout reste sous un domaine parent.
- **Laravel Passport (OIDC)** : nettement plus de code que le hub Sanctum, et il remplace l'ADR 0002.
- **Pages de connexion dans chaque application** : trois copies du même parcours sensible, et la console dépendrait d'elles.
- **Console dans le hub avec step-up TOTP et contrôle d'`Origin`** (première version de cet ADR) : la session partagée laisse une XSS same-site viser la console, et l'isolement repose sur trois mécanismes à tenir justes ensemble. Un cookie de session à nom différent n'isole rien non plus : le navigateur envoie les cookies selon l'hôte de destination (`api.<d>`), pas selon la page d'origine.
- **Liaison automatique sur e-mail seul** : c'est le schéma classique de pré-prise de contrôle de compte (CVE-2026-53516 sur better-auth).

## Conséquences

- Le hub et les applications d'espace doivent rester sous un même domaine parent ; la console n'en a pas besoin. Si un jour ce n'est plus le cas, il faudra rouvrir cette décision (OIDC).
- Variables d'environnement nouvelles : identifiants Google (web, iOS, Android), Apple (team, key id, `.p8`, services id, bundle id) et liste blanche `AUTH_RETURN_TO_ALLOWED_HOSTS`.
- Actions manuelles hors code : console Google Cloud (écran de consentement, URI de redirection), compte Apple Developer (Services ID, domaines, relais e-mail).
