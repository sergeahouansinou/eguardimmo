# ADR 0011 — Normes françaises et européennes de référence

Statut : accepté (2026-11-13), amendé le 2026-11-13 (signature électronique : solution hybride, voir plus bas). Les dates et obligations ci-dessous viennent de sources secondaires (éditeurs, presse spécialisée) : elles sont **à confirmer** sur Légifrance, impots.gouv.fr et EUR-Lex, et avec un expert-comptable, avant d'implémenter le module concerné.

## Décision

eGuardImmo **s'appuie sur des prestataires certifiés** pour ce qui exige une qualification, et ne la porte pas lui-même.

| Sujet | Norme ou texte | Module | Ce que fait eGuardImmo |
|---|---|---|---|
| Facture électronique | réforme française : réception obligatoire pour toutes les entreprises au 1/09/2026, émission au 1/09/2026 (GE, ETI) puis au 1/09/2027 (PME, TPE) ; format conforme à EN 16931 (Factur-X, UBL, CII) | Invoicing | émet et reçoit **via une plateforme agréée** (PA) par API ; eGuardImmo ne devient pas PA |
| E-reporting | transmission des données des opérations hors B2B domestique (honoraires facturés à des particuliers…) et des paiements | Invoicing, Payments | données transmises via la même PA |
| Quittances de loyer | ALUR : quittance gratuite sur demande | Rent | hypothèse à confirmer : une quittance de loyer d'habitation n'est pas une facture au sens de la réforme |
| Signature électronique | eIDAS (UE 910/2014, modifié par UE 2024/1183) ; Code civil art. 1366-1367 | Documents | **solution hybride** (section ci-dessous) : parcours de signature et scellement chez nous, horodatage qualifié chez un prestataire ; signature qualifiée via prestataire en option |
| Format des PDF signés | PAdES (ETSI EN 319 142), profil B-T minimum, B-LT visé | Documents | scellement des quittances et documents émis par un service interne open source |
| Date certaine | horodatage électronique **qualifié** eIDAS | Documents | TSA d'un prestataire qualifié, payée au jeton |
| Conservation probante | NF Z42-013 / ISO 14641 ; archivage qualifié eIDAS quand l'offre existera | Documents | stockage privé, empreintes, chaîne de hash ; prestataire d'archivage à choisir |
| Données personnelles | RGPD | tous | minimisation, durées de conservation par type, registre des traitements, analyse d'impact pour les pièces d'identité ; seules les pièces autorisées pour un candidat locataire sont demandées |
| Métier d'agent immobilier | loi Hoguet : carte professionnelle, garantie financière, registre des mandats à numérotation continue | Organizations, Mandates | carte et garantie enregistrées sur l'organisation ; registre des mandats sous verrou transactionnel |
| Bail d'habitation | loi de 1989, ALUR, ELAN : bail type, indexation IRL, encadrement des loyers en zone tendue | Leases, Rent | modèles et contrôles par la juridiction `Fr` |
| Paiements | DSP2 (authentification forte), prélèvement SEPA (mandat SEPA) | Payments | passe par un PSP (Stripe). **eGuardImmo ne détient jamais les fonds** : l'argent va sur le compte de l'organisation, sans agrément d'établissement de paiement |
| Fiscalité du bailleur | revenus fonciers (micro-foncier, régime réel, 2044) | Tax | aide à la déclaration, pas de télédéclaration |
| Accessibilité | RGAA / WCAG 2.1 AA | apps web | niveau visé pour toutes les applications |

### Signature électronique : solution hybride (amendement du 2026-11-13)

Décision de l'utilisateur : pas de prestataire de signature payant pour l'instant ; une solution open source intégrée au backend, avec un seul service payant, l'horodatage qualifié.

1. **Parcours de signature dans le module Documents** :
   - le document est figé (PDF + empreinte SHA-256) avant l'envoi ; toute modification relance un nouveau parcours ;
   - le signataire est identifié par son compte vérifié, puis par un code à usage unique envoyé au moment de signer (expiration courte, essais limités) ;
   - il consent explicitement (case et bouton de signature distincts) ;
   - un **journal de preuve** non modifiable enregistre chaque étape : identité, horodatage, adresse IP, user-agent, empreinte du document présenté et du document signé.
2. **Scellement PAdES par un service interne** construit sur une bibliothèque open source : **pyHanko** (Python) ou **EU DSS** (Java, LGPL 2.1, bibliothèque de référence de la Commission). Pas de bibliothèque PHP : au spike du 17/10/2026 sur l'ancien projet, `signer-php` ne produisait pas de profil B-T conforme.
3. **Certificat de cachet d'eGuardImmo** pour sceller : clé privée hors du dépôt et hors de l'application web, accessible au seul service de scellement. Un certificat de cachet qualifié pourra le remplacer sans changer le parcours.
4. **Horodatage qualifié** d'un prestataire inscrit sur la liste de confiance, pour la date certaine.
5. **Validation** de chaque PDF scellé (pyHanko ou DSS) dans les tests et avant archivage.
6. **Signature qualifiée en option**, via un prestataire qualifié (Yousign, Universign…), pour les actes à fort enjeu ou si un juriste l'exige. Le module Documents prévoit cette variante dès le départ (un fournisseur de signature interchangeable).

Valeur juridique, à faire confirmer par un juriste avant la mise en production :
- La signature du signataire est une **signature électronique simple** : recevable (eIDAS art. 25.1, Code civil art. 1366-1367), mais sans présomption de fiabilité. En cas de contestation, eGuardImmo doit prouver l'identification et l'intégrité : c'est le rôle du journal de preuve.
- Elle n'est pas « avancée » au sens de l'article 26 : le signataire ne détient pas de clé sous son contrôle exclusif, c'est eGuardImmo qui scelle.
- Le cachet d'eGuardImmo prouve l'intégrité du document ; l'horodatage qualifié lui donne une date présumée exacte.
- La loi n'impose pas de niveau avancé ou qualifié pour le bail d'habitation, le mandat ou l'état des lieux ; si un juriste l'exige pour un acte, cet acte passe par la variante qualifiée (point 6).

## Options écartées

- **Devenir plateforme agréée** : immatriculation, audit et exploitation hors du métier d'eGuardImmo.
- **Horodatage maison** : sans qualification eIDAS, aucune date présumée exacte devant un juge.
- **Prestataire de signature qualifié pour toutes les signatures** (Yousign, Universign) : ni open source ni gratuit, prix de l'API sur devis ; gardé en option (point 6).
- **DocuSeal ou Documenso auto-hébergés** : l'édition gratuite de DocuSeal n'a ni API ni intégration ; PAdES non documenté pour DocuSeal ; deuxième application avec sa base, ses comptes et ses données personnelles ; AGPL ; même niveau juridique que la solution hybride.
- **Bibliothèque PHP de signature** (`signer-php`) : profil PAdES B-T non conforme.
- **Encaisser les loyers sur un compte de la plateforme** : il faudrait un agrément d'établissement de paiement ; c'est aussi un risque de cantonnement des fonds de tiers.
- **DGI e-MECeF (Bénin)** : retiré (ADR 0008).

### Autres juridictions ouvertes au lancement (amendement du 2026-11-13, ADR 0008)

Repères de départ, **tous à confirmer** sur les textes officiels avant le module concerné. Le tableau ci-dessus reste la référence pour la France ; le socle européen (RGPD, eIDAS, EN 16931) vaut aussi pour la Belgique et le Luxembourg.

| Juridiction | Points qui diffèrent de la France |
|---|---|
| Belgique (Bruxelles-Capitale, Wallonie) | bail régional (Code bruxellois du logement ; décret wallon du 15 mars 2018) ; enregistrement obligatoire du bail ; indexation sur l'indice santé ; facture électronique B2B via le réseau Peppol, obligatoire depuis le 1/01/2026 ; agent immobilier agréé par l'IPI |
| Luxembourg | bail régi par la loi du 21 septembre 2006 ; autorisation d'établissement pour l'agent immobilier ; facture électronique obligatoire envers l'État |
| Canada (Québec) | hors eIDAS et RGPD : signature et preuve selon le Code civil du Québec et la Loi concernant le cadre juridique des technologies de l'information ; données personnelles selon la Loi 25 (Québec) et la LPRPDE, avec évaluation préalable de tout transfert hors du Québec ; bail sur le formulaire obligatoire du Tribunal administratif du logement ; taxes TPS et TVQ ; encadrement du courtage par l'OACIQ, à vérifier pour la gestion locative ; paiements en CAD, prélèvement par débit préautorisé |

## Conséquences

- La solution de signature hybride (PAdES, cachet, horodatage qualifié eIDAS) est européenne : sa valeur au Québec est à faire confirmer par un juriste québécois avant d'y ouvrir la signature.
- L'hébergement unique en Union européenne doit être compatible avec la Loi 25 pour les organisations québécoises : évaluation des facteurs relatifs à la vie privée avant l'ouverture du Québec.
- Trois prestataires à choisir avant les modules concernés : plateforme agréée (Invoicing), prestataire d'horodatage qualifié (Documents), PSP avec prélèvement SEPA (Payments).
- Documents ajoute un service de scellement (Python ou Java) à déployer à côté de Laravel, appelé par file d'attente, et un certificat de cachet à acquérir et à protéger.
- Avant la mise en production de la signature : avis d'un juriste sur le niveau de signature par type d'acte.
- Chaque intégration externe distingue trois états (trouvé, absent, non vérifiable) et ne met jamais une panne en cache comme un refus.
- Avant chaque module listé ici, une vérification des textes officiels en vigueur fait partie du plan.
