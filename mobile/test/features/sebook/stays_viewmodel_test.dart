import 'package:eguardimmo/features/sebook/services/bookings_service.dart';
import 'package:eguardimmo/features/sebook/viewmodels/bookings_viewmodel.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';

void main() {
  group('Séjours', () {
    final now = DateTime(2026, 11, 21, 15);

    FakeApiClient api({int? cancelStatus, int? refund = 15300}) =>
        FakeApiClient((call) {
          if (call.method == 'POST') {
            return cancelStatus == null
                ? {
                    'data': Fixtures.booking(id: 'b1', status: 'cancelled')
                      ..['refund'] = refund == null
                          ? null
                          : Fixtures.money(refund),
                  }
                : problem(
                    cancelStatus,
                    'booking_not_cancellable',
                    'Cette réservation ne peut plus être annulée : elle est déjà annulée ou terminée, ou le séjour a commencé.',
                  );
          }
          return Fixtures.page([
            Fixtures.booking(
              id: 'b1',
              checkIn: '2026-12-12',
              checkOut: '2026-12-14',
            ),
            Fixtures.booking(
              id: 'b2',
              status: 'confirmed',
              checkIn: '2027-03-03',
              checkOut: '2027-03-07',
              reference: 'SB-2026-003902',
            ),
            Fixtures.booking(
              id: 'b3',
              status: 'completed',
              checkIn: '2026-08-04',
              checkOut: '2026-08-08',
              reference: 'SB-2026-001755',
            ),
          ]);
        });

    BookingsViewModel build(FakeApiClient fake) =>
        BookingsViewModel(BookingsService(fake), now: () => now);

    test('répartition à venir (par date croissante) et passées', () async {
      final fake = api();
      final viewModel = build(fake);
      await viewModel.load();
      expect(viewModel.upcoming.map((b) => b.id), ['b1', 'b2']);
      expect(viewModel.past.map((b) => b.id), ['b3']);
      expect(fake.calls.single.query, {'per_page': 100});
    });

    test('liste paginée : tous les curseurs sont suivis', () async {
      final fake = FakeApiClient(
        (call) => call.query!['cursor'] == 'suite'
            ? Fixtures.page([Fixtures.booking(id: 'b2')])
            : Fixtures.page([Fixtures.booking(id: 'b1')], next: 'suite'),
      );
      final viewModel = build(fake);
      await viewModel.load();
      expect(viewModel.upcoming.map((b) => b.id), ['b1', 'b2']);
    });

    test(
      'annulation : POST, réservation remplacée, remboursement annoncé',
      () async {
        final fake = api();
        final viewModel = build(fake);
        await viewModel.load();
        final outcome = await viewModel.cancel(viewModel.upcoming.first);

        expect(outcome.succeeded, isTrue);
        expect(outcome.refund?.minor, 15300);
        final post = fake.calls.firstWhere((c) => c.method == 'POST');
        expect(post.path, '/marketplace/bookings/b1/cancel');
        final updated = viewModel.state.dataOrNull!.firstWhere(
          (b) => b.id == 'b1',
        );
        expect(updated.status.wire, 'cancelled');
        expect(fake.calls.where((c) => c.method == 'GET'), hasLength(1));
      },
    );

    test('annulation sans remboursement : refund nul', () async {
      final viewModel = build(api(refund: null));
      await viewModel.load();
      final outcome = await viewModel.cancel(viewModel.upcoming.first);
      expect(outcome.succeeded, isTrue);
      expect(outcome.refund, isNull);
    });

    test(
      'annulation refusée (409) : message du serveur, état inchangé',
      () async {
        final fake = api(cancelStatus: 409);
        final viewModel = build(fake);
        await viewModel.load();
        final outcome = await viewModel.cancel(viewModel.upcoming.first);

        expect(outcome.succeeded, isFalse);
        expect(outcome.error, contains('ne peut plus être annulée'));
        expect(
          viewModel.state.dataOrNull!
              .firstWhere((b) => b.id == 'b1')
              .status
              .wire,
          'pending_payment',
        );
      },
    );

    test('compte lié : déconnexion vide les réservations', () async {
      final viewModel = build(api())..bind('u1');
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      expect(viewModel.state.dataOrNull, isNotNull);
      viewModel.bind(null);
      await Future<void>.delayed(Duration.zero);
      expect(viewModel.state.dataOrNull, isNull);
    });
  });
}
