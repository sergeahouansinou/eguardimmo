import '../services/api_exception.dart';

/// Texte d'une erreur serveur pour l'utilisateur. Le 429 annonce l'attente
/// donnée par `Retry-After` ; tout autre statut garde le message du serveur.
abstract final class ApiErrorText() {
  static const _genericRateLimit = 'too_many_requests';

  static String of(ApiException error) {
    if (!error.isRateLimited) return error.message;
    final base = error.code == _genericRateLimit
        ? 'Trop de requêtes envoyées.'
        : error.message;
    final wait = error.retryAfterSeconds;
    if (wait == null || wait <= 0) return base;
    return '${_sentence(base)} Réessayez dans ${waitLabel(wait)}.';
  }

  static String waitLabel(int seconds) {
    if (seconds < 60) return '$seconds s';
    if (seconds < 3600) return '${(seconds / 60).ceil()} min';
    return '${(seconds / 3600).ceil()} h';
  }

  static String _sentence(String text) {
    final trimmed = text.trim();
    return RegExp(r'[.!?]$').hasMatch(trimmed) ? trimmed : '$trimmed.';
  }
}
