# ADR 0039 — Analytique, prévisionnel, prêts immobiliers, aide à la déclaration des revenus fonciers et centre d'aide

Statut : accepté (2026-11-20), recommandations validées telles quelles. Décide ce que l'ADR 0030 (§ 6 et § 15 : « Prêts », « Analytique : rentabilité, prévisionnel », « Fiscalité 2044 », « Rapports : revenus fonciers, valeur des biens, prêts » classés D), l'ADR 0034 (§ 9 : « Prêts : hors périmètre, ADR Patrimoine et financement ») et l'ADR 0032 (« Reste à faire : fiscalité et aide 2044 ») avaient reporté. Crée les modules `Investments` et `Tax` (ce dernier figure déjà dans l'ADR 0005). Touche les ADR 0003, 0005, 0006, 0007, 0008, 0011, 0014, 0016, 0022, 0027, 0030, 0032, 0033 et 0034 ; ne rouvre ni l'ADR 0035 ni l'ADR 0036. Amendements proposés en fin de document, **non appliqués**. Règles fiscales françaises lues sur impots.gouv.fr (formulaire n° 2044 cerfa 50156#30 et sa notice, revenus 2025 ; brochure IR 2026 p. 157-160) et service-public.gouv.fr (F1991 vérifiée le 15/04/2026) ; Légifrance n'a pas été lu : tout article du CGI cité est **à confirmer**, comme l'ensemble avec un expert-comptable avant l'implémentation (ADR 0011).

## Contexte

Constaté dans le code (2026-11-20) :

- **Aucun serveur pour ces écrans.** Aucun module `Tax` ni module de prêts (`backend/app/Modules` : 21 dossiers, ni `Tax` ni prêts), bien que l'ADR 0005 liste `Tax` (0005:53) et le lien `Tax → Accounting` (0005:78). Properties ne porte ni date ni prix d'acquisition (`Properties/Database/Migrations/2026_11_15_160000_create_properties_tables.php:15-23` et `30-42`) ; il porte les quotes-parts de propriété `unit_ownerships` (`share_bp`, `nature` `full|bare|usufruct`, mêmes fichier:53-62 et 72-73).
- **Grand livre** : aucun rôle de compte d'emprunt, d'immobilisation ni de capitaux propres (`Accounting/Enums/AccountRole.php:9-29`). Pour un lot sous mandat, l'encaissement est ventilé loyer / charges / TVA au grand livre (`Rent/Support/Settlement.php:125-153`) ; pour le bailleur autonome, l'appel crédite `RentRevenue` et `ChargesRecovered` sans rattachement à l'échéance (`Settlement.php:86-99`) et l'encaissement ne crédite que `TenantReceivable` : la part « loyer » encaissée n'est pas lisible directement. `LedgerAggregates` offre `movements` et `itemTotals` (`Accounting/PublicApi/LedgerAggregates.php:87`, `99`).
- **Reporting** livre `home/landlord` et `finance/aging` seulement (`Reporting/Http/routes.php:32-33`) ; `finance/overview` et `exports/*` (ADR 0030 § 7) n'existent pas. Garde-fous : `ReportingArchitectureTest.php:29-62` (pas de `journal_*`, écriture limitée à `Support/Own`, pas de `float`, 400 lignes).
- **Charges** livré : dépenses avec catégorie de sens `expense.*` (`Catalog/Enums/ExpenseCategorySemantic.php:9-18`, dont `loan_interest`, `property_tax`, `co_ownership`), `DeclaredExpenses::between` (`Charges/PublicApi/DeclaredExpenses.php:23`). L'ADR 0034 laisse la fiscalité à Tax (0034:69, 137) et autorise d'enregistrer les intérêts comme dépense `expense.loan_interest` (0034:139).
- **Baux** : régimes `fr.residential.unfurnished`, `furnished`, `mobility` (`Leases/Jurisdictions/Fr/*Regime.php:13`) ; `LeaseDirectory::occupancyAt` et `occupiedBetween` existent (`Leases/PublicApi/LeaseDirectory.php:90`, `101`).
- **Devises** : EUR (FR, BE, LU) et CAD seulement ; aucune organisation en XOF (`Organizations/Support/OrganizationCurrency.php:17-21`). `ext-bcmath` est installé (exigé par moneyphp, `composer.lock:2767`).
- **Écrans de démonstration** (calculs dans le navigateur) :
  - Prêts (`packages/gestion/src/features/finances/PretsPage.tsx`, `prets/*`) : bien et banque en texte, taux en points de base, **mensualité, capital restant dû et intérêts de l'année saisis à la main** (`prets/PretDialog.tsx:12-28`), échéancier importé en CSV ou estimé sur 12 mois (`derive.ts:215-225`), remboursement anticipé, archivage, suppression ; « intérêts déductibles des revenus fonciers » (`PretsPage.tsx:107-109`).
  - Bilan (`BilanPage.tsx`, `derive.ts:168-205`) : régimes `foncier_reel`, `lmnp_reel`, `micro_foncier`, `micro_bic` dans une même vue, abattements codés (30 %, 50 %), amortissements LMNP saisis.
  - Analytique (`packages/gestion/src/features/outils/analytique`) : revenus et dépenses par lot et par mois, six catégories (`constants.ts:1-8`), occupation `O|P|V|T` (`constants.ts:41`), rentabilité brute et nette **en flottants** avec annualisation (`compute/renta.ts:61-74`) sur un prix de revient et des intérêts par lot inventés (`schemas.ts:10-21`), prévisionnel 12 mois avec hypothèses IRL et hausse des dépenses (`schemas.ts:59-87`, `HypothesesDialog.tsx:69-77`).
  - Rapports (`outils/rapports/definitions`) : `revenus-fonciers`, `export-comptable` (comptes PCG codés), `tva-collectee-et-payee` (`fiscal.ts:19`, `78`, `131`), `valeur-des-biens`, `prets-immobiliers`, `rentabilite-par-bien` (`patrimoine.ts:19`, `66`, `118`).
  - Espace mandant (`apps/proprietaire/src/features/confie`) : récapitulatif et aide 2044 (`data/fiscal.ts:4-69`), copie des montants **avec centimes** (`screens/Declaration2044Screen.tsx:26`, `36`), profil « SCI » qui dépose une 2072 mais reçoit une 2044 (`Declaration2044Screen.tsx:73-75`), verdict « le réel reste plus favorable » (`FiscaliteScreen.tsx:65`, `83-84`).
  - Gating : `analytique` et `rapports` fermés (`packages/gestion/src/features/indisponible/capabilities.ts:23-24`) ; `fiscalite` et `aide` fermés côté mandant (`apps/proprietaire/src/owner/capabilities.ts:33`, `44`) ; `/aide` déclarée « réelle » côté bailleur (`indisponible/capabilities.ts:71`).
- **Centre d'aide** : `HelpPage` de `packages/messagerie` (questions, contact, urgence ; schéma `data/schemas.ts:254-279`). En mode API, la source sert **les données de démonstration** (`packages/messagerie/src/data/api/index.ts:15-19`, `35`). Le contact de l'agence n'est pas exposé à l'espace mandant (`Mandates/Http/Resources/Owner/OwnerAgencyResource.php:26-32` : nom seul). Le support (ADR 0033 § 8) existe côté serveur.

Règles fiscales relevées (France, revenus 2025, sources officielles ; articles du CGI **à confirmer**) :
- **Micro-foncier** : de plein droit si les revenus fonciers bruts **du foyer** n'excèdent pas 15 000 €, charges non comprises, quelle que soit la durée de location ; abattement de 30 % ; montant brut en case 4BE de la 2042, sans 2044 ; exclusions (monuments historiques, nue-propriété, Loc'Avantages, dispositifs d'amortissement ou de déduction spécifique, parts de sociétés seules…). Option pour le réel par le dépôt d'une 2044, **irrévocable trois ans** (brochure IR 2026 p. 157 ; F1991).
- **2044 (location nue)** : une colonne par immeuble (nombre de locaux, date d'acquisition, adresse) ; lignes 211 (loyers bruts **encaissés** dans l'année, y compris arriérés et avances), 212, 213, 214, 215 ; 221 (gestion, honoraires), 222 (**20 € par local**), 223 (assurances), 224 et 224 bis (rénovation énergétique E/F/G → A/B/C/D, sur option), 225, 226, 227 (taxes foncières **payées** dans l'année, **TEOM non déductible**), 228, 229 (provisions de copropriété payées en N), 230 (régularisation des provisions déduites en N-1), 240 ; 250 (intérêts **payés** dans l'année et frais d'emprunt, dont dossier, garantie, assurance décès-invalidité du prêt) ; 261 à 263 ; rubriques 400, 410 ; 420 → 4BA ; 430 à 442 (déficit : 10 700 €, porté à 21 400 € pour les travaux de rénovation énergétique, report 4BC, 4BB) ; 450-451 → 4BD. **« N'inscrivez pas les centimes »** (formulaire et notice 2044, revenus 2025).
- **Plafond de 21 400 €** : travaux payés du 1/01/2023 au 31/12/2027, devis accepté depuis le 5/11/2022 (F1991, vérifiée le 15/04/2026) ; report du déficit sur les revenus fonciers des dix années suivantes ; remise en cause si le bien cesse d'être loué dans les trois ans.
- **Hors 2044 normale** : 2044 spéciale (dispositifs d'investissement locatif), 2072 (sociétés civiles à l'IR), meublé (BIC : micro-BIC sur 2042-C-PRO ou réel par liasse) ; le « statut du bailleur privé » discuté en loi de finances 2026 n'a pas été trouvé dans un texte promulgué : **à confirmer**.

## Décision

### 1. Invariants

1. **Le serveur calcule tout** : échéancier, intérêts, rendements, prévisionnel, lignes fiscales. Le client n'envoie ni mensualité, ni intérêts, ni capital restant dû, ni montant de ligne, ni devise.
2. **Les soldes restent au grand livre** (ADR 0007). Un prêt est un **contrat** : son échéancier et son capital restant dû sont des données contractuelles, affichées « selon l'échéancier au {date} », jamais un solde comptable.
3. **Un montant fiscal ne vient que** du grand livre, d'une pièce figée (dépense, facture reçue, attestation bancaire) ou de l'échéancier d'un prêt ; chaque ligne garde ses sources.
4. **Jamais de télédéclaration, jamais de conseil fiscal** : l'application prépare des montants ; elle ne choisit pas le régime, ne dépose rien, n'interroge aucun service de l'administration. Chaque écran, PDF et export porte l'avertissement de la juridiction et l'invitation à faire valider par un expert-comptable.
5. **Jamais de `float`** : `Money` en unités mineures ; taux en `decimal` en base, calculs par `BcMath\Number` (PHP 8.4, `ext-bcmath` déjà requis) ; rendements renvoyés en points de base entiers.
6. **Aucune juridiction par défaut** (ADR 0008) : sans implémentation, 422 explicite.

### 2. Modules

- **`Investments`** (nouveau, famille Gestion, `php artisan make:module Investments`) : coût de revient des biens et prêts immobiliers. Neutre (aucune règle de pays), utilisable en EUR, CAD et toute devise ISO.
- **`Tax`** (nouveau, ligne existante de l'ADR 0005) : synthèse annuelle des revenus fonciers et lignes de formulaire par juridiction ; seul consommateur des règles fiscales.
- **`Reporting`** (existant) : analytique (revenus et dépenses, occupation, rentabilité) et prévisionnel, en lecture ; il gagne une table propre d'hypothèses (permis par l'ADR 0030 § 1).
- **Centre d'aide** : aucun module (décision 7).
- Liens (amendement de l'ADR 0005), lecture seule sauf mention :
  - Investments → Properties (`UnitDirectory`), Organizations (`MembershipDirectory`, `OrganizationDirectory`), Documents (`DocumentStore`). **Investments n'appelle pas Accounting.**
  - Tax → Accounting (`LedgerAggregates`, `LedgerReader`), Charges (`DeclaredExpenses`, nouvelle `ExpenseFacts`), Maintenance (`SupplierInvoiceDirectory`, nature des travaux), Investments (`LoanCosts`, `Acquisitions`), Leases (`LeaseDirectory`), Properties (`UnitDirectory`, `OwnershipDirectory`), Mandates (`MandateDirectory::coveringUnits`, `ownerScope`), Parties (`PartyDirectory`), Organizations (`MembershipDirectory`, `OrganizationDirectory`), Documents (`DocumentStore`, `IssuedDocuments`), Identity (enum `OwnerAccessRole`) ; Tax ⇢ `TaxStatementPublished` ⇢ Notifications.
  - Reporting → Investments (`LoanCosts`, `Acquisitions`), Leases (`LeaseSchedule::linesBetween`, `LeaseDirectory::occupiedBetween`).
  - Aucun de ces modules n'appelle Tax ; Investments n'appelle ni Tax ni Reporting : pas de cycle.

### 3. Coût de revient (Investments)

- `property_acquisitions` (`organization_id`, UUID v7) : `property_id`, `unit_id` (nul = bien entier), `acquired_on`, `currency`, `price`, `acquisition_costs` (notaire, droits), `agency_fees`, `initial_works`, `stored_file_id` (acte, facultatif), `lock_version`, `datetimes(6)`. Un bien se renseigne soit en entier, soit lot par lot (422 `acquisition_scope_mixed`). Modification par nouvelle version auditée (`Auditable`, avant/après) ; pas de suppression physique.
- Sert à la rentabilité (prix de revient) et à la date d'acquisition de la rubrique 200 de la 2044. Valeur estimée et plus-value latente (`valeur-des-biens`) : reportées.

### 4. Prêts immobiliers (Investments), informatifs

**Modèle** :
- `loans` : `property_id`, `unit_id` (nul = bien), `lender_label` (≤ 120), `contract_reference` (≤ 64, masquée hors fiche), `purpose` (`acquisition | works | refinancing | other`), `currency`, `principal`, `nominal_rate` (`decimal(8,5)`, en %), `first_due_on`, `term_months` (≤ 600), `deferral_kind` (`none | partial | total`), `deferral_months`, `insurance_mode` (`none | initial_capital | outstanding_capital | fixed`), `insurance_rate` (`decimal(8,5)`) ou `insurance_amount`, `replaces_loan_id` (rachat), `schedule_source` (`computed | imported`), `status` (`active | repaid | archived | voided`), `void_reason`, `stored_file_id` (offre ou tableau), `idempotency_key`, `lock_version`.
- `loan_schedules` (versions, jamais réécrites : `effective_from`, motif `initial | import | prepayment | renegotiation`) et `loan_schedule_lines` (ajout seul) : `due_on`, `payment`, `interest`, `principal`, `insurance`, `outstanding_after`.
- `loan_fees` : frais de dossier, de garantie, d'hypothèque, indemnités de remboursement anticipé, avec `paid_on`, montant et pièce.
- `loan_interest_attestations` : par prêt et par année, intérêts, assurance et frais attestés par la banque, avec pièce obligatoire.

**Calcul** (`Investments\Support\AmortizationCalculator`, fonction pure) :
- taux périodique = taux nominal / 12 (convention à confirmer par contrat) ; mensualité constante `C·r / (1 − (1 + r)^−n)`, `C / n` si le taux est nul ; échelle BcMath de 20 décimales ;
- intérêts de chaque échéance arrondis au demi supérieur à l'unité mineure, capital = mensualité − intérêts, **dernière échéance ajustée** pour que Σ capital = capital emprunté exactement et que le restant dû finisse à zéro, jamais négatif ;
- différé partiel : intérêts seuls ; différé total : intérêts capitalisés ;
- assurance sur capital initial (constante), sur capital restant dû, ou montant fixe ;
- XOF ou toute devise sans décimale : même calcul, l'unité mineure est l'unité.
- **Échéancier importé** (CSV `date ; mensualité ; intérêts ; capital ; assurance ; restant dû`, 600 lignes au plus) : revérifié par le serveur (dates mensuelles croissantes, chaînage du restant dû, Σ capital = capital emprunté) sinon 422 `loan_schedule_inconsistent` ; il **remplace** le calcul (le tableau de la banque fait foi). Taux variable : seulement par import.
- **Remboursement anticipé** (`POST loans/{id}/prepayments`, date, montant, option `reduce_term | reduce_payment`, indemnité) : nouvelle version à compter de la date ; total : statut `repaid`.

**Grand livre** : aucune écriture. La mensualité prélevée sur le compte suivi du bailleur se traite dans Banking par « ignorer » motif `out_of_scope` (ADR 0035), ou reste hors application. La décision 11 de l'ADR 0034 (intérêts saisissables en dépense) est restreinte : voir § 6 et amendements.

**Annulation** : `POST loans/{id}/void` (motif) remplace la suppression de l'écran ; refusée si une synthèse fiscale `final` l'utilise (409 `loan_in_use`).

### 5. Analytique et prévisionnel (Reporting)

Routes `/api/v1/org/{organization}/reporting/finance/…` (garde existante, `throttle:120,1`), une route par vue, aucune réponse partielle :
- `revenue-expenses?from&to` : lot 4 de l'ADR 0030, inchangé dans son principe (`movements`, `itemTotals`, `DeclaredExpenses`), plus une série **financement** distincte (intérêts et assurance de `LoanCosts`), jamais additionnée aux dépenses du grand livre sans libellé.
- `occupancy?from&to` : par lot et par mois, `occupied | notice | vacant` depuis `occupiedBetween` et les congés enregistrés (ADR 0036) ; l'état `T` (travaux) de l'écran est reporté.
- `profitability?year` (12 mois civils) : par lot ou par bien selon le niveau du coût de revient ; **brut** = loyers encaissés hors charges / prix de revient ; **net** = (loyers − dépenses non récupérées payées, hors intérêts) / prix de revient ; **net après financement** = net − intérêts, assurance et frais d'emprunt. Taux en points de base, arrondi au demi supérieur ; sans coût de revient : `null` et motif `cost_missing`, jamais 0. Pas d'annualisation d'une période partielle. Les hypothèses sont rendues dans la réponse (`assumptions`). Toujours « avant impôt ».
- `forecast` : 12 mois à partir du mois courant. Entrées : lignes futures des baux en cours (`LeaseSchedule::linesBetween`, fin de bail respectée, aucun renouvellement supposé), indexation hypothétique au mois anniversaire, vacances saisies. Sorties : moyenne mensuelle des dépenses des 12 derniers mois par catégorie augmentée de l'hypothèse, échéances de prêts, dépenses ponctuelles saisies. Ouverture : `LedgerReader::accountBalance(Bank)`. Libellé « projection, ce n'est pas un solde » ; rien n'est stocké.
- `PUT forecast/assumptions` (`forecast_assumptions`, table propre, `lock_version`, `Auditable`) : `indexation_rate` et `expense_growth_rate` (`decimal(6,3)`, 0 à 10 %), vacances `{unit_id, from, to}`, dépenses ponctuelles `{month, label ≤ 80, amount}`. Ce sont des hypothèses de l'utilisateur, pas des indices officiels (l'IRL reste à faire dans Rent, ADR 0026).
- `rentabilité`, `forecast` et `forecast/assumptions` sont réservés aux organisations `individual` (403 `reporting_landlord_only`) ; `revenue-expenses` et `occupancy` suivent `finance/*` (ADR 0030 § 8).
- Exports (rapports `prets-immobiliers`, `rentabilite-par-bien`) : `exports/{type}` de l'ADR 0030, CSV, plafond et préfixe anti-formule existants. `export-comptable` et `tva-collectee-et-payee` restent D (ADR 0030 § 15).

### 6. Fiscalité du propriétaire (Tax)

**Périmètre phase 1** : France, revenus fonciers de **location nue** (baux `fr.residential.unfurnished`), **2044 normale**, millésime « revenus 2025 ». Exclus, avec message explicite : meublé et bail mobilité (BIC : micro-BIC sur 2042-C-PRO, réel par liasse), 2044 spéciale, 2072 et mandant société (422 `tax_taxpayer_unsupported`), parts de SCPI, dispositifs de déduction spécifique (ligne 228), Belgique, Luxembourg, Québec (422 `tax_jurisdiction_unsupported`).

**Contrat de juridiction** `Tax\Jurisdictions\RentalIncomeRules` (ADR 0008), implémentation `Fr` seule, **un millésime par année de revenus** (`Fr/Millesimes/Revenus2025`) : lignes et libellés, forfait de la ligne 222, seuil et abattement du micro-foncier, plafonds de déficit, catégories admises par ligne, mentions et avertissement, règle d'arrondi. Ajouté chaque année après lecture du formulaire officiel ; une année absente : 422 `tax_year_unsupported`, jamais de repli sur l'année précédente.

**Sources par ligne** (cash : date de paiement ou d'encaissement dans `[1/01/N, 1/01/N+1)`) :

| Ligne | Bailleur autonome | Mandant (agence) |
|---|---|---|
| 211 | part loyer des encaissements, nouvelle `LedgerAggregates::collectedByComponent` (prorata de l'écriture d'appel de l'échéance, plus fort reste, somme exacte) ; avances au jour de leur réception | part `OwnerRentCalled` des encaissements (`Settlement.php:136-153`) |
| 221 | dépenses `expense.management_fees` | honoraires prélevés (`fee_settlement`, TTC) |
| 222 | 20 € × locaux loués dans l'année (lot principal ; annexe louée au même locataire non comptée), donnée du millésime | idem |
| 223 | `expense.insurance` | idem, si payée par l'agence ou déclarée |
| 224 | `expense.maintenance`, `repairs`, `improvements` ; factures d'intervention imputées | idem ; `supplier_allocation` |
| 227 | `expense.property_tax`, montant moins la part récupérable (TEOM) | idem |
| 229 / 230 | `expense.co_ownership` payées en N ; 230 proposée depuis le relevé du syndic de N-1 (`co_ownership_statement`), à valider | idem |
| 250 | `LoanCosts::deductible(N)` : attestation bancaire si saisie, sinon échéancier (intérêts + assurance) + frais payés en N | « à compléter » : l'agence ne connaît pas les prêts |
| 212, 213, 214, 224 bis, 225, 226, 228 | non calculées : « à compléter par vous si vous êtes concerné » | idem |

- Montants des dépenses : `itemTotals(ItemType::Expense)` pour les dépenses comptabilisées, `DeclaredExpenses` pour `paid_by_owner` et `none` ; catégorie, lot et part récupérable par `Charges\PublicApi\ExpenseFacts` (faits d'une pièce figée, ADR 0034 § 11). Catégorie `expense.other` ou `utilities` : listée « non classée », jamais rangée d'office.
- **Double source des intérêts** : une dépense `expense.loan_interest` sur un bien qui a un prêt suivi pour la même année bloque la synthèse (409 `tax_interest_source_conflict`) jusqu'à ce que l'utilisateur choisisse ; jamais de choix silencieux.
- **Calcul** : lignes exactes en unités mineures, puis **chaque ligne arrondie à l'euro le plus proche** (0,50 vers le haut, à confirmer) ; 215, 240, 261, 263 recalculées depuis les lignes arrondies ; montants exacts conservés à côté.
- **Déficit (420 à 451)** : simulation seulement si l'utilisateur coche « tous les revenus fonciers de mon foyer sont dans eGuardImmo » ; sinon non calculé, avec renvoi à la notice. Déficits antérieurs (450) : non suivis en phase 1.
- **Micro-foncier** : base brute et base après abattement affichées côte à côte avec la base du réel, **sans verdict** ; éligibilité (seuil apprécié sur le foyer, exclusions) rappelée, jamais déduite.
- **Quotes-parts** : montants à 100 % du bien ; si `unit_ownerships` porte plusieurs propriétaires, leurs parts sont affichées et l'avertissement « à répartir selon vos droits » s'ajoute.
- **Lot sous mandat avant l'activation des fonds des mandants** (`LedgerReader::ownerFundsCutoverAt`) : année refusée côté mandant (409 `tax_owner_funds_not_ready`).

**Synthèse figée** (`tax_summaries`, ADR 0022) : `scope` (`organization | mandant`), `mandant_party_id`, `income_year`, `form_version` (`fr-2044-2025`), `status` (`final | published | superseded`), `currency`, `snapshot` (par bien : lignes exactes et arrondies, sources, quotes-parts, avertissement), `ledger_cutoff`, `fingerprint`, `template_version`, `issued_document_id`, `stored_file_id`, `supersedes_id`, `rectification_reason`, `idempotency_key`, `lock_version`, `published_at`. `tax_summary_lines` en ajout seul (`property_id`, `line_code`, `amount_exact`, `amount_rounded`, `sources`). Une synthèse vivante par (organisation, portée, mandant, année) ; déclencheurs MySQL : rien ne change après `final`, sauf le passage à `superseded` ; suppression refusée.
- **Bailleur autonome** : `GET /org/{organization}/tax/rental-income/{year}` (calcul à la volée, filigrane « provisoire » tant que l'année n'est pas finie) ; `POST …/tax/summaries` (année terminée, `Idempotency-Key`) fige ; `POST …/summaries/{id}/rectify` (motif) ; `GET …/{id}/pdf` et `…/{id}/lines.csv`.
- **Agence** (lot 4) : `POST /org/{organization}/tax/mandant-statements` (année, 50 mandants au plus, une transaction par mandant, résultat par mandant), `POST …/{id}/publish` (année close au grand livre, `isClosed`, sinon 409 `tax_period_not_closed`), `rectify`, `pdf`. Modèle du compte rendu de gestion (ADR 0030 § 4 et § 9).
- **Mandant** : `GET /owner/tax-statements`, `GET /owner/tax-statements/{id}`, `GET …/pdf` (`space:owner`, `verified`, clé `MandateDirectory::ownerScope`, `Queries/` avec `AcrossOrganizations`, publiées seulement, grâce de 12 mois en lecture, rôles `holder`, `representative`, `co_owner`) ; hors clé : 404 `tax_summary_not_found`. Une synthèse par (agence, mandant) : jamais de total entre agences ni entre mandants (une société et une personne n'ont pas la même déclaration).
- **Formats** : PDF Gotenberg (`app/Shared/Pdf`, 503 `tax_pdf_unavailable` sans écriture) avec avertissement et « montants à reporter, sans centimes » ; CSV (UTF-8, `;`, préfixe anti-formule) ; à l'écran, copie ligne par ligne du montant arrondi. Aucun format de dépôt (EDI-TDFC, API de l'administration).

### 7. Centre d'aide

- **Contenu statique versionné** dans `packages/messagerie` (`src/content/help/{espace}.ts`, schéma `helpCenterSchema` existant), extrait des données de démonstration ; chaque article porte `id`, `updatedAt` et des liens internes vérifiés par un test contre la table des routes de l'application. Recherche dans le navigateur. Aucune donnée personnelle, aucun montant, aucune règle fiscale chiffrée : renvoi vers la page Fiscalité et vers https://www.impots.gouv.fr.
- **Contact** : mandant → « Écrire à l'agence » (conversation, ADR 0033) ; tous → « Écrire au support » (demande, ADR 0033 § 8, `GET /support/status`). Les coordonnées de l'agence ne s'ajoutent à `OwnerAgencyResource` que si l'agence les déclare publiques (reste à faire).
- `/confie/aide` passe `familyHasApiSource.aide = true` quand la source API ne lit plus les données de démonstration.

### 8. Droits, débits, codes

| Action | Rôles | Débit |
|---|---|---|
| Lecture : prêts, coût de revient, analytique, prévisionnel, synthèses | propriétaire, administrateur, gestionnaire, comptable | 120/min |
| Prêts (créer, importer, rembourser par anticipation, attestation, annuler), coût de revient, hypothèses | propriétaire, administrateur, comptable | 60/min ; import 30/h |
| Figer, rectifier une synthèse ; générer les relevés des mandants | propriétaire, administrateur, comptable | 20/min |
| Publier au mandant | propriétaire, administrateur, gestionnaire ; `two-factor` en agence | 20/min |
| Exports CSV et PDF | propriétaire, administrateur, comptable ; `two-factor` en agence | 10/min |
| Mandant (lecture, PDF) | `holder`, `representative`, `co_owner` | 60/min ; PDF 30/min |

- Investments : organisation `individual` seulement (403 `investments_landlord_only`). Gardes communes : `auth:sanctum`, `no-operator-token`, `space:organization`, `Cache-Control: private, no-store` sur toute réponse chiffrée.
- Codes (ADR 0014) : Investments `loan_not_found` 404, `acquisition_not_found` 404, `loan_terms_invalid` 422, `loan_schedule_inconsistent` 422, `acquisition_scope_mixed` 422, `loan_in_use` 409, `loan_version_conflict` 409, `investments_idempotency_key_reused` 409, `investments_landlord_only` 403 ; Tax `tax_summary_not_found` 404, `tax_year_unsupported` 422, `tax_jurisdiction_unsupported` 422, `tax_taxpayer_unsupported` 422, `tax_interest_source_conflict` 409, `tax_period_not_closed` 409, `tax_owner_funds_not_ready` 409, `tax_summary_stale_version` 409, `tax_idempotency_key_reused` 409, `tax_pdf_unavailable` 503 ; Reporting `reporting_landlord_only` 403, `forecast_assumptions_stale` 409, `profitability_period_invalid` 422.
- Le client n'envoie jamais : mensualité, intérêts, capital restant dû, montant de ligne fiscale, rendement, devise, statut, `mandant_party_id`.

### 9. Sécurité et données personnelles

- Revenus et emprunts d'un particulier : données personnelles à protéger (RGPD) ; minimisation dans les Resources mandant (aucun identifiant de fiche, aucune coordonnée de locataire, nom seul dans le PDF) ; jamais dans un e-mail, une notification ou un push (lien `https://` vers l'espace seulement) ; jamais de lien public à jeton.
- Journal (ADR 0016) : `Auditable` sur `loans`, `property_acquisitions`, `forecast_assumptions`, `tax_summaries` ; actions `investments.loan.created|imported|prepaid|voided`, `tax.summary.finalized|rectified|published|downloaded|exported`, `reporting.forecast.assumptions_updated`. Ni montant, ni libellé libre, ni référence de contrat dans `metadata`.
- Fichiers (offre de prêt, tableau, attestation, acte) : `DocumentStore` (PDF, JPG, PNG, 10 Mo, type vérifié sur le contenu, nom régénéré, privé, analyse antivirale de l'ADR 0033).
- `contract_reference` masquée (quatre derniers caractères) hors de la fiche du prêt, dans les exports et les journaux.
- Conservation : synthèses et pièces six ans au moins (droit de reprise, à confirmer) ; pas de purge en phase 1. APDP (Bénin) non applicable au lancement (ADR 0008).
- `/security-review` sur les lots 1, 2 et 4.

### 10. Garde-fous automatiques

- `InvestmentsArchitectureTest` : aucun `float`, `(float)`, `round(`, `pow(` ; arithmétique de taux seulement dans `Support/AmortizationCalculator` ; **aucun import d'`Accounting`** ; dépendances limitées à la liste de la décision 2 (modèle `BankingArchitectureTest.php:59-71`) ; 400 lignes par fichier.
- `TaxArchitectureTest` : aucun import de `Accounting\PublicApi\Ledger` (lecture seule) ; aucun client HTTP (`Http`, Guzzle) dans le module (pas de télédéclaration) ; aucune année ni montant fiscal en dur hors `Jurisdictions/Fr/Millesimes` ; aucun `float` ; dépendances de la décision 2.
- `ReportingArchitectureTest` étendu : Investments et Leases importés par `PublicApi`, `Data`, `Enums` seulement ; test de contrat de schéma inchangé.
- `ArchTest` global : nouveaux modèles avec `BelongsToOrganization` et `HasUuids` (aucune exception) ; registre des juridictions : `RentalIncomeRules` n'est exigé que pour `Fr`.

## Options écartées

- **Prêts comptabilisés au grand livre** (emprunt au passif, capital et intérêts à chaque échéance) : il faudrait des rôles d'emprunt, d'immobilisation et de capitaux propres que le grand livre n'a pas (`AccountRole.php:9-29`) et que l'ADR 0030 refuse de transformer en plan comptable (0030:225) ; une écriture d'ouverture sans contrepartie fausserait les soldes ; aucun lot sous mandat n'en a besoin.
- **Prêts dans Tax** : un prêt existe aussi au Québec ou en XOF, sans règle fiscale ; Reporting dépendrait de Tax.
- **Prix d'achat dans Properties, prêts ailleurs** : Properties ne calcule rien (ADR 0020) ; coût de revient et prêts ont les mêmes consommateurs.
- **Intérêts seulement par dépense Charges** (ADR 0034 tel quel) : pas d'échéancier ni de capital restant dû, saisie mensuelle, et rien pour l'écran Prêts.
- **Échéancier et intérêts saisis à la main** (démonstration) : contraire à « le serveur recalcule ».
- **Fiscalité dans Reporting** : Reporting n'a pas de contrat de juridiction et lit des faits ; la correspondance avec un formulaire est une règle de pays (ADR 0008).
- **Base 211 en loyers appelés** : la notice demande les loyers encaissés dans l'année.
- **Synthèse fiscale seulement calculée à la volée** : une écriture tardive changerait des montants déjà transmis à l'expert-comptable ou au mandant (ADR 0022).
- **Verdict « régime plus favorable »** (démonstration) : seuil apprécié sur le foyer, option de trois ans, déficit et taux marginal inconnus : c'est un conseil, pas un calcul.
- **LMNP, micro-BIC, 2072, 2044 spéciale dès la phase 1** : autres formulaires, autres règles (amortissements, quote-part des associés) ; à décider après la 2044 normale.
- **Télédéclaration ou préremplissage chez l'administration** : interdit par le périmètre (ADR 0011).
- **Taux et rendements en `float`, annualisation d'une période partielle** (démonstration) : arrondis non maîtrisés, chiffres trompeurs.
- **Prévisionnel calculé dans le navigateur** (démonstration) : données de démonstration et règles dupliquées.
- **Centre d'aide en module backend avec édition depuis la console** : surface d'écriture et de rendu riche (XSS) pour un contenu qui change au rythme des versions ; **base de connaissances externe** (SaaS) : transfert de données, coût, ADR 0011.
- **Table de millésimes éditable par la console** : un barème fiscal modifié sans revue de code ni test.

## Conséquences

- **Front** : `PretsPage` et ses dialogues sur l'API (plus de mensualité ni d'intérêts saisis ; « Supprimer » devient « Annuler la saisie ») ; `BilanPage` lit la synthèse de Tax pour la France, LMNP et micro-BIC retirés ; analytique et rapports sur Reporting, taux en points de base, `renta.ts` et `forecast.ts` disparaissent ; `/confie/fiscalite` et la 2044 sur `/owner/tax-statements`, copie sans centimes, avertissement, plus de verdict de régime ; contenu d'aide sorti de `demoSeeds`.
- **Planification** : `tax:verify` (quotidienne : synthèse figée recalculée avec son `ledger_cutoff`, écart journalisé, rien n'est corrigé).
- **Configuration** : `TAX_GOTENBERG_TIMEOUT` (15 s au plus), `INVESTMENTS_IMPORT_MAX_LINES` (600).
- **Exploitation** : chaque printemps, ajout du millésime après lecture du formulaire 2044 et de sa notice, par une revue de code.
- **Risques** : un utilisateur peut reporter des montants faux s'il ne lit pas l'avertissement ; une catégorie de dépense mal choisie change une ligne ; la ventilation au prorata de la part loyer d'un encaissement partiel du bailleur autonome est une convention, à faire valider.
- **Reste à faire** : 2044 spéciale, 2072, LMNP, déficits antérieurs, ligne 224 bis (marquage des travaux de rénovation énergétique sur la dépense), valeur estimée des biens, dépôt de garantie retenu (recette), juridictions `Be`, `Lu`, `Ca/Qc`, coordonnées publiques de l'agence.

## Plan de lots

Serveur d'abord, fronts ensuite ; chaque lot sort par `composer check` ou `pnpm -r check`, sans test ignoré (comparer le nombre de `skipped`). Tests communs : 401, 403 par rôle, 404 sur la ressource d'une autre organisation et d'un autre mandant, jeton opérateur refusé, organisation `agency` refusée sur Investments, dates figées, bornes semi-ouvertes autour du 31 décembre et du 29 février, nombre de requêtes constant (1, 10, 100 biens).

| Lot | Contenu | Critères de sortie |
|---|---|---|
| 0. Centre d'aide | contenu versionné, sortie de `demoSeeds`, liens internes testés, `/confie/aide` dégatée | test des liens internes ; aucune donnée de démonstration en mode API ; parcours navigateur « Écrire au support » |
| 1. Investments | module, coût de revient, prêts, calculateur, import, remboursement anticipé, frais, attestations, `LoanCosts`, `Acquisitions` | échéanciers de référence calculés indépendamment (taux nul, différé partiel et total, trois modes d'assurance, 300 mois) égaux au centime ; Σ capital = capital ; mutation qui rougit le test d'arrondi ; import incohérent 422 ; XOF sans décimale ; ArchTest du module |
| 2. Tax, bailleur autonome | module, `RentalIncomeRules` `Fr` millésime 2025, `collectedByComponent` (Accounting), `ExpenseFacts` (Charges), synthèse à la volée, figer, rectifier, PDF, CSV, `tax:verify` | jeu de référence fait à la main par ligne (encaissement partiel, avance, TEOM, copropriété 229/230, forfait 222 avec annexe, prêt avec attestation) ; arrondi par ligne et totaux ; conflit d'intérêts 409 ; meublé exclu ; année 2026 422 ; déclencheurs ; avis écrit de l'expert-comptable sur le jeu de référence |
| 3. Reporting, analytique | `revenue-expenses`, `occupancy`, `profitability`, `forecast`, hypothèses, exports `prets-immobiliers`, `rentabilite-par-bien` | chiffres égaux aux lectures directes d'Accounting et d'Investments ; rendement `null` sans coût de revient ; projection sans écriture ; contrat de schéma |
| 4. Tax, agence et mandant | relevés par mandant, publication, `/owner/tax-statements`, `TaxStatementPublished`, notification `owner.tax_statement_published` | publication refusée avant clôture ; 404 autre mandant, autre agence ; grâce J+12 mois et J+12 mois + 1 jour ; mandant société 422 ; aucun total inter-agences ; rejeu sans doublon |
| F1 à F3 | fronts des lots 1 à 4 dans `packages/gestion` et `apps/proprietaire` | `pnpm -r check` ; parcours navigateur sur l'API réelle (prêt, échéancier, synthèse, PDF, analytique, 2044 mandant) ; familles dégatées une par une |

## Points à valider par un expert-comptable ou un juriste

1. Ligne 211 : loyers perçus par l'agence pour le mandant = loyers perçus par le mandant à cette date ; avances comptées à la réception ; ventilation au prorata d'un encaissement partiel entre loyer et charges.
2. Ligne 221 : honoraires de gestion TTC ; honoraires de mise en location ; frais de procédure.
3. Ligne 227 : déduction de la TEOM par la part récupérable de la dépense ; frais de gestion de la taxe déductibles.
4. Lignes 229 et 230 : calcul de la régularisation depuis le relevé annuel du syndic.
5. Ligne 250 : intérêts selon l'échéancier faute d'attestation ; indemnités de remboursement anticipé ; assurance emprunteur ; prêt de rachat (intérêts plafonnés à l'échéancier initial).
6. Ligne 222 : notion de « local » et d'annexe louée au même locataire.
7. Arrondi à l'euro le plus proche par ligne (CGI art. 1657, à confirmer) et totaux recalculés.
8. Exercice illégal de la consultation fiscale (loi n° 71-1130, titre II, à confirmer) : un outil de calcul avec avertissement et sans recommandation de régime reste hors champ ; relevé fiscal fourni par une agence à ses mandants.
9. Conservation des synthèses et pièces (droit de reprise de trois ans, six ans proposés).
10. Belgique (revenu cadastral), Luxembourg, Québec (TP-128, T776, déduction pour amortissement) : repères seulement, rien n'est codé.

## Questions fermées pour l'utilisateur

Ma recommandation est toujours la première.

1. **Prêts informatifs dans un nouveau module `Investments` (avec le coût de revient), jamais au grand livre ?** Alternatives : prêts comptabilisés (rôles d'emprunt et d'immobilisation à créer) ; prêts dans Tax.
2. **Intérêts déductibles = attestation bancaire si saisie, sinon échéancier ; double source avec une dépense `expense.loan_interest` bloquante ?** Alternatives : attestation obligatoire ; intérêts seulement par dépense Charges.
3. **Tax créé maintenant, France, location nue, 2044 normale seule ; meublé, 2044 spéciale, 2072 et autres pays refusés explicitement ?** Alternative : inclure LMNP et micro-BIC dès la phase 1.
4. **Ligne 211 sur les loyers encaissés, ventilés au prorata pour le bailleur autonome par une nouvelle agrégation d'Accounting ?** Alternative : loyers appelés (plus simple, contraire à la notice).
5. **Déficit (420 à 451) simulé seulement si l'utilisateur déclare que l'application couvre tous les revenus fonciers de son foyer ?** Alternatives : jamais calculé ; toujours calculé.
6. **Micro-foncier et réel affichés côte à côte, sans verdict ?** Alternative : garder « le réel est plus favorable » de la démonstration.
7. **Chaque ligne arrondie à l'euro le plus proche, totaux recalculés depuis les lignes arrondies, exacts conservés ?** Alternative : totaux exacts arrondis à la fin.
8. **Synthèse figée (validation par le bailleur, publication par l'agence) avec rectificatif ?** Alternative : calcul à la volée seulement.
9. **Relevé fiscal annuel par mandant publié dans l'espace propriétaire (lot 4) ?** Alternative : fiscalité réservée au bailleur autonome.
10. **Mandant société et indivision : montants à 100 %, quotes-parts affichées, pas de 2044 pour une société ?** Alternative : répartition automatique par associé ou indivisaire.
11. **Rentabilité sur 12 mois civils, loyers encaissés hors charges, « non calculable » sans coût de revient, points de base ?** Alternative : annualisation d'une période partielle (démonstration).
12. **Prévisionnel calculé par Reporting, hypothèses stockées par organisation, jamais figé ?** Alternative : calcul dans le navigateur.
13. **Rentabilité, prévisionnel et prêts réservés aux organisations `individual` ?** Alternative : ouverts aux agences pour leurs biens propres.
14. **Centre d'aide en contenu statique versionné dans le dépôt, sans module backend ?** Alternatives : module `Help` édité depuis la console ; base de connaissances externe.
15. **Un millésime fiscal par année de revenus, en code revu, sans repli ?** Alternative : barème éditable depuis la console.

## Amendements nécessaires (non appliqués)

- **ADR 0003** : `/owner/tax-statements` (lecture, PDF), hébergé par Tax.
- **ADR 0005** : nouveau module Investments (famille Gestion : coût de revient, prêts immobiliers) ; ligne Tax précisée (« aide à la déclaration des revenus fonciers par juridiction ») ; liens de la décision 2 ; Accounting `LedgerAggregates::collectedByComponent` ; Charges `PublicApi/ExpenseFacts` ; Charges appelé par Tax ; Maintenance appelée par Tax ; Reporting → Investments, Leases (`LeaseSchedule::linesBetween`, `occupiedBetween`) ; Tax ⇢ `TaxStatementPublished` ⇢ Notifications. Modules : 26.
- **ADR 0006** : `Tax\Queries\OwnerTaxStatements` avec `AcrossOrganizations`, clé `ownerScope`.
- **ADR 0007** : un prêt est un contrat hors grand livre ; son capital restant dû n'est pas un solde ; aucune écriture d'Investments.
- **ADR 0008** : contrat `RentalIncomeRules` par millésime ; registre : exigé pour `Fr` seul.
- **ADR 0011** : ligne « Fiscalité du bailleur » précisée (2044 normale, millésime, aucun conseil, aucune télédéclaration, validation par un expert-comptable).
- **ADR 0014** : codes de la décision 8.
- **ADR 0016** : actions de la décision 9.
- **ADR 0022** : synthèse fiscale figée (`IssuedDocumentType::TaxSummary`, modèle `TAX-2044-1`).
- **ADR 0027** : type `owner.tax_statement_published` (audience `owner`, sans montant, clé `tax_statement:{id}`).
- **ADR 0030** : § 6 et § 15 reclassés : « Prêts » → Investments ; « Analytique : rentabilité, prévisionnel » → Reporting (lot 4, cet ADR) ; « Bilan par régime » → Tax pour la France ; « Rapports : revenus fonciers » → Tax ; « Rapports : prêts » → Reporting ; table `forecast_assumptions` ; middleware `reporting.landlord`.
- **ADR 0032** : `/owner/tax-statements` ; « fiscalité et aide 2044 » retiré du reste à faire.
- **ADR 0033** : centre d'aide en contenu statique, contacts vers conversation et support.
- **ADR 0034** : § 9 « Prêts » : prêts dans Investments ; dépense `expense.loan_interest` réservée aux prêts non suivis, conflit bloquant dans Tax ; `ExpenseFacts` pour Tax.

## Sources

- Formulaire 2044 (revenus 2025, cerfa 50156#30) : https://www.impots.gouv.fr/sites/default/files/formulaires/2044/2026/2044_5483.pdf
- Notice 2044 (revenus 2025) : https://www.impots.gouv.fr/sites/default/files/formulaires/2044/2026/2044_5487.pdf
- Brochure pratique IR 2026, revenus fonciers p. 157-160 : https://www.impots.gouv.fr/www2/fichiers/documentation/brochure/ir_2026/pdf_som/10-rev_fonciers_157a160.pdf
- Service-public, F1991 (location non meublée, vérifiée le 15/04/2026) : https://www.service-public.gouv.fr/particuliers/vosdroits/F1991
- Service-public, F32744 (location meublée, vérifiée le 15/04/2026) : https://www.service-public.gouv.fr/particuliers/vosdroits/F32744
- Revenu Québec, TP-128 : https://www.revenuquebec.ca/fr/services-en-ligne/formulaires-et-publications/details-courant/tp-128/


## Amendement du 2026-11-21 : points à valider par l'expert-comptable (revue de l'implémentation)

Revue de sécurité de l'implémentation de cet ADR : cinq règles fiscales sont codées comme ci-dessous et **ne doivent pas changer sans cas de référence fourni par un expert-comptable**. Aucun calcul n'a été modifié.

11. **Partage du déficit foncier** (`RentalIncomeCalculator::deficit`) : le code impute `min(déficit, ligne 250)` à la part « intérêts » et le reste aux autres charges. La notice 2044 semble imputer d'abord les intérêts sur les recettes. Exemple : 215 = 10 000, 250 = 3 000, 240 = 20 000 donne 10 000 de déficit : le code reporte 10 000 en part intérêts (rien d'imputable sur le revenu global), la notice paraît donner 10 700 et 2 300 reportés. À trancher avec un cas chiffré.
12. **Assurance emprunteur pendant un différé total** (`LoanFacts::scheduleTotals`) : seules les échéances à mensualité positive sont retenues, donc l'assurance payée pendant un différé total (mensualité nulle) n'est pas déduite. À confirmer.
13. **Ligne 224** : la catégorie « Improvements » est rangée d'office en 224 ; les dépenses d'agrandissement ou de construction ne sont pas déductibles. Le classement fin (amélioration déductible, ou non) est à valider.
14. **Ligne 211 du mandant** (`MandantFactsReader`, `OwnerRentCalled`) : exclusion des provisions de charges récupérées à confirmer.
15. **Plafond de 21 400 € (rénovation énergétique) et ligne 230** : non gérés ; le plafond de déficit imputable reste celui du millésime.

## Amendement du 2026-11-21 : corrections de la revue de sécurité

- **Pièce jointe d'un prêt ou de frais** : stockée avant l'écriture de la ligne (identifiant pré-attribué) ; les déclencheurs gardent `stored_file_id` figé.
- **Années figées** : un remboursement anticipé dont la date précède le 1er janvier suivant la dernière année figée, ou un import qui change les échéances d'une année figée, est refusé en 409 `loan_in_use`.
- **Prêt annulé ou soldé** : frais refusés (409 `loan_state_invalid`) sur un prêt annulé ou soldé ; attestation refusée sur un prêt annulé seulement (l'attestation d'une année de remboursement reste légitime).
- **Relevés de mandants** : au plus `TAX_STATEMENTS_MAX_MANDANTS` (10) par demande, sinon 422 `tax_batch_too_large` ; budget de temps `TAX_STATEMENTS_TIME_BUDGET_SECONDS` (90) : les mandants restants reviennent en échec 503 `tax_batch_time_exceeded` dans la réponse (201 si au moins un relevé créé) et se relancent avec la même clé.
- **Rectificatif en chaîne** : rectifier un rectificatif non publié reprend la clé d'attente et l'original remplacé.
- **Mandant** : `property_id` est `null` dans les réponses `/owner/tax-statements` (propriétés et avertissements).
- **PDF fiscal** : la route générique des documents répond 404 pour un fichier `tax_summary`.
- **Export prêts** : période de 36 mois au plus (422).
