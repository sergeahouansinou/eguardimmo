import '../../../core/services/api_client.dart';
import '../../../core/utils/cursor_pages.dart';
import '../../../core/utils/path_ids.dart';
import '../models/lease_document.dart';
import '../models/tenant_lease.dart';

class const TenantLeasesService(final ApiClient _api) {
  Future<List<TenantLease>> leases() => CursorPages.collect(
    (cursor) async => CursorPages.parse(
      await _api.get(
        '/tenant/leases',
        query: {'per_page': CursorPages.pageSize, 'cursor': ?cursor},
      ),
      '/tenant/leases',
      TenantLease.fromJson,
    ),
  );

  Future<List<LeaseDocument>> documents(String leaseId) => CursorPages.collect(
    (cursor) async => CursorPages.parse(
      await _api.get(
        '/tenant/leases/${PathIds.uuid(leaseId)}/documents',
        query: {'per_page': CursorPages.pageSize, 'cursor': ?cursor},
      ),
      'documents du bail',
      LeaseDocument.fromJson,
    ),
  );
}
