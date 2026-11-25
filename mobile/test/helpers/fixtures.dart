/// Réponses reproduisant la forme des vrais endpoints : MobileLoginResource,
/// UserResource et ProfileResource (Identity) ; PlaceResource, ListingCardResource,
/// PublicListingResource, QuoteResource, BookingResource et OccupiedRangeResource
/// (Geography, Listings, Bookings).
abstract final class Fixtures() {
  static const token = '7|AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';

  static Map<String, Object?> loginToken() => {
    'data': {'two_factor': false, 'token': token},
  };

  static Map<String, Object?> loginChallenge() => {
    'data': {'two_factor': true, 'challenge': 'c' * 64},
  };

  static Map<String, Object?> me({
    String? verifiedAt = '2026-11-20T09:00:00+00:00',
  }) => {
    'data': {
      'id': '0193d2a0-0000-7000-8000-000000000001',
      'name': 'Jeanne Martin',
      'email': 'jeanne@exemple.fr',
      'email_verified_at': verifiedAt,
      'phone': null,
      'last_login_at': '2026-11-21T08:00:00+00:00',
      'previous_login_at': null,
    },
  };

  static Map<String, Object?> profiles(List<Map<String, Object?>> entries) => {
    'data': entries,
  };

  static Map<String, Object?> tenantProfile() => {
    'space': 'tenant',
    'label': 'Locataire',
    'meta': {'leases': 1},
  };

  static Map<String, Object?> ownerProfile() => {
    'space': 'owner',
    'label': 'Propriétaire mandant',
    'meta': {'links': 2},
  };

  static Map<String, Object?> organizationProfile({
    required String kind,
    String name = 'Agence Rhône Immo',
    String id = '0193d2a0-0000-7000-8000-0000000000aa',
  }) => {
    'space': 'organization',
    'label': name,
    'meta': {'organization': id, 'kind': kind, 'role': 'owner'},
  };

  static Map<String, Object?> operatorProfile() => {
    'space': 'operator',
    'label': 'Console',
    'meta': <String, Object?>{},
  };

  static const listingRef = 'k3m7q9x2v8nb';
  static const otherListingRef = 't4w6y8z2c5hd';
  static const bookingId = '0193a5e3-0000-7000-8000-0000000000b1';

  static Map<String, Object?> money(int amount) => {
    'amount': amount,
    'currency': 'EUR',
  };

  static Map<String, Object?> listing({
    String ref = listingRef,
    String title = 'Studio lumineux, Presqu’île',
    String category = 'studio',
    String kind = 'short_stay',
    int priceMinor = 7400,
    Map<String, Object?>? city = const {
      'slug': 'lyon',
      'name': 'Lyon',
      'postal_code': '69002',
    },
    String? hostName = 'Agence Rhône Immo',
    int? minNights = 2,
  }) => {
    'ref': ref,
    'kind': kind,
    'category': category,
    'title': title,
    'city': city,
    'neighbourhood': 'Presqu’île',
    'price': money(priceMinor),
    'price_unit': kind == 'short_stay' ? 'night' : 'month',
    'capacity': 2,
    'rooms': 1,
    'area_m2': 28,
    'amenities': ['wifi', 'kitchen'],
    'min_nights': minNights,
    'host': {'name': hostName},
  };

  static Map<String, Object?> listingDetail({
    String ref = listingRef,
    String kind = 'short_stay',
    Map<String, Object?>? deposit,
    bool withDeposit = true,
  }) => {
    ...listing(ref: ref, kind: kind),
    'description': 'Studio de 28 m² au 3e étage avec ascenseur.\nLinge fourni.',
    'deposit': withDeposit ? (deposit ?? money(30000)) : null,
    'cancellation_policy': 'moderate',
    'published_at': '2026-11-01T10:00:00+00:00',
  };

  static Map<String, Object?> page(
    List<Map<String, Object?>> items, {
    String? next,
  }) => {
    'data': items,
    'meta': {'has_more': next != null, 'next_cursor': next},
  };

  static Map<String, Object?> listingsPage(
    List<Map<String, Object?>> items, {
    String? next,
  }) => page(items, next: next);

  static Map<String, Object?> place({
    String slug = 'lyon',
    String name = 'Lyon',
  }) => {'slug': slug, 'name': name, 'postal_code': '69000', 'country': 'FR'};

  static Map<String, Object?> places(List<Map<String, Object?>> items) => {
    'data': items,
  };

  static Map<String, Object?> availability(List<(String, String)> ranges) => {
    'data': [
      for (final (checkIn, checkOut) in ranges)
        {'check_in': checkIn, 'check_out': checkOut},
    ],
  };

  static Map<String, Object?> quote({bool available = true}) => {
    'data': {
      'nights': 2,
      'nightly': money(7400),
      'subtotal': money(14800),
      'service_fee': money(500),
      'total': money(15300),
      'cancellation_policy': 'moderate',
      'available': available,
    },
  };

  static Map<String, Object?> visitRequest() => {
    'data': {
      'id': '0193a5e3-0000-7000-8000-0000000000c1',
      'status': 'new',
      'requested_slot': 'samedi 10 h',
      'created_at': '2026-11-21T10:00:00+00:00',
    },
  };

  static Map<String, Object?> booking({
    String id = bookingId,
    String status = 'pending_payment',
    String checkIn = '2027-03-20',
    String checkOut = '2027-03-22',
    String reference = 'SB-2027-000187',
    bool withListing = true,
    String? expiresAt = '2027-01-01T10:30:00+00:00',
    Map<String, Object?>? refund,
    String? cancelledAt,
  }) => {
    'id': id,
    'reference': reference,
    'status': status,
    'payment': status == 'pending_payment' ? 'to_finalize' : null,
    'listing': withListing
        ? {
            'ref': listingRef,
            'title': 'Studio lumineux, Presqu’île',
            'city': 'Lyon',
            'neighbourhood': 'Presqu’île',
            'host': {'name': 'Agence Rhône Immo'},
          }
        : null,
    'check_in': checkIn,
    'check_out': checkOut,
    'nights': 2,
    'guests': 2,
    'nightly': money(7400),
    'subtotal': money(14800),
    'service_fee': money(500),
    'total': money(15300),
    'cancellation_policy': 'moderate',
    'expires_at': status == 'pending_payment' ? expiresAt : null,
    'cancelled_at': cancelledAt,
    'cancel_reason': status == 'cancelled' ? 'traveler_cancelled' : null,
    'refund': refund,
  };

  static Map<String, Object?> cancelledBooking({int? refund = 15300}) => {
    'data': booking(
      status: 'cancelled',
      refund: refund == null ? null : money(refund),
      cancelledAt: '2026-11-21T09:00:00+00:00',
    ),
  };
}
