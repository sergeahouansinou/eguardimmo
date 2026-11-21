# ADR 0038 — Agenda, tâches, contacts et journal d'activité de l'espace organisation

Statut : accepté (2026-11-20), recommandations validées telles quelles. Donne un serveur aux familles « Agenda », « Tâches et rappels », « Contacts » et « Journal d'activité » de `packages/gestion`, gatées en mode API (`packages/gestion/src/features/indisponible/capabilities.ts:25-29`). Vaut pour `/org/{organization}`, organisations `agency` et `individual` (ADR 0003, 0006). Touche les ADR 0003, 0005, 0006, 0008, 0014, 0016, 0017, 0019, 0021, 0027 et 0029. Amendements listés en fin de document, **non appliqués**. Aucun texte légal n'a été relu pour cet ADR : tout point juridique est **à confirmer** (ADR 0011).

## Contexte

Constaté dans le code (2026-11-20) :

- **Écrans** (données de démonstration, sources `createSourceContext`) :
  - Agenda : types `visite`, `rendez_vous`, `echeance`, `intervention`, `rappel`, `contrat`, `anniversaire` (`suivi/agenda/schemas.ts:5`) ; récurrence `aucune|hebdomadaire|mensuelle|annuelle` (`:18`) ; date, heure locale sans fuseau, bien facultatif, invités en **noms libres** (20 max), notes 1 000, rappel booléen (`:30-40`) annoncé « par e-mail la veille » (`EvenementFormPage.tsx:158`). Le client **compose** événements, échéances, interventions et tâches (`agenda/source.ts:47-66`) et développe les récurrences (`calendar.ts:63-79`). Lien iCal par URL secrète (`IcalDialog.tsx:30`, `demo.ts:34`). Événement « Anniversaire de Koffi Adjovi », annuel (`agenda/demo.ts:15`).
  - Tâches : sujet, bien **obligatoire**, assigné parmi des **noms** figés, échéance, rappel `{canal email|notification, 0 à 90 jours}`, `done` (`taches/schemas.ts:5-27`, `shared/biens.ts:35`) ; actions unitaires et groupées : terminer, reporter, assigner, supprimer (`taches/source.ts:10-19`) ; onglets À faire, En retard, Terminées (`TachesPage.tsx:188-190`), filtres semaine et mois (`:213-214`).
  - Contacts : catégories `artisan|syndic|assureur|garant|commissaire` (`contacts/schemas.ts:4`) ; nom, « interlocuteur », spécialité, téléphone ou e-mail obligatoire, biens, **partagé avec les locataires du bien**, notes 500, archivé (`:27-67`) ; import CSV de 500 lignes au plus, doublons détectés **dans le fichier** seulement (`importCsv.ts:66,104`, `shared/csv.ts:4`) ; suppression « définitive » (`ContactDetailPage.tsx:167`) ; interventions liées **par nom** (`ContactDetailPage.tsx:56`).
  - Journal : types `connexion|droits|paiement|document|export|securite`, membre, action, détail, origine géolocalisée (« 81.250.xx.xx, Paris »), appareil, **empreinte**, avant/après (`compte/journal/schemas.ts:3-29`, `demo.ts:12`, `JournalTable.tsx:44`) ; filtrage, tri et export CSV **côté client** sur toute la liste (`filters.ts:14-25`, `JournalPage.tsx:22-34,67-68`), pagination numérotée avec total (`JournalFooter.tsx:5`).
  - L'application Agence n'a aucune de ces quatre routes (`apps/agence/src/app/(espace)/`) ; seule l'application Propriétaire les monte.
- **Serveur** :
  - Aucun module ne porte agenda ni tâches. `organizations` n'a pas de fuseau (`Organizations/Database/Migrations/2026_11_15_100000_create_organizations_table.php:15-21`) ; l'application tourne en UTC (`config/app.php:70`).
  - **Parties** couvre déjà l'annuaire : catégories de contact par terme Catalog (`party_contact_categories`, migration `2026_11_15_150000_create_parties_tables.php:41-51`) de sens `bailiff|craftsman|syndic|insurer|notary|accountant|other` (`Catalog/Enums/ContactCategorySemantic.php:7-16`), points de contact avec libellé (`:53-67`), identifiants dédoublonnés par empreinte (`:79`), étiquettes (`Actions/SyncPartyTags.php`), liste filtrée `q|category|kind|status` (`ListPartiesRequest.php:28-32`), archivage, restauration et anonymisation (`Parties/Http/routes.php:45-79`). Pas de note, pas de lien vers un bien. L'ADR 0019 annonce un écran « Contacts » unique (`0019:37`) et fait naître le rôle de la relation (`0019:19`).
  - **Maintenance** : un prestataire est une partie (`0029:92`), `supplier_profiles` porte la relation de travail (`0029:43`) ; liste des interventions filtrable par `supplier_party_id` (`ListInterventionsRequest.php:34`), sans filtre de période (`:30-37`) ; visites à la date et au créneau, sans heure (`0029:42`).
  - **Documents** : pièces à échéance listées sans filtre de période (`ListCertificatesRequest.php:30-35`).
  - **Journal** : `audit_logs` en ajout seul, déclencheurs MySQL (`database/migrations/2026_11_13_190000_create_audit_logs_table.php:67-70`), index `(organization_id, occurred_at)` (`:32`), `occurred_at` en `timestamp(6)` (`:16`). Lecture réservée à la console (`Identity/Http/routes.php:60-63`, `Identity/Queries/ActivityLog.php:26`). Attributs masqués écrits `[masqué]` (`Shared/Audit/RecordModelChange.php:51-61`). Rétention non fixée (`0016:78`).
  - **Notifications** : préférence par compte × type × canal (`0027:54`), gabarits sans texte libre (`0027:4`), clé unique `(user_id, type, dedup_key)` (`0027:68`).
  - Rôles : `owner|admin|manager|accountant` (`Organizations/Enums/MemberRole.php:7-12`) ; périmètre de biens d'un membre défini mais appliqué nulle part (`0027:97`).
  - Frontières : modèle métier sous `BelongsToOrganization` (`AGENTS.md:39`), `AuditLog` seul modèle hors module (`tests/Architecture/ArchTest.php:58-61`) ; liens autorisés vérifiés module par module (`tests/Feature/Maintenance/ArchitectureTest.php:5-13`).

## Décision

### 1. Invariants

1. Tout est sous `/org/{organization}`, contexte posé par `space:organization` ; aucune lecture `AcrossOrganizations`. Ressource d'une autre organisation : **404**.
2. Aucune donnée d'un autre module recopiée : un lien est un UUID vérifié par la PublicApi du module cible (ADR 0017:27-28), relu à l'affichage.
3. Aucune suppression physique : annulation ou archivage, audités.
4. Les rappels passent par Notifications et ses préférences (ADR 0027) ; aucun canal choisi par objet.
5. Le journal de l'organisation est une **vue expurgée** de `audit_logs`, jamais une seconde table.

### 2. Module Planning (agenda et tâches), créé

- **Nouveau module `Planning`** (famille Gestion) : événements saisis et tâches. Même cycle de vie (saisie libre, sans obligation légale), mêmes rappels : un module, pas deux.
- **Pas d'agrégateur serveur** (précédent : ADR 0036, décision 2). Le client compose, comme aujourd'hui (`agenda/source.ts:47-66`) : événements et tâches (Planning), interventions et visites (Maintenance), pièces à échéance (Documents). Chaque module garde ses dates ; on ajoute seulement un filtre de période aux listes existantes (décision 6).
- **Types d'événement** : `visit`, `appointment`, `deadline`, `reminder`. Retirés : `intervention` (vient de Maintenance), `echeance` (vient des modules), `anniversaire` (date de naissance collectée pour identifier, pas pour cet usage : finalité **à confirmer**).
- **Liens** : `property_id` ou `unit_id` (contrôlés par `Properties\PublicApi\UnitDirectory`, méthode `findProperty` à ajouter), `lease_id` (`LeaseDirectory::find`), tous facultatifs. Le bien n'est plus obligatoire côté serveur.
- **Participants** : membres (`user_id`, vérifiés par `MembershipDirectory::activeMembership`) et fiches (`party_id`, `PartyDirectory::find`), 20 au plus. Plus de nom libre ; **aucune invitation envoyée** à un tiers.
- **Fuseau** : `organizations.timezone` (IANA), proposé par la juridiction (ADR 0008 : `Fr` Europe/Paris, `Be` Europe/Brussels, `Lu` Europe/Luxembourg, `Ca/Qc` America/Toronto), modifiable par `owner`/`admin`. L'événement stocke **date locale, heure locale et fuseau copié** à la création : un changement de fuseau de l'organisation ne déplace pas l'existant. Événement sans heure = journée entière, sans fuseau. Conversion en UTC au calcul des rappels seulement ; heure inexistante au passage à l'heure d'été : avancée à l'heure valide suivante.
- **Récurrence** : `none|weekly|monthly|yearly`, `recurrence_until` facultatif. Mensuelle le 31 ou annuelle le 29 février : ramenée au dernier jour du mois (comportement actuel de `calendar.ts`). Pas d'exception d'occurrence : une modification vaut pour la série. Développement côté serveur sur une fenêtre ≤ 62 jours, 500 occurrences au plus.
- **Tâches** : `status` `open|done|cancelled`, `due_on` (date locale de l'organisation), `assignee_user_id` (membre actif à l'écriture ; un ex-membre reste affiché « inactif » jusqu'à réassignation), `done_at`, `done_by_user_id`. « En retard » est calculé (`due_on` < aujourd'hui dans le fuseau de l'organisation), jamais stocké. Actions groupées (terminer, reporter, assigner) : 100 identifiants au plus, une transaction, tout ou rien, 404 si un identifiant est inconnu.
- **Rappels** : événement `reminder_offset_minutes` ∈ {60, 1440} (journée entière : 08:00 locales la veille) ; tâche `remind_days_before` 0 à 90, à 08:00 locales. `next_reminder_at` (UTC) précalculé à l'écriture ; commande `planning:send-reminders` toutes les 5 minutes, sous `CurrentOrganization::run()`, qui émet l'événement et avance `next_reminder_at` dans la même transaction. Un rappel en retard de plus de 24 h est sauté (journalisé), jamais envoyé tard.
- **Suppression** : `cancelled_at` (événement) ou `status = cancelled` (tâche), masqués par défaut.

### 3. Contacts : extension de Parties, pas de module

- La fiche de contact **est** une partie (ADR 0019). Les catégories viennent de Catalog (termes de l'organisation), plus de liste figée côté client.
- Ajouts à Parties : `parties.note` (500, masquée à l'audit, effacée à l'anonymisation ; mention à l'écran : faits objectifs, aucune donnée sensible) ; « interlocuteur » = `contact_points.label` existant ; « spécialité » = étiquette Catalog.
- **Garant** : pas une catégorie. Il est partie au bail (`lease_parties`) et se lit sur le bail ; l'onglet « Garants » disparaît.
- **Biens d'un contact** : table `property_contacts` dans **Properties** (Properties → Parties est autorisé, ADR 0005:72 ; Parties → Properties ne l'est pas, ADR 0005:14) : `property_id`, `unit_id` facultatif, `party_id`, `contact_category_term_id` (rôle sur ce bien). Le filtre « Bien » de l'écran lit `GET /properties/{property}/contacts`.
- **Partage aux locataires** : hors v1 (aucun écran de `apps/locataire` ne le consomme ; il passerait par Leases, Properties ne pouvant lire Leases sans cycle).
- **Import** : `POST /parties/import`, JSON de 500 lignes au plus (le client lit le CSV, le serveur revalide chaque ligne), une transaction, tout ou rien, `client_id` d'idempotence.
- **Doublons** : à la création et à l'import, recherche par e-mail normalisé, téléphone E.164 (pays de l'organisation par défaut), identifiant (`value_hash`) ou nom normalisé de même `kind` ; si trouvé : 409 `party_possible_duplicate` avec identifiants et noms des candidats, sauf `allow_duplicate: true` (audité). **Pas de fusion** en v1 : les références par UUID sans clé étrangère dans dix modules et le grand livre non modifiable la rendent coûteuse ; on archive le doublon.
- **Suppression** : « Supprimer » devient « Archiver » ; « Effacer les données » = anonymisation existante (`owner`, `admin`).
- **Maintenance** : interventions liées par `supplier_party_id` (filtre existant), jamais par nom ; désignation comme prestataire inchangée (`supplier_profiles`). **Charges** : `payee_party_id` (ADR 0034:51) inchangé.

### 4. Journal d'activité de l'organisation

- **Hébergé par Organizations** (`Queries/OrganizationActivity`) : il connaît membres et rôles. Identity ne peut pas (il ne dépend d'aucun module, ADR 0005:7). `AuditLog` n'a pas de portée d'organisation : la requête pose **toujours** `organization_id = CurrentOrganization::id()` (test de mutation obligatoire).
- **Lecteurs** : `owner`, `admin` (liste, détail, export). `manager` : historique d'une entité seulement (`subject_type` + `subject_id`), sans différentiel, sans IP ni appareil. `accountant` : rien.
- **Événements servis** : entrées de l'organisation, 12 derniers mois. Exclus : `auth.*` (sans organisation ; surveillance des salariés, **à confirmer**), `console.activity.*`. Accès du support (`messaging.support_access.*`, `console.support_access.read`) servis sous l'auteur « Support eGuardImmo », sans identité d'opérateur.
- **Expurgation** : auteur membre = nom (`User::withTrashed`) ; autre compte = rôle (« Locataire », « Mandant ») sans IP ; système = « Système ». IP tronquée (/24 en IPv4, /48 en IPv6), appareil réduit à navigateur et système. Différentiel tel qu'écrit (masqués déjà `[masqué]`). `metadata` en liste blanche de clés par action. Libellé et type (`connexion` retiré, `droits`, `paiement`, `document`, `export`, `securite`, `autre`) calculés par un catalogue d'actions ; action inconnue : « Modification de {type de sujet} ».
- **Retirés du contrat** : « Empreinte » (aucune chaîne de hash dans `audit_logs`), ville d'origine (aucune géolocalisation). `request_id` est montré comme « Référence » pour le support.
- **Filtres** : période semi-ouverte ≤ 366 jours, membre, type, entité. Pas de recherche plein texte (libellés calculés). Pagination à curseur (`AGENTS.md:38`), sans total.
- **Export** : `GET /activity/export` CSV en flux, `owner`/`admin`, `reauthenticated`, 5/h, ≤ 12 mois et 50 000 lignes (sinon 422), cellules commençant par `= + - @` tabulation ou retour neutralisées ; audit `organizations.activity.exported` (période, nombre). La liste n'est pas journalisée (bruit sans valeur).
- **Non modifiable** : inchangé (déclencheurs, compte SQL `INSERT`/`SELECT`). Aucune route d'écriture.
- **Rétention** : l'écran borne à 12 mois. La purge de `audit_logs` reste à décider après le juriste (point 2) ; mécanisme proposé : partitionnement annuel (ADR 0017:37) et suppression de partition, qui ne déclenche pas les déclencheurs ligne à ligne.

### 5. Modèle de données (UUID v7, `datetime(6)`, `Checks`, jamais `ENUM`, index ≤ 64 caractères)

| Module | Table | Colonnes clés | Index et contraintes |
|---|---|---|---|
| Planning | `planning_events` | `kind`, `title` (120), `notes` (1 000), `starts_on`, `start_time` nul, `timezone` nul, `recurrence`, `recurrence_until`, `reminder_offset_minutes`, `next_reminder_at`, `property_id`, `unit_id`, `lease_id`, `created_by_user_id`, `cancelled_at`, `lock_version` | `planning_events_org_id_unique (organization_id, id)` ; `planning_events_org_starts_idx (organization_id, starts_on)` ; `planning_events_org_unit_idx (organization_id, unit_id)` ; `planning_events_next_reminder_idx (next_reminder_at)` ; CHECK `kind`, `recurrence`, `reminder_offset_minutes IN (60, 1440)`, `timezone IS NULL = start_time IS NULL` |
| Planning | `planning_event_attendees` | `event_id`, `user_id` nul, `party_id` nul | FK composite `(organization_id, event_id)` ; `planning_attendees_event_user_unique`, `planning_attendees_event_party_unique` ; CHECK exactement un des deux |
| Planning | `planning_tasks` | `title` (120), `due_on`, `assignee_user_id`, `status`, `done_at`, `done_by_user_id`, `remind_days_before`, `next_reminder_at`, `property_id`, `unit_id`, `lease_id`, `client_id`, `created_by_user_id`, `lock_version` | `planning_tasks_org_id_unique` ; `planning_tasks_org_status_due_idx (organization_id, status, due_on, id)` ; `planning_tasks_org_assignee_idx (organization_id, assignee_user_id, status, due_on)` ; `planning_tasks_org_client_unique` ; `planning_tasks_next_reminder_idx` ; CHECK `status`, `remind_days_before BETWEEN 0 AND 90`, `(status = 'done') = (done_at IS NOT NULL)` |
| Parties | `parties` | `+ note` (text nul) | – |
| Properties | `property_contacts` | `property_id`, `unit_id` nul, `unit_key` (colonne générée `COALESCE(unit_id, '')`), `party_id`, `contact_category_term_id` nul | `property_contacts_unique (organization_id, property_id, unit_key, party_id)` ; `property_contacts_org_party_idx (organization_id, party_id)` ; FK composite vers `properties` ; FK vers `terms` (ADR 0018) |
| Organizations | `organizations` | `+ timezone` (64, non nul, reprise par pays) | – |
| (Shared) | `audit_logs` | – | `audit_logs_org_actor_occurred_idx (organization_id, actor_user_id, occurred_at)` ; `audit_logs_org_action_occurred_idx (organization_id, action, occurred_at)` |

- Aucun déclencheur nouveau : rien n'est en ajout seul hors `audit_logs`.
- `PlanningEvent`, `PlanningTask`, `PlanningEventAttendee`, `PropertyContact` : `Auditable`, `title` et `notes`/`note` dans `auditMasked`.

### 6. Routes (`/api/v1/org/{organization}`, noms préfixés par le module)

| Module | Lecture | Écriture |
|---|---|---|
| Planning | `GET /planning/events?from&to` (occurrences), `GET /planning/events/{event}`, `GET /planning/tasks` (curseur ; `status`, `assignee`, `property`, `unit`, `due_from`, `due_to`, `overdue`) : tous les rôles, 120/min | `POST /planning/events`, `PATCH …/{event}`, `POST …/{event}/cancel` ; `POST /planning/tasks`, `PATCH …/{task}`, `POST …/{task}/complete\|reopen\|cancel`, `POST /planning/tasks/bulk/complete\|postpone\|assign` : `owner`, `admin`, `manager` ; créateur ou assigné aussi pour `complete` et `reopen` ; 60/min |
| Parties | `GET /parties` existant | `POST /parties/import` (`owner`, `admin`, `manager`, 5/h) ; `allow_duplicate` sur `POST /parties` ; `note` sur `PATCH` |
| Properties | `GET /properties/{property}/contacts`, `GET /property-contacts?party=` : tous les rôles | `POST /properties/{property}/contacts`, `DELETE …/contacts/{link}` : `owner`, `admin`, `manager` |
| Organizations | `GET /activity`, `GET /activity/{activity}` : `owner`, `admin` ; `manager` avec `subject_type`+`subject_id` | `GET /activity/export` (`owner`, `admin`, `reauthenticated`, 5/h) ; `PATCH /` accepte `timezone` (`owner`, `admin`) |
| Maintenance, Documents | filtres `due_from`, `due_to` sur `/interventions` (échéance et visites) et `expires_from`, `expires_to` sur `/documents/certificates` | – |

- Codes (ADR 0014) : `planning_event_not_found` 404, `planning_task_not_found` 404, `planning_link_invalid` 422, `planning_assignee_invalid` 422, `planning_range_too_wide` 422, `planning_bulk_too_large` 422, `planning_task_not_open` 409, `party_possible_duplicate` 409, `party_import_invalid` 422, `property_contact_not_found` 404, `activity_not_found` 404, `activity_range_too_wide` 422, `activity_export_too_large` 422 ; `idempotency_key_reused` 409 existant.
- Le client n'envoie jamais `organization_id`, `status` à la création, `done_by_user_id`, `created_by_user_id`, `next_reminder_at`, `timezone` d'un événement.

### 7. Notifications (amende l'ADR 0027)

| Type | Destinataires | Clé | Défaut |
|---|---|---|---|
| `planning.task_assigned` | l'assigné, sauf s'il s'assigne lui-même | `task_assigned:{tâche}:{assigné}:{lock_version}` | in_app |
| `planning.task_due` | l'assigné | `task_due:{tâche}:{due_on}` | in_app, e-mail |
| `planning.event_reminder` | créateur et membres participants | `event:{événement}:{date d'occurrence}` | in_app, e-mail |

Événements `Planning\Events\TaskAssigned`, `TaskReminderDue`, `EventReminderDue` (identifiants seulement, `ShouldDispatchAfterCommit`). Gabarits sans titre, note, nom ni adresse ; lien `/taches/{id}` ou `/agenda`. Notifications revérifie l'adhésion active (lien existant).

### 8. iCal et synchronisation

- **v1** : export `.ics` ponctuel **généré par le client** à partir des entrées déjà chargées (période affichée). Aucun endpoint, aucun secret.
- **Exclus** : abonnement par URL secrète (jeton dans l'URL, non révocable par 2FA, contenu mis en cache par Google ou Microsoft : transfert de données de locataires **à confirmer**) et synchronisation bidirectionnelle Google/Outlook (OAuth, vérification d'application, portées sensibles, conflits d'édition). Un flux minimisé par membre pourra faire l'objet d'un ADR si le besoin est démontré.

### 9. Données personnelles

- Contacts : personnes physiques (artisans, interlocuteurs, commissaires) ; base légale intérêt légitime ou contrat, information art. 14 RGPD, conservation d'une fiche archivée sans relation : **à confirmer** (proposition : revue manuelle des fiches archivées depuis plus de 3 ans ; pas de purge automatique, Parties ne connaissant pas les relations tenues par les autres modules).
- Journal : IP et appareils des membres ; information des membres et proportionnalité **à confirmer** (point 1).
- Notes et titres libres : masqués à l'audit, jamais dans une notification ni un push.

### 10. Tests et ArchTests

- Communs à chaque route : 401, 403 par rôle, jeton opérateur refusé, 404 sur la ressource d'une autre organisation, nombre de requêtes constant (1, 10, 100 éléments).
- Planning : passages heure d'été et d'hiver (28/03/2027, 31/10/2027, Europe/Paris), 31 du mois, 29 février, borne `recurrence_until`, fenêtre > 62 jours 422, rappel rejoué sans doublon, rappel de plus de 24 h sauté, assignation à un non-membre 422, lot partiellement inconnu sans effet.
- Contacts : doublon par e-mail, téléphone, identifiant, nom ; import de 501 lignes 422 ; import rejoué 200 ; lien vers un bien d'une autre organisation 404 ; note absente de l'audit en clair.
- Journal : entrée d'une autre organisation jamais servie (mutation : retirer le filtre doit faire rougir) ; ex-membre ; `manager` sans différentiel ni IP ; `accountant` 403 ; IP tronquées ; opérateur anonymisé ; CSV neutralisé ; export audité.
- ArchTests : `tests/Feature/Planning/ArchitectureTest.php` sur le modèle de Maintenance (Planning n'utilise que Properties, Leases, Parties, Organizations et jamais Notifications) ; `AuditLog` utilisé seulement dans `Shared`, `Identity\Queries` et `Organizations\Queries` ; Properties n'importe de Parties que sa PublicApi.

## Options écartées

- **Agrégateur d'agenda serveur** (Planning lit Leases, Rent, Maintenance, Documents) : quatre liens de plus, Maintenance appelée, aucun gain tant que l'écran compose déjà.
- **Échéances projetées dans Planning par événements** : copie à resynchroniser, rattrapages, pour des dates déjà détenues par leur module.
- **RRULE RFC 5545 complète, exceptions d'occurrence** : sans besoin dans les écrans.
- **Horodatage UTC seul pour les événements** : une récurrence hebdomadaire dériverait d'une heure au changement d'heure.
- **Deux modules Agenda et Tasks** : même cycle de vie, mêmes rappels ; **Planning dans Organizations** : mélange équipe et travail courant.
- **Canal de rappel choisi par tâche** : contredit les préférences par compte de l'ADR 0027.
- **Module Contacts distinct** : doublerait les fiches et l'effacement RGPD, c'est l'option « table par rôle » écartée par l'ADR 0019:30.
- **Liens bien ↔ contact dans Parties** : Parties → Properties interdit (ADR 0005:14).
- **Fusion de fiches** et **suppression physique** : références sans clé étrangère dans de nombreux modules, grand livre non modifiable.
- **Journal lu par Identity** : il faudrait Identity → Organizations, contraire à l'ADR 0005:7. **Seconde table d'activité métier** : écartée par l'ADR 0016:70-71.
- **Pagination numérotée avec total** : `COUNT(*)` sur une table en croissance continue. **Export côté client** : ne voit qu'une page.
- **Journal des connexions des membres** : sans organisation dans `audit_logs`, et surveillance individuelle à justifier.

## Conséquences

- **Fronts** (`packages/gestion`) : identifiants UUID (fin des slugs `BIEN_IDS` et des noms `ASSIGNEES`) ; types d'événement réduits ; invités choisis parmi membres et contacts ; rappel « selon vos préférences » ; bien facultatif ; catégories lues dans Catalog ; « Supprimer » → « Archiver » ; doublon proposé à la confirmation ; interventions liées par fiche ; journal sans empreinte ni ville, curseur, filtres serveur, export serveur. `familyHasApiSource` passe à `true` famille par famille ; l'application Agence monte ensuite les mêmes écrans.
- **Exploitation** : `queue:work` (déjà requis), tâche planifiée `planning:send-reminders` (5 min) ; la migration des index de `audit_logs` demande le compte de migration (`ALTER`), pas le compte applicatif.
- **Risques** : rappels muets si l'ordonnanceur s'arrête (sonde à prévoir) ; journal volumineux sans purge tant que le point 2 n'est pas tranché.

## Plan de lots

Backend d'abord ; chaque lot sort par `composer check` ou `pnpm -r check`, sans test ignoré ; `/security-review` sur les lots 1, 2 et 5.

| Lot | Contenu | Critères de sortie |
|---|---|---|
| 1. Journal | `OrganizationActivity`, catalogue d'actions, expurgation, index, liste, détail, historique d'entité, export | tests de la décision 10 ; aucune entrée d'une autre organisation (mutation rouge) ; export audité et neutralisé ; temps de réponse mesuré sur 1 M de lignes MySQL |
| 2. Contacts | `parties.note`, import, doublons, `allow_duplicate` | doublons détectés sur les quatre critères ; import tout ou rien ; anonymisation efface la note |
| 3. Contacts et biens | `property_contacts`, routes Properties, `UnitDirectory::findProperty` | lien croisé 404 ; liens de l'ADR 0005 vérifiés par ArchTest |
| 4. Tâches | module Planning, `organizations.timezone`, tâches, actions groupées, `planning.task_assigned` | retard calculé dans le fuseau ; lot tout ou rien ; ex-membre affiché inactif |
| 5. Agenda et rappels | événements, participants, récurrences, rappels, `planning:send-reminders`, `task_due`, `event_reminder` | tests heure d'été et d'hiver ; rappels idempotents ; rappel tardif sauté |
| 6. Filtres de période | Maintenance `due_from/due_to`, Documents `expires_from/expires_to` | bornes semi-ouvertes testées |
| F1 à F4 | journal, contacts, tâches, agenda (Propriétaire puis Agence) ; export `.ics` client | vérification navigateur sur l'API réelle ; famille passée à `true` |

**Retour arrière** : chaque lot est additif. Repasser la famille à `familyHasApiSource: false` rend l'écran indisponible sans toucher aux données ; les migrations se défont (tables nouvelles, colonnes `note` et `timezone`, index de `audit_logs`) sans perte de donnée existante ; arrêter `planning:send-reminders` coupe les rappels.

## Points à valider par un juriste

1. Journal visible des dirigeants : information des membres salariés, proportionnalité (C. trav. L1121-1, L1222-4), recommandation CNIL sur la journalisation, équivalents belge, luxembourgeois et québécois (Loi 25).
2. Durée de conservation de `audit_logs` par famille d'actions et durée d'affichage à l'organisation (12 mois proposés).
3. Annuaire de tiers : base légale, information art. 14 RGPD, durée de conservation d'une fiche inactive, contenu admissible d'une note libre.
4. Réutilisation de la date de naissance d'un locataire pour un rappel d'anniversaire.
5. Abonnement iCal consommé par un service tiers hors UE.

## Questions fermées pour l'utilisateur

Ma recommandation est toujours la première.

1. **Contacts = extension de Parties ?** Alternative : module Contacts distinct.
2. **Agenda et tâches dans un seul module Planning ?** Alternatives : deux modules ; dans Organizations.
3. **Agenda composé par le client, filtres de période ajoutés aux modules ?** Alternative : agrégateur serveur.
4. **iCal : export `.ics` ponctuel côté client, pas d'abonnement en v1 ?** Alternatives : flux par URL secrète minimisé ; synchronisation Google/Outlook.
5. **Fuseau de l'organisation (défaut par juridiction), copié sur l'événement ?** Alternatives : fuseau du membre ; UTC seul.
6. **Récurrence hebdomadaire, mensuelle, annuelle, sans exception d'occurrence ?** Alternative : RRULE complète.
7. **Participants choisis parmi membres et fiches, sans nom libre ni invitation envoyée ?** Alternative : noms libres.
8. **Type « anniversaire » retiré ?** Alternative : conservé.
9. **Rappels selon les préférences de l'ADR 0027, sans canal par tâche ?** Alternative : canal par tâche.
10. **Supprimer = annuler (tâche, événement) ou archiver (contact), jamais d'effacement physique ?** Alternative : suppression douce masquée.
11. **Onglet « Garants » retiré, le garant se lit sur le bail ?** Alternative : catégorie « garant ».
12. **Partage des contacts aux locataires hors v1 ?** Alternative : v1, servi par Leases.
13. **Doublons signalés (409 avec candidats), pas de fusion ?** Alternative : fusion de fiches.
14. **Journal lu par `owner` et `admin`, historique d'entité expurgé pour `manager`, rien pour `accountant` ?** Alternatives : tous les membres ; `owner` seul.
15. **Connexions des membres absentes du journal de l'organisation ?** Alternative : incluses.
16. **Accès du support visibles sous « Support eGuardImmo » ?** Alternative : masqués.
17. **Export du journal côté serveur, avec réauthentification ?** Alternative : export client de la page.

## Amendements nécessaires (non appliqués)

- **ADR 0003** : `manager` lit l'historique d'une entité ; `owner`/`admin` lisent le journal de leur organisation.
- **ADR 0005** : nouveau module Planning (Gestion) ; Planning → Properties (`UnitDirectory`), Leases (`LeaseDirectory`), Parties (`PartyDirectory`), Organizations (`MembershipDirectory`, `OrganizationDirectory::timezone`), lecture seule ; Planning ⇢ `TaskAssigned`, `TaskReminderDue`, `EventReminderDue` ⇢ Notifications ; Properties → Parties précisé (`property_contacts`) ; Organizations lit `audit_logs` (Shared) pour l'espace organisation. Aucun module n'appelle Planning ; aucun cycle.
- **ADR 0006** : lecture de `AuditLog` (hors portée d'organisation) par `Organizations\Queries\OrganizationActivity`, filtre d'organisation explicite et testé par mutation.
- **ADR 0008** : fuseau par défaut déclaré par la juridiction.
- **ADR 0014** : codes de la décision 6.
- **ADR 0016** : lecture par l'organisation (décision 4), deux index, actions `planning.*` (par `Auditable`), `parties.party.imported` (nombre), `parties.duplicate.allowed`, `organizations.activity.exported` ; rétention renvoyée au point 2.
- **ADR 0017** : `planning_*` et `property_contacts` ; `audit_logs.occurred_at` à passer en `datetime(6)` (écart constaté).
- **ADR 0019** : `parties.note`, import, détection de doublons, garant hors catégories, liens aux biens dans Properties.
- **ADR 0021** et **ADR 0029** : filtres de période sur les pièces à échéance et les interventions.
- **ADR 0027** : types et clés de la décision 7.

## Amendements appliqués (2026-11-21, implémentation du backend)

Tout ce qui précède reste la décision ; cette section consigne ce que l'implémentation a précisé ou ajouté. Les amendements des autres ADR listés ci-dessus restent à porter dans leurs fichiers.

### Codes d'erreur ajoutés ou précisés (ADR 0014)

| Module | Code | Statut | Cas |
|---|---|---|---|
| Planning | `planning_version_conflict` | 409 | `lock_version` périmé sur `PATCH` d'un événement ou d'une tâche |
| Planning | `planning_event_cancelled` | 409 | modification d'un événement annulé |
| Planning | `idempotency_key_reused` | 409 | même `client_id` de tâche avec un autre contenu (rejeu identique : 200 au lieu de 201) |
| Properties | `property_contact_exists` | 409 | fiche déjà liée au même bien ou lot |
| Properties | `property_contact_party_anonymized` | 409 | fiche anonymisée |
| Parties | `party_possible_duplicate` | 409 | candidats dans le membre `candidates` du corps RFC 9457 (`ApiProblem::extensions`) |

Les autres codes sont ceux de la décision 6, tels quels. Un lien de bien, de lot ou de bail refusé (inconnu, autre organisation, lot d'un autre bien) répond toujours `planning_link_invalid`, sans révéler l'existence de l'identifiant.

### Routes et contrats précisés

- Planning : toutes les routes sont sous `/org/{organization}/planning` (`planning.events.index|show|store|update|cancel`, `planning.tasks.index|store|update|cancel|complete|reopen`, `planning.tasks.bulk.complete|postpone|assign`). Lecture : tous les rôles, 120/min ; écriture : `owner`, `admin`, `manager`, 60/min ; `complete` et `reopen` : tout membre actif pour la tâche qu'il a créée ou qui lui est confiée (refus dans le code, `role_forbidden`, domaine `planning_task_progress` de `RoleMatrix`).
- `PATCH` d'un événement ou d'une tâche exige `lock_version` ; chaque modification l'incrémente.
- `GET /planning/events` exige `from` et `to` (`Y-m-d`, `to` > `from`), période semi-ouverte `[from, to)`, 62 jours et 500 occurrences au plus (`planning_range_too_wide`, jamais de troncature). Réponse : occurrences `{event_id, occurrence_on, kind, title, start_time, timezone, all_day, starts_at, recurrence, property_id, unit_id, lease_id}` ; notes et participants se lisent sur `GET /events/{event}`.
- `GET /planning/tasks` : `due_to` est **exclusif** (semi-ouvert comme partout) ; sans `status`, les tâches annulées sont masquées ; `assignee=me` accepté ; tri `due_on, id`, curseur `meta.has_more` / `meta.next_cursor`.
- Actions groupées : `{data: {count}}` ; plus de 100 identifiants distincts `planning_bulk_too_large` (la validation coupe à 500) ; une tâche déjà clôturée dans le lot `planning_task_not_open`, sans aucun effet.
- Filtres de période : Maintenance `due_from` / `due_to` retient une intervention dont l'échéance **ou** une visite tombe dans `[due_from, due_to)` ; Documents `expires_from` / `expires_to` filtre `expires_on` de la même façon (une pièce sans échéance est exclue dès qu'un des deux est posé). `due_to` et `expires_to` exigent d'être postérieurs à leur borne de début quand elle est donnée.
- Organizations : `PATCH /org/{organization}` n'accepte que `timezone` (identifiant IANA vérifié), 30/min.

### Liens entre modules (ADR 0005)

- Planning → Identity (`User`, authentification), Organizations (`MembershipDirectory`, `OrganizationDirectory::timezone`), Properties (`UnitDirectory::find`, `findProperty`), Leases (`LeaseDirectory::find`), Parties (`PartyDirectory`), lecture seule, vérifiés par `tests/Feature/Planning/ArchitectureTest.php` ; Planning n'utilise jamais Notifications.
- Notifications écoute `Planning\Events\TaskAssigned`, `TaskReminderDue` et `EventReminderDue` (trois listeners en file). Types : `planning.task_assigned` (défaut in_app), `planning.task_due` et `planning.event_reminder` (in_app, e-mail), lisibles des quatre rôles, groupe « Agenda », aucun canal verrouillé. Chaque destinataire est désigné par `recipientId` (jamais par `assigneeId`, qui replie sur toute l'équipe) : un membre sorti ou d'un autre rôle exclu ne reçoit rien. Gabarits sans titre, note ni nom ; liens `/taches/{id}` et `/agenda`.
- `Properties` n'importe de Parties que sa `PublicApi` ; `AuditLog` n'est utilisé que dans `Shared`, `Identity\Queries` et `Organizations\Queries` (deux règles ajoutées à `ArchTest.php`).

### Données et exploitation

- Migrations : `database/migrations/2026_11_21_700000_add_activity_indexes_to_audit_logs.php`, `Organizations/…_700100_add_timezone_to_organizations.php`, `Parties/…_710000_add_note_to_parties_table.php` et `…_710100_create_party_imports_table.php`, `Properties/…_720000_create_property_contacts_table.php`, `Planning/…_730000_create_planning_tables.php`. `party_imports` (empreinte de charge utile, résultat) rend l'import rejouable ; ajoutée à la liste de l'ADR 0017.
- Variables : `ORGANIZATIONS_ACTIVITY_RETENTION_MONTHS` (12) et `ORGANIZATIONS_ACTIVITY_EXPORT_MAX_ROWS` (50 000), dans `.env.example`.
- Planificateur : `planning:send-reminders` toutes les 5 minutes, sans chevauchement (`routes/console.php`) ; un rappel en retard de plus de 24 h est sauté et journalisé au niveau `warning` ; une organisation en échec n'arrête pas les autres.
- Passage à l'heure : une heure inexistante (28/03/2027, 02:30 Paris) vaut 01:30 UTC ; une heure répétée (31/10/2027, 02:30 Paris) vaut sa seconde occurrence, 01:30 UTC ; comportement de PHP verrouillé par `RemindersTest`.
- Vérifié sur SQLite en mémoire seulement : les migrations n'ont pas été jouées sur MySQL (colonne générée `unit_key`, CHECK, index ≤ 64 caractères à confirmer à la première migration réelle).

### Correctifs de la revue de sécurité (2026-11-21)

- **Journal, auteur** : seul un compte ayant (ou ayant eu) une adhésion à l'organisation est servi comme `member` (nom, IP /24, appareil) ; tout autre compte, y compris un locataire ou un mandant qui accepte son invitation (`parties.tenant-invitations.accept`, `parties.owner-invitations.accept`), est `other` sans identité ni origine, dans la liste, le détail et l'export CSV.
- **Plafond de séries récurrentes (décision hors ADR)** : `planning.max_active_series` (`PLANNING_MAX_ACTIVE_SERIES`, 200 par défaut) séries récurrentes **actives** par organisation (récurrence ≠ `none`, non annulée, `recurrence_until` absente ou ≥ aujourd'hui dans le fuseau de l'organisation). Création, ou modification qui ajoute ou prolonge une récurrence, au-delà : 422 `planning_series_limit_reached`. Une série annulée ou terminée ne compte plus ; le compteur est par organisation ; le 422 `planning_range_too_wide` des plages trop larges est conservé. Le contrôle n'est pas verrouillé : deux créations simultanées au plafond peuvent le dépasser d'une unité.
- **Tâches** : rouvrir une tâche **annulée** est réservé à `owner`, `admin`, `manager` ; le créateur ou l'assigné (même comptable) ne rouvre qu'une tâche terminée (403 `role_forbidden`).
- **Contacts, journal** : `parties.duplicate.allowed` porte `matches` (nombre) et `reasons` (liste jointe par des virgules, scalaire) ; la liste blanche du journal les sert.
- **Liens et participants** : une fiche anonymisée ou archivée ne peut plus être participante (`planning_link_invalid`) ; un bail doit occuper le lot indiqué, ou l'un de ses lots doit appartenir au bien indiqué (`planning_link_invalid`). `Parties\Data\PartyData` porte `isArchived`.
- **Migration `audit_logs`** : sous MySQL/MariaDB, un seul `ALTER TABLE … ADD INDEX …, ADD INDEX …, ALGORITHM=INPLACE, LOCK=NONE` (elle échoue plutôt que de recopier la table ou bloquer les écritures du journal) ; branche `Schema` normale ailleurs. Elle s'exécute avec le compte de migration (`ALTER`, `INDEX`), pas le compte applicatif, hors pic d'écriture ; vérifier la taille de `audit_logs` avant.
- **Détection de doublon par nom** : `LOWER(display_name) = ?` n'utilise pas l'index `(organization_id, display_name, id)` ; la recherche reste bornée à l'organisation par le filtre `organization_id` (index), à 500 lignes par import et 5 imports par heure. Risque accepté et borné, sans colonne normalisée ni code ajouté ; à reprendre (colonne `display_name_key` indexée) si une organisation dépasse quelques dizaines de milliers de fiches.
- **Fuseau de l'organisation** : `PATCH /org/{org}` qui change `timezone` émet `Organizations\Events\OrganizationTimezoneChanged` (après validation) ; Planning la reçoit (`RecomputeRemindersOnTimezoneChange`, en file) et recalcule `next_reminder_at` des tâches ouvertes et des événements sur la journée entière, dans une transaction, avec une entrée `planning.reminders.recomputed` (nombres seulement) au journal. Les événements horodatés gardent le fuseau copié. Le recalcul n'est pas dans la transaction du `PATCH` (Planning dépend déjà d'Organizations : un appel inverse ferait un cycle) ; entre les deux, un rappel peut partir à l'ancienne heure. Lien ajouté à l'ADR 0005 : Planning ⇠ `OrganizationTimezoneChanged` ⇠ Organizations.
- **Jeton opérateur** : `tests/Feature/Organizations/OperatorTokenRoutesTest.php` vérifie le 403 `operator_token_forbidden` d'un opérateur membre sur les 14 routes Planning, le journal, les liens fiche-bien, l'import et `PATCH /org/{org}`, en plus de la règle générique de `RoutesTest`.

## Amendement du 2026-11-21 (retours du front)

- **Membres** : `GET /org/{org}/members` et les réponses d'invitation et de modification exposent `user_id` (UUID de compte) pour les seuls membres `active` ; `null` pour un membre invité ou désactivé. Même audience que la liste (tous les rôles de l'organisation), aucun e-mail de plus. Sert à l'assignation des tâches, aux participants d'événement et au filtre « acteur » du journal.
- **Tâches** : `GET /org/{org}/planning/tasks/{task}` (`planning.tasks.show`, tous les rôles, 120/min), même Resource que la liste ; 404 `planning_task_not_found` hors organisation.
- **Interventions** : la liste `GET /org/{org}/interventions` porte `visits` (id, `scheduled_on`, `slot`, `status`), sans contact ni téléphone ; la fiche garde la visite complète. L'agenda place ainsi les visites sur leur date.
- **Contacts d'un bien** : `GET /property-contacts?party=` et `GET /properties/{property}/contacts` portent `unit_reference` (référence lisible du lot, `null` pour un lien au bien entier).
- **Décisions à prendre (non implémentées, absentes de cet ADR)** : filtre par étiquette sur `GET /parties` (l'ADR ne prévoit que `q|category|kind|status`) ; suppression d'une coordonnée d'une fiche (l'ADR décide qu'aucune suppression physique n'existe : archivage ou anonymisation de la fiche, `PATCH` d'une coordonnée seulement).

## Amendement du 2026-11-21 (minimisation de l'origine dans le journal)

- Vérifié et verrouillé par test : `ip` et `device` ne sont servis qu'à `owner` et `admin` (liste, détail, export CSV). Le gestionnaire ne lit que l'historique d'une entité (`ActivityHistoryResource`), sans ces champs ; aucun changement de code ni de matrice des rôles.
