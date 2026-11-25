#!/usr/bin/env bash
set -euo pipefail

SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=common.sh
. "$SOURCE/scripts/common.sh"

require_root
[ $# -eq 3 ] || die "usage : install.sh <domaine> <hôte-console> <hôte-vitrine>"
DOMAIN=$1
CONSOLE_HOST=$2
SITE_HOST=$3
for host in "$DOMAIN" "$CONSOLE_HOST" "$SITE_HOST"; do
  [[ $host =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || die "nom d'hôte invalide : $host"
done

for dir in /etc/nginx/conf.d /etc/nginx/snippets "/etc/php/$PHP_VERSION/fpm/pool.d" /etc/mysql/mysql.conf.d /etc/cron.d /etc/systemd/system; do
  [ -d "$dir" ] || die "$dir absent : installer d'abord les paquets (README, étape 2)."
done

render() {
  sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__CONSOLE_HOST__/$CONSOLE_HOST/g" -e "s/__SITE_HOST__/$SITE_HOST/g" "$1"
}

# Un fichier déjà en place n'est jamais réécrit : il porte des secrets ou les ajouts de certbot.
place() {
  local source=$1 target=$2 mode=$3 owner=$4
  if [ -e "$target" ]; then
    echo "conservé : $target"
    return
  fi
  (umask 077 && render "$source" >"$target")
  chown "$owner" "$target"
  chmod "$mode" "$target"
  echo "créé     : $target"
}

set_if_empty() {
  sed -i "s|^$2=\$|$2=$3|" "$1"
}

secret() {
  openssl rand -base64 32
}

database_password() {
  echo "$(openssl rand -hex 24)Aa1-"
}

service_user() {
  id -u "$1" >/dev/null 2>&1 || useradd --system --user-group --no-create-home --shell /usr/sbin/nologin "$1"
}

id -u eg-deploy >/dev/null 2>&1 || useradd --system --user-group --create-home --home-dir /var/lib/eg-deploy --shell /usr/sbin/nologin eg-deploy
service_user eg-api
id -u eg-migrate >/dev/null 2>&1 || useradd --system --user-group --groups eg-api --no-create-home --shell /usr/sbin/nologin eg-migrate
for app in "${APPS[@]}"; do
  service_user "$(web_user "$app")"
done
# eg-deploy exécute du code tiers pendant les builds : il ne doit rien pouvoir programmer.
grep -qxF eg-deploy /etc/cron.deny 2>/dev/null || echo eg-deploy >>/etc/cron.deny
# Créer at.deny là où il manque ouvrirait « at » à tous les comptes.
if [ -f /etc/at.deny ]; then
  grep -qxF eg-deploy /etc/at.deny || echo eg-deploy >>/etc/at.deny
fi

install -d -m 0755 "$BASE" "$BASE/shared" "$BASE/releases" "$ETC" "$ETC/build" /etc/nginx/eguardimmo
install -d -m 0755 -o eg-deploy -g eg-deploy "$BASE/repo.git"
install -d -m 0750 -o eg-api -g eg-api "$BASE/shared/storage" \
  "$BASE/shared/storage/app" "$BASE/shared/storage/app/private" "$BASE/shared/storage/app/public" "$BASE/shared/storage/app/documents" \
  "$BASE/shared/storage/framework" "$BASE/shared/storage/framework/cache" "$BASE/shared/storage/framework/cache/data" \
  "$BASE/shared/storage/framework/sessions" "$BASE/shared/storage/framework/views" "$BASE/shared/storage/logs"
install -d -m 0700 "$ETC/runtime" /var/backups/eguardimmo

place "$SOURCE/env/deploy.env.example" "$ETC/deploy.env" 0600 root:root
place "$SOURCE/env/backend.env.example" "$ETC/backend.env" 0640 root:eg-api
for app in "${APPS[@]}"; do
  place "$SOURCE/env/build/$app.env.example" "$ETC/build/$app.env" 0644 root:root
  template=$SOURCE/env/runtime/$app.env.example
  if [ -f "$template" ]; then
    place "$template" "$ETC/runtime/$app.env" 0600 root:root
  elif [ ! -e "$ETC/runtime/$app.env" ]; then
    echo "PORT=$(port_of "$app")" >"$ETC/runtime/$app.env"
    chmod 0600 "$ETC/runtime/$app.env"
  fi
done

if [ ! -e "$ETC/migrator.env" ]; then
  (umask 077 && printf 'DB_USERNAME=eg_migrator\nDB_PASSWORD=%s\n' "$(database_password)" >"$ETC/migrator.env")
fi

set_if_empty "$ETC/backend.env" APP_KEY "base64:$(secret)"
set_if_empty "$ETC/backend.env" DB_PASSWORD "$(database_password)"
for key in AUDIT_HMAC_KEY PARTIES_HMAC_KEY BANKING_HMAC_KEY MAIL_UNSUBSCRIBE_KEY CONSOLE_RELAY_KEY; do
  set_if_empty "$ETC/backend.env" "$key" "$(secret)"
done
set_if_empty "$ETC/runtime/console.env" CONSOLE_SESSION_SECRET "$(secret)"
set_if_empty "$ETC/runtime/console.env" CONSOLE_RELAY_KEY "$(env_value "$ETC/backend.env" CONSOLE_RELAY_KEY)"

place "$SOURCE/nginx/console-allow.conf" /etc/nginx/eguardimmo/console-allow.conf 0644 root:root
# L'API ne sert /api/v1/console qu'à ce serveur : son nom doit s'y résoudre sur la boucle locale.
grep -qxF "127.0.0.1 api.$DOMAIN" /etc/hosts || echo "127.0.0.1 api.$DOMAIN" >>/etc/hosts

place "$SOURCE/nginx/eguardimmo.conf" /etc/nginx/conf.d/eguardimmo.conf 0644 root:root
place "$SOURCE/nginx/proxy.conf" /etc/nginx/snippets/eguardimmo-proxy.conf 0644 root:root
place "$SOURCE/php/eguardimmo.conf" "/etc/php/$PHP_VERSION/fpm/pool.d/eguardimmo.conf" 0644 root:root
place "$SOURCE/mysql/eguardimmo.cnf" /etc/mysql/mysql.conf.d/eguardimmo.cnf 0644 root:root
place "$SOURCE/systemd/eguardimmo-web@.service" /etc/systemd/system/eguardimmo-web@.service 0644 root:root
place "$SOURCE/systemd/eguardimmo-queue.service" /etc/systemd/system/eguardimmo-queue.service 0644 root:root
place "$SOURCE/cron/eguardimmo" /etc/cron.d/eguardimmo 0644 root:root

# Les scripts lancés en root vivent hors des versions déployées, que eg-deploy peut écrire.
if [ "$SOURCE" != /opt/eguardimmo/deploy ]; then
  install -d -m 0755 /opt/eguardimmo
  rm -rf /opt/eguardimmo/deploy
  cp -R "$SOURCE" /opt/eguardimmo/deploy
  chown -R root:root /opt/eguardimmo/deploy
  chmod -R go-w /opt/eguardimmo/deploy
  chmod 0755 /opt/eguardimmo/deploy/scripts/*.sh /opt/eguardimmo/deploy/mysql/*.sh
fi

systemctl daemon-reload

cat <<EOF

Installation terminée. Reste à faire :
  1. compléter $ETC/deploy.env et $ETC/backend.env (e-mail) ;
  2. redémarrer MySQL puis lancer /opt/eguardimmo/deploy/mysql/setup.sh ;
  3. autoriser votre adresse IP dans /etc/nginx/eguardimmo/console-allow.conf ;
  4. suivre le README à partir de l'étape 5.
Sauvegarder maintenant $ETC dans un coffre : sans APP_KEY, les données chiffrées sont perdues.
EOF
