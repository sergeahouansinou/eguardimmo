import '../../../core/models/money.dart';
import '../../../core/utils/json_reader.dart';
import 'installment.dart';

class const RentReceipt({
  required final String id,
  required final String number,
  required final LeaseRef lease,
  required final Money total,
  required final DateTime issuedOn,
  required final bool isVoid,
  final DateTime? periodStart,
  final DateTime? periodEnd,
  final String? propertyName,
}) {
  factory RentReceipt.fromJson(Map<String, Object?> json) {
    final period = Json.childOrNull(json, 'period');
    final unit = Json.childOrNull(json, 'unit');
    return RentReceipt(
      id: Json.string(json, 'id'),
      number: Json.string(json, 'number'),
      lease: LeaseRef.fromJson(json, 'lease'),
      total: Money.fromJson(Json.child(json, 'amounts'), 'total'),
      issuedOn: Json.day(json, 'issued_on'),
      isVoid: Json.boolean(json, 'is_void'),
      periodStart: period == null || period['start'] == null
          ? null
          : Json.day(period, 'start'),
      periodEnd: period == null || period['end'] == null
          ? null
          : Json.day(period, 'end'),
      propertyName: unit == null
          ? null
          : Json.stringOrNull(unit, 'property_name'),
    );
  }
}
