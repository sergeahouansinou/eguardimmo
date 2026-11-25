import 'dart:math';

import '../services/api_exception.dart';

abstract final class IdempotencyKey() {
  static final Random _random = Random.secure();

  /// Refus définitif du serveur (4xx hors 408 et 429) : la demande n'a pas été
  /// traitée, un nouvel essai est une nouvelle demande. Réseau, délai, 5xx,
  /// 408 et 429 laissent le résultat incertain : on rejoue avec la même clé.
  static bool isDefinitiveRefusal(ApiException error) {
    final status = error.statusCode;
    return status != null &&
        status >= 400 &&
        status < 500 &&
        status != 408 &&
        status != 429;
  }

  static String generate() {
    final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }
}
