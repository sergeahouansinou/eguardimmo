# ADR 0008 — Juridictions (pays et subdivisions)

Statut : accepté (2026-11-13), révisé le même jour : e-MECeF retiré ; amendé le même jour : socle européen distinct, pays choisi par l'utilisateur, ouverture au lancement de la France, de la Belgique (Bruxelles-Capitale, Wallonie), du Luxembourg et du Canada (Québec). Normes de référence : ADR 0011.

## Contexte

eGuardImmo ouvre au lancement quatre pays (décision de l'utilisateur) : France, Belgique, Luxembourg et Canada. Dans deux d'entre eux, le droit du bail d'habitation n'est pas national : en Belgique il relève des régions depuis la sixième réforme de l'État (2014), au Canada des provinces. Dans l'ancien projet, les règles de pays étaient dispersées dans le code : FCFA affiché en France, menu fiscal béninois visible côté français, repli silencieux sur le Bénin.

## Décision

### Juridiction = pays, et subdivision quand la loi l'exige
- Chaque organisation a un **pays** (ISO 3166-1), choisi par l'utilisateur à la création de l'organisation (agence ou bailleur autonome) dans la liste des juridictions ouvertes, puis non modifiable par l'utilisateur.
- Chaque bien a une **subdivision** (ISO 3166-2), déduite de son adresse : `BE-BRU`, `BE-WAL`, `CA-QC`… Les règles du bail, de la quittance et de l'indexation suivent **le lieu du bien** ; la facturation, la TVA ou les taxes de vente suivent **le siège de l'organisation**.
- Au lancement, les biens d'une organisation sont dans son pays. Un bien situé dans une subdivision non ouverte est refusé par l'API.

### Trois niveaux de règles
- `Jurisdictions/Eu/` : commun à l'Union (RGPD, eIDAS, TVA et autoliquidation intracommunautaire, facture électronique EN 16931). Utilisé par la France, la Belgique et le Luxembourg ; le Canada n'en dépend pas.
- `Jurisdictions/{Pays}/` : règles nationales (`Fr`, `Be`, `Lu`, `Ca`).
- `Jurisdictions/{Pays}/{Subdivision}/` : règles infranationales (`Be/Bru`, `Be/Wal`, `Ca/Qc`). La France et le Luxembourg n'en ont pas pour le bail.
- Chaque module déclare ses contrats et le niveau où ils se résolvent ; un sélecteur renvoie l'implémentation la plus précise disponible pour l'organisation ou le bien. Une juridiction non prise en charge lève une erreur explicite : **jamais de repli** sur une autre.

### Ouvertures au lancement (choix de l'utilisateur)

| Pays | Devise | Bail d'habitation | Ouvert au lancement | Plus tard |
|---|---|---|---|---|
| France | EUR | national | tout le territoire | — |
| Belgique | EUR | régional | Bruxelles-Capitale, Wallonie | Flandre, avec l'interface en néerlandais |
| Luxembourg | EUR | national | tout le territoire | — |
| Canada | CAD | provincial | Québec | autres provinces une par une, avec l'interface en anglais |

### Registre des juridictions
- Une juridiction (pays ou subdivision) n'est ouverte que si elle est **complète** : un registre liste les juridictions ouvertes, et un test vérifie que chacune a une implémentation pour chaque contrat de chaque module qui la concerne.
- L'écran de création d'organisation affiche la liste fournie par l'API (sélecteur avec recherche) ; l'API refuse tout pays absent du registre.
- La devise d'un montant ne vient jamais du client : elle découle de l'organisation (EUR ou CAD).
- Les taux, indices (IRL en France, indice santé en Belgique, règlements du TAL au Québec…) et barèmes sont des données datées (date d'effet), jamais des constantes dans le code.

## Options écartées

- **Conditions `if ($pays === …)` dans le code** : c'est ce qui a produit les fuites entre pays dans l'ancien projet.
- **Juridiction au seul niveau du pays** : faux pour la Belgique et le Canada, où le bail relève de la région ou de la province.
- **Juridiction déduite de l'organisation pour le bail** : une agence de Bruxelles peut gérer un bien en Wallonie ; c'est le lieu du bien qui fixe le droit applicable.
- **Une application par pays** : double maintenance pour un tronc commun très majoritaire.
- **Toutes les régions belges et provinces canadiennes au lancement** : écarté par l'utilisateur ; la Flandre impose le néerlandais, le Canada anglophone l'anglais et un jeu de règles par province.
- **Mode « générique » pour une juridiction sans règles codées** : un bail ou une quittance sans base légale produirait des documents non conformes.
- **Bénin au lancement avec la facture normalisée e-MECeF** : retiré (décision de l'utilisateur). Le mécanisme permet de l'ajouter plus tard sans toucher aux autres pays.

## Conséquences

- Ici, une interface par module est justifiée (contrat par juridiction) : c'est l'exception, documentée, à la règle « pas d'interface sans besoin ».
- Ajouter une juridiction = une implémentation par module concerné, ses tests, puis son entrée dans le registre ; sans toucher aux autres.
- Geography porte les subdivisions ISO 3166-2 des quatre pays et les rattache aux adresses.
- Le contenu métier de chaque juridiction (bail type, mentions de quittance, indexation, fiscalité du bailleur, registre des mandats, carte professionnelle) est à vérifier sur les textes officiels avant son module (ADR 0011).
- L'interface est en français au lancement ; le néerlandais, l'allemand et l'anglais viendront avec les juridictions qui les exigent.
- Le Canada sort du cadre européen pour la signature, la facturation et les données personnelles : voir ADR 0011.
- Abonnement en CAD pour les organisations canadiennes : grille fixée dans l'ADR 0013.

## Amendement du 2026-11-20 (ADR 0036)

- Le contrat `LeaseRegime` gagne `tenantNoticeReasons(jurisdictionData)` (clé, libellé, mois, justificatif exigé) et `tenantEarliestDeparture(jurisdictionData, reçu le, motif)` ; `tenantNoticeMonths` est conservé pour `RecordNotice`. Le motif devient une donnée de la demande de congé ; `tenant_notice_reason` de `jurisdiction_data` reste lu en repli, son retrait attend la reprise des données. Bail hors `Fr` : 422 `lease_jurisdiction_unsupported`, jamais de repli.

## Amendement du 2026-11-21 (ADR 0039)

- Contrat `RentalIncomeRules` par millésime (Tax, `Jurisdictions/Fr`, millésime `Revenus2025`) ; le registre n'en exige que pour `Fr` : aucune juridiction par défaut (422 `tax_jurisdiction_unsupported`, 422 `tax_year_unsupported`).
