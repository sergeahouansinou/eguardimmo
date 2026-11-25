#!/usr/bin/env bash
set -euo pipefail
umask 077

SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=common.sh
. "$SOURCE/scripts/common.sh"

require_root
DEST=/var/backups/eguardimmo
RECIPIENT=$(env_value "$ETC/deploy.env" BACKUP_GPG_RECIPIENT)
REMOTE=$(env_value "$ETC/deploy.env" BACKUP_RCLONE_REMOTE)
RETENTION_DAYS=14
[[ $RECIPIENT =~ ^[A-F0-9]{40}$ ]] ||
  die "BACKUP_GPG_RECIPIENT doit être l'empreinte complète (40 caractères) de la clé publique : aucune sauvegarde sans elle."

STAMP=$(date -u +%Y%m%d%H%M%S)

record() {
  (cd "$BASE/current/backend" && sudo -u eg-api "$PHP_BIN" artisan operations:record-backup "$@")
}

encrypt() {
  gpg --batch --yes --trust-model always --encrypt --recipient "$RECIPIENT" --output "$1"
}

run() {
  local kind=$1 file=$2 started duration
  shift 2
  started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  SECONDS=0
  if "$@" | encrypt "$file" && { [ -z "$REMOTE" ] || rclone copy "$file" "$REMOTE"; }; then
    duration=$SECONDS
    record "$kind" --started="$started" --duration="$duration" --size="$(stat -c %s "$file")" --manifest="$(sha256sum "$file" | cut -d' ' -f1)"
  else
    rm -f "$file"
    record "$kind" --started="$started" --failed
    return 1
  fi
}

# shellcheck disable=SC2329
dump_database() {
  mysqldump --single-transaction --routines --triggers --hex-blob --set-gtid-purged=OFF eguardimmo | gzip
}

# shellcheck disable=SC2329
archive_documents() {
  tar -C "$BASE/shared/storage/app" -czf - documents private
}

status=0
run database "$DEST/database-$STAMP.sql.gz.gpg" dump_database || status=1
run documents "$DEST/documents-$STAMP.tar.gz.gpg" archive_documents || status=1
# Sans les clés de $ETC, les deux sauvegardes précédentes sont illisibles.
configuration=$DEST/configuration-$STAMP.tar.gz.gpg
if ! { tar -C "$(dirname "$ETC")" -czf - "$(basename "$ETC")" | encrypt "$configuration" &&
  { [ -z "$REMOTE" ] || rclone copy "$configuration" "$REMOTE"; }; }; then
  rm -f "$configuration"
  echo "Erreur : la configuration n'a pas été sauvegardée." >&2
  status=1
fi
find "$DEST" -name '*.gpg' -mtime +"$RETENTION_DAYS" -delete
[ -n "$REMOTE" ] || echo "Attention : BACKUP_RCLONE_REMOTE vide, la sauvegarde reste sur ce serveur." >&2
exit "$status"
