import '../../../core/state/async_view_model.dart';
import '../models/rent_payment.dart';
import '../models/rent_receipt.dart';
import '../services/tenant_rent_service.dart';

class PaymentsViewModel(final TenantRentService _service, {super.logger})
    extends AsyncViewModel<List<RentPayment>> {
  @override
  Future<List<RentPayment>> fetch() async =>
      (await _service.payments())
        ..sort((a, b) => b.receivedOn.compareTo(a.receivedOn));
}

class ReceiptsViewModel(final TenantRentService _service, {super.logger})
    extends AsyncViewModel<List<RentReceipt>> {
  @override
  Future<List<RentReceipt>> fetch() async =>
      (await _service.receipts())
        ..sort((a, b) => b.issuedOn.compareTo(a.issuedOn));
}
