# ADR 0004 — Authentification centralisée et connexion Google / Apple

Statut : accepté (2026-11-13), révisé le même jour : la console sort du hub (section « Console »). Complète l'ADR 0002 (Sanctum) et l'ADR 0003 (espaces). Plan : `../.claude/PRPs/plans/auth-centralisee-google-apple.plan.md`.
Amendement (2026-11-16, ADR 0024) : le locataire s'inscrit par l'inscription ordinaire, sans `IntendedProfile` ; son profil n'est acquis que par l'acceptation d'une invitation envoyée par une organisation, sur une adresse vérifiée égale à l'adresse invitée. Aucun rattachement par e-mail seul (même raison que la liaison automatique écartée ci-dessous).
Amendement (2026-11-25, mot de passe) : 6 caractères au minimum dans tous les environnements, sans exigence de composition ni contrôle de fuite, à la demande du produit ; plus faible que les recommandations OWASP et NIST (8 au minimum). La règle vaut pour tous les comptes, opérateurs compris (décision du même jour). Limitation de débit, verrou de compte et 2FA obligatoire de la console inchangés : le jeton console exige un opérateur actif à 2FA confirmée et un code à chaque connexion, et chaque écriture une nouvelle preuve 2FA.
Amendement (2026-11-25, double authentification des opérateurs) : le seul mot de passe ne donne jamais accès à la console.
- Le rôle s'attribue avec un second facteur neuf, enregistré sur le serveur avec le titulaire : `identity:grant-operator` (attribution et réactivation) affiche une clé, la fait confirmer par un code, remplace tout second facteur existant, régénère les codes de secours et révoque sessions et jetons, dans la même transaction que le rôle. `identity:set-operator-roles` n'ajoute aucun rôle à un compte sans 2FA confirmée ; le retrait reste possible.
- Opérateur actif : son second facteur se gère uniquement sur le serveur. Les routes du hub qui l'activent, le confirment, le lisent, le désactivent ou régénèrent ses codes de secours répondent 403 `operator_two_factor_server_only`, même avec une preuve récente (une requête en cours lors d'un remplacement pourrait sinon lire la nouvelle clé). Connexion web et mobile inchangées.
- Le jeton console relit le compte sous verrou après le mot de passe : un second facteur remplacé entre-temps est refusé. La consommation d'un code de secours relit elle aussi sous verrou, pour ne jamais rétablir les codes d'un facteur remplacé ; un code déjà consommé ou remplacé est refusé au défi 2FA web, sans session.
- Opérateur déjà en place (sans 2FA, téléphone perdu, doute) : `php artisan identity:enroll-operator-two-factor {email}`, réservé aux opérateurs actifs, avec le même parcours ; audit `auth.two_factor.enrolled_on_server`, e-mail au titulaire. C'est aussi la seule façon d'obtenir de nouveaux codes de secours. L'accès au serveur est l'ancre de confiance (même principe que `operations:execute-approval`, ADR 0037).
- Au déploiement, ré-enrôler chaque opérateur actif : un second facteur créé depuis le hub avant cet amendement a pu l'être par un tiers, et le code ne le détecte pas. Contrôle : la requête suivante ne doit renvoyer aucune ligne.
  `select u.email from operators o join users u on u.id = o.user_id where o.revoked_at is null and u.deleted_at is null and not exists (select 1 from audit_logs a where a.action = 'auth.two_factor.enrolled_on_server' and a.subject_type = 'user' and a.subject_id = u.id and a.occurred_at >= u.two_factor_confirmed_at);`
- Écarté : exiger un code du second facteur existant (qui détient le mot de passe peut avoir créé le secret avant que le titulaire ne l'active, puis le partage avec lui) ; un lien d'activation par e-mail (la boîte mail suffirait alors) ; retirer puis réattribuer le rôle sans second facteur neuf.
Amendement (2026-11-25, activation de la double authentification) : personne ne confirme un secret qu'un tiers connaît.
- Un secret non confirmé appartient à la session qui l'a créé (son empreinte reste en session, oubliée à toute nouvelle connexion). Quand un tel secret existe, le QR code, la clé, les codes de secours, leur régénération et la confirmation répondent 409 `two_factor_setup_expired` depuis une autre session ; la confirmation le répond aussi sans activation préalable.
- « Activer » depuis une autre session crée un secret et des codes neufs ; la même session retrouve les siens (le hub rappelle l'activation après chaque essai). Abandonner une activation en cours reste possible depuis toute session au mot de passe confirmé.
- Chaque route de gestion du facteur s'exécute dans une transaction, ligne du compte verrouillée puis relue : une requête chargée avant une activation ou une confirmation ne remplace, ne désactive ni ne confirme un autre facteur que celui en base. Une réponse 5xx annule la transaction : pas de 2FA confirmée sans la révocation des autres accès.
- La connexion relit le compte après la vérification du mot de passe, et la session mobile le relit sous verrou avant d'émettre un jeton : une 2FA confirmée entre-temps impose le défi.
- Secrets en attente déjà en base : aucune session ne les possède, ils sont donc inutilisables et remplacés à la prochaine activation, sans migration. Au déploiement, une activation en cours est à reprendre.
- Écarté : un secret neuf à chaque appel (un code faux changerait la clé affichée) ; une colonne désignant la session créatrice ; purger les secrets en attente par migration ; régénérer les codes de secours à la confirmation (aucune autre session n'a pu les lire).
- Limites : une 2FA confirmée avant cet amendement sur un secret créé par un tiers ne se détecte pas (désactiver puis réactiver en cas de doute ; imposer la réactivation à tous reste un choix produit non pris). Connexion web et sociale : une confirmation tombant entre la relecture du compte et l'écriture de la session laisse une session sans second facteur, sans accès au facteur. Qui détient le mot de passe peut toujours activer la 2FA d'un compte qui n'en a pas, ou annuler une activation en cours.

## Décision

### Hub de connexion unique pour les applications d'espace
- Domaines : `api.<domaine>` pour Laravel, `auth.<domaine>` pour l'app `apps/auth`, puis `locataire.`, `proprietaire.` et `agence.<domaine>` pour les applications d'espace (ADR 0010).
- Une seule session Sanctum, en cookie HttpOnly sur `SESSION_DOMAIN=.<domaine>`, partagée par le hub et les quatre applications d'espace (locataire, propriétaire, agence, SeBook). Se connecter une fois ouvre les espaces auxquels on a droit (ADR 0003).
- Chaque application renvoie vers `auth.<domaine>/connexion?return_to=…`. `return_to` est vérifié contre une liste blanche côté serveur et côté client.
- Aucun sous-domaine de contenu utilisateur sous `<d>`, et un DNS sans joker (cookie tossing).

### Console : hors du hub, par jeton détenu côté serveur
- La console (`console/`, Next.js) a **sa propre page de connexion** : e-mail, mot de passe et code TOTP, exigés à **chaque** connexion. Pas de Google ni d'Apple.
- Le serveur Next de la console obtient de l'API un **jeton Sanctum opérateur** (`POST /api/v1/console/auth/token`, `throttle:auth`, audité), à durée courte (`CONSOLE_TOKEN_TTL_MINUTES`, 240 par défaut) et à capacité `operator`. Il le garde dans sa session serveur ; le navigateur ne reçoit qu'un cookie HttpOnly, `SameSite=Strict`, limité à l'hôte de la console. La console appelle l'API de serveur à serveur.
- L'API n'accepte sur `/api/v1/console/*` que ce jeton : **une session par cookie y est refusée**, même celle d'un opérateur. Une XSS sur une application d'espace ne peut donc pas atteindre la console avec le cookie partagé.
- La console est servie de préférence sur un **domaine enregistrable distinct** de `<d>` : son cookie devient cross-site par rapport aux applications d'espace. Sinon, sur `console.<d>`, ses routes serveur vérifient l'en-tête `Origin`.
- En local, utiliser des sous-domaines `*.eguardimmo.test` (fichier hosts). Un cookie ne se partage pas entre `localhost:3000` et `localhost:3001` avec un domaine parent.

### Moteur
- **Laravel Fortify** (headless, sans vues) pour la connexion, l'inscription, le mot de passe oublié, la vérification d'e-mail, la 2FA TOTP avec codes de secours et la confirmation de mot de passe. Ses classes d'adaptation vivent dans `app/Modules/Identity/Fortify/` et délèguent à des Actions `handle()`.
- **Laravel Socialite** + `socialiteproviders/apple` pour Google et Apple, côté web.
- **Mobile** : le SDK natif (Google Sign-In, Sign in with Apple) fournit un `id_token`. L'API le vérifie elle-même : signature JWKS en cache, `iss`, `aud`, `exp`, `nonce` pour Apple, `email_verified`. Elle délivre ensuite un jeton Sanctum de 30 jours.

### Inscription
- Google, Apple ou e-mail : inscription libre pour les profils **propriétaire** (bailleur autonome), **agence** et **voyageur** (SeBook, compte sans profil de gestion).
- **Locataire** : uniquement en acceptant une invitation ; Google/Apple sont alors permis. Branché quand le module d'invitations existe.
- Les comptes sans mot de passe sont autorisés (`password` nullable). Ils doivent définir un mot de passe avant d'activer la 2FA, ce qui est obligatoire pour un opérateur.
- Anti-énumération : inscription et mot de passe oublié répondent de la même façon, que l'e-mail existe ou non.
- Tout changement de mot de passe, d'e-mail ou de 2FA révoque les jetons mobiles et les autres sessions.

### Liaison de comptes (anti-prise de contrôle)
- Une identité sociale se clé sur `(provider, sub)`, jamais sur l'e-mail.
- **Liaison automatique** à un compte existant par e-mail : seulement si le fournisseur affirme `email_verified=true` **et** que l'e-mail du compte local est vérifié. Sinon, refus ; l'utilisateur se connecte autrement puis lie Google/Apple depuis son profil.
- **2FA** : une connexion sociale d'un compte à 2FA passe par le défi 2FA.

### Apple
- Le `client_secret` (JWT) est généré à la demande depuis la clé `.p8` : pas de rotation manuelle tous les 6 mois.
- Le nom n'est fourni qu'à la première connexion : il faut l'enregistrer à la création.
- Les adresses relais privées imposent d'enregistrer le domaine d'envoi d'e-mails chez Apple.
- Le rappel web arrive en POST cross-site (`form_post`). Le cookie `SameSite=Lax` n'y est pas envoyé : l'état OAuth est donc porté par un `state` chiffré, à usage unique, **lié au navigateur** par un cookie binder `SameSite=None; Secure` dont le hash figure dans le `state`. Sans binder, un attaquant ferait ouvrir son propre rappel à la victime (CSRF de connexion, prise de contrôle par liaison).
- La liaison d'un compte Google/Apple à un compte existant ne part que d'une requête POST authentifiée, avec ré-authentification récente.
- La suppression de compte depuis l'app (exigence App Store 5.1.1(v)) révoque le jeton Apple. `DELETE /api/v1/me` (décision du 2026-11-14) :
  - elle exige une preuve récente : code 2FA, mot de passe ou `id_token` d'un fournisseur lié (à usage unique), ou une session web confirmée depuis moins de 10 minutes. Avec la 2FA active, le mot de passe ne suffit jamais, même confirmé en session ;
  - limite de débit par compte (`throttle:reauth`), et le verrou de compte s'applique aussi à la confirmation de mot de passe de Fortify ;
  - tout se passe sous verrou de la ligne `users` : une liaison sociale concurrente attend, une seconde suppression ne fait rien ;
  - le compte n'est **jamais effacé** : il est marqué supprimé (`deleted_at`). Son e-mail et le `subject` de ses identités sociales reçoivent le suffixe `-deleted-{id}`, ce qui permet de se réinscrire plus tard avec la même adresse ou le même compte Google ou Apple ;
  - les données du compte sont conservées telles quelles (nom, adresse d'origine lisible avant le suffixe, empreinte du mot de passe, secret 2FA, appareils), par décision du 2026-11-14. La durée de conservation et la réponse à une demande d'effacement RGPD restent à définir ;
  - jetons, sessions, liens de réinitialisation et rôle opérateur sont révoqués, puis `Identity\Events\AccountDeleted` est émis : chaque module décide d'anonymiser ou de conserver selon ses obligations ;
  - la révocation Apple ne bloque jamais la suppression (décision du 2026-11-15) : en cas d'échec (Apple injoignable, refus, configuration `.p8` cassée), le compte est quand même supprimé, l'échec est signalé (`report`, audit `identity.apple.revocation_deferred`) et le jeton reste chiffré sur l'identité. La commande `identity:revoke-deferred-apple-tokens`, planifiée toutes les heures, retente ; elle sort en échec tant qu'il reste un jeton non révoqué.

- Contrat web avec le hub (décision du 2026-11-15) :
  - les e-mails pointent vers les pages du hub : `/mot-de-passe/nouveau?jeton=…&email=…` pour la réinitialisation, `/verification-email/confirmer?jeton=<lien signé de l'API>` pour la vérification. Le hub n'appelle que le lien signé de son propre domaine d'API ;
  - `POST /api/v1/auth/password-reset/status` (`throttle:auth`, public) répond `valid` ou `expired` sans consommer le jeton. Il répond pareil, au même coût de calcul, pour un compte inconnu, un mauvais jeton et un jeton expiré ;
  - `GET /api/v1/me/security` (session requise) donne la 2FA (activée, codes de secours restants sur 8), la présence d'un mot de passe, les comptes Google et Apple liés, les appareils mobiles et la fin de la confirmation récente. Les secrets ne sortent jamais ;
  - l'inscription n'ouvre pas de session : elle répond pareil que l'adresse existe ou non, une session ouverte révélerait l'existence du compte. Le renvoi du lien de vérification demande donc une connexion préalable ; le clic sur le lien n'en demande plus (amendement du 2026-11-16 ci-dessous) ;
  - Fortify ne distingue pas un défi 2FA expiré d'un code faux : les deux répondent 422.

### Vérification de l'e-mail sans session (amendement du 2026-11-16)
- Constat : la route Fortify `verification.verify` exige `auth:web`, or l'inscription n'ouvre aucune session : le lien reçu par e-mail échouait en 401.
- `POST /api/v1/auth/email/verify/{id}/{hash}` (public, `throttle:auth`, nom `identity.email.verify`) : le lien de l'e-mail pointe toujours vers le hub (`/verification-email/confirmer?jeton=<lien signé>`), qui rappelle ce lien signé en POST. Le lien est signé et expire au bout de 60 minutes ; le `hash` est `sha1` de l'adresse.
- Un lien signé détenu prouve la possession de la boîte e-mail : la vérification n'ouvre **aucune session** et ne révèle rien. Signature falsifiée ou expirée, compte inconnu ou supprimé, hash faux, adresse déjà confirmée : même réponse 403 `email_verification_link_invalid`.
- L'adresse est marquée vérifiée et `Illuminate\Auth\Events\Verified` est émis dans la même transaction que la vérification : si un listener échoue, l'adresse reste non vérifiée et le lien reste utilisable. Les listeners de `Verified` sont donc synchrones et atomiques avec elle.
- La route Fortify `verification.verify` (session requise) subsiste pour les anciens e-mails ; elle émet le même événement.
- Le renvoi du lien (`verification.send`) exige toujours une session : un renvoi public demanderait l'adresse e-mail en entrée et son propre limiteur anti-énumération ; il n'est pas ouvert.
- **Option écartée** : ouvrir une session à la vérification. Cela rouvre l'énumération (un lien valide dirait « ce compte existe ») et fait de tout lien intercepté un jeton de connexion.

### Organisation du bailleur autonome (amendement du 2026-11-16, décision de l'utilisateur)
- L'intention d'inscription (`IntendedProfile`) est stockée dans `users.intended_profile` (nullable) à l'inscription par e-mail ou par Google/Apple ; Identity l'expose aux autres modules par `PublicApi\RegistrationIntents`.
- Organizations écoute `Verified` : un compte inscrit comme `individual_landlord` reçoit **automatiquement** une organisation `individual` (nom du compte, pays `FR`, titulaire `owner`). Le prénom est le premier mot du nom du compte, le nom le reste ; un mot seul sert aux deux.
- Idempotent : sous verrou de la ligne `users`, rien n'est créé si le compte est déjà créateur d'une organisation `individual`. Agence, voyageur et comptes sans intention enregistrée ne créent rien.
- Les comptes déjà vérifiés avant ce changement n'ont pas d'intention enregistrée : aucune organisation n'est créée rétroactivement.
- Un compte Google/Apple inscrit comme bailleur est vérifié dès sa création sans événement `Verified` : son organisation n'est pas encore créée automatiquement (à traiter à part).

## Options écartées

- **Keycloak** : un service Java de plus à opérer, thémer et synchroniser, et il remplace Sanctum. Ses avantages (fonctionnement entre domaines différents) ne servent pas tant que tout reste sous un domaine parent.
- **Laravel Passport (OIDC)** : nettement plus de code que le hub Sanctum, et il remplace l'ADR 0002.
- **Pages de connexion dans chaque application** : trois copies du même parcours sensible, et la console dépendrait d'elles.
- **Console dans le hub avec step-up TOTP et contrôle d'`Origin`** (première version de cet ADR) : la session partagée laisse une XSS same-site viser la console, et l'isolement repose sur trois mécanismes à tenir justes ensemble. Un cookie de session à nom différent n'isole rien non plus : le navigateur envoie les cookies selon l'hôte de destination (`api.<d>`), pas selon la page d'origine.
- **Liaison automatique sur e-mail seul** : c'est le schéma classique de pré-prise de contrôle de compte (CVE-2026-53516 sur better-auth).

## Conséquences

- Le hub et les applications d'espace doivent rester sous un même domaine parent ; la console n'en a pas besoin. Si un jour ce n'est plus le cas, il faudra rouvrir cette décision (OIDC).
- Variables d'environnement nouvelles : identifiants Google (web, iOS, Android), Apple (team, key id, `.p8`, services id, bundle id) et liste blanche `AUTH_RETURN_TO_ALLOWED_HOSTS`.
- Actions manuelles hors code : console Google Cloud (écran de consentement, URI de redirection), compte Apple Developer (Services ID, domaines, relais e-mail).

## Amendement du 2026-11-20 (ADR 0036)

- Changement d'adresse e-mail vérifié : `POST /me/email-change` envoie un code à 6 chiffres à la **nouvelle** adresse (haché, 15 minutes, 5 essais, un seul vivant, table `email_change_requests`) ; la confirmation remplace l'adresse, pose `email_verified_at`, révoque les autres sessions et jetons et prévient l'ancienne adresse. Adresse déjà prise : même réponse, aucun code valable, pas d'énumération. Purge quotidienne `identity:purge-email-changes`.
- Téléphone déclaratif : `users.phone` chiffré (E.164), `phone_verified_at` nul, jamais utilisé pour l'authentification (`PUT /me/phone`, `reauthenticated`). Aucun SMS tant qu'aucun fournisseur n'est retenu.

## Amendement du 2026-11-21 (ADR 0037)

- Preuve TOTP (ou code de secours) sur chaque écriture console : middleware `operator-proof`, consommée avant la validation du corps (`operator_proof_required`, `operator_proof_invalid`, verrouillage de compte existant, anti-rejeu).
- Suspension de compte : `users.suspended_at`, refusée au hub, au mobile et à la console (`account_suspended`) ; revue a posteriori par un second opérateur. Réactivation et réinitialisation 2FA par double validation (jetons et sessions révoqués, e-mail de sécurité).
- Effacement d'un compte à la demande RGPD : exécuté par la double validation `privacy.erasure.execute`, jamais par un opérateur seul. La purge des comptes supprimés (question 11) reste à décider.
