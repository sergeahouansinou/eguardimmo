import '../../../core/state/async_view_model.dart';
import '../models/owner_statement.dart';
import '../services/owner_service.dart';

/// Relevé de compte mois par mois : la fenêtre demandée au serveur est
/// toujours un mois civil complet (la limite serveur est de 366 jours).
class OwnerStatementViewModel(
  final OwnerService _service,
  final String agencyId, {
  final DateTime Function() clock = DateTime.now,
  super.logger,
}) extends AsyncViewModel<OwnerStatement> {
  late DateTime _month = DateTime(clock().year, clock().month);

  DateTime get month => _month;

  bool get canGoNext {
    final now = clock();
    return _month.isBefore(DateTime(now.year, now.month));
  }

  Future<void> previous() => _move(-1);

  Future<void> next() => canGoNext ? _move(1) : Future.value();

  Future<void> _move(int delta) {
    if (state.isLoading) return Future.value();
    _month = DateTime(_month.year, _month.month + delta);
    return load(keepPrevious: false);
  }

  @override
  Future<OwnerStatement> fetch() => _service.statement(
    agencyId,
    from: _month,
    to: DateTime(_month.year, _month.month + 1, 0),
  );
}
