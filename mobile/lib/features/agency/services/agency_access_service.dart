import '../../../core/services/api_client.dart';
import '../../../core/utils/json_reader.dart';
import '../../../core/utils/path_ids.dart';
import '../models/agency_access.dart';

class const AgencyAccessService(final ApiClient _api) {
  Future<AgencyAccess> access(String organization) async =>
      AgencyAccess.fromJson(
        Json.data(
          await _api.get('/org/${PathIds.segment(organization)}/roles'),
          'droits',
        ),
      );
}
