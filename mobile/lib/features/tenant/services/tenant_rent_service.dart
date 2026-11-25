import '../../../core/services/api_client.dart';
import '../../../core/utils/cursor_pages.dart';
import '../../../core/utils/json_reader.dart';
import '../../../core/utils/path_ids.dart';
import '../models/installment.dart';
import '../models/rent_payment.dart';
import '../models/rent_receipt.dart';

class const TenantRentService(final ApiClient _api) {
  Future<List<Installment>> installments() =>
      _all('/tenant/rent/installments', Installment.fromJson);

  Future<Installment> installment(String id) async => Installment.fromJson(
    Json.data(
      await _api.get('/tenant/rent/installments/${PathIds.uuid(id)}'),
      'échéance',
    ),
  );

  Future<List<RentPayment>> payments() =>
      _all('/tenant/rent/payments', RentPayment.fromJson);

  Future<List<RentReceipt>> receipts() =>
      _all('/tenant/rent/receipts', RentReceipt.fromJson);

  Future<List<T>> _all<T>(
    String path,
    T Function(Map<String, Object?> entry) read,
  ) => CursorPages.collect(
    (cursor) async => CursorPages.parse(
      await _api.get(
        path,
        query: {'per_page': CursorPages.pageSize, 'cursor': ?cursor},
      ),
      path,
      read,
    ),
  );
}
