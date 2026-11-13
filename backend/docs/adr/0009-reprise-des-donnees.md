# ADR 0009 — Reprise des données de l'ancienne application

Statut : accepté (2026-11-13).

## Contexte

La refonte change le schéma (organisations, modules, montants en unités mineures). L'ancienne application reste en production pendant la refonte. Une reprise mal pensée fige les mauvais choix du nouveau schéma ou fait perdre la valeur probante des documents scellés.

## Décision

- **Nouveau schéma, base distincte.** La nouvelle API ne lit ni n'écrit la base de l'ancienne application en fonctionnement normal.
- **Reprise module par module**, par une commande `legacy:import {module}` :
  - connexion `legacy` en **lecture seule** (utilisateur MySQL avec le seul droit SELECT) ;
  - idempotente : une table `legacy_mappings` (module, table d'origine, id d'origine, nouvel id) permet de relancer sans doublon ;
  - ordre imposé par les dépendances : Identity → Organizations → Geography → Properties → Mandates → Leases → Rent / Payments / Invoicing → Accounting → le reste.
- **Bascule par organisation**, pas par espace : on reprend une organisation entière (agence pilote d'abord), on la bascule, l'ancienne application passe en lecture seule pour elle. Un locataire ou un propriétaire voit alors ses données au même endroit.
- **Documents fiscaux et scellés** : importés tels quels (PDF, hash, horodatage, numéro). Jamais régénérés ni rescellés.
- **Rapport de reprise** par organisation : comptes repris, rejetés, soldes du grand livre comparés à l'ancien calcul.
- Les doublons ou incohérences de l'ancienne base ne sont pas supprimés : ils sont repris tels quels ou signalés dans le rapport.

## Options écartées

- **Nouvelle API sur l'ancienne base** : elle hériterait du schéma qu'on veut quitter.
- **Bascule d'un coup** : aucun retour arrière possible, toutes les agences exposées au même moment.
- **Bascule par espace** (d'abord l'espace locataire) : un même bail vivrait dans deux systèmes.

## Conséquences

- Chaque module reprenant des données livre sa commande d'import et ses tests sur un échantillon anonymisé.
- Le rapprochement des soldes ancien / nouveau est le critère de bascule d'une organisation.
