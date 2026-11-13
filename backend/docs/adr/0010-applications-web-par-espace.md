# ADR 0010 — Une application web par espace

Statut : accepté (2026-11-13). Remplace le « portail unique » de l'ADR 0003. Décision de l'utilisateur : locataire, propriétaire, agence et SeBook sont des projets Next.js distincts.

## Décision

### Six applications Next.js
| Application | Dossier | Hôte | Espace API | Public |
|---|---|---|---|---|
| Locataire | `apps/locataire` | `locataire.<d>` | `/tenant` | locataires |
| Propriétaire | `apps/proprietaire` | `proprietaire.<d>` | `/owner` + `/org/{organization}` (organisation `individual`) | bailleurs autonomes (gestion) et mandants (consultation) |
| Agence | `apps/agence` | `agence.<d>` | `/org/{organization}` (organisation `agency`) | membres d'agence (ADR 0006) |
| SeBook | `apps/sebook` | `sebook.<d>` | `/marketplace` | visiteurs et voyageurs : recherche d'annonces, réservation, favoris, contact (remplace `airbnb-like`) |
| Connexion | `apps/auth` | `auth.<d>` | `/auth/*` | tous sauf l'opérateur (ADR 0004) |
| Console | `apps/console` | domaine distinct | `/console` | opérateur |

- Les quatre applications d'espace (locataire, propriétaire, agence, SeBook) partagent la session du hub (cookie sur `.<d>`). Un utilisateur qui cumule les profils passe de l'une à l'autre par un sélecteur alimenté par `/me/profiles`, sans se reconnecter.
- Chaque application se déploie seule, a sa propre CSP (`connect-src` limité à `api.<d>`) et n'appelle que les préfixes d'API de son public (tableau ci-dessus).

### Monorepo pnpm
```
new-eguardimmo/
├── backend/                 Laravel
├── apps/{locataire,proprietaire,agence,sebook,auth,console}/
├── packages/
│   ├── tokens/              jetons de design, source unique web + mobile (ADR 0012)
│   ├── ui/                  composants React du design system (ADR 0012)
│   ├── api/                 client HTTP (CSRF, erreurs), schémas Zod des contrats, garde de session
│   ├── gestion/             écrans et hooks de gestion locative partagés par Agence et Propriétaire
│   └── config/              tsconfig, ESLint, en-têtes de sécurité, schéma d'env
└── pnpm-workspace.yaml      apps/*, packages/*, catalogue de versions
```
- Les paquets internes sont publiés en source TypeScript et compilés par chaque app (`transpilePackages`) : pas d'étape de build par paquet.
- Versions de Next, React, Zod, TanStack Query… fixées une fois dans le **catalogue pnpm** : toutes les apps ont les mêmes.
- Règles de dépendance : une app n'importe jamais une autre app ; un paquet n'importe jamais une app ; `ui` ne dépend pas de `api`. Ces règles sont vérifiées par ESLint (`import/no-restricted-paths`).
- Un composant ou une logique utilisés par deux apps passent dans un paquet. La gestion locative (biens, baux, quittances, paiements, charges) vit dans `packages/gestion`, paramétrée par l'organisation : Agence et Propriétaire l'assemblent sans la recopier. Les fonctions réservées aux agences (équipe, mandats, honoraires, registre) restent dans `apps/agence`.
- `gestion` peut importer `ui` et `api`, jamais une app.
- Le style ne vient que de `packages/tokens` et `packages/ui` (ADR 0012) : aucune app ne définit ses propres couleurs ni ses composants génériques.
- `pnpm -r check` à la racine lance lint, typecheck, tests et build de tout le monorepo.

## Options écartées

- **Un seul portail pour les trois espaces** (proposition initiale) : écarté par l'utilisateur. Des apps séparées donnent des déploiements, des bundles et des surfaces d'attaque indépendants par public.
- **Dépôts Git séparés par app** : le design system et les versions dériveraient d'une app à l'autre.
- **Turborepo ou Nx** : inutiles au départ, `pnpm -r` suffit. À réévaluer si les builds deviennent lents.
- **Micro-frontends (module federation)** : complexité d'exécution sans besoin.

## Conséquences

- `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS` et `AUTH_RETURN_TO_ALLOWED_HOSTS` listent `locataire.`, `proprietaire.`, `agence.`, `sebook.` et `auth.`.
- Une XSS dans l'une des quatre apps atteint la session partagée, et donc les espaces de l'utilisateur concerné : CSP stricte dans chaque app, et contrôles d'accès toujours côté API (`space:*`).
- Après l'inscription, un bailleur autonome arrive sur `proprietaire.<d>`, une agence sur `agence.<d>`, un voyageur revient sur `sebook.<d>`.
- **SeBook est public et indexé** : rendu serveur, métadonnées OG et JSON-LD, sitemap. C'est la plus grande surface exposée : aucune donnée personnelle dans les pages publiques, annonces désignées par une référence opaque (jamais un id séquentiel), contenu utilisateur (descriptions, avis, messages) toujours échappé, jamais de HTML brut.
- « Devenir hôte » sur SeBook mène à l'inscription bailleur autonome ou agence, puis à l'app correspondante.
- `landing/` (vitrine) reste à décider.
- Le projet `portail/` est devenu `apps/agence/` le 2026-11-13 (port 3010), sans son `.git` de `create-next-app`. Son socle est dans `packages/config` : `env/public` (schéma Zod des variables publiques) et `next/security-headers`.
- En local : `locataire.eguardimmo.test`, `proprietaire.eguardimmo.test`, `agence.eguardimmo.test`, `sebook.eguardimmo.test`, `auth.eguardimmo.test`, chacune sur son port.
