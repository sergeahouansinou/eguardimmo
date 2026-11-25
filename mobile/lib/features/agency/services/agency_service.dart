import '../../../core/services/api_client.dart';
import '../../../core/utils/cursor_pages.dart';
import '../../../core/utils/json_reader.dart';
import '../../../core/utils/path_ids.dart';
import '../models/agency_dashboard.dart';
import '../models/agency_intervention.dart';
import '../models/intervention_commands.dart';
import '../models/portfolio.dart';
import '../models/unpaid_item.dart';

/// Espace agence : chaque appel vise `/org/{organisation}` où l'organisation
/// est le segment fourni par `/me/profiles`, jamais une saisie libre.
class const AgencyService(final ApiClient _api) {
  static final _segment = RegExp(r'^[A-Za-z0-9-]{1,64}$');

  Future<AgencyKpis> kpis(String organization) async => AgencyKpis.fromJson(
    Json.data(
      await _api.get('${_base(organization)}/reporting/home/agency-kpis'),
      'indicateurs',
    ),
  );

  Future<AgencyPayouts> payouts(String organization) async =>
      AgencyPayouts.fromJson(
        Json.data(
          await _api.get(
            '${_base(organization)}/reporting/home/agency-payouts',
          ),
          'reversements',
        ),
      );

  Future<AgencyAlerts> alerts(String organization) async =>
      AgencyAlerts.fromJson(
        Json.data(
          await _api.get('${_base(organization)}/reporting/home/agency-alerts'),
          'alertes',
        ),
      );

  Future<List<UnpaidItem>> unpaid(String organization) =>
      CursorPages.collect((after) async {
        final body = Json.object(
          await _api.get(
            '${_base(organization)}/recovery/unpaid',
            query: {'per_page': CursorPages.pageSize, 'after': ?after},
          ),
          'impayés',
        );
        return (
          items: [
            for (final entry in Json.dataList(body, 'impayés'))
              UnpaidItem.fromJson(Json.object(entry, 'impayé')),
          ],
          nextCursor: Json.stringOrNull(Json.child(body, 'meta'), 'next_after'),
        );
      });

  /// Diligence manuelle du dossier de recouvrement : le serveur refuse une
  /// date future ou antérieure à l'ouverture du dossier.
  Future<void> addAct(
    String organization,
    String caseId,
    ReminderCommand command, {
    required String idempotencyKey,
  }) async {
    await _api.post(
      '${_base(organization)}/recovery/cases/${PathIds.uuid(caseId)}/acts',
      body: {
        'type': command.kind.key,
        'performed_on': command.day,
        if (command.note.isNotEmpty) 'note': command.note,
      },
      headers: {'Idempotency-Key': idempotencyKey},
    );
  }

  Future<List<AgencyIntervention>> interventions(
    String organization, {
    String? status,
  }) => _all(
    organization,
    '/interventions',
    AgencyIntervention.fromJson,
    filters: {'status': ?status},
  );

  Future<List<AgencyProperty>> properties(String organization) =>
      _all(organization, '/properties', AgencyProperty.fromJson);

  Future<List<AgencyLease>> leases(String organization, {String? phase}) =>
      _all(
        organization,
        '/leases',
        AgencyLease.fromJson,
        filters: {'phase': ?phase},
      );

  String _base(String organization) {
    if (!_segment.hasMatch(organization)) {
      throw const FormatException('Identifiant d’organisation invalide');
    }
    return '/org/$organization';
  }

  Future<List<T>> _all<T>(
    String organization,
    String path,
    T Function(Map<String, Object?> entry) read, {
    Map<String, Object?> filters = const {},
  }) => CursorPages.collect(
    (cursor) async => CursorPages.parse(
      await _api.get(
        '${_base(organization)}$path',
        query: {
          ...filters,
          'per_page': CursorPages.pageSize,
          'cursor': ?cursor,
        },
      ),
      path,
      read,
    ),
  );
}
