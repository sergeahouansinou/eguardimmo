import '../../../core/utils/json_reader.dart';
import 'listing_enums.dart';
import 'money.dart';

enum BookingStatus(final String wire, final String label) {
  pendingPayment('pending_payment', 'Paiement à finaliser'),
  confirmed('confirmed', 'Confirmée'),
  cancelled('cancelled', 'Annulée'),
  completed('completed', 'Terminée');

  static BookingStatus parse(String value) => values.firstWhere(
    (status) => status.wire == value,
    orElse: () => throw FormatException('« status » inconnu : $value'),
  );
}

/// Annonce liée à une réservation : peut être absente (retirée du catalogue).
class const BookingListing({
  required final String ref,
  required final String title,
  required final String? city,
  required final String? neighbourhood,
  required final String? hostName,
}) {
  factory BookingListing.fromJson(Map<String, Object?> json) => BookingListing(
    ref: Json.string(json, 'ref'),
    title: Json.string(json, 'title'),
    city: Json.stringOrNull(json, 'city'),
    neighbourhood: Json.stringOrNull(json, 'neighbourhood'),
    hostName: Json.stringOrNull(Json.child(json, 'host'), 'name'),
  );
}

class const Booking({
  required final String id,
  required final String reference,
  required final BookingStatus status,
  required final BookingListing? listing,
  required final DateTime checkIn,
  required final DateTime checkOut,
  required final int nights,
  required final int guests,
  required final Money total,
  required final CancellationPolicy cancellationPolicy,
  required final DateTime? expiresAt,
  required final DateTime? cancelledAt,
  required final Money? refund,
}) {
  /// `BookingResource` : montants `{amount, currency}`, `refund` en objet
  /// (renseigné après une annulation), `expires_at` tant que le paiement est
  /// à finaliser.
  factory Booking.fromJson(Map<String, Object?> json) {
    final listing = Json.childOrNull(json, 'listing');
    return Booking(
      id: Json.string(json, 'id'),
      reference: Json.string(json, 'reference'),
      status: BookingStatus.parse(Json.string(json, 'status')),
      listing: listing == null ? null : BookingListing.fromJson(listing),
      checkIn: Json.day(json, 'check_in'),
      checkOut: Json.day(json, 'check_out'),
      nights: Json.integer(json, 'nights'),
      guests: Json.integer(json, 'guests'),
      total: Money.fromJson(json, 'total'),
      cancellationPolicy: CancellationPolicy.parse(
        Json.string(json, 'cancellation_policy'),
      ),
      expiresAt: Json.dateOrNull(json, 'expires_at'),
      cancelledAt: Json.dateOrNull(json, 'cancelled_at'),
      refund: Money.fromJsonOrNull(json, 'refund'),
    );
  }

  bool isUpcoming(DateTime today) =>
      status != BookingStatus.completed && checkOut.isAfter(today);

  bool canCancel(DateTime today) =>
      (status == BookingStatus.pendingPayment ||
          status == BookingStatus.confirmed) &&
      checkIn.isAfter(today);
}
