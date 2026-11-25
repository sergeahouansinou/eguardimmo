#!/usr/bin/env bash
set -euo pipefail

# Droits table par table : un droit posé sur toute la base ne pourrait plus être retiré de audit_logs (ADR 0016).
DATABASE=eguardimmo
ACCOUNT="'eg_app'@'localhost'"

query() {
  mysql --batch --skip-column-names --execute "$1"
}

tables=$(query "SELECT table_name FROM information_schema.tables WHERE table_schema = '$DATABASE' ORDER BY table_name")
grep -qx audit_logs <<<"$tables" || {
  echo "Erreur : table audit_logs absente de $DATABASE, droits non posés." >&2
  exit 1
}

if grep -qvE '^[A-Za-z0-9_]{1,64}$' <<<"$tables"; then
  echo "Erreur : nom de table inattendu dans $DATABASE, droits non posés." >&2
  exit 1
fi

while read -r table; do
  if [ "$table" = audit_logs ]; then
    echo "GRANT SELECT, INSERT ON \`$DATABASE\`.\`$table\` TO $ACCOUNT;"
  else
    echo "GRANT SELECT, INSERT, UPDATE, DELETE ON \`$DATABASE\`.\`$table\` TO $ACCOUNT;"
  fi
done <<<"$tables" | mysql

echo "Droits de eg_app à jour sur $(wc -l <<<"$tables" | tr -d ' ') tables."
