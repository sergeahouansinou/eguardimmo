#!/usr/bin/env bash
set -euo pipefail

SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=common.sh
. "$SOURCE/scripts/common.sh"

require_root
if [ $# -ne 1 ]; then
  echo "Version active : $(basename "$(readlink "$BASE/current")")"
  ls -1r "$BASE/releases"
  die "usage : rollback.sh <version>"
fi
[[ $1 =~ ^[0-9]{14}-[0-9a-f]{8}$ ]] || die "version invalide."
TARGET=$BASE/releases/$1
[ -f "$TARGET/backend/bootstrap/cache/config.php" ] || die "version absente ou jamais mise en ligne : $1"

exec 9>/run/eguardimmo-release.lock
flock -n 9 || die "un déploiement est déjà en cours."

switch_current "$TARGET"
restart_services
check_health "$(env_value "$ETC/deploy.env" API_URL)" || die "les contrôles échouent après le retour arrière."
echo "Version $1 en ligne. La base de données n'a pas été ramenée en arrière."
