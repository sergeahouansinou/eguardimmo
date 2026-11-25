# ADR 0029 — Maintenance : demandes, interventions, prestataires, devis et imputation des travaux

Statut : accepté (2026-11-18), validé par l'utilisateur tel que proposé. Complète l'ADR 0005 (module Maintenance : Maintenance, ServiceRequests, Suppliers de l'ancienne API), l'ADR 0003 (espaces), l'ADR 0006 (cloisonnement), l'ADR 0007 (écritures dans la même transaction), l'ADR 0008 (juridictions), l'ADR 0016 (journal), l'ADR 0017 (intégrité en base), l'ADR 0018 (référentiels), l'ADR 0019 (prestataire = partie), l'ADR 0021 (pièces à échéance), l'ADR 0022 (instantané), l'ADR 0024 (espace locataire, vague 4), l'ADR 0025 (plafond de travaux du mandat), l'ADR 0027 (notifications) et l'ADR 0028 (factures). Les règles de droit citées viennent de sources secondaires : **à confirmer** sur Légifrance et avec un expert-comptable avant l'implémentation (ADR 0011).
Amendement accepté (2026-11-18, ADR 0031) : règlement de prestataire sur lot sous mandat depuis `TrustBank` quand le solde du mandant, facture imputée, reste créditeur, sinon 409 `owner_funds_insufficient` ; l'avance sur fonds propres est une saisie explicite (`own_funds_advance`), depuis `Bank`, tracée à l'audit ; les espèces ne sortent pas de la banque de tiers (422) ; un compte mandant débiteur est signalé et exclut le reversement (`negative_balance`).
Amendement accepté (2026-11-19, ADR 0034) : `PublicApi/SupplierInvoiceDirectory` (lecture des parts de factures imputées au propriétaire) ; « aucun module n'appelle Maintenance » levé pour Charges.

Amendement accepté (2026-11-19, ADR 0031 § 14) : le règlement d'un prestataire et son annulation exigent la double authentification (403 `two_factor_required`) ; sur fonds de tiers : engagement obligatoire (409 `supplier_payment_engagement_required`), cantonnement couvert (409 `trust_funds_gap`), second validateur au-delà de `MAINTENANCE_THIRD_PARTY_SECOND_APPROVAL_MINOR` (403 `supplier_payment_second_approver_required`) ; l'empreinte d'idempotence inclut `own_funds_advance`.
Amendement accepté (2026-11-19, ADR 0032) : décision du mandant dans l'espace propriétaire (`decided_via = owner_space`, preuve `approval_evidences` en ajout seul, `lock_version` et empreinte du devis vus : 409 `approval_stale`, 2FA et preuve de moins de 10 minutes, refus en grâce par 403 `owner_access_read_only`, `co_owner` refusé par 403 `owner_role_forbidden`), événement `ApprovalRequested`, notification du mandant quand l'agence enregistre sa décision (`agency_recorded`), routes `/owner/interventions…` ; implémentation au lot 3 de l'ADR 0032. Le lot 1 fournit la garde d'écriture `MandateDirectory::assertOwnerWritable` et la variante `reauthenticated:two-factor`.
Amendement accepté (2026-11-19, ADR 0035) : Documents : catégorie `bank_statement` (CSV, texte et XML ; 10 Mo ; conservation configurable par `BANKING_RETENTION_YEARS`) et sujet `bank_statement`.

## Contexte

Les écrans existent avec des données de démonstration, sans API :
- **Locataire** (`apps/locataire`, `features/interventions`) : signaler un problème (type, pièce, titre, description, urgence, disponibilités, 6 photos), suivre une chronologie, voir le rendez-vous (date, créneau, entreprise, présence requise) et demander à le reprogrammer.
- **Agence** (`apps/agence`, `features/interventions`) : liste et fiche d'intervention (priorité, échéance, intervenant, plafond sans accord du mandat), devis à soumettre au mandant, statuts `ouverte`, `en_cours`, `devis_a_soumettre`, `devis_soumis`, `terminee`, `archivee`.
- **Mandant** (`apps/proprietaire`, espace « confié ») : devis à valider (accepter, refuser, demander une précision), seuil du mandat, imputation au reversement.
- **Bailleur autonome** (`packages/gestion`, `features/suivi/interventions`) : intervention, intervenant en texte libre, devis saisi et décidé par lui-même, dépense préremplie.

Ce qui manque en face : aucun module Maintenance, aucune table, et trois points que la démonstration ne tient pas : un devis soumis au mandant sans trace de sa décision, une imputation affichée (« charges du propriétaire, déduit du reversement ») sans écriture au grand livre, et un intervenant sans pièce ni assurance.

Déjà en place : `MandateCoverageData::worksLimitAmount` (plafond du mandat, ADR 0025), `Catalog` (`contact_category` avec le sens `craftsman`, `tax_rate`, `expense_category`), `DocumentStore` (stockage probant, `DocumentSubject`), `Ledger` et `LedgerReader` (ADR 0007), `ContinuousCounter`, `Checks::add`.

## Décision

### Périmètre
- **Un seul agrégat** : l'`intervention`. La demande du locataire en est le premier état (`reported`), pas une table à part ; la référence `INT-AAAA-NNNN` est celle que voit déjà le locataire.
- **Organisations** : agence (mandat, plafond, accord du mandant) et bailleur autonome (`individual` : il décide seul, `approval_basis = self_managed`, aucun mandat).
- **Prestataire sans compte** : pas de portail ni de lien à jeton en phase 1. L'équipe saisit devis et factures à partir des PDF reçus.
- **Hors périmètre** : contrats d'entretien et plans de maintenance préventive (rappels : ADR 0021), garanties constructeur, sinistres et assurances, travaux de copropriété et syndic, agenda, refacturation au locataire hors dépôt de garantie (voir « Imputation »), honoraires de suivi de travaux (Invoicing, à la demande).
- **Juridictions** : le module est neutre (devise de l'organisation, TVA déclarée par le prestataire). Seules les imputations au locataire et sur le dépôt passent par le contrat `Jurisdictions/MaintenanceChargeRules` (`Fr` d'abord, décret n° 87-712 et grille de vétusté à vérifier). Autre juridiction : 422 `maintenance_jurisdiction_unsupported` sur ces imputations seulement, jamais de repli (ADR 0008).

### Modèle (Maintenance, tables sans préfixe, `organization_id` partout, ADR 0017)
- **`interventions`**
  - `reference` (`INT-AAAA-NNNN`, unique par organisation), `origin` (`tenant | team`), `status`, `priority` (`urgent | normal | low`, posée par l'équipe), `reported_urgency` (`urgent | soon | normal`, déclarée par le locataire).
  - `nature_term_id` (clé étrangère vers `terms`, 2e exception de l'ADR 0018), `title`, `description` (≤ 1000), `room`, `availability` (≤ 200).
  - `property_id`, `unit_id` (nul = parties communes), `lease_id`, `mandate_id`, `mandant_party_id`, `reporter_party_id`, `supplier_party_id` : sans clé étrangère SQL, vérifiés par PublicApi.
  - `responsibility` (`owner | tenant | shared | undetermined`), `due_on`, `estimated_amount` + `currency`, `approval_basis` (`under_ceiling | owner_approved | emergency | self_managed`), `emergency_reason`.
  - `decline_reason` (code) et `decline_note` ; `completed_on`, `completion_note`, `closed_at`.
  - `follows_intervention_id` (réintervention après clôture), `custom_fields`, `idempotency_key` (unique par organisation), `lock_version`, `datetimes(6)`.
- **`intervention_events`** : chronologie en ajout seul. `kind`, `actor_kind` (`team | owner | tenant | system`), `actor_user_id`, `text` (≤ 500), `metadata`, `visible_to_owner`, `visible_to_tenant` (l'équipe voit tout). Les événements système sont rendus en français à la création par un gabarit (comme ADR 0027), jamais relus.
- **`intervention_files`** : `stored_file_id` (Documents, sans clé étrangère), `kind` (`photo_before | photo_after | quote | invoice | report | proof | other`), `uploaded_by_kind`, `visible_to_owner`, `visible_to_tenant`. CHECK : un fichier `quote`, `invoice` ou `proof` n'est jamais visible du locataire.
- **`intervention_visits`** : `supplier_party_id`, `scheduled_on`, `slot` (`morning | afternoon | evening`), `presence_required`, `status` (`proposed | confirmed | reschedule_requested | done | cancelled | no_show`), `requested_on` et `requested_slot` (proposition du locataire), `contact_name` et `contact_phone` (ce que l'équipe choisit de montrer au locataire), `lock_version`.
- **`supplier_profiles`** : `party_id` (unique par organisation), `status` (`active | suspended | archived`), `preferred`, `payment_terms_days`, `internal_note` (masquée à l'audit), `custom_fields`. **`supplier_trades`** : métiers par `terms` du vocabulaire `intervention_nature`.
- **`intervention_quotes`** : `supplier_party_id`, `reference`, `kind` (`initial | supplement`), `status` (`received | submitted | accepted | refused | expired | superseded`), `issued_on`, `valid_until`, `proposed_on` (passage proposé), `message`, `stored_file_id` (PDF obligatoire), `total_net`, `total_tax`, `total_gross`, `currency`, `lock_version`. **`intervention_quote_lines`** : `position`, `label`, `quantity_milli`, `unit`, `unit_price`, `net_amount`, `tax_rate_pcm`.
- **`intervention_approvals`** : `quote_id` (nul si accord sur estimation), `amount`, `ceiling_amount` (plafond du mandat figé à la demande), `status` (`pending | accepted | refused | question | expired | withdrawn`), `requested_at`, `decide_before`, `decided_at`, `decided_via` (`owner_space | agency_recorded`), `decider_party_id`, `decided_by_user_id`, `comment`, `proof_file_id` (obligatoire si `agency_recorded`). Colonne générée unique : une seule demande `pending` par intervention.
- **`supplier_invoices`** : facture reçue.
  - `intervention_id`, `supplier_party_id`, `billed_party_id` (le mandant, voir « Imputation »), `number` (celui du prestataire), `invoice_on`, `due_on`, `currency`, `total_net`, `total_tax`, `total_gross`.
  - `status` (`recorded | allocated | cancelled`), `stored_file_id` (PDF obligatoire), `fingerprint` (SHA-256 du fichier), `snapshot` (identité du prestataire telle qu'imprimée sur la facture, ADR 0022), `ledger_entry_id`, `exceeds_approved_amount`, `idempotency_key`, `lock_version`.
  - Unique `(organization_id, supplier_party_id, number)` et `(organization_id, fingerprint)` : un doublon est refusé (409 `supplier_invoice_duplicate`).
  - **`supplier_invoice_taxes`** : une ligne par catégorie EN 16931 (`S`, `Z`, `E`, `AE`, `O`) et taux (`tax_rate_pcm`) : base et montant, tels qu'imprimés.
- **`invoice_allocations`** : `supplier_invoice_id`, `target` (`owner | deposit | tenant`), `party_id`, `lease_id`, `share_amount` (part brute), `wear_basis_points`, `charged_amount`, `basis_note`, `ledger_entry_id`, `idempotency_key`, `cancelled_at`, `cancellation_entry_id`.
- **`supplier_payments`** : règlement manuel d'une facture reçue (modèle de `invoice_payments`, ADR 0028) : `amount`, `paid_on`, `method`, `reference`, `idempotency_key`, `ledger_entry_id`, `cancelled_at`, `cancellation_entry_id`.
- **`intervention_sequences`** : clé `(organization_id, year)`, `ContinuousCounter` sous verrou ; le numéro est pris à la création, le brouillon n'existant pas.
- **Intégrité** : `UNIQUE (organization_id, id)` sur chaque parent, clés composites sur les enfants. Statuts, natures et cibles par `Checks::add`, jamais `ENUM`. Montants `bigint` en unités mineures, taux en `pcm` (ADR 0017, amendement de l'ADR 0028).
- **Référentiels (Catalog)** : `intervention_nature` (extensible, plomberie, électricité, chauffage, serrurerie, humidité, nuisibles, autre ; chaque valeur porte un `semantic_key` et des métadonnées `tenant_chargeable`, `insurance_required`, `default_responsibility`, `expense_semantic`). Le locataire choisit parmi ces valeurs ; l'organisation peut en ajouter.

### Cycle de vie
États système (jamais personnalisables ; une étape d'affichage propre à l'organisation se rattache à un état système, ADR 0021) :

| De | Vers | Qui, condition |
|---|---|---|
| `reported` | `qualified` | équipe : nature, priorité, responsabilité, bien et mandat résolus |
| `reported`, `qualified` | `declined` | équipe : motif obligatoire, texte visible du locataire |
| `reported` | `cancelled` | le locataire qui a signalé, ou l'équipe |
| `qualified` | `quoting` | un prestataire est désigné et un devis attendu |
| `qualified`, `quoting` | `approved` | accord (voir ci-dessous) ; sans devis seulement si estimation ≤ plafond, urgence ou bailleur autonome |
| `quoting` | `awaiting_approval` | un devis dépassant le plafond est soumis au mandant |
| `awaiting_approval` | `approved` | accord du mandant |
| `awaiting_approval` | `quoting` | refus, expiration ou retrait : nouveau devis nécessaire |
| `approved` | `scheduled` | une visite confirmée |
| `scheduled` | `in_progress` | visite effectuée |
| `scheduled`, `in_progress` | `approved`, `scheduled` | visite annulée ou reportée |
| `in_progress` | `completed` | équipe : date de fin, compte rendu |
| `completed` | `in_progress` | réouverture tant qu'aucune facture n'est enregistrée |
| `completed` | `invoiced` | première facture reçue enregistrée |
| `completed`, `invoiced` | `closed` | toutes les factures non annulées sont `allocated` (ou aucune facture attendue : motif) |
| tout état non terminal | `cancelled` | équipe, avant `completed` ; ensuite par avoir ou annulation de facture |

`declined`, `cancelled`, `closed` sont terminaux : une reprise est une nouvelle intervention (`follows_intervention_id`). Chaque Action de transition verrouille d'abord la ligne `interventions` `FOR UPDATE`, puis la facture, puis les imputations (ordre fixe, ADR 0026) ; `lock_version` obligatoire sur les modifications (409 `intervention_stale_version`). Transition hors tableau : 409 `intervention_transition_invalid`.

Correspondance avec l'écran de l'agence : `ouverte` = `reported`, `qualified` ; `en_cours` = `approved`, `scheduled`, `in_progress` ; `devis_a_soumettre` = `quoting` avec devis reçu ; `devis_soumis` = `awaiting_approval` ; `terminee` = `completed`, `invoiced` ; `archivee` = `closed`.

### Plafond et accord du mandant
- Le plafond est `MandateDirectory::coveringUnit(s)->worksLimitAmount` à la date de la qualification, comparé au **TTC cumulé** des devis `accepted` de l'intervention (un devis `supplement` s'ajoute au premier). Lot sans mandat, ou mandat suspendu : 422 `intervention_no_mandate` ou `intervention_mandate_suspended`, sauf urgence. Parties communes : le mandat est choisi par l'équipe parmi ceux qui couvrent un lot du bien.
- Au-dessus du plafond, un accord `intervention_approvals` est obligatoire. Le plafond de la demande est figé : un avenant ultérieur ne la modifie pas.
- **Qui décide** : le mandant, depuis l'espace propriétaire (`accept`, `refuse`, `question`), dès que l'espace propriétaire sait rattacher un compte à un mandant (ADR à écrire, symétrique de l'ADR 0024 ; il amendera l'ADR 0003 : seule écriture de cet espace). **En attendant**, l'équipe enregistre la décision reçue (`agency_recorded`) avec la pièce écrite du mandant en preuve (422 `approval_proof_required`). Aucun lien public à jeton.
- **Le silence n'est pas un accord** : à `decide_before` (réglage `maintenance.approval_deadline_hours`, 48 h par défaut, 24 à 168), la demande passe `expired` ; la commande horaire `maintenance:expire-approvals` pose l'état et émet `ApprovalExpired` une seule fois. `question` laisse la demande ouverte et prévient l'équipe ; la réponse de l'équipe est un commentaire visible du mandant.
- **Urgence** : `engage` avec `approval_basis = emergency` (rôle équipe, motif obligatoire, priorité `urgent` posée au signalement : un PATCH ne peut pas la poser, 422) passe outre le plafond et le mandat suspendu, **dans la borne `maintenance.emergency_ceiling_minor`** (200 000 unités mineures par défaut, **à confirmer** ; une estimation au-delà est refusée, 422 `intervention_emergency_not_allowed`). La dérogation ne couvre que l'engagement initial, à hauteur de min(borne, estimation) ou de la borne sans estimation : tout avenant ou tout cumul au-delà repasse par la règle normale (accord du mandant). `maintenance:verify` ne dispense que ce montant. Tracé (`maintenance.emergency.override`), le mandant en est informé a posteriori (le courriel ne cite un montant que si une estimation existe). Tout changement de priorité est journalisé (`maintenance.intervention.priority_changed`).
- Décision rejouable : même décision → 200 (rejeu) ; décision contraire sur une demande déjà tranchée → 409 `approval_already_decided`. Une décision reçue après `decide_before` expire la demande dans la même transaction (devis expiré, intervention en `quoting`) et répond 409 `approval_already_decided`. Une pièce de preuve ne sert qu'à une seule demande (422 `intervention_file_invalid`).

### Prestataires
- Un prestataire est une **partie** (ADR 0019, catégorie de contact `craftsman` ou autre). Maintenance n'en recopie ni nom, ni coordonnées, ni IBAN, ni SIRET : tout est lu par `PartyDirectory`. `supplier_profiles` ne porte que la relation de travail (métiers, statut, conditions).
- Assurance : les pièces du prestataire (responsabilité civile, décennale) sont des pièces à échéance (ADR 0021) lues par `Documents\PublicApi\Certificates`. La désignation renvoie l'état (`valid | expiring | missing`) ; si la nature porte `insurance_required`, `missing` bloque (422 `supplier_insurance_missing`).
- Un prestataire `suspended` ou `archived` ne se désigne plus (422 `supplier_unavailable`) ; l'historique reste.

### Devis
- Saisis par l'équipe d'après le PDF du prestataire (fichier obligatoire). Lignes en HT avec un taux de `tax_rate` valide à la date (Catalog) ; le serveur calcule net, taxe et TTC en entiers (même arrondi que l'ADR 0028, taxe par taux sur la somme des bases). Le client peut joindre le TTC lu sur le PDF : un écart refuse la saisie (422 `quote_total_mismatch`).
- Modifiable seulement en `received`. Dès `submitted` ou `accepted`, il est figé (c'est ce que le mandant a vu). Un seul devis `accepted` de type `initial` par intervention ; l'acceptation d'un autre `initial` rend le précédent `superseded`.
- Accepter un devis : l'équipe si total cumulé ≤ plafond (ou bailleur autonome) ; sinon par l'accord du mandant.

### Planification et locataire
- Une visite est proposée par l'équipe (date, créneau, présence requise, contact montré). Le locataire la confirme ou **demande** un autre créneau (`reschedule_requested`) ; l'équipe confirme ou contre-propose. Le locataire ne déplace jamais seul un rendez-vous (le prestataire n'est pas joignable par l'application).
- **Clé de lecture locataire** (ADR 0024) : `LeaseDirectory::visibleToTenant()` ; un locataire d'un bail visible lit les interventions de **ce bail**, comme ses colocataires (granularité du bail, comme Rent). Intervention hors clé ou hors grâce : 404 `intervention_not_found`.
- **Création** : bail visible **et actif** (422 `intervention_lease_not_active` sinon) ; lot choisi parmi les lots du bail, ou parties communes du site du bail ; au plus 10 interventions ouvertes par bail (422 `intervention_too_many_open`) ; `Idempotency-Key` obligatoire.
- **Jamais dans l'espace locataire** : montants, devis, factures, accord et identité du mandant, note interne, motif interne, responsabilité, prestataire avant visite confirmée, `custom_fields`, identifiants de fiches. États exposés : `reported` (de `reported` à `approved`), `in_progress` (`scheduled`, `in_progress`), `done` (`completed`, `invoiced`, `closed`), `declined` (avec le motif), `cancelled`. Le texte des événements `visible_to_tenant` est générique.

### Pièces jointes et RGPD
- **Photos** : stockées par `DocumentStore` (catégorie `supporting`, JPG, PNG ou WebP, 10 Mo, 6 par signalement du locataire, 30 par intervention). Les métadonnées EXIF (position GPS) sont **supprimées à l'enregistrement** : ajout à Documents.
- **Visibilité** : la photo d'un locataire est visible de l'équipe, et des colocataires du bail (`visible_to_tenant`, **écart à confirmer**, décision 12) ; l'équipe la partage au mandant par `visible_to_owner` (journalisé). Elle ne va jamais au prestataire (aucun accès, aucune pièce envoyée par l'application).
- **Conservation** : photos et commentaires du locataire : clôture + 5 ans (prescription civile, à confirmer), puis purge par `maintenance:purge-media` (le fichier porte `retentionUntil`). Devis, factures et pièces comptables : 10 ans. Les données du locataire ne sont jamais copiées dans le texte d'un événement visible d'un tiers.
- **Texte libre** : la description peut contenir des données sensibles (santé, situation familiale). Elle est masquée dans l'audit (`auditMasked`), absente des notifications et des push, ne se renvoie qu'aux espaces autorisés.
- **Effacement** : l'anonymisation d'une partie (ADR 0019) ne touche ni les factures reçues (instantané du prestataire, obligation de conservation), ni les imputations. Pour un locataire, la ligne d'intervention reste, sans texte libre : titre, description, pièce, disponibilités et champs libres remplacés ou vidés, et le texte de ses commentaires remplacé par `[effacé]` (seule réécriture de la chronologie que le trigger autorise). **Écart à trancher (décision 13)** : ses photos ne sont pas purgées à l'anonymisation, car Documents interdit de supprimer ou de raccourcir un fichier avant son échéance ; elles suivent leur propre échéance (clôture + 5 ans). Un prestataire entrepreneur individuel est une personne physique : mêmes règles.

### Factures reçues et imputation
- **Facture adressée au mandant** (`billed_party_id`) : l'agence commande et paie au nom et pour le compte du mandant, sur ses fonds. Hypothèse à confirmer avec un expert-comptable ; elle fixe la TVA (non récupérable pour un bailleur non assujetti, aucune TVA déductible en phase 1).
- **Enregistrement** : PDF obligatoire, montants par taux tels qu'imprimés. Contrôles : base + taxe = TTC par taux, taux présent dans `tax_rate` à la date (tolérance d'arrondi `maintenance.invoice_tax_tolerance_minor`, 5 unités mineures par taux, à confirmer), même devise. Si la **somme** des TTC des factures non annulées de l'intervention (la facture enregistrée comprise) dépasse le montant engagé (devis acceptés ou estimation approuvée), la facture s'enregistre avec `exceeds_approved_amount` ; **ni imputation ni règlement** tant qu'un avenant (`supplement`) accepté ne la couvre (422 `supplier_invoice_exceeds_approval`). Rejouer une facture avec la même clé mais un contenu différent : 409 `maintenance_idempotency_key_reused`. Les devis sont bornés (`quote_lines_invalid` au-delà de 100 milliards d'unités mineures).
- **Imputation** (`invoice_allocations`) : la somme des parts actives vaut exactement le TTC, sinon la facture reste `recorded` ; à l'égalité elle passe `allocated`.
  - `owner` : charge du mandant, déduite de son prochain reversement.
  - `deposit` : retenue sur le dépôt de garantie du locataire. Bail `terminated`, justificatifs joints (devis ou facture), nature `tenant_chargeable`, montant ≤ solde du dépôt lu au grand livre (422 `allocation_deposit_unavailable`). La vétusté (`wear_basis_points`) réduit la part retenue ; le reste retombe sur le propriétaire par une imputation `owner` générée.
  - `tenant` : charge directe au locataire. **Différée** : la valeur du `CHECK` s'ajoute avec l'encaissement correspondant (voir « Décisions à valider »).
  - Imputer au locataire ou sur le dépôt exige `MaintenanceChargeRules` (nature à sa charge, vétusté) : 422 `allocation_not_chargeable` sinon.
- **Règlement** : saisie manuelle, modèle de l'ADR 0028 (clé d'idempotence, 422 `payment_exceeds_outstanding`, annulation par contrepassation). Montant ≤ reste dû lu au grand livre.

### Grand livre (Accounting, même transaction, ADR 0007)
Nouveautés : journal `purchases` ; comptes `SupplierPayable` (`2200`, « Fournisseurs », crédit) et `WorksPending` (`2300`, « Travaux à imputer », débit) ; `ItemType::SupplierInvoice` ; `SourceType` `supplier_invoice`, `supplier_allocation`, `supplier_payment`.

| Opération | Écriture | Clé d'idempotence |
|---|---|---|
| Facture reçue | débit `WorksPending` TTC (lot, mandant) · crédit `SupplierPayable` TTC (prestataire, item = facture) | `supplier_invoice:{id}:record` |
| Imputation `owner` (agence) | débit `OwnerPayable` (mandant, lot) · crédit `WorksPending` | `supplier_allocation:{id}:allocate` |
| Imputation `owner` (bailleur autonome) | débit `Expenses` · crédit `WorksPending` | idem |
| Imputation `deposit` | débit `SecurityDeposits` (bail, locataire) · crédit `WorksPending` ; vétusté : débit `OwnerPayable` | idem |
| Règlement | débit `SupplierPayable` (item = facture) · crédit `Bank` ou `Cash` | `supplier_payment:{id}:pay` |

- Une annulation contrepasse par `Ledger::reverse` (imputation et règlement) ; une facture ne s'annule que sans imputation ni règlement actifs.
- `WorksPending` à solde nul prouve que tout est imputé : la commande quotidienne `maintenance:verify` le contrôle (comme Accounting, ADR 0017) avec la somme des parts, l'existence d'un accord pour tout engagement au-dessus du plafond et la clôture sans facture non imputée. Elle journalise une anomalie, ne corrige rien.
- La nature fiscale (réparation, entretien, amélioration, reconstruction : déclaration 2044) n'est pas décidée ici : Maintenance transmet le `semantic_key` de la nature, Tax la classe.
- `LedgerReader` gagne `depositBalance(leaseId)` (solde du dépôt d'un bail).

### Événements, notifications, e-mails (ADR 0027)
Événements après commit, créés avec leur consommateur (règle de l'ADR 0025) : `ServiceRequestReported`, `InterventionQualified`, `InterventionDeclined`, `VisitScheduled`, `VisitRescheduleRequested`, `InterventionCompleted`, `ApprovalDecided`, `ApprovalExpired`. Aucun événement sur les factures et l'argent (écritures synchrones) ; `ApprovalExpired` est rattrapé par la commande horaire (clé : une expiration une fois).

Types ajoutés au catalogue de l'ADR 0027 (énumération, gabarit, sans migration) :

| Type | Source | Audience, rôles | Canaux par défaut | Non désactivable |
|---|---|---|---|---|
| `maintenance.request_received` demande reçue | `ServiceRequestReported` | staff : propriétaire, administrateur, gestionnaire | in_app, e-mail | – |
| `maintenance.approval_decided` accord du mandant | `ApprovalDecided` | staff, mêmes rôles | in_app, e-mail | in_app |
| `maintenance.approval_expired` accord expiré | `ApprovalExpired` | staff, mêmes rôles | in_app, e-mail | in_app |
| `maintenance.reschedule_requested` report demandé | `VisitRescheduleRequested` | staff, mêmes rôles | in_app | – |
| `tenant.request_qualified` demande prise en charge | `InterventionQualified` | tenant : locataires du bail | in_app, e-mail | – |
| `tenant.visit_scheduled` rendez-vous fixé ou modifié | `VisitScheduled` | tenant | in_app, e-mail, push | – |
| `tenant.request_declined` demande classée sans suite | `InterventionDeclined` | tenant | in_app, e-mail | in_app |
| `tenant.work_completed` intervention terminée | `InterventionCompleted` | tenant | in_app, e-mail | – |

Clés d'idempotence : `request:{intervention}`, `approval:{approval}:{état}`, `visit:{visit}:{lock_version}`, `qualified:{intervention}`, `declined:{intervention}`, `completed:{intervention}`. Le push reste générique (« Votre demande a avancé »), sans montant, adresse ni nom (ADR 0027).
- **Mandant sans compte** : e-mail d'information à la soumission (type d'intervention, montant TTC, échéance de réponse, aucune donnée du locataire, aucun lien de décision), par un `Mailable` minimal de Maintenance vers l'adresse principale de la partie, mis en file après commit (précédent : ADR 0028, ADR 0023). L'audience `owner` de Notifications viendra avec l'espace propriétaire.
- **Messaging** : aucun échange locataire ou prestataire ↔ agence (ADR 0024). La communication passe par les commentaires de la chronologie, à visibilité explicite, et par les notifications. L'écran « Écrire au locataire » de l'agence ouvre un commentaire visible du locataire, pas une conversation.

### Routes (`/api/v1`, `auth:sanctum` + `no-operator-token`, codes RFC 9457 dans `Enums/ErrorCode`)

**`/tenant`** (`space:tenant`, `verified`)

| Route | Débit |
|---|---|
| `GET interventions`, `GET interventions/options`, `GET interventions/{id}`, `GET interventions/{id}/files/{file}` | 60/min |
| `POST interventions` | 5/heure et 10/jour par compte |
| `POST interventions/{id}/files` | 20/heure |
| `POST interventions/{id}/comments` | 20/heure |
| `POST interventions/{id}/cancel`, `POST interventions/{id}/visits/{visit}/confirm`, `…/reschedule-request` | 20/min |

`GET interventions/options` : choix du formulaire de signalement, un élément par bail signé et non échu des baux visibles du locataire (`lease_id`, `label` = référence du bail, `units` = lots occupés à la date du jour `{id, label}`, `common_area_allowed`, `natures` = valeurs actives de `intervention_nature` de l'organisation du bail `{id, key, label}`). Aucun identifiant de mandant ou de mandat, aucune métadonnée de nature. Réponse `private, no-store`.

**`/owner`** (`space:owner`, livré avec l'ADR de l'espace propriétaire) : `GET interventions`, `GET interventions/{id}`, `GET interventions/{id}/files/{file}` (60/min, fichiers `visible_to_owner` seulement) ; `POST interventions/{id}/approvals/{approval}/decision` (10/min). Clé de lecture : les lots des mandats du mandant rattaché au compte. Autre mandant : 404.

**`/org/{organization}`**

| Action | Rôles | Débit |
|---|---|---|
| Lecture : interventions (statut, priorité, lot, bien, prestataire, retard, origine, recherche, curseur), fiche, chronologie, devis, factures, fichiers, prestataires | propriétaire, administrateur, gestionnaire, comptable | 120/min |
| Interventions : créer, modifier, qualifier, classer sans suite, annuler, désigner, engager, visites, devis (saisie, soumission, acceptation, refus), enregistrer la décision du mandant, terminer, clôturer, commentaires, fichiers, prestataires | propriétaire, administrateur, gestionnaire | 60/min |
| Engagement en urgence | propriétaire, administrateur, gestionnaire | 20/min |
| Facture reçue : enregistrer, annuler | propriétaire, administrateur, gestionnaire, comptable | 60/min |
| Imputation, règlement et leurs annulations | propriétaire, administrateur, comptable | 30/min |
| Envoi de fichiers | rôles d'écriture | 30/min par utilisateur |

Routes principales : `interventions` (`POST`, `GET`, `GET {id}`, `PATCH {id}`), `interventions/{id}/{qualify|decline|cancel|assign|engage|complete|close|reopen|comments|files}`, `…/visits` (`POST`, `PATCH {visit}`, `POST {visit}/{confirm|done|cancel|no-show}`), `…/quotes` (`POST`, `PATCH {quote}`, `POST {quote}/{submit|accept|refuse}`), `…/approvals/{approval}/{record-decision|withdraw}`, `…/invoices` (`POST`, `GET {invoice}`, `POST {invoice}/cancel`, `POST {invoice}/allocations`, `POST {invoice}/payments`), `allocations/{allocation}/cancel`, `supplier-payments/{payment}/cancel`, `suppliers` (`GET`, `POST`, `GET {id}`, `PATCH {id}`, `POST {id}/{suspend|activate|archive}`). Resources dédiées par espace (ADR 0003) ; chaque route porte un nom préfixé `maintenance.`.

### Intégrité en base (triggers MySQL, équivalents SQLite pour les tests)
- `interventions`, `BEFORE UPDATE` : `reference`, `organization_id`, `origin`, `reporter_party_id`, `reported_on`, `lease_id` figés ; refus de tout retour depuis `declined`, `cancelled` ou `closed`. `BEFORE DELETE` : refus.
- `intervention_events` : suppression refusée ; modification refusée, sauf le remplacement du seul `text` d'un commentaire du locataire par `[effacé]` (anonymisation).
- `intervention_quote_lines` : insertion, modification, suppression refusées si le devis n'est plus `received`. `intervention_quotes`, `BEFORE UPDATE` : montants et fichier figés hors `received`.
- `intervention_approvals` : une demande tranchée ne change plus ; suppression refusée.
- `supplier_invoices` : montants, numéro, prestataire, fichier, instantané figés ; seuls `status` et `lock_version` évoluent ; suppression refusée. `supplier_invoice_taxes` : figées. `invoice_allocations` et `supplier_payments` : seul le passage de `cancelled_at` et `cancellation_entry_id` de nul à renseigné est permis ; suppression refusée.

### Sécurité
- **IDOR** : `BelongsToOrganization`, `whereUuid`, Policies. Partie, lot, bail, mandat, fichier : vérifiés par PublicApi dans l'organisation courante (404 sinon). Pas d'identifiant de fiche d'autrui dans les Resources locataire et propriétaire.
- **Affectation de masse** : le client n'envoie jamais `status`, `reference`, `responsibility` (locataire), `approval_basis`, `organization_id`, `mandate_id` (locataire), montant imputé, devise, `ceiling_amount`, `decided_via`.
- **Fichiers** : type vérifié sur le contenu, nom régénéré, stockage privé, téléchargement `private, no-store` journalisé (`documents.file.downloaded`). Un fichier n'est lisible que par la clé de son espace et sa visibilité.
- **Abus** : plafonds de débit ci-dessus, au plus 10 interventions ouvertes par bail, au plus 30 fichiers par intervention, commentaires ≤ 500 caractères.
- **Journal** (ADR 0016) : modèles `Auditable` (`interventions`, `intervention_quotes`, `intervention_approvals`, `supplier_invoices`, `invoice_allocations`, `supplier_payments`, `supplier_profiles`) ; actions `maintenance.intervention.{qualified|declined|approved|scheduled|completed|closed|cancelled}`, `maintenance.emergency.override`, `maintenance.approval.{requested|decided|recorded_for_owner|expired}`, `maintenance.quote.{recorded|submitted|accepted|refused}`, `maintenance.file.shared`, `maintenance.invoice.{recorded|cancelled}`, `maintenance.allocation.{recorded|cancelled}`, `maintenance.payment.{recorded|cancelled}`. Aucune description libre, coordonnée ni IBAN dans `metadata`.

## Options écartées

- **Deux tables, `service_requests` puis `interventions`** (ancienne API) : une demande n'a pas de vie propre, le locataire et l'agence suivent la même référence et la même chronologie ; la fusion de deux demandes se traite par `declined` (motif `duplicate`).
- **Statut `devis_a_soumettre`, `devis_soumis` sur l'intervention seule** : l'état du travail et celui du devis évoluent séparément (plusieurs devis, avenants) ; la correspondance avec l'écran est une projection.
- **Accord du mandant par lien public à jeton** : surface publique supplémentaire (jeton transmis par e-mail, rejeu, transfert) pour un besoin que l'espace propriétaire couvrira.
- **Accord tacite à l'expiration** : engagerait le mandant sans son consentement.
- **Portail prestataire** : compte, invitation, 2FA, droits ; hors besoin tant que l'équipe saisit les pièces. À reprendre avec un ADR.
- **Table `suppliers` autonome** (ancien modèle) : ADR 0019.
- **Imputation sans écriture** (démonstration actuelle : « déduit du reversement » affiché) : un statut sans grand livre est une seconde source de vérité (ADR 0007).
- **Imputer directement sur `Expenses` ou `OwnerPayable` à la réception** : le prestataire peut être réglé avant l'imputation ; `WorksPending` rend le non-imputé visible.
- **Réutiliser Invoicing pour les factures reçues** : Invoicing émet (numérotation légale, TVA calculée) ; ici le document est celui du prestataire, saisi tel qu'imprimé.
- **Créer Payments pour régler les prestataires** : réservé aux PSP (ADR 0005).
- **Chat locataire ↔ agence dans Messaging** : nouveau produit (ADR 0024).
- **Seuil de travaux cumulé par lot sur 12 mois** : le mandat fixe un plafond par intervention ; le fractionnement se détecte par `maintenance:verify` (alerte) sans rouvrir l'ADR 0025.
- **Déplacement du rendez-vous par le locataire seul** (démonstration actuelle) : le prestataire n'est pas prévenu par l'application.
- **Bloquer tout le module hors France** (comme Invoicing) : seule l'imputation au locataire dépend du droit local.

## Conséquences

- **Amendement de l'ADR 0005 (à porter à l'acceptation)** : Maintenance → Parties (`PartyDirectory`), Properties (`UnitDirectory`), Leases (`LeaseDirectory`, `LeaseParticipants`), Mandates (`MandateDirectory`), Organizations (`MembershipDirectory`, `OrganizationDirectory`), Catalog (`TermDirectory`), Documents (`DocumentStore`, `Certificates`), Accounting (`Ledger`, `LedgerReader`) ; Maintenance ⇢ `ServiceRequestReported`, `InterventionQualified`, `InterventionDeclined`, `VisitScheduled`, `VisitRescheduleRequested`, `InterventionCompleted`, `ApprovalDecided`, `ApprovalExpired` ⇢ Notifications. Aucun module n'appelle Maintenance ; aucune PublicApi n'est créée sans consommateur (compte rendu de gestion, décompte de sortie, Reporting lit en SQL).
- **Amendement de l'ADR 0027** : huit types (ci-dessus), gabarits et clés d'idempotence.
- **Amendement de l'ADR 0003** (à l'acceptation de l'espace propriétaire) : la décision sur un devis est la seule écriture de l'espace propriétaire.
- **Ajouts hors Maintenance** : Accounting (journal `purchases`, `SupplierPayable`, `WorksPending`, `SupplierInvoice`, `LedgerReader::depositBalance`) ; Catalog (vocabulaire `intervention_nature`, seeder de plateforme) ; Documents (suppression des EXIF, `PublicApi/Certificates`, purge à `retentionUntil`) ; `Jurisdictions/MaintenanceChargeRules` avec `Fr`.
- **Planification** : `maintenance:expire-approvals` (horaire), `maintenance:verify` et `maintenance:purge-media` (quotidiennes).
- **Configuration** : réglages d'organisation `maintenance.approval_deadline_hours` et `maintenance.invoice_tax_tolerance_minor` ; `MAINTENANCE_MAX_OPEN_PER_LEASE` (10), `MAINTENANCE_FILES_PER_INTERVENTION` (30).
- **Livraison en quatre lots** : (1) interventions, demande du locataire, qualification, visites, fichiers, notifications ; (2) prestataires, devis, plafond, accord enregistré par l'agence ; (3) factures reçues, imputation au propriétaire, règlement, écritures ; (4) espace propriétaire, retenue sur dépôt, imputation directe au locataire si validée.
- **Front** :
  - agence : nouveaux états (`qualified`, `declined`, `cancelled`), plusieurs devis par intervention, accord enregistré avec pièce, factures reçues et imputation, groupe de notifications `quoteReceived` sans producteur (à retirer tant qu'aucun canal prestataire n'existe) ;
  - locataire : confirmation et demande de report à la place du report immédiat, clé d'idempotence, états `declined` et `cancelled` ;
  - propriétaire : décision par API, fichiers partagés seulement ;
  - bailleur autonome : prestataire choisi parmi des parties, devis et dépense par les écritures ci-dessus.
- **Tests attendus** :
  - accès : 401, 403 par rôle (comptable en lecture seule, imputation refusée au gestionnaire), 404 sur l'organisation, le bail, le lot, le mandat, le prestataire ou le fichier d'une autre organisation, locataire hors bail ou hors grâce, jeton opérateur refusé ;
  - cycle complet nominal, agence et bailleur autonome (signalement → qualification → devis → accord → visite → fin → facture → imputation → règlement → clôture) ;
  - transitions interdites, `lock_version`, concurrence de deux décisions sur une demande ;
  - plafond : cumul de devis et avenant, mandat suspendu, sans mandat, urgence tracée, expiration sans accord ;
  - devis : recalcul serveur, écart de TTC, figé après soumission ;
  - facture : doublon (numéro et empreinte), tolérance d'arrondi, dépassement du montant engagé, imputation partielle, imputation exacte, vétusté ;
  - écritures équilibrées à chaque opération, contrepassation, `WorksPending` à zéro, idempotence (rejeu 200, conflit 409) ;
  - triggers : refus de modification ou suppression sur les pièces figées ;
  - locataire : Resources sans montant ni identifiant, créneaux, plafond de signalements, photos (type, taille, EXIF supprimé, visibilité), nombre de requêtes constant ;
  - notifications : un cas par type produit par un événement réel, rejeu sans doublon, push générique ;
  - RGPD : anonymisation de la partie sans effet sur les factures reçues, purge des photos à l'échéance, audit sans texte libre.
- **Reste à faire** : espace propriétaire et rattachement compte ↔ mandant ; portail prestataire ; réception automatique des factures par la plateforme agréée (ADR 0011, ADR 0028) ; TVA déductible d'un bailleur assujetti ; retenue de garantie sur travaux ; contrats d'entretien et maintenance préventive ; classement fiscal des travaux (Tax) ; honoraires de suivi de travaux ; juridictions `Be`, `Lu`, `Ca/Qc` pour l'imputation au locataire ; équipements (`equipment_id` quand Properties les portera, écran « équipements » déjà présent).

## Décisions à valider

Ma recommandation est toujours la première.

1. **Modèle : un seul agrégat `interventions`, la demande du locataire en est l'état initial.** Alternative : deux tables (`service_requests` et `interventions`) comme dans l'ancienne API.
2. **Accord du mandant : espace propriétaire cible, et d'ici là décision enregistrée par l'agence avec la pièce écrite du mandant en preuve ; aucun lien public.** Alternatives : lien à jeton envoyé par e-mail (accord sans compte), ou accord seulement par l'espace propriétaire (module bloqué jusque-là).
3. **Plafond : TTC cumulé des devis acceptés par intervention, silence = expiration (jamais accord), urgence = dérogation tracée et notifiée a posteriori.** Alternatives : plafond cumulé par lot sur une période (anti-fractionnement bloquant), ou accord tacite après délai.
4. **Prestataire sans compte en phase 1 : l'équipe saisit devis et factures depuis les PDF.** Alternative : portail prestataire dès le lot 2.
5. **Prestataire = partie (ADR 0019) plus un profil `supplier_profiles` (métiers, statut, assurance lue dans les pièces à échéance) ; assurance bloquante seulement pour les natures qui l'exigent.** Alternatives : table fournisseurs autonome, ou assurance toujours bloquante.
6. **Argent : facture reçue au grand livre dès l'enregistrement (`WorksPending` / `SupplierPayable`), imputation par écriture distincte, règlement manuel, facture adressée au mandant (à confirmer avec un expert-comptable).** Alternatives : écriture à l'imputation seule, ou aucun suivi du règlement du prestataire en phase 1.
7. **Imputation au locataire : seulement par retenue sur le dépôt de garantie au départ (justificatifs, vétusté), la facturation directe étant différée tant que le droit local et l'encaissement ne sont pas arrêtés.** Alternative : créance directe sur le bail dès le lot 3 (`TenantReceivable`).
8. **Communication : commentaires à visibilité explicite dans la chronologie, aucune conversation locataire ou prestataire ↔ agence dans Messaging.** Alternative : étendre Messaging aux échanges avec le locataire (nouveau produit, ADR 0024).
9. **Photos : visibles de l'équipe seule par défaut, partage au mandant sur décision, EXIF supprimés, conservation clôture + 5 ans, pièces comptables 10 ans.** Alternatives : partage automatique au mandant, ou conservation identique pour tout (10 ans).
10. **Juridiction : module neutre, `Fr` seulement pour l'imputation au locataire et sur le dépôt (`MaintenanceChargeRules`) ; les autres pays gardent interventions, devis et imputation au propriétaire.** Alternative : ouvrir le module à la seule France, comme Invoicing.
11. **Plafond de l'urgence : 200 000 unités mineures par engagement (`MAINTENANCE_EMERGENCY_CEILING_MINOR`), à confirmer.** Alternatives : plafond par mandat, ou aucune borne (déconseillé : la dérogation couvrirait n'importe quel montant).
12. **Photos du locataire : visibles de ses colocataires (`visible_to_tenant`).** Alternative : visibles de leur seul auteur.
13. **Anonymisation du locataire : ses photos suivent leur échéance (clôture + 5 ans) faute de pouvoir être purgées avant (garde de Documents).** Alternatives : exception d'effacement dans Documents pour un fichier d'un locataire anonymisé, ou chiffrement du fichier puis destruction de la clé.

## Amendement du 2026-11-19 (ADR 0032, lot 3)

- Décision du mandant : `POST /owner/interventions/{id}/approvals/{approval}/decision` (`decided_via = owner_space`) ; preuve `approval_evidences` (ajout seul) ; `Idempotency-Key` obligatoire ; `lock_version`, `quote_fingerprint` et `statement_version` renvoyés par le client, `approval_stale` (409) en cas d'écart ; `MAINTENANCE_OWNER_DECISION_STATEMENT_VERSION`.
- Événements : `ApprovalRequested` (nouveau), `ApprovalDecided` (+ `decidedVia`, `mandantPartyId`), `ApprovalExpired` (+ `mandantPartyId`) ; Maintenance → Identity (`TwoFactorProofs`).

## Amendement du 2026-11-20 (ADR 0040)

- Liste transversale des devis : `GET /org/{organization}/quotes` (Maintenance, `Queries/Quotes`, pagination par curseur, filtres statuts, intervention et fournisseur), en lecture seule ; index `2026_11_20_100000_add_quote_listing_indexes`.

## Amendement du 2026-11-21 (clé d'idempotence des commentaires)

- `POST /org/{organization}/interventions/{intervention}/comments` accepte un en-tête `Idempotency-Key` facultatif (8 à 64 caractères `A-Za-z0-9._:-`, sinon 422 `idempotency_key_required`). La clé est stockée avec l'événement (`intervention_events.idempotency_key`, unique par organisation et auteur, migration `2026_11_21_100000_add_idempotency_key_to_intervention_events`, qui étend aussi le trigger d'ajout seul à cette colonne). Même clé, même auteur, même intervention et même contenu (texte et visibilités) : 200 avec l'événement déjà écrit, sans second événement ; contenu ou intervention différent : 409 `maintenance_idempotency_key_reused`. Course entre deux requêtes : l'index unique tranche, la violation est relue. Le commentaire du locataire (`/tenant/interventions/{id}/comments`) et les clients sans en-tête ne changent pas.
