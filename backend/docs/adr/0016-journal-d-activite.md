# ADR 0016 — Journal d'activité et historique des entités

Statut : accepté (2026-11-13). Complète l'ADR 0002 (sécurité) et l'ADR 0004 (console opérateur).

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
- Les données personnelles des différentiels sont visibles des opérateurs. D'où les attributs masqués, la consultation réservée à la console et la journalisation des lectures.
- `request_id` relie le journal, les logs applicatifs et les erreurs (ADR 0014 : membre `request_id` des problèmes 5xx).
