# ADR 0003 — Espaces et profils utilisateur

Statut : accepté (2026-11-13), révisé le même jour après revue : espace organisation (ADR 0006), espace propriétaire en consultation, console par jeton (ADR 0004), une application web par espace (ADR 0010), bailleur autonome dans l'application Propriétaire.
Amendement (2026-11-15) : rôles d'organisation alignés sur les écrans — `owner` (titulaire, créateur, ni retiré ni désactivé ni changé de rôle), `admin`, `manager` (gestionnaire), `accountant` (comptable) ; `agent` abandonné. 2FA exigée pour `owner` et `admin` d'une agence, et pour tous les membres quand l'organisation l'impose. Un non-membre reçoit 404 `organization_not_found` sur `/org/{organization}`, sans distinguer « inexistante » et « interdite ». Les rôles restent des tables liées à `users` par `user_id` (composition), jamais des tables qui en héritent.

## Contexte

eGuardImmo sert un espace locataire, un espace propriétaire, un espace agence, une console réservée à l'exploitant de la plateforme et une application mobile multi-profil. Le bailleur autonome gère ses biens lui-même, depuis l'application Propriétaire.

## Décision

- **Un compte par personne** (`User`, e-mail unique, module Identity) qui peut cumuler plusieurs profils : locataire, propriétaire mandant, membre d'une ou plusieurs organisations (admin, gestionnaire ou agent) et opérateur. Le client choisit son espace ; le serveur ne garde aucun « profil actif » en état.
- **Un préfixe d'API par espace**, contrôlé côté serveur :

| Espace | Préfixe | Garde | Pour qui |
|---|---|---|---|
| Locataire | `/api/v1/tenant/...` | `space:tenant` | partie à un bail |
| Propriétaire | `/api/v1/owner/...` | `space:owner` | biens confiés à une agence, **en consultation** (biens, baux, reversements, documents) |
| Organisation | `/api/v1/org/{organization}/...` | `space:organization` + appartenance + rôle, pose le contexte d'organisation (ADR 0006) | membres d'une agence ; bailleur autonome pour ses propres biens |
| SeBook | `/api/v1/marketplace/...` | lectures publiques listées explicitement (recherche, annonce, disponibilités) ; réserver, favoris, contacter : `auth:sanctum` + e-mail vérifié | visiteurs ; tout compte vérifié pour agir |
| Console | `/api/v1/console/...` | `space:operator`, **jeton console uniquement** (ADR 0004) | opérateur |

- **Bailleur autonome** : il utilise l'**application Propriétaire**, qui appelle `/org/{organization}` pour les biens qu'il gère lui-même (son organisation `individual`) et `/owner` pour ceux qu'il a confiés à une agence. Un même propriétaire peut cumuler les deux. L'application Agence ne sert que les organisations `agency`.
- `GET /api/v1/me/profiles` renvoie les espaces et les organisations accessibles.
- **Dans chaque module**, les contrôleurs sont rangés par espace : `Http/Controllers/{Tenant,Owner,Organization,Console}/`. Ils restent fins et partagent les Actions et les classes `Queries/`. Chaque espace a ses propres API Resources, qui n'exposent que les champs utiles à ce public (minimisation).
- **Rôle opérateur** : attribué par une commande artisan journalisée, jamais par une adresse e-mail écrite dans le code. 2FA obligatoire pour les opérateurs et les admins d'organisation.
- **Clients** (ADR 0010) :
  - une application Next.js par espace : `apps/locataire`, `apps/proprietaire`, `apps/agence`, `apps/sebook` ;
  - `apps/console` : séparée, hors du hub de connexion (ADR 0004) ;
  - application mobile **Flutter**, multi-profil, sans console.
- **Voyageur (SeBook)** : inscription libre, sans profil particulier ; ses réservations, favoris et messages lui sont rattachés. Les annonces appartiennent à l'organisation de l'hôte (ADR 0006).
- **Locataire** : inscription sur invitation seulement. **Propriétaire** : bailleur autonome (inscription libre, crée une organisation `individual`), mandant invité par une agence, ou les deux ; dans tous les cas, application Propriétaire.

## Options écartées

- **Bailleur autonome dans l'application Agence** : proposé, écarté par l'utilisateur (13/11/2026) ; un propriétaire attend de tout gérer depuis l'app Propriétaire.
- **Espace API propre au bailleur autonome** : dupliquerait toute la logique de gestion côté serveur ; l'organisation `individual` réutilise l'espace organisation.
- **Préfixe `/agency/{agency}`** : le nom excluait le bailleur autonome.
- **Un portail unique pour les trois espaces** : remplacé par une application par espace (ADR 0010).
- **Console dans une application d'espace** : surface d'attaque plus grande, sans isolement de session.
- **Un compte par rôle** : une personne qui cumule les rôles multiplierait ses adresses e-mail.
- **Profil actif en session côté serveur** : état caché, source de confusion entre onglets et appareils.
- **React Native / Expo** : il faudrait repartir de zéro alors que l'équipe et l'outillage Flutter existent.

## Conséquences

- Chaque route protégée est testée dans son espace : 401 sans session, 403 sans le profil, 404 sur la ressource d'une autre organisation, d'un autre locataire ou d'un autre mandant.
- Le middleware `space:*`, `/me/profiles` et la commande d'attribution du rôle opérateur arrivent avec la brique Identity.
- Les profils locataire, propriétaire et organisation sont fournis par les modules Leases, Mandates et Organizations quand ils existent.
