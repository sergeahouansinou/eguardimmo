#!/usr/bin/env bash
set -euo pipefail
umask 022

SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=common.sh
. "$SOURCE/scripts/common.sh"

require_root
[ $# -eq 1 ] || die "usage : release.sh <branche|tag|commit>"
REF=$1
[[ $REF =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || die "référence git invalide."

exec 9>/run/eguardimmo-release.lock
flock -n 9 || die "un déploiement est déjà en cours."

preflight() {
  local file key app
  for file in "$ETC/deploy.env" "$ETC/backend.env" "$ETC/migrator.env"; do
    [ -s "$file" ] || die "$file manquant."
  done
  for app in "${APPS[@]}"; do
    [ -s "$ETC/build/$app.env" ] || die "$ETC/build/$app.env manquant."
    require_value "$ETC/runtime/$app.env" PORT
  done
  if grep -rlE '__[A-Z_]+__' "$ETC"; then die "des valeurs __…__ restent à remplacer dans les fichiers ci-dessus."; fi
  require_value "$ETC/deploy.env" REPO_URL
  require_value "$ETC/deploy.env" API_URL
  for key in APP_KEY DB_PASSWORD AUDIT_HMAC_KEY PARTIES_HMAC_KEY BANKING_HMAC_KEY MAIL_UNSUBSCRIBE_KEY CONSOLE_RELAY_KEY SEBOOK_RELAY_KEY; do
    require_value "$ETC/backend.env" "$key"
  done
  if [ "$(env_value "$ETC/backend.env" MAIL_MAILER)" = mailtrap_transactional ]; then
    require_value "$ETC/backend.env" MAILTRAP_TRANSACTIONAL_PASSWORD
  fi
  require_value "$ETC/runtime/console.env" CONSOLE_SESSION_SECRET
  [ "$(env_value "$ETC/runtime/console.env" CONSOLE_RELAY_KEY)" = "$(env_value "$ETC/backend.env" CONSOLE_RELAY_KEY)" ] ||
    die "CONSOLE_RELAY_KEY diffère entre l'API et la console."
  key=$(env_value "$ETC/backend.env" SEBOOK_RELAY_KEY)
  # L'API ignore sans erreur une clé plus courte : tous les visiteurs de SeBook partageraient une seule limite.
  [ "${#key}" -ge 32 ] || die "SEBOOK_RELAY_KEY doit faire au moins 32 caractères."
  [ "$(env_value "$ETC/runtime/sebook.env" SEBOOK_RELAY_KEY)" = "$key" ] ||
    die "SEBOOK_RELAY_KEY diffère entre l'API et SeBook."
  key=$(env_value "$ETC/deploy.env" API_URL)
  key=${key#https://}
  awk -v host="${key%%/*}" '$1 == "127.0.0.1" { for (i = 2; i <= NF; i++) if ($i == host) found = 1 } END { exit !found }' /etc/hosts ||
    die "${key%%/*} doit pointer sur 127.0.0.1 dans /etc/hosts, sinon Nginx refuse la console et efface les en-têtes de SeBook."
  [ -f /etc/nginx/eguardimmo/console-allow.conf ] || die "/etc/nginx/eguardimmo/console-allow.conf manquant."
  systemctl is-active --quiet mysql || die "MySQL est arrêté."
  systemctl is-active --quiet clamav-daemon || die "ClamAV est arrêté."
  curl --fail --silent --output /dev/null http://127.0.0.1:3000/health || die "Gotenberg ne répond pas sur 127.0.0.1:3000."
}

preflight
REPO_URL=$(env_value "$ETC/deploy.env" REPO_URL)
API_URL=$(env_value "$ETC/deploy.env" API_URL)

as_deploy() {
  sudo -u eg-deploy -H "$@"
}

if [ ! -f "$BASE/repo.git/HEAD" ]; then
  as_deploy git clone --mirror -- "$REPO_URL" "$BASE/repo.git"
fi
as_deploy git --git-dir="$BASE/repo.git" fetch --prune origin
SHA=$(as_deploy git --git-dir="$BASE/repo.git" rev-parse --verify "$REF^{commit}")
RELEASE=$BASE/releases/$(date -u +%Y%m%d%H%M%S)-${SHA:0:8}

echo "== Version $SHA"
install -d -m 0755 -o eg-deploy -g eg-deploy "$RELEASE"
as_deploy git --git-dir="$BASE/repo.git" archive "$SHA" | as_deploy tar -x -C "$RELEASE"
as_deploy rm -rf "$RELEASE/backend/storage"
as_deploy ln -s "$BASE/shared/storage" "$RELEASE/backend/storage"

echo "== Dépendances de l'API"
(cd "$RELEASE/backend" && as_deploy composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader)

echo "== Applications web"
for app in "${APPS[@]}"; do
  as_deploy ln -s "$ETC/build/$app.env" "$RELEASE/apps/$app/.env.production.local"
done
(cd "$RELEASE" && as_deploy pnpm install --frozen-lockfile --ignore-scripts --package-import-method=copy)
for app in "${APPS[@]}"; do
  (cd "$RELEASE" && as_deploy env NEXT_TELEMETRY_DISABLED=1 pnpm --filter "@eguardimmo/$app" build)
done

# Le build exécute du code tiers : plus aucun processus ni droit de eg-deploy sur la version ensuite.
pkill -KILL -u eg-deploy || [ $? -eq 1 ]
seal_release "$RELEASE"
require_real_path "$RELEASE/backend"
ln -sfnT "$ETC/backend.env" "$RELEASE/backend/.env"
for app in "${APPS[@]}"; do
  hand_over "$RELEASE/apps/$app/.next/cache" "$(web_user "$app")"
done

artisan() {
  (cd "$RELEASE/backend" && sudo -u eg-api "$PHP_BIN" artisan "$@")
}

echo "== Base de données"
# eg-migrate seul reçoit le mot de passe du migrateur ; bootstrap/cache reste à root tant qu'il tourne.
(
  DB_USERNAME=$(env_value "$ETC/migrator.env" DB_USERNAME)
  DB_PASSWORD=$(env_value "$ETC/migrator.env" DB_PASSWORD)
  LOG_CHANNEL=stderr
  export DB_USERNAME DB_PASSWORD LOG_CHANNEL
  cd "$RELEASE/backend"
  sudo --preserve-env=DB_USERNAME,DB_PASSWORD,LOG_CHANNEL -u eg-migrate "$PHP_BIN" artisan migrate --force
)
"$SOURCE/mysql/grants.sh"
# Le cache de configuration contient tous les secrets : lisible par eg-api seul.
hand_over "$RELEASE/backend/bootstrap/cache" eg-api
artisan db:seed --force
artisan optimize

echo "== Bascule"
PREVIOUS=$(readlink "$BASE/current" || true)
switch_current "$RELEASE"
restart_services

if ! check_health "$API_URL"; then
  [ -z "$PREVIOUS" ] || echo "Retour arrière : $SOURCE/scripts/rollback.sh $(basename "$PREVIOUS")" >&2
  die "la version est en ligne mais les contrôles échouent."
fi

CURRENT=$(readlink "$BASE/current")
kept=0
while read -r old; do
  [ "$old" != "$CURRENT" ] || continue
  # Une version sans cache de configuration n'a jamais été en ligne ; deux anciennes suffisent au retour arrière.
  if [ -f "$old/backend/bootstrap/cache/config.php" ] && [ "$kept" -lt 2 ]; then
    kept=$((kept + 1))
  else
    rm -rf -- "$old"
  fi
done < <(find "$BASE/releases" -mindepth 1 -maxdepth 1 -type d | sort -r)

echo "Version $SHA en ligne."
