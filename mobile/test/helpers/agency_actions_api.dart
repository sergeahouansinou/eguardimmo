import 'agency_api.dart';
import 'api_fixtures.dart';
import 'fakes.dart';

const interventionId = '01a1ef81-509b-72a6-b78e-36d2c9ec12f1';
const quoteId = '01a1ef81-5400-7000-8000-0000000000d1';
const approvalId = '01a1ef81-5500-7000-8000-0000000000e1';
const proofId = '01a1ef81-5600-7000-8000-0000000000f1';
const usedProofId = '01a1ef81-5600-7000-8000-0000000000f2';
const supplierPartyId = '01a1ef81-5300-7000-8000-0000000000a1';
const caseId = '01a1ef81-5800-7000-8000-0000000000a1';

String get interventionPath =>
    '/org/$agencyOrgId/interventions/$interventionId';

/// Réponses du serveur pour les écrans d'intervention : lectures depuis les
/// fixtures, écritures répondant comme les vraies Resources. `script` impose
/// la réponse suivante d'une route (`METHODE /chemin`), consommée dans
/// l'ordre ; ensuite la réponse par défaut s'applique.
class ActionsApi() {
  Object? detail = apiFixture('agency/intervention_reported');
  Object? afterWrite;
  String roles = 'agency/roles_manager';
  Object? unpaid;
  final Map<String, List<Object?>> script = {};

  Object? call(RecordedCall call) {
    final prefix = '/org/$agencyOrgId';
    if (!call.path.startsWith(prefix)) return null;
    final rest = call.path.substring(prefix.length);
    final key = '${call.method} $rest';
    final queued = script[key];
    if (queued != null && queued.isNotEmpty) {
      final next = queued.removeAt(0);
      if (next is! Exception) _written();
      return next;
    }
    final answer = _default(call.method, rest);
    if (call.method == 'POST') _written();
    return answer;
  }

  void _written() {
    if (afterWrite != null) detail = afterWrite;
  }

  Object? _default(String method, String rest) {
    if (method == 'GET') {
      if (rest == '/interventions/$interventionId') return detail;
      if (rest == '/suppliers') return apiFixture('agency/suppliers');
      if (rest == '/roles') return apiFixture(roles);
      if (rest == '/recovery/unpaid') {
        return unpaid ?? apiFixture('agency/unpaid');
      }
      return agencyApi(RecordedCall(method, orgPath(rest)));
    }
    if (rest.endsWith('/comments')) return apiFixture('agency/comment_created');
    if (rest.endsWith('/record-decision')) {
      return apiFixture('agency/approval_recorded');
    }
    if (rest.endsWith('/withdraw')) {
      return apiFixture('agency/approval_withdrawn');
    }
    if (rest.endsWith('/acts')) return apiFixture('agency/recovery_act');
    return detail;
  }

  static String orgPath(String rest) => '/org/$agencyOrgId$rest';
}
