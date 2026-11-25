import 'package:flutter/foundation.dart';

import '../../../core/services/api_exception.dart';
import '../../../core/services/app_logger.dart';
import '../services/marketplace_service.dart';

class VisitRequestViewModel(
  final MarketplaceService _service,
  final String ref, {
  final AppLogger _logger = const AppLogger(),
}) extends ChangeNotifier {
  static const slotMaxLength = 120;
  static const messageMaxLength = 1000;
  static const _genericFailure =
      'La demande n’a pas pu être envoyée. Réessayez dans un instant.';

  bool _busy = false;
  bool _sent = false;
  bool _disposed = false;
  String? _error;

  bool get busy => _busy;
  bool get sent => _sent;
  String? get error => _error;

  Future<void> submit({required String slot, required String message}) async {
    if (_busy) return;
    _busy = true;
    _error = null;
    _notify();
    try {
      await _service.requestVisit(
        ref,
        slot: slot.trim(),
        message: message.trim(),
      );
      _sent = true;
    } on ApiException catch (error) {
      _error = error.isRateLimited && error.retryAfterSeconds != null
          ? '${error.message} Réessayez dans ${error.retryAfterSeconds} s.'
          : error.message;
    } on Exception catch (error, stack) {
      _logger.error('Demande de visite impossible', error: error, stack: stack);
      _error = _genericFailure;
    } finally {
      _busy = false;
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
