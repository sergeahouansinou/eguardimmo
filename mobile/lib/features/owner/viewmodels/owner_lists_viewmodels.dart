import '../../../core/state/async_view_model.dart';
import '../models/owner_document.dart';
import '../models/owner_payout.dart';
import '../models/owner_unit.dart';
import '../services/owner_service.dart';

class OwnerPayoutsViewModel(
  final OwnerService _service,
  final String agencyId, {
  super.logger,
}) extends AsyncViewModel<PayoutsPage> {
  @override
  Future<PayoutsPage> fetch() => _service.payouts(agencyId);
}

class OwnerPropertiesViewModel(
  final OwnerService _service,
  final String agencyId, {
  super.logger,
}) extends AsyncViewModel<List<OwnerUnit>> {
  @override
  Future<List<OwnerUnit>> fetch() => _service.properties(agencyId);
}

class OwnerDocumentsViewModel(
  final OwnerService _service,
  final String agencyId, {
  super.logger,
}) extends AsyncViewModel<List<OwnerDocument>> {
  @override
  Future<List<OwnerDocument>> fetch() => _service.documents(agencyId);
}
