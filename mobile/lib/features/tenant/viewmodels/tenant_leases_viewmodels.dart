import '../../../core/state/async_view_model.dart';
import '../models/lease_document.dart';
import '../models/tenant_lease.dart';
import '../services/tenant_leases_service.dart';

class TenantLeasesViewModel(final TenantLeasesService _service, {super.logger})
    extends AsyncViewModel<List<TenantLease>> {
  /// Bail à mettre en avant : le bail en cours, sinon le premier renvoyé.
  TenantLease? get current {
    final leases = state.dataOrNull ?? const [];
    return leases
            .where((lease) => lease.phase == LeasePhase.running)
            .firstOrNull ??
        leases.firstOrNull;
  }

  @override
  Future<List<TenantLease>> fetch() => _service.leases();
}

class TenantDocumentsViewModel(
  final TenantLeasesService _service, {
  super.logger,
}) extends AsyncViewModel<List<LeaseDocuments>> {
  @override
  Future<List<LeaseDocuments>> fetch() async {
    final leases = await _service.leases();
    final groups = await Future.wait([
      for (final lease in leases)
        _service
            .documents(lease.id)
            .then(
              (documents) => LeaseDocuments(
                leaseReference: lease.reference,
                documents: documents,
              ),
            ),
    ]);
    return groups;
  }
}
