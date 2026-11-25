import '../../../core/services/api_exception.dart';
import '../../../core/state/async_view_model.dart';
import '../../../core/utils/idempotency_key.dart';
import '../models/tenant_intervention.dart';
import '../services/tenant_maintenance_service.dart';

class RequestsViewModel(final TenantMaintenanceService _service, {super.logger})
    extends AsyncViewModel<List<TenantIntervention>> {
  @override
  Future<List<TenantIntervention>> fetch() => _service.list();
}

class RequestDetailViewModel(
  final TenantMaintenanceService _service,
  final String id, {
  super.logger,
}) extends AsyncViewModel<TenantIntervention> {
  bool _busy = false;

  bool get busy => _busy;

  @override
  Future<TenantIntervention> fetch() => _service.show(id);

  String _commentKey = IdempotencyKey.generate();
  String? _commentKeyText;

  /// Renvoie le message d'erreur, ou null quand le serveur a accepté. La vue
  /// affichée est toujours celle que le serveur renvoie. La clé d'idempotence
  /// d'un commentaire suit son texte et survit aux échecs incertains.
  Future<String?> comment(String text) {
    final clean = text.trim();
    if (_commentKeyText != clean) {
      _commentKey = IdempotencyKey.generate();
      _commentKeyText = clean;
    }
    final key = _commentKey;
    return _act(
      () => _service.comment(id, clean, idempotencyKey: key),
      onResolved: (failure) {
        if (failure == null || IdempotencyKey.isDefinitiveRefusal(failure)) {
          _commentKeyText = null;
        }
      },
    );
  }

  Future<String?> cancel() => _act(() => _service.cancel(id));

  Future<String?> _act(
    Future<TenantIntervention> Function() action, {
    void Function(ApiException? failure)? onResolved,
  }) async {
    if (_busy) return null;
    _busy = true;
    notifySafely();
    try {
      replaceData(await action());
      onResolved?.call(null);
      return null;
    } on ApiException catch (error) {
      onResolved?.call(error);
      return error.message;
    } on Exception catch (error, stack) {
      logger.error(
        'Action sur la demande impossible',
        error: error,
        stack: stack,
      );
      return AsyncViewModel.genericFailure;
    } finally {
      _busy = false;
      notifySafely();
    }
  }
}
