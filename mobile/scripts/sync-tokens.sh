#!/usr/bin/env bash
# Recopie les jetons de design générés (ADR 0012) dans l'application Flutter.
# Source unique : packages/tokens (pnpm --filter @eguardimmo/tokens build, puis ce script).
set -euo pipefail

racine="$(cd "$(dirname "$0")/../.." && pwd)"
source_dart="$racine/packages/tokens/generated/tokens.dart"
cible="$racine/mobile/lib/core/theme/tokens.dart"

if [ ! -f "$source_dart" ]; then
  echo "Introuvable : $source_dart (lancer « pnpm --filter @eguardimmo/tokens build »)." >&2
  exit 1
fi

cp "$source_dart" "$cible"
dart format "$cible" >/dev/null
echo "Jetons copiés vers mobile/lib/core/theme/tokens.dart"
