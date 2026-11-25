import 'api_fixtures.dart';
import 'fakes.dart';

const tenantLeaseId = '01a1ef81-4fb4-70fa-a070-6b296b02b3e9';
const requestId = '01a1ef81-4fe1-7045-b621-ec6cf711d928';
const installmentId = '01a1e955-004b-709d-9353-b6f2e30e1028';

/// Espace locataire : chaque chemin répond avec la réponse réelle capturée.
Object? tenantApi(RecordedCall call) {
  final path = call.path;
  if (call.method == 'GET') {
    return switch (path) {
      '/tenant/rent/installments' => apiFixture('tenant/installments'),
      '/tenant/rent/payments' => apiFixture('tenant/payments'),
      '/tenant/rent/receipts' => apiFixture('tenant/receipts'),
      '/tenant/rent/installments/$installmentId' => apiFixture(
        'tenant/installment_issued',
      ),
      '/tenant/leases' => apiFixture('tenant/leases'),
      '/tenant/leases/$tenantLeaseId/documents' => apiFixture(
        'tenant/lease_documents',
      ),
      '/tenant/interventions' => apiFixture('tenant/interventions'),
      '/tenant/interventions/options' => apiFixture(
        'tenant/intervention_options',
      ),
      '/tenant/interventions/$requestId' => apiFixture(
        'tenant/intervention_open',
      ),
      _ => null,
    };
  }
  if (call.method == 'POST') {
    if (path == '/tenant/interventions') {
      return apiFixture('tenant/intervention_created');
    }
    if (path == '/tenant/interventions/$requestId/comments') {
      return apiFixture('tenant/intervention_comment');
    }
    if (path == '/tenant/interventions/$requestId/cancel') {
      return apiFixture('tenant/intervention_cancelled');
    }
  }
  return null;
}
