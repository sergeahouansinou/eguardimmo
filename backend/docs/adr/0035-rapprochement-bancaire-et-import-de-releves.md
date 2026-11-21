# ADR 0035 — Rapprochement bancaire et import de relevés (module Banking)

Statut : accepté (2026-11-19), recommandations validées telles quelles. Articulé avec l'ADR 0034 (dépenses, module Charges, proposé). Ferme le « reste à faire : rapprochement bancaire (Payments) » de l'ADR 0031 et donne un serveur à l'écran « Import bancaire » de `packages/gestion`. Complète l'ADR 0005 (modules), l'ADR 0006 (cloisonnement), l'ADR 0007 (grand livre seule source des soldes), l'ADR 0008 (juridictions), l'ADR 0011 (prestataires qualifiés), l'ADR 0016 (journal), l'ADR 0017 (MySQL et intégrité), l'ADR 0026 (encaissements), l'ADR 0028 (règlements de factures) et l'ADR 0031 (fonds de tiers, clôture). Amendements listés en fin de document, **non appliqués**. Les obligations comptables et RGPD citées viennent de sources secondaires : **à confirmer** avec un expert-comptable et le DPO (ADR 0011). Les champs ISO 20022 cités ont été relus dans le rapport de définition officiel (camt.053.001.09, projet de 2020) ; leur présence dans chaque version prise en charge est **à vérifier sur le schéma XSD de cette version**.

## Contexte

Constaté dans le code et les écrans :

- **Aucun relevé bancaire n'entre dans le serveur.** Le grand livre connaît `Bank` (1000) et `TrustBank` (1010), un compte par rôle et par organisation (`accounts`, unique `(organization_id, role)`). Les écritures de banque viennent de saisies : encaissements (Rent, ADR 0026), règlements de factures (Invoicing, ADR 0028), règlements de prestataires (Maintenance), exécutions de reversement, prélèvements et apports au compte de tiers (OwnerFunds, ADR 0031). Rien ne prouve que ces écritures correspondent à la banque.
- **L'équation de cantonnement (ADR 0031, décision 7) se calcule sur `TrustBank` du grand livre**, jamais sur le solde réel du compte de tiers : sans rapprochement, la conformité affichée repose sur les seules saisies.
- **Aucun compte bancaire de l'organisation n'existe.** `bank_accounts` (Parties) porte les comptes des fiches (IBAN chiffré, `iban_last4`, `iban_hash` HMAC par organisation, une ligne par changement). L'écran agence « Réglages > Finances » affiche un « compte séquestre » (IBAN masqué, banque, titulaire, « Dernier rapprochement », « Seuls les quatre derniers chiffres de l'IBAN sont conservés ») tenu en démonstration.
- **Module Payments** : l'ADR 0005 lui attribue « rapprochement » ; l'ADR 0028 le réserve aux PSP ; il n'existe pas.
- **Clôture** : `Accounting\Actions\CloseMonth` reçoit les motifs de refus de l'appelant (`$blockers`) ; la route est hébergée par OwnerFunds (`ownerFunds.periods.close`).
- **Fronts** :
  - `packages/gestion`, `ImportBancairePage` (bailleur autonome, `apps/proprietaire` `/finances/import-bancaire`, gatée) : collage ou fichier CSV « date ; libellé ; montant signé », 500 lignes, compte en texte libre, dédoublonnage par `date|libellé|montant`, onglets « À rapprocher », « Rapprochées », « Archives », proposition par nom du locataire dans le libellé, actions valider, choisir une autre échéance, créer une dépense (débits), diviser l'opération, ignorer, restaurer, « Automatisations » (trois bascules). « Rien n'est enregistré sans votre validation. »
  - `apps/agence` : encaissements « À rapprocher » (chèque et espèces) avec bouton « Rapprocher » sans relevé ; compte des mandants avec date du dernier rapprochement ; écrans « Fonds de tiers » et « Clôture » branchés sur l'API (ADR 0031). Pas d'écran d'import.
- **Formats** (sources : ISO 20022, CFONB, à confirmer avec les banques des agences pilotes) : camt.053 (relevé ISO 20022, versions .001.02 encore courante et .001.08 et suivantes), MT940 (SWIFT), CFONB 120 (format français à enregistrements de 120 caractères, encore servi par EBICS ; le CFONB annonce la migration des MT940 relayés vers camt.053 d'ici novembre 2028), CSV propres à chaque banque.

## Décision

### 1. Invariants

1. **Le grand livre reste la seule source des soldes** (ADR 0007). Un relevé est une **pièce externe** : il ne crée jamais une écriture seul ; une écriture née d'une ligne passe par l'Action du module qui la porte, sur validation d'une personne.
2. **Pointer n'écrit rien au grand livre** : un pointage relie des lignes de relevé à des lignes d'écriture `Bank` ou `TrustBank` existantes.
3. **Relevés et lignes immuables** (ajout seul, déclencheurs) ; une erreur d'import s'annule, ne s'efface pas.
4. **Aucune validation automatique en phase 1** : le serveur propose, une personne valide (comme l'écran).
5. **Règles déterministes et explicables** ; aucune IA, aucun envoi de libellé à un tiers.
6. **eGuardImmo ne détient ni fonds ni identifiants bancaires** (ADR 0011) : pas de connexion à une banque avec un identifiant client, pas de récupération d'écran, pas d'ordre de paiement.
7. **IBAN jamais en clair** hors de la requête qui le reçoit : HMAC et quatre derniers caractères.

### 2. Module

- **Nouveau module `Banking`** (famille Gestion, `php artisan make:module Banking`) : comptes bancaires de l'organisation, relevés, lignes, pointages, règles de proposition, états de rapprochement. Il sert l'agence et le bailleur autonome.
- **Dépendances** (amendement de l'ADR 0005) : Banking → Accounting (`BankBook`, nouvelle lecture des lignes `Bank`/`TrustBank` ; `Ledger` pour les seuls frais bancaires ; `LedgerReader`, `LedgerAggregates::version`), Rent (`RentCollections`, nouveau : encaissement depuis une ligne ; `RentLedger`), Invoicing (`InvoiceSettlements`, nouveau ; `InvoiceLedger`), Parties (`PartyDirectory`, `PartyBankAccounts::partiesByIban`, nouveau), Documents (`DocumentStore`), Organizations (`MembershipDirectory`, `OrganizationDirectory`), Identity (`TwoFactorProofs`). **OwnerFunds → Banking** (`BankReconciliationStatus`, motifs de clôture). Aucun de ces modules n'appelle Banking : pas de cycle.
- Payments garde les PSP ; un versement groupé d'un PSP sera pointé dans Banking (lot 8).

### 3. Modèle de données (UUID v7, `datetime(6)`, `bigint` en unités mineures, `Checks::add`, jamais `ENUM`)

- **`organization_bank_accounts`** : `ledger_role` (`bank` | `trust_bank`), `label`, `bank_name`, `holder_name`, `identifier_kind` (`iban` | `other`), `identifier_hash` (HMAC, clé `BANKING_HMAC_KEY`, organisation dans le calcul comme `Parties\Support\Fingerprinter`), `identifier_last4`, `country`, `currency`, `status` (`active` | `closed`), `reconciliation_from` (date), `opening_bank_balance` (signé, nul tant qu'aucun relevé), `replaces_id`, `csv_profile` (JSON : séparateur, encodage, colonnes, format de date et de montant). **Un compte actif par `ledger_role`** (colonne générée unique). Un changement d'IBAN crée une ligne et ferme l'ancienne ; jamais de réécriture.
- **`bank_statements`** : `bank_account_id` (clé composite), `source` (`camt053` | `mt940` | `cfonb120` | `csv` | `aggregator`), `format_version`, `stored_file_id` (Documents), `file_sha256`, `statement_ref` (`Stmt/Id` ou `:20:`), `sequence` (`ElctrncSeqNb`, `LglSeqNb` ou `:28C:`), `period_from`, `period_to`, `opening_balance`, `closing_balance` (signés, nuls pour un CSV sans solde), `currency`, `lines_total`, `lines_imported`, `lines_duplicated`, `idempotency_key`, `fingerprint`, `imported_by_user_id`, `voided_at`, `voided_by_user_id`, `void_reason`. Unique `(organization_id, bank_account_id, file_sha256)`.
- **`bank_statement_lines`** : `statement_id`, `bank_account_id`, `booking_date`, `value_date`, `direction` (`credit` | `debit`), `amount` (> 0), `currency`, `original_amount` et `original_currency` (information, jamais convertis), `reversal` (`RvslInd`), `bank_reference` (`AcctSvcrRef`), `end_to_end_id`, `transaction_code` (`BkTxCd` : domaine, famille, sous-famille ou propriétaire), `label` (≤ 500, normalisé UTF-8), `remittance_reference` (référence structurée), `counterparty_name` (≤ 140), `counterparty_hash`, `counterparty_last4`, `dedup_key` (char 64), `occurrence`, `state` (`unmatched` | `matched` | `ignored`), `ignore_reason`, `lock_version`. Unique `(organization_id, bank_account_id, dedup_key, occurrence)`. Seuls `state`, `ignore_reason`, `lock_version` changent (déclencheur).
- **`bank_matches`** et **`bank_match_items`** : un pointage relie N lignes de relevé à M lignes d'écriture (`side` = `statement_line` | `journal_line`, `ref_id`, `amount`). `kind` (`suggested` | `manual` | `settled`), `rule`, `confidence`, `explanation` (JSON de codes et d'identifiants, sans texte libre), `matched_by_user_id`, `undone_at`, `undone_by_user_id`, `undo_reason`. Colonne générée `active_key` (référence tant que non défait) **unique par (organisation, côté)** : une ligne ou une écriture n'appartient qu'à un pointage vivant. Ajout seul, sauf le passage de `undone_*` de nul à renseigné.
- **`bank_suggestions`** : propositions calculées (ligne, cibles, règle, score, explication, `computed_at`, `ledger_version`). Cache recalculable, hors `Auditable`, purgé à la validation (exception justifiée, ADR 0016).
- **`bank_rules`** (« Automatisations ») : conditions (libellé contient, contrepartie connue par empreinte, code opération, plage de montant, sens) → proposition (bail ou partie, catégorie de frais, ignorer). `position`, `active`, `lock_version`. Elles proposent, n'écrivent jamais.
- **`bank_counterparty_links`** (lot 3) : empreinte de contrepartie → partie, compteur de confirmations, date ; nourri par chaque validation.
- **`bank_reconciliations`** : compte, `as_of` (dernier jour du mois), `bank_balance`, `book_balance`, totaux des lignes non pointées, des écritures non pointées et des lignes ignorées, `unexplained_difference`, `items` (JSON d'identifiants et de montants), `ledger_version`, `status` (`draft` | `validated` | `superseded`), `validated_by_user_id`, `validated_at`, `supersedes_id`. Immuable une fois validé (déclencheur).

### 4. Import

- **Formats** : lot 1, **CSV** (profil par compte, aperçu des 20 premières lignes avant import ; le collage de l'écran est envoyé comme un CSV) et **camt.053** (.001.02 et .001.08, à confirmer avec les banques pilotes) ; lot 6, **MT940** et **CFONB 120** à la demande. Un contrat `StatementParser` par format (plusieurs implémentations dès le départ : interface justifiée). Chaque analyseur rend les mêmes `StatementLineData`.
- **camt.053, éléments lus** (rapport ISO 20022) : `Stmt/Id` [1..1], `ElctrncSeqNb`, `LglSeqNb`, `FrToDt`, `CpyDplctInd`, `Acct` [1..1] (IBAN ou `Othr`), `Bal` [1..*] avec les types `OPBD` et `CLBD` de la liste externe `ExternalBalanceType1Code`, `Ntry` [0..*] : `Amt` [1..1] et sa devise, `CdtDbtInd` [1..1], `RvslInd`, `Sts` [1..1] (seul `BOOK` de `ExternalEntryStatus1Code` est importé), `BookgDt`, `ValDt`, `AcctSvcrRef`, `BkTxCd` [1..1], `NtryDtls/TxDtls` : `Refs/EndToEndId`, `RltdPties` (`Dbtr`, `DbtrAcct`, `Cdtr`, `CdtrAcct`), `RmtInf` (`Ustrd`, `Strd/CdtrRefInf/Ref`), `AmtDtls`. Une écriture regroupant plusieurs transactions (remise de chèques) reste **une** ligne, détails en information.
- **Contrôle du fichier** : type établi sur le contenu, jamais sur l'extension (espace de noms `urn:iso:std:iso:20022:tech:xsd:camt.053.001.xx` en liste blanche, blocs SWIFT, enregistrements CFONB, texte UTF-8 ou Windows-1252 déclaré) ; 10 Mo et 20 000 lignes au plus (`BANKING_IMPORT_MAX_BYTES`, `BANKING_IMPORT_MAX_LINES`) ; XML sans `DOCTYPE`, sans entité externe, `LIBXML_NONET`, profondeur bornée, validation par le XSD officiel de la version ; aucune archive ZIP. Fichier stocké par `DocumentStore` (nouvelle catégorie `bank_statement` : privé, nom régénéré, hors racine web, jamais exécutable, analyse antivirus de l'ADR 0033) ; téléchargement journalisé.
- **Compte** : l'identifiant du relevé (camt `Acct`, MT940 `:25:`) doit avoir l'empreinte du compte choisi (422 `bank_statement_account_mismatch`) ; un CSV n'en porte pas : le compte est celui choisi, noté `source = csv`.
- **Idempotence et dédoublonnage** :
  1. `Idempotency-Key` obligatoire : même clé et même contenu → 200 rejoué ; contenu différent → 409 `banking_idempotency_key_reused`.
  2. Même fichier (`file_sha256`) pour le même compte → 200 avec le relevé existant.
  3. Même relevé (`statement_ref` + `sequence`) avec un autre contenu → lignes dédoublonnées comme ci-dessous ; un relevé marqué copie ou duplicata (`CpyDplctInd`) n'ajoute jamais de ligne.
  4. Ligne : `dedup_key` = HMAC de (compte, `bank_reference`) quand la banque la donne ; sinon de (compte, date de comptabilisation, date de valeur, sens, montant, libellé normalisé, `end_to_end_id`). Pour une clé sans référence bancaire, seul l'excédent d'occurrences par rapport aux lignes déjà connues est importé : deux frais identiques le même jour restent deux lignes, deux exports qui se chevauchent n'en créent pas de troisième.
  5. Continuité : un solde d'ouverture différent du solde de clôture du relevé précédent ouvre un **trou** (`statement_gap`), signalé ; il bloque la validation d'un état de rapprochement, pas l'import.
- **Transaction** : relevé et lignes en une transaction ; les propositions sont calculées ensuite par un job en file (`ComputeBankSuggestions`, idempotent par relevé), doublé de `banking:suggest` quotidienne. Réponse : nombres importés, doublons, lignes refusées avec leur **numéro**, jamais leur contenu.
- **Annulation d'un import** (mauvais compte, mauvais fichier) : `voided_at` et motif, lignes exclues des listes et des états ; refusée si une ligne est pointée (409 `bank_statement_void_forbidden`).

### 5. Pointage, création depuis une ligne, écarts

- **Pointage** (`POST lines/{line}/match`) : lignes de relevé (une ou plusieurs) et lignes d'écriture du **même rôle de compte** (`BankBook`), non pointées ; un crédit du relevé répond à un débit du compte de banque, et inversement. Somme des lignes de relevé = somme des lignes d'écriture, sinon 422 `bank_match_unbalanced`. Couvre le N:M : une remise de chèques pour trois encaissements, un virement pour deux baux.
- **Création depuis une ligne** (`POST lines/{line}/settle`), une transaction, verrou de la ligne d'abord :
  - **crédit → encaissement de loyer** : `Rent\PublicApi\RentCollections::recordBankTransfer` (même Action que la saisie, méthode `transfer`, date = date de comptabilisation, référence = `bank_reference`, clé d'idempotence `banking:line:{id}:{n}`), imputation par la règle de Rent ; plusieurs baux : un montant par bail, total égal à la ligne ;
  - **crédit → règlement de facture** : `Invoicing\PublicApi\InvoiceSettlements::recordBankTransfer` (plafonné au reste dû, ADR 0028) ;
  - **débit → frais bancaires** : écriture Banking par `Ledger` (journal `bank`, source `bank_line`, débit nouveau rôle `BankCharges` 5100, crédit `Bank` ou `TrustBank`, `onClosedPeriod = roll_forward`) ;
  - puis pointage `settled` de la ligne d'écriture produite. Une dépense se saisit dans le module Charges (ADR 0034, proposé), formulaire prérempli depuis la ligne, puis se pointe (R2) : Banking n'appelle pas Charges. Reversements, apports et prélèvements se saisissent dans OwnerFunds puis se pointent ; la remise d'espèces attend un ADR.
- **« Diviser l'opération »** de l'écran devient la répartition N:M ci-dessus : une ligne de relevé ne se coupe jamais.
- **Défaire** (`POST matches/{match}/undo`, motif) : refusé si le pointage entre dans un état validé (409 `bank_match_locked`). Défaire ne contrepasse rien : l'encaissement créé reste, il s'annule dans Rent.
- **Ignorer** une ligne (motif `out_of_scope`, `internal_transfer`, `bank_error`, `other`) : sur `Bank` ; sur `TrustBank`, **seulement par paire de montant net nul** (opération erronée et son annulation) : tout mouvement du compte de tiers doit être au grand livre.
- **Écarts** : il n'existe pas d'écart « réglé » dans un pointage. Un paiement partiel est un encaissement partiel (Rent), un trop-perçu une avance (Rent), une commission retenue une ligne de frais pointée avec l'encaissement brut.
- **Lettrage** : celui des tiers reste porté par `item_type` et `item_id` des lignes d'écriture (ADR 0026, 0028) ; Banking n'ajoute pas de code de lettrage.
- **Contrôle** `banking:verify` (quotidien) : pointage sur une écriture contrepassée dont la contrepassation n'est pas pointée, trou de relevé, ligne ignorée sur `TrustBank` hors paire. Il signale (audit `banking.verify.anomaly`), ne corrige rien.

### 6. Propositions (règles déterministes)

Évaluées dans l'ordre, sur les lignes non pointées ; chaque proposition porte sa règle, ses éléments de preuve et un niveau.

| Règle | Condition | Niveau |
|---|---|---|
| R1 référence | numéro `AV-`, `FA-`, `RV-`, référence d'apport ou `end_to_end_id` connus, présents dans `RmtInf` ou le libellé, montant égal | `exact` |
| R2 écriture existante | écriture du même rôle, même montant, date dans [comptabilisation − 15 j, + 3 j] (`BANKING_MATCH_WINDOW_DAYS`), candidate unique | `strong` |
| R3 contrepartie connue | empreinte d'IBAN de la contrepartie liée à une partie (Parties ou `bank_counterparty_links`), montant égal au reste dû d'une échéance ou d'un bail | `strong` |
| R4 nom | tous les mots de 3 lettres et plus du nom du locataire dans le libellé (sans accent), montant égal au reste dû | `strong` si candidat unique, sinon `weak` |
| R5 règle de l'organisation | `bank_rules` dans l'ordre de `position` | selon la règle, jamais `exact` |
| R6 montant seul | montant égal à un reste dû ou à une écriture | `weak` |

- Une proposition `weak` n'est jamais présélectionnée. Plusieurs candidats au même niveau : niveau abaissé, candidats listés.
- `explanation` : codes (`amount_equals_outstanding`, `notice_number_in_remittance`, `tenant_name_in_label`, `known_counterparty`, `date_within_window`, `ambiguous`) et identifiants ; le texte est rendu par le front.
- Validation groupée (lot 3) : `POST suggestions/accept`, 50 propositions `exact` ou `strong` au plus, chacune revérifiée sous verrou ; une proposition périmée est écartée avec son motif, les autres passent.
- Toute IA ultérieure : ADR propre, avis du DPO, jamais de décision sans validation.

### 7. État de rapprochement et clôture

- **État** au dernier jour d'un mois, par compte suivi : solde du relevé (`CLBD` ou solde de clôture chaîné ; pour un CSV sans solde, saisi avec la pièce), solde du grand livre (`LedgerReader::accountBalance`), lignes non pointées, écritures non pointées, lignes ignorées. Depuis `reconciliation_from` :
  `écart inexpliqué = (Δ banque − lignes ignorées − lignes non pointées) − (Δ grand livre − écritures non pointées)`.
  Les pointages étant équilibrés, l'écart n'est non nul qu'en cas de trou de relevé ou de solde faux.
- **Validation** (`POST reconciliations/{id}/validate`, 2FA) : écart inexpliqué nul, aucun trou jusqu'à `as_of` (409 `bank_reconciliation_unexplained_difference`, `bank_statement_gap`). L'état est figé avec `ledger_version`. Une écriture datée du mois arrivée après la validation rend l'état périmé : un nouvel état le remplace (`supersedes_id`), l'ancien reste.
- **Clôture mensuelle** (amendement de l'ADR 0031, décision 5) : `CloseMonthController` (OwnerFunds) ajoute aux motifs `BankReconciliationStatus::closingBlockers(mois)` : `bank_reconciliation_missing` ou `bank_reconciliation_stale` pour chaque compte suivi dont `reconciliation_from` précède la fin du mois ; lus sous le verrou de période de `CloseMonth`. Le **compte de tiers d'une agence est suivi obligatoirement** dès qu'il est déclaré ; le compte propre l'est au choix.
- **Fonds de tiers** : la carte de couverture (ADR 0031) affiche le dernier état validé de `TrustBank` ; l'équation reste calculée au grand livre.

### 8. Source des relevés

- **Phase 1 : fichiers** déposés par l'utilisateur (section 4).
- **Agrégation DSP2 : différée** à un ADR de choix du prestataire (lot 7). Conditions fixées dès maintenant :
  - prestataire de services d'information sur les comptes **agréé ou enregistré** (registre de l'ACPR ou passeport européen), à confirmer ;
  - consentement donné par l'organisation **chez sa banque, par le parcours du prestataire** ; eGuardImmo ne voit ni ne stocke d'identifiant bancaire ; seul l'identifiant de connexion du prestataire est conservé, chiffré ;
  - renouvellement du consentement : 180 jours (règlement délégué (UE) 2022/2360), à confirmer selon les banques ;
  - prestataire sous-traitant RGPD (contrat, hébergement UE, sous-traitants ultérieurs) ;
  - lignes reçues comme un relevé `source = aggregator` par jour, dédoublonnées sur l'identifiant de transaction du prestataire ; webhook signé, idempotent (ADR 0007) ; trois états trouvé, absent, non vérifiable (ADR 0011).

### 9. Données personnelles et IBAN

- **Libellés** : ils contiennent des noms, parfois des motifs (aides au logement, mutuelle sur un compte personnel). Stockés pour la preuve et le rapprochement ; **jamais** dans les logs, le journal d'audit, les notifications, les messages d'erreur, les files ; masqués par le processeur de logs ; export CSV avec préfixe anti-formule (ADR 0031).
- **IBAN** : de l'organisation et des contreparties, **HMAC et quatre derniers caractères seulement**, jamais chiffré en clair dans Banking ; l'IBAN reçu sert le temps de la requête (contrôle modulo 97 par `PartyBankAccounts::isValidIban`, empreinte, recherche de partie) et n'est jamais renvoyé.
- **Bailleur autonome** : l'écran recommande un compte dédié ; les lignes ignorées d'un compte personnel sont une question pour le DPO (conservation, effacement du libellé).
- **Conservation** : relevés, lignes et fichier en pièce justificative comptable, 10 ans **à confirmer** ; l'anonymisation d'une partie ne modifie aucune ligne (comme les pièces émises), à confirmer.
- **Minimisation par rôle** : le gestionnaire ne lit aucun relevé (section 10).

### 10. Rôles, 2FA, routes, débits

Organisation, `/api/v1/org/{organization}/banking/…` (`auth:sanctum`, `space:organization`, `no-operator-token`, noms `banking.*`, Resources propres). Aucune route dans les espaces locataire, propriétaire ou console.

| Action | Rôles | Garde | Débit |
|---|---|---|---|
| Lecture : comptes, relevés, lignes, propositions, écritures non pointées (`book-lines`), états | titulaire, administrateur, comptable | – | 120/min |
| Importer, pointer, créer depuis une ligne, ignorer, restaurer, règles | titulaire, administrateur, comptable | `two-factor` dans une agence (ADR 0031 § 14) | 60/min ; import 30/h par organisation |
| Défaire un pointage, annuler un import | titulaire, administrateur, comptable | `two-factor` | 20/min |
| Valider un état de rapprochement | titulaire, administrateur, comptable | `two-factor` | 20/min |
| Créer, remplacer, fermer un compte bancaire | titulaire, administrateur | `two-factor` puis `reauthenticated:two-factor` (moins de 10 minutes) ; alerte à l'adresse du titulaire de l'organisation | 10/min |
| Télécharger le fichier d'un relevé | titulaire, administrateur, comptable | `two-factor`, `private, no-store`, journalisé | 10/min |

- Gestionnaire : 403 sur tout Banking (les relevés montrent tous les flux, salaires compris sur un compte propre).
- Le client n'envoie que des identifiants, le fichier, le format, le profil CSV, des motifs, des montants de répartition bornés par la ligne, `lock_version` et `Idempotency-Key` ; jamais une devise, un solde, un statut, une date de ligne.
- 404 sur le compte, le relevé, la ligne, le pointage ou l'état d'une autre organisation ; écriture de grand livre d'une autre organisation : 404.
- Codes (`Banking\Enums\ErrorCode`, ADR 0014) : `bank_account_not_found` 404, `bank_account_identifier_invalid` 422, `bank_account_currency_unsupported` 422, `bank_account_role_taken` 409, `bank_statement_not_found` 404, `bank_statement_format_unsupported` 422, `bank_statement_invalid` 422, `bank_statement_too_large` 422, `bank_statement_account_mismatch` 422, `bank_statement_void_forbidden` 409, `bank_line_not_found` 404, `bank_line_not_matchable` 409, `bank_line_stale` 409, `bank_match_unbalanced` 422, `bank_match_locked` 409, `bank_ignore_forbidden` 409, `bank_reconciliation_unexplained_difference` 409, `bank_statement_gap` 409, `banking_idempotency_key_reused` 409.

### 11. Audit (ADR 0016, dans la transaction)

`banking.account.created|replaced|closed`, `banking.statement.imported|voided|downloaded`, `banking.match.created|undone`, `banking.line.settled|ignored|restored`, `banking.suggestions.accepted`, `banking.rule.created|updated|disabled`, `banking.reconciliation.validated`, `banking.verify.anomaly`. Métadonnées : identifiants, format, nombres de lignes, règle, motif ; **ni montant, ni libellé, ni IBAN, ni nom**. `bank_statement_lines` déclare `label`, `counterparty_name`, `remittance_reference` dans `auditExcluded()`.

### 12. Devise et juridictions

- Un compte suivi est dans la **devise de l'organisation** (ADR 0008) ; un relevé ou une ligne dans une autre devise est refusé (422). Le montant d'origine d'une ligne convertie par la banque (`AmtDtls`) est gardé en information, jamais converti par eGuardImmo.
- Banking ne porte aucune règle de droit : pas de contrat de juridiction. Identifiant `other` admis pour les comptes canadiens (numéros de transit), formats québécois **à confirmer** avant l'ouverture.

### 13. Contrat attendu par les fronts

- `ImportBancairePage` (`packages/gestion`) : `statut` `a_rapprocher|rapprochee|archivee` ← `state` `unmatched|matched|ignored` ; `compte` ← `bank_account_id` et libellé ; `montant` signé ← `direction` + `amount` ; `echeanceProposeeId` et `indication` ← meilleure proposition `exact` ou `strong` et ses codes ; « Valider » → `match` (écriture existante) ou `settle` (échéance) ; « Diviser » → répartition ; « Créer une dépense » → frais bancaires par `settle`, autre dépense par le formulaire de Charges (ADR 0034) prérempli puis pointage ; « Automatisations » → `bank_rules` ; import par fichier, dédoublonnage serveur.
- `apps/agence` : écran de rapprochement monté depuis `packages/gestion` (route `/finances/banque`) ; encaissements « À rapprocher » = écritures `Bank`/`TrustBank` non pointées lues par `book-lines`, le bouton « Rapprocher » ouvre le choix d'une ligne de relevé ; un encaissement en espèces n'est jamais « à rapprocher » ; « Réglages > Finances » lit `banking/accounts` (`last4`, banque, titulaire, `last_reconciled_on`) ; la clôture affiche les nouveaux motifs.

## Plan de lots

Serveur d'abord, fronts ensuite ; chaque lot sort par `composer check` ou `pnpm -r check`, sans test ignoré ; `/security-review` pour les lots 1, 3, 4 et 7.

| Lot | Contenu | Critères de sortie et tests |
|---|---|---|
| 1. Socle et import | module, comptes (HMAC, quatre derniers), catégorie Documents `bank_statement`, CSV à profil, camt.053 (.001.02, .001.08), dédoublonnage, annulation, déclencheurs, audit, `.env.example` (`BANKING_HMAC_KEY`, `BANKING_IMPORT_MAX_BYTES`, `BANKING_IMPORT_MAX_LINES`, `BANKING_MATCH_WINDOW_DAYS`) | 401, 403 par rôle (gestionnaire refusé), 403 `two_factor_required`, `reauthentication_required` sur le compte, 404 autre organisation ; jeu de fichiers réels anonymisés de deux banques ; fichier rejoué 200, chevauchement de deux CSV sans doublon, deux frais identiques gardés, copie `CpyDplctInd` sans ligne, mauvais compte 422 ; XXE, `DOCTYPE`, PHP dans un CSV, ZIP, 10 Mo + 1 refusés ; déclencheurs MySQL (mise à jour d'une ligne, suppression) ; aucun IBAN ni libellé dans `audit_logs` et les logs (test de structure) |
| 2. Pointage | `Accounting\PublicApi\BankBook`, pointages N:M, défaire, ignorer et paire nulle sur `TrustBank`, `book-lines`, propositions R1, R2, R6, job et `banking:suggest`, `banking:verify` | pointage nominal 1:1, 1:N, N:1 ; déséquilibre 422 ; double pointage concurrent → un seul vivant (contrainte) ; écriture d'une autre organisation 404 ; rôle de compte différent refusé ; nombre de requêtes constant pour 50, 500, 5 000 lignes |
| 3. Création depuis une ligne | `RentCollections`, `InvoiceSettlements`, frais bancaires (`BankCharges`, source `bank_line`), R3 à R5, `bank_rules`, `bank_counterparty_links`, validation groupée | encaissement créé, imputé, quittance déclenchée comme une saisie ; rejeu sans doublon (clé `banking:line`) ; répartition sur deux baux ; facture plafonnée ; mois clos → `roll_forward` ; écritures équilibrées ; verrous dans l'ordre amendé (test d'ordre) |
| 4. États et clôture | `bank_reconciliations`, validation 2FA, `BankReconciliationStatus`, motifs de clôture, couverture des fonds de tiers | écart nul validable, trou 409, état périmé remplacé, clôture refusée sans état du compte de tiers, acceptée avec ; état validé immuable (déclencheur) |
| 5. Fronts | source API de `ImportBancairePage` (`apps/proprietaire`, `apps/agence`), réglages du compte, encaissements à rapprocher, clôture | `pnpm -r check` ; parcours navigateur sur l'API réelle : import camt.053, proposition, validation, état, clôture |
| 6. Formats | MT940, CFONB 120 | fichiers réels des banques pilotes, mêmes tests de dédoublonnage |
| 7. Agrégation DSP2 | après l'ADR de choix du prestataire et le contrat de sous-traitance | webhook signé faux 401, rejeu sans doublon, consentement expiré signalé, panne « non vérifiable » jamais mise en cache |
| 8. PSP | pointage d'un versement groupé de PSP (Payments) | après le module Payments |

## Options écartées

- **Extension d'Accounting** : créer un encaissement depuis une ligne ferait appeler Rent et Invoicing par Accounting, qui sont ses appelants (cycle) ; fichiers, analyseurs et données personnelles dans le module du grand livre.
- **Module Payments** (ADR 0005) : l'ADR 0028 le réserve aux PSP ; un webhook par transaction et un relevé périodique n'ont ni le même cycle de vie ni la même preuve ; le module n'existe pas.
- **OwnerFunds** : réservé aux agences ; le bailleur autonome rapproche aussi.
- **Pointer des objets métier** (encaissements, éléments de reversement) plutôt que des lignes d'écriture : une table de liens par module, et le grand livre n'est plus la référence.
- **Couper une ligne de relevé** (« Diviser » de l'écran) : mutation d'une pièce externe ; le N:M couvre le besoin.
- **Saisie des dépenses dans Banking** : doublerait le module Charges (ADR 0034) et ses règles de fonds de tiers.
- **Écart « réglé » dans le pointage** : un écart sans écriture est une seconde source de vérité ; chaque écart est une opération (frais, encaissement partiel, avance).
- **Code de lettrage sur `journal_lines`** : modifierait des lignes immuables et doublerait `item_id`.
- **Validation automatique des correspondances exactes** : une erreur de référence imputerait un loyer au mauvais bail sans regard humain ; réexaminée après mesure du taux d'erreur des propositions `exact`.
- **Proposition par IA ou par un service tiers** : libellés transmis hors de l'organisation, décisions inexplicables.
- **IBAN de l'organisation chiffré en clair** : aucun besoin en phase 1 (l'empreinte suffit à reconnaître le relevé) ; à reprendre si un avis d'échéance doit l'imprimer.
- **Connexion bancaire maison** (identifiants stockés, récupération d'écran) : interdit par l'ADR 0011 et contraire à la DSP2. **EBICS direct** : contrat et certificats par banque ; l'agence télécharge son fichier par son propre client EBICS.
- **Agrégation DSP2 dès la phase 1** : prestataire, contrat, coût par connexion et analyse RGPD avant tout code ; les fichiers couvrent le besoin.
- **camt.052 (relevé intrajournalier) et lignes `PDNG`** : non comptabilisées par la banque, elles changeraient après pointage.
- **Ignorer librement sur le compte de tiers** : un mouvement de fonds de mandants hors grand livre fausserait le cantonnement.
- **Plusieurs comptes par rôle de grand livre** : exige une dimension `bank_account_id` sur `journal_lines` (amendement d'Accounting) ; question fermée 9.
- **Propositions recalculées à chaque lecture** : coût par page de plusieurs PublicApi ; cache recalculable retenu.

## Conséquences

- **Ajouts hors Banking** :
  - Accounting : `PublicApi\BankBook` (lignes d'un rôle de banque par date, montant et curseur, indicateur de contrepassation), rôle `BankCharges` (5100, « Frais bancaires »), type de source `bank_line` ;
  - Rent : `PublicApi\RentCollections::recordBankTransfer` (même Action que la saisie) ;
  - Invoicing : `PublicApi\InvoiceSettlements::recordBankTransfer` ;
  - Parties : `PartyBankAccounts::partiesByIban` (empreinte Parties, comptes actifs) ;
  - Documents : catégorie `bank_statement` (CSV, texte, XML ; 10 Mo), sujet `bank_statement` ;
  - OwnerFunds : motifs de clôture Banking dans `CloseMonthController`.
- **Planification** : `banking:suggest` et `banking:verify` chaque jour.
- **Exploitation** : schémas XSD officiels des versions prises en charge livrés avec le module ; file `queue:work` (propositions, antivirus).
- **Front** : `ImportBancairePage` passe en source API ; textarea conservé comme CSV ; « Diviser » devient une répartition ; « Créer une dépense » ouvre les frais bancaires ou le formulaire de Charges ; écran de rapprochement dans `apps/agence` ; état de rapprochement à créer.
- **Risques** :
  - une banque qui ne fournit ni `AcctSvcrRef` ni solde (CSV) affaiblit le dédoublonnage et l'état : solde saisi avec pièce, trou signalé ;
  - frais bancaires débités sur le compte de tiers : ils réduisent `TrustBank` et ouvrent un écart de cantonnement que l'agence comble par un apport (ADR 0031) ;
  - un faux positif `strong` validé à la chaîne impute au mauvais bail : validation groupée bornée, défaire avant clôture, annulation dans Rent ;
  - la clôture devient plus exigeante pour une agence qui n'importe jamais : le compte de tiers suivi l'oblige à un relevé mensuel, c'est voulu.

## Points à valider

**Expert-comptable**
1. Rapprochement mensuel du compte de tiers et contenu de l'état (loi n° 70-9, décret n° 72-678, à confirmer), compte propre facultatif.
2. Frais bancaires et intérêts du compte de tiers : à la charge ou au profit de qui, compte d'imputation.
3. Date de l'écriture née d'une ligne : comptabilisation ou valeur.
4. Remise d'espèces, remise de chèques groupée, chèque impayé : schémas d'écriture.
5. Conservation dix ans des relevés et du fichier (Code de commerce, art. L123-22, à confirmer).

**DPO**
6. Base légale (obligation comptable, intérêt légitime), information des locataires et des mandants dont le nom figure dans les libellés.
7. Compte personnel du bailleur autonome : conservation et effacement des libellés des lignes ignorées.
8. Analyse d'impact (données financières de tiers à grande échelle) ; Loi 25 au Québec.
9. Agrégation : sous-traitance, hébergement, transferts hors UE.

**Prestataire DSP2 (lot 7)**
10. Statut d'agrément et registre, banques couvertes (comptes professionnels et comptes de tiers), durée réelle du consentement, structure des contreparties (IBAN), prix, réversibilité.

**Banques des agences pilotes**
11. Version camt.053 fournie, présence de `AcctSvcrRef` et des soldes, CFONB 120 ou MT940, profil CSV.

## Questions fermées pour l'utilisateur

Ma recommandation est toujours la première.

1. **Nouveau module `Banking`, OwnerFunds → Banking pour la clôture.** Alternatives : extension d'Accounting (cycle), module Payments.
2. **Pointage N:M sur les lignes d'écriture `Bank`/`TrustBank`, sans écriture ; lettrage des tiers inchangé (`item_id`).** Alternative : pointage des objets métier de chaque module.
3. **Formats : CSV à profil et camt.053 au lot 1 ; MT940 et CFONB 120 au lot 6 ; agrégation DSP2 après un ADR de prestataire.** Alternatives : MT940 dès le lot 1 ; agrégation dès la phase 1.
4. **Aucune validation automatique ; validation groupée explicite des propositions `exact` et `strong`.** Alternative : validation automatique des `exact`.
5. **IBAN de l'organisation et des contreparties : HMAC et quatre derniers caractères seulement.** Alternative : IBAN chiffré conservé.
6. **Compte de tiers suivi obligatoire pour une agence, état de rapprochement validé bloquant pour la clôture ; compte propre facultatif.** Alternatives : avertissement seulement ; suivi obligatoire des deux comptes.
7. **Gestionnaire exclu de Banking, lecture comprise.** Alternative : gestionnaire en lecture et pointage.
8. **Fichier brut conservé dans Documents comme pièce justificative (10 ans, à confirmer).** Alternative : empreinte SHA-256 seule, fichier non conservé.
9. **Un compte bancaire actif par rôle de grand livre en phase 1.** Alternative : plusieurs comptes de tiers dès maintenant (dimension `bank_account_id` sur `journal_lines`).
10. **Frais bancaires créés par Banking depuis une ligne de débit ; toute autre dépense saisie dans Charges (ADR 0034) puis pointée, sans lien Banking → Charges.** Alternatives : dépenses libres dans Banking ; frais bancaires saisis eux aussi dans Charges (un seul chemin, mais Charges ne connaît que les dépenses du bailleur).
11. **Ignorer sur le compte de tiers seulement par paire de montant net nul.** Alternative : ignorer avec motif comme sur le compte propre.

## Amendements d'ADR nécessaires (appliqués le 2026-11-19, lots 1 à 4 côté serveur)

- **ADR 0005** : module `Banking` (famille Gestion : comptes bancaires de l'organisation, relevés, pointage, états de rapprochement ; ne détient pas les fonds, n'initie aucun paiement) ; Banking → Accounting (`BankBook`, `Ledger`, `LedgerReader`, `LedgerAggregates`), Rent (`RentCollections`, `RentLedger`), Invoicing (`InvoiceSettlements`, `InvoiceLedger`), Parties (`PartyDirectory`, `PartyBankAccounts`), Documents (`DocumentStore`), Organizations (`MembershipDirectory`, `OrganizationDirectory`), Identity (`TwoFactorProofs`) ; OwnerFunds → Banking (`BankReconciliationStatus`) ; « rapprochement » retiré de la ligne Payments.
- **ADR 0007** : ordre des verrous précédé de (0) lignes de relevé `FOR UPDATE` (Banking) ; écriture de frais bancaires par Banking dans sa transaction, `onClosedPeriod = roll_forward` ; type de source `bank_line`.
- **ADR 0011** : ligne « Relevés bancaires » (camt.053, MT940, CFONB 120, agrégation DSP2 par un prestataire agréé, aucun identifiant bancaire détenu) ; trois prestataires à choisir devient quatre.
- **ADR 0016** : actions `banking.*` de la décision 11 ; attributs exclus des lignes de relevé.
- **ADR 0026** : `RentCollections::recordBankTransfer` ; un encaissement en espèces n'est pas pointable en banque.
- **ADR 0028** : `InvoiceSettlements::recordBankTransfer` ; « saisie manuelle seule » complétée par l'encaissement depuis une ligne de relevé.
- **ADR 0031** : motifs de clôture `bank_reconciliation_missing`, `bank_reconciliation_stale` ; « rapprochement bancaire (Payments) » du reste à faire renvoyé à cet ADR ; frais du compte de tiers et écart de cantonnement (point 2 à valider).
- **Documents** (ADR 0029, ajouts hors Maintenance) : catégorie `bank_statement` et sujet `bank_statement`.

## Amendements de la revue de sécurité (2026-11-20)

- **Compte de tiers, lignes ignorées** : une paire ignorée porte un `ignore_group_id` ; le rétablissement d'une jambe rétablit la paire entière, et `banking:verify` contrôle, tous motifs confondus, que chaque ligne ignorée du compte de tiers appartient à un groupe de deux lignes de sens opposés et de même montant (`trust_ignored_line_unpaired`). Ignorer ou rétablir une ligne couverte par un état validé (date au plus égale à son arrêté) est refusé (`bank_ignore_forbidden`).
- **Clôture** : un compte fermé ou remplacé reste suivi pour les mois qui finissent avant sa fermeture (états constructibles sur un compte fermé pour ces mois). Début de suivi borné : jamais dans le futur ; pour un remplacement, jamais avant celui du compte remplacé ; après un compte fermé du même rôle, jamais après la fin du mois de sa fermeture (`bank_account_start_invalid`). Une agence avec fonds de tiers doit suivre un compte de tiers pour clore un mois (`banking.require_trust_account`, vrai par défaut ; les suites des autres modules le désactivent dans `phpunit.xml`).
- **Solde saisi** (CSV sans solde) : la pièce qui le justifie (PDF ou image) est obligatoire (`bank_reconciliation_proof_required`), stockée par Documents (catégorie `supporting`, sujet `bank_reconciliation`), journalisée (`banking.reconciliation.built`) et servie par la seule route `GET /reconciliations/{id}/proof` (2FA) ; le téléchargement générique des documents refuse les relevés et ces pièces.
- **camt.053** : sans schéma XSD installé (`BANKING_XSD_DIRECTORY`) l'import est refusé (503 `banking_xsd_unavailable`, `BANKING_XSD_REQUIRED=true`), le CSV restant disponible ; tout encodage autre qu'UTF-8 est refusé. **Action manuelle** : déposer `camt.053.001.02.xsd` et `camt.053.001.08.xsd` officiels (iso20022.org) dans ce dossier ; leur téléchargement n'a pas été fait par l'agent.
- **Quotas** : import et aperçu limités par heure et par compte utilisateur au sein de l'organisation, avant même l'appartenance (un compte sans droit ne consomme pas le quota de l'agence).
- **Verrous** : `LineLocker` verrouille d'abord les relevés (partagé) puis les lignes, comme `VoidStatement` ; l'import verrouille le compte avant toute lecture de sa transaction (vue REPEATABLE READ). Un conflit d'unicité étranger à la clé d'idempotence rend 409 `banking_request_conflict`.
- **Divers** : plafond de 1e14 unités mineures par montant importé ; curseur de `book-lines` invalide en 422 `bank_cursor_invalid` ; confiance revérifiée à l'acceptation d'une proposition ; `holder_name`, `identifier_last4` et `opening_bank_balance` masqués dans l'audit ; décalage de rapprochement calculé par lots ; `banking:suggest` isole les organisations (code de sortie non nul en cas d'échec) ; l'audit d'une anomalie persistante de `banking:verify` est écrit à la première détection puis chaque semaine ; les quittances d'un règlement depuis une ligne sont émises après la transaction.

## Sources

- ISO 20022, Message Definition Report Part 2, Bank-to-Customer Cash Management, camt.053.001.09, projet de décembre 2020 : https://www.iso20022.org/sites/default/files/2020-12/ISO20022_MDRPart2_BankToCustomerCashManagement_2020_2021_v1_ForSEGReview.pdf
- Règlement délégué (UE) 2022/2360 (authentification forte, 180 jours) : https://eur-lex.europa.eu/eli/reg_del/2022/2360/oj
- CFONB, migration ISO 20022 (décembre 2025) : https://www.cfonb.org/sites/www.cfonb.org/files/documents/CFONB_Migration_ISO20022_2025-12-17.pdf
- CFONB, aide à la migration EBICS 3.0 : https://www.cfonb.org/fichiers/20180808113947_EBICS_3.0__aide_a_la_migration_V1.1.pdf
