import '../../../core/state/async_view_model.dart';
import '../../../core/state/idempotent_writes.dart';
import '../models/intervention_commands.dart';
import '../models/intervention_detail.dart';
import '../services/agency_maintenance_service.dart';

class AgencyInterventionViewModel(
  final AgencyMaintenanceService _service,
  final String organization,
  final String id, {
  super.logger,
}) extends AsyncViewModel<InterventionDetail>
    with IdempotentWrites<InterventionDetail> {
  @override
  Future<InterventionDetail> fetch() => _service.intervention(organization, id);

  Future<WriteResult> qualify(QualifyCommand command) => _act(
    'qualify|${command.priority.name}|${command.responsibility.key}|${command.dueOn}',
    (detail, key) => _service.qualify(
      organization,
      id,
      command,
      lockVersion: detail.lockVersion,
      estimatedAmount: detail.summary.estimatedAmount?.minor,
      idempotencyKey: key,
    ),
    versioned: true,
  );

  Future<WriteResult> decline(DeclineCommand command) => _act(
    'decline|${command.reason.key}|${command.note}',
    (detail, key) => _service.decline(
      organization,
      id,
      command,
      lockVersion: detail.lockVersion,
      idempotencyKey: key,
    ),
    versioned: true,
  );

  Future<WriteResult> assign(String supplierPartyId) => _act(
    'assign|$supplierPartyId',
    (detail, key) => _service.assign(
      organization,
      id,
      supplierPartyId,
      lockVersion: detail.lockVersion,
      idempotencyKey: key,
    ),
    versioned: true,
  );

  Future<WriteResult> cancel() => _act(
    'cancel',
    (detail, key) => _service.cancel(
      organization,
      id,
      lockVersion: detail.lockVersion,
      idempotencyKey: key,
    ),
    versioned: true,
  );

  Future<WriteResult> acceptQuote(String quoteId) => _act(
    'accept|$quoteId',
    (_, key) =>
        _service.acceptQuote(organization, id, quoteId, idempotencyKey: key),
  );

  Future<WriteResult> recordDecision(DecisionCommand command) => _act(
    'decision|${command.approvalId}|${command.decision.key}|${command.proofFileId}|${command.comment}',
    (_, key) =>
        _service.recordDecision(organization, id, command, idempotencyKey: key),
  );

  Future<WriteResult> withdrawApproval(String approvalId) => _act(
    'withdraw|$approvalId',
    (_, key) => _service.withdrawApproval(
      organization,
      id,
      approvalId,
      idempotencyKey: key,
    ),
  );

  Future<WriteResult> comment(CommentCommand command) => _act(
    'comment|${command.text}|${command.visibleToTenant}|${command.visibleToOwner}',
    (_, key) =>
        _service.comment(organization, id, command, idempotencyKey: key),
  );

  /// Pour les actions versionnées, la `lock_version` fait partie de la demande :
  /// une fiche relue change la clé. Les autres actions n'envoient pas de version,
  /// leur clé reste stable pour qu'un renvoi ne crée pas de doublon. Après un succès, ou un 409 (fiche modifiée entre-temps), la fiche
  /// est relue : l'écran n'affiche que l'état du serveur.
  Future<WriteResult> _act(
    String fingerprint,
    Future<void> Function(InterventionDetail detail, String key) send, {
    bool versioned = false,
  }) async {
    final detail = state.dataOrNull;
    if (detail == null) return const WriteIgnored();
    final result = await write(
      versioned ? '$fingerprint|${detail.lockVersion}' : fingerprint,
      (key) => send(detail, key),
    );
    if (result is WriteDone ||
        (result is WriteRefused && result.status == 409)) {
      await load();
    }
    return result;
  }
}
