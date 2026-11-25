import '../../../core/models/money.dart';
import '../../../core/utils/json_reader.dart';

enum InstallmentStatus(final String label) {
  issued('Émise'),
  partiallyPaid('Partiellement payée'),
  paid('Payée');

  static InstallmentStatus parse(String value) => switch (value) {
    'issued' => issued,
    'partially_paid' => partiallyPaid,
    'paid' => paid,
    _ => throw FormatException('Statut d’échéance inconnu : $value'),
  };
}

class const LeaseRef({required final String id, final String? reference}) {
  factory LeaseRef.fromJson(Map<String, Object?> json, String key) {
    final lease = Json.child(json, key);
    return LeaseRef(
      id: Json.string(lease, 'id'),
      reference: Json.stringOrNull(lease, 'reference'),
    );
  }

  String get name => reference ?? 'Bail';
}

class const DocumentRef({
  required final String number,
  required final DateTime issuedOn,
  final String? id,
}) {
  static DocumentRef? fromJsonOrNull(Map<String, Object?> json, String key) {
    if (json[key] == null) return null;
    final ref = Json.child(json, key);
    return DocumentRef(
      number: Json.string(ref, 'number'),
      issuedOn: Json.day(ref, 'issued_on'),
      id: ref['id'] is String ? ref['id']! as String : null,
    );
  }
}

class const InstallmentLine({
  required final String label,
  required final DateTime from,
  required final DateTime to,
  required final Money amount,
}) {
  factory InstallmentLine.fromJson(Map<String, Object?> json) =>
      InstallmentLine(
        label: Json.string(json, 'label'),
        from: Json.day(json, 'from'),
        to: Json.day(json, 'to'),
        amount: Money.fromJson(json, 'amount'),
      );
}

class const Installment({
  required final String id,
  required final LeaseRef lease,
  required final DateTime periodStart,
  required final DateTime periodEnd,
  required final DateTime dueDate,
  required final InstallmentStatus status,
  required final bool isOverdue,
  required final Money rent,
  required final Money charges,
  required final Money total,
  final Money? outstanding,
  final DocumentRef? notice,
  final DocumentRef? receipt,
  final List<InstallmentLine>? lines,
}) {
  factory Installment.fromJson(Map<String, Object?> json) {
    final period = Json.child(json, 'period');
    final amounts = Json.child(json, 'amounts');
    final lines = json['lines'];
    return Installment(
      id: Json.string(json, 'id'),
      lease: LeaseRef.fromJson(json, 'lease'),
      periodStart: Json.day(period, 'start'),
      periodEnd: Json.day(period, 'end'),
      dueDate: Json.day(json, 'due_date'),
      status: InstallmentStatus.parse(Json.string(json, 'status')),
      isOverdue: Json.boolean(json, 'is_overdue'),
      rent: Money.fromJson(amounts, 'rent'),
      charges: Money.fromJson(amounts, 'charges'),
      total: Money.fromJson(amounts, 'total'),
      outstanding: Money.fromJsonOrNull(json, 'outstanding'),
      notice: DocumentRef.fromJsonOrNull(json, 'notice'),
      receipt: DocumentRef.fromJsonOrNull(json, 'receipt'),
      lines: lines == null
          ? null
          : [
              for (final line in Json.list(lines, 'lines'))
                InstallmentLine.fromJson(Json.object(line, 'ligne')),
            ],
    );
  }

  bool get isOpen => status != InstallmentStatus.paid;

  /// Reste dû : le serveur l'omet (null) quand le grand livre ne le connaît
  /// pas ; le total n'est alors jamais présenté comme un reste.
  Money? get remaining => isOpen ? outstanding : null;
}
