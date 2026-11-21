# ADR 0028 — Factures et avoirs (module Invoicing)

Statut : accepté (2026-11-18), validé par l'utilisateur tel que proposé. Complète l'ADR 0005 (module Invoicing), l'ADR 0007 (écritures dans la même transaction), l'ADR 0008 (juridictions), l'ADR 0011 (facture électronique), l'ADR 0017 (intégrité en base), l'ADR 0018 (référentiels), l'ADR 0019 (destinataire = partie), l'ADR 0022 (instantané), l'ADR 0023 (créance `invoice`), l'ADR 0025 (honoraires du mandat) et l'ADR 0026 (modèle d'émission de Rent). Les obligations citées viennent de sources secondaires : **à confirmer** sur Légifrance et impots.gouv.fr, et avec un expert-comptable, avant l'implémentation (ADR 0011).
Amendement accepté (2026-11-18, ADR 0031) : honoraires de gestion générés par le serveur (`invoices.fee_statement_id` ; ligne `fee.management` refusée à la saisie, 422 `invoice_fee_computed_by_server`, une fois les fonds des mandants actifs), méthode de règlement `owner_account` (débit de `OwnerPayable`, non annulable par la route publique), avoir recréditant le compte du mandant à hauteur de la compensation déjà opérée.
Amendement accepté (2026-11-19, ADR 0034) : le « remboursement d'un trop-perçu » est retiré du reste à faire pour les avances de bail (remboursement d'avance de Rent) ; la régularisation des charges est confirmée hors Invoicing (décompte de Charges, pas une facture).
Amendement accepté (2026-11-19, ADR 0035) : `PublicApi/InvoiceSettlements::recordBankTransfer` ; la « saisie manuelle seule » est complétée par l'encaissement depuis une ligne de relevé (Banking), plafonné au reste dû, avec report sur le premier jour ouvert.

## Contexte

Une agence facture ses honoraires de gestion aux mandants, ses honoraires de location et des prestations ponctuelles. L'écran « Factures » de démonstration émet une facture avec un seul taux de TVA libre, un montant HT saisi, une date d'émission choisie, un « marquer payée » sans montant et un avoir total. Ces quatre points ne tiennent pas face au droit (numérotation chronologique, TVA par catégorie, paiement partiel, grand livre source de vérité).

Ce qui existe déjà : Accounting connaît `Journal::Fees`, `SourceType::Invoice` et `CreditNote`, `ItemType::Invoice`, `AccountRole::FeeRevenue`, `CollectionFees` et `VatCollected`. Documents connaît `IssuedDocumentType::Invoice` et `CreditNote`. Recovery prévoit une créance `invoice` (ADR 0023). Organizations n'expose ni adresse, ni SIREN, ni numéro de TVA : ce sont des mentions obligatoires d'une facture.

## Décision

### Périmètre de la phase 1
- **Émetteur** : une organisation `agency`. Une organisation `individual` est refusée (403 `invoicing_agency_only`), comme pour Mandates.
- **Destinataire** : une partie vivante de l'organisation (ADR 0019), qu'elle soit mandant, locataire ou tiers. Le destinataire n'est jamais une saisie libre.
- **Cas couverts** : honoraires de gestion (avec le mandat en référence), honoraires de location, prestations et frais refacturés au mandant (frais d'acte de recouvrement compris), facture libre.
- **Hors périmètre** :
  - régularisation de charges : c'est un décompte (ADR 0022), il reste dans Accounting ;
  - frais de relance ou de procédure refacturés à un locataire d'habitation : interdits en France (loi n° 89-462, art. 4 p). La règle `Fr` les refuse (422 `invoice_item_forbidden_for_tenant`) ;
  - débours ;
  - remboursement d'un trop-perçu ;
  - abonnement SaaS d'eGuardImmo (Subscriptions, ADR 0013).
- **Juridictions** : France d'abord, comme Rent. Une autre juridiction reçoit 422 `invoice_jurisdiction_unsupported`. Le modèle accepte plusieurs taxes par facture pour que la Belgique, le Luxembourg et le Québec (TPS + TVQ) n'exigent pas de migration.

### Modèle (Invoicing)
- **`invoices`** : une seule table pour la facture et l'avoir.
  - `kind` (`invoice | credit_note`) ; `credited_invoice_id` (clé composite `(organization_id, id)`, obligatoire pour un avoir) ; `status` (`draft | issued | partially_paid | paid | cancelled | discarded`).
  - `number` (nul en brouillon, unique par organisation), `issued_on`, `due_on`, période de prestation (`service_from`, `service_to`).
  - `recipient_party_id`, `lease_id` et `mandate_id` facultatifs, sans clé étrangère SQL ; `jurisdiction`, `vat_regime`, `currency`.
  - `total_net`, `total_tax`, `total_gross` : `bigint` en unités mineures, montants positifs pour un avoir comme pour une facture (EN 16931, type 381).
  - `ledger_entry_id`, `issued_document_id`, `stored_file_id`, `fingerprint`, `template_version`, `snapshot` (JSON, ADR 0022), `credit_reason`.
  - `idempotency_key` unique par organisation, `lock_version`, `overdue_flagged_at`, `sent_at`, `discarded_at`, `issued_by_user_id`, `datetimes(6)`.
- **`invoice_lines`** :
  - `position` ;
  - nature par le référentiel Catalog `invoice_item`, non extensible en sens. Sens système : `fee.management`, `fee.letting`, `fee.other`, `service`, `recovery_cost`. Chaque sens fixe le compte de produit ;
  - `description` ;
  - `quantity_milli` (1000 = 1) ;
  - `unit_price` et `net_amount` en unités mineures ;
  - `tax_category` (code EN 16931 : `S`, `Z`, `E`, `AE`, `O`) et `tax_rate_pcm` ;
  - `credited_line_id` pour un avoir.
- **`invoice_taxes`** : une ligne par taxe, catégorie et taux (`tax_code` = `vat`, `gst` ou `qst` ; base ; montant). Les totaux de taxe se lisent ici, jamais en additionnant les lignes.
- **`invoice_payments`** : règlement manuel d'une facture (virement, chèque, espèces, prélèvement).
  - `amount` et `currency` fixés par le serveur, `paid_on`, `reference` ;
  - `idempotency_key` unique et `fingerprint` ;
  - `ledger_entry_id`, `cancelled_at`, `cancellation_entry_id`.
  - Un règlement porte sur une seule facture. Aucun règlement ne se supprime.
- **`invoice_sequences`** :
  - clé primaire `(organization_id, kind, year)`, `ContinuousCounter` sous verrou ;
  - formats `FA-AAAA-NNNN` (facture) et `AF-AAAA-NNNN` (avoir) ;
  - le numéro est pris dans la transaction d'émission, jamais au brouillon : un brouillon abandonné ne laisse aucun trou.
- **Taux en cent-millièmes (`pcm`, 100 000 = 100 %)** : amende l'ADR 0017 pour les taux de taxe. La TVQ (9,975 %) ne s'écrit pas en points de base. Les quotes-parts restent en points de base.
- **Intégrité** : `UNIQUE (organization_id, id)` sur le parent, clés composites sur les enfants (ADR 0017). Statuts, catégories et natures sont posés par `Checks::add`, jamais par le type `ENUM`.

### Cycle de vie
- **Brouillon**
  - Créé, modifié (`lock_version`, 409 `invoice_stale_version`) puis abandonné (`discarded_at`, statut `discarded`). Jamais supprimé.
  - Le client envoie le destinataire, le bail ou le mandat, l'échéance, la période de prestation et des lignes (nature, libellé, quantité, prix unitaire HT, catégorie de taxe).
  - Le client n'envoie jamais de taux, de total, de devise, de numéro, de statut ni de date d'émission.
- **Émission** : `POST …/issue`, une seule transaction. Dans l'ordre :
  1. la ligne `invoices` est verrouillée `FOR UPDATE` ;
  2. les contrôles sont faits (identité légale de l'émetteur, coordonnées du destinataire, juridiction, obligation de facture électronique) ;
  3. le serveur recalcule les taux et les totaux ;
  4. il prend le numéro ;
  5. il construit l'instantané, produit le PDF (Gotenberg) et l'enregistre dans Documents ;
  6. il passe l'écriture au grand livre ;
  7. il pose le statut `issued` et journalise.
  - **Le rendu PDF reste sous le verrou du compteur de numéros** : le numéro figure sur le PDF et une panne doit libérer ce numéro, donc le rendu ne peut précéder la prise du numéro ni sortir de la transaction. Le risque (un Gotenberg lent bloque les émissions suivantes de la même organisation, du même type et de la même année) est borné par un délai de rendu plafonné à 15 s par le code (`INVOICING_GOTENBERG_TIMEOUT` ne peut pas le dépasser).
  - `issued_on` vaut la date du jour du serveur : la numérotation reste chronologique.
  - `due_on` est soit choisi (≥ `issued_on`), soit calculé à partir du réglage d'organisation `invoicing.payment_terms_days` (30 jours par défaut, plafond légal à vérifier).
  - Rejouable : une facture déjà émise est renvoyée telle quelle.
- **Émise** : immuable. Seul le statut de règlement évolue : `issued`, puis `partially_paid` ou `paid`, ou `cancelled` quand l'avoir couvre tout le total. Le statut est recalculé dans la transaction de chaque règlement ou avoir, à partir du reste dû lu au grand livre (`LedgerReader::outstanding(ItemType::Invoice, …)`). Le retard n'est pas un statut : il se déduit de `due_on < aujourd'hui` et d'un reste dû positif.
- **Annulation** : uniquement par avoir. Jamais de suppression, jamais de réouverture en brouillon.

### Avoir
- `POST …/invoices/{id}/credit-notes`, avec un motif obligatoire, et soit `full`, soit des quantités par ligne d'origine.
- La facture d'origine est verrouillée d'abord. Le cumul des avoirs ne dépasse ni le total de chaque ligne, ni le reste dû de la facture (422 `invoice_credit_exceeds_outstanding`) : sans remboursement en phase 1, aucun avoir ne crée de crédit client.
- Même chaîne que l'émission : numéro `AF`, instantané qui cite le numéro et la date de la facture d'origine, PDF, écriture.

### TVA et arrondis
- Contrat `Jurisdictions/InvoiceTaxRules` avec l'implémentation `Fr` (ADR 0008). Il donne :
  - le taux d'une catégorie à une date, lu dans les données datées du Catalog (vocabulaire de plateforme `tax_rate`, métadonnées `country`, `tax_code`, `category`, `rate_pcm`, `effective_from`, `effective_to`, jamais personnalisable) ;
  - les mentions obligatoires ;
  - l'exigibilité.
- Régime de l'organisation (`settings`, ADR 0018) :
  - `normal` ;
  - `franchise` : catégorie `O` imposée, mention « TVA non applicable, art. 293 B du CGI » ;
  - option pour les débits.
- Calcul en entiers (`moneyphp`) :
  - ligne : `net_amount = quantity_milli × unit_price / 1000`, arrondi au demi supérieur ;
  - taxe : une seule fois par couple (taxe, taux), sur la somme des bases, arrondie au demi supérieur (règle EN 16931) ;
  - jamais de `float`, jamais de pourcentage saisi par le client.
- Devise : celle de l'organisation (EUR ou CAD, ADR 0008). Le calcul reste correct pour une devise sans décimales, mais aucune juridiction en XOF n'est ouverte : e-MECeF reste retiré (ADR 0008, ADR 0011).

### Grand livre (Accounting, journal `fees`, même transaction, ADR 0007)
- **Émission** (source `invoice`, clé `invoice:{id}:issue`) :
  - au débit : la créance pour le TTC, `ItemType::Invoice`, partie destinataire, bail s'il y en a un ;
  - au crédit : le produit par nature de ligne (`FeeRevenue`, `CollectionFees`), puis la TVA.
- **Compte de créance** : `TenantReceivable` si la facture porte sur un bail et vise une partie à ce bail ; la facture apparaît alors au solde du bail et dans Recovery. Sinon, le nouveau compte `CustomerReceivable` (`2100`, « Clients »).
- **TVA des prestations de services en France** : exigible à l'encaissement, sauf option pour les débits.
  - À l'émission, elle est créditée sur le nouveau compte `VatDeferred` (`3210`, « TVA collectée à exigibilité différée »).
  - À chaque règlement, elle passe vers `VatCollected` au prorata ; le dernier règlement solde l'arrondi.
  - Avec l'option pour les débits, elle va directement sur `VatCollected`.
- **Avoir** (source `credit_note`) : écriture miroir. La créance est créditée avec l'`item_id` de la **facture d'origine**, ce qui fait baisser son reste dû.
- **Règlement** (source `payment`) : banque ou caisse au débit, créance au crédit (item = facture). Montant ≤ reste dû (422 `invoice_payment_exceeds_outstanding`). L'annulation contrepasse l'écriture (`Ledger::reverse`) et recalcule le statut. Rejouable.

### Règlements
- Saisie manuelle dans Invoicing, sur le modèle de `rent_payments`. Clé d'idempotence obligatoire : même clé et même contenu → 200 rejoué ; contenu différent → 409 `invoice_idempotency_key_reused`.
- Ni module Payments (réservé aux PSP par l'ADR 0005), ni réutilisation des encaissements de Rent (attachés au bail et à son échéancier). L'encaissement par PSP viendra plus tard par `PaiementConfirmé ⇢ Invoicing`, avec un amendement de l'ADR 0005.

### PDF et instantané
- **Instantané** (ADR 0022) :
  - émetteur : raison sociale, adresse du siège, SIREN ou SIRET, numéro de TVA, forme et capital, carte professionnelle et garantie financière (loi Hoguet) ;
  - destinataire : nom, adresse, SIREN et numéro de TVA s'il est assujetti ;
  - références : bail, mandat, facture d'origine ;
  - contenu : lignes, taxes, totaux, échéance, conditions de règlement, mentions de la juridiction, version du modèle.
  - Aucune fiche n'est relue après l'émission.
- **Mentions `Fr`**, à vérifier : CGI annexe II art. 242 nonies A ; Code de commerce L441-9 (pénalités de retard, indemnité forfaitaire de 40 € entre professionnels, escompte) ; nouvelles mentions de la réforme (SIREN de l'acheteur, nature de l'opération, option pour les débits).
- **Prérequis** : un émetteur sans identité légale complète reçoit 422 `invoice_issuer_incomplete`. Destinataire professionnel sans SIREN ni adresse : 422 `invoice_recipient_incomplete`.
- **PDF** : Gotenberg (HTML Blade de l'instantané). Panne : 503 `invoice_pdf_unavailable` avec `Retry-After`, et rien n'est écrit. Configuration : `INVOICING_GOTENBERG_URL`, avec repli sur `RENT_GOTENBERG_URL` comme pour Recovery. Le rendu, déjà dupliqué dans Rent et Recovery, passe dans `app/Shared/Pdf` (technique, sans métier) avec ce lot.
- **Téléchargement** : réponse privée (`setPrivate`, `Cache-Control: private, no-store`), journalisée.

### Facture électronique (documenter, ne pas implémenter)
- **Phase 1** : PDF seul, avec des données structurées compatibles EN 16931 (catégories, codes, identifiants) pour qu'une plateforme agréée puisse les reprendre sans migration.
- **Pas de Factur-X maison** et pas de rôle de plateforme agréée (ADR 0011). Le format (Factur-X, UBL ou CII) et la transmission seront assurés par la plateforme agréée retenue, dans un lot dédié, avec un ADR de choix du prestataire.
- **Garde dans `InvoiceTaxRules::requiresEInvoicing(destinataire, date)`** : quand la loi impose la facture électronique entre professionnels (France : PME et TPE au 1/09/2027, grandes entreprises et ETI depuis le 1/09/2026 ; Belgique : Peppol depuis le 1/01/2026), l'émission en PDF seul vers un destinataire assujetti est refusée (422 `invoice_einvoicing_required`). Les dates sont des données, pas des constantes, et sont à confirmer.
- **E-reporting** des honoraires facturés à des particuliers : avec la même plateforme, dans le même lot.
- **e-MECeF** : hors périmètre, retiré par l'ADR 0008.

### Retard et événements
- La commande `invoices:flag-overdue`, quotidienne, pose `overdue_flagged_at` une seule fois par facture et émet `InvoiceOverdue` (après validation de la transaction). Elle n'a pas encore de consommateur : elle est prévue pour Notifications (relance), comme `InstallmentOverdue`.
- `InvoiceIssued` et `CreditNoteIssued` sont créés avec leur premier consommateur (transmission à la plateforme agréée), pas avant (même règle que l'ADR 0025).
- **Envoi par e-mail** (`POST …/send`) : PDF en pièce jointe, adressé au contact principal du destinataire. `sent_at` et le journal sont écrits dans la transaction ; l'e-mail est mis en file seulement après son commit (`DB::afterCommit`), le PDF étant relu dans Documents à l'envoi, pas copié dans la file. `sent_at` signifie donc « mis en file » ; un échec d'acheminement se lit dans les tâches échouées (3 essais). Texte brut sans entités HTML. Tant que Notifications n'est pas branché, un Mailable minimal reste dans Invoicing (précédent de l'ADR 0023).

### Recouvrement
- `PublicApi/InvoiceLedger` expose :
  - `unpaidByLease` : factures émises, échues et non soldées d'un bail et d'un débiteur, avec le reste dû lu au grand livre ;
  - `find` : numéro, échéance, pièce Documents.
- Recovery les inclut comme créances `invoice`. Seule une facture rattachée à un bail entre dans un dossier.

### Verrous
- Chaque Action qui décide d'un statut ou d'un montant (émettre, régler, annuler un règlement, émettre un avoir) verrouille d'abord la ligne `invoices` concernée `FOR UPDATE` : la facture d'origine pour un avoir. Aucune lecture non verrouillante ne précède ce verrou (même règle que l'ADR 0026).

### Immutabilité en base (triggers MySQL, équivalents SQLite pour les tests)
- **`invoices`, `BEFORE UPDATE`** : refus si `OLD.number IS NOT NULL` et qu'une colonne figée change (comparaison `<=>`). Seuls `status`, `overdue_flagged_at`, `sent_at`, `lock_version` et `updated_at` restent modifiables. Refus de tout retour à `draft`.
- **`invoices`, `BEFORE DELETE`** : refus dans tous les cas.
- **`invoice_lines` et `invoice_taxes`** (`BEFORE INSERT`, `UPDATE`, `DELETE`) : refus si la facture parente n'est pas en brouillon.
- **`invoice_payments`** : suppression refusée ; en modification, seul le passage de `cancelled_at` et `cancellation_entry_id` de nul à renseigné est permis.

### Rôles et API (`/org/{organization}/invoices…`, codes RFC 9457 dans `Enums/ErrorCode`)

| Action | Rôles autorisés | Débit |
|---|---|---|
| Lecture : liste (nature, statut, année, recherche, en retard, curseur), détail, PDF | propriétaire, administrateur, gestionnaire, comptable | 120/min |
| Brouillon, émission, règlement, annulation d'un règlement, envoi par e-mail | les mêmes quatre rôles | 60/min |
| Avoir | propriétaire, administrateur, comptable | 60/min |

- Envoi par e-mail : en plus, 10/min par utilisateur, 3/heure par facture et 60/heure par organisation (`INVOICING_SEND_PER_INVOICE_PER_HOUR`, `INVOICING_SEND_PER_ORGANIZATION_PER_HOUR`).
- Routes : `POST invoices`, `PATCH invoices/{invoice}`, `POST invoices/{invoice}/discard`, `POST invoices/{invoice}/issue`, `POST invoices/{invoice}/credit-notes`, `POST invoices/{invoice}/payments`, `POST invoice-payments/{payment}/cancel`, `POST invoices/{invoice}/send`, `GET invoices/{invoice}/pdf`.
- Aucune API dans les espaces locataire ou propriétaire en phase 1 : elle passera plus tard par `Queries/`.
- Pas de quota de plan (ADR 0013 inchangé).

### Sécurité
- **IDOR** : `BelongsToOrganization`, `whereUuid`, Policy. Partie, bail et mandat sont vérifiés par leur PublicApi dans l'organisation courante : 404 sinon.
- **Données reçues** : aucune affectation de masse ; le serveur recalcule tout montant.
- **Taux de TVA** : le client ne choisit qu'une catégorie et une clé de taux, validées par une liste blanche de la juridiction selon le régime, la nature de ligne et le destinataire (422 `invoice_tax_rate_not_allowed`). Fr : honoraires et frais au taux normal seul ; taux intermédiaire, réduit et exonération réservés à la nature `service` ; taux super réduit et taux zéro jamais ; « hors champ » seulement en franchise ; autoliquidation (`AE`) seulement vers une société portant un numéro de TVA.
- **Règlement** : `paid_on` n'est ni futur ni antérieur à l'émission (422 `invoice_payment_invalid`), vérifié sous verrou.
- **Avoir** : le cumul des nets crédités d'une ligne ne dépasse jamais son net d'origine (le dernier avoir solde exactement le reste).
- **Journal** : `invoicing.invoice.issued`, `.discarded`, `.credited`, `.sent`, `.downloaded`, `invoicing.payment.recorded`, `.cancelled`. Aucune donnée personnelle dans `metadata`.
- **Effacement** : l'anonymisation d'une partie ne touche aucune pièce émise. Durée de conservation (10 ans en comptabilité) à confirmer.

## Options écartées

- **Table `credit_notes` séparée** : mêmes colonnes, mêmes verrous, même liste à l'écran ; EN 16931 traite l'avoir comme une facture de type 381.
- **Numéro au brouillon, auto-incrément ou numéro de Documents** : trous dans la suite, ou suite partagée entre types de pièces.
- **Suppression ou modification d'une facture émise, annulation sans avoir** : contraire à la loi et à l'ADR 0022.
- **« Marquer payée » sans montant ni écriture** (démonstration actuelle) : un statut sans grand livre est une seconde source de vérité.
- **Réutiliser `rent_payments`** : liés au bail et à l'échéancier ; Invoicing → Rent couplerait deux cycles de vie.
- **Créer Payments pour la saisie manuelle** : l'ADR 0005 le réserve aux PSP ; ce serait un module vide de son objet.
- **Pourcentage de TVA saisi par le client, taux en constantes ou en points de base** : faux pour la TVQ et contraire à l'ADR 0008.
- **TVA arrondie ligne par ligne** : écart avec le calcul EN 16931 contrôlé par la plateforme agréée.
- **Factur-X généré par eGuardImmo, ou devenir plateforme agréée** : écarté par l'ADR 0011.
- **Régularisation de charges et frais de recouvrement facturés au locataire** : décompte d'Accounting d'un côté, clause interdite de l'autre.
- **Calcul automatique des honoraires de gestion dès la phase 1** : il exige les encaissements par mandat et le compte rendu de gestion (ADR à venir).
- **Événements sans consommateur** : règle de l'ADR 0025.
- **Interface pour le rendu PDF** : un seul moteur.

## Conséquences

- **Amendement de l'ADR 0005 (2026-11-18)** :
  - Invoicing → Organizations (`MembershipDirectory`, `OrganizationDirectory::legalIdentity`), Leases (`LeaseDirectory`, `LeaseParticipants`), Mandates (`MandateDirectory`), Catalog ;
  - Recovery → Invoicing (`InvoiceLedger`, lecture seule) ;
  - Invoicing ⇢ `InvoiceOverdue` ⇢ Notifications ;
  - liens déjà autorisés : Invoicing → Accounting, Documents, Parties.
- **Amendement de l'ADR 0017** : taux de taxe en cent-millièmes.
- **Ajouts hors Invoicing** :
  - Accounting : `AccountRole::CustomerReceivable` et `VatDeferred` ;
  - Organizations : identité légale du siège (adresse, SIREN ou SIRET, TVA, forme, capital) et régime de TVA ;
  - Catalog : vocabulaires `invoice_item` et `tax_rate` (seeder de plateforme `Fr`) ;
  - `app/Shared/Pdf`.
- **Planification** : `invoices:flag-overdue` chaque jour.
- **Configuration** : `INVOICING_GOTENBERG_URL`, `INVOICING_GOTENBERG_TIMEOUT`.
- **Front** :
  - lignes multiples ;
  - catégorie de taxe au lieu d'un pourcentage ;
  - plus de date d'émission saisie (période de prestation à la place) ;
  - règlement avec montant ;
  - avoir partiel avec motif ;
  - mandants comme destinataires.
- **Tests attendus** :
  - accès : 401, 403 par rôle, 404 sur l'organisation, la partie ou le bail d'une autre organisation, organisation `individual` refusée ;
  - numérotation : suite continue sous concurrence, aucun trou après un brouillon abandonné ou une panne de Gotenberg ;
  - recalcul serveur (champs interdits ignorés ou refusés) ;
  - arrondis par taux, y compris franchise, autoliquidation et plusieurs taux ;
  - écritures équilibrées à l'émission, à l'avoir et au règlement, avec transfert de TVA différée ;
  - statuts relus au grand livre ;
  - avoir et règlement plafonnés ;
  - idempotence (rejeu 200, conflit 409) ;
  - triggers : modification et suppression d'une pièce émise, d'une ligne ou d'un règlement refusées en base ;
  - instantané inchangé après modification ou anonymisation de la partie ;
  - 503 de Gotenberg sans écriture ;
  - `InvoiceOverdue` émis une seule fois ;
  - garde de facture électronique ;
  - Recovery inclut une facture de bail.
- **Reste à faire** :
  - plateforme agréée (Factur-X, e-reporting, réception), avec `InvoiceIssued` et `CreditNoteIssued` ;
  - juridictions `Be`, `Lu`, `Ca/Qc` ;
  - remboursement d'un trop-perçu ;
  - débours ;
  - honoraires calculés depuis le compte rendu de gestion ;
  - plafond des honoraires de location (décret n° 2014-890, à vérifier) ;
  - paiement par PSP ;
  - consultation par le mandant dans l'espace propriétaire.
