import 'package:flutter/foundation.dart';

import '../../../core/services/api_exception.dart';
import '../../../core/services/app_logger.dart';
import '../../../core/state/async_view_model.dart';
import '../../../core/utils/api_error_text.dart';
import '../../../core/utils/idempotency_key.dart';
import '../../profiles/models/profile_space.dart';
import '../models/support_enums.dart';
import '../services/support_service.dart';

/// Ouverture d'une demande : 5 par heure et 20 par jour côté serveur. Le
/// `client_id` ne change que si le contenu change, pour qu'un renvoi après
/// coupure rejoue la même demande au lieu d'en créer une seconde.
class OpenTicketViewModel(
  final SupportService _service,
  final ProfileSpace _space, {
  final AppLogger _logger = const AppLogger(),
  final String Function() newClientId = IdempotencyKey.generate,
}) extends ChangeNotifier {
  static const subjectMaxLength = 140;
  static const bodyMaxLength = 5000;

  bool _submitting = false;
  bool _disposed = false;
  String? _error;
  String? _createdId;
  String? _fingerprint;
  String? _clientId;

  bool get submitting => _submitting;
  String? get error => _error;
  String? get createdId => _createdId;

  Future<void> submit({
    required TicketCategory category,
    required String subject,
    required String body,
  }) async {
    if (_submitting) return;
    final cleanSubject = subject.trim();
    final cleanBody = body.trim();
    final fingerprint = '${category.wire}|$cleanSubject|$cleanBody';
    if (fingerprint != _fingerprint) {
      _fingerprint = fingerprint;
      _clientId = newClientId();
    }
    _submitting = true;
    _error = null;
    _notify();
    try {
      final detail = await _service.open(
        space: _space.kind.apiSpace,
        organizationId: _space.organizationId,
        category: category,
        subject: cleanSubject,
        body: cleanBody,
        clientId: _clientId!,
      );
      _createdId = detail.summary.id;
    } on ApiException catch (error) {
      _error = ApiErrorText.of(error);
    } on Exception catch (error, stack) {
      _logger.error(
        'Ouverture de la demande impossible',
        error: error,
        stack: stack,
      );
      _error = AsyncViewModel.genericFailure;
    } finally {
      _submitting = false;
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
