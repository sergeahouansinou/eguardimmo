import '../../../core/services/api_client.dart';
import '../../../core/utils/cursor_pages.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/json_reader.dart';
import '../../../core/utils/path_ids.dart';
import '../models/intervention_commands.dart';
import '../models/intervention_detail.dart';

/// Interventions de l'espace agence : chaque écriture porte l'Idempotency-Key
/// et, quand le serveur l'exige, la `lock_version` lue sur la fiche. Aucun
/// statut ni montant n'est calculé ici : la réponse n'est pas interprétée, la
/// fiche est relue après chaque écriture.
class const AgencyMaintenanceService(final ApiClient _api) {
  Future<InterventionDetail> intervention(
    String organization,
    String id,
  ) async => InterventionDetail.fromJson(
    Json.data(await _api.get(_path(organization, id)), 'intervention'),
  );

  Future<List<Supplier>> activeSuppliers(String organization) =>
      CursorPages.collect(
        (cursor) async => CursorPages.parse(
          await _api.get(
            '${_org(organization)}/suppliers',
            query: {
              'status': 'active',
              'per_page': CursorPages.pageSize,
              'cursor': ?cursor,
            },
          ),
          'prestataires',
          Supplier.fromJson,
        ),
      );

  Future<void> qualify(
    String organization,
    String id,
    QualifyCommand command, {
    required int lockVersion,
    required int? estimatedAmount,
    required String idempotencyKey,
  }) => _post('${_path(organization, id)}/qualify', {
    'lock_version': lockVersion,
    'priority': command.priority.name,
    'responsibility': command.responsibility.key,
    if (command.dueOn case final due?) 'due_on': Formatters.isoDate(due),
    'estimated_amount': ?estimatedAmount,
  }, idempotencyKey);

  Future<void> decline(
    String organization,
    String id,
    DeclineCommand command, {
    required int lockVersion,
    required String idempotencyKey,
  }) => _post('${_path(organization, id)}/decline', {
    'lock_version': lockVersion,
    'reason': command.reason.key,
    'note': command.note,
  }, idempotencyKey);

  Future<void> assign(
    String organization,
    String id,
    String supplierPartyId, {
    required int lockVersion,
    required String idempotencyKey,
  }) => _post('${_path(organization, id)}/assign', {
    'lock_version': lockVersion,
    'supplier_party_id': PathIds.uuid(supplierPartyId),
  }, idempotencyKey);

  Future<void> cancel(
    String organization,
    String id, {
    required int lockVersion,
    required String idempotencyKey,
  }) => _post('${_path(organization, id)}/cancel', {
    'lock_version': lockVersion,
  }, idempotencyKey);

  Future<void> acceptQuote(
    String organization,
    String id,
    String quoteId, {
    required String idempotencyKey,
  }) => _post(
    '${_path(organization, id)}/quotes/${PathIds.uuid(quoteId)}/accept',
    null,
    idempotencyKey,
  );

  Future<void> recordDecision(
    String organization,
    String id,
    DecisionCommand command, {
    required String idempotencyKey,
  }) => _post(
    '${_path(organization, id)}/approvals/${PathIds.uuid(command.approvalId)}/record-decision',
    {
      'decision': command.decision.key,
      if (command.comment.isNotEmpty) 'comment': command.comment,
      'proof_file_id': PathIds.uuid(command.proofFileId),
    },
    idempotencyKey,
  );

  Future<void> withdrawApproval(
    String organization,
    String id,
    String approvalId, {
    required String idempotencyKey,
  }) => _post(
    '${_path(organization, id)}/approvals/${PathIds.uuid(approvalId)}/withdraw',
    null,
    idempotencyKey,
  );

  Future<void> comment(
    String organization,
    String id,
    CommentCommand command, {
    required String idempotencyKey,
  }) => _post('${_path(organization, id)}/comments', {
    'text': command.text,
    'visible_to_tenant': command.visibleToTenant,
    'visible_to_owner': command.visibleToOwner,
  }, idempotencyKey);

  Future<void> _post(String path, Object? body, String idempotencyKey) async {
    await _api.post(
      path,
      body: body,
      headers: {'Idempotency-Key': idempotencyKey},
    );
  }

  String _org(String organization) => '/org/${PathIds.segment(organization)}';

  String _path(String organization, String id) =>
      '${_org(organization)}/interventions/${PathIds.uuid(id)}';
}
