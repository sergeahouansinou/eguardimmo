import '../../../core/state/async_view_model.dart';
import '../models/owner_home.dart';
import '../services/owner_service.dart';

class OwnerHomeViewModel(
  final OwnerService _service,
  final String agencyId, {
  super.logger,
}) extends AsyncViewModel<OwnerHome> {
  @override
  Future<OwnerHome> fetch() => _service.home(agencyId);
}
