import 'api_fixtures.dart';
import 'fakes.dart';

const ownerAgencyId = '0193a5e1-0000-7000-8000-0000000000b1';
const otherAgencyId = '0193a5e1-0000-7000-8000-0000000000b2';

/// Espace propriétaire : chaque chemin répond avec la fixture correspondante.
Object? ownerApi(RecordedCall call) {
  if (call.method != 'GET') return null;
  return switch (call.path) {
    '/owner/agencies' => apiFixture('owner/agencies'),
    '/owner/home' => apiFixture('owner/home'),
    '/owner/payouts' => apiFixture('owner/payouts'),
    '/owner/statement' => apiFixture('owner/statement'),
    '/owner/properties' => apiFixture('owner/properties'),
    '/owner/documents' => apiFixture('owner/documents'),
    _ => null,
  };
}
