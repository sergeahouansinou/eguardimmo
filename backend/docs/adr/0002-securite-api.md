# ADR 0002 — Sécurité de l'API : authentification, limitation de débit, proxies

Statut : accepté (2026-11-13)

## Décision

### Authentification
- **Applications web d'espace (Next.js, ADR 0010)** : Sanctum en mode SPA, avec un cookie de session HttpOnly, `Secure`, `SameSite=Lax` et une protection CSRF (`GET /sanctum/csrf-cookie`). Ces applications et l'API partagent un domaine parent (`SESSION_DOMAIN=.domaine`, `SANCTUM_STATEFUL_DOMAINS`). Aucun jeton n'est stocké dans le navigateur.
- **Application mobile** : jetons personnels Sanctum, expirés après 30 jours (`SANCTUM_TOKEN_EXPIRATION_MINUTES`). Ils sont révoqués à la déconnexion et au changement de mot de passe, et purgés chaque jour (`sanctum:prune-expired`).
- **CORS** : liste blanche `CORS_ALLOWED_ORIGINS` avec `supports_credentials`, jamais `*`.

### Limitation de débit
- Limiteur `api`, appliqué à tout le groupe : 300 req/min par utilisateur authentifié, 60 req/min par IP anonyme. Le plafond est volontairement large : il coupe l'abus sans gêner l'usage normal.
- Limiteur `auth`, à appliquer explicitement aux routes de connexion, OTP, mot de passe oublié et inscription : 5/min par couple compte+IP et 20/min par IP.
- Toute clé « par IP » passe par `App\Shared\Http\RateLimitIp` : une adresse IPv6 compte pour son préfixe /64 (une seule ligne d'abonné en dispose), une adresse IPv4, même écrite en `::ffff:`, reste entière. Le journal d'audit et les preuves gardent l'adresse complète.
- Laravel exécute `auth:sanctum` avant `throttle` : une route protégée rejette un anonyme en 401 avant de le compter. La limite anonyme ne s'applique donc qu'aux routes publiques.

### Proxies
- `TRUSTED_PROXIES` (liste séparée par des virgules), vide par défaut : aucun proxy de confiance. À renseigner au déploiement, par exemple `127.0.0.1` derrière Nginx ou les plages Cloudflare.

## Options écartées

- **BFF Next.js qui détient le jeton** : plus de code côté portail ; utile seulement si le portail et l'API n'ont pas de domaine parent commun.
- **Jeton court + refresh rotatif partout** : le plus de code, et l'ancien portail a subi une course multi-onglets sur le refresh à usage unique.
- **Aucune limitation, comme l'ancien backend** : contraire aux règles de sécurité (force brute, énumération).

## Conséquences

- Toute route d'authentification ajoutée doit porter `throttle:auth`.
- Le déploiement doit fixer `SESSION_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS`, `TRUSTED_PROXIES` et `SESSION_SECURE_COOKIE=true` (valeur par défaut).
- Implémenté dans `bootstrap/app.php` (`statefulApi`, `throttleApi`), `app/Providers/HttpSecurityServiceProvider.php`, `config/{cors,session,sanctum,app}.php` ; tests dans `tests/Feature/HttpSecurityTest.php`.
