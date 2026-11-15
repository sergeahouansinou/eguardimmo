# ADR 0022 — Instantané des pièces émises

Statut : accepté (2026-11-15). Amende l'ADR 0011 (pièces probantes). Parties : ADR 0019.

## Contexte

Dans le modèle de données proposé, une quittance ou une facture relit le nom, l'adresse et les montants dans les fiches au moment de l'affichage. Après un déménagement, un changement de raison sociale ou une anonymisation RGPD, la pièce affichée ne correspond plus au PDF scellé.

## Décision

- Toute pièce émise porte une colonne `snapshot` (JSON) remplie à l'émission et jamais modifiée : émetteur, destinataire, adresses, identifiants légaux, lignes, montants, références du bail et du lot, juridiction et version du modèle de document.
- Pièces concernées : quittances, reçus de paiement, avis d'échéance, factures et avoirs, décomptes de dépôt et de régularisation, comptes rendus de gestion, attestations, courriers générés.
- Les montants restent aussi en colonnes typées (`bigint` et devise) pour les calculs et les contraintes ; le `snapshot` sert à l'affichage et à la régénération à l'identique.
- L'empreinte (`fingerprint`) se calcule sur le PDF scellé, et le `snapshot` sur lequel il a été produit est conservé avec lui.
- Les modèles de documents et de courriers sont versionnés ; la pièce garde la version utilisée.

## Options écartées

- **Relire les fiches** : la pièce change sans que personne ne la modifie.
- **Copier chaque champ en colonne** sur chaque pièce : des dizaines de colonnes dupliquées, à refaire pour chaque pays.
- **Ne garder que le PDF** : aucune recherche ni réimpression possible sans relire le fichier.

## Conséquences

- L'anonymisation d'une partie ne touche pas les pièces émises, conservées pour leur durée légale.
- Un test vérifie qu'aucune pièce émise ne lit une fiche pour s'afficher.
