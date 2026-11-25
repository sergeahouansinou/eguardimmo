# ADR 0033 — Messagerie conversationnelle, support de la plateforme et diffusions

Statut : accepté (2026-11-19) : les quinze décisions sont validées telles que recommandées, sauf la 13 (fournisseur d'e-mail : Mailtrap, choix de l'utilisateur). Décide ce que l'ADR 0024 (« échange locataire ↔ organisation : nouveau produit, à décider avec la vague 4 ») et l'ADR 0029 (décision 8) avaient reporté, et précise le lot 4 de l'ADR 0032 (messagerie mandant ↔ agence). Complète l'ADR 0003 (espaces), l'ADR 0005 (modules), l'ADR 0006 (cloisonnement), l'ADR 0010 (applications), l'ADR 0014 (erreurs), l'ADR 0016 (journal), l'ADR 0017 (MySQL), l'ADR 0019 (parties), l'ADR 0024 (espace locataire), l'ADR 0027 (notifications), l'ADR 0029 (maintenance) et l'ADR 0032 (espace propriétaire). Amendements proposés en fin de document, **non appliqués**. Les obligations légales citées viennent de sources secondaires : **à confirmer** avec un juriste (ADR 0011).
Avancement (2026-11-19) : lot 1 livré côté serveur (conversations locataire, mandant et agence, accusés, `client_id`, retrait, restriction, fermeture, assignation, notifications, effacement à l'anonymisation). Reportés : `GET …/conversations/recipients?kind=` (la recherche de destinataires a besoin de lectures nouvelles dans Parties, Leases et Mandates), analyse antivirus et `scan_status` (lot 6), purges planifiées (lot 6).
Avancement (2026-11-19, lots 5 et 6 serveur) : diffusions (audiences, envoi par paquets, programmation, test, désinscription, webhook Mailtrap, quotas, annonces, purge), antivirus trois états (`scan_status`, pilotes `clamd`, `fake`, `none`) et purges planifiées livrés côté serveur. Reportés : citation d'une intervention, reprise des pièces internes vers `DocumentStore` et retrait de `path`, notification de l'auteur à l'infection d'une pièce, lot 7 (fronts).
Avancement (2026-11-19, lot 3) : support livré côté serveur (profil vérifié, `client_id`, statut, accusés, résolution automatique, notifications `account`, consentement, urgence, garde `support-access:*`, liste côté organisation). Décisions hors ADR : voir l'amendement du lot 3 en fin de document. Reportés : routes de lecture `records` et `documents` (périmètres déclarés, aucune route ne les expose encore), e-mail `SUPPORT_TEAM_ADDRESS` pour une demande `high`, compteur de la console, antivirus (lot 6).

## Contexte

L'utilisateur demande, pour toutes les applications : (a) des échanges agence ↔ locataire et agence ↔ propriétaire mandant, (b) un support de la plateforme (demandes et discussion) depuis l'agence, le propriétaire et le locataire, traité dans `apps/console`, (c) des diffusions (campagnes). Constaté dans le code :

- **Messaging, conversations** (`conversations`, `conversation_participants`, `conversation_messages`, `conversation_attachments`) : échanges **entre membres d'une même organisation** seulement (`StartConversation` vérifie `MembershipDirectory::activeTeam()`). Routes `/org/{organization}/conversations…` : liste avec onglets (`all`, `unread`, `awaiting`, `sent`, `archived`), statistiques, destinataires, fil, réponse (60/min), lu et archivé (`PATCH`), téléchargement. Lecture par participant (`last_read_at`). Pièces par `Messaging\Support\AttachmentStore` : disque local, type vérifié sur le contenu (PDF, JPEG, PNG, WebP), 10 Mo, 5 par message, nom régénéré ; **sans** retrait des EXIF, sans détection de code, sans durée de conservation, hors `DocumentStore`. Quatre tests.
- **Messaging, support** (`support_tickets`, `support_ticket_messages`, `support_attachments`, `support_access_grants`, `support_reference_counters`) : données de plateforme hors organisation (ADR 0005, liste d'exceptions de `ArchTest.php`). Côté compte : `/support/tickets…` (ouverture 10/min, réponse 30/min). Côté console (`space:operator`) : liste, statistiques, équipe, fiche, mise à jour (statut `open|waiting|resolved`, priorité, assignation), réponse avec note interne (`internal`), « accès » et pièces. Référence en séquence continue par année. Dix tests.
- **Défauts relevés** (non corrigés, hors périmètre d'un ADR) :
  - `support_access_grants` est créé par l'opérateur **seul**, pour 60 minutes, avec un motif journalisé, **sans consentement** de l'organisation et **sans effet** : aucune route de la console ne le vérifie ;
  - `space` d'une demande est déclaré par le client sans contrôle du profil (connu, ADR 0024) ; ouverture à 10/min par compte, trop large ;
  - les horaires « En ligne » du support sont codés dans le front (`isSupportOnline`, 9 h à 18 h, Paris).
- **`packages/messagerie`** porte déjà les écrans de toutes les applications : profils `locataire`, `proprietaire`, `agence`, `bailleur`, `console`. Le profil `agence` décrit une boîte « mandants et locataires » (onglets `mandant` et `locataire`, rattachement à un mandat ou à un bail, `linkOptions`), mais l'API qui l'alimente sert les conversations **internes** : l'écran et le serveur ne parlent pas du même objet. Objets liés prévus : `bail`, `bien`, `mandat`, `intervention`, `devis`, `incident`.
- **Campagnes** : **rien côté serveur**. Le front a les écrans et une source de démonstration (liste, brouillon, programmation, audiences « tous les locataires », « tous les mandants », « locataires avec un impayé », filtres par immeuble, envoi de test, « copier dans l'historique », taux de lecture) ; la source API répond « Les campagnes ne sont pas encore disponibles ». L'ADR 0005 range les campagnes dans **Notifications**.
- **Infrastructure décrite** : un seul déploiement Laravel 13 (ADR 0001), MySQL 8.4 (ADR 0017), file `database`, cache `database`, sessions `database`, `BROADCAST_CONNECTION=log`, `MAIL_MAILER=log`, aucun Redis utilisé, hébergement unique dans l'Union européenne (ADR 0011). Le serveur PHP (FPM ou autre) n'est décrit nulle part : **hypothèse** PHP-FPM derrière Nginx (ADR 0002). Aucun antivirus. Push par FCM (ADR 0027).
- **Décisions déjà prises qui s'appliquent** : clé (organisation, bail) de `LeaseDirectory::visibleToTenant()` avec 12 mois de grâce (ADR 0024) ; clé (organisation, mandant) de `MandateDirectory::visibleToOwner()`, fenêtre et lecture seule pendant la grâce, `co_owner` sans messagerie, la plateforme ne lit pas les échanges d'une agence (ADR 0032) ; notifications à clé de lecture et gabarits sans donnée personnelle (ADR 0027) ; photos sans EXIF, conservation clôture + 5 ans (ADR 0029).

## Décision

### 1. Invariants

1. **Trois produits distincts, une seule technique** : conversations d'une organisation (internes, avec un locataire, avec un mandant), support de la plateforme (demandes), diffusions (campagnes). Aucun ne lit les données d'un autre.
2. **La plateforme ne lit jamais une conversation d'organisation**, même avec un accès de support (décision 9). Le support ne voit que ce que le demandeur écrit dans sa demande.
3. **Accès par clé, évaluée à chaque requête** : locataire par (organisation, bail) de `visibleToTenant()` et sa fiche rattachée ; mandant par (organisation, mandant) de `visibleToOwner()` ; équipe par rôle courant. Hors clé : **404**, comme une ressource inconnue. La ligne de participant ne sert qu'à l'état de lecture, jamais à l'autorisation des locataires et mandants.
4. **Un message n'est ni modifié ni supprimé** par son auteur ; seul un retrait encadré remplace son contenu (décision 5). Les échanges servent de trace entre les parties.
5. **Interrogation périodique, pas de connexion persistante** (décision 3).
6. **Aucun pixel de suivi, aucun lien de suivi** dans un e-mail (décision 10).

### 2. Conversations organisation ↔ locataire et organisation ↔ mandant

**Modèle : on étend `conversations`, on ne crée pas `owner_threads`.** Colonne `kind` (`internal`, `tenant`, `owner`) ; l'API `/org/{organization}/conversations` et l'écran existant servent les trois, avec un filtre `kind` (onglets `locataire` et `mandant` du profil `agence`).

| `kind` | Contrepartie | Rattachement | Côté organisation | Côté contrepartie |
|---|---|---|---|---|
| `internal` | membre de l'équipe | aucun | participants seulement (inchangé) | – |
| `tenant` | fiche locataire (`party_id`) | `lease_id` obligatoire ; `intervention_id` facultatif (lot 6) | rôles `owner`, `admin`, `manager` | le compte rattaché à la fiche (`PartyLinks`), tant que le bail est dans `visibleToTenant()` |
| `owner` | fiche du mandant (`party_id`) | `mandate_id` facultatif ; `intervention_id` facultatif (lot 6) | rôles `owner`, `admin`, `manager` ; organisation `agency` seulement | les comptes ayant un accès `holder` ou `representative` vivant (jusqu'à 5, ADR 0032), qui partagent le fil |

- **Organisation `individual`** (bailleur autonome) : `tenant` seulement, profil `bailleur` du front.
- **Un fil par sujet** : l'organisation ou la contrepartie ouvre un fil avec un objet (140 caractères) et un rattachement. Un fil `tenant` lie **une seule fiche** : un colocataire ne lit pas le fil d'un autre (confidentialité entre colocataires, à valider, question 3).
- **Ouverture** : par l'équipe vers une fiche **qui a un compte rattaché** (liste des destinataires = fiches liées, avec leurs baux ou mandats en `linkOptions`) ; par le locataire sur l'un de ses baux visibles ; par le mandant (`holder`, `representative`) sur l'une de ses agences. Une fiche sans compte ne reçoit pas de conversation : l'agence l'invite (ADR 0024, 0032) ou lui écrit hors application.
- **Fenêtres** : locataire en grâce (12 mois, ADR 0024) : lecture **et écriture** sur les fils de ce bail (restitution du dépôt de garantie, décompte de sortie ; question 4). Mandant : règle de l'ADR 0032 décision 7, inchangée (pendant la grâce, réponse dans un fil existant seulement tant que `OwnerPayable` n'est pas soldé). Hors fenêtre, rien n'est lisible ; l'organisation garde le fil.
- **État** : `open` ou `closed`. L'équipe (`owner`, `admin`, `manager`) ferme un fil : la contrepartie le lit encore mais n'y écrit plus. Une nouvelle réponse de l'équipe le rouvre. **Assignation** facultative à un membre (`assignee_user_id`) : elle oriente les notifications, pas l'accès.
- **Accusés de lecture** : `conversation_participants.last_read_at` existant, une ligne par compte (créée à la première lecture pour l'équipe). La contrepartie voit « Lu par l'agence » quand un membre a lu après le message ; l'équipe voit « Lu » quand un compte de la contrepartie a lu. Ni indicateur de saisie, ni présence.
- **Corps** : texte de 5 000 caractères au plus (règle existante), mise en forme du front (`**gras**`, `*italique*`, `__souligné__`) stockée en texte et rendue échappée par le client ; jamais de HTML stocké ni rendu. Liens affichés en texte, jamais d'aperçu chargé par le serveur (pas de SSRF).
- **Mention fixe** dans l'écran de saisie du locataire et du mandant : un message n'est pas un congé, une mise en demeure ni une décision ; ces actes gardent leur forme (lettre recommandée, acte, parcours dédié de l'ADR 0032). Libellé à valider par le juriste.
- **Comptable** : n'accède pas aux fils `tenant` et `owner` (minimisation, comme la note du bail, ADR 0020 et 0032) ; question 5.
- **Intervention** : la chronologie de l'intervention (ADR 0029) reste le registre de l'intervention ; un fil peut **citer** une intervention de son bail ou de ses lots (lien affiché si la contrepartie peut la lire), au lot 6. « Écrire au locataire » depuis une intervention reste un commentaire de chronologie.

### 3. Temps réel : interrogation périodique

- **Décision** : le client interroge l'API, aucune connexion persistante. Fil ouvert et onglet visible : `GET …/conversations/{id}/messages?after={message}` toutes les **10 s** ; boîte de réception : **30 s** ; compteur de non-lus : **60 s** (le compteur du support est déjà à 60 s). Arrêt quand l'onglet est caché (`refetchIntervalInBackground: false`), reprise au retour ; recul exponentiel jusqu'à 5 minutes sur 429 et 5xx ; `Retry-After` respecté.
- **Coût serveur** : `after` lit par l'index `(conversation_id, sent_at)` existant ; le compteur lit une requête agrégée par espace. Débits dédiés (décision 13) sous le plafond global de 300/min (ADR 0002).
- **Mobile** : push générique FCM (ADR 0027) puis rafraîchissement à l'ouverture ; pas d'interrogation en arrière-plan.
- **Seuil de réexamen** (nouvel ADR, pas un réglage) : plus de 50 requêtes d'interrogation par seconde soutenues, ou besoin produit de présence et de saisie. L'option retenue serait alors Laravel Reverb (décision écartée ci-dessous) avec Redis.

### 4. Pièces jointes

- **Stockage** : les pièces des conversations d'organisation passent par `Documents\PublicApi\DocumentStore` (catégorie `supporting`) : type vérifié sur le contenu (PDF, JPEG, PNG, WebP), 10 Mo, refus du code PHP, images **réencodées sans EXIF** (`ImageSanitizer`), téléchargement `private, no-store` journalisé (`documents.file.downloaded`), `retentionUntil` (décision 12). `conversation_attachments` gagne `stored_file_id` ; `path` reste nullable pour les pièces internes déjà stockées, puis disparaît au lot 6 après reprise. Les pièces du **support** (hors organisation) restent sur `AttachmentStore`, qui gagne la détection de code et le retrait des EXIF.
- **Limites** : 5 pièces par message, 10 Mo chacune (existant) ; 30 pièces par compte de contrepartie et par jour ; 200 Mo par fil (409 `conversation_storage_full`).
- **Analyse antivirale** : ClamAV (`clamd`, protocole `INSTREAM` sur socket, sans paquet Composer), derrière une interface `MalwareScanner` de Documents justifiée par deux implémentations réelles (`ClamdScanner`, `FakeScanner`) plus `none`. Trois états sur `stored_files.scan_status` : `clean`, `infected`, `unverifiable` (plus `pending` pendant l'analyse en file). Une pièce n'est téléchargeable que `clean` ; `infected` est mise en quarantaine (contenu purgé, ligne gardée, auteur et équipe prévenus) ; `unverifiable` (scanner injoignable) reste **bloquée** et réessayée, jamais livrée par défaut ni affichée « infectée ». `DOCUMENTS_MALWARE_SCANNER=none` en développement seulement ; refus de démarrer en production sans scanner (question 6).

### 5. Modération et anti-abus

- **Pas de modération automatique du contenu** (ni filtre de mots, ni lecture par un modèle) : l'organisation est responsable de ses échanges, la plateforme ne les lit pas.
- **Outils de l'organisation** : fermer un fil ; **restreindre** une contrepartie (`muted_until`, 30 jours au plus, motif obligatoire) : elle lit, n'ouvre ni ne répond ; plafond de **10 fils ouverts** par fiche et par organisation.
- **Retrait d'un message** : par son auteur dans les **15 minutes** ; par `owner` ou `admin` de l'organisation (2FA) pour une donnée personnelle envoyée par erreur (IBAN, pièce d'identité) ou un contenu illicite, motif obligatoire. Le corps devient `[message retiré]`, les pièces sont purgées hors `retentionUntil` (exception de purge à ajouter à Documents, question 7), `redacted_at` et `redacted_by_user_id` sont posés, l'audit ne garde **ni** le texte **ni** le nom du fichier.
- **Signalement à la plateforme** : par une demande de support, où le demandeur recopie ce qu'il choisit de montrer ; jamais d'accès du support au fil.

### 6. Idempotence

- **Message et demande** : le client génère `client_id` (UUID v7) ; clé unique `(conversation_id, author_user_id, client_id)` et `(support_ticket_id, author_user_id, client_id)`, `(requester_user_id, client_id)` pour l'ouverture. Rejeu : **200** avec l'objet existant, aucune pièce stockée deux fois, aucun événement réémis. Corps différent avec le même `client_id` : 409 `idempotency_key_reused`.
- **Lu, archivé, fermé** : opérations idempotentes (réponse identique au rejeu).
- **Campagne** : décision 10.
- **Événements** après commit (`ShouldDispatchAfterCommit`, ADR 0007) ; notifications dédupliquées par clé (décision 7).

### 7. Notifications (amende l'ADR 0027)

| Type | Audience | Destinataires | Clé d'idempotence | Défaut |
|---|---|---|---|---|
| `messaging.message_received` | `staff` | l'assigné s'il existe, sinon `owner`, `admin`, `manager` | `conversation:{id}:{dernière lecture du destinataire ou never}` | in_app, e-mail |
| `tenant.message_received` | `tenant` | compte rattaché à la fiche, bail visible | idem | in_app, e-mail, push |
| `owner.message_received` | `owner` | accès `holder`, `representative` vivants | idem | in_app, e-mail, push |
| `account.support_replied` | `account` (nouvelle, compte sans organisation) | demandeur | `ticket:{id}:{dernière lecture du demandeur ou never}` | in_app, e-mail |
| `support.access_requested`, `support.access_used` | `staff` | `owner`, `admin` de l'organisation | `grant:{id}:{état}` | in_app, e-mail, **non désactivables** |
| `tenant.announcement`, `owner.announcement` | `tenant`, `owner` | destinataires d'une diffusion avec « copier dans l'historique » | `campaign:{id}` | in_app |

- **Une notification par fil tant que le destinataire n'a pas lu** : la clé intègre sa dernière lecture, un échange de dix messages ne produit qu'une notification et un e-mail. Ce n'est pas un résumé (écarté par l'ADR 0027), c'est une coalescence par clé.
- Gabarits sans texte du message, sans nom ni montant : « Nouveau message de votre agence », « Nouveau message d'un locataire ». Lien relatif vers le fil.
- La clé de lecture de l'audience `account` est le seul compte destinataire ; `organization_id` reste nul.

### 8. Support de la plateforme

- **Un objet : la demande** (`support_tickets`). La « discussion » est l'affichage du fil de la demande avec l'interrogation de la décision 3, quand le support est en ligne ; hors ligne, la même demande attend. Pas de second outil de discussion.
- **Ouverture** depuis toute application : agence et bailleur autonome (`space = organization`, organisation dont le compte est membre, existant), propriétaire mandant (`owner`, profil exigé), locataire (`tenant`, profil exigé), SeBook (`marketplace`, compte vérifié). Le serveur **vérifie** désormais le profil déclaré (403 `support_space_forbidden`). Aucun identifiant de bail ou de mandat n'est demandé : le demandeur décrit, le support oriente.
- **Demande d'un locataire ou d'un mandant au sujet de son agence** : le support n'a aucun droit sur les données de l'agence ; il répond, oriente vers l'agence ou, avec l'accord écrit du demandeur dans la demande, contacte l'agence par une demande distincte.
- **Disponibilité** : `GET /support/status` sert horaires, fuseau et délai de réponse depuis la configuration serveur (`SUPPORT_HOURS`, `SUPPORT_TIMEZONE`, `SUPPORT_RESPONSE_LABEL`) ; le front cesse de les coder.
- **Lecture** : `requester_last_read_at` et `support_last_read_at` sur la demande, accusés affichés des deux côtés.
- **Cycle** : `open` → `waiting` (le support attend le demandeur) → `resolved`. Une demande `waiting` sans réponse **7 jours après son passage à `waiting`** (`waiting_since`) passe `resolved` (`messaging:resolve-stale-tickets`, quotidienne, journalisée) ; le demandeur peut la rouvrir pendant 14 jours en répondant (aujourd'hui 409 `ticket_resolved`) ; au-delà, nouvelle demande.
- **Console** : écrans existants (`/support`, `/support/{id}`) ; ajouts : filtre par espace et par organisation, accusés de lecture, demande d'accès (décision 9), alerte de première réponse dépassée (`first_response_at`, 1 jour ouvré). Les opérateurs n'ont pas de centre de notifications (`no-operator-token`) : compteur de la console par interrogation, et e-mail à `SUPPORT_TEAM_ADDRESS` pour une demande `high`.
- **Compte supprimé** (`AccountDeleted`) : ses demandes ouvertes passent `resolved` ; le contenu suit la conservation (décision 12).

### 9. Accès de l'équipe support aux données d'une organisation

L'organisation est responsable du traitement, eGuardImmo sous-traitant : un opérateur ne lit ses données que **sur instruction documentée** (RGPD art. 28, à confirmer).

- **Consentement de l'organisation** : l'opérateur **demande** l'accès depuis une demande rattachée à l'organisation (motif de 10 à 500 caractères, périmètre, durée) ; un `owner` ou `admin` de l'organisation, avec 2FA et preuve récente (`reauthenticated:two-factor`), **accepte** depuis son application. Durée de 24 heures par défaut, **72 heures au plus**, révocable à tout moment, fin automatique à la résolution de la demande.
- **Périmètre** en liste fermée : `settings` (réglages, plan, modules), `team` (membres, rôles, sans 2FA ni secret), `records` (biens, baux, mandats, parties en lecture, coordonnées masquées), `documents` (métadonnées et téléchargement). **Jamais** : conversations, grand livre en écriture, IBAN en clair, secrets 2FA, pièces d'identité. **Lecture seule** dans tous les cas : aucune écriture au nom de l'organisation.
- **Application** : chaque route de la console qui lit une organisation porte `support-access:{périmètre}`, qui vérifie un accès vivant pour (opérateur, organisation, périmètre), sinon 403 `support_access_required`. Chaque lecture est journalisée (`console.support_access.read`, ressource et route, sans contenu). Les routes de lecture d'une organisation sont créées au besoin, chacune avec ce garde ; ce qui existe aujourd'hui dans la console (liste des organisations, abonnements) reste hors de ce mécanisme. **Exception : le journal d'activité** (`/console/activity`), dont le détail des entrées portant une organisation suit ce garde (amendement de la revue du lot 3).
- **Accès d'urgence** sans consentement : incident de sécurité ou réquisition légale seulement, motif obligatoire, **1 heure**, périmètre `settings` et `team`, notification immédiate non désactivable aux `owner` et `admin`, revue a posteriori par un second opérateur (`reviewed_by`). Question 8.
- **Transparence** : `GET /org/{organization}/support-access` liste les accès passés et vivants (opérateur, motif, périmètre, durée, nombre de lectures) pour `owner` et `admin`.
- **Journal** : `messaging.support_access.requested|granted|refused|revoked|expired|emergency|reviewed`.

### 10. Diffusions (campagnes)

**Hébergées par Notifications** (ADR 0005 : « campagnes à venir »), écrans de `packages/messagerie` inchangés.

- **Objet** : message **d'information de gestion** d'une organisation à une audience de ses locataires ou mandants (travaux, coupure, changement de coordonnées de paiement de l'agence, assemblée, rappel d'assurance). **Pas de prospection commerciale** ; une mention l'interdit à la rédaction (question 10).
- **Audiences** (calculées par le serveur, jamais une liste fournie par le client) : locataires des baux `signed` en cours, filtrables par immeuble (Properties) ; mandants des mandats `active` (agences) ; locataires d'une liste d'immeubles. **Écartée** : « locataires avec un impayé » (relance de masse hors des formalités de Recovery, révèle un retard ; ADR 0027 n'en notifie pas le locataire). Question 9.
- **Canal** : e-mail vers le contact principal de la fiche (`contact_points`), et, si « copier dans l'historique » est coché, entrée in_app `tenant.announcement` ou `owner.announcement` pour les fiches qui ont un compte. Une fiche sans e-mail est comptée (`withoutEmail`) et ignorée (`skipped_no_email`).
- **Cycle** : `draft` → `scheduled` (date future, 15 minutes au moins) ou `sending` → `sent` ; `cancelled` depuis `scheduled` seulement. Envoi par `owner`, `admin`, `manager`, **2FA exigée**. Audience **figée à l'envoi** : une ligne `campaign_deliveries` par fiche, clé unique `(campaign_id, party_id)`.
- **Envoi idempotent** : passage `scheduled|draft` → `sending` sous verrou et `lock_version` ; jobs par paquets de 100 ; chaque ligne passe `queued` → `sending` par une mise à jour conditionnelle avant l'appel au fournisseur, puis `sent` avec l'identifiant du fournisseur. Rattrapage `notifications:resume-campaigns` (toutes les 10 minutes) pour les lignes `sending` de plus de 30 minutes : **pas de renvoi automatique** d'une ligne dont l'issue est inconnue, elle passe `unknown` et compte en échec (mieux vaut un e-mail manquant qu'un doublon).
- **Envoi de test** : vers l'adresse vérifiée de l'auteur seulement, 5 par heure.
- **Contenu** : objet 140, corps 10 000 caractères, mise en forme du front ; champs de fusion en liste fermée (`Prénom`, `Bien`, `Mandat`, `Mois`, `Échéance`) remplis par le serveur ; **Loyer** retiré (montant par e-mail de masse). Pièces jointes : 3 PDF de 5 Mo au plus par `DocumentStore`, envoyées en lien vers l'espace pour les fiches avec compte, en pièce jointe sinon (question 11).
- **Expéditeur** : nom de l'organisation (neutralisé comme pour les invitations, ADR 0032) sur une adresse du domaine de la plateforme dédié aux diffusions (`DIFFUSION_FROM_ADDRESS`), `Reply-To` = adresse de contact de l'organisation ; SPF, DKIM, DMARC alignés.
- **Désinscription** : lien en pied de message et en-têtes `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) ; jeton signé (HMAC) portant la ligne d'envoi ; effet : `mail_suppressions` par (organisation, empreinte de l'adresse). Les rebonds définitifs et plaintes y entrent aussi, à l'échelle de la plateforme. Une adresse supprimée passe `suppressed` sans envoi.
- **Mesure** : envoyés, échecs, rebonds, désinscriptions ; « lu » = lecture de l'entrée in_app seulement. **Aucun pixel d'ouverture, aucun lien de suivi** (question 12).
- **Quotas** : 2 000 destinataires par organisation et par 24 heures (`CAMPAIGN_DAILY_RECIPIENTS`), 10 envois par heure ; entitlement du plan quand Subscriptions existera (ADR 0013), refus 429 `campaign_quota_reached` au-delà.

### 11. Fournisseur d'e-mail

Le mailer Laravel reste l'unique point d'envoi (ADR 0027) ; le transport change par configuration, sans paquet Composer : relais **SMTP** du fournisseur. Les événements (rebond, plainte, désinscription) arrivent par un **webhook** propre au fournisseur (`POST /webhooks/mail/{provider}`), signature ou secret vérifié, idempotent sur l'identifiant d'événement.

| Option | Pour | Contre |
|---|---|---|
| Brevo | société française, hébergement annoncé en UE ; transactionnel et diffusions dans un même compte, flux séparés ; webhooks de rebond et de désinscription documentés ; relais SMTP | dépendance à un acteur unique pour les deux flux ; DPA et sous-traitants ultérieurs **à vérifier** |
| **Mailtrap** (retenu) | flux transactionnel et flux Bulk séparés (infrastructure, IP et listes de suppression distinctes), relais SMTP, webhooks, DPA publié | **données hébergées aux États-Unis** d'après sa documentation RGPD (stockage UE annoncé pour 2026, non confirmé) : transferts hors UE, clauses contractuelles ou cadre de protection des données à vérifier avant la production ; sous-traitants ultérieurs à vérifier |
| Scaleway Transactional Email | hébergeur français, UE | **réservé au transactionnel**, l'envoi marketing y est interdit : couvrirait les notifications, pas les diffusions ; un second fournisseur resterait à choisir |
| Amazon SES (région Paris) | coût unitaire le plus bas, très fiable | société américaine (transferts, CLOUD Act), rebonds par SNS à câbler, réputation partagée à surveiller soi-même |

**Décision** : Mailtrap, flux transactionnel pour les notifications et flux Bulk pour les diffusions, deux sous-domaines d'envoi pour isoler la réputation (`POST /webhooks/mail/mailtrap`). Condition de mise en production : DPA signé, mécanisme de transfert hors UE établi et localisation vérifiée par écrit auprès du fournisseur (point juridique 9) ; sans cela, les envois restent désactivés (`MAIL_PROVIDER` non configuré). Le code reste indépendant du fournisseur (relais SMTP + webhook).

### 12. Conservation et purge

| Donnée | Durée proposée (à confirmer) | Mécanisme |
|---|---|---|
| Fil `tenant` | 5 ans après la fin du bail ou le dernier message, la plus tardive | `messaging:purge` quotidienne : corps remplacés par `[effacé]`, pièces purgées (`retentionUntil`), squelette (dates, auteurs, objet) gardé |
| Fil `owner` | 5 ans après la fin du dernier mandat ou le dernier message | idem |
| Fil `internal` | 5 ans après le dernier message | idem |
| Demande de support | 3 ans après `resolved_at` ; pièces 1 an après | idem, sur les tables du support |
| Diffusion | contenu 3 ans ; adresse des envois remplacée par son empreinte après 13 mois | `notifications:purge-campaigns` |
| Liste d'opposition | tant que l'organisation existe (empreinte seulement) | – |
| Accès du support | journal (ADR 0016, durée à fixer) | – |

- **Anonymisation d'une fiche** (ADR 0019) : les messages écrits par le locataire ou le mandant deviennent `[effacé]`, ses pièces suivent leur `retentionUntil` (même règle que l'ADR 0029, décision 13). Il faut un événement `Parties\Events\PartyAnonymized` (nouveau).
- **Suppression du compte** : l'auteur s'affiche « Compte supprimé » (`User::withTrashed()`), le contenu reste le dossier de l'organisation jusqu'à la purge.
- La purge est une politique décidée ici, pas un nettoyage : jamais de suppression de ligne de fil ou de demande.

### 13. Sécurité

- **Gardes** : `auth:sanctum`, `no-operator-token`, `verified` ; `space:tenant`, `space:owner`, `space:organization` + appartenance + rôle ; console `space:operator`. Écritures du mandant : rôles `holder`, `representative`, hors grâce (ADR 0032). **Pas de 2FA exigée pour écrire un message** (lecture et réponse ne sont pas des engagements) ; 2FA pour : envoi d'une diffusion, retrait par l'organisation, restriction d'une contrepartie, consentement d'accès du support.
- **Débits** (par compte, blocage progressif ADR 0002) :

| Action | Locataire, mandant | Organisation | Support |
|---|---|---|---|
| Ouvrir un fil ou une demande | 5/h, 20/jour | 30/min (existant) | 5/h, 20/jour (au lieu de 10/min) |
| Répondre | 20/min, 300/jour | 60/min (existant) | 30/min (existant) |
| Interroger (`after`, compteur) | 120/min | 120/min | 120/min |
| Lire listes et fils | 60/min | 120/min | 60/min |
| Diffusion : envoyer, tester | – | 10/h, 5/h | – |
| Consentement d'accès | – | 10/h | – |

- **IDOR** : `whereUuid` sur chaque paramètre ; fil, message, pièce et accès vérifiés par la clé ; 404 hors clé ; `party_id`, `lease_id`, `mandate_id` reçus du client vérifiés par les PublicApi dans l'organisation courante, jamais crus.
- **Affectation de masse** : jamais `organization_id`, `kind` déduit de la route et du destinataire, `author_side`, `status` de diffusion, audience calculée, `redacted_*`, `scan_status`.
- **Minimisation** : Resources par espace (`Http/Resources/{Tenant,Owner,Organization,Console}/`) ; la contrepartie voit le prénom et le nom des membres qui écrivent, ou le seul nom de l'organisation (question 14) ; jamais d'identifiant de fiche, de rôle interne, de note, d'assigné.
- **Audit** (ADR 0016, sans texte de message ni nom de fichier) : `messaging.conversation.opened|closed|reopened|muted`, `messaging.message.redacted`, `messaging.support_access.*` (décision 9), `messaging.ticket.auto_resolved`, `notifications.campaign.scheduled|sent|cancelled`, `notifications.mail.unsubscribed`. Les messages eux-mêmes ne sont pas recopiés dans le journal (modèles `Auditable` avec `body` en `auditExcluded()`).
- **Cache** : `private, no-store` sur toutes les réponses.

### 14. API

Toutes sous `/api/v1`, noms préfixés par le module.

| Module | Routes |
|---|---|
| Messaging (organisation) | `GET\|POST /org/{organization}/conversations` (`?kind=`), `GET …/conversations/stats`, `GET …/conversations/recipients?kind=`, `GET\|PATCH …/conversations/{id}` (lu, archivé, `status`, `assignee`), `GET\|POST …/conversations/{id}/messages` (`?after=`), `POST …/conversations/{id}/messages/{message}/redaction`, `POST\|DELETE …/conversations/{id}/mute`, `GET …/conversations/unread`, `GET …/conversation-attachments/{id}` ; `GET /org/{organization}/support-access`, `POST …/support-access/{grant}/accept\|refuse\|revoke` |
| Messaging (locataire) | `GET\|POST /tenant/conversations`, `GET\|PATCH /tenant/conversations/{id}`, `GET\|POST …/{id}/messages`, `POST …/{id}/messages/{message}/redaction`, `GET /tenant/conversations/unread`, `GET /tenant/conversations/recipients`, `GET /tenant/conversation-attachments/{id}` |
| Messaging (mandant) | mêmes routes sous `/owner/conversations…`, `?agency=` (remplace `/owner/threads…` de l'ADR 0032) |
| Messaging (support) | existantes + `GET /support/status`, `GET /support/tickets/{id}/messages?after=`, `PATCH /support/tickets/{id}` (lu) ; console : existantes + `POST /console/support/tickets/{id}/access-requests`, `POST …/emergency-access`, `POST /console/support/access/{grant}/review`, `GET /console/support/tickets/{id}/messages?after=` ; la route `POST …/tickets/{id}/access` actuelle est retirée |
| Notifications (diffusions) | `GET\|POST /org/{organization}/campaigns`, `GET\|PATCH …/campaigns/{id}`, `POST …/campaigns/{id}/send\|schedule\|cancel`, `GET …/campaigns/audiences`, `POST …/campaigns/test` ; `GET /tenant/announcements[/{id}]`, `GET /owner/announcements[/{id}]`, `POST …/announcements/{id}/read` |
| Notifications (publiques, dans `ROUTES_PUBLIQUES`) | `POST /mail/unsubscribe/{token}` (`throttle:20,1` par IP), `POST /webhooks/mail/{provider}` (signature, `throttle:600,1`) |

Codes (ADR 0014) : Messaging `conversation_not_found` 404 (existant), `conversation_closed` 409, `conversation_muted` 403, `conversation_open_limit` 409, `conversation_storage_full` 409, `conversation_read_only` 403 (mandant en grâce), `recipient_not_found` 422 (existant), `message_redaction_expired` 409, `idempotency_key_reused` 409, `support_space_forbidden` 403, `support_access_required` 403, `support_access_not_found` 404, `support_access_duration_invalid` 422, `attachment_not_ready` 409 (`pending`, `unverifiable`), `attachment_infected` 410 ; Notifications `campaign_not_found` 404, `campaign_not_editable` 409, `campaign_quota_reached` 429, `campaign_audience_empty` 422, `unsubscribe_token_invalid` 404.

### 15. Événements (après commit)

- Messaging ⇢ `ConversationMessagePosted` (organisation, fil, message, `kind`, côté de l'auteur, fiche, bail ; jamais le texte) ⇢ Notifications.
- Messaging ⇢ `SupportTicketReplied` (demande, demandeur) ⇢ Notifications ; `SupportAccessRequested`, `SupportAccessUsed` (organisation, accès) ⇢ Notifications.
- Parties ⇢ `PartyAnonymized` (organisation, fiche) ⇢ Messaging (nouveau, créé avec son consommateur) ; Parties ⇢ `OwnerAccessRevoked` (existant) : rien à faire, la clé suffit.
- Identity ⇢ `AccountDeleted` ⇢ Messaging (demandes résolues).

### 16. Modèle de données (UUID v7, `datetime(6)`, `Checks::add`, jamais `ENUM`)

- **Messaging** :
  - `conversations` + `kind`, `party_id`, `lease_id`, `mandate_id`, `intervention_id` (sans clé étrangère), `status`, `closed_at`, `closed_by_user_id`, `assignee_user_id`, `counterpart_muted_until`, `retention_until` ; CHECK : `tenant` ⇒ `party_id` et `lease_id` ; `owner` ⇒ `party_id` ; `internal` ⇒ aucun des deux ; index `(organization_id, kind, last_message_at)`, `(organization_id, party_id)`.
  - `conversation_participants` + `side` (`staff`, `tenant`, `owner`) ; `conversation_messages` + `author_side`, `client_id`, `redacted_at`, `redacted_by_user_id` (unique `(conversation_id, author_user_id, client_id)`) ; `conversation_attachments` + `stored_file_id`, `path` nullable.
  - `support_tickets` + `requester_last_read_at`, `support_last_read_at`, `client_id`, `retention_until` ; `support_ticket_messages` + `client_id` ; `support_attachments` + `scan_status`.
  - `support_access_grants` + `organization_id` (nullable, hors scope : donnée de plateforme), `kind` (`consent`, `emergency`), `scopes` (JSON liste fermée), `status` (`requested`, `active`, `refused`, `revoked`, `expired`), `requested_at`, `decided_by_user_id`, `decided_at`, `revoked_at`, `revoked_by_user_id`, `reviewed_by_user_id`, `reviewed_at`, `read_count`.
- **Notifications** : `campaigns` (`organization_id`, `subject`, `body`, `audience`, `building_ids` JSON, `status`, `scheduled_at`, `sent_at`, `created_by_user_id`, `sent_by_user_id`, `copy_to_history`, `recipient_count`, `failed_count`, `lock_version`) ; `campaign_attachments` (`stored_file_id`) ; `campaign_deliveries` (`organization_id`, `campaign_id`, `party_id`, `user_id` nullable, `email` chiffré, `email_hash`, `status` `queued|sending|sent|unknown|bounced|failed|suppressed|skipped_no_email`, `provider_message_id`, `sent_at`, `read_at`) ; `mail_suppressions` (`organization_id` nullable, `email_hash`, `reason`, unique) ; `mail_provider_events` (`provider`, `event_id` unique, `type`, `delivery_id`, `received_at`). `notifications.audience` gagne `account`.
- **Documents** : `stored_files.scan_status`, `scanned_at`.
- **Réglages** (`.env.example` d'abord) : `SUPPORT_HOURS`, `SUPPORT_TIMEZONE`, `SUPPORT_RESPONSE_LABEL`, `SUPPORT_TEAM_ADDRESS`, `DOCUMENTS_MALWARE_SCANNER`, `DOCUMENTS_CLAMD_SOCKET`, `CAMPAIGN_DAILY_RECIPIENTS`, `DIFFUSION_FROM_ADDRESS`, `MAIL_WEBHOOK_SECRET_{PROVIDER}`.

## Plan de lots

Backend d'abord, front ensuite ; chaque lot sort par `composer check` (Pint, PHPStan 8, Pest) ou `pnpm -r check`, sans test ignoré, avec `/security-review` pour les lots 1, 3, 4 et 5.

| Lot | Contenu | Critères de sortie |
|---|---|---|
| 1. Conversations, serveur | colonnes de `conversations`, routes organisation, locataire, mandant, `DocumentStore`, accusés, `after`, `client_id`, fermeture, restriction, retrait, débits, audit, `ConversationMessagePosted`, trois types de notifications, `PartyAnonymized` | tests : 401, 403 sans profil, 404 autre locataire, autre mandant, autre organisation, jeton opérateur ; colocataire sans accès au fil d'un autre ; grâce J+12 mois et J+12 mois + 1 jour (29 février) ; mandant `co_owner` refusé, mandant en grâce en lecture ; comptable refusé ; rejeu `client_id` sans doublon ni seconde notification ; coalescence des notifications ; requêtes constantes avec 1, 10, 100 fils ; Resources sans identifiant de fiche (test de structure) |
| 2. Conversations, fronts | source API de `packages/messagerie` pour `agence`, `bailleur`, `locataire`, `proprietaire` (`(confie)`), interrogation de la décision 3, mention « un message n'est pas un congé », pièces en attente d'analyse | `pnpm -r check` ; vérification navigateur sur l'API réelle (envoi, lecture, accusé, pièce) dans les quatre apps ; aucun appel quand l'onglet est caché |
| 3. Support, serveur | contrôle du profil, `client_id`, statut serveur, accusés, résolution automatique, notifications `account`, consentement et accès d'urgence, garde `support-access:*`, liste côté organisation | tests : consentement nominal, refus, révocation, expiration à 72 h, accès sans consentement 403, lecture journalisée, conversation jamais lisible même avec accès, urgence notifiée ; profil déclaré faux 403 ; débit d'ouverture |
| 4. Support, fronts | console (demande d'accès, filtres, accusés, interrogation), écrans de consentement agence et bailleur, statut serveur dans le widget de toutes les apps | `pnpm -r check` ; parcours complet navigateur : demande depuis le locataire, réponse console, notification, consentement agence |
| 5. Diffusions, serveur | tables, audiences, envoi par paquets, test, désinscription RFC 8058, webhook, quotas, annonces in_app, purge | tests : envoi nominal avec faux transport, rejeu sans doublon, reprise après arrêt (`unknown`), désinscription, rebond par webhook signé, signature fausse 401, quota 429, audience recalculée côté serveur, aucune URL de suivi dans le corps |
| 6. Compléments | ClamAV en production, purges planifiées, citation d'une intervention (si validée), reprise des pièces internes vers `DocumentStore` et retrait de `path` | `scan_status` sur un fichier EICAR en test d'intégration ; purge à J et J+1 ; `migrate:status` propre |
| 7. Diffusions, fronts | source API des campagnes (`agence`, `bailleur`) | `pnpm -r check` ; envoi de test reçu sur une boîte réelle du fournisseur retenu |

## Options écartées

- **WebSocket par Laravel Reverb dès maintenant** : nouveau processus permanent à superviser, mandataire WebSocket, Redis pour plusieurs instances, `laravel-echo` et `pusher-js` côté front, CSP `wss:` dans six applications ; pour un usage de messagerie asynchrone (agence ↔ locataire, réponse en heures), le gain ne paie pas l'exploitation. Seuil de réexamen en décision 3.
- **Server-Sent Events** : sous PHP-FPM, chaque flux ouvert tient un processus ; cent onglets ouverts épuisent le pool. **Long polling** : même défaut.
- **Service tiers de discussion** (Crisp, Intercom, Zendesk) : transfert des données hors de l'UE ou sous-traitant de plus, traceurs dans les apps, coût par opérateur, deux historiques.
- **Tables `owner_threads` séparées** (ADR 0032) puis `tenant_threads` : trois copies de la même logique et une boîte de réception à fusionner sur deux curseurs ; l'écran `agence` attend déjà une boîte unique.
- **Fil `tenant` partagé par tous les colocataires du bail** : expose la situation personnelle d'un colocataire aux autres.
- **Accès du support décidé par l'opérateur seul** (code actuel) : pas d'instruction du responsable de traitement ; **accès du support aux conversations** : contraire à l'ADR 0032.
- **Modération automatique ou lecture par un modèle** : la plateforme lirait les échanges.
- **Modification et suppression libres d'un message** : un échange cité en litige n'aurait plus de valeur.
- **Une notification par message** : dix e-mails pour un échange ; **résumé quotidien** : écarté par l'ADR 0027.
- **Campagnes dans Messaging** : doublerait l'envoi d'e-mails, les préférences et l'idempotence de Notifications, contraire à l'ADR 0005.
- **Pixel d'ouverture et liens de suivi** : traceurs dans un e-mail adressé à des personnes physiques, consentement requis (à confirmer), mesure peu fiable.
- **Audience « locataires avec un impayé »** : relance hors Recovery.
- **Paquet Composer d'un fournisseur d'e-mail** : le relais SMTP suffit, le webhook est un contrôleur.
- **Antivirus par API en ligne** : envoie les pièces des personnes à un tiers ; **pas d'antivirus du tout** : l'agence ouvre sur ses postes des PDF venus de tiers.

## Conséquences

- **Front** : `packages/messagerie` garde ses écrans ; la source API gagne les conversations externes, l'interrogation, le statut serveur du support et les campagnes ; `isSupportOnline` est retiré du code client ; `Loyer` disparaît des champs de fusion ; l'audience « impayés » disparaît ; l'envoi de test ne choisit pas son destinataire.
- **Planification** : `messaging:purge`, `messaging:resolve-stale-tickets`, `messaging:expire-support-access` (horaire), `notifications:resume-campaigns` (10 minutes), `notifications:purge-campaigns`, `documents:rescan-unverifiable` (horaire).
- **Exploitation** : file `queue:work` obligatoire (diffusions, analyse, notifications) ; `clamd` sur l'hôte ou en conteneur (environ 1 Go de mémoire pour les signatures, à mesurer) ; DNS SPF, DKIM, DMARC des deux sous-domaines ; DPA du fournisseur signé.
- **Risques** :
  - l'interrogation coûte des requêtes même sans message ; surveiller le débit (seuil de la décision 3) ;
  - une pièce reste bloquée si `clamd` tombe : volontaire, mais à superviser ;
  - un `owner` d'organisation peut refuser l'accès du support et ralentir la résolution : c'est son droit ;
  - le retrait par l'organisation d'un message du locataire peut servir à effacer une trace ; journalisé, motif obligatoire, auteur prévenu ;
  - la coalescence des notifications masque l'arrivée de nouveaux messages tant que le destinataire n'a pas lu : le compteur de non-lus reste exact.

## Points à valider par un juriste ou un expert

1. Durées de conservation des fils (5 ans), des demandes de support (3 ans, pièces 1 an) et des diffusions (contenu 3 ans, adresses 13 mois) ; point de départ (fin du bail, du mandat, dernier message).
2. Qualification de sous-traitant (RGPD art. 28) pour l'accès du support, consentement d'un `owner` ou `admin` comme instruction documentée, accès d'urgence sans consentement.
3. Base légale des diffusions d'information aux locataires et mandants (exécution du contrat ou intérêt légitime), frontière avec la prospection (CPCE art. L34-5), droit d'opposition, mention à afficher.
4. Mesure de lecture sans pixel ; recommandation de la CNIL sur les traceurs dans les courriels.
5. Valeur d'un message comme preuve (réclamation, accord) et texte de la mention « un message n'est pas un congé » (loi n° 89-462, art. 15 pour la France ; équivalents en Belgique, au Luxembourg et au Québec).
6. Retrait d'un message par l'organisation et effacement (RGPD art. 17) face à la conservation probatoire.
7. Statut de la plateforme pour les contenus échangés (hébergeur, LCEN art. 6 ; règlement sur les services numériques) et traitement d'un signalement de contenu illicite sans lecture des fils.
8. Confidentialité entre colocataires et communication au mandant (le mandant ne lit jamais les fils `tenant`, ADR 0032).
9. Fournisseur d'e-mail (Mailtrap : hébergement aux États-Unis d'après sa documentation, stockage UE annoncé pour 2026) : DPA, sous-traitants ultérieurs, mécanisme de transfert hors UE, localisation ; Québec (Loi 25, évaluation avant transfert, ADR 0011). L'APDP (Bénin) ne s'applique pas au lancement (ADR 0008) ; à revoir si le pays rouvre.
10. Expert sécurité : dimensionnement de `clamd`, politique `unverifiable`, et seuil de bascule vers Reverb.

## Décisions à valider

Ma recommandation est toujours la première.

1. **Étendre `conversations` (`kind` = `internal`, `tenant`, `owner`) plutôt que créer `owner_threads`, et servir `/owner/conversations…` au lieu de `/owner/threads…`.** Alternative : tables séparées par public (ADR 0032 tel quel).
2. **Interrogation périodique (10 s, 30 s, 60 s, arrêt onglet caché) sans nouvelle dépendance ; Reverb réexaminé au-delà de 50 requêtes par seconde.** Alternatives : Reverb dès le lot 1 ; SSE.
3. **Un fil `tenant` ne lie qu'une fiche (pas de lecture par les colocataires).** Alternative : fil partagé par tous les locataires du bail.
4. **Locataire en grâce : lecture et écriture sur les fils de son bail.** Alternative : lecture seule, comme le mandant.
5. **Comptable exclu des fils `tenant` et `owner`.** Alternative : lecture seule pour le comptable.
6. **ClamAV obligatoire en production, pièce bloquée tant que l'analyse n'a pas répondu.** Alternatives : livrer la pièce `unverifiable` avec avertissement ; pas d'antivirus en phase 1.
7. **Retrait d'un message : auteur sous 15 minutes, `owner` ou `admin` (2FA, motif) ensuite, pièces purgées malgré `retentionUntil`.** Alternatives : aucun retrait ; retrait par l'auteur seul.
8. **Accès du support : consentement d'un `owner` ou `admin` (24 h par défaut, 72 h au plus, périmètre fermé, lecture seule, conversations exclues) ; accès d'urgence d'une heure notifié et revu.** Alternatives : sans accès d'urgence ; accès décidé par l'opérateur seul (code actuel).
9. **Retirer l'audience « locataires avec un impayé » et le champ de fusion `Loyer`.** Alternative : les garder (écrans actuels).
10. **Diffusions limitées à l'information de gestion, campagnes hébergées par Notifications.** Alternative : autoriser la prospection avec consentement préalable.
11. **Pièces d'une diffusion : lien vers l'espace pour les comptes, pièce jointe pour les fiches sans compte.** Alternative : pièce jointe pour tous.
12. **Aucun pixel d'ouverture ; « lu » = lecture in_app.** Alternative : pixel avec consentement.
13. **Mailtrap pour les notifications (flux transactionnel) et les diffusions (flux Bulk), par relais SMTP et webhook, deux sous-domaines.** Choix de l'utilisateur ; alternatives écartées : Brevo (recommandé initialement, hébergement UE), Scaleway TEM, Amazon SES.
14. **La contrepartie voit le prénom et le nom du membre de l'équipe qui écrit.** Alternative : seul le nom de l'organisation.
15. **Ordre des lots : conversations (1, 2), support (3, 4), diffusions (5, 7), compléments (6).** Alternative : support d'abord.

## Amendements proposés (non appliqués)

- **ADR 0005** : ligne Messaging « conversations et support, interrogation périodique » ; Messaging → Leases (`LeaseDirectory::visibleToTenant`, `LeaseParticipants`), Parties (`PartyLinks::accountsOf`, `OwnerLinks`, `PartyDirectory`), Mandates (`visibleToOwner`, `ownerScope`, déjà prévu), Documents (`DocumentStore`) ; Messaging → Maintenance (citation d'une intervention, lot 6, si la question est tranchée ainsi) ; Notifications → Properties (`UnitDirectory`, audiences par immeuble), Mandates (déjà prévu), Parties (`PartyDirectory`, contact principal), Documents (`DocumentStore`) ; Messaging ⇢ `ConversationMessagePosted`, `SupportTicketReplied`, `SupportAccessRequested`, `SupportAccessUsed` ⇢ Notifications ; Parties ⇢ `PartyAnonymized` ⇢ Messaging ; Identity ⇢ `AccountDeleted` ⇢ Messaging. Aucun cycle : Messaging n'appelle pas Notifications, aucun des modules lus n'appelle Messaging.
- **ADR 0024** : section « Messagerie » remplacée : échanges locataire ↔ organisation par l'ADR 0033 ; `space = tenant` du support vérifié.
- **ADR 0029** : décision 8 : conversations autorisées (ADR 0033) ; la chronologie reste le registre de l'intervention ; citation d'une intervention dans un fil au lot 6 ; « aucun module n'appelle Maintenance » levé pour cette lecture si elle est retenue.
- **ADR 0032** : décision 4.5 et section 9 : `owner_threads` devient `conversations.kind = owner`, routes `/owner/conversations…` ; règle de grâce inchangée.
- **ADR 0027** : audience `account`, types de la décision 7, clé coalescente par fil, types `support.access_*` non désactivables (exception à « l'e-mail n'est jamais obligatoire », comme `owner.account_change_*`) ; transport SMTP du fournisseur retenu.
- **ADR 0019** : événement `PartyAnonymized`.
- **ADR 0016** : actions de la décision 13 ; la rétention du journal reste à fixer.
- **ADR 0003** : console : lecture des données d'une organisation sous `support-access:{périmètre}` seulement.
- **Documents (ADR 0029, ajouts hors Maintenance)** : `scan_status`, `MalwareScanner`, purge anticipée d'une pièce retirée.

## Amendement du 2026-11-19 (lot 1, revue de sécurité)

Corrige la décision 12 et précise les décisions 4, 5, 6, 7 et 14 du lot 1. Aucune route ni forme de réponse ne change ; les seuls ajouts visibles des fronts sont trois types de notification (liste des préférences) et deux codes d'erreur.

- **Anonymisation d'une fiche : les pièces de la contrepartie sont purgées tout de suite, pas à `retentionUntil`.** La décision 12 (pièces « suivent leur `retentionUntil` ») contredisait l'amendement de l'ADR 0019 (« purge ses pièces »). Retenu : la purge immédiate, parce que l'anonymisation répond à une demande d'effacement (RGPD, art. 17) et qu'une pièce de messagerie n'est pas un document à conservation légale (catégorie `supporting`, sujet `conversation_message`). La conservation légale reste portée par les documents émis, les baux et les certificats : `DocumentStore::purgeEarly` ne purge plus que les justificatifs sans objet légal et les pièces de messagerie, tout autre fichier est refusé (`early_purge_refused`, 409). Sont aussi effacés : le texte des messages de la contrepartie, le sujet d'un fil qu'elle a ouvert (`[effacé]`) et le motif de restriction. Le texte de l'équipe reste, comme avant. Le journal ne reçoit ni texte, ni sujet, ni motif.
- **Effacement en file, avec reprises et rattrapage** (ADR 0007, par analogie : donnée à effacer, pas d'argent). L'écouteur de `PartyAnonymized` est en file (5 essais, attente croissante) ; la commande `messaging:erase-anonymized-parties`, planifiée chaque jour à 03:25, rattrape un événement perdu ; l'opération est idempotente et verrouille les fils avant de lire les messages.
- **Retrait d'un message par l'organisation : l'auteur est prévenu.** Événement `Messaging\Events\ConversationMessageRedacted` (après commit, sans texte ni motif), émis seulement quand le retrait ne vient pas de l'auteur. Types `messaging.message_redacted` (audience `staff`, le seul auteur, s'il lit encore ces notifications), `tenant.message_redacted` et `owner.message_redacted` (le seul compte auteur, tant que le bail ou le mandat est lisible) ; défaut in_app et e-mail ; clé d'idempotence `conversation:{id}:redacted:{message}` ; lien vers le fil ; gabarit « Un administrateur de l'organisation a retiré l'un de vos messages », sans le texte ni le motif (le motif reste dans le dossier de l'organisation).
- **Boîte interne** : `Inbox` ne lit que `conversations.kind = internal`. Un ancien gestionnaire devenu comptable ne retrouve plus un fil externe par sa participation.
- **Pièces de messagerie** : rattachées au message (`conversation_message`), jamais servies par `/documents/files/{id}/download` (404) ; nom affiché dont l'extension suit le type détecté (`x.html` contenant un PDF devient `x.pdf`) ; quota de 30 pièces par jour et par compte sérialisé par verrou applicatif (`OperationLocks`).
- **Ouverture d'un fil par la contrepartie** : sérialisée par fiche (verrou), dédoublonnée par `conversations.client_id` avec unicité `(created_by_user_id, client_id)` ; limite de 10 fils ouverts par fiche tenue sous le même verrou ; un verrou non obtenu en 3 secondes répond `conversation_busy` (409, à rejouer), une impasse MySQL rejoue la transaction 3 fois, jamais de 500. Le verrou suppose un cache partagé entre les serveurs d'application (Redis ou base), pas `array` ni `file` sur plusieurs machines. La limite de 10 est une limite par fiche, pas par compte : plusieurs comptes d'une même fiche la partagent.
- **Cohérence des clés** : `CHECK` interdisant `lease_id` sur un fil `owner` et `mandate_id` sur un fil `tenant` (migration `2026_11_19_500000`, non encore appliquée en production).
- **Lecture d'un fil interne** : au plus 200 messages (les plus récents), sans charger l'historique complet ; `ReplyConversationController` charge le fil léger puis la participation une seule fois.
- **Blocage progressif** : le dépôt n'a pas de limiteur progressif ; les ouvertures gardent `throttle` par minute et par heure. Non inventé ici : à décider avec l'ADR 0002 si le besoin se confirme.
- **ADR 0005** : Messaging ⇢ `ConversationMessageRedacted` ⇢ Notifications ; Notifications → Leases (`LeaseDirectory::visibleToTenant`) et Mandates (`MandateDirectory::visibleToOwner`) pour la fenêtre de lecture des destinataires.

## Amendement du 2026-11-19 (lot 3, support serveur)

Précise les décisions 6, 7, 8 et 9. Décisions prises à l'implémentation, hors texte de l'ADR.

- **Profil du support** : `space = marketplace` exige un compte dont l'e-mail est vérifié ; `tenant` et `owner` exigent le profil (`ProfileRegistry`) ; `organization` exige une adhésion active (`organization_not_member`, 422). `organization_id` est refusé hors de l'espace organisation (422).
- **Idempotence** : `client_id` sur l'ouverture (unicité `(requester_user_id, client_id)`) et sur la réponse (`(support_ticket_id, author_user_id, client_id)`) ; rejeu = 200 sur l'objet existant, contenu différent = 409 `idempotency_key_reused`.
- **Réouverture** : une réponse du demandeur sur une demande `resolved` la rouvre pendant 14 jours (au-delà 409 `ticket_resolved`).
- **Anonymat** : le demandeur ne voit jamais l'identité d'un opérateur (« Support eGuardImmo », `id` nul), ni les notes internes ; l'organisation voit « Prénom N. » seulement.
- **Accès** : une demande vivante au plus par demande de support ; l'acceptation ne dépasse ni la durée ni le périmètre demandés ; une demande non traitée expire après 7 jours ; un accès consenti et un accès d'urgence prennent fin à la résolution de la demande ; seul un accès `active` se révoque, rejouable. L'ancienne route `POST /console/support/tickets/{id}/access` (décision de l'opérateur seul) est supprimée ; les accès hérités sont neutralisés (`expired`, sans organisation).
- **Garde** : `support-access:{périmètre}` lit l'organisation dans le paramètre de route `{organization}` ; il répond 403 `support_access_required` que l'organisation existe ou non, journalise le refus, et ne compte une lecture qu'après une réponse 2xx. Routes de lecture créées au lot 3 : `team` (prénom, nom, rôle) et `settings` (nom, pays, devise). `records` et `documents` n'ont pas de route : un accès les déclarant n'ouvre rien tant qu'elle n'existe pas.
- **Urgence** : fondement `security_incident` ou `legal_requisition`, 1 heure, `settings` et `team`, un seul accès d'urgence vivant par demande ; la première lecture d'un accès consenti prévient l'organisation (`SupportAccessUsed`), l'urgence la prévient à l'ouverture ; la revue par un second opérateur est rejouable, refusée à l'opérateur qui l'a ouverte (403 `support_access_review_forbidden`).
- **Débits** : ouverture 5 par heure et 20 par jour et par compte (10 par minute auparavant), réponse 30 par minute, lecture 60 par minute, interrogation 120 par minute, demande d'accès 20 par heure, urgence 5 par heure, décision d'organisation 10 par heure.
- **Planification** : `messaging:resolve-stale-tickets` (03:15, quotidienne) et `messaging:expire-support-access` (horaire).
- **Notifications** : les préférences de tout compte listent désormais `account.support_replied` ; owner et admin voient en plus les trois types `support.access_*`.
- **Variables** : `SUPPORT_HOURS`, `SUPPORT_TIMEZONE`, `SUPPORT_RESPONSE_LABEL`, `NOTIFICATIONS_ACCOUNT_URL`.

## Amendement du 2026-11-19 (lot 3, revue de sécurité)

Corrige la décision 9 et précise les décisions 6, 8 et 14. Aucune route ni forme de réponse ne change : seuls s'ajoutent `has_more` au détail d'une demande, `meta` et `links` à la liste du demandeur, et six codes d'erreur.

- **Journal d'activité (`/console/activity`)** : une entrée qui porte une `organization_id` (qu'on filtre par organisation ou non) n'est servie en entier qu'à l'opérateur qui a un accès de support **vivant** sur cette organisation, périmètre `settings` (le plus restreint cohérent : le journal d'une organisation décrit ses réglages et son équipe). Sinon elle est **expurgée** : action, date, organisation, type du sujet, `request_id` et route restent ; `changes`, `metadata`, identifiant du sujet, identité de l'auteur (nom, e-mail, il ne reste que son identifiant) et origine (`ip`, `user_agent`) sont nuls. Une entrée sans organisation (plateforme) est servie comme avant. « Vivant » est évalué à chaque requête par le garde de la décision 9 (accès actif, non échu, demande non résolue, opérateur et organisation de l'accès) : expiré, révoqué ou demande résolue, l'entrée redevient expurgée. Le journal du détail n'est pas compté dans `read_count` : la consultation reste tracée par `console.activity.listed|viewed`. Le module Identity ne dépend pas de Messaging : la règle est enregistrée par Messaging dans `App\Shared\Audit\ActivityDisclosure`, et refuse tout tant qu'elle n'est pas enregistrée.
- **Urgence** : (1) un opérateur ne rouvre pas d'urgence sur une organisation tant que sa précédente n'a pas été revue par un second opérateur (409 `support_emergency_review_pending`) ; (2) une seule urgence vivante par organisation, quelle que soit la demande (409 `support_emergency_organization_busy`) ; (3) aucune urgence pendant `SUPPORT_EMERGENCY_COOLDOWN_HOURS` (24 par défaut) après qu'une urgence de l'organisation a été révoquée par elle (429 `support_emergency_cooldown`, `Retry-After`) ; (4) 3 urgences au plus par organisation et par 24 h glissantes (429 `support_emergency_limit`, `Retry-After`). Les freins se vérifient sous un verrou par organisation (`OperationLocks`). La révocation d'un accès consenti ne déclenche pas le délai. Refus et révocation restent sans 2FA : ils ne font que restreindre.
- **Demande d'accès périmée** : l'acceptation et le refus jugent eux-mêmes le délai de 7 jours (`requested_at`), sans dépendre de la tâche horaire. Un périmètre d'acceptation vide (`scopes: []`) est refusé (422) : il n'élargit jamais l'accès.
- **Résolution automatique** : le délai de 7 jours court depuis le passage à `waiting` (colonne `waiting_since`, posée par le passage, conservée par une relance, effacée dès que la demande quitte `waiting`) et non plus depuis le dernier message. Corrige le docblock qui disait l'inverse.
- **Rejeu** : le même `client_id` avec un contenu différent répond 409 `idempotency_key_reused`, y compris pour la visibilité (note interne ou non), les pièces (noms et tailles) et l'organisation d'une ouverture.
- **Notes internes** : une note ne touche ni `last_activity_at` ni `support_last_read_at`, servis au demandeur. `UpdateSupportTicket` relit la demande sous verrou.
- **Journal** : `subject` et `organization_name` d'une demande sont exclus de `audit_logs` (`auditExcluded`).
- **Lectures bornées** : le fil d'une demande servi au détail se limite aux 200 derniers messages (`has_more`, `message_count` reste le total) ; la liste du demandeur se pagine par curseur (`per_page` 100 par défaut, `meta.next_cursor`).
- **Base** : trois CHECK sur `support_access_grants` (migration `2026_11_19_630000`) : `scopes` non vide hors accès neutralisés sans organisation, organisation non nulle pour un accès `requested` ou `active`, `emergency_basis` présent si et seulement si `kind = emergency`. Migration additive `2026_11_19_620000` pour `waiting_since` (les demandes `waiting` existantes prennent `last_activity_at`).
- **Horaires illisibles** : `GET /support/status` répond 503 `support_hours_unavailable` (problem+json) au lieu de 500 ; l'erreur de configuration est journalisée.
- **Variable** : `SUPPORT_EMERGENCY_COOLDOWN_HOURS`.

## Amendement du 2026-11-19 (lots 5 et 6, serveur)

Amendements appliqués : ADR 0005 (liens Notifications → Leases, Properties, Mandates, Parties, Documents ; Messaging → Leases, Mandates), ADR 0027 (types `*.announcement`, transport Mailtrap, désinscription, plafonds), ADR 0016 (actions d'audit des diffusions, de l'antivirus et des purges).

Décisions hors ADR :
- **Annonces** : une diffusion à un compte crée une notification `campaign:{id}` ; routes `GET /tenant/announcements`, `GET /owner/announcements` (+ `/{campaign}`, `POST /{campaign}/read`, pièces), lues sous l'organisation émettrice. « Lu » = `read_at` de la notification, reporté sur `campaign_deliveries.read_at`.
- **Pièces de diffusion** : stockées dans Documents sans sujet (catégorie `supporting`, conservation 3 ans), seule forme que `purgeEarly` autorise ; jointes à l'e-mail pour une fiche sans compte, par lien vers l'espace pour un compte.
- **Désinscription** : le `GET` n'a aucun effet (les prévisualiseurs d'e-mail suivent les liens), le `POST` désinscrit.
- **Programmation sans fournisseur** : permise ; seul l'envoi répond 503 `campaign_sending_disabled`, et une diffusion programmée reste en l'état tant qu'il manque.
- **Antivirus** : `scan_status` `pending|clean|infected|unverifiable` sur `stored_files` ; seules les catégories déposées par un tiers (`supporting`, `certificate`) sont analysées, un document émis est `clean`. Un fichier non `clean` répond 409 `attachment_not_ready` (en attente ou non vérifiable) ou 410 `attachment_infected` à la lecture, et bloque l'envoi d'une diffusion (409 `campaign_attachment_not_ready`). Infecté : contenu supprimé du disque, ligne gardée. `documents:rescan-unverifiable` (horaire) relance les fichiers non vérifiables et ceux en attente depuis plus de 15 minutes. Pilote par `DOCUMENTS_MALWARE_SCANNER` (`none` par défaut, `clamd`, `fake`).
- **Purge** : `messaging:purge` (quotidienne) efface les corps (`[effacé]`) et les pièces, garde lignes, dates, auteurs et objets, pose `content_purged_at`. Fil locataire : 5 ans après la plus tardive de la fin du bail et du dernier message (bail sans fin : jamais) ; fil mandant : idem avec la fin du mandat quand `mandate_id` est renseigné, sinon dernier message seul ; fil interne : dernier message. Demande de support : pièces 1 an et textes 3 ans après `resolved_at` (une demande rouverte n'est pas purgée).
- **Variables** : `DOCUMENTS_MALWARE_SCANNER`, `DOCUMENTS_CLAMD_SOCKET`, `DOCUMENTS_CLAMD_TIMEOUT`.

## Amendement du 2026-11-19 (lots 5 et 6, revue de sécurité)

Décisions modifiées ou ajoutées :
- **Antivirus obligatoire en production** : `DOCUMENTS_MALWARE_SCANNER` doit valoir `clamd` ; le démarrage échoue sinon (`none` et `fake` refusés en production), et toute valeur inconnue lève au lieu de retomber sur `none`. Les commandes de construction d'image (`package:discover`, `config:cache`, `optimize`, `route:cache`, `view:cache`, `event:cache`, `key:generate`) n'effectuent pas ce contrôle.
- **Pièces historiques** : les pièces `supporting` et `certificate` marquées `clean` par la migration d'introduction de l'antivirus (sans analyse, `scanned_at` nul) sont réanalysées par `documents:rescan-unverifiable`, par lots, en rotation équitable (`scan_attempted_at`). Un analyseur injoignable ne change pas leur état. Au-delà de `DOCUMENTS_UNVERIFIABLE_ALERT_THRESHOLD` (20) fichiers non vérifiables, la tâche journalise une erreur.
- **Pièces à `path` (support et fils d'avant l'ADR 0033)** : elles ne passent pas par le stockage probant ; Messaging les fait analyser à la première lecture (`Documents\PublicApi\AttachmentScanner`, `scan_status` et `scanned_at` sur `support_attachments` et `conversation_attachments`, défaut `pending`). Seule une pièce `clean` se sert ; infectée : 410 et fichier supprimé ; analyseur injoignable : 409, état `unverifiable` conservé. Sans analyseur actif (développement), aucune analyse et rien n'est persisté. Choix retenu à la place d'un transfert vers `DocumentStore` : aucune migration de contenu, aucun changement de route.
- **Expéditeur revérifié** : au démarrage, manuel ou par `notifications:dispatch-campaigns`, l'auteur de l'envoi doit être membre actif, de rôle autorisé et avoir une 2FA confirmée (403 `campaign_sender_not_allowed`). Une diffusion programmée dont l'auteur a perdu ce droit reste `scheduled` ; une seule ligne d'audit par jour, sans donnée personnelle.
- **Purge des diffusions** : les adresses des envois sont purgées en premier, par organisation, chaque purge isolée ; les pièces utilisent `purgeEarly` (une pièce ajoutée après la création de la diffusion ne bloque plus la purge) ; la commande retourne un code d'échec si une purge a échoué.
- **Purge des fils** : seul le code `lease_not_found` vaut « bail absent » (dernier message seul) ; toute autre erreur du module Leases fait sauter le fil, retenté au passage suivant.
- **Désinscription** : limite par jeton (30 par minute) et par IP (600 par minute) au lieu de 20 par minute par IP ; la désinscription et le webhook sont exemptés du limiteur global `api` (60 par minute par IP).
- **Quota** : le verrou de réservation dure 120 s et l'écriture du quota vérifie qu'elle le détient encore (503 `campaign_quota_reached` sinon).
- **Journal** : le message brut du transport d'e-mail n'est plus signalé (il contient l'adresse du destinataire) ; seule la classe de l'exception est journalisée.
- **Test d'envoi** : limite horaire lue dans `CAMPAIGN_HOURLY_TESTS` par le limiteur nommé `org-campaigns-test`.
- **`Reply-To` non retenu** : l'organisation n'a pas d'adresse de contact dédiée dans le modèle de données, et publier l'adresse d'un membre divulguerait une donnée personnelle. À rouvrir avec une adresse de contact d'organisation validée.

## Amendement du 2026-11-20 (ADR 0040)

- Un fichier n'est partagé au mandant (`mandate_documents`) ou déposé comme avenant signé que si son analyse antivirus est `clean` (409 `document_not_clean` sinon) ; la bibliothèque (`library_documents`) applique `ScanGate` au téléchargement.

## Amendement du 2026-11-21 (ADR 0037)

- Le périmètre `settings` d'un accès de support ne contient ni plan ni modules (données de plateforme, lues par la console Subscriptions). La console liste les accès par organisation : `GET /console/organizations/{organization}/support-accesses` (motif masqué à `billing` et `engineering`).

## Amendement du 2026-11-25 (ADR 0042)

- La plateforme émet ses propres campagnes (e-mail et push), sans organisation, avec désinscription par préférence de compte et liste d'opposition de plateforme ; les diffusions des organisations sont inchangées.
