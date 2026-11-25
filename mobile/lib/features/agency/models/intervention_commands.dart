import '../../../core/utils/formatters.dart';
import 'agency_intervention.dart';
import 'intervention_detail.dart';

enum DeclineReason(final String label, final String key) {
  duplicate('Doublon', 'duplicate'),
  outOfScope('Hors périmètre', 'out_of_scope'),
  notAnIssue('Pas un problème', 'not_an_issue'),
  tenantResponsibility('À la charge du locataire', 'tenant_responsibility'),
  other('Autre motif', 'other'),
}

enum ApprovalDecision(final String label, final String key) {
  accept('Accord du propriétaire', 'accept'),
  refuse('Refus du propriétaire', 'refuse'),
}

class const QualifyCommand({
  required final InterventionPriority priority,
  required final Responsibility responsibility,
  final DateTime? dueOn,
}) {}

class const DeclineCommand({
  required final DeclineReason reason,
  required final String note,
}) {}

class const DecisionCommand({
  required final String approvalId,
  required final ApprovalDecision decision,
  required final String proofFileId,
  final String comment = '',
}) {}

class const CommentCommand({
  required final String text,
  final bool visibleToTenant = false,
  final bool visibleToOwner = false,
}) {}

enum ReminderKind(final String label, final String key) {
  reminder('Relance', 'reminder'),
  call('Appel', 'call'),
  email('E-mail', 'email'),
  visit('Visite', 'visit'),
  note('Note', 'note'),
}

class const ReminderCommand({
  required final ReminderKind kind,
  required final DateTime performedOn,
  final String note = '',
}) {
  String get day => Formatters.isoDate(performedOn);
}
