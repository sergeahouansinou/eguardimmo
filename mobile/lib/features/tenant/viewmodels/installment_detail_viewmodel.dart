import '../../../core/state/async_view_model.dart';
import '../models/installment.dart';
import '../services/tenant_rent_service.dart';

class InstallmentDetailViewModel(
  final TenantRentService _service,
  final String id, {
  super.logger,
}) extends AsyncViewModel<Installment> {
  @override
  Future<Installment> fetch() => _service.installment(id);
}
