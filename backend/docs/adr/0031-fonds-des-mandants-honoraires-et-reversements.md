# ADR 0031 — Fonds des mandants, honoraires de gestion et reversements (module OwnerFunds, clôture mensuelle d'Accounting)

Statut : accepté (2026-11-18), validé par l'utilisateur tel que proposé, durci après revue de sécurité (2026-11-19, § 14 et décision 11 à trancher), amendements appliqués (2026-11-18) aux ADR 0005, 0007, 0025, 0026, 0028, 0029 et 0030 ; les points de droit et de TVA restent à faire valider par un expert-comptable avant la production. Prérequis de l'ADR 0030 (lot 2 : comptes rendus de gestion). Complète l'ADR 0005 (modules), l'ADR 0006 (cloisonnement), l'ADR 0007 (grand livre seule source des soldes), l'ADR 0008 (juridictions), l'ADR 0011 (normes), l'ADR 0016 (journal), l'ADR 0017 (intégrité), l'ADR 0019 (mandant = partie), l'ADR 0022 (instantané), l'ADR 0025 (mandats et honoraires), l'ADR 0026 (loyers), l'ADR 0028 (factures), l'ADR 0029 (maintenance) et l'ADR 0030. Amendements décrits plus bas, **non appliqués** tant que l'ADR n'est pas accepté. Les obligations légales citées viennent de sources secondaires : **à confirmer** sur Légifrance et avec un expert-comptable ou un juriste avant l'implémentation (ADR 0011).
Amendement accepté (2026-11-19, ADR 0034) : régularisation sur le compte du mandant (crédit : débit `OwnerPayable` ; complément : appel de charges existant) ; dépense `trust` soumise au § 7 et au § 14 (double authentification, solde du mandant, cantonnement, second validateur au-delà de `CHARGES_THIRD_PARTY_SECOND_APPROVAL_MINOR`) ; reste à faire « régularisation de charges » retiré.
Amendement accepté (2026-11-19, ADR 0035) : motifs de clôture `bank_reconciliation_missing` et `bank_reconciliation_stale` (`BankReconciliationStatus::closingBlockers`, lus par `CloseAccountingMonth`) ; « rapprochement bancaire (Payments) » du reste à faire renvoyé à l'ADR 0035.

## Contexte

Une agence qui encaisse des loyers pour un mandant détient des **fonds de tiers**. Le grand livre d'aujourd'hui ne le sait pas. Constaté dans le code :
- `Rent\Support\Settlement::postIssue` crédite `RentRevenue`, `ChargesRecovered` et `VatCollected` : le loyer d'un lot géré apparaît comme un **produit de l'agence** ; `RecordPayment` débite `Bank` ou `Cash` et crédite `TenantReceivable`.
- `OwnerPayable` n'est **débité** que par Maintenance (imputation `owner`, ADR 0029) et **jamais crédité** : le compte d'un mandant est négatif dès la première facture de travaux.
- `SecurityDeposits` est lu et débité par Maintenance, jamais crédité. Un seul compte `Bank` : aucune séparation entre l'argent de l'agence et celui des mandants.
- Aucun module ne calcule les honoraires de gestion (ADR 0028 : « honoraires saisis à la main », calcul « reste à faire »), ne porte les reversements, ni ne ferme une période : `PostJournalEntry` accepte n'importe quelle date et `RecordPayment` date l'écriture de `receivedOn`, antidatable.
- Les écrans de démonstration (`apps/agence`, `features/finances`) calculent honoraires et net dans le navigateur ; ils connaissent la base de calcul (`encaisses`, `hors_charges`), le minimum, le mode de prélèvement (`reversement`, `encaissement`), les états de reversement `a_reverser`, `reverse`, `bloque` et un lot `brouillon` puis `valide` avec exclusions motivées. Rien de cela n'est tenu par le serveur (CLAUDE.md : le serveur recalcule).

Obligations visées (sources secondaires, **à confirmer**) : loi n° 70-9 du 2 janvier 1970 (loi Hoguet) et décret n° 72-678 du 20 juillet 1972 (fonds reçus pour le compte d'un mandant sur un compte distinct des fonds propres de l'agent, comptabilité tenue par mandant, garantie financière couvrant les fonds détenus) ; Code civil art. 1993 (reddition de compte) ; TVA des prestations de services exigible à l'encaissement (déjà retenue par l'ADR 0028). L'ADR 0011 interdit à eGuardImmo de détenir les fonds : l'argent reste sur les comptes de l'organisation ; le grand livre en fait la preuve.

## Décision

### 1. Invariants

1. **Un loyer encaissé sur un lot sous mandat n'est jamais un produit de l'agence** : il devient une dette envers le mandant (`OwnerPayable`). Une organisation `individual` (bailleur autonome) et un lot sans mandat gardent `RentRevenue`.
2. **Un seul grand livre** : le mandant est le `party_id` des lignes ; aucun solde, aucun sous-livre à côté (ADR 0007).
3. **Un compte mandant ne devient jamais débiteur par un décaissement** (reversement, honoraires, règlement de prestataire). Seule la contrepassation d'un encaissement (chèque impayé) peut le rendre débiteur : anomalie signalée, déduite du prochain reversement.
4. **Fonds de tiers cantonnés** : un compte bancaire de tiers distinct (`TrustBank`) et une équation vérifiée (décision 7).
5. **Règlement manuel en phase 1** ; virement SEPA par un PSP plus tard ; **jamais de version maison des paiements** (ADR 0011).
6. **Période clôturée immuable** ; correction par rectificatif (décision 6).

### 2. Modèle comptable

**Nouveaux rôles de compte** (Accounting, `AccountRole`, `ChartOfAccounts` crée à la demande) :

| Rôle | Code | Sens | Libellé |
|---|---|---|---|
| `TrustBank` | 1010 | débit | Banque, compte de tiers (fonds des mandants) |
| `OwnerRentCalled` | 3010 | crédit | Loyers appelés pour le compte des mandants, non encaissés |
| `OwnerChargesCalled` | 3020 | crédit | Charges appelées pour le compte des mandants, non encaissées |
| `OwnerVatCalled` | 3030 | crédit | TVA appelée pour le compte des mandants, non encaissée |
| `PayoutsInTransit` | 3300 | crédit | Reversements validés, non exécutés |

Existants conservés : `OwnerPayable` (3000), `SecurityDeposits` (3100), `Bank`, `Cash`, `FeeRevenue`, `VatDeferred`, `VatCollected`, `CustomerReceivable`. Nouveaux types de source : `owner_payout`, `fee_settlement`, `trust_transfer` (contrainte posée par `Checks::add`).

**Routage** : un lot est « sous mandat » si `MandateDirectory::coveringUnit(lot, period_start)` renvoie un mandat non brouillon (suspendu compris, signalé). Le résultat est **figé sur l'échéance à l'émission de l'avis** (`installments.mandate_id`, `mandant_party_id`, écrits une fois). Plus rien ne dépend ensuite du mandat courant : un avenant ou une fin de mandat ne réachemine pas une échéance déjà appelée.

**Écritures** (une écriture, une clé d'idempotence, toujours dans la transaction de l'appelant, ADR 0007) :

| Événement | Écriture | Clé |
|---|---|---|
| Appel d'un lot sous mandat (journal `rent`, Rent) | débit `TenantReceivable` total (item = échéance) · crédit `OwnerRentCalled`, `OwnerChargesCalled`, `OwnerVatCalled` (partie = mandant, lot, bail, item = échéance) | `rent:installment:{id}` (inchangée) |
| Encaissement imputé (journal `bank`, Rent) | **même écriture que l'ADR 0026** : débit `TrustBank` (ou `Cash`) · crédit `TenantReceivable` par créance ; **plus**, par créance imputée : débit des trois comptes « appelés » (ventilation) · crédit `OwnerPayable` (mandant, lot, bail) du montant imputé | `rent:payment:{id}` (inchangée) |
| Application d'une avance (Rent) | écriture de l'ADR 0026 + mêmes lignes de ventilation vers `OwnerPayable` | inchangée |
| Annulation d'un appel ou d'un encaissement | contrepassation de l'écriture entière (`Ledger::reverse`) : la ventilation suit | inchangée |
| Imputation de travaux (Maintenance, ADR 0029) | débit `OwnerPayable` · crédit `WorksPending` | inchangée |
| Facture d'honoraires (Invoicing, ADR 0028) | débit `CustomerReceivable` (mandant) · crédit `FeeRevenue` et `VatDeferred` | `invoice:{id}:issue` |
| Compensation des honoraires | débit `OwnerPayable` · crédit `CustomerReceivable` (item = facture) ; TVA `VatDeferred` → `VatCollected` au prorata (mécanisme 0028) | `owner_funds:fee_settlement:{invoice}` |
| Prélèvement des honoraires sur le compte de tiers | débit `Bank` · crédit `TrustBank` | `owner_funds:trust_transfer:{id}` |
| Validation d'un reversement | débit `OwnerPayable` · crédit `PayoutsInTransit` | `owner_funds:payout:{item}:validate` |
| Exécution d'un reversement | débit `PayoutsInTransit` · crédit `TrustBank` | `owner_funds:payout:{item}:execute` |
| Échec avant exécution, annulation | contrepassation de la validation | `…:fail` |
| Retour bancaire après exécution | contrepassation de l'exécution puis de la validation | `…:return` |

- **Ventilation de l'imputation** : un encaissement `A` imputé sur une échéance se répartit entre loyer, charges et TVA **au prorata des restes de chaque composante** (reste lu par `LedgerReader::itemOn` sur les lignes « appelées » portant `item = échéance`), arrondi au demi supérieur, l'écart au dernier composant non nul, jamais au-delà du reste d'un composant. Quand `A` solde l'échéance, chaque composante est soldée exactement. L'ordre d'imputation loyer puis charges est écarté (à confirmer, décision à valider n° 1).
- **Charges récupérables** : les provisions appelées avec le loyer sont des fonds du mandant (il règle les charges). La **régularisation** (ADR dédié d'Accounting) passe par le compte du mandant comme tout débit de charges ; elle ne crée jamais de produit pour l'agence sur un lot sous mandat et respecte les invariants 3 et 6.
- **TVA sur loyers** (bail soumis) : fonds et dette fiscale du mandant, jamais de l'agence ; elle n'entre pas dans la base des honoraires.
- **Dépôt de garantie** : porté par `SecurityDeposits` (bail, locataire) contre `TrustBank`, **hors `OwnerPayable` et hors net reversable** ; compté dans le passif de tiers (décision 7). Retenue pour impayé : débit `SecurityDeposits` · crédit `TenantReceivable`, traitée ensuite comme un encaissement (ventilation et honoraires compris) ; retenue pour travaux : Maintenance, inchangée. **L'encaissement et la restitution du dépôt** n'existent pas dans Rent (ADR 0026 : jamais appelé) : ADR dédié ; si le mandat laisse le dépôt au propriétaire, il n'entre pas au grand livre de l'agence.
- **Avances** (surplus d'encaissement) : fonds du locataire, crédit `TenantReceivable` sans créance, compté dans le passif de tiers jusqu'à application ; aucun `OwnerPayable` avant l'application.
- **Mandat fini ou suspendu** : le compte du mandant reste payable jusqu'à zéro ; un reversement ne dépend jamais d'un mandat actif.
- **Anomalie « loyer non routé »** : un appel crédité à `RentRevenue` sur un lot couvert par un mandat à la période est détecté par `ownerfunds:verify` et repris par le rattrapage (décision 8).

### 3. Honoraires de gestion

- **Barème** (amende l'ADR 0025, `mandate_terms`) : `fee_base` (`rent` | `rent_and_charges`, **jamais la TVA**), `fee_minimum_amount` (entier, 0 par défaut), `fee_tax_mode` (`excl_tax` | `incl_tax`). Les lignes existantes ont `fee_base` nul : calcul refusé (422 `fee_base_missing`) jusqu'à un avenant, **aucune valeur par défaut silencieuse**. Honoraires de relocation et de suivi de travaux : reste à faire.
- **Fait générateur : l'encaissement imputé**, jamais l'appel. Base d'un mandat et d'un mois = somme nette (contrepassations déduites) des débits de `OwnerRentCalled` (et `OwnerChargesCalled` si `rent_and_charges`) sur les lots du mandat, pour les écritures datées dans le mois, lue par `LedgerAggregates::movements`.
- **Calcul sur un mois clos seulement** (409 `period_not_closed`), par `OwnerFunds\Support\FeeCalculator` (fonction pure, `moneyphp`, jamais de `float`) :
  - `percentage` : `HT = demi supérieur(base × points de base / 10 000)` ;
  - `flat` : le forfait, **par mandat et par mois**, dû si la base est positive ;
  - minimum : si 0 < honoraires < minimum, le minimum s'applique (terme en vigueur le dernier jour du mois) ;
  - avenant en cours de mois : base coupée à `valid_from`, chaque segment au taux de son terme ;
  - `incl_tax` : le calcul donne le TTC, `HT = demi supérieur(TTC / (1 + taux))`, taxe = TTC − HT ;
  - taux de TVA et franchise : `InvoiceTaxRules` (ADR 0028), jamais une constante.
- **`fee_statements`** : une ligne par (mandat, mois), figée à la première validation de lot qui la requiert (base, terme utilisé, résultat), clé unique `(organisation, mandat, début de période)`. Elle sert la reproductibilité ; **le compte rendu lit les honoraires au grand livre**, pas cette table (ADR 0030 décision 1).
- **Ce que change l'ADR 0028** :
  - la facture d'honoraires de gestion est **générée par le serveur** depuis `fee_statements` par `Invoicing\PublicApi\ManagementFeeInvoices` : une facture par mandat et par mois, destinataire le mandant, période de prestation = le mois, ligne unique `fee.management`, mêmes numérotation, PDF, instantané et garde de facture électronique ;
  - **la saisie manuelle d'une ligne `fee.management` est refusée** (422 `invoice_fee_computed_by_server`) pour une organisation dont `owner_funds.cutover_at` est posé ; `fee.letting`, `fee.other`, `service` et `recovery_cost` restent saisissables ; les factures déjà émises sont intactes ;
  - nouvelle méthode de règlement `owner_account` : **compensation sur le compte du mandant**, réservée à cette PublicApi (la route publique de règlement la refuse) ; montant = min(TTC, solde du mandant) sous verrou du compte mandant ; le reste reste une créance `CustomerReceivable` du mandant, reprise au reversement suivant. La TVA devient exigible à la compensation (à confirmer) ;
  - **avoir** : un mois à honoraires négatifs (encaissement contrepassé après facturation) produit un avoir sur la dernière facture d'honoraires du mandat, **dans la limite de son total** ; la part déjà réglée par compensation est recréditée au compte du mandant dans la même écriture (crédit `OwnerPayable`), exception au plafond « pas de crédit client » de l'ADR 0028 ; l'excédent est reporté (`carried_net`), jamais facturé en négatif.
- **Retenue au reversement seulement en phase 1** : l'option « à l'encaissement » de l'écran est retirée (impossible avec un minimum ou un forfait mensuel).
- Honoraires toujours déduits **avant** de verser : voir net reversable.

### 4. Reversements

- **Net reversable** d'un mandant à la date D = solde `OwnerPayable` (crédit − débit, `LedgerAggregates::balances`) − honoraires dus (mois clos non facturés, créances d'honoraires ouvertes) − honoraires estimés du mois ouvert (pourcentage sur la base déjà encaissée, sans minimum) − retenues actives, borné à zéro. `PayoutsInTransit` est déjà déduit du solde.
- **Exclusions typées, jamais silencieuses** (`exclusion_reason`) : `no_payout_account` (aucun IBAN valide, `PartyDirectory::payoutAccount`), `account_recently_changed` (IBAN changé depuis moins de `owner_funds.account_cooling_days`, 2 par défaut : contrôle contre la fraude au changement de coordonnées), `negative_balance`, `active_hold`, `below_minimum` (`owner_funds.payout_minimum_minor`, 0 par défaut), `before_payout_day` (jour de reversement du mandat, ADR 0025), `trust_funds_gap` (décision 7), et à la validation : `stale`, `invoice_pdf_unavailable`, `nothing_to_pay`.
- **Retenue / blocage** : `payout_holds`, `kind` `full` (tout le mandant) ou `reserve` (montant retenu), motif obligatoire (`dispute`, `mandate_ending`, `works_reserve`, `succession`, `other`) et commentaire ≤ 500 caractères. Historique d'ajout seul : une levée pose `released_at`, une modification est une levée puis une nouvelle retenue. **Bloquer ne déplace aucun argent** ; une retenue est un paramètre, pas un solde.
- **Lot** (`payout_batches`) : `draft` → `validated` → `executed` | `cancelled`.
  - Brouillon : aperçu serveur, inclusion ou exclusion motivée par mandant (`lock_version`) ; plafond 50 mandants (`OWNER_FUNDS_BATCH_MAX`) ; clé d'idempotence ; **un mandant n'est que dans un seul reversement vivant** (colonne générée unique).
  - **Validation** : une transaction **par mandant**, verrou du compte mandant, puis relecture complète (le brouillon n'est jamais cru) : émission et compensation des factures d'honoraires dues, recalcul du net, écriture de validation vers `PayoutsInTransit`. Un mandant dont le net diffère du brouillon, bloqué ou en panne de PDF est **écarté avec son motif, sans rien écrire** ; les autres passent. Numéro `RV-AAAA-NNNN` pris à la validation (`ContinuousCounter` sous verrou).
  - **Exécution manuelle** (`execute`) : l'agence vire depuis la banque de tiers, puis saisit date et référence ; écriture débit `PayoutsInTransit` · crédit `TrustBank`. Le lot est `executed` quand plus aucun élément n'est `pending`.
  - **Double contrôle** : celui qui exécute n'est pas celui qui a validé quand l'organisation comptait au moins deux membres autorisés **à la validation du lot** (`owner_funds.require_second_approver`, vrai par défaut) ; sinon permis, journalisé `solo`. L'exigence et le nombre de membres habilités sont **figés sur le lot** (`second_approver_required`, `approvers_count`) : une rétrogradation après la validation ne rouvre pas le mode solo, et un lot validé en solo ne s'exécute plus en solo si l'équipe habilitée a changé (§ 14).
  - États d'un élément : `included`, `excluded`, `pending`, `paid`, `failed` (virement refusé avant exécution), `returned` (retour bancaire après exécution, motif obligatoire). Un virement exécuté ne se supprime ni ne se modifie : seul `return` le défait, par contrepassation.
  - Annulation d'un lot validé : seulement si aucun élément `paid` ; contrepasse les `pending`.
- **Export du lot** : CSV (UTF-8, `;`, préfixe anti-injection de formule comme l'ADR 0030), nom, libellé `RV-…`, montant, quatre derniers caractères de l'IBAN. L'IBAN complet n'y figure jamais ; **pas de fichier `pain.001` maison**.
- **Virement par un PSP : différé.** Il exige un ADR de choix du prestataire (module Payments, ADR 0011) ; l'exécution sera alors posée par un webhook signé, idempotent sur la référence du fournisseur (ADR 0007), et l'action manuelle disparaîtra pour ces lots. Aucune interface avant le second moteur.

### 5. Clôture mensuelle (Accounting)

- **Période** : mois civil, `accounting_periods` (une ligne par mois clos ; l'absence de ligne signifie ouvert). **Clôture séquentielle** : seul le plus ancien mois ouvert se clôt. Pas de réouverture.
- **Verrou** : `PostJournalEntry` refuse (409 `accounting_period_closed`) toute écriture datée avant le premier jour ouvert. La lecture du dernier mois clos se fait sous `accounting_period_locks` `FOR SHARE` ; la clôture le prend `FOR UPDATE` : une écriture concurrente d'une clôture est sérialisée, pas perdue. Contrepassation : datée d'aujourd'hui.
- **Dates passées** : `EntryData` porte `onClosedPeriod` (`refuse` par défaut, `roll_forward` pour Rent et Maintenance). Un encaissement dont `receivedOn` tombe dans un mois clos est écrit au **premier jour ouvert**, libellé « encaissé le … » ; la quittance garde la date réelle. Il compte alors dans le mois ouvert, jamais dans le mois clos.
- **Pré-conditions bloquantes** (409 `accounting_period_not_closable`, liste des motifs) : anomalie du grand livre (`accounting:verify`), écart de cantonnement (décision 7), `PayoutsInTransit` différent de la somme des reversements `pending`, écriture déséquilibrée. **Avertissements** (non bloquants, listés) : mandats actifs sans encaissement ni honoraires, reversements `pending` depuis plus de 10 jours.
- **Effets** : ligne `accounting_periods` avec `closing_cutoff` (jeton `LedgerAggregates::version`), audit `accounting.period.closed`. Un compte rendu (ADR 0030) ne se **publie** que pour une période close (409 `report_period_not_closed`).
- **Rectificatif** : une erreur découverte dans un mois clos se corrige par une écriture `adjustments` dans le mois ouvert, motif obligatoire, journalisée ; le compte rendu concerné se rectifie par le mécanisme de l'ADR 0030. Jamais d'écriture rétroactive.
- Rôles : propriétaire, administrateur, comptable ; 20/min par utilisateur.

### 6. Rapprochement avec l'ADR 0030

- **`LedgerAggregates`** (Accounting, ADR 0030 décision 3) gagne : `ownerFunds` (par mandant : `OwnerPayable`, `PayoutsInTransit`, appelés non encaissés), `trustCoverage` (équation de la décision 7), `closedThrough`. `movements` et `partyStatement` couvrent les nouveaux rôles ; `version` est le jeton posé à la clôture.
- **Lecture du compte rendu** : fonds du mandant = crédits `OwnerPayable` (source `payment`) ; honoraires HT et TVA = lignes `FeeRevenue` et `VatCollected` de la partie mandant, **au grand livre** ; travaux = `supplier_allocation` ; reversements = exécutions (débit `PayoutsInTransit`, date d'exécution) et, séparément, virements en cours (solde de `PayoutsInTransit` par mandant) ; ouverture et clôture = solde `OwnerPayable`. Le tableau de l'ADR 0030 (décision 2) en est précisé : le type de source `owner_allocation` n'existe pas, l'imputation est portée par l'écriture de l'encaissement.
- **Résolution lot → mandant** (ADR 0030 décision 3, précision) : les lignes `OwnerPayable` et « appelées » portent le mandant en `party_id`. `coveringUnits` ne sert plus qu'à détecter un lot sans mandat (`unmapped`) et les appels antérieurs au rattrapage.
- **Cartes de tableau de bord** : « reversements en attente » = soldes `OwnerPayable` ; le nombre de mandants sous retenue est un fait lu en SQL ; aucun montant de retenue n'est lu hors du grand livre (règle de l'ADR 0030, décision 1).
- **Reproductibilité** : pour un mois clos, un compte rendu se recalcule par la seule date ; `ledger_cutoff` ne sert plus qu'à un aperçu sur mois ouvert.

### 7. Cantonnement et garantie financière

- **Équation** (grand livre, `LedgerAggregates::trustCoverage`) : `TrustBank ≥ OwnerPayable + PayoutsInTransit + SecurityDeposits (lots sous mandat) + avances locataires (lots sous mandat)`. L'excédent est la part de l'agence (honoraires) à prélever par `trust_transfer`, plafonné à l'excédent (409 `trust_withdrawal_exceeds_surplus`). **Équation exacte à valider par un expert-comptable** (espèces, dépôts, TVA des mandants).
- **Contrôle** : à la validation d'un lot, avant chaque prélèvement, à la clôture (bloquant) et par `ownerfunds:verify` (quotidien). Un écart ne bloque **jamais** un encaissement (un loyer reçu se comptabilise toujours) : il bloque reversements, prélèvements et clôture, et alerte.
- **Garantie financière** : total des fonds de tiers comparé au montant garanti de l'organisation ; **alerte seulement** (`OrganizationDirectory::legalIdentity` doit exposer le montant, ADR 0011).
- **Règlement d'un prestataire** (amende l'ADR 0029) : pour une intervention sur lot sous mandat, il se paie depuis `TrustBank` si le solde du mandant le couvre, sinon refus (409 `owner_funds_insufficient`) ; l'avance sur fonds propres est une saisie explicite depuis `Bank`, tracée, qui laisse une créance sur le mandant. L'imputation `owner` reste comptabilisée même au-delà du solde (c'est une charge), le compte devient débiteur et le reversement est exclu.

### 7 bis. Verrous et ordre

Ordre fixe, jamais inversé (ADR 0026) : (1) ligne `rent_schedules` du bail, ou intervention puis facture reçue (Maintenance) ; (2) **verrou du compte mandant** (`ledger_party_locks`, ligne par (organisation, partie), `Ledger::lockParty`) ; (3) ligne `invoices` ; (4) `accounting_period_locks` `FOR SHARE` puis compteur d'écritures (dans `PostJournalEntry`). Prennent le verrou du compte mandant : validation, exécution, échec, retour, compensation, prélèvement, règlement de prestataire sur fonds de tiers, **annulation d'un encaissement ou d'un appel** sur lot sous mandat (une contrepassation réduit le solde). Un encaissement ne le prend pas : il ne fait que créditer. Aucune lecture non verrouillante avant le verrou.

### 8. Migration des écritures déjà passées (rattrapage)

Principe : **additif, idempotent, jamais de suppression ni de modification d'écriture** (le grand livre est en ajout seul, ADR 0017).
1. **Schéma additif** (colonnes, tables, rôles) déployé sans effet : `owner_funds.cutover_at` absent ⇒ Rent poste comme aujourd'hui.
2. **`ownerfunds:backfill {organisation} --dry-run`** (défaut) : liste, par échéance émise sur un lot couvert par un mandat à `period_start`, l'écriture de reclassement qui serait passée, et les échéances `unmapped` (jamais attribuées par défaut). Aucune écriture.
3. **`--apply`** (confirmation, propriétaire de l'organisation ou opérateur d'exploitation) : par échéance, dans sa transaction, une écriture `adjustments` (source `adjustment`, clé `owner_funds:backfill:{échéance}:call`) qui débite `RentRevenue`, `ChargesRecovered`, `VatCollected` et crédite les comptes « appelés » (partie = mandant) ; pour chaque imputation active, une écriture (`…:{imputation}:collect`) qui débite les comptes « appelés » et crédite `OwnerPayable`. Les écritures reprennent **la date de l'écriture d'origine** : elles ne sont possibles qu'avant la première clôture de l'organisation. Les colonnes `installments.mandate_id` et `mandant_party_id` sont posées en même temps. Reprise possible à tout moment : une clé déjà passée est rejouée sans effet.
4. **La banque n'est pas déplacée** : le rattrapage ne devine pas où l'argent a été reçu. `TrustBank` reste nul, l'équation de la décision 7 révèle l'écart, et l'agence le résorbe par un **virement vers le compte de tiers** saisi comme `trust_transfer` avec sa pièce bancaire (action propriétaire, administrateur, comptable). C'est le réel constat de conformité, pas un artefact.
5. **Activation** : `owner_funds.cutover_at` posé en fin de `--apply` ; Rent route les nouvelles échéances. Un second `--apply` rattrape ce qui a été posté entre les étapes 3 et 5. `ownerfunds:reconcile` (quotidien) signale ensuite toute échéance sous mandat sans mandant figé et tout appel non routé : il **signale, ne corrige rien**.
- Le passif antérieur de Maintenance (imputations `owner` sans crédit) est rendu cohérent par l'étape 3 ; les règlements de prestataires déjà passés par `Bank` ne sont pas reclassés (même raison que l'étape 4).
- Les factures d'honoraires saisies à la main avant l'activation restent valables et immuables ; leur règlement par banque reste tel quel.

### 9. Modèle de données (`organization_id` partout, UUID v7, ADR 0015 et 0017)

**OwnerFunds** :
- `fee_statements` : `mandate_id`, `mandant_party_id`, `period_start`, `period_end` (exclu), `currency`, `base_rent` et `base_charges` (`bigint` signés), terme utilisé (`fee_kind`, `rate_bp`, `flat_amount`, `minimum_amount`, `fee_tax_mode`, `term_ids` JSON), `fee_net`, `tax_amount`, `fee_total`, `minimum_applied`, `carried_net`, `invoice_id`, `credit_note_id` (sans clé étrangère SQL), `datetimes(6)`. Unique `(organization_id, mandate_id, period_start)`. Ajout seul.
- `payout_batches` : `number` (nul avant validation), `execution_on`, `status`, `idempotency_key` unique par organisation, `fingerprint`, `lock_version`, `validated_at`, `validated_by_user_id`, `cancelled_at`, `cancel_reason`.
- `payout_items` : `batch_id` (clé composite `(organization_id, id)`), `mandant_party_id`, `status`, `exclusion_reason`, `net_amount` et `fees_settled_amount` (`bigint`), `currency`, `bank_account_id` (le compte de paiement de Parties, qui ne se réécrit pas : un changement crée une ligne) et `bank_last4`, `transit_entry_id`, `execution_entry_id`, `return_entry_id`, `executed_on`, `bank_reference`, `executed_by_user_id`, `lock_version`, colonne générée `open_key` (mandant quand `included` ou `pending`) **unique par organisation**. L'IBAN n'est jamais copié.
- `payout_holds`, `owner_funds_sequences` (`(organisation, année)`, `ContinuousCounter`).
- Réglages d'organisation (ADR 0018) : `owner_funds.cutover_at`, `payout_minimum_minor`, `require_second_approver`, `account_cooling_days`.

**Accounting** : `accounting_periods` (`period_start`, `period_end` exclu, `closed_at`, `closed_by_user_id`, `closing_cutoff` JSON), `accounting_period_locks`, `ledger_party_locks`.
**Rent** : `installments.mandate_id`, `mandant_party_id`. **Mandates** : `mandate_terms.fee_base`, `fee_minimum_amount`, `fee_tax_mode`. **Invoicing** : méthode de règlement `owner_account`.

**Contraintes** (`Checks::add`, jamais `ENUM`, ADR 0017) : statuts et motifs ; `net_amount > 0` pour `pending`, `paid` ; `(status = 'excluded') = (exclusion_reason IS NOT NULL)` ; retenue `full` sans montant, `reserve` avec montant positif ; `source_type` étendu ; `period_end = period_start + 1 mois`, `period_start` au premier du mois.

**Déclencheurs MySQL** (équivalents SQLite pour les tests, comme l'ADR 0028) :
- `journal_entries` `BEFORE INSERT` : refus si une période close contient ou suit `entry_date` ; `journal_lines` `BEFORE INSERT` : refus d'ajouter une ligne à une écriture d'une période close ;
- `accounting_periods` : `BEFORE UPDATE` et `BEFORE DELETE` refusés ; `BEFORE INSERT` refuse un mois qui ne suit pas le dernier mois clos ;
- `fee_statements` : mise à jour et suppression refusées ;
- `payout_items` : suppression refusée ; `BEFORE UPDATE` refuse de modifier mandant, montant et compte de paiement d'un élément validé, et toute sortie d'un statut terminal (`paid` ne va qu'à `returned`) ; `payout_batches` : suppression refusée, numéro figé ; `payout_holds` : suppression refusée, seule `released_at` passe de nul à renseigné ;
- `installments` : `mandate_id` et `mandant_party_id` ne changent plus une fois posés (`<=>`).

**Invariants sans contrainte native** (tenus par une Action sous verrou, vérifiés par `ownerfunds:verify`) : compte mandant jamais débiteur par décaissement, équation de cantonnement, `PayoutsInTransit` = somme des éléments `pending`, un appel routé selon le mandat.

### 10. Idempotence

Écritures : clés du tableau de la décision 2 ; rejeu même contenu renvoie l'existante, contenu différent refusé (`PostJournalEntry`). HTTP : en-tête `Idempotency-Key` obligatoire sur création de lot, validation, exécution, retour, clôture et prélèvement ; même clé et même contenu : 200 rejoué ; contenu différent : 409 `owner_funds_idempotency_key_reused`. Clôture : clé `accounting:period:{organisation}:{AAAA-MM}`. Aucun événement ni listener asynchrone en phase 1 : tout est synchrone dans la transaction (ADR 0007) ; les commandes `ownerfunds:*` sont le rattrapage. Les événements (`PayoutExecuted`…) s'ajouteront avec leur premier consommateur (règle de l'ADR 0025).

### 11. Rôles, routes et débits

Organisation, `/api/v1/org/{organization}/…` (`auth:sanctum`, `space:organization`, `no-operator-token`, noms `ownerfunds.*` et `accounting.periods.*`) :

| Action | Rôles | Débit |
|---|---|---|
| Lecture : compte mandant (`owner-funds/mandants/{mandant}/account`), aperçu de reversement, lots, honoraires par mois, couverture (`owner-funds/trust/coverage`), périodes (`accounting/periods`) | propriétaire, administrateur, gestionnaire, comptable | 120/min |
| Préparer : créer un lot, inclure ou exclure un mandant, poser une retenue | propriétaire, administrateur, gestionnaire, comptable | 60/min |
| Lever une retenue, valider, exécuter, échec, retour, annuler un lot, prélever les honoraires (`trust/withdrawals`), demander puis confirmer un apport (`trust/deposits`), clôturer (`accounting/periods/close`), avec double authentification obligatoire | propriétaire, administrateur, comptable | 20/min par utilisateur |
| Export CSV d'un lot | propriétaire, administrateur, comptable | 10/min par utilisateur |

- Le **gestionnaire prépare, il ne fait jamais sortir d'argent** ni ne clôture.
- Une organisation `individual` n'a ni mandant, ni lot, ni honoraires : 403 `owner_funds_agency_only` (policy sur le type d'organisation, ADR 0006).
- 404 sur le mandant, le lot, l'élément ou la période d'une autre organisation. Aucune route dans les espaces locataire, propriétaire ou console : le mandant lit son compte par Reporting (ADR 0030, lot 3). Rattrapage : commande uniquement, pas d'API.
- Le client n'envoie que des identifiants, dates, motifs, `lock_version` et clés d'idempotence : jamais un montant de reversement ni d'honoraires, une devise, un statut, un numéro ou un compte bancaire.
- Codes RFC 9457 (`OwnerFunds\Enums\ErrorCode`, ADR 0014) : `payout_batch_not_found` 404 ; `payout_stale_version` 409 ; `payout_not_validatable` 409 ; `payout_item_excluded` 409 ; `payout_second_approver_required` 403 ; `payout_cancel_forbidden` 409 ; `owner_funds_agency_only` 403 ; `owner_funds_idempotency_key_reused` 409 ; `owner_funds_insufficient` 409 ; `fee_base_missing` 422 ; `period_not_closed` 409 ; `trust_funds_gap` 409 ; `trust_withdrawal_exceeds_surplus` 409 ; `owner_funds_jurisdiction_unsupported` 422. Accounting : `accounting_period_closed` 409, `accounting_period_not_closable` 409, `accounting_period_order` 409. Invoicing : `invoice_fee_computed_by_server` 422.
- Juridiction : contrat `Jurisdictions/OwnerFundsRules` (ADR 0008), implémentation `Fr` seule ; autre pays : 422 `owner_funds_jurisdiction_unsupported`, jamais de repli.

### 12. Sécurité, données personnelles et audit

- **IDOR et injection** : `BelongsToOrganization`, `whereUuid`, policies ; mandant, mandat et prestataire vérifiés par PublicApi dans l'organisation courante.
- **Fraude au reversement** : double contrôle, délai après changement d'IBAN, IBAN jamais renvoyé par l'API (quatre derniers caractères), référence bancaire ≤ 64 caractères sans donnée personnelle, plafonds de débit, validation par un rôle sans accès aux saisies d'encaissement.
- **RGPD** : l'anonymisation d'un mandant ne modifie aucune écriture, facture ni élément de reversement (conservation comptable, **à faire confirmer par un conseil juridique**) ; l'historique affiche alors la partie effacée. Aucun nom ni IBAN copié dans OwnerFunds. Conservation dix ans, **à confirmer** ; pas de purge en phase 1.
- **Audit** (`Auditable` sur lots, éléments, retenues, périodes, relevés d'honoraires ; `RecordAudit` sinon, ADR 0016, toujours dans la transaction) : `ownerfunds.batch.created`, `.validated`, `.cancelled`, `ownerfunds.payout.executed`, `.failed`, `.returned`, `ownerfunds.hold.placed`, `.released`, `ownerfunds.fees.invoiced`, `ownerfunds.trust.withdrawn`, `ownerfunds.backfill.applied`, `ownerfunds.verify.anomaly`, `accounting.period.closed`. **Aucun montant ni donnée personnelle dans `metadata`** : identifiants, comptes et motifs.
- Pas de notification de montant ; la notification au mandant (`owner.payout_executed`) relève de l'ADR « Espace propriétaire ».

### 13. Livraison en quatre lots

1. **Socle** : rôles et types de source, périodes et verrou, `LedgerAggregates`, routage Rent et colonnes, `ownerfunds:backfill`, `ownerfunds:verify`.
2. **Honoraires** : barème (ADR 0025), `FeeCalculator`, `fee_statements`, `ManagementFeeInvoices`, compensation, avoirs.
3. **Reversements manuels** : retenues, lots, validation, exécution, export, double contrôle ; règlement prestataire sur fonds de tiers (Maintenance).
4. **Cantonnement** : prélèvement des honoraires, garantie financière, dépôt de garantie (après son ADR). **Après le lot 2 et le lot 3, l'ADR 0030 lot 2 peut démarrer.**

### 14. Durcissement après revue de sécurité (2026-11-19)

Amendements de la revue indépendante du module, appliqués au code et aux tests :

- **Double authentification** : le rôle comptable d'une agence n'en était pas exigé (`EnterOrganization` ne l'impose qu'aux rôles qui gèrent l'équipe). Les routes « sensible » et « export » d'OwnerFunds, le règlement d'un prestataire et son annulation (Maintenance) portent le middleware `two-factor` (Organizations) : 403 `two_factor_required` pour tout rôle sans double authentification confirmée. La lecture et la préparation restent ouvertes au comptable sans double authentification.
- **Double contrôle figé** : voir décision 4 ; `require_second_approver` reste un réglage de **configuration plateforme** (`OWNER_FUNDS_REQUIRE_SECOND_APPROVER`), pas un réglage d'organisation : l'ADR 0018 ne fournit pas encore de magasin de réglages, et un réglage modifiable par l'organisation permettrait à un administrateur de couper lui-même le contrôle. **Écart assumé** avec la liste des réglages d'organisation de la décision 9 ; à reprendre quand le magasin de réglages existera, avec un audit de chaque changement.
- **Apport au compte de tiers en deux temps** : `POST trust/deposits` enregistre une demande `pending` sans écriture ; `POST trust/deposits/{deposit}/confirm` l'écrit (débit `TrustBank`, crédit `Bank`) sous les mêmes règles de double contrôle que l'exécution (exigence figée à la demande, mode solo si l'équipe n'a pas changé). La référence de rapprochement bancaire (3 à 64 caractères) est obligatoire. `GET trust/deposits` liste les demandes. Le prélèvement des honoraires reste en un temps : plafonné à l'excédent et refusé en cas d'écart.
- **Version du lot** : `lock_version` est obligatoire sur `validate` et `cancel` (422 sinon) ; version périmée : 409 `payout_stale_version`. La version entre dans l'empreinte d'idempotence.
- **Ordre des verrous de la validation d'un mandant** : verrou du compte, puis verrou du lot, puis verrou de la ligne (test d'ordre).
- **Contrôle quotidien étendu** (`ownerfunds:verify`) : équation de cantonnement, `PayoutsInTransit` égal à la somme des lignes `pending`, aucun compte mandant débiteur ; chaque anomalie est auditée (`ownerfunds.verify.anomaly`, `kind`).
- **Compte de paiement modifié après la validation** : l'exécution est refusée en 409 `payout_account_changed` tant que l'appelant n'a pas reconnu le changement (`acknowledge_account_change: true`) ; l'audit de l'exécution porte `account_changed`. Le virement part vers le compte figé sur la ligne, jamais vers le nouveau.
- **CSV** : les champs commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot sont préfixés d'une apostrophe.
- **Course sur le reversement vivant** : deux créations concurrentes pour le même mandant répondent 409 `payout_not_validatable`, jamais 500.
- **Aperçu borné** : `GET payouts/preview?limit=` (1 à `OWNER_FUNDS_BATCH_MAX`, 20 par défaut via `OWNER_FUNDS_PREVIEW_LIMIT`), réponse `meta.limit` et `meta.truncated` ; 20 requêtes par minute. Chaque mandant coûte une évaluation complète (environ 40 requêtes).
- **Règlement d'un prestataire sur fonds de tiers (Maintenance, amendement de l'ADR 0029)** : (1) un engagement est obligatoire (devis accepté ou estimation approuvée) : 409 `supplier_payment_engagement_required` ; (2) le cantonnement doit être couvert avant le décaissement : 409 `trust_funds_gap` ; (3) au-delà d'un seuil (`MAINTENANCE_THIRD_PARTY_SECOND_APPROVAL_MINOR`, **100 000 unités mineures par défaut, à fixer avec l'expert-comptable**), la personne qui règle n'est pas celle qui a saisi la facture, sauf équipe réduite à un membre habilité : 403 `supplier_payment_second_approver_required` ; (4) l'empreinte d'idempotence du règlement inclut `own_funds_advance`. Règle de séquence : l'imputation de la facture au mandant précède des règlements successifs, faute de quoi le second règlement sur fonds de tiers bute sur l'écart de cantonnement.

## Options écartées

- **Créditer `OwnerPayable` dès l'appel** : l'agence reconnaîtrait une dette sur de l'argent non reçu ; l'équation de cantonnement ne tiendrait jamais.
- **Sous-livre des mandants hors grand livre** (tables de soldes de mandants) : second solde, divergence silencieuse (ADR 0007).
- **Honoraires à l'échéance (loyer appelé)** : honoraires sur des loyers non perçus, créance contre le mandant, contentieux.
- **Honoraires écrits à chaque encaissement** : minimum et forfait mensuels incalculables, une écriture et une facture par loyer.
- **Honoraires saisis à la main maintenus** (ADR 0028) : le serveur ne recalcule rien et deux agences facturent des bases différentes.
- **Retenue des honoraires « à l'encaissement »** (option de l'écran) : voir ci-dessus ; reportée.
- **Écriture de reversement directe `OwnerPayable` → `TrustBank` à la validation** : un reversement validé mais non viré ferait croire que l'argent est sorti ; `PayoutsInTransit` garde le grand livre juste et la réservation sans table de soldes.
- **Fichier de virements SEPA (`pain.001`) généré par eGuardImmo** : version maison d'un moyen de paiement (ADR 0011) ; attendre le PSP ou la banque.
- **Fonds des mandants sur un compte de la plateforme** : agrément d'établissement de paiement ; écarté par l'ADR 0011.
- **Module dans Accounting** : Accounting devrait appeler Invoicing alors qu'Invoicing l'appelle (cycle). **Module dans Mandates** : Mandates → Invoicing créerait le même cycle (Invoicing → Mandates) et mêlerait registre et trésorerie.
- **Réouverture d'un mois clos** : un compte rendu publié changerait ; la correction se fait par rectificatif.
- **Refuser les encaissements antidatés** : un encaissement réel ne peut pas être refusé parce que le mois est clos ; il est écrit au premier jour ouvert.
- **Bloquer un encaissement en cas d'écart de cantonnement** : refuser de comptabiliser de l'argent reçu aggraverait l'écart.
- **Valeur par défaut de `fee_base` sur les mandats existants** : un taux appliqué sur une base devinée est une erreur facturée à un tiers.
- **Déplacer la banque lors du rattrapage** : on ne sait pas sur quel compte l'argent a été reçu.
- **Imputation loyer d'abord, charges ensuite** : favorise une partie sans texte clair (à confirmer) ; prorata retenu.
- **Event sourcing, CQRS, outbox** : hors de proportion (ADR 0007).

## Conséquences

- **Amendement de l'ADR 0005** (appliqué) : module **OwnerFunds** (famille Gestion : honoraires de gestion, reversements, contrôle des fonds de tiers) créé par `php artisan make:module OwnerFunds` ; OwnerFunds → Accounting (`Ledger`, `LedgerReader`, `LedgerAggregates`), Mandates (`MandateDirectory`), Parties (`PartyDirectory::payoutAccount`), Invoicing (`ManagementFeeInvoices`), Organizations (`MembershipDirectory`, `OrganizationDirectory`), Catalog ; **Rent → Mandates** (`MandateDirectory`, lecture seule) ; Maintenance → Accounting inchangé. Aucun module n'appelle OwnerFunds ; Reporting lit le grand livre (ADR 0030). Pas de cycle : Invoicing n'appelle pas OwnerFunds.
- **Amendement de l'ADR 0007** : le grand livre distingue les fonds de l'agence et ceux des mandants ; une écriture ne se passe jamais dans une période close ; équation de cantonnement ; ordre des verrous inter-modules.
- **Amendement de l'ADR 0025** : `fee_base`, `fee_minimum_amount`, `fee_tax_mode` sur `mandate_terms`, avenant obligatoire pour les anciens mandats ; `payout_day` utilisé pour l'aperçu ; le compte mandant survit au mandat.
- **Amendement de l'ADR 0026** : appel et imputation routés vers les comptes de mandant, colonnes `installments.mandate_id` et `mandant_party_id`, `onClosedPeriod = roll_forward`, annulation sous verrou du compte mandant.
- **Amendement de l'ADR 0028** : honoraires de gestion générés par le serveur, méthode `owner_account`, avoir recréditant le compte du mandant.
- **Amendement de l'ADR 0029** : règlement de prestataire sur lot sous mandat depuis `TrustBank` ou refus ; compte mandant débiteur signalé.
- **Amendement de l'ADR 0030** : table de la décision 2 précisée (pas de `owner_allocation`), résolution du mandant par `party_id`, publication réservée aux périodes closes, `LedgerAggregates` étendu.
- **Ajouts hors OwnerFunds** : Accounting (rôles, types de source, périodes, verrous, `LedgerAggregates`, déclencheurs) ; Parties (`payoutAccount`, compte de paiement valide et date de changement) ; Organizations (montant de la garantie financière).
- **Planification** : `ownerfunds:verify` et `ownerfunds:reconcile` chaque jour ; `accounting:verify` existant. **Configuration** : `OWNER_FUNDS_BATCH_MAX` (50) ; réglages d'organisation de la décision 9.
- **Front** : `compose.ts`, `engine.ts` et les calculs d'honoraires, de net et d'impact côté navigateur disparaissent ; l'écran de barème gagne base, minimum et mode TTC ou HT, et perd « prélèvement à l'encaissement » ; les écrans de reversement lisent l'aperçu serveur, affichent les motifs d'exclusion, la validation par mandant, l'exécution avec référence, le retour ; états `a_reverser`, `reverse`, `bloque` remplacés par `included`, `excluded`, `pending`, `paid`, `failed`, `returned` ; `ibanLast4` vient du serveur ; clôture de mois et couverture des fonds de tiers à ajouter.
- **Tests attendus** :
  - accès : 401, 403 par rôle (gestionnaire sans validation, exécution, prélèvement ni clôture ; comptable sans double authentification refusé sur les routes sensibles ; la séparation de la saisie d'encaissement est à trancher, décision 11), 404 sur le mandant, le lot, l'élément, la période d'une autre organisation, organisation `individual` refusée, jeton opérateur refusé ;
  - nominal complet : mandat, appel, encaissement partiel puis solde, ventilation exacte, clôture, honoraires et facture, compensation, validation, exécution, relevé égal au grand livre ;
  - routage : lot sous mandat jamais en `RentRevenue`, bailleur autonome inchangé, mandat modifié après l'émission sans effet, ventilation au prorata avec arrondis (1, 3, 7 unités mineures, XOF sans décimale) ;
  - invariants : compte mandant jamais débiteur par décaissement sous concurrence (validation contre annulation d'encaissement, deux validations), un seul reversement vivant par mandant, `PayoutsInTransit` égal aux éléments `pending`, équation de cantonnement, écart bloquant reversement et clôture mais pas l'encaissement ;
  - honoraires : pourcentage, forfait, minimum, avenant en cours de mois, TTC et HT, franchise de TVA, base négative et avoir, `fee_base_missing`, mois non clos refusé, ligne `fee.management` manuelle refusée ;
  - reversement : exclusions typées, `stale`, panne de PDF sans écriture pour ce mandant seul, double contrôle, IBAN changé récemment, retour bancaire, annulation d'un lot, retenue pleine et partielle ;
  - clôture : séquentielle, 409 sur une écriture datée d'un mois clos (appel direct, requête SQL, ajout de ligne : déclencheurs), `roll_forward` d'un encaissement antidaté, contrepassation datée d'aujourd'hui, pré-conditions bloquantes, concurrence clôture et écriture, publication d'un compte rendu réservée aux mois clos ;
  - déclencheurs MySQL : mise à jour et suppression d'une période, d'un relevé, d'un élément validé, d'une retenue, d'un lot numéroté ;
  - idempotence : rejeu 200, conflit 409, clés d'écriture rejouées ;
  - rattrapage : `--dry-run` sans écriture, `--apply` rejoué sans doublon, échéance `unmapped` intacte, refus après première clôture, écart de cantonnement révélé puis résorbé par `trust_transfer` ;
  - architecture : aucune écriture de `journal_*` hors Accounting, pas de `float`, `Idempotency-Key` présent, liens de modules conformes ;
  - audit : une ligne par action, sans montant ni donnée personnelle ; performance : nombre de requêtes constant d'un aperçu de 10, 100 et 1 000 mandants.
- **Risques** :
  - Routage faux (mandat saisi après l'avis) : produit d'agence à tort ; détecté par `ownerfunds:verify`, repris par `--apply`.
  - Une agence non conforme (fonds reçus sur le compte propre) voit un écart dès l'activation ; c'est voulu mais à annoncer.
  - Gotenberg lent dans la validation : borné à 15 s par mandant, comme l'ADR 0028.
  - Le prorata et l'ordre d'imputation, l'exigibilité de la TVA à la compensation et l'équation de cantonnement sont des choix comptables non tranchés par un texte lu ici.
- **Points à faire valider par un expert-comptable ou un juriste** :
  1. équation de cantonnement (espèces, dépôts de garantie, TVA des mandants, avances) et compte de tiers unique ou par mandant ;
  2. exigibilité de la TVA sur honoraires à la compensation sur le compte du mandant ;
  3. honoraires facturés mensuellement par mandat, base hors TVA, taux exprimé TTC ou HT dans le mandat ;
  4. imputation d'un encaissement partiel entre loyer, charges et TVA ;
  5. dépôt de garantie : tenu par l'agence ou le propriétaire, retenue sur impayé comme encaissement ;
  6. montant de garantie financière à comparer aux fonds détenus ;
  7. conservation dix ans et effacement d'un mandant ;
  8. régime du virement mandant (délai, mention de la loi Hoguet) et de l'indivision (reversement unique au mandataire commun).
- **Reste à faire** : encaissement et restitution du dépôt de garantie ; régularisation de charges ; indivision et répartition ; honoraires de relocation et de suivi de travaux ; virement SEPA par un PSP ; rapprochement bancaire (Payments) ; notification au mandant ; juridictions `Be`, `Lu`, `Ca/Qc` ; déclaration de TVA des mandants.

## Décisions à valider

Ma recommandation est toujours la première.

1. **Fonds des mandants dans le grand livre existant : appel crédité sur des comptes « appelés pour le compte des mandants », encaissement qui crédite `OwnerPayable` dans la même écriture, `TrustBank` distinct, jamais de produit d'agence sur un lot sous mandat ; imputation partielle au prorata des restes.** Alternatives : `OwnerPayable` dès l'appel, sous-livre hors grand livre, imputation loyer puis charges.
2. **Nouveau module `OwnerFunds` (honoraires, reversements, contrôle) ; clôture et verrous dans Accounting ; Rent → Mandates.** Alternatives : dans Accounting ou dans Mandates (cycles avec Invoicing).
3. **Honoraires : fait générateur = encaissement, calcul mensuel par mandat sur un mois clos, facture mensuelle au mandant par le serveur (`fee.management` plus saisissable), réglée par compensation sur le compte du mandant, avoir recréditant le compte.** Alternatives : à l'échéance, à chaque encaissement, saisie manuelle maintenue.
4. **Barème étendu par amendement de l'ADR 0025 (base, minimum, mode TTC ou HT), sans valeur par défaut pour les mandats existants (avenant obligatoire).** Alternative : défaut `rent_and_charges`.
5. **Reversement : lot en brouillon, validation par mandant vers `PayoutsInTransit`, exécution manuelle avec double contrôle, export CSV sans IBAN, pas de `pain.001` ; virement par PSP différé.** Alternatives : écriture directe à la validation, fichier de virement maison.
6. **Clôture mensuelle séquentielle, immuable (déclencheurs), sans réouverture ; erreurs corrigées par écriture rectificative dans le mois ouvert ; encaissement antidaté écrit au premier jour ouvert.** Alternatives : réouverture du dernier mois, clôture annuelle, refus des antidatés.
7. **Cantonnement : équation vérifiée à la clôture, avant reversement et prélèvement ; un écart bloque reversements, prélèvements et clôture, jamais un encaissement ; garantie financière en alerte.** Alternatives : blocage des encaissements, contrôle mensuel seul.
8. **Compte mandant jamais débiteur par un décaissement ; règlement d'un prestataire depuis le compte de tiers refusé si le solde est insuffisant (amendement de l'ADR 0029).** Alternative : découvert tracé sur le compte du mandant.
9. **Rattrapage par organisation : `--dry-run` puis `--apply`, dates d'origine avant la première clôture, banque non déplacée (écart révélé puis résorbé par un virement vers le compte de tiers), activation par `owner_funds.cutover_at`.** Alternatives : repartir à zéro à une date d'ouverture, reclasser aussi la banque par hypothèse.
10. **Dépôt de garantie hors net reversable (`SecurityDeposits` contre `TrustBank`), encaissement et restitution dans un ADR dédié.** Alternative : le traiter comme un fonds du mandant.
11. **À trancher : séparation entre la saisie des encaissements et la validation des reversements.** La section 12 vise « une validation par un rôle sans accès aux saisies d'encaissement » et les tests attendus un « comptable sans saisie d'encaissement hors Rent », mais les routes Rent actuelles autorisent le comptable à saisir un encaissement (elles ne sont pas modifiées par cet ADR). Un comptable peut donc saisir un encaissement puis valider un reversement. **Risque résiduel accepté en attendant la décision** : couvert par la double authentification obligatoire (§ 14) et par le second approbateur distinct à l'exécution quand l'équipe compte au moins deux membres habilités. Alternatives : retirer la saisie d'encaissement au comptable (changement de rôles Rent, hors périmètre), ou interdire à l'auteur d'un encaissement de valider le lot qui le reverse.

## Amendement du 2026-11-19 (ADR 0032, lot 3)

- `payout_holds.reason` gagne `account_change_contested` : posé par la contestation du mandant, jamais par l'agence (`PlaceHoldRequest` l'exclut).
- `bank_accounts.status` (`active`, `pending`, `rejected`, défaut `active`) et `activated_at` : `PayoutAccounts` et `payoutAccount` ne lisent que `active` ; la date de changement du contrôle `account_recently_changed` est l'**activation**.
- Table `payout_account_requests` (une demande vivante par mandant), événements `PayoutAccountChangeRequested|Confirmed|Approved|Contested` ; `PayoutExecuted` et `PayoutReturned` portent `mandantPartyId`.
- Approbation par ressaisie de l'IBAN et du titulaire, `lock_version` obligatoire, pièce lisible par une route dédiée ; commande `ownerfunds:expire-payout-requests` ; réglages `OWNER_PAYOUT_REQUEST_DAYS`, `OWNER_FUNDS_PAYOUT_CODE_MINUTES`, `OWNER_FUNDS_PAYOUT_CODE_ATTEMPTS`, `OWNER_FUNDS_PAYOUT_PROOF_RETENTION_YEARS`.

## Amendement du 2026-11-20 (ADR 0040)

- Simulation des honoraires : `POST /org/{organization}/owner-funds/fees/simulations` (`FeeSimulator`), sur les mois clos les plus récents, sans aucune écriture (ni `fee_statements` ni grand livre) ; honoraires actuels lus du relevé s'il existe, sinon calculés au barème en vigueur.
- Reste à faire précisé : les taux de relocation et de suivi de travaux (`letting_fee_basis_points`, `works_fee_basis_points`) sont enregistrés mais leur facturation reste manuelle ; aucune écriture automatique n'est produite.
