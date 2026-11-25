import '../../../core/models/money.dart';
import '../../../core/utils/json_reader.dart';

enum PayoutStatus(final String label) {
  pending('Programmé'),
  paid('Versé'),
  returned('Retourné par la banque');

  static PayoutStatus parse(String value) => switch (value) {
    'pending' => pending,
    'paid' => paid,
    'returned' => returned,
    _ => throw FormatException('Statut de reversement inconnu : $value'),
  };
}

class const OwnerPayout({
  required final String id,
  required final String number,
  required final PayoutStatus status,
  required final Money amount,
  final DateTime? date,
  final String? bankLast4,
  final String? agencyName,
}) {
  factory OwnerPayout.fromJson(Map<String, Object?> json) => OwnerPayout(
    id: Json.string(json, 'id'),
    number: Json.string(json, 'number'),
    status: PayoutStatus.parse(Json.string(json, 'status')),
    amount: Money.fromJson(json, 'amount'),
    date: json['date'] == null ? null : Json.day(json, 'date'),
    bankLast4: Json.stringOrNull(json, 'bank_last4'),
    agencyName: Json.stringOrNull(Json.child(json, 'agency'), 'name'),
  );
}

class const UpcomingPayout({
  required final String agencyName,
  final DateTime? date,
  final String? notice,
}) {
  factory UpcomingPayout.fromJson(Map<String, Object?> json) {
    final notice = Json.childOrNull(json, 'notice');
    return UpcomingPayout(
      agencyName:
          Json.stringOrNull(Json.child(json, 'agency'), 'name') ?? 'Agence',
      date: json['date'] == null ? null : Json.day(json, 'date'),
      notice: notice == null ? null : Json.string(notice, 'message'),
    );
  }
}

class const PayoutsPage({
  required final List<OwnerPayout> items,
  required final List<UpcomingPayout> upcoming,
}) {}
