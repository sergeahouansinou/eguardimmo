# ADR 0023 — Dossier de recouvrement par locataire et transmission au commissaire de justice

Statut : accepté (2026-11-15). Complète l'ADR 0005 (module Recovery), l'ADR 0019 (Parties), l'ADR 0021 (procédures) et l'ADR 0022 (instantané des pièces émises).

## Contexte

Le premier modèle ouvrait un dossier par échéance impayée (`recovery_cases.opened_by_installment_id` unique). Un locataire en retard sur trois mois avait trois dossiers, et rien ne permettait de transmettre ses pièces à un commissaire de justice. L'utilisateur veut un dossier par locataire qui regroupe les créances choisies, les pièces réunies en un envoi, transmis par lien sécurisé et tracé au carnet des diligences.

## Décision

### Dossier
- `recovery_cases` : un dossier par **bail et débiteur** (partie locataire), numéro `RC-AAAA-NNNN` en séquence continue par organisation, pris sous verrou. Statut `open`, `in_plan`, `closed`, `uncollectible`. La colonne `opened_by_installment_id` disparaît.
- `recovery_case_items` : les créances du dossier, `item_type` (`installment` pour une échéance de loyer, `invoice` pour une facture), `item_id`, montant dû à l'inclusion (instantané, `Money`), `included_at`, `removed_at`. On ajoute ou retire une créance à tout moment ; le retrait ferme la ligne, rien n'est effacé.
- Une créance n'appartient qu'à un seul dossier ouvert : contrôle dans l'Action, sous verrou, doublé d'une vérification nocturne.
- Le reste dû se lit toujours dans le grand livre (Accounting, ADR 0007) ; l'instantané sert seulement à l'historique.

### Pièces du dossier
- `recovery_bundles` : un envoi généré à la demande. Il contient le décompte des sommes dues, les avis d'échéance et factures des créances incluses, les relances et mises en demeure émises, le bail et l'extrait du grand livre du bail.
- Le ZIP est stocké par Documents (stockage probant, hors racine web) avec son empreinte SHA-256. La liste des pièces et le décompte sont figés en JSON au moment de la génération (ADR 0022) : une pièce modifiée ensuite ne change pas un envoi déjà fait.
- Téléchargement direct depuis l'espace organisation, journalisé (`recovery.bundle.downloaded`).

### Transmission au commissaire de justice
- Le destinataire est une **partie** de l'organisation qui porte le rôle « commissaire de justice » (terme `bailiff` du Catalog, ADR 0018). Son adresse e-mail est figée sur la transmission.
- `recovery_transmissions` : `bundle_id`, `recipient_party_id`, e-mail du destinataire, `token_hash` (SHA-256 d'un jeton aléatoire de 48 caractères), `expires_at` (7 jours par défaut, 30 au plus), `revoked_at`, `sent_at`, `first_downloaded_at`, `download_count`.
- L'e-mail ne contient qu'un lien `https://` vers une page publique de téléchargement, jamais le ZIP. Le lien renvoie la même réponse 404 s'il est inconnu, expiré ou révoqué. Route publique déclarée dans `ROUTES_PUBLIQUES`, limitée en débit, sans cookie de session. Chaque téléchargement est journalisé avec IP et horodatage.
- Le gestionnaire peut révoquer un lien ou en renvoyer un nouveau (l'ancien est alors révoqué).
- **Traçabilité** : l'envoi crée, dans la même transaction, un acte `recovery_acts` de type `transmission` (date, destinataire, nombre de pièces, référence de l'envoi). Il apparaît au carnet des diligences. La révocation crée aussi un acte.

### Dépendances (amende l'ADR 0005)
- Recovery → Accounting (reste dû, extrait du grand livre), Documents (stockage du ZIP), Parties (destinataire), Leases (bail).
- Recovery ⇢ `RecoveryBundleSent` ⇢ Notifications (envoi de l'e-mail).

## Options écartées

- **ZIP en pièce jointe** : données personnelles et de solvabilité qui ne se révoquent plus une fois parties, taille souvent refusée au-delà de 10 Mo, aucune preuve de réception.
- **Un dossier par échéance** : le modèle précédent ; un locataire en retard de trois mois aurait trois dossiers et trois envois.
- **Compte d'accès pour le commissaire de justice** : un portail tiers à maintenir pour un besoin couvert par un lien à durée limitée.
- **Lien sans expiration** : un e-mail transféré donnerait un accès permanent.

## Conséquences

- Les écrans Impayés et Recouvrement passent d'une logique par échéance à une logique par dossier : sélection des créances à l'ouverture, ajout et retrait ensuite, carte « Pièces du dossier », dialogue « Transmettre au commissaire de justice », historique des envois.
- La catégorie de contact « Commissaire de justice » s'ajoute aux contacts.
- Tests : séquence de numérotation, créance refusée dans un second dossier ouvert, lien expiré, révoqué ou inconnu (404 identique), acte créé à l'envoi et à la révocation, téléchargement journalisé, 404 sur le dossier d'une autre organisation.
