import '../../../core/models/money.dart';
import '../../../core/state/async_view_model.dart';
import '../models/installment.dart';
import '../services/tenant_rent_service.dart';

class const RentBalance({
  required final List<Money> outstanding,
  required final bool incomplete,
}) {}

class InstallmentsViewModel(final TenantRentService _service, {super.logger})
    extends AsyncViewModel<List<Installment>> {
  List<Installment> get all => state.dataOrNull ?? const [];

  List<Installment> get open =>
      (all.where((i) => i.isOpen).toList()
        ..sort((a, b) => a.dueDate.compareTo(b.dueDate)));

  /// Échéance à régler en premier : la plus ancienne encore ouverte.
  Installment? get next => open.firstOrNull;

  int get overdueCount => open.where((i) => i.isOverdue).length;

  /// Reste dû par devise, tel que le serveur le calcule. `incomplete` signale
  /// qu'au moins une échéance ouverte n'a pas de reste connu : le total
  /// affiché n'est alors pas présenté comme complet.
  RentBalance get balance {
    final totals = <String, int>{};
    var incomplete = false;
    for (final installment in open) {
      final remaining = installment.outstanding;
      if (remaining == null) {
        incomplete = true;
      } else if (remaining.minor > 0) {
        totals.update(
          remaining.currency,
          (sum) => sum + remaining.minor,
          ifAbsent: () => remaining.minor,
        );
      }
    }
    return RentBalance(
      outstanding: [
        for (final MapEntry(:key, :value) in totals.entries) Money(value, key),
      ],
      incomplete: incomplete,
    );
  }

  @override
  Future<List<Installment>> fetch() => _service.installments();
}
