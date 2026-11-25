import '../../../core/models/money.dart';
import '../../../core/utils/json_reader.dart';

enum UnpaidKind(final String label) {
  installment('Échéance de loyer'),
  invoice('Facture');

  static UnpaidKind parse(String value) => switch (value) {
    'installment' => installment,
    'invoice' => invoice,
    _ => throw FormatException('Type d’impayé inconnu : $value'),
  };
}

enum UnpaidStatus(final String label) {
  issued('Émise'),
  partiallyPaid('Partiellement payée');

  static UnpaidStatus parse(String value) => switch (value) {
    'issued' => issued,
    'partially_paid' => partiallyPaid,
    _ => throw FormatException('Statut d’impayé inconnu : $value'),
  };
}

class const UnpaidItem({
  required final String id,
  required final UnpaidKind kind,
  required final UnpaidStatus status,
  required final String leaseReference,
  required final DateTime dueDate,
  required final int daysOverdue,
  required final Money total,
  required final Money outstanding,
  final String? reference,
  final String? partyName,
  final DateTime? periodStart,
  final DateTime? periodEnd,
  final String? caseNumber,
  final String? caseId,
}) {
  factory UnpaidItem.fromJson(Map<String, Object?> json) {
    final party = Json.childOrNull(json, 'party');
    final period = Json.childOrNull(json, 'period');
    final recoveryCase = Json.childOrNull(json, 'case');
    return UnpaidItem(
      id: Json.string(json, 'item_id'),
      kind: UnpaidKind.parse(Json.string(json, 'type')),
      status: UnpaidStatus.parse(Json.string(json, 'status')),
      reference: Json.stringOrNull(json, 'reference'),
      leaseReference:
          Json.stringOrNull(Json.child(json, 'lease'), 'reference') ?? 'Bail',
      partyName: party == null ? null : Json.stringOrNull(party, 'name'),
      periodStart: period == null ? null : Json.day(period, 'start'),
      periodEnd: period == null ? null : Json.day(period, 'end'),
      dueDate: Json.day(json, 'due_date'),
      daysOverdue: Json.integer(json, 'days_overdue'),
      total: Money.fromJson(json, 'total'),
      outstanding: Money.fromJson(json, 'outstanding'),
      caseNumber: recoveryCase == null
          ? null
          : Json.string(recoveryCase, 'number'),
      caseId: recoveryCase == null ? null : Json.string(recoveryCase, 'id'),
    );
  }
}

class const UnpaidPage({
  required final List<UnpaidItem> items,
  final String? nextAfter,
}) {}
