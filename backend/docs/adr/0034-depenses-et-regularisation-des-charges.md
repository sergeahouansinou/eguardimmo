# ADR 0034 — Dépenses du bailleur, clés de répartition et régularisation des charges locatives (module Charges)

Statut : accepté (2026-11-19), recommandations validées telles quelles. Décide ce que l'ADR 0005 (« Accounting : dépenses, régularisation de charges »), l'ADR 0028 (« régularisation : décompte, reste dans Accounting »), l'ADR 0030 (§ 6 et § 15 : « ADR Dépenses à écrire ») et l'ADR 0031 (§ 2 : « régularisation par le compte du mandant, ADR dédié ») avaient reporté. Complète l'ADR 0003 (espaces), l'ADR 0005 (modules), l'ADR 0006 (cloisonnement), l'ADR 0007 (grand livre, verrous), l'ADR 0008 (juridictions), l'ADR 0011 (normes), l'ADR 0016 (journal), l'ADR 0017 (intégrité), l'ADR 0018 (référentiels), l'ADR 0020 (bail composé), l'ADR 0021 (pièces), l'ADR 0022 (instantané), l'ADR 0024 (espace locataire), l'ADR 0025 (mandats), l'ADR 0026 (loyers), l'ADR 0027 (notifications), l'ADR 0028 (factures), l'ADR 0029 (maintenance), l'ADR 0030 (comptes rendus), l'ADR 0031 (fonds des mandants) et l'ADR 0032 (espace propriétaire). Amendements appliqués le 2026-11-19 aux ADR 0005, 0007, 0016, 0018, 0020, 0024, 0026, 0027, 0028, 0029, 0030, 0031 et 0032 (ligne d'amendement datée dans chacun). Les règles de droit citées viennent de sources secondaires (Service-public.gouv.fr, cabinets d'avocats) ; Légifrance n'a pas pu être lu par un outil automatique : **tout est à confirmer** sur le texte officiel en vigueur et avec un juriste ou un expert-comptable avant l'implémentation (ADR 0011).

## Contexte

Constaté dans le code et les écrans :
- **Aucun serveur.** `Accounting` est un module feuille (aucune dépendance) : grand livre, périodes, `LedgerReader`, `LedgerAggregates`. Il connaît le rôle `Expenses` (5000), `ChargesRecovered` (4100), `OwnerChargesCalled` (3020), mais aucune dépense ni régularisation n'est écrite. Il est appelé par Rent, Invoicing, Maintenance, OwnerFunds, Recovery, Messaging et Reporting.
- **Rent** appelle la provision (`charges_provision`) et le forfait (`charges_flat`) ligne par mois civil (`installment_lines`, montants non signés) ; l'écriture d'appel crédite `ChargesRecovered` (bailleur autonome) ou `OwnerChargesCalled` (lot sous mandat, ADR 0031). Le surplus d'un encaissement est une **avance** du bail, reprise automatiquement à l'avis suivant. Aucune ligne ne peut porter une régularisation ; aucun remboursement d'avance n'existe.
- **Maintenance** enregistre les factures reçues d'une intervention et les impute au propriétaire ; « aucun module n'appelle Maintenance ». Elle exclut contrats d'entretien, sinistres et charges de copropriété (ADR 0029).
- **Catalog** a déjà le vocabulaire `expense_category` (sens `expense.maintenance`, `repairs`, `improvements`, `insurance`, `property_tax`, `management_fees`, `loan_interest`, `utilities`, `co_ownership`, `other`) et `expense_semantic` sur `intervention_nature`. **Documents** a `IssuedDocumentType::ChargesRegularization`. **Properties** a la surface des lots (`surface_hundredths`) mais **aucun tantième**.
- **Écrans en démonstration** (audit des pages gatées du 2026-11-19) :
  - bailleur autonome (`apps/proprietaire`, `packages/gestion`) : `/finances/depenses` (bien en texte, type parmi six, TTC, fournisseur libre, `deductible`, `recuperable`, `nonComptabilise`, justificatif), `/finances/regularisation` (provisions et charges réelles **saisies à la main**, « une facture sera émise »), `/finances/prets` (emprunt, taux, échéancier), `/finances/bilan` ;
  - agence et bailleur (`packages/gestion`, onglets d'immeuble gatés `charges` et `copropriete`) : budget par poste, clé (`tantiemes`, `surface`), pourcentage récupérable, répartition par lot avec provisions ;
  - locataire (`/loyers/regularisation`, `chargesSchema`) : année, provisions, charges réelles, solde, statut `remboursee | a_regler | compensee`, lignes `{label, split, amount}` (« Tantièmes, 64,2 m² », « Consommation »), provision actuelle.
  La démonstration calcule tout dans le navigateur, fait confiance aux montants saisis et passe par une facture : trois points contraires à CLAUDE.md (le serveur recalcule) et à l'ADR 0028 (la régularisation n'est pas une facture).

Règles visées (sources secondaires, **à confirmer**) :
- loi n° 89-462 du 6 juillet 1989, art. 23 : charges récupérables exigibles sur justification, liste fixée par décret ; provisions régularisées au moins une fois par an ; décompte par nature de charges et, en immeuble collectif, mode de répartition, communiqués **un mois avant** la régularisation ; pièces justificatives tenues à disposition **six mois** après l'envoi du décompte ; récapitulatif transmis sur demande ; régularisation non faite avant la fin de l'année civile suivant l'exigibilité : **paiement par douzièmes sur 12 mois** à la demande du locataire ;
- décret n° 87-713 du 26 août 1987 : liste limitative des charges récupérables (logement privé) ; décret n° 82-955 pour le logement social (hors périmètre) ;
- art. 25-10 (meublé) et 8-1 (colocation) : forfait de charges possible, sans régularisation ;
- art. 7-1 : prescription de **trois ans** (point de départ à confirmer) ;
- art. 22 : en copropriété, provision d'au plus **20 % du dépôt de garantie** jusqu'à l'arrêté des comptes, régularisation dans le mois qui suit leur approbation.

## Décision

### 1. Invariants

1. **Le serveur calcule tout** : provisions, parts, solde. Le client n'envoie ni provision, ni total de charges, ni solde, ni devise.
2. **Un montant ne vient que du grand livre ou d'une pièce figée** (ADR 0007, 0022) : une dépense comptabilisée a son écriture ; une dépense non comptabilisée (payée par le mandant hors agence, relevé du syndic) est une **déclaration justifiée**, jamais un solde.
3. **Un décompte émis est immuable** : numéro continu, instantané, PDF ; une erreur se corrige par un décompte rectificatif.
4. **La régularisation ne crée jamais de produit pour l'agence** sur un lot sous mandat : elle passe par le compte du mandant (ADR 0031, invariants 1 et 3).
5. **Une part n'est jamais arrondie au détriment du locataire** : le reste d'arrondi et la vacance restent au propriétaire.
6. **Aucune donnée d'un autre locataire** dans un décompte : totaux de l'immeuble et clé, jamais la consommation ou le nom d'un autre lot.

### 2. Module : `Charges` (famille Gestion), pas Accounting

- Nouveau module `Charges`, créé par `php artisan make:module Charges` : dépenses du bailleur, clés de répartition, exercices et décomptes de régularisation. Accounting reste le grand livre (écritures, périodes, agrégats).
- Motif : la régularisation lit Rent (provisions appelées), Leases, Properties, Mandates, Maintenance, Documents et écrit des lignes d'échéance dans Rent. Dans Accounting, **Accounting → Rent et Accounting → Maintenance créeraient deux cycles** (Rent → Accounting, Maintenance → Accounting) et Accounting perdrait son statut de feuille. Même raisonnement que l'ADR 0031 pour OwnerFunds.
- Liens (amendement de l'ADR 0005), lecture seule sauf mention :
  - Charges → Accounting (`Ledger` pour les écritures de dépense, `LedgerReader`, `LedgerAggregates`), même transaction (ADR 0007) ;
  - Charges → Rent (`ChargeProvisions::calledBetween` : provisions appelées par bail et par période ; `RentAdjustments` : **écriture** des lignes de régularisation et du crédit, dans la transaction de l'appelant) ;
  - Charges → Leases (`LeaseDirectory`, `LeaseParticipants`, `LeaseSchedule::linesBetween` pour le régime de charges), Properties (`UnitDirectory`), Mandates (`MandateDirectory::coveringUnits`), Parties (`PartyDirectory`), Organizations (`MembershipDirectory`, `OrganizationDirectory::legalIdentity`), Catalog (`TermDirectory`), Documents (`DocumentStore`, `IssuedDocuments`), Identity (`TwoFactorProofs`) ;
  - Charges → Maintenance (`SupplierInvoiceDirectory`, nouvelle : factures reçues imputées au propriétaire sur les lots d'un bien, avec nature et part) ;
  - Charges ⇢ `ChargeStatementIssued`, `ChargeRegularizationDue` ⇢ Notifications ;
  - Reporting → Charges : faits SQL (`expenses` : catégorie, lot, date, mode) ; montants par `LedgerAggregates` (décision 9).
  - Aucun de ces modules n'appelle Charges : pas de cycle.

### 3. Dépenses

**Modèle** (`expenses`, une ligne par pièce, `organization_id`, UUID v7) : `property_id`, `unit_id` (nul = immeuble ou parties communes), `kind` (`payment` : facture, avis, appel de fonds payés ; `co_ownership_statement` : relevé annuel du syndic pour un lot, sans flux), `category_term_id` (`expense_category`, clé étrangère vers `terms` permise par l'ADR 0018), `payee_party_id` (partie, facultatif) ou `payee_label` (≤ 120, organisme sans fiche : « Service des impôts »), `reference` (≤ 64), `document_on`, `service_from`, `service_to` (exclu), `currency`, `total_gross`, `tax_amount` (information), `recoverable_amount` (≤ `total_gross`), `recoverable_rubric` (rubrique de la juridiction, obligatoire si `recoverable_amount > 0`), `settlement`, `paid_on`, `mandate_id` et `mandant_party_id` (figés à l'enregistrement), `stored_file_id`, `fingerprint`, `status` (`recorded | cancelled`), `cancel_reason`, `ledger_entry_id`, `cancellation_entry_id`, `idempotency_key`, `lock_version`, `created_by_user_id`, `datetimes(6)`.

**Modes de règlement** (`settlement`) :

| Organisation | Mode | Écriture (journal `purchases`, clé `charges:expense:{id}:post`) |
|---|---|---|
| bailleur autonome | `bank`, `cash` | débit `Expenses` (lot, item = dépense) · crédit `Bank` ou `Cash` |
| agence, lot sous mandat | `trust` (sur les fonds du mandant) | débit `OwnerPayable` (mandant, lot, item = dépense) · crédit `TrustBank` |
| agence, lot sous mandat | `own_funds_advance` (avance de l'agence) | débit `OwnerPayable` · crédit `Bank` (créance sur le mandant) |
| agence | `paid_by_owner` (taxe foncière payée par le mandant, par exemple) | aucune ; pièce obligatoire |
| toutes | `none` (relevé du syndic, `kind = co_ownership_statement`) | aucune ; pièce obligatoire |

- Le bailleur autonome comptabilise toujours (`paid_by_owner` lui est refusé, 422 `expense_settlement_invalid`) : son grand livre est sa comptabilité.
- `trust` suit les règles du règlement de prestataire de l'ADR 0031 § 7 et § 14 : solde du mandant suffisant (409 `owner_funds_insufficient`), cantonnement couvert (409 `trust_funds_gap`), double authentification, second validateur au-delà de `CHARGES_THIRD_PARTY_SECOND_APPROVAL_MINOR` (100 000 unités mineures par défaut, à fixer avec l'expert-comptable) : la dépense reste `pending_approval` jusqu'à la validation d'un second membre habilité, quelle que soit la taille de l'équipe à la saisie, et la saisie comme la validation exigent une preuve 2FA datant de moins de dix minutes (403 `reauthentication_required`). `own_funds_advance` est une saisie explicite, auditée.
- Une dépense d'immeuble (`unit_id` nul) sur un bien dont les lots relèvent de plusieurs mandants à la date est refusée (422 `expense_split_required`) : l'agence saisit une pièce par mandant.
- `kind = payment` de catégorie `expense.co_ownership` (appel de fonds) porte `recoverable_amount = 0` (422 sinon) : seul le relevé annuel du syndic fonde la part récupérable, pour ne jamais compter deux fois.
- Période close (ADR 0031) : `onClosedPeriod = roll_forward`, comme Maintenance. Pas de brouillon : une pièce s'enregistre ou s'annule (contrepassation) puis se ressaisit ; une dépense déjà incluse dans un exercice non écarté ne s'annule pas (409 `expense_in_use`).
- Doublon : `(organization_id, fingerprint)` unique (409 `expense_duplicate`).
- **Fiscalité** : rien n'est décidé ici. Le sens de la catégorie suffit à Tax (déductibilité, ligne 2044) ; l'interrupteur `deductible` de l'écran disparaît. `nonComptabilise` devient le mode `paid_by_owner` ou `none`.
- **Factures d'intervention** : elles restent dans Maintenance ; Charges les lit comme source d'un poste récupérable (décision 5), jamais en copie.

### 4. Clés de répartition

- `charge_keys` (par bien) : `label`, `kind` (`tantiemes`, `surface`, `equal`, `consumption`, `custom`), `archived_at`. `charge_key_versions` (`valid_from`, `valid_to` exclu, jamais réécrites) et `charge_key_shares` (`version_id`, `unit_id`, `weight` entier ≥ 0). `surface` copie `surface_hundredths` des lots à la création de la version ; `equal` vaut 1 par lot ; `consumption` n'a pas de poids : la quantité par lot se saisit sur le poste de l'exercice (`charge_consumptions`, `quantity_milli`) d'après les relevés.
- Dans les clés, pas dans Properties : seul Charges les utilise pour calculer, et l'ADR 0020 range les caractéristiques non calculées en JSON ; elles pourront migrer vers un module de copropriété s'il existe un jour.
- Le dénominateur est la somme des poids de la version. Un lot occupé sans poids dans la clé d'un poste : 422 `charge_key_incomplete`. Une version qui change pendant l'exercice : 422 `charge_key_changed_during_period` (couper l'exercice).
- En copropriété, la part de chaque lot vient du relevé du syndic (`co_ownership_statement`, poste au lot) : aucune clé n'est nécessaire ; les tantièmes de copropriété de l'écran restent une information.

### 5. Exercice et décompte

**Exercice** (`charge_exercises`) : un bien, une période `[period_start, period_end)` de 12 mois au plus, terminée avant aujourd'hui, sans chevauchement avec un autre exercice non écarté du même bien (verrou `charge_property_locks`, ADR 0017). États : `draft` → `computed` (aperçu, recalculable) → `issuing` → `issued` ; `discarded` depuis `draft` ou `computed`.

**Postes** (`charge_items`) : `label` (≤ 120), `rubric`, `key_id` ou `unit_id` (poste au lot), `amount` (récupérable retenu). Sources (`charge_item_sources`) : `expense` ou `supplier_invoice`, avec le montant retenu. Invariant sous verrou de la source (`charge_source_locks`) : le cumul retenu d'une source sur les exercices non écartés ne dépasse pas sa part récupérable (dépense) ou la part imputée au propriétaire (facture reçue) : 409 `charge_source_exhausted`. Le serveur propose la part au prorata des jours de service compris dans l'exercice ; l'équipe ajuste dans cette borne.

**Baux concernés** : baux ayant une composante `charges_provision` sur un lot du bien pendant la période (`LeaseSchedule::linesBetween`). Un bail au forfait (`charges_flat`) n'est pas régularisé ; ses parts restent au propriétaire et sont listées comme telles. Régimes admis : ceux que la juridiction déclare (`fr.residential.*`) ; autre régime : 422 `charges_regime_unsupported`.

**Calcul** (fonction pure `Charges\Support\ShareCalculator`, `moneyphp`, jamais de `float`) :
- part d'un bail pour un poste = Σ sur ses lots `amount × poids(lot) / dénominateur × jours occupés(lot, bail) / jours de la période`, **arrondie à l'unité mineure inférieure** ;
- part du propriétaire = poste − Σ parts des baux (vacance, forfait, arrondis) ; jamais négative par construction ;
- provisions = `ChargeProvisions::calledBetween` (Rent) : lignes `charges_provision` des échéances **émises et non annulées** dont le mois tombe dans la période, contrepassations déduites ; le reste dû de ces échéances est affiché (« dont non réglé »), sans entrer dans le solde (il reste une créance de loyer) ;
- solde = Σ parts − provisions ; positif : à payer par le locataire ; négatif : à lui rendre ;
- provision suggérée = Σ parts / 12 sur une période de 12 mois, arrondie au demi supérieur ; simple suggestion, appliquée par la révision de bail existante (`POST /leases/{lease}/terms/revise`).
- XOF (aucune juridiction ouverte aujourd'hui) : même calcul, l'unité mineure est le franc.

**Décompte par bail** (`charge_statements`) : `exercise_id`, `lease_id`, `number` (`DC-AAAA-NNNN`, `charge_sequences`, `ContinuousCounter` pris à l'émission), `status` (`computed | issued | failed | superseded`), `occupied_days`, `share_total`, `provisions_called`, `provisions_unpaid`, `balance` (`bigint` signé), `suggested_monthly_provision`, `settlement` (`next_installments | plan_12 | standalone_installment | credit | none`), `not_before`, `mandate_id`, `mandant_party_id`, `snapshot`, `fingerprint`, `template_version`, `issued_document_id`, `stored_file_id`, `supersedes_id`, `rectification_reason`, `idempotency_key`, `lock_version`. Lignes figées `charge_statement_lines` : poste, rubrique, libellé de répartition (« Tantièmes 64/1 000 », « Surface 64,2 m² », « Consommation »), base, poids, dénominateur, jours, part.

### 6. Émission, règlement du solde, rectificatif

- **Émission** (`POST …/exercises/{id}/issue`, `Idempotency-Key`) : verrou de l'exercice, dernier recalcul, gel des postes, puis **deux courtes transactions par bail** (modèle de l'ADR 0031), le rendu hors de tout verrou entre les deux : (1) numéro, effet sur le compte du locataire ci-dessous et instantané, attachés au décompte qui reste `computed` ou `failed` ; (2) PDF Gotenberg rendu sans transaction (`app/Shared/Pdf`, 503 `charges_pdf_unavailable`), puis pièce Documents (`ChargesRegularization`), passage `issued`, audit. Une panne du rendu laisse le décompte `failed` avec son numéro réservé (pas de trou) et son effet posé une seule fois : la reprise saute la première phase. Un bail en panne reste `failed` et se reprend (`POST statements/{id}/retry`) ; l'exercice passe `issued` quand plus aucun décompte n'est `computed` ou `failed`.
- **Solde positif** : `RentAdjustments::schedule` crée dans Rent une ligne en attente (`rent_adjustments`), facturée sur la **première échéance générée** dont la période commence au plus tôt à `not_before` = date d'émission + délai de la juridiction (un mois en France). Ligne d'échéance de sens système `charges_adjustment` : l'appel suit l'écriture existante de Rent (crédit `ChargesRecovered` ou `OwnerChargesCalled`), puis encaissement, ventilation, quittance (charges distinguées, art. 21), recouvrement, honoraires : rien de nouveau.
  - **Paiement par douzièmes** (`POST statements/{id}/installment-plan`, avant facturation) : douze lignes mensuelles, l'écart d'arrondi sur la dernière. Ouvert de droit quand le décompte est tardif (`ChargeRules::isLate` : émis après la fin de l'année civile qui suit la fin de la période) et que l'équipe enregistre la demande du locataire avec sa pièce ; possible aussi par accord en dehors de ce cas.
  - **Bail terminé** (aucune échéance à venir) : Rent émet une **échéance ponctuelle** (`installments.kind = adjustment`), avis compris. L'imputation sur le dépôt de garantie (art. 22, 20 % en copropriété) attend l'ADR « Dépôt de garantie ».
- **Solde négatif** : `RentAdjustments::credit` écrit, sous le verrou du bail puis du compte mandant (ordre de l'ADR 0031) : débit `ChargesRecovered` (bailleur autonome) ou `OwnerPayable` (mandant, lot) · crédit `TenantReceivable` sans créance (avance du bail), source `charge_statement`, clé `charges:statement:{id}:credit`. Rent la reprend automatiquement à l'avis suivant (« compensé »). Le remboursement par virement (bail terminé ou demande du locataire) est un **remboursement d'avance générique de Rent** (`POST /rent/leases/{lease}/refunds`, plafonné à l'avance du bail, débit `TenantReceivable` · crédit `Bank` ou `TrustBank`) : il règle aussi le « remboursement d'un trop-perçu » laissé en attente par l'ADR 0028. Le compte du mandant peut devenir débiteur par ce débit de charge (pas un décaissement) : signalé, reversement exclu (`negative_balance`, ADR 0031).
- **Rectificatif** (`POST statements/{id}/rectify`, motif obligatoire) : nouvel exercice partiel limité au bail, nouveau décompte (`supersedes_id`) dont l'effet est la **différence** avec le précédent (ligne positive ou crédit) ; l'ancien passe `superseded` et reste lisible. Le plafond des sources d'un rectificatif est la part récupérable moins ce que retiennent les exercices d'origine non écartés autres que celui du décompte rectifié (les rectificatifs ne comptent pas pour les autres) ; `charges:verify` applique la même règle.
- **Prescription** : un exercice dont la fin date de plus de trois ans exige `acknowledge_prescription: true` (422 `charges_prescription_ack_required`), journalisé ; l'interface prévient.

### 7. Droits, routes et débits

`/api/v1/org/{organization}/charges/…` (`auth:sanctum`, `space:organization`, `no-operator-token`, noms `charges.*`, codes RFC 9457 dans `Charges\Enums\ErrorCode`) :

| Action | Rôles | Débit |
|---|---|---|
| Lecture : dépenses, clés, exercices, décomptes, PDF, pièces | propriétaire, administrateur, gestionnaire, comptable | 120/min |
| Dépense `bank`, `cash`, `paid_by_owner`, `none` ; clés ; exercice (créer, postes, calcul, écarter) | les mêmes quatre | 60/min |
| Dépense `trust` ou `own_funds_advance`, annulation d'une dépense comptabilisée | propriétaire, administrateur, comptable ; `two-factor` | 20/min |
| Émettre, reprendre, rectifier, douzièmes, publier une pièce au locataire | propriétaire, administrateur, gestionnaire | 20/min |
| Exports CSV | propriétaire, administrateur, comptable | 10/min |

- Le comptable prépare et vérifie, il n'adresse rien au locataire (règle de l'ADR 0030) ; le gestionnaire ne fait sortir aucun argent (ADR 0031). Le remboursement d'avance suit les rôles et la double authentification des sorties d'argent : propriétaire, administrateur, comptable.
- Routes : `expenses` (`GET`, `POST`, `GET {id}`, `POST {id}/cancel`, `POST {id}/files`), `properties/{property}/charge-keys` (`GET`, `POST`, `POST {key}/versions`, `POST {key}/archive`), `exercises` (`GET`, `POST`, `GET {id}`, `PATCH {id}`, `POST {id}/{compute|issue|discard}`, `GET {id}/statements.csv`), `statements/{id}` (`GET`, `GET pdf`, `POST {retry|rectify|installment-plan}`, `PATCH files/{file}` pour la visibilité).
- **Locataire** (`/api/v1/tenant/charge-statements`, `space:tenant`, `verified`, 60/min, `private, no-store`) : liste, détail, PDF, pièces partagées ; clé `LeaseDirectory::visibleToTenant` (ADR 0024), `Queries/` avec `AcrossOrganizations` ; hors clé ou hors grâce : 404 `charge_statement_not_found`.
- **Propriétaire mandant** (`/owner/charge-statements`, lecture seule, lot 6) : clé `MandateDirectory::ownerScope` (ADR 0032), nom du locataire seulement.
- Organisation `individual` : tout est permis sauf `trust`, `own_funds_advance` et `paid_by_owner` (403 `charges_agency_only` sur ces modes).
- Le client n'envoie jamais : montant de provision, part, solde, devise, numéro, statut, `mandant_party_id`, `not_before`.

### 8. Pièces justificatives et données personnelles

- Pièce obligatoire pour toute dépense à part récupérable et pour `trust`, `paid_by_owner`, `none` : `DocumentStore` (PDF, JPG, PNG, 10 Mo, contenu vérifié, nom régénéré, privé).
- **Mise à disposition** : l'équipe choisit, pièce par pièce, ce qui est visible du locataire (`charge_statement_files.tenant_visible`, défaut faux) ; visible de l'émission jusqu'à `visible_until` (six mois après l'émission au minimum, réglage de la juridiction ; une pièce visible a toujours une date limite, imposée en base, et n'est jamais servie sans elle) ; après, sur demande par message (ADR 0033). Un décompte ne reçoit que les pièces des dépenses dont un poste a une ligne dans ce décompte, sous un libellé neutre (rubrique et référence, jamais le tiers payé). Une pièce qui nomme une personne (salaire du gardien, relevé d'un autre lot) n'est jamais partagée telle quelle : l'interface le rappelle ; aucun contrôle automatique n'est possible.
- Instantané (ADR 0022) : émetteur (identité légale), locataires du bail (nom), lot et adresse, période, postes, clés, totaux de l'immeuble, provisions, solde, mode de règlement, mentions de la juridiction, version de modèle `DC-1`. L'anonymisation d'une partie ne touche aucune pièce émise.
- Journal (ADR 0016) : `Auditable` sur dépenses, clés, exercices, décomptes ; actions `charges.expense.recorded|cancelled`, `charges.exercise.computed|issued|discarded`, `charges.statement.issued|rectified|plan_recorded|downloaded`, `charges.file.shared|unshared`, `charges.prescription.acknowledged`. Ni montant, ni nom, ni libellé libre dans `metadata`.
- Conservation : décomptes et pièces comptables dix ans, à confirmer ; pas de purge en phase 1.

### 9. Grand livre, Reporting et Tax

- Accounting gagne `SourceType::Expense` et `ChargeStatement`, `ItemType::Expense`, et `LedgerAggregates::itemTotals(ItemType, from, to, unitIds)` (montant net par pièce). Aucune colonne nouvelle dans `journal_lines`.
- **Catégorie de dépense** : Reporting lit la catégorie dans `expenses` (fait SQL) et le montant par `itemTotals` : le bilan et l'analytique par catégorie du bailleur autonome (ADR 0030, lot 4) deviennent possibles sans exception à la règle « montants au grand livre ». Les dépenses `paid_by_owner` et `none` n'ont pas de montant au grand livre : Reporting et Tax les lisent par `Charges\PublicApi\DeclaredExpenses`, signalées « déclarées ».
- **Compte rendu de gestion** (ADR 0030) : deux natures de ligne nouvelles, `expense` (dépense payée pour le compte du mandant, débit `OwnerPayable`, source `expense`) et `charge_credit` (crédit de régularisation, source `charge_statement`) ; le complément facturé au locataire entre dans les charges appelées et encaissées existantes.
- **Prêts** : hors périmètre. Échéancier, capital restant dû et assurance emprunteur relèvent de l'ADR « Patrimoine et financement » (ADR 0030, § 15) avec Tax. Les intérêts payés peuvent s'enregistrer comme dépense de catégorie `expense.loan_interest` (non récupérable) pour que le bilan soit juste ; `/finances/prets` reste gaté.

### 10. Juridiction

Contrat `Charges\Jurisdictions\ChargeRules` (ADR 0008), implémentation `Fr` seule : rubriques récupérables (vocabulaire de plateforme `charge_rubric`, une valeur par rubrique du décret n° 87-713, jamais personnalisable) et catégories non récupérables (honoraires de gestion, assurance du propriétaire, intérêts d'emprunt, amélioration), délai avant exigibilité (un mois), seuil de tardiveté, durée minimale de mise à disposition des pièces (six mois), régimes de bail admis, mentions du décompte. Données datées, jamais de constantes. Autre juridiction : les dépenses restent permises (module neutre, comme Maintenance) ; exercices et décomptes : 422 `charges_jurisdiction_unsupported`, jamais de repli.

### 11. Verrous, idempotence, intégrité

- **Ordre** (complète l'ADR 0031 § 7 bis) : (0) `charge_property_locks` puis exercice puis décompte, ou dépense ; (1) `rent_schedules` du bail, pris par `RentAdjustments` ; (2) compte du mandant ; (3) factures ; (4) périodes. Plusieurs baux : par identifiant croissant. Aucune lecture non verrouillante avant le verrou.
- `Idempotency-Key` obligatoire sur création de dépense, émission, reprise, douzièmes, rectificatif ; même clé et même contenu : 200 rejoué ; contenu différent : 409 `charges_idempotency_key_reused`. Clés d'écriture : `charges:expense:{id}:post|cancel`, `charges:statement:{id}:credit` ; lignes Rent uniques par `(source_type, source_id, position)`.
- Déclencheurs MySQL (équivalents SQLite) : `expenses` (montants, pièce, lot, catégorie, mode figés ; seuls `status`, `cancel_reason`, `cancellation_entry_id`, `lock_version` évoluent ; suppression refusée) ; `charge_key_versions` et `charge_key_shares` en ajout seul ; `charge_items` et sources figés hors `draft` et `computed` ; `charge_statements` figés à l'émission (seuls `status` vers `superseded` et `lock_version`) ; `charge_statement_lines` en ajout seul ; `rent_adjustments` : seuls `status` et `installment_id`.
- `charges:verify` (quotidienne, signale sans corriger) : somme des parts plus part du propriétaire égale à chaque poste ; cumul des sources borné ; décompte émis avec son effet Rent (ligne ou crédit) ; dépense comptabilisée égale à son écriture.
- `charges:flag-due` (quotidienne) : bail à provisions sans décompte émis pour une période terminée depuis plus de `charges.due_after_months` (9 par défaut) ; émet `ChargeRegularizationDue` une fois par (bail, année).

### 12. Notifications et exports

- `tenant.charge_statement_issued` (audience `tenant`, in_app et e-mail, clé `charge_statement:{id}`, lien `https://` vers l'espace, jamais de montant ni de PDF dans l'e-mail ni le push) ; `staff.charges_regularization_due` (propriétaire, administrateur, gestionnaire, in_app). Un locataire sans compte reçoit le PDF de l'équipe hors plateforme (téléchargement journalisé).
- Exports CSV (UTF-8, `;`, préfixe anti-formule de l'ADR 0031) : dépenses d'une période, décomptes d'un exercice ; l'export `expenses-by-unit` de Reporting (ADR 0030) s'appuie sur la décision 9.

## Plan de lots

Backend d'abord, fronts ensuite ; chaque lot sort par `composer check` ou `pnpm -r check`, sans test ignoré ; `/security-review` pour les lots 1, 3 et 6.

| Lot | Contenu | Critères de sortie |
|---|---|---|
| 1. Dépenses, serveur | module `Charges`, `expenses`, modes de règlement, écritures, règles de fonds de tiers, pièces, ajouts Accounting (`SourceType`, `ItemType`, `itemTotals`), Catalog (`charge_rubric`), audit, déclencheurs | 401, 403 par rôle et par mode, 404 autre organisation ; nominal autonome et agence ; `trust` refusé si solde ou cantonnement insuffisant ; second validateur ; écritures équilibrées et contrepassées ; doublon 409 ; idempotence ; période close `roll_forward` ; triggers ; XOF sans décimale |
| 2. Clés et exercices, serveur | clés versionnées, exercices, postes, sources (dont `SupplierInvoiceDirectory` de Maintenance), `ChargeProvisions` de Rent, `ShareCalculator`, `ChargeRules` `Fr` | calcul vérifié sur jeu de référence fait à la main (tantièmes, surface, égal, consommation, entrée et sortie en cours d'année, colocation, forfait exclu, vacance) ; somme exacte au centime ; provisions égales au grand livre ; chevauchement 409 ; source épuisée 409 ; mutation qui rougit le test d'arrondi |
| 3. Émission, serveur | décomptes, séquence, instantané, PDF, `rent_adjustments`, échéance ponctuelle, crédit, remboursement d'avance (Rent), douzièmes, rectificatif, prescription, notifications, routes locataire, `charges:verify`, `charges:flag-due` | numérotation continue sous concurrence ; panne Gotenberg sans écriture et reprise ; ligne facturée au plus tôt un mois après ; crédit compensé à l'avis suivant ; compte mandant crédité ou débité, jamais de produit d'agence ; quittance distinguant les charges ; locataire : 404 hors bail, colocataire du même bail autorisé, pièces non partagées invisibles, aucune donnée d'un autre lot ; rejeu sans doublon de ligne ni de notification |
| 4. Fronts gestion | `packages/gestion` : dépenses (catégorie, bien et lot réels, modes, pièce), onglets `charges` et `copropriete`, écran de régularisation (aperçu serveur, postes, émission par bail, douzièmes) ; retrait de `deductible`, des montants saisis et de « facture émise » ; agence et bailleur autonome | `pnpm -r check` ; parcours navigateur sur l'API réelle (dépense, clé, exercice, émission, PDF) dans `apps/proprietaire` et `apps/agence` ; capacités dégatées |
| 5. Front locataire | `/loyers/regularisation` sur `/tenant/charge-statements` : montants `{amount, currency}` (fin des champs `*Cents`), statuts serveur, lignes, pièces partagées | `pnpm -r check` ; vérification navigateur avec un compte locataire réel |
| 6. Lectures transverses | Reporting (catégories, lignes du compte rendu, export), `/owner/charge-statements`, `DeclaredExpenses` pour Tax | tests de contrat de schéma Reporting ; 404 autre mandant ; nombre de requêtes constant |

## Options écartées

- **Dans Accounting** (ADR 0005 tel quel) : cycles Accounting ↔ Rent et Accounting ↔ Maintenance, perte du module feuille ; précédent de l'ADR 0031.
- **Dans Rent** : Rent porterait achats, clés et lecture de Maintenance ; deux cycles de vie (appel au locataire, dépense au fournisseur) dans un module déjà dense.
- **Dans Maintenance** (généraliser `supplier_invoices`) : l'ADR 0029 exclut contrats, taxes et copropriété ; Maintenance deviendrait un fourre-tout d'achats.
- **Clés dans Properties** : un seul consommateur, aucun calcul dans Properties (ADR 0020).
- **Solde facturé par Invoicing** (écran actuel) : la régularisation est un décompte, pas une facture (ADR 0028) ; la quittance doit distinguer les charges ; une créance hors échéance ne serait pas imputée par les encaissements de Rent.
- **Créance autonome écrite par Charges dans `TenantReceivable`** : Rent n'imputerait pas les encaissements dessus et Charges contournerait le verrou du bail.
- **Ligne négative sur l'échéance** : montants de Rent non signés, ventilation au prorata faussée ; l'avance existe déjà.
- **Remboursement systématique par virement** : sortie d'argent et double contrôle pour un montant que l'avis suivant compense.
- **Provisions versées (encaissées) comme base** : mêle impayé de loyer et régularisation ; l'impayé reste une créance distincte, affichée.
- **Arrondi au demi supérieur par bail** : la somme des parts peut dépasser le poste, au détriment des locataires.
- **Montants de provisions et de charges saisis par l'utilisateur** (écran actuel) : contraire à « le serveur recalcule ».
- **Colonne de catégorie dans `journal_lines`** : migration du grand livre pour une dimension que `item` porte déjà.
- **Prêts dans ce module** : cycle de vie (financement du patrimoine) et consommateur (Tax) distincts ; ADR « Patrimoine et financement ».
- **Gestion de copropriété (syndic)** : autre métier ; seul le relevé annuel du syndic est saisi.
- **Ouvrir la régularisation à toutes les juridictions** : un décompte sans base légale serait non conforme (ADR 0008).

## Conséquences

- **Front** : `RegularisationPage`, `DepenseFormPage`, `DepensesTab`, `ImmeubleCharges`, `ImmeubleCopro` et `ChargesScreen` passent sur l'API ; `regularisationSolde` et le calcul de répartition disparaissent du navigateur ; `expenseTypeSchema` (six valeurs) est remplacé par les catégories du Catalog ; `FINANCES_ROUTES.regularisation` ne mène plus à une facture.
- **Planification** : `charges:verify`, `charges:flag-due` (quotidiennes). **Configuration** : `CHARGES_THIRD_PARTY_SECOND_APPROVAL_MINOR`, réglage d'organisation `charges.due_after_months`, `CHARGES_GOTENBERG_TIMEOUT` (15 s au plus, comme l'ADR 0028).
- **Tests attendus** (en plus des critères de lot) :
  - accès : 401, 403 par rôle et par mode de règlement, 404 sur la dépense, la clé, l'exercice, le décompte, le bail ou le bien d'une autre organisation, jeton opérateur refusé, organisation `individual` refusée sur les modes d'agence ;
  - champs interdits (provision, solde, devise, statut, mandant) ignorés ou refusés ; recalcul serveur à chaque aperçu ;
  - écritures équilibrées par mode, contrepassation, aucune écriture de `journal_*` hors Accounting, aucun produit d'agence sur un lot sous mandat ;
  - dates figées, bornes semi-ouvertes, 29 février, bail entré ou sorti le premier et le dernier jour ;
  - instantané inchangé après modification ou anonymisation d'une partie ; déclencheurs (modification et suppression refusées en base) ;
  - architecture : liens de modules conformes à l'ADR 0005 amendé, pas de cycle, pas de `float`, `Idempotency-Key` présent ;
  - audit : une ligne par action, sans montant ni donnée personnelle ; nombre de requêtes constant pour un exercice de 1, 10 et 100 baux.
- **Risques** :
  - un poste mal classé en rubrique récupérable est facturé au locataire : la liste fermée réduit le risque, la décision reste humaine ;
  - une pièce partagée peut contenir des données d'un tiers : choix explicite par pièce, journalisé ;
  - les provisions appelées avant l'ADR 0031 sur un lot sous mandat ont crédité `ChargesRecovered` : un exercice qui chevauche l'activation des fonds des mandants est refusé avant le rattrapage `ownerfunds:backfill` (409 `charges_owner_funds_not_ready`).
- **Reste à faire** : imputation sur le dépôt de garantie et retenue de 20 % (ADR « Dépôt de garantie ») ; dépense à régler plus tard (`SupplierPayable`) ; logement social ; baux commerciaux et professionnels (TVA, art. L145-40-2 du Code de commerce) ; juridictions `Be`, `Lu`, `Ca/Qc` ; relevés de compteurs télérelevés ; contestation structurée du locataire.

## Points à valider par un juriste ou un expert-comptable

1. Texte en vigueur de l'art. 23 et du décret n° 87-713 (Légifrance) ; correspondance rubrique par rubrique ; cas particuliers : TEOM et frais de gestion de la taxe, gardien et employé d'immeuble (pourcentages), contrats d'entretien, eau chaude et chauffage collectif (art. 6-2, arrêté du 27 août 2012).
2. Base de comparaison : provisions appelées plutôt que versées.
3. Délai d'un mois : point de départ (mise à disposition dans l'espace, e-mail, envoi postal) et preuve de la communication.
4. Prescription de trois ans (art. 7-1) : point de départ pour le bailleur et pour le locataire.
5. Régularisation tardive : seuil exact, forme de la demande de douzièmes, accord amiable hors délai.
6. Pièces : durée et forme de la mise à disposition dématérialisée, occultation des données de tiers, durée de conservation (dix ans proposés).
7. Arrondi en faveur du locataire, vacance et forfait à la charge du propriétaire, prorata au jour.
8. Agence : régularisation créditée ou débitée au compte du mandant, compte mandant débiteur, base des honoraires `rent_and_charges` incluant le complément de régularisation, dépense payée sur fonds de tiers et avance sur fonds propres.
9. Bailleur autonome : comptabilisation systématique des dépenses, classement fiscal laissé à Tax.
10. Données personnelles : base légale de la mise à disposition des pièces aux colocataires d'un même bail ; minimisation de l'instantané. APDP (Bénin) non applicable au lancement (ADR 0008).

## Décisions à valider

Ma recommandation est toujours la première.

1. **Nouveau module `Charges` (dépenses, clés, régularisation) ; Accounting reste le grand livre.** Alternatives : Accounting (ADR 0005 tel quel, cycles avec Rent et Maintenance) ; Rent.
2. **Solde positif : ligne `charges_adjustment` sur la première échéance au moins un mois après l'émission ; échéance ponctuelle si le bail est terminé.** Alternatives : facture Invoicing (écran actuel) ; créance autonome au grand livre.
3. **Solde négatif : avance du bail compensée à l'avis suivant ; remboursement d'avance générique dans Rent pour un bail terminé ou sur demande.** Alternatives : remboursement systématique par virement ; ligne négative.
4. **Base : provisions appelées (échéances émises non annulées), l'impayé affiché à part.** Alternative : provisions encaissées.
5. **Arrondi à l'unité inférieure par bail et par poste, reste au propriétaire.** Alternative : demi supérieur avec écart réparti au plus fort reste.
6. **Dépenses : bailleur autonome toujours comptabilisé ; agence en `trust`, `own_funds_advance` ou `paid_by_owner` ; relevé du syndic sans écriture comme seule base récupérable de copropriété.** Alternatives : tout comptabiliser, y compris ce que le mandant paie lui-même ; ne rien comptabiliser côté agence.
7. **Clés de répartition versionnées dans Charges.** Alternative : tantièmes et clés dans Properties.
8. **Factures d'intervention lues par une PublicApi de Maintenance (levée de « aucun module n'appelle Maintenance »).** Alternative : ressaisie en dépense de la part récupérable.
9. **Pièces partagées au locataire pièce par pièce, six mois au moins, rien par défaut.** Alternatives : toutes les pièces du poste partagées d'office ; aucune pièce en ligne (sur demande seulement).
10. **Catégorie lue par `ItemType::Expense` et `LedgerAggregates::itemTotals`.** Alternative : colonne de catégorie dans `journal_lines`.
11. **Prêts hors périmètre (ADR « Patrimoine et financement ») ; intérêts saisissables comme dépense.** Alternative : prêts et échéancier dans ce module.
12. **Émission réservée à propriétaire, administrateur, gestionnaire ; le comptable prépare.** Alternative : comptable autorisé à émettre.
13. **Régularisation ouverte à la France seule, dépenses ouvertes partout.** Alternative : tout le module limité à la France.
14. **Douzièmes enregistrés par l'équipe sur demande du locataire, de droit quand le décompte est tardif.** Alternative : demande en ligne depuis l'espace locataire dès le lot 3.

## Amendements (appliqués le 2026-11-19)

- **ADR 0005** : ligne Accounting « grand livre (source de vérité des soldes), périodes » ; nouvelle ligne Gestion « Charges : dépenses du bailleur, clés de répartition, régularisation des charges locatives » ; liens de la décision 2 ; Reporting → Charges (`DeclaredExpenses`) et lecture SQL de `expenses` (faits) ; Maintenance appelée par Charges (`SupplierInvoiceDirectory`).
- **ADR 0007** : niveau (0) Charges dans l'ordre des verrous ; source `charge_statement`.
- **ADR 0018** : vocabulaire de plateforme `charge_rubric` ; métadonnée `recoverable_by_default` sur `expense_category`.
- **ADR 0020** : sens système `charges_adjustment`, réservé aux lignes d'échéance (jamais un terme de bail).
- **ADR 0024** : `/tenant/charge-statements` (lecture, PDF, pièces partagées).
- **ADR 0026** : `rent_adjustments` et `PublicApi/RentAdjustments` (`schedule`, `credit`) ; `PublicApi/ChargeProvisions` ; `installments.kind` (`periodic`, `adjustment`) et clé unique `(lease_id, kind, period_start)` ; remboursement d'avance `POST /rent/leases/{lease}/refunds` (rôles des sorties d'argent, `two-factor`) ; Rent ne modifie toujours aucune échéance déjà générée.
- **ADR 0027** : types `tenant.charge_statement_issued`, `staff.charges_regularization_due`, gabarits sans montant.
- **ADR 0028** : « remboursement d'un trop-perçu » retiré du reste à faire pour les avances de bail (Rent) ; la régularisation confirmée hors Invoicing.
- **ADR 0029** : `PublicApi/SupplierInvoiceDirectory` (lecture) ; « aucun module n'appelle Maintenance » levé pour Charges.
- **ADR 0030** : natures de ligne `expense` et `charge_credit` ; bilan et analytique par catégorie par `itemTotals` ; classement des écrans « Dépenses » et « Régularisation » vers Charges ; « Prêts » inchangé.
- **ADR 0031** : régularisation sur le compte du mandant (décision 6) ; dépense `trust` soumise au § 7 et au § 14 ; reste à faire « régularisation de charges » retiré.
- **ADR 0016** : actions de la décision 8.
- **ADR 0032** : `/owner/charge-statements` (lot 6), hébergé par Charges.

## Amendement de revue de sécurité (2026-11-19)

Cinq décisions modifiées par la revue indépendante du module (aucun point critique ou élevé) :

- **Rectificatif et plafond de source** : voir § 6. Une dépense de 1 200 répartie 600 / 600 sur deux exercices ne peut plus être portée à 1 200 par le rectificatif du premier.
- **Émission** : deux transactions par bail, rendu PDF hors verrou (§ 6). Numérotation toujours continue : le numéro est pris dans la première transaction et ne se rend jamais ; un exercice `issuing` ne s'abandonne pas (pas de `discard`) et se termine par les reprises de ses décomptes `failed`. Toute erreur imprévue d'un bail le laisse `failed` (`charges_issue_failed`, rapportée), jamais l'exercice bloqué. L'émission reste synchrone, un bail après l'autre ; une file par bail reste possible sans changer ce contrat.
- **Second validateur** : plus d'exception pour une équipe réduite à une personne habilitée au moment de la saisie (elle contournait la règle en suspendant un membre). Une organisation qui règle des dépenses sur fonds de tiers au-delà du seuil compte donc au moins deux membres habilités. Preuve 2FA récente exigée à la saisie et à la validation.
- **Pièces** : rattachement par poste du décompte, libellé neutre, `visible_until` obligatoire pour une pièce visible.
- **Requêtes** : au plus 500 sources au total par requête d'exercice (422 `validation_failed`).

## Amendement du 2026-11-21 (ADR 0039)

- § 9 « Prêts » : les prêts vivent dans Investments ; la dépense `expense.loan_interest` est réservée aux prêts non suivis (un bien avec prêt suivi et une telle dépense : conflit bloquant dans Tax, 409 `tax_interest_source_conflict`) ; Reporting la compte en financement, jamais en dépense, tant que le bien n'a pas de prêt suivi. `ExpenseFacts` et `DeclaredExpenses` exposent à Tax et à Reporting catégorie, bien, lot, part récupérable et règlement.
