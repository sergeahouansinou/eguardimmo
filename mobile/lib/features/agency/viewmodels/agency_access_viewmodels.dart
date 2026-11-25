import '../../../core/state/async_view_model.dart';
import '../models/agency_access.dart';
import '../models/intervention_detail.dart';
import '../services/agency_access_service.dart';
import '../services/agency_maintenance_service.dart';

class AgencyAccessViewModel(
  final AgencyAccessService _service,
  final String organization, {
  super.logger,
}) extends AsyncViewModel<AgencyAccess> {
  @override
  Future<AgencyAccess> fetch() => _service.access(organization);
}

class AgencySuppliersViewModel(
  final AgencyMaintenanceService _service,
  final String organization, {
  super.logger,
}) extends AsyncViewModel<List<Supplier>> {
  @override
  Future<List<Supplier>> fetch() => _service.activeSuppliers(organization);
}
