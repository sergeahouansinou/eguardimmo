# Déploiement sur un seul serveur

API Laravel, 7 applications Next.js et leurs services sur un VPS. Aucune donnée de l'ancienne application n'est reprise ici (ADR 0009).

| Élément | Où |
|---|---|
| Versions déployées | `/srv/eguardimmo/releases`, version active : `current` |
| Documents et journaux de l'API | `/srv/eguardimmo/shared/storage` |
| Configuration et secrets | `/etc/eguardimmo` (jamais dans git) |
| Scripts lancés en root | `/opt/eguardimmo/deploy` |
| Comptes | `eg-deploy` (construit), `eg-api` (PHP), `eg-migrate` (migrations), `eg-web-<application>` (un par application Next.js) |

Ports internes (`127.0.0.1`) : agence 3010, proprietaire 3020, locataire 3030, auth 3040, console 3050, sebook 3060, vitrine 3070, Gotenberg 3000.

## 1. Serveur

- Serveur **dédié**, en Union européenne, Ubuntu 24.04 LTS.
- Estimation à ajuster : 4 vCPU, 8 Go de RAM avec 4 Go de swap (16 Go confortable), 80 Go SSD. Les builds successifs ont culminé vers 2 Go sur un poste macOS ; ClamAV et MySQL s'y ajoutent.
- Connexion SSH par clé vérifiée, puis `PasswordAuthentication no` et `PermitRootLogin no`.

```bash
sudo ufw allow OpenSSH
```

```bash
sudo ufw allow http && sudo ufw allow https && sudo ufw enable
```

```bash
sudo apt update && sudo apt install -y unattended-upgrades
```

## 2. Paquets

PHP 8.4 vient du dépôt `ppa:ondrej/php` :

```bash
sudo add-apt-repository -y ppa:ondrej/php
```

```bash
sudo apt install -y php8.4-fpm php8.4-cli php8.4-mysql php8.4-mbstring php8.4-xml php8.4-curl php8.4-zip php8.4-gd php8.4-bcmath php8.4-intl
```

```bash
sudo apt install -y nginx certbot python3-certbot-nginx clamav-daemon clamav-freshclam docker.io docker-compose-v2 git unzip gnupg rclone cron openssl
```

À installer depuis leurs dépôts officiels (la version d'Ubuntu ne convient pas) :

- **MySQL 8.4 LTS** : dépôt APT MySQL, <https://dev.mysql.com/downloads/repo/apt/>
- **Node.js 22 ou plus** : <https://github.com/nodesource/distributions> (le binaire doit être `/usr/bin/node`)
- **Composer** : <https://getcomposer.org/download/>, installé dans `/usr/local/bin/composer`

```bash
sudo npm install -g pnpm@9.12.0
```

Vérifier : `php -v` (8.4), `mysql --version` (8.4), `node -v`, `pnpm -v`, `composer --version`.

## 3. Installation

Depuis le poste de travail :

```bash
scp -r deploy utilisateur@serveur:
```

Sur le serveur, avec le domaine, l'hôte de la console et celui de la vitrine :

```bash
sudo bash deploy/scripts/install.sh exemple.fr console.exemple.fr www.exemple.fr
```

Le script crée les comptes et les dossiers, génère clés et mots de passe, et ne réécrit jamais un fichier existant.

- Le cookie de session est posé sur `.<domaine>` : **tous** les sous-domaines le reçoivent. Ne pas réutiliser un domaine qui héberge d'autres applications.
- La console est de préférence sur un autre domaine enregistrable (ADR 0004).
- La vitrine à la racine du domaine imposerait HTTPS à tous les sous-domaines (HSTS `includeSubDomains; preload`).

Compléter ensuite :

| Fichier | À renseigner |
|---|---|
| `/etc/eguardimmo/deploy.env` | `REPO_URL`, destinataire et destination des sauvegardes |
| `/etc/eguardimmo/backend.env` | `MAILTRAP_TRANSACTIONAL_PASSWORD`, `MAIL_FROM_ADDRESS`, adresses d'équipe |
| `/etc/eguardimmo/build/vitrine.env` | e-mail de contact, tarifs validés |
| `/etc/eguardimmo/runtime/vitrine.env` | webhook du formulaire de contact |

**Copier `/etc/eguardimmo` dans un coffre** : sans `APP_KEY`, les données chiffrées sont perdues.

## 4. Services

```bash
sudo systemctl restart mysql && sudo /opt/eguardimmo/deploy/mysql/setup.sh
```

```bash
sudo systemctl enable --now clamav-freshclam clamav-daemon
```

ClamAV ne démarre qu'après le premier téléchargement des signatures (quelques minutes).

```bash
sudo docker compose -f /opt/eguardimmo/deploy/gotenberg/compose.yaml up -d
```

Gotenberg n'a pas d'authentification. Vérifier que Docker est en version 28 ou plus (avant, un port publié sur `127.0.0.1` restait joignable depuis le réseau local) :

```bash
sudo docker version --format '{{.Server.Version}}'
```

Puis figer l'image : relever son empreinte et la reporter dans `compose.yaml` (`gotenberg/gotenberg@sha256:…`), ici et dans le dépôt.

```bash
sudo docker image inspect --format '{{index .RepoDigests 0}}' gotenberg/gotenberg:8
```

```bash
sudo systemctl restart php8.4-fpm
```

## 5. Accès au dépôt

Clé de déploiement **en lecture seule** (GitHub : Settings, Deploy keys) :

```bash
sudo -u eg-deploy -H ssh-keygen -t ed25519 -N "" -f /var/lib/eg-deploy/.ssh/id_ed25519
```

```bash
sudo cat /var/lib/eg-deploy/.ssh/id_ed25519.pub
```

Première connexion, en comparant l'empreinte avec celle publiée par GitHub :

```bash
sudo -u eg-deploy -H ssh -T git@github.com
```

## 6. DNS et HTTPS

Enregistrements A vers le serveur, sans joker : `api`, `auth`, `locataire`, `proprietaire`, `agence`, `sebook`, la console et la vitrine. Chez Cloudflare : « DNS only ». Pas d'enregistrement AAAA tant que l'API compte les limites par adresse IPv6 complète : une seule plage les contournerait.

La console est **fermée par défaut**. Autoriser les adresses des opérateurs, au-dessus de `deny all;`, dans `/etc/nginx/eguardimmo/console-allow.conf` :

```
allow 203.0.113.10;
deny all;
```

Les routes `/api/v1/console` ne répondent qu'au serveur lui-même : `install.sh` ajoute pour cela `127.0.0.1 api.<domaine>` à `/etc/hosts`. Si l'hébergeur régénère ce fichier au démarrage (`manage_etc_hosts` de cloud-init), le désactiver.

Retirer le site par défaut de Nginx, puis vérifier et recharger :

```bash
sudo rm /etc/nginx/sites-enabled/default
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Un seul certificat pour les huit noms (adapter les noms) :

```bash
sudo certbot --nginx --redirect -d api.exemple.fr -d auth.exemple.fr -d locataire.exemple.fr -d proprietaire.exemple.fr -d agence.exemple.fr -d sebook.exemple.fr -d console.exemple.fr -d www.exemple.fr
```

## 7. Mise en ligne

Le serveur construit ce qui est **sur GitHub** : les changements locaux doivent être commités et poussés. Le dépôt est public : protéger la branche `main`, et déployer un commit relu, désigné par son empreinte complète.

```bash
sudo /opt/eguardimmo/deploy/scripts/release.sh <empreinte-du-commit>
```

Le script contrôle la configuration, construit la version à côté de l'ancienne, la repasse à root, migre, pose les droits SQL, bascule, redémarre et vérifie chaque service. Les scripts d'installation des paquets npm ne sont pas exécutés. Les applications sont indisponibles quelques secondes au redémarrage ; les migrations s'appliquent pendant que l'ancienne version tourne encore.

## 8. Premier opérateur

Créer le compte sur l'application de connexion, confirmer l'e-mail, puis :

```bash
cd /srv/eguardimmo/current/backend && sudo -u eg-api php8.4 artisan identity:grant-operator vous@exemple.fr --role=admin
```

La commande affiche la clé de double authentification et attend un code.

## 9. Sauvegardes

Importer la clé **publique** GPG (la clé privée reste hors du serveur), reporter son empreinte dans `BACKUP_GPG_RECIPIENT`, puis lancer une première sauvegarde :

```bash
sudo gpg --import cle-publique.asc
```

```bash
sudo gpg --list-keys --fingerprint
```

```bash
sudo /opt/eguardimmo/deploy/scripts/backup.sh
```

Elle tourne ensuite chaque nuit : base, documents et `/etc/eguardimmo`, chiffrés. La purge à 14 jours ne concerne que le serveur. Sur la destination distante, régler une expiration automatique (effacements RGPD), le verrouillage des objets, et donner au serveur une clé qui ne peut qu'écrire.

Une sauvegarde n'est acquise qu'après un **test de restauration**, à consigner :

```bash
cd /srv/eguardimmo/current/backend && sudo -u eg-api php8.4 artisan operations:record-backup restore_test --target=preproduction --result=passed
```

## Exploitation

| Besoin | Commande |
|---|---|
| Mettre à jour | `sudo /opt/eguardimmo/deploy/scripts/release.sh <empreinte-du-commit>` |
| Revenir en arrière (code seul) | `sudo /opt/eguardimmo/deploy/scripts/rollback.sh` |
| Journal d'une application | `journalctl -u eguardimmo-web@auth` |
| Journal de la file | `journalctl -u eguardimmo-queue` |
| Journaux de l'API | `/srv/eguardimmo/shared/storage/logs` |

Toujours lancer `artisan` avec `sudo -u eg-api` : lancé en root, il crée des fichiers que l'API ne peut plus écrire.

Après modification d'un fichier de `/etc/eguardimmo`, relancer `release.sh` : la configuration de l'API est mise en cache et les variables `NEXT_PUBLIC_*` sont figées au build.

Après modification du dossier `deploy/`, le recopier sur le serveur et relancer `install.sh` (les fichiers déjà en place dans `/etc` sont conservés : les reporter à la main).

## Limites connues

- SeBook lit l'API depuis le serveur : toutes ses lectures publiques partagent la limite de 60 requêtes par minute d'une seule adresse IP. Un seul visiteur insistant peut donc priver SeBook de ses annonces : à corriger avant l'ouverture au public.
- La limitation de la console tient à Nginx (liste d'adresses, routes de l'API réservées au serveur) ; l'API elle-même n'exige pas la clé de relais.
- Sur `api` et `auth`, le journal d'erreurs de Nginx ne garde que les pannes graves : chercher les 502 dans le journal d'accès, `journalctl` et les journaux de l'API.
- Aucune page `/a-propos` n'existe, et `/conditions` n'est servie que par SeBook : liens légaux masqués tant que `NEXT_PUBLIC_LEGAL_BASE_URL` est vide.
- Paiement en ligne désactivé (`PAYMENTS_GATEWAY=none`), diffusions désactivées (`MAIL_PROVIDER` vide).
- Relevés bancaires XML : fournir les schémas (`BANKING_XSD_DIRECTORY`).
- ADR 0026 : ne pas ouvrir le congé du locataire avant la régénération des échéances.
