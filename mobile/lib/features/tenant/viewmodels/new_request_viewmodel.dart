import '../../../core/services/api_exception.dart';
import '../../../core/state/async_view_model.dart';
import '../../../core/utils/idempotency_key.dart';
import '../models/report_option.dart';
import '../models/tenant_intervention.dart';
import '../services/tenant_maintenance_service.dart';

class NewRequestViewModel(
  final TenantMaintenanceService _service, {
  super.logger,
}) extends AsyncViewModel<List<ReportOption>> {
  ReportOption? _option;
  Choice? _unit;
  bool _commonArea = false;
  Choice? _nature;
  Urgency? _urgency;
  bool _submitting = false;
  String? _error;
  Map<String, List<String>> _fieldErrors = const {};
  String _idempotencyKey = IdempotencyKey.generate();

  ReportOption? get option =>
      _option ??
      (state.dataOrNull?.length == 1 ? state.dataOrNull!.first : null);
  Choice? get unit => _unit;
  bool get commonArea => _commonArea;
  Choice? get nature => _nature;
  Urgency? get urgency => _urgency;
  bool get submitting => _submitting;
  String? get error => _error;

  String? fieldError(String field) => _fieldErrors[field]?.firstOrNull;

  @override
  Future<List<ReportOption>> fetch() => _service.options();

  void selectLease(ReportOption option) {
    _option = option;
    _unit = null;
    _commonArea = false;
    _nature = null;
    notifySafely();
  }

  void selectNature(Choice nature) {
    _nature = nature;
    notifySafely();
  }

  void selectUnit(Choice? unit) {
    _unit = unit;
    _commonArea = false;
    notifySafely();
  }

  void selectCommonArea() {
    _commonArea = true;
    _unit = null;
    notifySafely();
  }

  void selectUrgency(Urgency? urgency) {
    _urgency = urgency;
    notifySafely();
  }

  /// Renvoie la demande créée, ou null avec [error] / [fieldError]. La clé
  /// d'idempotence survit à une coupure réseau, un délai ou une panne serveur
  /// (le nouvel essai ne crée pas de doublon) mais change après un refus
  /// définitif (4xx), car le formulaire sera modifié.
  Future<TenantIntervention?> submit({
    required String title,
    required String description,
    required String room,
    required String availability,
  }) async {
    final option = this.option;
    final nature = _nature;
    if (_submitting || option == null || nature == null) return null;
    _submitting = true;
    _error = null;
    _fieldErrors = const {};
    notifySafely();
    try {
      final created = await _service.create(
        NewRequest(
          leaseId: option.leaseId,
          natureTermId: nature.id,
          title: title.trim(),
          description: description.trim(),
          unitId: _unit?.id,
          commonArea: _commonArea,
          urgency: _urgency,
          room: room.trim().isEmpty ? null : room.trim(),
          availability: availability.trim().isEmpty
              ? null
              : availability.trim(),
        ),
        idempotencyKey: _idempotencyKey,
      );
      _idempotencyKey = IdempotencyKey.generate();
      return created;
    } on ApiException catch (failure) {
      if (IdempotencyKey.isDefinitiveRefusal(failure)) {
        _idempotencyKey = IdempotencyKey.generate();
      }
      _error = failure.message;
      _fieldErrors = failure.fieldErrors;
      return null;
    } on Exception catch (failure, stack) {
      logger.error('Signalement impossible', error: failure, stack: stack);
      _error = AsyncViewModel.genericFailure;
      return null;
    } finally {
      _submitting = false;
      notifySafely();
    }
  }
}
