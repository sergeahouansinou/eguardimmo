# eGuardImmo mobile

Application Flutter multi-profils (voyageur, locataire, propriétaire, agence). Tranche livrée : fondation, authentification par jeton Sanctum, sélecteur de profils, côté voyageur SeBook, espaces locataire, propriétaire et agence (voir « Écrans par profil »).

Architecture : par feature (`models`, `services`, `viewmodels`, `screens`, `widgets`), Provider + `ChangeNotifier`, routes nommées (`onGenerateRoute`), Dio. Décisions : ADR 0003, 0004, 0010, 0012, 0041.

## Configuration

Toute valeur variable vient de `env/<env>.json` (`--dart-define-from-file`), lue uniquement par `AppConfig`. Aucun secret dedans : le fichier est compilé dans l'application.

```
cp env/example.json env/dev.json
flutter run --dart-define-from-file=env/dev.json
```

Clés : `ENV`, `API_BASE_URL`, `TERMS_URL`, `PRIVACY_URL`, `SUPPORT_EMAIL`, `APP_VERSION`, `API_PINS`. Les fichiers réels (`dev.json`, `staging.json`, `prod.json`) sont ignorés par git ; seul `example.json` est versionné.

### Mode durci

Un build est « durci » dès qu'il n'est pas en debug **ou** que `ENV` n'est pas `dev` (donc release, profile, staging et prod). Seul un build debug avec `ENV=dev` est en mode développement. En mode durci :

- une URL en `http://` est refusée (l'application affiche l'écran « Configuration invalide » et ne démarre pas) ;
- les journaux sont coupés (`AppLogger` et `debugPrint`) ;
- l'épinglage de certificat est obligatoire : `API_PINS` doit contenir au moins 2 empreintes valides et distinctes, sinon l'application refuse de démarrer.

En dev, le clair n'est autorisé que vers `10.0.2.2` et `localhost` sur Android (`android/app/src/debug/res/xml/network_security_config.xml`). iOS n'a pas d'exception : le développement local passe par https, ou par un autre mécanisme propre au debug. Note : `HttpClient` de `dart:io`, utilisé par Dio, n'est pas soumis à ATS ; la garantie « pas de clair » est le contrôle https d'`ApiClient` (`lib/core/services/api_client.dart`, `StateError` si le schéma n'est pas https), doublé de la configuration réseau Android.

### Épinglage de certificat (`API_PINS`)

`API_PINS` est une liste d'empreintes SPKI SHA-256 en base64 séparées par des virgules (`dart-define-from-file` ne transporte que des textes) : l'empreinte courante, puis au moins une de secours. Calcul pour le certificat servi par l'API :

```
openssl s_client -connect api.exemple.fr:443 -servername api.exemple.fr </dev/null 2>/dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl enc -base64
```

Pour la clé de secours (non encore déployée), appliquez la même chaîne `openssl pkey -pubin … | openssl dgst … | openssl enc -base64` à sa clé publique, par exemple `openssl req -in secours.csr -pubkey -noout | …`.

Fonctionnement et limites : le transport n'accepte que le certificat dont la clé publique correspond à une empreinte, pour l'hôte de `API_BASE_URL`, dans sa période de validité ; les autorités du système ne comptent pas. Seul le certificat feuille est comparé : renouvelez le certificat en **conservant la même clé** (par exemple `certbot --reuse-key`) ou publiez la nouvelle empreinte en secours avant la rotation, sinon les applications déjà installées ne joindront plus l'API. `env/example.json` ne porte que des valeurs de remplacement « [À RENSEIGNER] », volontairement invalides.

## Routage

- `core/routes/app_routes.dart` : `RouteName`, les noms de routes. Les arguments sont typés (`route_args.dart` : `ResourceArgs`, `ListingArgs`) et vérifiés avant d'ouvrir l'écran.
- `core/routes/router_manager.dart` : `RouterManager` assemble les pages des features (`<x>_routes.dart`), porte la hiérarchie des écrans et branche `MaterialApp` (`onGenerateRoute`, `onGenerateInitialRoutes`).
- Empiler un écran : `Navigator.pushNamed<Object?>(context, RouteName.x, arguments: …)`. Ne jamais préciser un autre type de résultat : les routes sont des `Route<Object?>`.
- Repartir d'une destination (changer d'onglet ou de profil) : `RouterManager.go(navigator, RouteName.x)`. Une destination déjà ouverte est réaffichée sans être reconstruite.
- Lien reçu application ouverte : `IncomingLinks` (autour de l'application) le passe à `DeepLinkGuard`, puis à `go` ; un lien refusé mène à l'accueil.
- Nouvel écran : constante dans `RouteName`, page dans la feature, parent dans `RouterManager` s'il en a un, et chemin dans `DeepLinkGuard` s'il peut être ouvert par un lien.

## Sécurité

- Jeton Sanctum unique (30 jours) dans `flutter_secure_storage` uniquement ; 401 sur une requête authentifiée : jeton effacé et retour à l'état déconnecté, sauf si une autre session a été ouverte entre-temps (le jeton stocké doit être celui qui a été envoyé).
- Keychain iOS : `first_unlock_this_device`, sans synchronisation iCloud ; au premier lancement après installation, le Keychain est purgé (un drapeau hors Keychain, dans les préférences, détecte la réinstallation). Android : clé enveloppée RSA-OAEP SHA-256, données AES-GCM.
- Déconnexion : `DELETE /auth/token`, jeton local toujours effacé, avertissement si la révocation n'est pas confirmée.
- Android : `allowBackup=false` et `dataExtractionRules` excluant toute donnée ; `FLAG_SECURE` sur toute l'application hors build debuggable (pas de capture d'écran ni d'aperçu dans les tâches récentes).
- iOS : un masque recouvre l'écran quand la scène devient inactive (sélecteur d'applications), absent en debug.
- Aucune redirection HTTP suivie ; liens profonds validés par `DeepLinkGuard`.
- Aucun intent-filter ni domaine associé déclaré : à ajouter avec le domaine réel.

## Build release

Android : copier `android/key.properties.example` en `android/key.properties` (ignoré par git) et renseigner le keystore. Sans ce fichier complet, le build release échoue : il n'y a pas de repli sur la clé de debug.

```
flutter build apk --release --obfuscate --split-debug-info=build/symbols --dart-define-from-file=env/prod.json
flutter build appbundle --release --obfuscate --split-debug-info=build/symbols --dart-define-from-file=env/prod.json
flutter build ipa --release --obfuscate --split-debug-info=build/symbols --dart-define-from-file=env/prod.json
```

Conserver `build/symbols` (hors dépôt) pour désobfusquer les traces de crash.

## Jetons de design

`lib/core/theme/tokens.dart` est généré par `packages/tokens` ; le resynchroniser avec :

```
scripts/sync-tokens.sh
```

## Vérifications

```
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
python3 ~/.claude/skills/flutter-architecture/scripts/audit.py . --shared auth,profiles
```

## API du marché

L'application lit les formes réelles du backend (`Geography`, `Listings`, `Bookings`) ; les fixtures de `test/helpers/fixtures.dart` reproduisent leurs Resources (`PlaceResource`, `ListingCardResource`, `PublicListingResource`, `QuoteResource`, `BookingResource`, `OccupiedRangeResource`). Modèles dans `lib/features/sebook/models/`.

- `GET /marketplace/places?q=` (2 caractères minimum) : `{data: [{slug, name, postal_code, country}]}`.
- `GET /marketplace/listings` : `{data: [carte], meta: {has_more, next_cursor}}` ; filtres `kind=short_stay`, `place`, `category` ; curseur `after`, `per_page` 12.
- `GET /marketplace/listings/{ref}` : carte + `description`, `deposit`, `cancellation_policy`. `ref` : 12 caractères `[a-z2-9]`. Montants en `{amount, currency}` ; ville, quartier, hôte et séjour minimal peuvent être absents.
- `GET /marketplace/listings/{ref}/availability?from&to` : plages occupées `{check_in, check_out}` (départ exclusif), fenêtre de 366 jours. L'écran de réservation s'en sert pour refuser une plage occupée avant le devis ; en cas d'échec de lecture il prévient et laisse le serveur trancher.
- `POST /marketplace/listings/{ref}/quote` (public) : `{check_in, check_out, guests}` ; réponse avec `available`.
- `GET|PUT|DELETE /marketplace/favorites[/{ref}]` : liste paginée (`cursor`), compte connecté à e-mail vérifié.
- `POST /marketplace/listings/{ref}/visit-requests` : `{requested_slot, message?}`.
- `POST /marketplace/bookings` : en-tête `Idempotency-Key` obligatoire, corps `{listing_ref, check_in, check_out, guests}` ; `GET /marketplace/bookings` (paginé, `cursor`) ; `POST /marketplace/bookings/{id}/cancel` renvoie la réservation avec `refund`.

Une réservation `pending_payment` s'affiche « Paiement à finaliser », jamais « Confirmée », avec l'échéance `expires_at` ; le paiement en ligne n'est pas ouvert dans l'application.

## Actions manuelles

- Créer `env/dev.json`, `env/staging.json`, `env/prod.json` (URL d'API réelles en https).
- Android : créer le keystore de signature et `android/key.properties` (modèle : `android/key.properties.example`).
- iOS : signature (équipe, profils de provisioning, certificat de distribution) à configurer dans Xcode.
- `API_PINS` : calculer les empreintes courante et de secours (voir plus haut) et les renseigner dans `env/staging.json` et `env/prod.json`.
- Police Inter : non embarquée (aucun fichier téléchargé) ; ajouter l'asset puis renseigner la famille dans `app_typography.dart`.
- Firebase (notifications push) : non configuré dans cette tranche.
- Liens universels / App Links : déclarer le domaine réel côté Android et iOS.
- Suppression de compte in-app (`DELETE /me`, exigence App Store 5.1.1(v)), inscription et connexion sociale : hors tranche.

## Écrans par profil

Chaque espace lit l'API existante ; aucune donnée illustrative. Une fonction sans API mobile reste annoncée « Bientôt disponible » dans l'écran concerné.

- Locataire (`/tenant/*`) : prochaine échéance et reste dû, échéances, paiements, quittances, demandes d'intervention (liste, détail, création, commentaire, annulation), documents du bail.
- Propriétaire (`/owner/*`) : accueil (mois, reversements, dernier compte rendu, biens), reversements, relevé de compte mensuel, biens, documents ; sélecteur d'agence quand plusieurs accès.
- Agence (`/org/{organisation}/*`, segment fourni par `/me/profiles`) : indicateurs du mois, reversements, alertes, impayés (avec relance par acte de recouvrement), interventions (fiche, qualification, refus, assignation, devis, décision d’approbation, annulation, commentaire), biens et baux (lecture).

Non branché : paiement en ligne (aucun PSP), téléchargement des PDF (avis, quittances, documents, comptes rendus), assurance, état des lieux, charges, compte de versement, propriétaire en nom propre (espace `/org`), visites, urgence, clôture et factures fournisseurs, dépôt de pièces, ouverture de dossiers de recouvrement, création de biens et de baux. Congé (locataire), décision sur devis et fin de mandat (propriétaire) : routes derrière le middleware `web-session`, qui refuse les jetons personnels (`reauthentication_required`, ADR 0032 §5) et exige la double authentification ; inutilisables avec le jeton mobile.

## Messages et support

Code dans `lib/features/messages/` et `lib/features/support/` ; briques communes dans `lib/core/widgets/chat/`, `lib/core/utils/poller.dart` et `lib/core/state/polled_list_viewmodel.dart`. Fixtures exactes sous `test/fixtures/api/messages/` et `test/fixtures/api/support/` (formes de `CounterpartThreadResource`, `ExternalThreadResource`, `TicketSummaryResource`, `TicketDetailResource`, `SupportMessageResource`).

Routes : `/messages` (onglet, selon le profil actif), `/messages/conversations/{id}` et `/messages/conversations/nouvelle`, `/messages/support`, `/messages/support/{id}` et `/messages/support/nouvelle` (le support est commun à tous les profils, voyageur compris ; accès aussi depuis Compte > « Mes demandes d'assistance »).

- Locataire (`/tenant/conversations`) : liste, filtre non lues, fil, envoi, ouverture d'un fil (bail choisi parmi `/options`).
- Propriétaire mandant (`/owner/conversations`) : lecture seule. Le serveur refuse toute écriture à un jeton personnel (`web-session`, ADR 0032) ; l'application le dit au lieu de proposer une saisie vouée à l'échec.
- Agence ou bailleur autonome (`/org/{organisation}/conversations`) : liste par type de fil (locataires, mandants pour une agence), réponse, fermeture et réouverture. Pas d'ouverture de fil : aucune API de destinataires utilisable depuis le mobile.
- Support (`/support/*`) : disponibilité lue sur `/support/status`, mes demandes, ouverture (5 par heure et 20 par jour, affichées), fil, réponse. Répondre à une demande résolue la rouvre 14 jours. Le demandeur ne change pas l'état (seul `{read: true}` est accepté).

Interrogation (pas de WebSocket, ADR 0033) : fil 10 s, boîte et demandes 30 s, recul exponentiel jusqu'à 5 min, `Retry-After` respecté ; 401, 403 et 404 arrêtent l'interrogation et sont affichés. Elle se met en pause quand l'onglet ou l'écran n'est pas visible et quand l'application passe en arrière-plan.

Envoi idempotent : `client_id` stable tant que le texte ne change pas, brouillon conservé après un échec (429 avec attente, 403, 409, réseau). Contenu toujours en texte brut : ni HTML, ni Markdown, aucun lien cliquable.

Pièces jointes : affichage et aperçu d'image (JPEG, PNG, WebP, 10 Mo au plus) par téléchargement authentifié (`ApiClient.download`, octets jamais écrits sur disque ni exécutés) ; les PDF ne sont pas ouverts. L'envoi de pièces jointes n'est pas implémenté : il demande un sélecteur de fichiers (paquet à choisir).

Non couvert : notifications push, pastille de non lus sur l'onglet, retrait de message, archivage et sourdine, conversations internes d'une organisation, opérations de la console.
