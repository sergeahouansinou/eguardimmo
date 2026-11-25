import '../../../core/services/api_client.dart';
import '../../../core/utils/cursor_pages.dart';
import '../../../core/utils/json_reader.dart';
import '../../../core/utils/path_ids.dart';
import '../models/report_option.dart';
import '../models/tenant_intervention.dart';

class const NewRequest({
  required final String leaseId,
  required final String natureTermId,
  required final String title,
  required final String description,
  final String? unitId,
  final bool commonArea = false,
  final Urgency? urgency,
  final String? room,
  final String? availability,
}) {
  /// Le serveur résout le locataire et valide le bail : aucun identifiant de
  /// locataire ni d'organisation n'est envoyé.
  Map<String, Object?> toJson() => {
    'lease_id': leaseId,
    'nature_term_id': natureTermId,
    'title': title,
    'description': description,
    'unit_id': ?unitId,
    if (commonArea) 'common_area': true,
    'reported_urgency': ?urgency?.value,
    'room': ?room,
    'availability': ?availability,
  };
}

class const TenantMaintenanceService(final ApiClient _api) {
  Future<List<TenantIntervention>> list() => CursorPages.collect(
    (cursor) async => CursorPages.parse(
      await _api.get(
        '/tenant/interventions',
        query: {'per_page': CursorPages.pageSize, 'cursor': ?cursor},
      ),
      '/tenant/interventions',
      TenantIntervention.fromJson,
    ),
  );

  Future<TenantIntervention> show(String id) async =>
      _one(await _api.get('/tenant/interventions/${PathIds.uuid(id)}'));

  Future<List<ReportOption>> options() async => [
    for (final entry in Json.dataList(
      await _api.get('/tenant/interventions/options'),
      'options de signalement',
    ))
      ReportOption.fromJson(Json.object(entry, 'option')),
  ];

  /// `Idempotency-Key` : un nouvel envoi de la même demande renvoie la
  /// demande déjà créée (200) au lieu d'en créer une seconde.
  Future<TenantIntervention> create(
    NewRequest request, {
    required String idempotencyKey,
  }) async => _one(
    await _api.post(
      '/tenant/interventions',
      body: request.toJson(),
      headers: {'Idempotency-Key': idempotencyKey},
    ),
  );

  Future<TenantIntervention> cancel(String id) async =>
      _one(await _api.post('/tenant/interventions/${PathIds.uuid(id)}/cancel'));

  /// `Idempotency-Key` : un nouvel envoi du même commentaire ne le publie
  /// pas deux fois.
  Future<TenantIntervention> comment(
    String id,
    String text, {
    required String idempotencyKey,
  }) async => _one(
    await _api.post(
      '/tenant/interventions/${PathIds.uuid(id)}/comments',
      body: {'text': text},
      headers: {'Idempotency-Key': idempotencyKey},
    ),
  );

  TenantIntervention _one(Object? body) =>
      TenantIntervention.fromJson(Json.data(body, 'demande'));
}
