# ADR 0040 — Espace agence : barème d'honoraires, devis, bibliothèque de documents, réglages financiers, matrice des droits

Statut : accepté (2026-11-20), recommandations validées telles quelles. Décide ce qui empêche cinq pages d'`apps/agence` de quitter le mode « Bientôt disponible » : `/finances/honoraires/bareme`, `/devis`, `/documents/ajout`, `/reglages/finances`, `/equipe/roles`. Touche les ADR 0003, 0005, 0006, 0014, 0016, 0018, 0021, 0025, 0029, 0031, 0032 et 0033. Amendements listés en fin de document, appliqués le 2026-11-20 (backend ; le lot front F0 reste hors périmètre de cette livraison). Hors périmètre : `/compte/abonnement` (abonnements, ADR 0037, proposé), analytique, prêts et fiscalité (ADR 0039, proposé), agenda, tâches, contacts et journal (ADR 0038, proposé). Points de droit : sources non lues ici, **à confirmer** par un juriste ou un expert-comptable (ADR 0011).

Chemins : `app/…`, `tests/…`, `docs/…` sont relatifs à `backend/` ; `apps/…` et `packages/…` à la racine du dépôt.

## Contexte

Constaté dans le code (2026-11-20) :

**Gating front.** `familyHasApiSource` vaut `false` pour `finances`, `devis`, `documents`, `reglages`, `roles` (`apps/agence/src/espace/capabilities.ts:21-36`) ; `/finances/honoraires/bareme`, `/devis`, `/documents/*` (hors `/documents` exact), `/reglages/*` (hors `/reglages` et `/reglages/acces-support`) et `/equipe/roles` sont classés dans ces familles (`capabilities.ts:67`, `:76`, `:78-81`, `:96`).

**1. Barème** (`/finances/honoraires/bareme`)
- Serveur : `POST /org/{o}/mandates/{m}/terms` (`app/Modules/Mandates/Http/routes.php:49`, rôles `owner`, `admin`, `manager`, `routes.php:41`) accepte `lock_version`, `effective_on` (≥ aujourd'hui), `fee_kind`, `fee_basis_points` (0 à 10 000), `fee_flat_amount`, `payout_day` (1 à 28), `works_limit_amount`, `fee_base`, `fee_minimum_amount`, `fee_tax_mode` (`app/Modules/Mandates/Http/Requests/AmendMandateTermsRequest.php:29-38`). Aucun avenant rétroactif : `effective_on` `after_or_equal:today` (`:30`).
- `mandate_terms` : une ligne par période, une seule ouverte (`app/Modules/Mandates/Database/Migrations/2026_11_16_110000_create_mandates_tables.php:80-104`) ; `fee_base` nullable, `fee_minimum_amount` défaut 0, `fee_tax_mode` défaut `excl_tax` (`…/2026_11_18_210000_add_fee_scale_to_mandate_terms.php:17-19`). À la création, `fee_base` reste facultatif (`app/Modules/Mandates/Http/Support/MandateInput.php:34`, `:80`) : un mandat neuf peut naître sans base et buter plus tard sur `fee_base_missing` (`app/Modules/OwnerFunds/Support/FeeCalculator.php:84`).
- L'avenant ne porte aucune pièce signée : `AmendMandateTerms` ne lit ni fichier ni document (aucune occurrence de `document`, `signed` ou `stored_file` dans `app/Modules/Mandates/Actions/AmendMandateTerms.php`). La pièce signée n'est exigée qu'à l'activation (ADR 0025).
- Calcul : `FeeCalculator::compute` (fonction pure, `moneyphp`, arrondi au demi supérieur, `FeeCalculator.php:30-76`) ; taux de TVA par `ManagementFeeInvoices::vatRatePcm` (`app/Modules/OwnerFunds/Support/FeeBilling.php:58`). Aucune route de simulation : seules `GET /owner-funds/fees` et l'aperçu de reversement existent (`app/Modules/OwnerFunds/Http/routes.php:45`, `:51`).
- Déjà tranché : prélèvement « à l'encaissement » retiré, retenue au reversement seulement (ADR 0031 § 3, `docs/adr/0031-…:87`, `:228`) ; relocation et suivi de travaux en « reste à faire » (`0031:72`, `:280`). La nature de ligne `fee.letting` existe (`app/Modules/Catalog/Enums/InvoiceItemSemantic.php:10`) et reste saisissable à la main (ADR 0031 § 3).
- Front : le formulaire porte `collection` (mode de prélèvement), `relocation` (pourcentage parsé par `Number`, donc flottant), `works`, `applyToAll`, une date strictement postérieure à aujourd'hui et un **mandant** au lieu d'un mandat (`apps/agence/src/features/finances/honoraires/baremeForm.ts:12`, `:16`, `:29-45` ; `BaremePage.tsx:24`, `:59`) ; bases `encaisses | hors_charges` (`apps/agence/src/features/finances/inputs.ts:10-11`) sans correspondance documentée avec `rent | rent_and_charges`.
- Front, avenant : `amendPayload` et `termsPayload` n'envoient ni `fee_base`, ni `fee_minimum_amount`, ni `fee_tax_mode` (`apps/agence/src/features/portefeuille/api/apiPayloads.ts:63-71`, `:124-133`), et `apiMandateTermsSchema` ne les lit pas (`apiSchemas.ts:27-37`) alors que le serveur les renvoie (`app/Modules/Mandates/Http/Support/ApiShapes.php:86-88`).
- Front, monnaie : `parseMoney` multiplie par 100 (`apps/agence/src/features/shared/money.ts:30-35`) et `toTerms` refuse toute devise autre que l'euro (`portefeuille/api/apiMapping.ts:48-49`) : XOF impossible.

**2. Devis** (`/devis`)
- Serveur : devis gérés sous l'intervention seulement (`app/Modules/Maintenance/Http/routes.php:108-112`, écriture `owner`, `admin`, `manager`, `:88`) ; lecture par la fiche (`:81`, rôles des quatre, `:79`). Aucune liste transversale.
- Table `intervention_quotes` : index `(intervention_id, status)` seulement (`…/2026_11_18_150000_create_maintenance_tables.php:201-225`) ; statuts `received | submitted | accepted | refused | expired | superseded` (`app/Modules/Maintenance/Enums/QuoteStatus.php`) ; `created_at` sans cast `PreciseTimestamp` (`app/Modules/Maintenance/Models/InterventionQuote.php`). Les listes de Maintenance se paginent par `id` (`Http/Requests/ListInterventionsRequest.php:30`).
- Le message du devis (500 caractères) se saisit à la création (`Http/Requests/QuoteRequest.php:30`) ; la soumission n'en prend pas (`Http/Controllers/Organization/SubmitQuoteController.php`). Le front en exige un de 10 à 1 000 caractères à la soumission (`apps/agence/src/features/interventions/schemas.ts:124-127`) et calcule plafond, dépassement et mandant côté navigateur (`schemas.ts:60-81`).

**3. Documents** (`/documents/ajout`)
- Serveur : `POST /org/{o}/documents/files` (`owner`, `admin`, `manager`) et téléchargement générique pour tout membre (`app/Modules/Documents/Http/routes.php:14-24`). Champs : `file`, `category`, `subject_type`, `subject_id`, `retention_until` (`Http/Requests/UploadFileRequest.php:30-36`). **Seules `supporting` et `certificate` sont déposables** (`Enums/FileCategory.php:48-51`) ; `issued`, `bundle`, `bank_statement` sont produites par le serveur. Le nom affiché est le nom d'origine du fichier (`UploadFileRequest.php:51-54`) ; `FileNames::display` et `aligned` existent (`Support/FileNames.php:13`, `:25`). Sujets : `organization`, `unit`, `party`, `equipment`, `lease` (`Enums/SubjectType.php`), vérifiés par la morph map sans import de module (`Support/SubjectGuard.php:24-45`) ; `mandate` est déjà dans la morph map de Mandates (`app/Modules/Mandates/MandatesServiceProvider.php:23`) mais pas dans `SubjectType`.
- Lecture : aucune liste de fichiers. Le téléchargement générique refuse messagerie, espace locataire, relevés et rapprochements (`Actions/StreamFile.php:28`), puis exige `clean` (`Support/ScanGate.php:16-23`, ADR 0033) et journalise (`StreamFile.php:42`).
- Conservation : `retention_until` facultatif, jamais raccourci, suppression refusée avant échéance (`Models/StoredFile.php:55-70`) ; aucune purge planifiée par échéance (`routes/console.php:11-13`).
- Partage : vers le locataire, `lease_documents` et `POST /org/{o}/leases/{lease}/documents` existent (ADR 0036 ; fichier de sujet `lease:{ce bail}` et catégorie `supporting|certificate`, `app/Modules/Leases/Actions/ShareLeaseDocument.php:40-41`). Vers le mandant, `mandate_documents` existe (`…/2026_11_19_210000_create_mandate_documents_table.php:16-35`) et est lu par `/owner/documents`, mais **aucune Action ni route ne l'écrit** (seules la factory et les requêtes de l'espace propriétaire le référencent).
- Front : dix catégories métier (`Mandat`, `Bail`, `Quittance`, `Compte rendu`, `Devis`, `Facture`, `Photo`, `Diagnostic`, `Conformité`, `Autre`), nom d'affichage, date de validité, description de 500 caractères, partage mandant et locataire (`apps/agence/src/features/documents/schemas.ts:5-16`, `:50-62`).

**4. Réglages financiers** (`/reglages/finances`)
- Serveur : honoraires, jour de reversement et plafond de travaux sont portés par `mandate_terms` (point 1). Aucun réglage d'organisation : le magasin `settings` de l'ADR 0018 (`docs/adr/0018-…:36-38`) n'existe pas ; les réglages « d'organisation » des ADR 0029 à 0031 sont des variables de configuration (`config/maintenance.php:6-7`, ADR 0031 § 14) ; une table typée `accounting_settings` existe déjà, en écart avec l'ADR 0018 (`app/Modules/Accounting/Database/Migrations/2026_11_18_200000_create_owner_funds_ledger_tables.php:44-48`).
- Compte séquestre : existe dans Banking (rôle `trust_bank`, `app/Modules/Banking/Enums/LedgerRole.php`), lu par `GET /banking/accounts` et `GET /banking/reconciliations` (`owner`, `admin`, `accountant`, `app/Modules/Banking/Http/routes.php:39-49`), écrit en `owner`, `admin` avec double authentification et preuve récente (`:84`).
- TVA : régime `normal | franchise` porté par l'identité légale (`app/Modules/Organizations/Enums/VatRegime.php`) ; taux par juridiction (ADR 0028 : liste blanche, jamais un taux libre).
- Front : base `rents_billed` (« loyers appelés »), sélecteur de TVA 0/5,5/10/20 %, `retainFees`, `attachReport`, IBAN « français » (`apps/agence/src/features/reglages/schemas.ts:62-73`, `:77-92`, `:116-125`, `:127-135`).

**5. Rôles** (`/equipe/roles`)
- Serveur : rôles `owner`, `admin`, `manager`, `accountant` (`app/Modules/Organizations/Enums/MemberRole.php:9-12`, CHECK `…/2026_11_15_100100_create_organization_members_table.php:41`). Droits portés par le middleware `organization:{rôles}` (`Http/Middleware/EnterOrganization.php:61-63`), **et** par des contrôles dans le code : messagerie externe (`app/Modules/Messaging/Support/StaffAccess.php:24`, `:35`), diffusions (`app/Modules/Notifications/Support/CampaignAccess.php:23`), dépenses sur fonds de tiers (`app/Modules/Charges/Actions/RecordExpense.php:67-68`, `ApproveExpense.php:35`), note de mandat et de bail masquée au comptable (`app/Modules/Mandates/Http/Support/NoteAccess.php:32`, `app/Modules/Leases/Http/Resources/LeaseResource.php:85`), accès support (`Messaging/Support/SupportAccessAdministrators.php:27`). 2FA imposée à `owner` et `admin` d'une agence (`EnterOrganization.php:54-58`), et par `two-factor` sur les routes sensibles.
- Aucun endpoint de matrice. Deux matrices front codées en dur et divergentes : `/equipe/roles` lit `apps/agence/src/features/equipe/rights.ts:1-62` (titulaire, gestionnaire, comptable, **assistante** ; pas d'administrateur) ; `ROLE_RIGHTS` de `packages/gestion/src/features/compte/equipe/schemas.ts:81-86` sert l'invitation (`EquipeInvitePage.tsx`) et résume l'administrateur « tout, sauf l'abonnement et la clôture » (`:17`) alors qu'il clôture (ADR 0031, `OwnerFunds/Http/routes.php:62`).
- **Périmètre de membre non appliqué** : `scope_type = selected` et `scope_property_ids` sont écrits et renvoyés (`Organizations/Actions/InviteMember.php:43-44`, `ChangeMemberAccess.php:24-25`, `Http/Resources/MemberResource.php:32-34`) mais aucun autre module ne les lit et `MembershipDirectory` ne les expose pas. Un membre « limité à certains biens » voit tout. Constat déjà écrit par l'ADR 0027 (`docs/adr/0027-…:97`) et repris par l'ADR 0038 (`0038:22`) ; aucun ADR ne décide de l'appliquer.

## Décision

### 1. Invariants communs

1. **Le mandat est la seule source de vérité des honoraires** (ADR 0025, 0031). Un défaut d'organisation n'est jamais lu par un calcul, une facture, un reversement ni un compte rendu ; il ne réécrit jamais un mandat existant.
2. **Jamais de rétroactivité** : un avenant prend effet à `effective_on ≥ aujourd'hui` (règle existante) ; une échéance déjà émise reste figée (ADR 0026, 0031 § 2).
3. **Montants** : entiers en unités mineures dans la devise de l'organisation, jamais fournie par le client ; taux en points de base entiers ; arrondi au demi supérieur par `moneyphp` ; XOF sans décimales. Aucun `float`, côté serveur comme dans les nouveaux schémas front.
4. **Cloisonnement** (ADR 0006) : `organization_id` du contexte ; ressource d'une autre organisation : 404. Organisation `individual` : 403 sur ce qui relève de l'agence (`mandate_agency_only`, `owner_funds_agency_only`).
5. **Aucun nouveau lien entre modules**, sauf l'usage de `DocumentStore::find` par Mandates (lien Mandates → Documents déjà ouvert, ADR 0005).

### 2. Barème d'honoraires (Mandates, OwnerFunds)

- **`mandate_terms` gagne** `letting_fee_basis_points` (honoraires de relocation, en points de base d'**un mois de loyer hors charges**, nul = non prévu au mandat) et `works_fee_basis_points` (suivi de travaux, en points de base du montant des travaux, nul = non prévu), `smallint unsigned`, CHECK `IS NULL OR BETWEEN 0 AND 10000` (`Checks::add`, ADR 0017). Acceptés par la création et par l'avenant, exposés par `ApiShapes::terms` et par la Resource propriétaire. **Leur facturation reste manuelle** (`fee.letting`, `fee.other`, ADR 0028) ; une proposition de montant calculée par le serveur relève d'un lot ultérieur (question 6). Assiettes à confirmer (point juridique 2 et 3).
- **Avenant signé** : `mandate_terms.signed_file_id` (uuid nullable, sans clé étrangère). Un avenant exige un fichier de sujet `mandate:{ce mandat}`, catégorie `supporting`, analysé `clean` (422 `mandate_amendment_signature_required`, 409 `document_not_clean`). Dans la même transaction, une ligne `mandate_documents` (`kind = amendment`, `uploaded_by_kind = agency`, `shared_at` = maintenant) le rend visible d'office au mandant, comme la pièce signée du bail (ADR 0036). Les lignes antérieures gardent `signed_file_id` nul. Pas de signature en ligne tant que le parcours de l'ADR 0011 n'existe pas.
- **`fee_base` obligatoire à la création** d'un nouveau mandat (`MandateInput::termRules` : `required`). Les mandats existants sans base restent soumis à `fee_base_missing` jusqu'à leur avenant (ADR 0031, inchangé).
- **Pas d'avenant en masse** : « appliquer à tous les mandats » est retiré ; chaque avenant est un acte du mandant.
- **Mode de prélèvement** : aucun champ ; retenue au reversement seulement (ADR 0031 § 3). Changement front seul.
- **Simulation** (OwnerFunds) : `POST /org/{o}/owner-funds/fees/simulations` (`ownerFunds.fees.simulate`), sans aucune écriture. Corps : `mandate_id`, barème proposé (mêmes règles que l'avenant pour `fee_kind`, `fee_basis_points`, `fee_flat_amount`, `fee_base`, `fee_minimum_amount`, `fee_tax_mode`), `months` (1 à 12, défaut 3). Base = mois **clos** les plus récents, lus par `FeeMovements` ; calcul par `FeeCalculator` avec le taux de `ManagementFeeInvoices::vatRatePcm` ; réponse par mois : base loyer et charges, honoraires actuels (relevé `fee_statements` s'il existe, sinon calcul au barème en vigueur), honoraires simulés (HT, taxe, TTC, minimum appliqué), totaux ; aucun mois clos : `data: []` et `meta.reason = no_closed_period`. Rôles : les quatre ; 20/min par utilisateur (coût d'un aperçu, ADR 0031 § 14). Aucun relevé, aucune écriture du grand livre, aucun audit (lecture).

### 3. Défauts d'organisation (Mandates)

- **Modèle de conditions, pas réglage** : `mandate_term_defaults` (Mandates), une ligne par organisation (clé primaire `organization_id`) : `fee_kind`, `fee_basis_points`, `fee_flat_amount`, `currency` (celle de l'organisation), `fee_base` (non nul), `fee_minimum_amount`, `fee_tax_mode`, `payout_day`, `works_limit_amount`, `letting_fee_basis_points`, `works_fee_basis_points`, `lock_version`, `updated_by_user_id`, `datetimes(6)`. Mêmes CHECK que `mandate_terms`. Modèle `Auditable` (avant/après, aucune donnée personnelle).
- **Précédence** : mandat > rien. Le défaut ne sert qu'à **préremplir** le formulaire de création d'un mandat côté client ; le serveur ne complète jamais un champ manquant avec le défaut. Modifier le défaut ne touche aucun mandat ; l'appliquer à un mandat existant passe par un avenant signé.
- Routes : `GET /org/{o}/mandates/term-defaults` (quatre rôles, `mandates.agency`, 120/min ; 404 `mandate_term_defaults_not_found` tant qu'aucun défaut n'est posé) ; `PUT /org/{o}/mandates/term-defaults` (`owner`, `admin` ; 2FA déjà imposée à ces rôles ; `lock_version` sauf à la première écriture, 409 `mandate_stale_version` ; 20/min).
- **Autres blocs de la page** :
  - TVA : lecture seule, régime de l'identité légale et taux de la juridiction (aucun stockage) ;
  - « Retenue des honoraires » : retirée (ADR 0031) ;
  - « Compte rendu joint au reversement » : retiré, aucun consommateur (à reprendre avec la notification de reversement au mandant, ADR 0031 § 12) ;
  - base « loyers appelés » : retirée (fait générateur = encaissement, ADR 0031 § 3) ;
  - compte séquestre et dernier rapprochement : lecture de Banking existante, réservée à `owner`, `admin`, `accountant` ; saisie de l'IBAN par la route Banking existante (2FA, preuve récente). **Changement front seul.**

### 4. Devis : liste transversale (Maintenance)

- `GET /org/{o}/quotes` (`maintenance.quotes.index`), groupe de lecture existant (quatre rôles, 120/min, `maintenance.private`). Filtres : `status[]` (enum), `intervention_id`, `supplier_party_id` (uuid). Curseur `PaginatesWithCursor` sur `id` décroissant (UUID v7, ordre de création, sans dépendre de `created_at`).
- Resource `QuoteSummaryResource` : champs de `QuoteResource` sans les lignes, plus `intervention` (`id`, `reference`, `status`, `unit_id`) et `approval` de ce devis (`status`, `ceiling_amount`, `decide_before`) ou nul. Plafond et dépassement viennent du serveur (`ceiling_amount` figé, ADR 0029), jamais d'un calcul navigateur.
- Index : `intervention_quotes_org_status_id_idx` `(organization_id, status, id)` et `intervention_quotes_org_supplier_id_idx` `(organization_id, supplier_party_id, id)`.
- Nombre de requêtes constant (chargement groupé des interventions et des accords).

### 5. Bibliothèque de documents (Documents, Mandates)

- **Dépôt volontaire** : `library_documents` (Documents) : `stored_file_id` (clé composite `(organization_id, stored_file_id)` vers `stored_files`, même module), `kind` (`mandate`, `lease`, `diagnostic`, `photo`, `other`, CHECK), `archived_at`, `filed_by_user_id`, `lock_version`, `datetimes(6)`. Unique `library_documents_org_file_unique` `(organization_id, stored_file_id)` ; index `library_documents_org_kind_id_idx` `(organization_id, kind, id)` et `library_documents_org_archived_id_idx` `(organization_id, archived_at, id)`. La bibliothèque ne liste **que** ces entrées, jamais l'ensemble de `stored_files` (devis, relevés, pièces de recouvrement et fichiers des espaces restent dans leur module).
- **Correspondance avec la maquette** : `Mandat` → `mandate` (sujet `mandate`), `Bail` → `lease` (sujet `lease`), `Photo` → `photo`, `Autre` → `other`, `Diagnostic` sans échéance → `diagnostic` ; `Diagnostic` ou `Conformité` **avec date de validité** → pièce à échéance (`POST /documents/certificates`, ADR 0021 : rappels et renouvellement) ; `Quittance`, `Compte rendu`, `Facture` → pièces émises par Rent, Reporting, Invoicing (liens de filtre, pas de dépôt) ; `Devis` → Maintenance (`/devis`).
- **Sujets** : `SubjectType` gagne `mandate` ; une nature impose son sujet (`mandate` → `mandate`, `lease` → `lease` ; sinon tout sujet admis ou aucun) : 422 `library_kind_subject_mismatch`.
- **Routes** (préfixe `/org/{o}/documents`) : `POST /library` (multipart : `file`, `kind`, `subject_type`, `subject_id`, `display_name` ≤ 120 caractères, `retention_until`) crée fichier et entrée dans une transaction ; `GET /library` (filtres `kind`, `subject_type`, `subject_id`, `archived`, curseur sur `id`) ; `POST|DELETE /library/{entry}/archive`. Lecture : quatre rôles (comme le téléchargement générique), 120/min ; écriture : `owner`, `admin`, `manager`, 30/min. Archiver ne supprime rien.
- **Nom d'affichage** : `display_name` facultatif à l'envoi, nettoyé par `FileNames::display` puis `aligned` sur le type détecté ; à défaut, le nom d'origine (comportement actuel).
- **Description libre** : non retenue en v1 (minimisation ; elle exigerait un effacement à l'anonymisation, donc un nouvel événement Parties ⇢ Documents).
- **Partage** : pas d'indicateur dans la liste (Documents ne lit ni Mandates ni Leases : cycle). Le détail compose les lectures existantes.
  - Locataire : route Leases existante (ADR 0036), fichier de sujet `lease:{ce bail}`.
  - Mandant (nouveau, Mandates, miroir de Leases) : `GET|POST /org/{o}/mandates/{mandate}/documents`, `DELETE …/documents/{document}` (`owner`, `admin`, `manager`, `mandates.agency`, 60/min). Fichier de sujet `mandate:{ce mandat}`, catégorie `supporting|certificate`, `clean` (lu par `DocumentStore::find`) : sinon 422 `mandate_document_invalid` ou 409 `document_not_clean`. Le retrait pose `revoked_at`, le fichier reste. Notification au mandant : type `owner.document_shared` (ADR 0027), gabarit sans nom de fichier.
- **Antivirus** (ADR 0033) : toute pièce déposée est analysée (`FileCategory::scanned`) ; la liste expose `scan_status` ; téléchargement et partage refusés tant que le fichier n'est pas `clean`.
- **Conservation** : `retention_until` fourni ou nul ; aucune purge automatique de la bibliothèque en v1 ; durées par nature à confirmer (point juridique 4).
- **2FA** : règles d'entrée existantes (`owner`, `admin` d'agence, ou toute l'organisation si elle l'impose) ; pas de preuve récente supplémentaire (même niveau que le partage au locataire, ADR 0036).
- Organisation `individual` : bibliothèque permise, partage mandant refusé (`mandate_agency_only`).

### 6. Matrice des droits (Organizations)

- **Rôles inchangés** : `owner`, `admin`, `manager`, `accountant`. **Le rôle « assistante » est retiré de la maquette** ; la colonne « Administrateur » y est ajoutée.
- **Matrice déclarée dans le code** (Organizations, `Support/RoleMatrix`) : liste de domaines, chacun avec ses noms de routes (motifs) et, par rôle, un niveau `none | read | prepare | write | write_two_factor`. Elle **décrit** les droits ; l'application reste aux middlewares et aux contrôles existants.
- `GET /org/{o}/roles` (`organizations.roles.index`), tout membre (comme `members.index`), réponse statique : domaines (clé, niveaux par rôle, mention 2FA) et `current_role`. Libellés côté front par clé de domaine. Pas de rôles configurables.
- **Test de cohérence** (`tests/Feature/Organizations/RoleMatrixTest.php`) : chaque route `/org/{organization}` appartient à exactement un domaine ; les rôles de son middleware `organization:` sont égaux à ceux du domaine pour sa méthode ; pour chaque domaine, une route représentative est appelée avec chaque rôle (attendu 403 ou non 403), ce qui couvre aussi les contrôles portés par le code (messagerie externe, diffusions, dépenses sur fonds de tiers). Une route nouvelle non rattachée fait échouer la suite.
- **Matrice proposée**, vérifiée route par route (`php artisan route:list --path=api/v1/org --json`, 359 routes, 2026-11-20) et dans les contrôles cités au contexte. `É` écriture, `É2` écriture avec 2FA obligatoire, `P` préparation, `L` lecture, `—` aucun :

| Domaine | Sources | owner | admin | manager | accountant |
|---|---|---|---|---|---|
| Mandats, mandants, barème | `Mandates/Http/routes.php:34`, `:41` | É | É | É | L sans note (`NoteAccess.php:32`) |
| Parties (fiches) ; anonymisation | `Parties/Http/routes.php:40`, `:45`, `:77` | É ; É | É ; É | É ; — | L ; — |
| Comptes bancaires des parties, accès mandant | `Parties/Http/routes.php:62`, `:73` | É2 + preuve | É2 + preuve | É2 + preuve | — |
| Biens et lots | `Properties/Http/routes.php:24`, `:34` | É | É | É | L |
| Baux ; congés, assurance, pièces partagées | `Leases/Http/routes.php:58`, `:67` | É | É | É | L sans note ni garanties (`LeaseResource.php:85`) ; — |
| États des lieux | groupe `owner,admin,manager` (route:list) | É | É | É | — |
| Loyers : lecture, encaissement | `Rent/Http/routes.php:34`, `:46` | É | É | É | L, saisie d'encaissement |
| Loyers : avis, annulations, quittances ; remboursement | `Rent/Http/routes.php:54` ; `:50` | É ; É2 | É ; É2 | É ; — | — ; É2 |
| Impayés et recouvrement | `Recovery/Http/routes.php:25`, `:34` | É | É | É | L |
| Factures ; avoirs | `Invoicing/Http/routes.php:28` ; `:38` | É ; É | É ; É | É ; — | É ; É |
| Honoraires, reversements : lecture et préparation ; validation, exécution, retenues levées, apports, clôture ; export | `OwnerFunds/Http/routes.php:40`, `:55` ; `:62` ; `:77` | P ; É2 ; É2 | P ; É2 ; É2 | P ; — ; — | P ; É2 ; É2 |
| Dépenses et charges ; fonds de tiers ; émission des décomptes | `Charges/Http/routes.php:53` ; `:69` et `RecordExpense.php:67-68` ; `:72` | É ; É2 + preuve ; É | É ; É2 + preuve ; É | É ; — ; É | É ; É2 + preuve ; — |
| Banque et rapprochement ; comptes suivis | `Banking/Http/routes.php:39`, `:54`, `:73` ; `:84` | É (2FA) ; É2 + preuve | É (2FA) ; É2 + preuve | — | É (2FA) ; — |
| Grand livre ; périodes | `Accounting/Http/routes.php:12` ; `:19` | L ; L | L ; L | — ; L | L ; L |
| Interventions et devis ; factures prestataires ; imputations ; règlements | `Maintenance/Http/routes.php:79`, `:88` ; `:122` ; `:127` ; `:129`, `:131` | É ; É ; É ; É2 | É ; É ; É ; É2 | É ; É ; — ; — | L ; É ; É ; É2 |
| Comptes rendus : préparer ; publier ; export des lignes | `Reporting/Http/routes.php:42` ; `:59` ; `:65` | É ; É ; É2 | É ; É ; É2 | É ; É ; — | É ; — ; É2 |
| Messages locataires et mandants, diffusions | `StaffAccess.php:24`, `CampaignAccess.php:23` | É (envoi de diffusion É2 + preuve) | idem | idem | messagerie interne seulement |
| Accès du support | `SupportAccessAdministrators.php:27` | É2 + preuve | É2 + preuve | — | — |
| Documents : téléchargement ; dépôt, pièces à échéance | `Documents/Http/routes.php:14` ; `:20` | L ; É | L ; É | L ; É | L ; — |
| Paiements en ligne ; compte PSP | `Payments/Http/routes.php:19` ; `:22-23` | L ; É2 + preuve | L ; É2 + preuve | L ; — | L ; — |
| Équipe, identité légale, sécurité, référentiels | `Organizations/Http/routes.php:25`, `:31` ; `Catalog/Http/routes.php:31`, `:38` | É | É | L | L |

- `owner` et `admin` ont les mêmes routes ; seul le titulaire ne peut être retiré, désactivé ni changé de rôle (`Organizations/Support/TeamRules.php:16`).
- **Écarts de la maquette à corriger** (`rights.ts:50-62`) : reversements (gestionnaire « lecture » → prépare et modifie le barème ; comptable « modifier » → ne modifie pas le barème) ; comptes rendus (comptable « modifier » → ne publie pas) ; messages (comptable « lecture » → aucun accès aux fils locataire et mandant) ; interventions (comptable « lecture » → saisit factures, imputations et règlements) ; conformité (gestionnaire « lecture » → écrit ; comptable « aucun » → lit) ; équipe (gestionnaire et comptable « aucun » → lecture) ; encaissements (comptable « modifier » → saisie seule) ; banque, grand livre et clôture absents.
- **Périmètre `selected`** : refusé à l'invitation et à la modification (422 `member_scope_unsupported`) jusqu'à un ADR qui l'applique dans chaque module ; les adhésions existantes en `selected` sont signalées par une commande `organizations:report-scoped-members` (lecture seule) et affichées « périmètre non appliqué ». Aucune donnée n'est modifiée.

### 7. Sécurité

- Chaque route : `auth:sanctum`, `space:organization`, `no-operator-token`, `organization:{rôles}` ; aucune route publique.
- Le client n'envoie jamais `organization_id`, devise, montant calculé, statut, auteur ni `shared_at` ; liste blanche des champs ; `lock_version` sur toute modification.
- Fichiers : type vérifié sur le contenu (`FileInspector`), 10 Mo, nom régénéré, stockage privé, `clean` exigé avant lecture ou partage, `Cache-Control: private, no-store`.
- Matrice : réponse statique, sans membre ni donnée personnelle.
- Simulation : bornée (12 mois, 20/min), sans écriture (test).
- Audit (ADR 0016, sans montant ni donnée personnelle dans `metadata`) : `mandates.terms.amended` (existant, plus `signed_file_id`), `mandates.term_defaults.updated` (Auditable), `mandates.document.shared|unshared`, `documents.library.filed|archived|restored`, `organizations.member.scope_refused`.
- `/security-review` sur les lots 2, 4 et 5.

### 8. Codes d'erreur (ADR 0014)

Mandates : `mandate_amendment_signature_required` 422, `mandate_document_invalid` 422, `mandate_document_not_found` 404, `mandate_term_defaults_not_found` 404 ; Documents : `document_not_clean` 409, `library_document_not_found` 404, `library_kind_subject_mismatch` 422 ; Organizations : `member_scope_unsupported` 422. Réutilisés : `mandate_stale_version`, `mandate_agency_only`, `owner_funds_agency_only`, `fee_base_missing`.

## Options écartées

- **Défaut d'organisation appliqué au calcul quand le mandat est muet** : un taux deviné facturé à un tiers (déjà écarté pour `fee_base`, ADR 0031) ; deux sources de vérité.
- **Magasin `settings` de l'ADR 0018 pour le modèle de conditions** : valeurs monétaires en JSON sans CHECK, validation dupliquée de `mandate_terms`, chantier transverse pour un seul consommateur ; reste la cible des réglages scalaires (`owner_funds.*`, `reporting.*`, `maintenance.*`).
- **Avenant en masse** : modifie N contrats sans l'accord écrit de chaque mandant.
- **Avenant sans pièce signée** : aucune preuve de l'accord du mandant sur sa rémunération.
- **Calcul et facture automatiques de la relocation et du suivi de travaux dès maintenant** : assiettes et plafonds non vérifiés ; un lien Maintenance → Invoicing ou Leases → Invoicing serait nécessaire.
- **Simulation sur le mois ouvert** : base incomplète, résultat trompeur ; l'aperçu de reversement estime déjà le mois ouvert.
- **Liste des devis dans Reporting** : lecture SQL réservée aux faits agrégés ; Maintenance possède le devis.
- **Bibliothèque = tous les `stored_files`** : exposerait par liste des pièces privées d'autres modules (devis, recouvrement, relevés) aujourd'hui accessibles seulement par leur clé.
- **Dix catégories de la maquette dans Documents** : doublonnerait les pièces émises, les devis et les pièces à échéance de leurs modules.
- **Partage stocké dans Documents** (`shared_with_mandant`) : Documents devrait lire Mandates et Leases, qui l'appellent déjà (cycle).
- **Rôle `assistant`** : environ vingt groupes de routes, trois contrôles en code et les audiences de notification à modifier, pour un besoin couvert par le gestionnaire ; à rouvrir par ADR sur demande client.
- **Rôles et droits configurables en base** : les middlewares liraient la base à chaque requête ; contraire à l'amendement de l'ADR 0003 (rôles fixes).
- **Matrice codée seulement dans le front** : divergence silencieuse, déjà constatée (deux matrices fausses).
- **Appliquer le périmètre `selected` dans ce lot** : touche tous les modules de gestion ; mérite son ADR.

## Conséquences

- **Mandates** : colonnes `letting_fee_basis_points`, `works_fee_basis_points`, `signed_file_id` sur `mandate_terms` ; table `mandate_term_defaults` ; Actions `ShareMandateDocument`, `UnshareMandateDocument`, `UpdateMandateTermDefaults` ; `fee_base` requis à la création.
- **Documents** : `SubjectType::Mandate` ; table `library_documents` ; `display_name` à l'envoi ; Actions `FileLibraryDocument`, `ArchiveLibraryDocument`.
- **Maintenance** : `ListQuotesController`, `ListQuotesRequest`, `QuoteSummaryResource`, deux index.
- **OwnerFunds** : `SimulateFeesController`, `SimulateFeesRequest` ; réutilise `FeeMovements`, `FeeCalculator`.
- **Organizations** : `RoleMatrix`, `GET /roles`, refus de `selected`, commande de signalement.
- **Front seul** (sans attendre le serveur) :
  - avenant et création : `fee_base`, `fee_minimum_amount`, `fee_tax_mode` dans les payloads et `apiMandateTermsSchema` ;
  - barème : choix d'un **mandat**, `collection` et `applyToAll` retirés, bases `rent | rent_and_charges`, pourcentages en points de base entiers, date ≥ aujourd'hui ;
  - réglages : TVA en lecture, `retainFees`, `attachReport`, `rents_billed` retirés, bloc séquestre branché sur Banking et masqué au gestionnaire ;
  - devis : statuts serveur, message saisi à la création (≤ 500), plafond lu dans `approval` ;
  - documents : correspondance des catégories, validité → pièce à échéance, description retirée ;
  - rôles : colonne administrateur, assistante retirée, résumé de l'administrateur corrigé ;
  - monnaie : exposant de la devise (XOF : 0) au lieu de `× 100`, `assertEuro` retiré.
- **Exploitation** : aucune nouvelle variable ni tâche planifiée hors `organizations:report-scoped-members` (ponctuelle).
- **Risques** : un mandat créé sans base avant ce lot reste à reprendre par avenant ; l'exigence d'avenant signé ralentit les changements de barème (voulu) ; refuser `selected` change le comportement de l'invitation.

## Plan de lots

Backend d'abord ; chaque lot sort par `composer check` sans test ignoré. Tests communs à chaque route : 401 sans session, 403 par rôle refusé, jeton opérateur refusé, 404 sur la ressource d'une autre organisation, organisation `individual` (403 ou permise selon la décision), nombre de requêtes constant (1, 10, 100 éléments), Resources sans champ superflu.

| Lot | Contenu | Critères de sortie |
|---|---|---|
| F0. Front seul | avenant (`fee_base`, minimum, mode de taxe), barème et réglages nettoyés, monnaie XOF, matrice corrigée à la main | `pnpm -r check` ; payload d'avenant vérifié sur l'API réelle (champ renvoyé par `ApiShapes`) ; un mandat en XOF s'affiche sans erreur |
| 1. Devis | `GET /quotes`, index, `QuoteSummaryResource` | filtre statut, intervention, prestataire ; devis d'une autre organisation jamais listé ; curseur stable sur 3 pages ; requêtes constantes ; `approval` nul ou figé |
| 2. Barème | colonnes `mandate_terms`, avenant signé et partage d'office, `fee_base` requis, `mandate_term_defaults` | avenant sans pièce 422 ; pièce `pending` 409 ; pièce d'un autre mandat 422 ; défaut modifié sans effet sur les mandats existants (test d'égalité avant/après) ; `lock_version` périmée 409 ; comptable 403 en écriture ; CHECK bp hors bornes refusé en base |
| 3. Simulation | route OwnerFunds | aucun `fee_statements` ni `journal_*` écrit ; arrondis à 1, 3, 7 unités mineures et XOF ; mois ouvert ignoré ; `fee_base_missing` sur proposition sans base ; 21ᵉ appel/min 429 |
| 4. Bibliothèque et partage mandant | `library_documents`, `SubjectType::Mandate`, `display_name`, routes Mandates | nature et sujet incohérents 422 ; fichier `pending` non téléchargeable ni partageable ; partage retiré → 404 côté propriétaire ; archivage sans suppression ; mandant d'un autre mandat ne voit rien ; `ArchTest` : Documents n'importe aucun module |
| 5. Matrice | `RoleMatrix`, `GET /roles`, test de cohérence, refus de `selected` | route non rattachée → suite rouge (test par mutation) ; chaque domaine exercé pour les quatre rôles ; `selected` 422 ; commande de signalement sans écriture |
| F1 à F5 | fronts des lots 1 à 5 | `pnpm -r check` ; vérification navigateur sur l'API réelle ; famille passée à `familyHasApiSource: true` |

## Points à valider par un juriste ou un expert-comptable

1. Forme de l'avenant au mandat de gestion : écrit et signature du mandant exigés pour toute modification de rémunération (loi n° 70-9 du 2 janvier 1970 et décret n° 72-678, **à confirmer**) ; valeur d'un PDF signé numérisé.
2. Honoraires de relocation à la charge du mandant : assiette (loyer hors charges d'un mois), plafonds éventuels (le décret n° 2014-890 vise la part du locataire, **à confirmer**), TVA.
3. Honoraires de suivi de travaux : assiette HT ou TTC, seuil de déclenchement.
4. Durées de conservation par nature de la bibliothèque (mandat, bail, diagnostic, photo).
5. Partage au mandant de pièces contenant des données du locataire (bail, état des lieux) : base légale et minimisation (RGPD).
6. Belgique, Luxembourg, Québec : rémunération de l'agent et forme des avenants (non codés).

## Questions fermées pour l'utilisateur

Ma recommandation est toujours la première.

1. **Le mandat seul fait foi ; le défaut d'organisation ne sert qu'à préremplir la création, sans effet sur les mandats existants ?** Alternative : défaut appliqué au calcul quand le mandat est muet.
2. **Défauts dans une table typée `mandate_term_defaults` (Mandates) ?** Alternative : premier usage du magasin `settings` de l'ADR 0018.
3. **`fee_base` obligatoire à la création d'un mandat ?** Alternative : reste facultatif, `fee_base_missing` au calcul.
4. **Avenant aux honoraires avec pièce signée obligatoire, partagée d'office au mandant ?** Alternative : pièce facultative.
5. **Pas d'avenant en masse ; « appliquer à tous » retiré ?** Alternative : route de lot créant un avenant par mandat.
6. **Taux de relocation et de suivi de travaux enregistrés au mandat, facturation manuelle (`fee.letting`, `fee.other`) en attendant un lot de proposition serveur ?** Alternative : calcul et facture automatiques dès ce lot.
7. **Simulation sur mois clos seulement, sans écriture ?** Alternative : inclure le mois ouvert en estimation.
8. **Bibliothèque par dépôt volontaire (`library_documents`), jamais la liste de tous les fichiers ?** Alternative : lister tous les `stored_files` hors exclusions.
9. **Cinq natures (`mandate`, `lease`, `diagnostic`, `photo`, `other`), le reste renvoyé à son module ?** Alternative : les dix catégories de la maquette.
10. **Description libre retirée en v1 ?** Alternative : 500 caractères effacés à l'anonymisation (nouvel événement Parties ⇢ Documents).
11. **Partage au mandant par une route Mandates miroir de Leases, fichier `clean` exigé ?** Alternative : partage stocké dans Documents (cycle).
12. **Rôle « assistante » supprimé de la maquette ?** Alternative : créer le rôle `assistant` (ADR dédié).
13. **Matrice déclarée dans Organizations, servie par `GET /roles`, gardée par un test de cohérence ?** Alternatives : matrice front seule ; rôles configurables en base.
14. **Périmètre `selected` refusé jusqu'à son ADR, adhésions existantes signalées ?** Alternatives : l'appliquer maintenant dans chaque module ; le laisser avec un avertissement.
15. **« Retenue des honoraires » et « compte rendu joint » retirés des réglages ?** Alternative : les garder affichés en lecture seule.

## Amendements nécessaires (appliqués le 2026-11-20)

- **ADR 0003** : matrice des droits par rôle servie par `GET /org/{o}/roles` ; périmètre `selected` non appliqué, refusé jusqu'à son ADR.
- **ADR 0005** : Mandates → Documents étendu à `DocumentStore::find` (partage au mandant, avenant signé) ; aucun autre lien.
- **ADR 0014** : codes de la décision 8.
- **ADR 0016** : actions d'audit de la décision 7.
- **ADR 0018** : écart assumé, modèle de conditions typé dans Mandates ; `accounting_settings` signalé comme écart existant.
- **ADR 0021** : diagnostics et pièces de conformité avec validité déposés comme pièces à échéance depuis la bibliothèque.
- **ADR 0025** : `letting_fee_basis_points`, `works_fee_basis_points`, `signed_file_id` ; `fee_base` requis à la création ; `mandate_term_defaults` ; écriture de `mandate_documents` par l'agence ; avenant signé partagé d'office.
- **ADR 0027** : type `owner.document_shared`.
- **ADR 0029** : liste transversale `GET /quotes`.
- **ADR 0031** : simulation des honoraires ; taux de relocation et de suivi de travaux enregistrés, facturation encore manuelle (reste à faire précisé).
- **ADR 0032** : partage de documents au mandant écrit par l'agence (`mandate_documents`).
- **ADR 0033** : partage refusé tant que la pièce n'est pas `clean`.
