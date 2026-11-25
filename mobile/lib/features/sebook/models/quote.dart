import '../../../core/utils/json_reader.dart';
import 'listing_enums.dart';
import 'money.dart';

class const Quote({
  required final int nights,
  required final Money nightly,
  required final Money subtotal,
  required final Money serviceFee,
  required final Money total,
  required final CancellationPolicy cancellationPolicy,
  required final bool available,
}) {
  /// `POST /marketplace/listings/{ref}/quote` : montants recalculés par le
  /// serveur ; `available` dit si les dates sont libres.
  factory Quote.fromJson(Map<String, Object?> json) => Quote(
    nights: Json.integer(json, 'nights'),
    nightly: Money.fromJson(json, 'nightly'),
    subtotal: Money.fromJson(json, 'subtotal'),
    serviceFee: Money.fromJson(json, 'service_fee'),
    total: Money.fromJson(json, 'total'),
    cancellationPolicy: CancellationPolicy.parse(
      Json.string(json, 'cancellation_policy'),
    ),
    available: Json.boolean(json, 'available'),
  );
}

/// Plage occupée de `GET /marketplace/listings/{ref}/availability` : départ
/// exclusif, aucune identité.
class const OccupiedRange({
  required final DateTime checkIn,
  required final DateTime checkOut,
}) {
  factory OccupiedRange.fromJson(Map<String, Object?> json) => OccupiedRange(
    checkIn: Json.day(json, 'check_in'),
    checkOut: Json.day(json, 'check_out'),
  );

  bool overlaps(DateTime start, DateTime end) =>
      start.isBefore(checkOut) && checkIn.isBefore(end);
}
