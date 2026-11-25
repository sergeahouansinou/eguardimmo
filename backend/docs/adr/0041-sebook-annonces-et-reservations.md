# ADR 0041 — SeBook : géographie, annonces, favoris, visites et réservations

Statut : proposé (2026-11-21), à valider. Précise les modules Geography, Listings et Bookings de l'ADR 0005 et l'espace SeBook des ADR 0003 et 0010. Maquettes : canevas « eGuardImmo, SeBook marketplace » (9 planches). Hors périmètre de cette tranche : photos et médias, calendrier d'indisponibilités saisi par l'hôte, avis, encaissement réel (voir « Paiement »), carte interactive.

Chemins : `app/…` et `tests/…` relatifs à `backend/` ; `apps/…` à la racine.

## Décision

### Geography (socle)

- `geo_countries` (code ISO 3166-1 alpha-2, nom) et `geo_cities` (pays, nom, code postal, slug unique par pays, latitude, longitude). Données de référence, lecture seule côté API, alimentées par seeder (France : communes principales, pas d'import massif dans cette tranche).
- Endpoint public `GET /api/v1/marketplace/places?q=` : 2 à 80 caractères, 10 résultats maximum, correspondance préfixe sur nom ou code postal, limitation de débit par IP.

### Listings

- `listings` : `public_ref` (chaîne opaque de 12 caractères, unique, jamais l'id), `id` UUID (ADR 0015), `organization_id` (cloisonnement ADR 0006), `unit_id` nullable (clé vers Properties, sans jointure de module : via `PublicApi`), `kind` (`short_stay` | `long_term`), `category` (`studio` | `apartment` | `house` | `shared`), `title` (≤ 120), `description` (≤ 4 000, texte brut), `city_id`, `neighbourhood` (≤ 80), `price_minor` (entier, unité mineure), `currency` (`EUR` par défaut), `price_unit` (`night` | `month`), `capacity`, `area_m2`, `rooms`, `amenities` (liste blanche d'identifiants), `min_nights`, `cancellation_policy` (`flexible` | `moderate` | `strict`), `deposit_minor`, `status` (`draft` | `published` | `archived`), `published_at`, `lock_version`.
- Aucune adresse exacte ni coordonnée d'unité n'est exposée en public : quartier et ville seulement.
- `listing_favorites` (user_id, listing_id, unique) et `listing_leads` (demande de visite : user_id, listing_id, créneau souhaité ≤ 120, message ≤ 1 000, statut `new` | `answered`). Une demande de visite crée une conversation Messaging avec l'hôte quand le module l'expose, sinon reste en base et notifie l'organisation (Notifications).
- Gestion côté organisation : `GET|POST /org/{organization}/listings`, `GET|PATCH /org/{organization}/listings/{listing}`, `POST …/publish`, `POST …/archive`. Rôles `owner`, `admin`, `manager`. Publication refusée si le titre, le prix, la ville ou la capacité manquent (`422`, code `listing_incomplete`). Concurrence : `lock_version` (ADR 0014).

### Bookings

- `bookings` : `id` UUID, `reference` (`SB-AAAA-NNNNNN`, séquence continue par année sous verrou), `listing_id`, `user_id` (voyageur), `check_in`, `check_out` (dates, départ exclusif), `nights`, `guests`, `nightly_minor`, `subtotal_minor`, `service_fee_minor`, `total_minor`, `currency`, `status` (`pending_payment` | `confirmed` | `cancelled` | `completed`), `cancelled_at`, `cancel_reason`. Montants recalculés par le serveur, jamais acceptés du client.
- Disponibilité : un séjour est refusé (`409`, code `dates_unavailable`) s'il chevauche une réservation `pending_payment` non expirée ou `confirmed` du même listing. Contrôle sous verrou de ligne du listing dans la transaction de création. Une réservation `pending_payment` expire après 30 minutes (commande planifiée).
- `GET /marketplace/listings/{ref}/availability?from&to` public : liste des plages occupées, sans identité.
- Annulation par le voyageur (`POST /marketplace/bookings/{id}/cancel`) : permise tant que `status` est `pending_payment` ou `confirmed` et que `check_in` est futur ; remboursement calculé selon `cancellation_policy` (flexible : intégral jusqu'à 1 jour avant ; moderate : intégral jusqu'à 5 jours ; strict : 50 % jusqu'à 7 jours) et indiqué dans la réponse, sans mouvement d'argent dans cette tranche.
- Isolation : un voyageur ne lit et n'annule que ses réservations (`404` sur celles d'autrui) ; une organisation ne lit que celles de ses annonces (`GET /org/{organization}/bookings`).

### API publique `/api/v1/marketplace`

| Route | Accès |
|---|---|
| `GET /places` | public, limité par IP |
| `GET /listings` (filtres `place`, `kind`, `category`, `guests`, `min_price`, `max_price`, `amenities[]`, `sort` = `relevance|price_asc|price_desc|recent`, curseur `after`, `per_page` ≤ 24) | public |
| `GET /listings/{ref}` | public, annonce `published` seulement (`404` sinon) |
| `GET /listings/{ref}/availability` | public |
| `GET|PUT|DELETE /favorites/{ref}`, `GET /favorites` | `auth:sanctum` + e-mail vérifié |
| `POST /listings/{ref}/visit-requests` | idem, 5 par heure et par compte |
| `POST /listings/{ref}/quote` (calcul du prix, sans écriture) | public |
| `POST /bookings`, `GET /bookings`, `GET /bookings/{id}`, `POST /bookings/{id}/cancel` | `auth:sanctum` + e-mail vérifié, clé d'idempotence obligatoire sur `POST /bookings` |

Erreurs au format ADR 0014. Pas d'énumération : recherche et fiche ne divulguent ni l'organisation interne, ni l'id, ni les coordonnées exactes. Le nom d'agence affiché provient d'une projection publique de l'organisation (nom, vérification de carte professionnelle).

### Paiement

Aucun PSP n'est branché dans cette tranche : une réservation reste `pending_payment` jusqu'à l'événement `PaiementConfirmé` (ADR 0005, Payments ⇢ Bookings), écouté par `Bookings` pour passer à `confirmed`. Tant que Payments n'expose pas cet événement pour les réservations, l'interface affiche « Paiement à finaliser » et n'annonce jamais « confirmée » : aucune confirmation simulée. Le prix de service est un paramètre de configuration (`marketplace.service_fee_basis_points`, défaut 0, **[À RENSEIGNER]** par l'utilisateur, cf. ADR 0013).

### Front

- `apps/sebook`, port 3060, rendu serveur, `/marketplace` côté API ; métadonnées OG, JSON-LD `LodgingBusiness` ou `Accommodation`, `sitemap.xml`, `robots.txt`. Contenu utilisateur échappé par React, jamais de HTML brut. CSP de `packages/config`. Session partagée du hub (ADR 0004/0010) ; connexion par redirection vers `apps/auth` avec `return_to`.
- Interactions couvertes : onglets de portée, recherche avec suggestions de lieux, filtres et tri, liste/carte (liste seulement, carte reportée), favoris, fiche, demande de visite (fenêtre), réservation en trois étapes, annulation confirmée, compte voyageur.

## Options écartées

- **Annonces dans Properties** : mélangerait données privées de gestion et contenu public.
- **Id séquentiel ou UUID de l'unité en URL** : fuite et énumération ; `public_ref` opaque.
- **Confirmation immédiate sans paiement** : fausserait l'état et le calendrier de l'hôte.
- **Recherche plein texte externe (Meilleur moteur dédié)** : inutile à ce volume ; index MySQL suffisant (ADR 0017).
- **Photos dans cette tranche** : dépend des règles de stockage et d'analyse d'Documents ; à décider à part.

## Mise en œuvre (2026-11-21) : écarts et formes réelles

Les trois modules sont codés (`app/Modules/{Geography,Listings,Bookings}`). Ce qui diffère du texte ci-dessus ou le précise :

### Liens entre modules

Amendement correspondant dans l'ADR 0005. Listings → Geography (`CityDirectory`, `CityData`), Organizations (`OrganizationDirectory::names`, nom d'agence affiché) et Identity (`ErrorCode::EmailUnverified` pour le middleware `marketplace.traveler`, événement `AccountDeleted`, modèle `User`) ; Bookings → Listings (`ListingDirectory`, `ListingBookingData`, `ListingSummaryData`, enums `CancellationPolicy` et `ListingKind`) et Identity (modèle `User`, prénom du voyageur côté organisation) ; Geography ne dépend d'aucun module. Le lien Listings → Properties n'est pas codé : `unit_id` existe, sans usage. Aucune clé étrangère SQL entre modules, hors `organization_id`.

### Formes de réponse

Enveloppe `{data}` ; listes : `meta.has_more` et `meta.next_cursor`. Montants `{amount, currency}` en unités mineures.

- `GET /marketplace/places?q=` : `data[] = {slug, name, postal_code, country}`.
- `GET /marketplace/listings` (curseur `after`, `per_page` ≤ 24) et favoris : fiche courte `{ref, kind, category, title, city{slug,name,postal_code}, neighbourhood, price, price_unit, capacity, rooms, area_m2, amenities[], min_nights, host{name}}`. `GET /listings/{ref}` ajoute `description`, `deposit`, `cancellation_policy`, `published_at`. Ni id, ni organisation, ni statut, ni version en public.
- Organisation : `{id, public_ref, kind, category, status, title, description, city, city_id, neighbourhood, price, price_unit, deposit, capacity, area_m2, rooms, amenities, min_nights, cancellation_policy, published_at, missing_for_publication[], lock_version}`.
- `GET /listings/{ref}/availability?from&to` : `data[] = {check_in, check_out}`.
- `POST /listings/{ref}/quote` (corps `check_in`, `check_out`, `guests`) : `{nights, nightly, subtotal, service_fee, total, cancellation_policy, available}`.
- `POST /bookings` : 201 à la création, 200 au rejeu de la même clé. Réservation `{id, reference, status, payment ("to_finalize" tant que `pending_payment`), listing{ref,title,city,neighbourhood,host{name}}, check_in, check_out, nights, guests, nightly, subtotal, service_fee, total, cancellation_policy, expires_at, cancelled_at, cancel_reason, refund}`. Côté organisation : sans id d'utilisateur ni e-mail, `traveler = {first_name}`.
- `POST /listings/{ref}/visit-requests` : `{id, status, requested_slot, created_at}`.

### Règles précisées

- Un séjour de `long_term` ne se réserve pas (`listing_not_bookable`) ; 90 nuits au plus ; `guests` ≤ `capacity` ; `min_nights` respecté.
- Remboursement : calculé sur `total_minor` selon la politique figée sur la réservation ; 0 pour `pending_payment`. Annulation refusée si l'arrivée est aujourd'hui ou passée (jour calculé dans `marketplace.timezone`, `Europe/Paris`).
- Le passage à `completed` est fait par la commande planifiée `bookings:sweep` (chaque minute), qui expire aussi les `pending_payment` échues.
- Plafonds de réservations en attente (revue de sécurité) : au plus **2 réservations `pending_payment` non expirées par compte** (`too_many_pending_bookings`, 409) et **une par couple annonce/compte** (`pending_booking_exists`, 409), contrôlés sous le verrou de l'annonce, après la relecture de la clé d'idempotence (un rejeu ne compte pas deux fois). `POST /bookings` a son propre limiteur, 10 par heure et par compte (`marketplace-bookings-create`), distinct des lectures (60 par minute).
- `POST …/publish` et `POST …/archive` exigent `lock_version` dans le corps (422 s'il manque) et rendent `409 listing_stale_version` en cas d'écart, même quand l'annonce est déjà dans l'état demandé. Forme modifiée : ces deux corps étaient vides.
- Champs d'une ligne (`title`, `neighbourhood`, `requested_slot`) : balises, caractères de contrôle (Cc) et de format (Cf) refusés. Textes de plusieurs lignes (`description`, `message`) : seul `\n` est admis.
- `ListingLead` est journalisé (ADR 0016) ; message et créneau masqués.
- Prix : `price_unit` est dérivé du `kind` (`night` pour `short_stay`, `month` pour `long_term`) ; `kind` ne change pas après création ; devises `EUR` et `XOF`. Tri `relevance` équivaut à `recent`.
- Paiement : `ConfirmBooking` (action testée, sans route) attend un événement Payments pour les réservations, qui n'existe pas encore.
- Demande de visite : seul l'événement `VisitRequested` est émis ; ni conversation Messaging ni notification de l'organisation tant que ces listeners n'existent pas. L'organisation est affichée par son nom, y compris une organisation individuelle ; la vérification de la carte professionnelle n'est pas faite.
- Middleware `marketplace.traveler` : e-mail vérifié, avec le code `email_unverified` du module Identity plutôt que le `forbidden` générique de `verified`.
- Amorçage : `GeographyCatalog::seed()` (appelé par `DatabaseSeeder`) ; `MarketplaceDemoSeeder` (six annonces illustratives) est à lancer à la main, uniquement en `local` et `testing`, avec `MARKETPLACE_DEMO_ORGANIZATION`.

### Codes d'erreur ajoutés (à reporter dans l'ADR 0014)

Listings : `listing_not_found` (404), `listing_incomplete` (422, extension `missing`), `listing_city_invalid` (422), `listing_stale_version` (409), `listing_archived` (409). Bookings : `booking_not_found` (404), `listing_not_bookable`, `min_nights_not_met`, `stay_too_long`, `guests_exceed_capacity`, `bookings_idempotency_key_required` (422), `dates_unavailable`, `booking_not_cancellable`, `booking_not_confirmable`, `idempotency_key_reused`, `pending_booking_exists`, `too_many_pending_bookings` (409).

### Vérifications restantes

- **Le verrou de disponibilité n'a pas été testé sur MySQL réel.** Les tests tournent sur SQLite en mémoire, où `lockForUpdate()` est sans effet et où il n'y a pas de concurrence : la sérialisation des réservations d'une même annonce (verrou de ligne de `listings` dans la transaction de `CreateBooking`, avec relecture de la clé d'idempotence) et l'unicité `(user_id, idempotency_key)` restent à éprouver avec des requêtes simultanées sur MySQL (InnoDB, `REPEATABLE READ`) : deux `POST /bookings` aux dates qui se chevauchent doivent donner une création et un `409 dates_unavailable`, et deux plafonds simultanés ne doivent pas dépasser 2 réservations en attente. Aucune base MySQL éphémère n'a pu être lancée lors de ce lot ; il faut en démarrer une dédiée (jamais la base de développement) avant l'ouverture publique.
- Le plafond de 2 réservations en attente par compte est sérialisé par le verrou de l'annonce : deux demandes simultanées du même compte sur deux annonces différentes peuvent le dépasser tant qu'aucun verrou par compte n'existe ; le limiteur de 10 demandes par heure borne l'écart.
- Listener Payments → `ConfirmBooking`, notifications de l'hôte et conversation Messaging pour les demandes de visite : à créer avec leurs modules.

