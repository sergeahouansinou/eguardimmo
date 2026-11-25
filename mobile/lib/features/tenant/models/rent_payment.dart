import '../../../core/models/money.dart';
import '../../../core/utils/json_reader.dart';
import 'installment.dart';

enum PaymentMethod(final String label) {
  transfer('Virement'),
  cheque('Chèque'),
  cash('Espèces'),
  directDebit('Prélèvement');

  static PaymentMethod parse(String value) => switch (value) {
    'transfer' => transfer,
    'cheque' => cheque,
    'cash' => cash,
    'direct_debit' => directDebit,
    _ => throw FormatException('Mode de paiement inconnu : $value'),
  };
}

class const RentPayment({
  required final String id,
  required final LeaseRef lease,
  required final bool cancelled,
  required final PaymentMethod method,
  required final Money amount,
  required final DateTime receivedOn,
  final DateTime? cancelledOn,
}) {
  factory RentPayment.fromJson(Map<String, Object?> json) {
    final status = Json.string(json, 'status');
    if (status != 'recorded' && status != 'cancelled') {
      throw FormatException('Statut de paiement inconnu : $status');
    }
    return RentPayment(
      id: Json.string(json, 'id'),
      lease: LeaseRef.fromJson(json, 'lease'),
      cancelled: status == 'cancelled',
      method: PaymentMethod.parse(Json.string(json, 'method')),
      amount: Money.fromJson(json, 'amount'),
      receivedOn: Json.day(json, 'received_on'),
      cancelledOn: json['cancelled_on'] == null
          ? null
          : Json.day(json, 'cancelled_on'),
    );
  }
}
