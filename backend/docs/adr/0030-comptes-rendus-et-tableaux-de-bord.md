# ADR 0030 — Comptes rendus de gestion, relevés mandants et tableaux de bord (module Reporting)

Statut : accepté (2026-11-18), validé par l'utilisateur tel que proposé. Spécifie le module Reporting de l'ADR 0005 et amende sa règle « lecture seule » (décision 1). Complète l'ADR 0003 (espaces), l'ADR 0006 (cloisonnement), l'ADR 0007 (grand livre seule source des soldes), l'ADR 0008 (juridictions), l'ADR 0011 (normes), l'ADR 0016 (journal), l'ADR 0017 (intégrité), l'ADR 0019 (mandant = partie), l'ADR 0022 (instantané), l'ADR 0023 (recouvrement), l'ADR 0024 (rattachement d'un compte à une partie), l'ADR 0025 (mandats et honoraires), l'ADR 0026 (loyers), l'ADR 0027 (notifications), l'ADR 0028 (factures) et l'ADR 0029 (maintenance). Les obligations légales citées viennent de sources secondaires : **à confirmer** sur Légifrance, et avec un expert-comptable ou un juriste, avant l'implémentation (ADR 0011).
Amendement accepté (2026-11-18, ADR 0031) : table de la décision 2 précisée (pas de `owner_allocation`), résolution du mandant par `party_id`, publication réservée aux périodes closes, `LedgerAggregates` étendu (`ownerFunds`, `collections`, `periods`, `firstOpenDay`, `isClosed`, `trustCoverage`) ; le relevé des mouvements s'appelle `collections` et non `movements`.
Amendement accepté (2026-11-19, lots 1 et 2 livrés côté backend) : routes `management-reports` et `home/*`, `finance/aging` sous `/api/v1/org/{organization}/reporting`. Écarts assumés par rapport au texte : `export_too_large` livré ; le relevé mandant est en JSON et CSV (le PDF du relevé est reporté) ; la notification au propriétaire et `meta.due` côté espace propriétaire attendent le lot 3 ; les réglages `reporting.default_period_kind` et `reporting.publication_day` ne sont pas encore des réglages d'organisation (mensuel, `reporting:flag-due` quotidien) ; `finance/overview` et `balances` sont reportés ; la carte d'alertes renvoie les identifiants des mandants à produire (les noms viennent de `meta.due` de la liste) pour tenir 8 requêtes. Un règlement d'honoraires prélevé sur le compte du mandant est une écriture `payment` qui débite `OwnerPayable` : le compte rendu le classe en honoraires (et TVA) par son sens, sans lire d'autre table.
Amendement accepté (2026-11-19, ADR 0032, lot 1) : décision 7 précisée : la fenêtre d'accès est calculée par `MandateDirectory::visibleToOwner()` : sans limite tant qu'un mandat est `active` ou `suspended`, sinon jusqu'à 12 mois après le dernier jour du dernier mandat `terminated` ou `expired` (`ends_on` exclu moins un jour, même règle que `GracePeriod::until`, testée autour du 29 février) ; brouillons et mandats archivés ignorés ; la grâce est en lecture seule ; ajout de `GET /owner/payouts` et de l'accueil par agence ; le lot 3 de cet ADR dépend du lot 1 de l'ADR 0032, livré.
Amendement accepté (2026-11-19, ADR 0034) : natures de ligne de compte rendu `expense` (dépense payée pour le compte du mandant) et `charge_credit` (crédit de régularisation) ; bilan et analytique par catégorie par `LedgerAggregates::itemTotals` ; écrans « Dépenses » et « Régularisation » classés vers Charges ; « Prêts » inchangé.

## Contexte

L'ADR 0005 réserve à Reporting « tableaux de bord et exports, lecture seule ». Les écrans existent avec des données de démonstration, sans API :
- **Agence** (`apps/agence`) : accueil (loyers encaissés sur appelés, honoraires, reversements en attente, impayés, conformité, mandats à renouveler), comptes rendus (`features/comptes-rendus` : liste par période, génération par mandant, aperçu PDF, états `a_generer`, `brouillon`, `genere`, `publie`, suivi de lecture), honoraires et barème, reversements par lot, devis à soumettre.
- **Espace propriétaire, mode confié** (`apps/proprietaire`, `/confie`) : accueil, comptes rendus lisibles, loyers par mois et par lot, reversements, devis à valider, fiscalité 2044, documents.
- **Bailleur autonome** (`apps/proprietaire`, `packages/gestion`) : accueil, bilan par régime, prêts, import bancaire, régularisation de charges, dépenses, acomptes, analytique, catalogue de rapports.
- `apps/agence/src/espace/capabilities.ts` ferme aujourd'hui les familles `accueil`, `finances`, `comptesRendus` et `devis` (`familyHasApiSource: false`) ; `/finances/loyers`, `/finances/recouvrement`, `/finances/factures`, `/finances/impayes` et `/interventions` sont réels.

Ce que la démonstration ne tient pas :
- les chiffres d'un compte rendu sont **recalculés dans le navigateur** (`compose.ts` : honoraires = taux × appelé, loyer « encaissé » = appelé) ; le serveur doit tout recalculer (CLAUDE.md, ADR 0028) ;
- un compte rendu « publié » n'est pas figé : rien ne prouve ce que le mandant a reçu (ADR 0022) ;
- **le grand livre ne porte pas les fonds des mandants.** Constaté dans le code : `Rent\Support\Settlement::postIssue` crédite `RentRevenue` et `ChargesRecovered` (produits de l'organisation) ; `OwnerPayable` n'est débité que par Maintenance (`supplier_allocation`) et jamais crédité ; aucun module ne calcule ni ne passe les honoraires de gestion (ADR 0028 : « honoraires calculés depuis le compte rendu de gestion » reste à faire) ; aucun module ne porte les reversements. Un compte rendu qui affiche « loyers encaissés, honoraires, reversement » ne peut donc pas se lire au grand livre aujourd'hui.

Déjà en place : `Accounting\PublicApi\{Ledger, LedgerReader}` (soldes, `leaseStatement`), journal_lines avec `lease_id`, `party_id`, `unit_id`, `item` ; `Mandates\PublicApi\MandateDirectory::coveringUnits` ; `Documents\PublicApi\IssuedDocuments` ; `Shared\Pdf\GotenbergRenderer` ; `Identity\Enums\Space::Owner` ; `Properties\PublicApi\OwnershipDirectory`.

## Décision

### 1. Frontière de Reporting (amende l'ADR 0005)

- **Lecture** : Reporting lit les tables des autres modules en SQL (query builder, jamais leurs modèles), pour les **faits** seulement : comptes, dates, statuts, identifiants, libellés (baux actifs, lots vacants, mandats à renouveler, interventions ouvertes, pièces à échéance, dossiers de recouvrement).
- **Aucun montant ne vient d'une table d'un autre module et Reporting n'interroge jamais `journal_entries`, `journal_lines` ni `accounts`.** Tout montant (appelé, encaissé, reste dû, honoraires, solde du compte mandant) passe par la PublicApi d'Accounting (décision 3). C'est la lecture littérale de l'ADR 0007 : aucun solde à côté du grand livre.
- **Écriture** : Reporting **n'écrit jamais dans la table d'un autre module ni au grand livre**. Il possède ses propres tables (`management_reports`, `management_report_lines`, `management_report_sequences`, `reporting_mandant_locks`) pour les comptes rendus émis, comme Rent possède ses avis et quittances. Cet amendement remplace « n'écrit jamais » de l'ADR 0005 par « n'écrit jamais hors de ses tables ». Alternatives en décision à valider n° 1.
- **Cloisonnement** (ADR 0006) : toute lecture SQL passe par `Reporting\Support\Reading::table()`, qui ajoute `organization_id` depuis `CurrentOrganization` et lève une exception sans contexte (refus par défaut, comme le scope `BelongsToOrganization`). Les lectures inter-organisations de l'espace propriétaire sont dans `Queries/` avec `AcrossOrganizations`.
- **Garde-fous automatiques** (`ArchTest.php`) : pas d'import de modèle d'un autre module ; pas de `insert`, `update`, `delete` ni `DB::statement` hors `Support/Own` ; aucune référence aux tables `journal_*` ni `accounts` ; test de **contrat de schéma** (`ReportingSchemaContractTest`) qui vérifie l'existence des tables et colonnes lues dans les autres modules, pour qu'un renommage casse un test et non un écran.

### 2. Prérequis : la comptabilité des mandants (ADR 0031, à écrire)

Un compte rendu ne se calcule que sur le grand livre. Il faut donc, **avant le lot 2** (décision 14), un ADR 0031 « Fonds des mandants, honoraires de gestion et reversements » (module Accounting, avec Rent, Invoicing et Mandates) qui fixe :
- l'imputation de l'encaissement d'un lot sous mandat actif au compte `OwnerPayable` (partie = mandant, `unit_id`, `lease_id`) à la place de `RentRevenue` côté agence (`Rent\Support\Settlement` en dépend) ; un bailleur autonome garde `RentRevenue` ;
- le calcul et l'écriture des honoraires de gestion depuis `mandate_terms` (pourcentage ou forfait, TVA par `InvoiceTaxRules`), puis leur facture (ADR 0028) ;
- les reversements (lot de virements, blocage d'un mandant, exécution) et leurs écritures `OwnerPayable` → `Bank` ;
- les types de source nouveaux (`owner_allocation`, `management_fee`, `owner_payout`) et la **clôture mensuelle** (une écriture datée d'une période clôturée est refusée, sinon un compte rendu publié change après coup).

Ce que le compte rendu lit, et l'état de chaque flux :

| Ligne du compte rendu | Lecture au grand livre | État |
|---|---|---|
| Loyers et charges appelés, par lot et par mois | débit `TenantReceivable`, source `installment`, par `unit_id` | existe (ADR 0026) |
| Loyers et charges encaissés, par lot | crédit `TenantReceivable`, source `payment`, par `unit_id` ; avances (sans lot) sur une ligne par bail | existe (ADR 0026) |
| Fonds du mandant (créance du mandant sur l'agence) | crédit `OwnerPayable` (mandant, lot) | ADR 0031 |
| Honoraires HT et TVA | débit `OwnerPayable`, crédit `FeeRevenue` et `VatCollected` | ADR 0031 (facture : ADR 0028) |
| Travaux imputés au mandant | débit `OwnerPayable`, source `supplier_allocation` | existe (ADR 0029) |
| Reversements | débit `OwnerPayable`, crédit `Bank` | ADR 0031 |
| Impayés en cours | reste dû `TenantReceivable` par bail (`outstandingMany`), dossiers de recouvrement (fait SQL) | existe (ADR 0023, 0026) |

Tant que l'ADR 0031 n'est pas accepté et livré, **aucun compte rendu n'est généré** (pas de mode « déclaratif » calculé hors grand livre). Les tableaux de bord et le relevé de compte mandant se limitent aux flux qui existent.

### 3. Soldes : une PublicApi d'agrégats dans Accounting

- Accounting ajoute `PublicApi/LedgerAggregates` (DTO, jamais de modèle), séparée de `LedgerReader` pour ne pas la grossir :
  - `movements` : totaux par compte, type de source, lot, partie et mois sur une période, filtrés par lots ou parties (une requête, `GROUP BY` côté SQL) ;
  - `balances` : soldes à une date par lot ou par partie, pour un compte ;
  - `outstandingAging` : reste dû des créances par tranche d'ancienneté (0-30, 31-60, 61-90, plus de 90 jours) ;
  - `partyStatement` : relevé d'un compte mandant (ouverture, lignes, clôture), plafonné à `RELEVE_LIGNES_MAX` lignes (`statement_too_long`, comme `leaseStatement`) ;
  - `version` : jeton de version du grand livre (dernier numéro d'écriture par exercice, lu dans `journal_entry_counters`), pour le cache (décision 13) et le point de coupure d'un compte rendu.
- Bornes en **intervalle semi-ouvert** (`entry_date >= début AND < fin + 1 jour`), devise fixée par l'organisation, `Money` en unités mineures, jamais de `float`.
- **Reproductibilité** : l'instantané d'un compte rendu enregistre `ledger_cutoff` (dernier numéro d'écriture par exercice au moment du calcul). `reporting:verify` recalcule les comptes rendus publiés avec cette coupure et signale un écart (anomalie journalisée, rien n'est corrigé).
- **Lot → mandant** : les lignes de loyer portent le locataire en `party_id` ; le mandant se résout par le lot et la date, par `MandateDirectory::coveringUnits` (deux requêtes pour tous les lots, ADR 0025). Un lot qui change de mandant en cours de période se coupe à la date de bascule. Un lot sans mandat couvrant est signalé (`unmapped`), jamais attribué par défaut.

### 4. Le compte rendu de gestion (CRG)

- **Un document par mandant et par période** (`mensuel`, `trimestriel`, `personnalise` de 12 mois au plus), qui regroupe tous les mandats et tous les lots du mandant ; la ligne de chaque lot porte la référence de son mandat. Alternative : un par mandat (décision à valider n° 4).
- **Cycle de vie** : `draft` (paramètres saisis, aucun chiffre) → `generated` (chiffres calculés, aperçu, régénérable) → `published` (numéro, figé, PDF scellé, visible du mandant) ; sorties : `superseded` (remplacé par un rectificatif) et `discarded` (brouillon abandonné). L'état « à générer » de l'écran est une ligne virtuelle calculée (mandats couvrant la période sans compte rendu vivant), jamais une ligne en base.
- **Contenu** (clés `rent`, `fees`, `payout`, `arrears`, `works`, `receipts` ; l'écran dit `loyers`, `honoraires`, `reversement`, `impayes`, `travaux`, `quittances`) : loyers et charges appelés et encaissés par lot ; honoraires HT, TVA et taux du mandat en vigueur ; compte du mandant (solde d'ouverture, mouvements, solde de clôture, reversements avec dates) ; impayés et procédures en cours ; travaux imputés avec leur référence d'intervention ; liste des quittances émises. L'option « quittances jointes » (assemblage des PDF) est reportée (classement ci-dessous) ; la liste des références est livrée.
- **Mentions et périodicité** : portées par le contrat `Jurisdictions/ManagementReportRules` (ADR 0008), implémentation `Fr` seule. Sources secondaires, à confirmer : Code civil art. 1993 (le mandataire rend compte de sa gestion) ; loi n° 70-9 du 2 janvier 1970 (loi Hoguet) et décret n° 72-678 du 20 juillet 1972 (le mandat de gestion fixe les modalités de reddition de compte ; périodicité minimale annuelle souvent citée ; comptabilité tenue par mandant ; conservation de dix ans). Le défaut d'organisation est mensuel, le minimum annuel est contrôlé (décision 8). Autre juridiction : 422 `reporting_jurisdiction_unsupported`.
- **Instantané** (ADR 0022) : émetteur (raison sociale, adresse, SIREN, carte professionnelle, garantie financière, lus par `OrganizationDirectory::legalIdentity`), mandant (nom, adresse), mandats et conditions du jour, lots (référence, adresse, type), locataire par lot (nom seulement), IBAN de reversement masqué (quatre derniers caractères), mentions, version de modèle `CRG-1`, `ledger_cutoff`. Aucune fiche n'est relue après la publication.
- **Rectificatif** : un compte rendu publié ne se modifie jamais. Une erreur ou une écriture tardive produit un nouveau compte rendu `rectificatif` (`supersedes_id`, motif obligatoire) qui passe l'ancien en `superseded` et le cite ; le mandant voit les deux.

### 5. Relevé de compte mandant

Lecture à la demande, non figée, non numérotée : mouvements du compte `OwnerPayable` du mandant sur une période (ouverture, lignes avec référence de pièce, clôture), par `partyStatement`. Export CSV, et PDF marqué « Extrait au {date}, sans valeur de compte rendu » par le même modèle. Il dépend de l'ADR 0031 pour être utile ; avant, il n'existe pas.

### 6. Tableaux de bord

Une route par carte, pour qu'une panne ne soit jamais avalée par une réponse « partielle » (CLAUDE.md : pas de fallback silencieux) ; l'écran gère l'erreur carte par carte.
- **Accueil agence** : loyers appelés et encaissés du mois ; honoraires du mois (dès l'ADR 0031) ; reversements en attente (soldes `OwnerPayable`, dès l'ADR 0031) ; impayés par ancienneté ; comptes rendus à générer ; mandats à renouveler, pièces de conformité à renouveler (faits SQL).
- **Accueil bailleur autonome** (organisation `individual`) : loyers du mois, impayés, baux arrivant à échéance, lots vacants, interventions ouvertes, conformité.
- **Accueil propriétaire** (`/owner`) : dernier compte rendu publié, solde du compte mandant et prochain reversement (dès l'ADR 0031), lots occupés et vacants, nombre de devis à décider (fait lu en SQL).
- **Vue d'ensemble financière / bilan** : recettes et charges par mois et par lot, lues par `movements`. La catégorie de dépense n'est pas une dimension du grand livre aujourd'hui : le bilan par catégorie attend l'ADR « Dépenses » d'Accounting (lot 4). La simulation de régime fiscal (micro-foncier, réel) relève de Tax.

### 7. Routes par espace

**Organisation** : `/api/v1/org/{organization}/reporting/…` (middleware de l'espace organisation, noms `reporting.*`, `auth:sanctum`, `no-operator-token`) :
- accueil : `GET home/agency-kpis`, `home/agency-payouts`, `home/agency-alerts`, `home/landlord`, `finance/aging`, `finance/overview?from&to` ;
- comptes rendus : `GET management-reports` (période, mandant, état, curseur ; lignes `due` virtuelles comprises), `POST management-reports` (brouillons ou génération pour 50 mandants au plus : une transaction par mandant, résultat par mandant, clé d'idempotence obligatoire), `GET management-reports/{report}`, `PATCH management-reports/{report}` (contenu, options, `lock_version`, tant que non publié), `POST …/generate`, `POST …/publish` (immédiat ou à `scheduled_for`), `POST …/rectify`, `POST …/discard`, `GET …/pdf`, `GET …/lines.csv` ;
- `GET mandants/{mandant}/statement?from&to` (JSON, CSV, PDF) ;
- exports (lot 3) : `GET exports/{type}` en CSV, avec `type` parmi `rent-called`, `rent-collected`, `unpaid`, `tenant-balances`, `rent-roll`, `expenses-by-unit` ;
- ressources : `Http/Resources/Organization/`, 404 sur l'organisation, le mandant ou le lot d'une autre organisation.

**Propriétaire** : `/api/v1/owner/…` (`space:owner`, lecture seule, livré au lot 3) :
- `GET home`, `GET management-reports`, `GET management-reports/{report}`, `GET management-reports/{report}/pdf`, `POST management-reports/{report}/read` (pose `first_read_at`, idempotent, seule écriture), `GET statement?from&to`, `GET rent/{month}` ;
- **clé de lecture** : le couple (organisation, partie mandant) rattaché au compte par `parties.user_id` (`PartyLinks`, ADR 0024), jamais un identifiant du client ; `Queries/OwnerReports` avec `AcrossOrganizations`, résolution par organisation une seule fois ; seul un compte rendu `published` est visible ; un compte rendu hors clé répond 404 `report_not_found`, comme un compte rendu inconnu ;
- le rattachement d'un compte à un mandant (invitation, consentement, profil `owner` dans `ProfileRegistry`) n'est pas décidé ici : il fait l'objet d'un ADR « Espace propriétaire » qui reprend le mécanisme de l'ADR 0024 et décide de la décision sur un devis (seule écriture, ADR 0029). Le lot 3 en dépend ;
- accès : tant que le rattachement vit et jusqu'à 12 mois après la fin du dernier mandat (même durée que la période de grâce du locataire, ADR 0024). Passé ce délai, l'agence conserve les pièces et les fournit sur demande ;
- **Resources propres à l'espace** : aucun identifiant de fiche d'autrui, aucune coordonnée du locataire, jamais la note interne du mandat ni l'identifiant de l'écriture.

**Locataire, SeBook** : aucune route Reporting. **Console** : indicateurs de plateforme hors périmètre (classement ci-dessous).

### 8. Rôles et débits

| Action | Rôles | Débit |
|---|---|---|
| Lecture : accueils, finance, comptes rendus, relevés | propriétaire, administrateur, gestionnaire, comptable | 120/min |
| Créer, modifier, générer, écarter, aperçu PDF | les mêmes quatre | 60/min |
| Publier, planifier, rectifier | propriétaire, administrateur, gestionnaire | 60/min |
| Exports CSV | propriétaire, administrateur, comptable | 10/min par utilisateur |
| Espace propriétaire (lecture, `read`) | compte rattaché au mandant | 60/min |

- Le comptable prépare et vérifie les chiffres, il ne diffuse pas au mandant.
- Une organisation `individual` n'a ni mandant ni compte rendu : 403 `reporting_agency_only` (policy sur le type d'organisation) sur les routes `management-reports`, `statement` et `home/agency-*` ; elle a `home/landlord`, `finance/*` et les exports.
- Codes RFC 9457 dans `Reporting\Enums\ErrorCode` (ADR 0014) : `report_not_found` 404 ; `report_stale_version` 409 ; `report_period_overlap` 409 ; `report_period_invalid` 422 (plus de 12 mois, fin dans le futur, avant le premier mandat) ; `report_not_publishable` 409 ; `report_idempotency_key_reused` 409 ; `report_issuer_incomplete` 422 ; `report_pdf_unavailable` 503 avec `Retry-After` ; `statement_too_long` 422 ; `export_too_large` 422 ; `reporting_agency_only` 403 ; `reporting_jurisdiction_unsupported` 422.
- **Périodicité** : réglages d'organisation `reporting.default_period_kind` (`monthly` par défaut) et `reporting.publication_day` (5 par défaut : jour du mois suivant où un compte rendu `generated` est publié quand la publication est planifiée). `reporting:flag-due` (quotidienne) signale par notification `reporting.reports_due` les mandants sans compte rendu publié couvrant la dernière période échue, et signale un trou de plus de 12 mois (minimum annuel).

### Modèle de données (Reporting, `organization_id` partout, ADR 0017)

- **`management_reports`** :
  - `id` (UUID v7), `organization_id`, `mandant_party_id` (sans clé étrangère SQL) ;
  - `number` (nul avant publication, `CR-AAAA-NNNN`, unique par organisation) ;
  - `period_kind`, `period_start` (inclus) et `period_end` (exclu ; l'API expose `to` inclusif, comme ADR 0025) ;
  - `status` (`draft | generated | published | superseded | discarded`), `currency` ;
  - `content` et `options` (JSON : sections, `receipts_attached`, `letterhead`, `reminder_detail` ; jamais un montant) ;
  - totaux figés à la génération (`collected_total`, `fees_total`, `works_total`, `payout_total`, `opening_balance`, `closing_balance`, `bigint`) : ce sont les montants du document, pas des soldes courants ;
  - `snapshot` (JSON), `ledger_cutoff` (JSON), `fingerprint` (SHA-256), `template_version`, `issued_document_id`, `stored_file_id` ;
  - `supersedes_id` (clé composite `(organization_id, id)`), `rectification_reason` ;
  - `scheduled_for`, `notify`, `generated_at`, `published_at`, `published_by_user_id`, `first_read_at` ;
  - `idempotency_key` (unique par organisation), `lock_version`, `datetimes(6)`.
  - Index : `(organization_id, mandant_party_id, period_start)`, `(organization_id, status, period_start)`.
- **`management_report_lines`** : lignes figées et typées pour les listes, l'export et la vérification.
  - `report_id` (clé composite), `position`, `kind` (`rent_called | rent_collected | advance | fee | fee_vat | works | payout | arrears`), `entry_date`, `unit_id` et `lease_id` et `mandate_id` (sans clé étrangère), `label`, `amount` (`bigint` positif) et `direction` (`credit | debit` du point de vue du mandant), `source_type` et `source_id` (référence de pièce).
  - La somme des lignes est contrôlée contre les totaux à la génération.
- **`management_report_sequences`** : clé `(organization_id, year)`, `ContinuousCounter` sous verrou, numéro pris **à la publication** (un brouillon abandonné ne laisse aucun trou), séparé de la numérotation de Documents.
- **`reporting_mandant_locks`** : une ligne par `(organization_id, mandant_party_id)`, verrou d'ordre (modèle de `mandate_unit_locks`).
- **Invariants** (MySQL sans contrainte d'exclusion, ADR 0017) :
  - un compte rendu vivant (ni `superseded` ni `discarded`) par mandant et par période exacte : colonne générée unique ;
  - **pas de chevauchement de périodes entre comptes rendus publiés d'un même mandant** : l'Action prend `reporting_mandant_locks` `FOR UPDATE`, relit par jointure explicite, refuse en 409 `report_period_overlap` ;
  - continuité : la clôture d'un compte rendu égale l'ouverture du suivant, un trou ou un écart est signalé par `reporting:verify` (journalisé, rien n'est corrigé).
- **Statuts et types** : `Checks::add`, jamais `ENUM`. Montants en entiers, devise `char(3)` de l'organisation.
- **Immutabilité en base** (déclencheurs MySQL, équivalents SQLite) :
  - `management_reports` `BEFORE UPDATE` : refus si `OLD.published_at IS NOT NULL` et qu'une colonne figée change ; restent modifiables `status` (de `published` à `superseded`), `first_read_at`, `lock_version`, `updated_at` ;
  - `BEFORE DELETE` : refus dans tous les cas ;
  - `management_report_lines` : refus d'écriture si le parent est publié.
- Pas de table de totaux précalculés ni de vue matérialisée : ce serait un second solde (ADR 0007).

### 9. PDF et diffusion

- **PDF** : Gotenberg par `App\Shared\Pdf\GotenbergRenderer` (HTML Blade de l'instantané), jamais en PHP. Configuration `REPORTING_GOTENBERG_URL` avec repli sur `RENT_GOTENBERG_URL`, `REPORTING_GOTENBERG_TIMEOUT` plafonné à 15 s. Panne : 503 `report_pdf_unavailable`, **rien n'est écrit** (pas de numéro pris, statut inchangé). Le PDF publié est enregistré dans Documents (`IssuedDocumentType::ManagementReport`, scellement selon l'ADR 0011). L'aperçu d'un compte rendu `generated` est rendu à la demande, filigrané « Projet », non stocké.
- **Téléchargement** : `Cache-Control: private, no-store`, journalisé `reporting.report.downloaded`.
- **Publication** : une transaction (verrou du mandant, contrôle de chevauchement, numéro, PDF, pièce Documents, statut `published`, journal). Rejouable : un compte rendu déjà publié est renvoyé tel quel. La publication planifiée est assurée par `reporting:publish-scheduled` (horaire), un compte rendu par transaction ; un échec de PDF laisse l'état `generated` et le signale, reprise à l'heure suivante (la tâche est elle-même le rattrapage, ADR 0007).
- **Diffusion** : l'espace propriétaire est le canal. À la publication, `ManagementReportPublished` (après commit, ADR 0007) est écouté par Notifications : type `owner.report_published` (nouvelle audience `owner`, visibilité par la clé (organisation, mandant), texte et push génériques, sans montant, ADR 0027), clé d'idempotence `report:{id}`. L'e-mail ne contient qu'un lien `https://` vers l'espace propriétaire, **jamais le PDF ni un lien public à jeton**. Un mandant sans compte reçoit son compte rendu de l'agence hors plateforme (l'agence télécharge le PDF ; le téléchargement est journalisé) ; l'invitation à créer un compte est proposée par l'ADR « Espace propriétaire ». Le suivi de lecture se limite à `first_read_at` ; `unknownReads` de l'écran vaut vrai quand la notification est désactivée ou le mandant non rattaché.
- **Rectificatif** : publié comme un compte rendu ordinaire, il renvoie la même notification avec le motif.

### 10. Performance

- Chaque carte de tableau de bord : au plus 8 requêtes, **indépendantes du nombre de baux, de lots et de mandants** (test de nombre de requêtes, comme l'ADR 0024). Pas de N+1 : agrégats SQL dans Accounting, lots résolus par `coveringUnits`, identités par les `findMany` des PublicApi.
- Génération d'un compte rendu : une lecture `movements` pour tous les lots du mandant, une résolution de couverture, une lecture d'identités ; un lot de 50 mandants se fait mandant par mandant, chacun dans sa transaction, sans PDF avant la publication.
- Index à ajouter dans Accounting (additifs, à valider par `EXPLAIN` sur MySQL 8.4 avec un jeu volumineux) : `journal_lines (organization_id, account_id, unit_id, journal_entry_id)` pour les agrégats par lot ; `journal_entries (organization_id, entry_date, id)` existe déjà. Requêtes avec `ONLY_FULL_GROUP_BY`, jointure `journal_entries` sur `(organization_id, id)`.
- Exports : curseur (`lazyById`), pas de `OFFSET`, 50 000 lignes au plus (`REPORTING_EXPORT_MAX_ROWS`, 422 `export_too_large`), flux sans tampon mémoire.
- Listes : pagination par curseur (`PaginatesWithCursor`).

### 11. Données personnelles (RGPD, ADR 0019)

- Un compte rendu contient le nom du locataire de chaque lot et son retard éventuel : le mandant est le propriétaire du lot, la communication est justifiée ; minimisation : nom seul, aucune coordonnée, aucun identifiant, retards détaillés (relances par locataire) seulement si l'option `reminder_detail` est activée.
- L'anonymisation d'une partie (locataire ou mandant) **ne modifie aucune pièce émise** (instantané, ADR 0019 et 0022) : base légale de conservation comptable, **à faire confirmer par un conseil juridique**. L'espace propriétaire affiche l'instantané tel qu'émis.
- Durée de conservation des comptes rendus et de leur PDF : dix ans, **à confirmer** (obligations comptables et décret du 20 juillet 1972) ; la purge passe par Documents (`retentionUntil`).
- IBAN jamais en clair : quatre derniers caractères seulement. Aucune donnée personnelle ni montant dans `metadata` du journal, dans les notifications ni dans les push.
- L'écran de lecture du mandant n'enregistre que `first_read_at` : pas de suivi de navigation.

### 12. Audit (ADR 0016)

- `ManagementReport` utilise `Auditable` (création, modification avec avant/après). Une Action qui l'écrit ouvre une transaction.
- Actions explicites : `reporting.report.generated`, `.published`, `.rectified`, `.discarded`, `.downloaded`, `reporting.statement.viewed`, `reporting.export.generated` (type et filtres, pas de contenu), `reporting.verify.anomaly`.
- Une écriture de masse (génération par lot) journalise chaque compte rendu individuellement.

### 13. Cache

- **Phase 1 : aucun cache applicatif de valeur financière.** Les requêtes agrégées sont mesurées d'abord.
- Si la mesure l'exige : clé `reporting:{organization}:{carte}:{paramètres}:{ledger_version}` (le jeton de `LedgerAggregates::version` invalide tout à la première écriture), durée de vie 60 s au plus, jamais partagée entre organisations ni entre espaces, **jamais de réponse d'erreur ni de panne en cache** (CLAUDE.md : trois états, une panne n'est pas un résultat). Les faits SQL non comptables (baux, interventions) acceptent le retard de la durée de vie.
- Aucun cache d'un compte rendu publié : il est déjà figé en base.

### 14. Livraison en quatre lots

1. **Socle** : module Reporting, `Reading`, `LedgerAggregates` et ses index, accueil agence et bailleur autonome (flux existants), impayés par ancienneté.
2. **Comptes rendus et relevé mandant** (après l'ADR 0031) : modèle, génération, publication, PDF, rectificatif, notification, `reporting:*`.
3. **Espace propriétaire** (après l'ADR « Espace propriétaire ») : accueil, comptes rendus, relevé, loyers par mois. Exports CSV.
4. **Analytique et bilan par catégorie** (après l'ADR « Dépenses » d'Accounting).

### 15. Classement des écrans

Légende : **R** = couvert par Reporting (lot) ; **M** = couvert par un autre module ; **D** = à reporter.

| Écran | Classe | Couvert par, ou raison |
|---|---|---|
| Accueil agence (`accueil`) | R, lot 1 | cartes de la décision 6 ; honoraires et reversements dès l'ADR 0031 |
| Accueil bailleur autonome (`BureauScreen`) | R, lot 1 | carte `home/landlord` |
| Accueil propriétaire (`/confie`) | R, lot 3 | dépend de l'espace propriétaire |
| Comptes rendus : liste, génération, aperçu (`comptesRendus`) | R, lot 2 | décisions 4 et 9 ; chiffres serveur, plus de `compose.ts` |
| Comptes rendus côté mandant (`/confie/comptes-rendus`) | R, lot 3 | routes `/owner/management-reports` |
| Option « quittances jointes » | D | assemblage de PDF par Gotenberg à décider ; la liste des références est livrée |
| Loyers par mois (`/confie/loyers/[month]`) | R, lot 3 | `/owner/rent/{month}` |
| Reversements, vue mandant (`ReversementScreen`) | R, lot 3 | lecture des reversements ; écriture : ADR 0031 |
| Reversements, lot et blocage (`finances/reversements`) | M | Accounting (ADR 0031) ; Reporting n'en lit que l'état ; virement SEPA : D |
| Honoraires, consultation par période (`finances/honoraires`) | R, lot 2 | lecture des honoraires passés par l'ADR 0031 |
| Barème d'honoraires (`honoraires/bareme`) | M | Mandates (`mandate_terms`, ADR 0025) ; base, minimum, mode de prélèvement, relocation, travaux : amendement de l'ADR 0025 (D) |
| Encaissements, nouvel encaissement (`finances/encaissements`) | M | Rent (ADR 0026, `/finances/loyers/paiements` est déjà réel) ; `a_rapprocher`, `rejete`, `mobile_money`, `carte` : D (Payments, PSP) |
| Acomptes (`encaissements/acompte`) | M | Rent : le surplus est une avance du bail (ADR 0026) ; reçu de paiement partiel : « reste à faire » de l'ADR 0026 ; acompte sur dépôt de garantie et reçu libre : D |
| Devis (agence `/devis`, propriétaire `/interventions/[id]/devis`) | M | Maintenance (ADR 0029, lots 2 et 4) ; rien dans Reporting |
| Dépenses (`finances/depenses/nouvelle`) | M | Accounting (dépenses, ADR 0005, ADR dédié à écrire) ; travaux avec facture : Maintenance (ADR 0029, lot 3) |
| Régularisation de charges (`finances/regularisation`) | M | Accounting (ADR 0005 ; ADR 0028 : « décompte, reste dans Accounting ») ; ADR dédié à écrire |
| Import bancaire (`finances/import-bancaire`) | D | rapprochement bancaire : Payments (ADR 0005) ; import de relevés ou agrégation DSP2 à décider ; écrit au grand livre |
| Prêts (`finances/prets`) | D | aucun module ne porte les prêts ; intérêts d'emprunt attendus par Tax (2044) ; ADR « Patrimoine et financement » |
| Bilan par régime (`finances/bilan`) | R, lot 4 (recettes et charges) | catégories : ADR « Dépenses » ; simulation de régime : D (Tax) |
| Grand livre (`GrandLivrePage`) | M | Accounting, `/accounting/entries` existe |
| Impayés, recouvrement, factures, loyers, interventions (réels) | M | Recovery, Invoicing, Rent, Maintenance ; Reporting n'en lit que les agrégats |
| Analytique : revenus et dépenses, occupation (`analytique`) | R, lot 4 | `movements` et occupations (faits SQL) |
| Analytique : rentabilité, prévisionnel | D | prix d'achat, prêts et hypothèses sans module ; dépend de « Patrimoine et financement » |
| Rapports : loyers appelés ou encaissés, impayés, soldes, état locatif, dépôts, dépenses par bien | R, lot 3 | exports CSV de la décision 7 ; PDF générique et Excel : D |
| Rapports : revenus fonciers, TVA, export comptable | D | Tax (ADR 0005) ; un fichier des écritures comptables officiel exige un plan comptable général, et les rôles d'Accounting n'en sont pas un |
| Rapports : valeur des biens, prêts | D | aucun module |
| Envois planifiés de rapports par e-mail | D | envoi de données à une adresse libre : risque RGPD ; à décider avec Notifications |
| Fiscalité 2044 (`/confie/fiscalite`) | D | Tax (ADR 0005) |
| Documents du propriétaire (`/confie/documents`) | D | lecture par l'espace propriétaire à décider dans l'ADR « Espace propriétaire » |
| Indicateurs de plateforme (console) | D | ADR 0006 les prévoit ; hors périmètre ici |
| Agenda, tâches, journal | D | aucun module dans l'ADR 0005 |

## Options écartées

- **CRG calculé à chaque consultation, sans figement** : une écriture tardive changerait le document déjà remis au mandant ; aucune preuve de ce qui a été envoyé (ADR 0022).
- **CRG « déclaratif » avant l'ADR 0031** (appelé × taux, loyer encaissé = appelé, comme la démonstration) : un second calcul des honoraires et des fonds, hors grand livre (ADR 0007).
- **Reporting lit `journal_lines` en SQL** : permis à la lettre par l'ADR 0005, mais chaque module de lecture réécrirait la règle des soldes (sens normal, contrepassations, TVA différée) ; une seule PublicApi la porte.
- **Table de totaux précalculés ou vue matérialisée** : second solde, divergence silencieuse (ADR 0007).
- **CRG dans Mandates** : il faudrait un lien Mandates → Accounting, Documents et Notifications pour un cycle de vie (génération, publication, lecture) qui n'est pas celui du mandat ; Reporting existe déjà dans l'ADR 0005.
- **Reporting strictement sans écriture** : impose de stocker les comptes rendus ailleurs ; amendement plus petit.
- **Un compte rendu par mandat** : un mandant à deux mandats recevrait deux documents et deux soldes ; l'écran actuel agrège par mandant.
- **Lien public à jeton ou PDF en pièce jointe** (modèle de l'ADR 0023) : données de revenus d'un particulier qui ne se révoquent plus une fois parties ; l'espace propriétaire authentifié suffit.
- **Excel natif (`.xlsx`) et dépendance de tableur** : CSV (UTF-8, séparateur `;`) s'ouvre sous Excel ; chaque cellule commençant par `=`, `+`, `-` ou `@` est préfixée d'une apostrophe (injection de formule).
- **PDF en PHP** : interdit (ADR 0026), Gotenberg seul.
- **Cache applicatif des soldes dès la phase 1** : invalidation non maîtrisée, risque de montants périmés dans un document financier ; mesurer d'abord.
- **Une seule route de tableau de bord qui renvoie des cartes en état « indisponible »** : avale la panne (CLAUDE.md) ; une route par carte.
- **Mode « générique » pour une juridiction sans règles** : contraire à l'ADR 0008.
- **Event sourcing, CQRS ou entrepôt de données** : hors de proportion avec le besoin.

## Conséquences

- **Amendement de l'ADR 0005 (à porter à l'acceptation)** :
  - règle « Reporting » : lecture SQL des faits seulement, soldes par la PublicApi d'Accounting, écriture limitée à ses propres tables ;
  - Reporting → Accounting (`LedgerReader`, `LedgerAggregates`), Mandates (`MandateDirectory`), Parties (`PartyDirectory`, `PartyLinks`), Properties (`UnitDirectory`), Leases (`LeaseDirectory`), Organizations (`MembershipDirectory`, `OrganizationDirectory`), Documents (`IssuedDocuments`, `DocumentStore`), Catalog (`TermDirectory`) ;
  - Reporting ⇢ `ManagementReportPublished` ⇢ Notifications. Aucun module n'appelle Reporting.
- **Amendement de l'ADR 0027** : audience `owner`, types `owner.report_published` et `reporting.reports_due` (staff), clés `report:{id}` et `due:{mandant}:{période}`, gabarits sans montant.
- **Amendement de l'ADR 0003** (à l'acceptation de l'espace propriétaire) : `/owner/management-reports`, lecture seule.
- **Ajouts hors Reporting** : Accounting (`LedgerAggregates`, index `unit_id`, `version`, puis ADR 0031) ; Mandates (`MandateDirectory::coverageDuring`, mandants couvrant une période, pour la liste « à générer ») ; Documents (`IssuedDocumentType::ManagementReport`) ; Organizations (carte professionnelle et garantie financière dans `legalIdentity`, déjà prévues par l'ADR 0011).
- **ADR à écrire** : 0031 (fonds des mandants, honoraires, reversements, clôture mensuelle), « Espace propriétaire » (rattachement, invitation, profil, décision sur devis), « Dépenses et régularisation de charges » (Accounting), « Rapprochement bancaire » (Payments), « Patrimoine et financement » (prêts).
- **Planification** : `reporting:flag-due` (quotidienne), `reporting:publish-scheduled` (horaire), `reporting:verify` (quotidienne).
- **Configuration** : `REPORTING_GOTENBERG_URL`, `REPORTING_GOTENBERG_TIMEOUT`, `REPORTING_EXPORT_MAX_ROWS` (50 000), `REPORTING_BATCH_MAX` (50) ; réglages d'organisation `reporting.default_period_kind` et `reporting.publication_day`.
- **Front** :
  - `compose.ts`, `demo.ts` et les statements calculés côté client disparaissent ; les écrans lisent l'API ;
  - clés de contenu : `loyers`→`rent`, `honoraires`→`fees`, `reversement`→`payout`, `impayes`→`arrears`, `travaux`→`works`, `quittances`→`receipts` ;
  - états `a_generer` (ligne virtuelle), `brouillon`→`draft`, `genere`→`generated`, `publie`→`published`, plus `superseded` ;
  - action « rectifier » avec motif ;
  - `ibanLast4` et `mandateRef` viennent de l'instantané ;
  - `familyHasApiSource.accueil` et `.comptesRendus` passent à vrai quand leurs lots sont livrés ; `finances` reste fermée tant que les écrans non couverts (classement) le sont.
- **Tests attendus** :
  - accès : 401, 403 par rôle (comptable ne publie pas, manager sans export), 404 sur l'organisation, le mandant, le lot ou le compte rendu d'une autre organisation, organisation `individual` refusée sur les routes d'agence, jeton opérateur refusé ;
  - espace propriétaire : 403 sans profil, 404 d'un autre mandant et d'une autre organisation, brouillon et `generated` invisibles, accès à J+12 mois et J+12 mois +1 jour après la fin du dernier mandat, nombre de requêtes constant ;
  - chemin nominal complet : mandat actif, encaissement, imputation, honoraires, travaux, reversement → génération → publication → lecture par le mandant, avec chiffres égaux au grand livre ;
  - soldes : chaque chiffre du compte rendu égale la lecture directe d'Accounting ; lot sans mandat signalé ; changement de mandant en cours de période ; avances ; contrepassation d'un encaissement ;
  - invariants : chevauchement refusé sous concurrence, trou de numéro nul après un brouillon abandonné ou une panne Gotenberg, continuité d'ouverture et de clôture, un seul compte rendu vivant par période ;
  - figement : déclencheurs MySQL (modification et suppression refusées), instantané inchangé après modification ou anonymisation de la partie, rectificatif qui passe l'ancien en `superseded` ;
  - idempotence (rejeu 200, conflit 409), `lock_version`, bornes de dates en intervalle semi-ouvert autour d'une fin de mois et d'une année bissextile, dates figées ;
  - PDF : 503 sans aucune écriture, `Cache-Control: private, no-store`, téléchargement journalisé ;
  - notifications : un cas par type produit par l'événement réel, rejeu sans doublon, texte sans montant ;
  - exports : plafond, préfixe anti-injection de formule, audit ;
  - performance : requêtes constantes par carte et par génération (10, 100 et 1 000 baux) ;
  - architecture : pas d'écriture hors tables propres, pas de référence à `journal_*`, test de contrat de schéma ;
  - `reporting:verify` : écart détecté après une écriture tardive.
- **Reste à faire** : assemblage des quittances jointes ; envois planifiés ; PDF générique et Excel ; dossier de fin de mandat (ZIP de tous les comptes rendus) ; juridictions `Be`, `Lu`, `Ca/Qc` ; indicateurs de plateforme de la console ; export des écritures au format comptable officiel.

## Décisions à valider

Ma recommandation est toujours la première.

1. **Reporting possède ses tables de comptes rendus émis ; son interdit devient « n'écrit jamais hors de ses tables ni au grand livre ».** Alternatives : comptes rendus dans Mandates (nouveau lien vers Accounting, Documents, Notifications), ou nouveau module `Statements`.
2. **Aucun compte rendu avant l'ADR 0031 (fonds des mandants, honoraires, reversements, clôture mensuelle) ; lot 1 de tableaux de bord sans attendre.** Alternative : compte rendu « déclaratif » calculé depuis les échéances et le barème dès maintenant (rapide, mais second calcul hors grand livre).
3. **Tous les montants par `Accounting\PublicApi\LedgerAggregates` ; Reporting ne lit jamais `journal_*` en SQL.** Alternative : lecture SQL directe des lignes d'écriture par Reporting (permise par l'ADR 0005, règles de solde dupliquées).
4. **Un compte rendu par mandant et par période (12 mois au plus), tous mandats confondus.** Alternative : un par mandat, ou une périodicité propre à chaque mandat dès la phase 1 (amendement de l'ADR 0025).
5. **Publié = immuable ; correction par compte rendu rectificatif motivé qui remplace l'ancien.** Alternative : régénération sur place avec historique (difficile à prouver).
6. **Diffusion par l'espace propriétaire avec notification générique, sans PDF en pièce jointe ni lien public ; le mandant sans compte reçoit le PDF de l'agence hors plateforme.** Alternatives : lien à jeton à durée limitée (ADR 0023), ou PDF en pièce jointe.
7. **Accès du propriétaire : rattachement par invitation (ADR « Espace propriétaire » à écrire), lecture jusqu'à 12 mois après la fin du dernier mandat.** Alternatives : accès illimité tant que le compte existe, ou coupure à la fin du mandat.
8. **Périodicité : mensuelle par défaut (réglage d'organisation), minimum annuel contrôlé par `reporting:flag-due`, mentions et contenu par `ManagementReportRules` pour la France seule.** Alternative : périodicité par mandat, ou ouverture générique à toute juridiction (contraire à l'ADR 0008).
9. **Pas de cache applicatif des valeurs financières en phase 1 ; si mesuré nécessaire, clé versionnée par `ledger_version`, 60 s, jamais d'erreur en cache.** Alternative : cache de 5 minutes sans version (montants périmés visibles).
10. **Quatre lots : socle et accueils, comptes rendus, espace propriétaire et exports CSV, analytique ; exports en CSV seulement, envois planifiés par e-mail reportés.** Alternative : un seul lot après l'ADR 0031 (livraison tardive des accueils déjà réels).

## Amendement du 2026-11-21 (ADR 0039)

- Livré côté backend (ADR 0039, lot 4) : `GET finance/revenue-expenses?from&to` et `finance/occupancy?from&to` (toutes organisations, rôles de lecture), `GET finance/profitability?year`, `finance/forecast`, `PUT finance/forecast/assumptions`, `GET exports/{type}` pour `prets-immobiliers` et `rentabilite-par-bien` (organisations `individual` seulement : middleware `reporting.landlord`, 403 `reporting_landlord_only`) ; table `forecast_assumptions`. Les autres types d'export du § 7, `finance/overview` et l'état `T` (travaux) de l'occupation restent à faire.
- § 6 et § 15 reclassés : « Prêts » → Investments ; « Analytique : rentabilité, prévisionnel » → Reporting ; « Bilan par régime » et « Rapports : revenus fonciers » → Tax (France) ; « Rapports : prêts » → Reporting.
