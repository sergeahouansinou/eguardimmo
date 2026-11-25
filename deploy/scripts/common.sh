# shellcheck shell=bash
BASE=/srv/eguardimmo
ETC=/etc/eguardimmo
PHP_VERSION=8.4
PHP_BIN=php$PHP_VERSION
APPS=(auth locataire proprietaire agence sebook console vitrine)

port_of() {
  case $1 in
    agence) echo 3010 ;;
    proprietaire) echo 3020 ;;
    locataire) echo 3030 ;;
    auth) echo 3040 ;;
    console) echo 3050 ;;
    sebook) echo 3060 ;;
    vitrine) echo 3070 ;;
    *) return 1 ;;
  esac
}

web_user() {
  echo "eg-web-$1"
}

die() {
  echo "Erreur : $*" >&2
  exit 1
}

# Avant tout chown en root : aucun lien symbolique ne doit détourner le chemin hors de la version.
require_real_path() {
  [ "$(realpath -m -- "$1")" = "$1" ] || die "chemin détourné par un lien symbolique : $1"
}

seal_release() {
  require_real_path "$1"
  chown -R root:root "$1"
  chmod -R u-s,g-s,go-w "$1"
}

hand_over() {
  require_real_path "$1"
  mkdir -p -- "$1"
  chown -R "$2:$2" "$1"
  chmod 0700 "$1"
}

require_root() {
  [ "$(id -u)" -eq 0 ] || die "à lancer avec sudo."
}

env_value() {
  sed -n "s/^$2=//p" "$1" | head -n 1
}

require_value() {
  [ -n "$(env_value "$1" "$2")" ] || die "$2 est vide dans $1."
}

switch_current() {
  ln -sfn "$1" "$BASE/current.new"
  mv -T "$BASE/current.new" "$BASE/current"
}

restart_services() {
  systemctl reload "php$PHP_VERSION-fpm"
  systemctl enable --quiet eguardimmo-queue
  systemctl restart eguardimmo-queue
  local app
  for app in "${APPS[@]}"; do
    systemctl enable --quiet "eguardimmo-web@$app"
    systemctl restart "eguardimmo-web@$app"
  done
}

check_health() {
  local app code failed=0
  curl --fail --silent --show-error --output /dev/null --retry 10 --retry-delay 3 --retry-all-errors "$1/up" || {
    echo "API injoignable : $1/up" >&2
    failed=1
  }
  for app in "${APPS[@]}"; do
    code=$(curl --silent --output /dev/null --write-out '%{http_code}' --retry 15 --retry-delay 2 --retry-connrefused "http://127.0.0.1:$(port_of "$app")/") || true
    if [[ ! $code =~ ^[23] ]]; then
      echo "Application $app : réponse $code (journal : journalctl -u eguardimmo-web@$app)" >&2
      failed=1
    fi
  done
  systemctl is-active --quiet eguardimmo-queue || {
    echo "File d'attente arrêtée : journalctl -u eguardimmo-queue" >&2
    failed=1
  }
  return "$failed"
}
