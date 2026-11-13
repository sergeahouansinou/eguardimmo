# ADR 0007 — Flux financiers et événements

Statut : accepté (2026-11-13).

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
