# ADR 0013 — Plans d'abonnement

Statut : accepté (2026-11-13). Module Subscriptions (ADR 0005). Encaissement : Payments (ADR 0007).
Amendement proposé (2026-11-15) : quotas et fonctions en lignes `plan_entitlements` plutôt qu'en colonnes (ADR 0018).

## Contexte

Les organisations (agences et bailleurs autonomes, ADR 0006) paient un abonnement SaaS. Décision de l'utilisateur : reprendre la grille de Rentila, chaque prix diminué de 1 €.

Grille Rentila relevée le 2026-11-13 sur https://www.rentila.com/tarifs (après sa hausse du 1er septembre 2026) : Gratuit 0 € ; Silver 5,90 € HT/mois ou 59 € HT/an ; Gold 11,90 € HT/mois ou 119 € HT/an ; essai complet de 15 jours ; sans engagement.

## Décision

### Grille (prix HT, TVA française ajoutée à la facturation)

| Plan | Mensuel | Annuel | Lots | Locataires, baux, états des lieux | Stockage | Utilisateurs | Signatures / mois |
|---|---|---|---|---|---|---|---|
| Gratuit | 0 € | 0 € | 1 | 2 locataires, 2 baux, 4 états des lieux | 50 Mo | 1 | selon le coût d'horodatage (à fixer) |
| Silver | 4,90 € | 58 € | 2 à 5 | illimités | 500 Mo | plusieurs | 10 |
| Gold | 10,90 € | 118 € | illimités | illimités | 5 Go | plusieurs | 20 |

- « Retirer 1 € » s'applique à chaque prix affiché, mensuel comme annuel.
- Un lot est une unité louable (`Properties`), pas un bien : un immeuble de 4 appartements compte 4 lots.
- Assistant IA, API publique et MCP, présents chez Rentila, ne font pas partie du lancement.

### Règles
- Toute nouvelle organisation démarre en Gratuit avec 15 jours d'accès complet. À la fin de l'essai sans souscription, elle repasse en Gratuit.
- Sans engagement : la résiliation prend effet à la fin de la période payée. Le changement de plan se fait depuis l'espace de l'organisation.
- **Dépassement de quota** (fin d'essai, passage à un plan inférieur) : aucune donnée n'est supprimée ni masquée. La création au-delà de la limite est refusée par l'API avec un message qui propose le plan adapté ; la consultation et l'export restent ouverts.
- Les plans, prix et quotas sont des **données** du module Subscriptions (table versionnée), pas des constantes du code. Un abonnement garde le prix de la version souscrite : une hausse ne touche que les nouvelles souscriptions, sauf préavis.
- Montants en centimes et devise ISO (`Money`, ADR 0007) : 490, 5800, 1090, 11800 EUR.
- Les quotas se vérifient côté API dans l'Action qui crée l'objet (lot, bail, utilisateur, signature, fichier), jamais seulement dans l'interface.

## Options écartées

- **Grille propre à eGuardImmo** : écartée par l'utilisateur au profit d'un alignement explicite sous le concurrent principal.
- **Annuel recalculé à partir du mensuel** (par exemple 10 mois payés) : écarté par l'utilisateur le 2026-11-13, l'annuel reste à 58 € et 118 €.
- **Suppression ou archivage forcé des données au-delà du quota** : interdit, les données métier ne se suppriment pas.

## Conséquences

- Encaissement récurrent par le PSP (Stripe Billing envisagé) via Payments ; `PaiementConfirmé ⇢ Subscriptions` prolonge la période.
- Les factures d'abonnement émises par eGuardImmo suivent la réforme de la facture électronique (ADR 0011) : passage par une plateforme agréée à vérifier avant l'ouverture des paiements.
- Le quota de signatures doit couvrir le coût des jetons d'horodatage qualifié (ADR 0011) : chiffrer ce coût avant de fixer le quota du plan Gratuit.
- Une grille identique pour agences et bailleurs autonomes ; une offre agence distincte demandera un nouvel ADR.
- La grille en euros vaut pour la France, la Belgique et le Luxembourg (ADR 0008), avec la TVA du pays de l'organisation, ou l'autoliquidation pour une organisation assujettie d'un autre État membre.

### Grille en dollars canadiens (amendement du 2026-11-13)

Rentila ne publie pas de prix en CAD. Décision de l'utilisateur : convertir les prix Rentila en euros à **1,60 CAD pour 1 EUR** (taux relevé le 2026-11-13 sur plusieurs convertisseurs, entre 1,59 et 1,62), puis retirer 1 $.

| Plan | Rentila converti | Mensuel | Annuel | Centimes |
|---|---|---|---|---|
| Gratuit | 0 $ | 0 $ | 0 $ | 0 |
| Silver | 9,44 $ · 94,40 $ | 8,44 $ HT | 93,40 $ HT | 844 · 9340 CAD |
| Gold | 19,04 $ · 190,40 $ | 18,04 $ HT | 189,40 $ HT | 1804 · 18940 CAD |

- Mêmes quotas, même essai, mêmes règles que la grille en euros.
- Les prix CAD sont figés : ils ne suivent pas le taux de change. Une révision crée une nouvelle version de la grille, sans toucher aux abonnements en cours.
- Taxes ajoutées à la facturation : TPS et TVQ pour une organisation québécoise, à confirmer avec un fiscaliste (inscription aux fichiers de la TPS et de la TVQ d'un fournisseur étranger de services numériques).
