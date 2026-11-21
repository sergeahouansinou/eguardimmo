# ADR 0026 — Loyers : échéancier, encaissements, quittances

Statut : accepté (2026-11-16). Complète l'ADR 0005 (module Rent), l'ADR 0007 (écritures dans la même transaction), l'ADR 0008 (juridictions), l'ADR 0020 (échéances depuis les `lease_terms`), l'ADR 0021 (pièces à échéance) et l'ADR 0022 (instantané des pièces émises).
Amendement accepté (2026-11-18, ADR 0031) : appel et imputation routés vers les comptes de mandant quand l'échéance est sous mandat après l'activation (colonnes `installments.mandate_id` et `mandant_party_id`, figées à l'émission de l'avis) ; ventilation au prorata des composantes appelées (demi supérieur, écart au dernier composant) ; `onClosedPeriod = roll_forward` ; annulation et contrepassation sous le verrou du compte mandant.
Amendement accepté (2026-11-19, ADR 0034) : `rent_adjustments` et `PublicApi/RentAdjustments` (`schedule`, `credit`, `cancelPending`) ; `PublicApi/ChargeProvisions` ; `installments.kind` (`periodic`, `adjustment`) et clé unique `(lease_id, kind, period_start)` ; ligne d'échéance de sens `charges_adjustment` ; crédit de régularisation porté par un encaissement de méthode `charge_credit` (avance du bail reprise à l'avis suivant) ; remboursement d'avance `POST /rent/leases/{lease}/refunds` (propriétaire, administrateur, comptable ; `two-factor` ; `Idempotency-Key`) ; Rent ne modifie toujours aucune échéance déjà générée.
Amendement accepté (2026-11-19, ADR 0035) : `PublicApi/RentCollections::recordBankTransfer` (même Action que la saisie d'un paiement, clé d'idempotence `banking:line:{ligne}:{rang}`, report sur le premier jour ouvert si le mois est clos) ; un encaissement en espèces n'est pas pointable en banque.

## Contexte

Rent appelle le loyer de chaque bail signé, enregistre les encaissements, les impute et délivre l'avis d'échéance puis la quittance. Le grand livre (Accounting) reste la source de vérité des soldes ; Rent décrit ce qui est appelé, jamais ce qui est dû.

## Décision

### Modèle (Rent)
- `rent_schedules` : un échéancier par bail (`billing_from`, premier jour du mois de facturation). Sa ligne, lue `FOR UPDATE`, est le verrou d'ordre de tout le bail.
- `installments` : une période par ligne, clé unique `(lease_id, period_start)`. Statuts `upcoming | issued | partially_paid | paid | cancelled`. Montants (loyer, charges, TVA, total) en unités mineures, calculés une fois à la génération, jamais relus du bail ensuite. `installment_lines` : un tronçon par mois civil et par composante, avec jours occupés, jours du mois, TVA.
- `rent_payments` (clé d'idempotence unique par organisation, empreinte du contenu) et `rent_payment_allocations` (une ligne par échéance imputée, `reversed_at` à l'annulation). Aucun encaissement ni imputation ne se supprime.
- `rent_notices` et `rent_receipts` : pièces figées (ADR 0022) portant numéro, empreinte, version de modèle et instantané. Une colonne virtuelle unique n'autorise qu'une quittance valable par échéance.
- `rent_sequences` : numérotation continue par organisation sous verrou (`ContinuousCounter`), `AV-AAAA-NNNN` pour les avis, `QT-AAAA-NNNN` pour les quittances. Documents conserve son propre numéro interne ; ces numéros ne sont pas ceux de la loi, qui n'en impose pas.

### Génération
- Périodes en mois civil, périodicité de n mois ancrée sur `billing_from`. Les montants des termes sont mensuels ; un mois partiel est proratisé au jour réel (jours occupés / jours du mois, arrondi au demi supérieur par ligne, `moneyphp`). Jamais de `float`.
- Un bail signé avec une date de début passée se facture à partir du mois courant : aucun rattrapage.
- L'échéance est le jour `due_day` du premier mois de la période (terme à échoir) ou du mois suivant (terme échu). Elle est générée quand `échéance − 10 jours ≤ aujourd'hui`.
- Idempotente : verrou du bail, clé unique, une période déjà générée (même annulée) n'est jamais refaite. Une composante sans sens système (Catalog) refuse la génération (422 `rent_component_unclassified`) ; le dépôt de garantie n'est jamais appelé.
- Déclencheurs : événement `LeaseSigned` (listener en file) et `rent:generate` quotidienne (04:10), qui rattrape aussi un événement perdu et signale les impayés.
- Une révision de loyer ne modifie jamais une échéance déjà générée. La révision rétroactive n'est jamais automatique (plafond de trois ans, action explicite) : voir « Reste à faire ».

### Avis d'échéance
- Émis à la demande (`POST …/issue`, ou en lot `issue-due`). Dans une seule transaction : numéro, PDF, pièce Documents, écriture d'appel de loyer au grand livre (journal Rent), imputation des avances.
- Le PDF vient toujours de Gotenberg (`POST /forms/chromium/convert/html`, HTML Blade des instantanés). Aucun PDF n'est produit en PHP. Service absent ou en erreur : 503 `rent_pdf_unavailable` avec `Retry-After`, rien n'est écrit.
- La tâche planifiée ne produit aucune pièce : l'émetteur (nom de l'organisation) se lit par l'adhésion du compte connecté.

### Encaissements
- Saisie manuelle : virement, chèque, espèces, prélèvement. Le montant est un entier en unités mineures dans la devise du bail ; le client ne fournit jamais de devise. Clé d'idempotence obligatoire : même clé et même contenu rejouent la réponse (200), contenu différent refusé (409 `rent_idempotency_key_reused`).
- Imputation du plus ancien au plus récent sur les échéances appelées (échéance, période, identifiant). Le surplus est une avance du bail (crédit du compte locataire sans créance), reclassée par une écriture à l'émission de l'échéance suivante.
- Écriture unique par encaissement : banque (ou caisse en espèces) au débit ; compte locataire au crédit, une ligne par créance imputée. Encaissement, imputations et écriture partagent une transaction (ADR 0007).
- Annulation : chaque écriture est contrepassée, les imputations closes, les statuts relus du grand livre, la quittance devenue fausse déclarée nulle. Rejouable.
- Le reste dû d'une échéance se lit toujours au grand livre (`LedgerReader::outstandingMany`) ; Rent ne stocke aucun solde.

### Quittance
- Émise automatiquement quand une échéance est soldée, après la transaction d'argent : une panne du PDF ne défait jamais un encaissement, la quittance reste « en attente » (`receipt_state = pending`) et se reprend par `POST /receipts/issue-pending`.
- Exception : une échéance soldée au moyen d'un chèque ne reçoit pas de quittance automatique (`on_demand`) ; elle se demande par `POST /installments/{id}/receipt`.
- Elle distingue le loyer et les charges et porte les mentions de l'article 21 de la loi n° 89-462 du 6 juillet 1989 (gratuité, loyer et charges distingués) et de l'article 7-1 (conservation). Les mentions viennent de la juridiction (`RentDocumentRules`, France d'abord, ADR 0008) ; une autre juridiction est refusée (422 `rent_jurisdiction_unsupported`).

### Verrous
Chaque Action qui décide d'une imputation ou d'un statut prend en tout premier, dans sa transaction, la ligne `rent_schedules` du bail `FOR UPDATE`, puis les échéances ouvertes dans l'ordre d'imputation. Aucune lecture non verrouillante ne précède le verrou : sous REPEATABLE READ, elle figerait un instantané qui ne verrait pas un encaissement validé entre-temps. Deux encaissements, ou un encaissement et une annulation, du même bail se suivent donc.

### Rôles et API (`/org/{organization}/rent…`)
Lecture : propriétaire, administrateur, gestionnaire, comptable, débit 120/min. Enregistrer un encaissement : les mêmes quatre rôles. Tout le reste (génération, avis, annulation d'une échéance ou d'un encaissement, quittance) : propriétaire, administrateur, gestionnaire ; le comptable ne modifie jamais l'échéancier. Débit d'écriture 60/min. Codes RFC 9457 dans `Enums/ErrorCode` (ADR 0014).

### Lecture inter-modules
`PublicApi/RentLedger` : `leaseBalance` (solde du bail au grand livre, retard, avance) et `unpaidInstallments` (échéances appelées échues et non soldées, reste dû, curseur par identifiant) pour Recovery et Reporting. Événement `InstallmentOverdue` (l'« AvisImpayé » de l'ADR 0005), émis une fois par échéance à la première détection.

## Options écartées

- **Stocker le reste dû sur l'échéance** : deux sources de vérité ; le grand livre fait foi.
- **Émettre l'avis à la génération** : l'écriture d'appel de loyer doit refléter un avis réellement envoyé ; une échéance à venir reste modifiable (annulable) sans contrepassation.
- **Générer le PDF en PHP (dompdf, TCPDF)** : interdit par décision ; un service Gotenberg isole le moteur de rendu.
- **Quittance dans la transaction de l'encaissement** : une panne du PDF empêcherait d'enregistrer de l'argent reçu.
- **Rattrapage automatique des périodes passées et révision rétroactive automatique** : charge financière non voulue pour le locataire ; l'agence le décide.
- **Numéros de Documents comme numéros de loyer** : séquence commune à tous les types de pièces ; Rent garde des séquences distinctes et continues par type.
- **Interface pour le rendu PDF** : un seul moteur, aucune seconde implémentation ; une interface se justifiera avec la seconde.

## Conséquences

- Rent → Leases (`LeaseSchedule`, `LeaseDirectory`, `LeaseParticipants`), Accounting (`Ledger`, `LedgerReader`), Documents (`IssuedDocuments`, `DocumentStore`), Parties (`PartyDirectory`), Properties (`UnitDirectory`), Organizations (`MembershipDirectory`, nom de l'émetteur), Catalog (sens de composante). Leases ⇢ `LeaseSigned` ⇢ Rent. Rent ⇢ `InstallmentOverdue` ⇢ Recovery.
- Additifs hors Rent : `LedgerReader::outstandingMany` (Accounting) et `LeaseSchedule::organizationsWithActiveLeases` (Leases, sans contexte d'organisation, pour la tâche planifiée).
- Configuration : `RENT_GOTENBERG_URL` et `RENT_GOTENBERG_TIMEOUT` ; la commande `rent:generate` est planifiée chaque jour.
- Reste à faire : révision de loyer par indice (IRL) avec table de données datée et action explicite de rattrapage, reçu de paiement partiel, régénération des échéances « à venir » après une révision ou un départ anticipé, encaissements par PSP (module Payments, événement `PaiementConfirmé`), adresse et SIRET de l'émetteur dans l'instantané (Organizations ne les expose pas encore).

## Amendement du 2026-11-20 (ADR 0036)

- Moyen `card` ; `rent_payments.provider_reference` unique nullable ; `RentLedger::payableInstallments` (restes dus des échéances payables, base du montant d'une intention) et `isRecorded` (existence d'un encaissement par clé `psp:{provider}:{référence}`) ; écoute de `PaymentConfirmed`.
- **Reste à faire** : aucun module ne régénère les échéances « à venir » après l'enregistrement d'un préavis ou le départ d'un colocataire ; à traiter avant d'ouvrir le congé en production.
