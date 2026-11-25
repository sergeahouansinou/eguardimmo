import 'api_fixtures.dart';
import 'fakes.dart';
import 'fixtures.dart';

final agencyOrg =
    Fixtures.organizationProfile(kind: 'agency')['meta']!
        as Map<String, Object?>;

String get agencyOrgId => agencyOrg['organization']! as String;

/// Espace agence : chaque chemin `/org/{organisation}/…` répond avec la
/// fixture correspondante ; une autre organisation n'a aucune réponse.
Object? agencyApi(RecordedCall call) {
  if (call.method != 'GET') return null;
  final prefix = '/org/$agencyOrgId';
  if (!call.path.startsWith(prefix)) return null;
  return switch (call.path.substring(prefix.length)) {
    '/reporting/home/agency-kpis' => apiFixture('agency/kpis'),
    '/reporting/home/agency-payouts' => apiFixture('agency/payouts'),
    '/reporting/home/agency-alerts' => apiFixture('agency/alerts'),
    '/recovery/unpaid' => apiFixture('agency/unpaid'),
    '/interventions' => apiFixture('agency/interventions'),
    '/properties' => apiFixture('agency/properties'),
    '/leases' => apiFixture('agency/leases'),
    _ => null,
  };
}
