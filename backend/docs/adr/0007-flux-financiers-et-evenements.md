# ADR 0007 — Flux financiers et événements

Statut : accepté (2026-11-13).
Amendement accepté (2026-11-18, ADR 0031) : le grand livre distingue les fonds de l'agence et ceux des mandants (`TrustBank`, `OwnerRentCalled`, `OwnerChargesCalled`, `OwnerVatCalled`, `OwnerPayable` crédité par les encaissements, `PayoutsInTransit`) ; aucune écriture ne se passe dans une période close (`accounting_periods`, déclencheurs, `OnClosedPeriod`) ; équation de cantonnement ; ordre des verrous inter-modules : (1) `rent_schedules` ou intervention, (2) verrou du compte mandant (`Ledger::lockParty`), (3) `invoices`, (4) verrous de période.
Amendement accepté (2026-11-19, ADR 0034) : niveau (0) de l'ordre des verrous : `charge_property_locks`, puis l'exercice, puis le décompte, ou la dépense ; puis (1) `rent_schedules` du bail, (2) compte du mandant, (3) factures, (4) périodes ; plusieurs baux par identifiant croissant. Sources d'écriture `expense` et `charge_statement` ; nature d'imputation `expense`.
Amendement accepté (2026-11-19, ADR 0035) : niveau (0) de l'ordre des verrous : lignes de relevé `bank_statement_lines` `FOR UPDATE` par identifiant croissant (Banking), avant (1) `rent_schedules`, (2) compte du mandant, (3) factures, (4) périodes. Banking écrit seul les frais bancaires (`BankCharges`, 5100) dans sa transaction, source `bank_line`, `onClosedPeriod = roll_forward`.

## Contexte

La première proposition faisait passer l'argent par des événements asynchrones (`PaiementReçu → Accounting`). Si le listener échoue, le grand livre diverge sans erreur visible. L'ancien projet a déjà dû réaligner la situation locataire sur le grand livre.

## Décision

### Écritures qui doivent rester cohérentes : une seule transaction
- Le grand livre (Accounting) est la **source de vérité des soldes**. Aucun module ne stocke un solde à côté.
- Quand une opération crée une écriture financière, le module qui la porte appelle la PublicApi d'Accounting **dans sa propre transaction**. Exemple : affecter un paiement à un avis et passer l'écriture au grand livre.
- Montants en `Money` (ADR 0001), jamais de float.

### Passage d'un module à l'autre par événement : quatre conditions
Permis seulement si :
1. l'événement est émis **après le commit** (`ShouldDispatchAfterCommit`, imposé par test d'architecture à toute classe `Events/`) ;
2. le listener est en file, avec reprises ;
3. il est **idempotent** : une clé unique en base (id du paiement, couple bail + période) rend un rejeu sans effet ;
4. une **tâche planifiée de rattrapage** retrouve ce qui aurait dû être traité et le traite ou le signale.

Application :
- `BailSigné ⇢ Rent` génère l'échéancier ; une tâche quotidienne génère les avis manquants des baux actifs, par couple (bail, période).
- `PaiementConfirmé ⇢ Rent / Bookings / Subscriptions` affecte l'encaissement ; un rapprochement quotidien signale les paiements confirmés non affectés.

### Paiements
- Un webhook de passerelle est vérifié (signature), journalisé, puis traité de façon idempotente sur la référence du fournisseur (contrainte unique). Un webhook rejoué ne crée jamais un second paiement.

## Options écartées

- **Événements simples pour l'argent** : divergence silencieuse si un listener échoue.
- **Appels PublicApi dans tous les sens** : crée des cycles (Rent a besoin de Leases, Leases déclencherait Rent).
- **Outbox transactionnelle** : plus de code ; l'émission après commit plus le rattrapage planifié couvrent le besoin tant qu'il n'y a pas de consommateur externe.

## Conséquences

- Tout nouvel événement financier précise dans son module la clé d'idempotence et la tâche de rattrapage.
- Les numéros de facture et de quittance suivent une séquence continue par organisation, attribuée sous verrou transactionnel.

## Amendement du 2026-11-20 (ADR 0036)

- Module Payments : intention (`online_payments`), compte connecté de l'organisation (`payment_accounts`), webhooks dédoublonnés (`payment_provider_events`, unique sur le fournisseur et l'identifiant d'événement). Transitions monotones ; seule exception : un succès confirmé par le PSP l'emporte sur une annulation ou une expiration locale, car l'argent a bougé. Un montant confirmé différent du montant demandé n'est jamais cru.
- `PaymentConfirmed` (après commit) porte la clé d'idempotence `psp:{provider}:{référence}` ; Rent l'écoute en file et enregistre l'encaissement par `RecordPayment` (moyen `card`, `provider_reference` stocké « {fournisseur}:{référence} », unique par organisation). Rattrapage `payments:reconcile` quotidien : relit au PSP les intentions `pending` de plus de 24 h et rejoue les confirmations non imputées sur 30 jours ; un rejeu ne crée jamais un second encaissement.

## Amendement du 2026-11-21 (ADR 0039)

- Un prêt est un contrat hors grand livre : son échéancier et son capital restant dû ne sont pas des soldes comptables et Investments n'écrit aucune écriture. Le prévisionnel de Reporting est une projection non stockée (« projection, ce n'est pas un solde ») ; son ouverture est le solde `Bank` de la fin du mois précédent, lu par `LedgerReader::accountBalance`.
