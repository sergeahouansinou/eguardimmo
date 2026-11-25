#!/usr/bin/env bash
set -euo pipefail

SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=../scripts/common.sh
. "$SOURCE/scripts/common.sh"

require_root
require_value "$ETC/backend.env" DB_PASSWORD
require_value "$ETC/migrator.env" DB_PASSWORD
APP_PASSWORD=$(env_value "$ETC/backend.env" DB_PASSWORD)
MIGRATOR_PASSWORD=$(env_value "$ETC/migrator.env" DB_PASSWORD)
for password in "$APP_PASSWORD" "$MIGRATOR_PASSWORD"; do
  [[ $password =~ ^[A-Za-z0-9_.-]+$ ]] || die "mot de passe SQL : lettres, chiffres, point, tiret et souligné seulement."
done

mysql <<SQL
CREATE DATABASE IF NOT EXISTS eguardimmo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'eg_migrator'@'localhost' IDENTIFIED BY '$MIGRATOR_PASSWORD';
CREATE USER IF NOT EXISTS 'eg_app'@'localhost' IDENTIFIED BY '$APP_PASSWORD';
GRANT ALL PRIVILEGES ON eguardimmo.* TO 'eg_migrator'@'localhost';
SQL

echo "Base et comptes SQL prêts. Les droits de eg_app sont posés à chaque déploiement, après les migrations."
