import 'package:flutter/foundation.dart';

import '../services/api_exception.dart';
import '../utils/api_error_text.dart';
import '../utils/idempotency_key.dart';
import 'async_view_model.dart';

sealed class const WriteResult();

final class const WriteDone() extends WriteResult;

final class const WriteIgnored() extends WriteResult;

final class const WriteRefused(
  final String message, {
  final int? status,
  final Map<String, List<String>> fieldErrors = const {},
}) extends WriteResult;

/// Écriture protégée contre la double soumission, avec une Idempotency-Key
/// propre à chaque demande. La clé survit aux échecs incertains (réseau,
/// délai, 5xx, 408, 429) tant que la demande est identique ; elle change après
/// un refus définitif du serveur, un succès ou une demande différente.
mixin IdempotentWrites<T> on AsyncViewModel<T> {
  bool _busy = false;
  String _key = IdempotencyKey.generate();
  String? _fingerprint;

  bool get busy => _busy;

  @protected
  Future<WriteResult> write(
    String fingerprint,
    Future<void> Function(String key) send,
  ) async {
    if (_busy) return const WriteIgnored();
    if (fingerprint != _fingerprint) {
      _key = IdempotencyKey.generate();
      _fingerprint = fingerprint;
    }
    _busy = true;
    notifySafely();
    try {
      await send(_key);
      _rotate();
      return const WriteDone();
    } on ApiException catch (error) {
      if (IdempotencyKey.isDefinitiveRefusal(error)) _rotate();
      return WriteRefused(
        ApiErrorText.of(error),
        status: error.statusCode,
        fieldErrors: error.fieldErrors,
      );
    } on Exception catch (error, stack) {
      logger.error('Écriture impossible', error: error, stack: stack);
      return const WriteRefused(AsyncViewModel.genericFailure);
    } finally {
      _busy = false;
      notifySafely();
    }
  }

  void _rotate() {
    _key = IdempotencyKey.generate();
    _fingerprint = null;
  }
}
