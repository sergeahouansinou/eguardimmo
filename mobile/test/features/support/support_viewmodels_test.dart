import 'package:eguardimmo/core/state/load_state.dart';
import 'package:eguardimmo/features/profiles/models/profile_space.dart';
import 'package:eguardimmo/features/support/models/support_enums.dart';
import 'package:eguardimmo/features/support/services/support_service.dart';
import 'package:eguardimmo/features/support/viewmodels/open_ticket_viewmodel.dart';
import 'package:eguardimmo/features/support/viewmodels/support_availability_viewmodel.dart';
import 'package:eguardimmo/features/support/viewmodels/ticket_viewmodel.dart';
import 'package:eguardimmo/features/support/viewmodels/tickets_viewmodel.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';

void main() {
  late FakeApiClient api;
  late SupportService service;
  late Object? Function(RecordedCall) route;

  setUp(() {
    route = (call) => null;
    api = FakeApiClient((call) => route(call));
    service = SupportService(api);
  });

  int count(String method, String suffix) => api.calls
      .where((call) => call.method == method && call.path.endsWith(suffix))
      .length;

  group('disponibilité', () {
    test('hors horaires : état serveur affiché tel quel', () async {
      route = (_) => apiFixture('support/status_offline');
      final viewModel = SupportAvailabilityViewModel(service);
      await viewModel.load();
      expect(viewModel.state.dataOrNull!.online, isFalse);
    });

    test('503 : échec visible, pas de « en ligne » par défaut', () async {
      route = (_) =>
          apiProblem('support/problem_hours_unavailable', status: 503);
      final viewModel = SupportAvailabilityViewModel(service);
      await viewModel.load();
      final state = viewModel.state as Failed<Object?>;
      expect(state.message, contains('momentanément indisponibles'));
      expect(viewModel.state.dataOrNull, isNull);
    });
  });

  group('mes demandes', () {
    test('charge la liste', () async {
      route = (_) => apiFixture('support/tickets');
      final viewModel = TicketsViewModel(service);
      await viewModel.load();
      expect(viewModel.items.map((t) => t.reference), [
        'SUP-2026-0001',
        'SUP-2026-0002',
      ]);
    });

    test('liste vide', () async {
      route = (_) => apiFixture('support/tickets_empty');
      final viewModel = TicketsViewModel(service);
      await viewModel.load();
      expect(viewModel.items, isEmpty);
      expect(viewModel.state, isA<Loaded<Object?>>());
    });

    test('403 e-mail non vérifié : message du serveur', () async {
      route = (_) =>
          apiProblem('support/problem_email_unverified', status: 403);
      final viewModel = TicketsViewModel(service);
      await viewModel.load();
      expect(
        (viewModel.state as Failed<Object?>).message,
        'Confirmez votre adresse e-mail pour accéder à cet espace.',
      );
    });

    test('429 : attente annoncée', () async {
      route = (_) => apiProblem('support/problem_rate_limited', status: 429);
      final viewModel = TicketsViewModel(service);
      await viewModel.load();
      expect(
        (viewModel.state as Failed<Object?>).message,
        'Trop de requêtes envoyées. Réessayez dans 30 min.',
      );
    });
  });

  group('ouverture d’une demande', () {
    OpenTicketViewModel build(
      ProfileSpace space, {
      String Function()? newClientId,
    }) => OpenTicketViewModel(
      service,
      space,
      newClientId: newClientId ?? () => 'cid-fixe',
    );

    test('nominal : identifiant de la demande créée', () async {
      route = (_) => apiFixture('support/ticket_opened');
      final viewModel = build(const ProfileSpace(kind: SpaceKind.tenant));
      await viewModel.submit(
        category: TicketCategory.account,
        subject: '  Mon bail  ',
        body: ' Je ne vois pas mon bail. ',
      );
      expect(viewModel.createdId, '01a1ef90-0000-7000-8000-000000000003');
      expect(api.calls.single.body, {
        'space': 'tenant',
        'category': 'account',
        'subject': 'Mon bail',
        'body': 'Je ne vois pas mon bail.',
        'client_id': 'cid-fixe',
      });
    });

    test('profil organisation : l’identifiant est transmis', () async {
      route = (_) => apiFixture('support/ticket_opened');
      final viewModel = build(
        const ProfileSpace(kind: SpaceKind.organization, organizationId: 'o1'),
      );
      await viewModel.submit(
        category: TicketCategory.billing,
        subject: 'S',
        body: 'C',
      );
      final body = api.calls.single.body! as Map<String, Object?>;
      expect(body['space'], 'organization');
      expect(body['organization_id'], 'o1');
    });

    test('429 : limite annoncée, même client_id au renvoi', () async {
      var generated = 0;
      route = (_) => apiProblem('support/problem_rate_limited', status: 429);
      final viewModel = build(
        const ProfileSpace(kind: SpaceKind.tenant),
        newClientId: () => 'cid-${generated++}',
      );
      for (var i = 0; i < 2; i++) {
        await viewModel.submit(
          category: TicketCategory.other,
          subject: 'S',
          body: 'C',
        );
      }
      expect(viewModel.createdId, isNull);
      expect(viewModel.error, contains('Réessayez dans 30 min'));
      final ids = api.calls
          .map((c) => (c.body! as Map<String, Object?>)['client_id'])
          .toList();
      expect(ids, ['cid-0', 'cid-0']);
    });

    test('contenu modifié : nouveau client_id', () async {
      var generated = 0;
      route = (_) => apiProblem('support/problem_rate_limited', status: 429);
      final viewModel = build(
        const ProfileSpace(kind: SpaceKind.tenant),
        newClientId: () => 'cid-${generated++}',
      );
      await viewModel.submit(
        category: TicketCategory.other,
        subject: 'S',
        body: 'Un',
      );
      await viewModel.submit(
        category: TicketCategory.other,
        subject: 'S',
        body: 'Deux',
      );
      final ids = api.calls
          .map((c) => (c.body! as Map<String, Object?>)['client_id'])
          .toList();
      expect(ids, ['cid-0', 'cid-1']);
    });

    test('422 : message du serveur', () async {
      route = (_) => apiProblem('support/problem_validation', status: 422);
      final viewModel = build(const ProfileSpace(kind: SpaceKind.tenant));
      await viewModel.submit(
        category: TicketCategory.other,
        subject: '',
        body: 'C',
      );
      expect(viewModel.error, 'Le sujet est obligatoire.');
    });

    test('403 espace refusé : message du serveur', () async {
      route = (_) => problem(
        403,
        'support_space_forbidden',
        'Vous n’avez pas accès à cet espace.',
      );
      final viewModel = build(const ProfileSpace(kind: SpaceKind.owner));
      await viewModel.submit(
        category: TicketCategory.other,
        subject: 'S',
        body: 'C',
      );
      expect(viewModel.error, 'Vous n’avez pas accès à cet espace.');
    });
  });

  group('fil d’une demande', () {
    TicketViewModel build({String Function()? newClientId}) => TicketViewModel(
      service,
      't1',
      newClientId: newClientId ?? () => 'cid-fixe',
    );

    Object? ticketRoute(RecordedCall call) {
      if (call.method == 'GET' && call.path.endsWith('/messages')) {
        return apiFixture('support/ticket_messages_after_empty');
      }
      if (call.method == 'GET') return apiFixture('support/ticket');
      if (call.method == 'PATCH') return apiFixture('support/ticket_resolved');
      return null;
    }

    test(
      'ouverture : une réponse du support non lue est marquée lue',
      () async {
        route = ticketRoute;
        final viewModel = build();
        await viewModel.load();
        await Future<void>.delayed(Duration.zero);
        expect(count('PATCH', '/support/tickets/t1'), 1);
        expect(api.calls.last.body, {'read': true});
      },
    );

    test('réponse nominale : détail remplacé, client_id transmis', () async {
      route = (call) => call.method == 'POST'
          ? apiFixture('support/ticket_replied')
          : ticketRoute(call);
      final viewModel = build();
      await viewModel.load();
      expect(
        await viewModel.send(' Il indique « identifiants invalides ». '),
        isTrue,
      );
      expect(viewModel.state.dataOrNull!.messages, hasLength(3));
      final post = api.calls.firstWhere((c) => c.method == 'POST');
      expect(post.body, {
        'body': 'Il indique « identifiants invalides ».',
        'client_id': 'cid-fixe',
      });
    });

    test(
      'échec 429 : le texte reste à renvoyer avec le même client_id',
      () async {
        var attempts = 0;
        var generated = 0;
        route = (call) {
          if (call.method == 'POST') {
            attempts += 1;
            return attempts == 1
                ? apiProblem('support/problem_rate_limited', status: 429)
                : apiFixture('support/ticket_replied');
          }
          return ticketRoute(call);
        };
        final viewModel = build(newClientId: () => 'cid-${generated++}');
        await viewModel.load();
        expect(await viewModel.send('Bonjour'), isFalse);
        expect(viewModel.sendError, contains('30 min'));
        expect(await viewModel.send('Bonjour'), isTrue);
        final ids = api.calls
            .where((c) => c.method == 'POST')
            .map((c) => (c.body! as Map<String, Object?>)['client_id'])
            .toList();
        expect(ids, ['cid-0', 'cid-0']);
      },
    );

    testWidgets('interrogation toutes les 10 s, nouveaux messages fusionnés', (
      tester,
    ) async {
      route = (call) {
        if (call.method == 'GET' && call.path.endsWith('/messages')) {
          return apiFixture('support/ticket_messages_after');
        }
        return ticketRoute(call);
      };
      final viewModel = build();
      await viewModel.load();
      viewModel.setActive(true);
      await tester.pump(const Duration(seconds: 10));
      final data = viewModel.state.dataOrNull!;
      expect(data.messages, hasLength(3));
      expect(data.messages.last.body, 'Merci, nous regardons.');
      final poll = api.calls.lastWhere(
        (c) => c.method == 'GET' && c.path.endsWith('/messages'),
      );
      expect(poll.query?['after'], '01a1ef91-0000-7000-8000-000000000002');
      viewModel.setActive(false);
      viewModel.dispose();
    });

    testWidgets('une demande résolue n’est plus interrogée', (tester) async {
      route = (call) => call.method == 'GET'
          ? apiFixture('support/ticket_resolved')
          : ticketRoute(call);
      final viewModel = build();
      await viewModel.load();
      viewModel.setActive(true);
      await tester.pump(const Duration(seconds: 40));
      expect(count('GET', '/messages'), 0);
      viewModel.setActive(false);
      viewModel.dispose();
    });

    testWidgets('429 pendant l’interrogation : attente annoncée', (
      tester,
    ) async {
      route = (call) {
        if (call.method == 'GET' && call.path.endsWith('/messages')) {
          return apiProblem('support/problem_rate_limited', status: 429);
        }
        return ticketRoute(call);
      };
      final viewModel = build();
      await viewModel.load();
      viewModel.setActive(true);
      await tester.pump(const Duration(seconds: 10));
      expect(viewModel.pollNotice, contains('30 min'));
      viewModel.setActive(false);
      viewModel.dispose();
    });
  });
}
