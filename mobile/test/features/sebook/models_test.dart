import 'package:eguardimmo/features/sebook/models/amenity.dart';
import 'package:eguardimmo/features/sebook/models/booking.dart';
import 'package:eguardimmo/features/sebook/models/listing.dart';
import 'package:eguardimmo/features/sebook/models/listing_enums.dart';
import 'package:eguardimmo/features/sebook/models/place.dart';
import 'package:eguardimmo/features/sebook/models/quote.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fixtures.dart';

void main() {
  test('annonce : montants {amount, currency}, adresse exacte absente', () {
    final listing = ListingSummary.fromJson(Fixtures.listing());
    expect(listing.ref, Fixtures.listingRef);
    expect(listing.price.minor, 7400);
    expect(listing.price.currency, 'EUR');
    expect(listing.city?.name, 'Lyon');
    expect(listing.place, 'Lyon · Presqu’île');
    expect(listing.hostName, 'Agence Rhône Immo');
    expect(listing.amenities, ['wifi', 'kitchen']);
    expect(listing.minNights, 2);
    expect(listing.priceUnit.label, 'par nuit');
  });

  test('annonce : champ obligatoire manquant ou de mauvais type refusé', () {
    final broken = {...Fixtures.listing()}..remove('price');
    expect(() => ListingSummary.fromJson(broken), throwsFormatException);
    expect(
      () => ListingSummary.fromJson({
        ...Fixtures.listing(),
        'price': {'amount': '7400', 'currency': 'EUR'},
      }),
      throwsFormatException,
    );
    expect(
      () => ListingSummary.fromJson({
        ...Fixtures.listing(),
        'category': 'chateau',
      }),
      throwsFormatException,
    );
    expect(
      () => ListingSummary.fromJson({...Fixtures.listing()}..remove('ref')),
      throwsFormatException,
    );
  });

  test('annonce : ville, quartier, surface, pièces, hôte et séjour minimal peuvent manquer', () {
    final listing = ListingSummary.fromJson({
      ...Fixtures.listing(city: null, hostName: null, minNights: null),
      'neighbourhood': null,
      'area_m2': null,
      'rooms': null,
    });
    expect(listing.city, isNull);
    expect(listing.place, isNull);
    expect(listing.hostName, isNull);
    expect(listing.minNights, isNull);
    expect(listing.areaM2, isNull);
    final cityOnly = ListingSummary.fromJson({
      ...Fixtures.listing(),
      'neighbourhood': null,
    });
    expect(cityOnly.place, 'Lyon');
  });

  test('fiche : description, dépôt {amount, currency}, politique', () {
    final detail = ListingDetail.fromJson(Fixtures.listingDetail());
    expect(detail.minNights, 2);
    expect(detail.cancellationPolicy, CancellationPolicy.moderate);
    expect(detail.deposit?.minor, 30000);
    expect(detail.summary.amenities, ['wifi', 'kitchen']);
    final noDeposit = ListingDetail.fromJson(
      Fixtures.listingDetail(withDeposit: false),
    );
    expect(noDeposit.deposit, isNull);
  });

  test('équipements : libellés du référentiel, inconnu humanisé', () {
    expect(Amenities.label('air_conditioning'), 'Climatisation');
    expect(Amenities.label('sauna_prive'), 'Sauna prive');
  });

  test('page : curseur suivant, fin de liste sans curseur', () {
    final page = ListingPage.fromBody(
      Fixtures.listingsPage([Fixtures.listing()], next: 'eyJpZCI6MTJ9'),
    );
    expect(page.items, hasLength(1));
    expect(page.hasMore, isTrue);
    expect(ListingPage.fromBody(Fixtures.listingsPage([])).hasMore, isFalse);
    expect(
      () => ListingPage.fromBody({'data': <Object?>[]}),
      throwsFormatException,
    );
  });

  test('lieu, devis et plage occupée', () {
    final place = Place.fromJson(Fixtures.place());
    expect(place.label, 'Lyon (69000)');
    expect(place.country, 'FR');

    final quote = Quote.fromJson(
      Fixtures.quote()['data']! as Map<String, Object?>,
    );
    expect(quote.total.minor, 15300);
    expect(quote.serviceFee.minor, 500);
    expect(quote.available, isTrue);
    expect(quote.cancellationPolicy, CancellationPolicy.moderate);

    final range = OccupiedRange.fromJson({
      'check_in': '2027-03-10',
      'check_out': '2027-03-14',
    });
    expect(
      range.overlaps(DateTime(2027, 3, 13), DateTime(2027, 3, 16)),
      isTrue,
    );
    expect(
      range.overlaps(DateTime(2027, 3, 14), DateTime(2027, 3, 16)),
      isFalse,
    );
    expect(
      range.overlaps(DateTime(2027, 3, 8), DateTime(2027, 3, 10)),
      isFalse,
    );
  });

  group('réservation', () {
    final today = DateTime(2026, 11, 21);

    test(
      'pending_payment se lit « Paiement à finaliser », jamais « Confirmée »',
      () {
        final booking = Booking.fromJson(Fixtures.booking());
        expect(booking.status, BookingStatus.pendingPayment);
        expect(booking.status.label, 'Paiement à finaliser');
        expect(booking.status.label, isNot('Confirmée'));
      },
    );

    test('à venir / passée et annulable', () {
      final future = Booking.fromJson(Fixtures.booking());
      final past = Booking.fromJson(
        Fixtures.booking(
          status: 'completed',
          checkIn: '2026-08-04',
          checkOut: '2026-08-08',
        ),
      );
      final started = Booking.fromJson(
        Fixtures.booking(
          status: 'confirmed',
          checkIn: '2026-11-20',
          checkOut: '2026-11-25',
        ),
      );
      expect(future.isUpcoming(today), isTrue);
      expect(future.canCancel(today), isTrue);
      expect(past.isUpcoming(today), isFalse);
      expect(past.canCancel(today), isFalse);
      expect(started.canCancel(today), isFalse);
    });

    test('réservation : montants objets, hôte et ville facultatifs', () {
      final booking = Booking.fromJson(Fixtures.booking());
      expect(booking.total.minor, 15300);
      expect(booking.listing?.ref, Fixtures.listingRef);
      expect(booking.listing?.city, 'Lyon');
      expect(booking.listing?.hostName, 'Agence Rhône Immo');
      expect(booking.expiresAt, isNotNull);
      expect(booking.refund, isNull);
      expect(
        Booking.fromJson(Fixtures.booking(withListing: false)).listing,
        isNull,
      );
    });

    test('annulation : remboursement en objet', () {
      final body = Fixtures.cancelledBooking()['data']! as Map<String, Object?>;
      final booking = Booking.fromJson(body);
      expect(booking.status, BookingStatus.cancelled);
      expect(booking.refund?.minor, 15300);
      expect(booking.cancelledAt, isNotNull);
    });

    test('une réservation annulée n’est plus annulable', () {
      final cancelled = Booking.fromJson(Fixtures.booking(status: 'cancelled'));
      expect(cancelled.canCancel(today), isFalse);
    });

    test('statut ou date de format inattendu refusés', () {
      expect(
        () => Booking.fromJson(Fixtures.booking(status: 'paid')),
        throwsFormatException,
      );
      expect(
        () => Booking.fromJson(Fixtures.booking(checkIn: '12/12/2026')),
        throwsFormatException,
      );
    });
  });
}
