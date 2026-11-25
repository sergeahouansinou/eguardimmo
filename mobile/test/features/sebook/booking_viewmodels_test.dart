import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:eguardimmo/features/sebook/models/listing.dart';
import 'package:eguardimmo/features/sebook/services/bookings_service.dart';
import 'package:eguardimmo/features/sebook/services/marketplace_service.dart';
import 'package:eguardimmo/features/sebook/viewmodels/reserve_viewmodel.dart';
import 'package:eguardimmo/features/sebook/viewmodels/visit_request_viewmodel.dart';
import 'package:flutter/material.dart' show DateTimeRange;
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';

void main() {
  group('Demande de visite', () {
    VisitRequestViewModel build(FakeApiClient api) =>
        VisitRequestViewModel(MarketplaceService(api), Fixtures.listingRef);

    test(
      'envoie requested_slot et message, marque la demande envoyée',
      () async {
        final api = FakeApiClient((_) => Fixtures.visitRequest());
        final viewModel = build(api);
        await viewModel.submit(
          slot: ' samedi 10 h ',
          message: 'Nous sommes deux.',
        );
        expect(viewModel.sent, isTrue);
        expect(
          api.calls.single.path,
          '/marketplace/listings/${Fixtures.listingRef}/visit-requests',
        );
        expect(api.calls.single.body, {
          'requested_slot': 'samedi 10 h',
          'message': 'Nous sommes deux.',
        });
      },
    );

    test('message vide : champ omis', () async {
      final api = FakeApiClient((_) => Fixtures.visitRequest());
      final viewModel = build(api);
      await viewModel.submit(slot: 'samedi 10 h', message: '  ');
      expect(api.calls.single.body, {'requested_slot': 'samedi 10 h'});
    });

    test('limite de 5 par heure (429) : message avec délai', () async {
      final api = FakeApiClient(
        (_) => const ApiException(
          statusCode: 429,
          message: 'Trop de demandes.',
          code: 'too_many_requests',
          retryAfterSeconds: 120,
        ),
      );
      final viewModel = build(api);
      await viewModel.submit(slot: 'x', message: 'y');
      expect(viewModel.sent, isFalse);
      expect(viewModel.error, 'Trop de demandes. Réessayez dans 120 s.');
    });

    test('e-mail non vérifié (403) : message du serveur', () async {
      final api = FakeApiClient(
        (_) => problem(
          403,
          'email_unverified',
          'Confirmez votre adresse e-mail pour accéder à cet espace.',
        ),
      );
      final viewModel = build(api);
      await viewModel.submit(slot: 'x', message: '');
      expect(viewModel.error, contains('Confirmez votre adresse e-mail'));
    });
  });

  group('Réservation', () {
    final detail = ListingDetail.fromJson(Fixtures.listingDetail());
    final today = DateTime(2026, 11, 21, 15);
    final range = DateTimeRange(
      start: DateTime(2026, 12, 12),
      end: DateTime(2026, 12, 14),
    );

    ReserveViewModel build(FakeApiClient api) => ReserveViewModel(
      MarketplaceService(api),
      BookingsService(api),
      detail,
      now: () => today,
    );

    FakeApiClient happyApi({
      List<(String, String)> occupied = const [],
      bool available = true,
    }) => FakeApiClient((call) {
      if (call.path.endsWith('/availability')) {
        return Fixtures.availability(occupied);
      }
      if (call.path.endsWith('/quote')) {
        return Fixtures.quote(available: available);
      }
      return {'data': Fixtures.booking()};
    });

    Iterable<RecordedCall> posts(FakeApiClient api, String path) =>
        api.calls.where((c) => c.method == 'POST' && c.path == path);

    test('devis puis réservation avec clé d’idempotence', () async {
      final api = happyApi();
      final viewModel = build(api);
      await viewModel.setRange(range);
      expect(viewModel.quote!.total.minor, 15300);
      final quote = api.calls.single;
      expect(quote.path, '/marketplace/listings/${Fixtures.listingRef}/quote');
      expect(quote.body, {
        'check_in': '2026-12-12',
        'check_out': '2026-12-14',
        'guests': 1,
      });
      expect(quote.authenticated, isFalse);

      await viewModel.confirm();
      expect(viewModel.created, isTrue);
      final create = api.calls.last;
      expect(create.path, '/marketplace/bookings');
      expect(create.headers!['Idempotency-Key'], hasLength(36));
      expect(create.body, {
        'listing_ref': Fixtures.listingRef,
        'check_in': '2026-12-12',
        'check_out': '2026-12-14',
        'guests': 1,
      });
      expect(create.body.toString(), isNot(contains('total')));
    });

    test('disponibilités : fenêtre de 366 jours à partir de demain', () async {
      final api = happyApi(occupied: [('2026-12-20', '2026-12-24')]);
      final viewModel = build(api);
      await viewModel.loadAvailability();

      final call = api.calls.single;
      expect(
        call.path,
        '/marketplace/listings/${Fixtures.listingRef}/availability',
      );
      expect(call.query, {'from': '2026-11-22', 'to': '2027-11-23'});
      expect(viewModel.occupied.single.checkOut, DateTime(2026, 12, 24));
      expect(viewModel.firstDay, DateTime(2026, 11, 22));
      expect(viewModel.lastDay, DateTime(2027, 11, 22));
    });

    test(
      'plage chevauchant une période occupée : refusée sans devis',
      () async {
        final api = happyApi(occupied: [('2026-12-13', '2026-12-16')]);
        final viewModel = build(api);
        await viewModel.loadAvailability();
        await viewModel.setRange(range);

        expect(viewModel.error, ReserveViewModel.datesTaken);
        expect(viewModel.canConfirm, isFalse);
        expect(api.calls.where((c) => c.path.endsWith('/quote')), isEmpty);
      },
    );

    test(
      'arrivée le jour du départ d’une autre réservation : acceptée',
      () async {
        final api = happyApi(occupied: [('2026-12-08', '2026-12-12')]);
        final viewModel = build(api);
        await viewModel.loadAvailability();
        await viewModel.setRange(range);

        expect(viewModel.error, isNull);
        expect(viewModel.quote, isNotNull);
      },
    );

    test(
      'devis available:false : dates refusées, pas de réservation',
      () async {
        final api = happyApi(available: false);
        final viewModel = build(api);
        await viewModel.setRange(range);

        expect(viewModel.quote, isNull);
        expect(viewModel.error, ReserveViewModel.datesTaken);
        await viewModel.confirm();
        expect(posts(api, '/marketplace/bookings'), isEmpty);
      },
    );

    test(
      'disponibilités non vérifiables : avertissement, réservation possible',
      () async {
        final api = FakeApiClient((call) {
          if (call.path.endsWith('/availability')) return networkFailure();
          return call.path.endsWith('/quote')
              ? Fixtures.quote()
              : {'data': Fixtures.booking()};
        });
        final viewModel = build(api);
        await viewModel.loadAvailability();
        expect(
          viewModel.availabilityNotice,
          ReserveViewModel.availabilityUnverified,
        );

        await viewModel.setRange(range);
        expect(viewModel.canConfirm, isTrue);
      },
    );

    test('rejouer après une panne réutilise la même clé', () async {
      var fail = true;
      final api = FakeApiClient((call) {
        if (call.path.endsWith('/quote')) return Fixtures.quote();
        return fail ? networkFailure() : {'data': Fixtures.booking()};
      });
      final viewModel = build(api);
      await viewModel.setRange(range);
      await viewModel.confirm();
      expect(viewModel.created, isFalse);
      expect(viewModel.error, contains('Connexion impossible'));
      fail = false;
      await viewModel.confirm();

      final keys = posts(
        api,
        '/marketplace/bookings',
      ).map((c) => c.headers!['Idempotency-Key']).toList();
      expect(keys, hasLength(2));
      expect(keys.first, keys.last);
      expect(viewModel.created, isTrue);
    });

    test('changer les dates change la clé', () async {
      final api = happyApi();
      final viewModel = build(api);
      await viewModel.setRange(range);
      await viewModel.confirm();
      final first = api.calls.last.headers!['Idempotency-Key'];

      await viewModel.setRange(
        DateTimeRange(
          start: DateTime(2026, 12, 20),
          end: DateTime(2026, 12, 23),
        ),
      );
      expect(viewModel.created, isTrue);
      expect(first, isNotNull);

      final other = build(api);
      await other.setRange(range);
      await other.setRange(
        DateTimeRange(
          start: DateTime(2026, 12, 20),
          end: DateTime(2026, 12, 23),
        ),
      );
      await other.confirm();
      expect(api.calls.last.headers!['Idempotency-Key'], isNot(first));
    });

    test('séjour sous le minimum : refusé sans appel de devis', () async {
      final api = happyApi();
      final viewModel = build(api);
      await viewModel.setRange(
        DateTimeRange(
          start: DateTime(2026, 12, 12),
          end: DateTime(2026, 12, 13),
        ),
      );
      expect(viewModel.error, 'Séjour minimum : 2 nuits.');
      expect(viewModel.canConfirm, isFalse);
      expect(api.calls, isEmpty);
    });

    test(
      'dates_unavailable (409) : message clair et disponibilités relues',
      () async {
        final api = FakeApiClient((call) {
          if (call.path.endsWith('/availability')) {
            return Fixtures.availability([('2026-12-12', '2026-12-14')]);
          }
          return call.path.endsWith('/quote')
              ? Fixtures.quote()
              : problem(
                  409,
                  'dates_unavailable',
                  'Ces dates ne sont plus disponibles pour ce logement : choisissez d’autres dates.',
                );
        });
        final viewModel = build(api);
        await viewModel.setRange(range);
        await viewModel.confirm();
        await Future<void>.delayed(Duration.zero);

        expect(viewModel.created, isFalse);
        expect(viewModel.error, contains('ne sont plus disponibles'));
        expect(viewModel.occupied, hasLength(1));
      },
    );

    test('erreurs métier 422 : message du serveur affiché', () async {
      final api = FakeApiClient(
        (call) => call.path.endsWith('/quote')
            ? problem(
                422,
                'guests_exceed_capacity',
                'Le nombre de voyageurs dépasse la capacité du logement.',
              )
            : null,
      );
      final viewModel = build(api);
      await viewModel.setRange(range);
      expect(viewModel.error, contains('dépasse la capacité'));
    });

    test('nombre de voyageurs borné par la capacité', () async {
      final viewModel = build(happyApi());
      await viewModel.setGuests(3);
      expect(viewModel.guests, 1);
      await viewModel.setGuests(2);
      expect(viewModel.guests, 2);
    });
  });
}
