import '../../../core/services/api_exception.dart';
import '../../../core/state/async_view_model.dart';
import '../../../core/utils/api_error_text.dart';
import '../../../core/utils/idempotency_key.dart';
import '../models/compose_option.dart';
import '../models/messaging_scope.dart';
import '../services/threads_service.dart';

/// Ouverture d'un fil par le locataire : 5 par heure et 20 par jour côté
/// serveur. L'identifiant d'idempotence ne change que si le contenu change,
/// pour qu'un renvoi après coupure ne crée pas deux fils.
class NewThreadViewModel(
  final ThreadsService _service,
  final ThreadsEndpoint _endpoint, {
  super.logger,
  final String Function() newClientId = IdempotencyKey.generate,
}) extends AsyncViewModel<List<ComposeOption>> {
  static const subjectMaxLength = 140;
  static const bodyMaxLength = 5000;

  bool _submitting = false;
  String? _error;
  String? _createdId;
  String? _fingerprint;
  String? _clientId;

  bool get submitting => _submitting;
  String? get error => _error;
  String? get createdId => _createdId;

  @override
  String messageFor(ApiException error) => ApiErrorText.of(error);

  @override
  Future<List<ComposeOption>> fetch() => _service.options(_endpoint);

  Future<void> submit({
    required ComposeOption option,
    required String subject,
    required String body,
  }) async {
    if (_submitting) return;
    final cleanSubject = subject.trim();
    final cleanBody = body.trim();
    final fingerprint = '${option.leaseId}|$cleanSubject|$cleanBody';
    if (fingerprint != _fingerprint) {
      _fingerprint = fingerprint;
      _clientId = newClientId();
    }
    _submitting = true;
    _error = null;
    notifySafely();
    try {
      final detail = await _service.open(
        _endpoint,
        leaseId: option.leaseId,
        subject: cleanSubject,
        body: cleanBody,
        clientId: _clientId!,
      );
      _createdId = detail.summary.id;
    } on ApiException catch (error) {
      _error = ApiErrorText.of(error);
    } on Exception catch (error, stack) {
      logger.error('Ouverture du fil impossible', error: error, stack: stack);
      _error = AsyncViewModel.genericFailure;
    } finally {
      _submitting = false;
      notifySafely();
    }
  }
}
