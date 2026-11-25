import 'package:eguardimmo/features/messages/models/messaging_scope.dart';
import 'package:eguardimmo/features/messages/services/threads_service.dart';
import 'package:eguardimmo/features/messages/viewmodels/thread_viewmodel.dart';
import 'package:eguardimmo/features/profiles/models/profile_space.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';

const _tenant = MessagingScope(space: SpaceKind.tenant);
const _owner = MessagingScope(space: SpaceKind.owner);
const _staff = MessagingScope(
  space: SpaceKind.organization,
  organizationId: 'org-1',
  kinds: [ThreadKind.tenant, ThreadKind.owner],
);

void main() {
  late FakeApiClient api;
  late Object? Function(RecordedCall) route;

  setUp(() {
    route = (call) => null;
    api = FakeApiClient((call) => route(call));
  });

  int count(String method, String suffix) => api.calls
      .where((call) => call.method == method && call.path.endsWith(suffix))
      .length;

  group('fil ouvert', () {
    ThreadViewModel build(
      MessagingScope scope, {
      String Function()? newClientId,
    }) => ThreadViewModel(
      ThreadsService(api),
      ThreadsEndpoint(scope, kind: scope.isStaff ? ThreadKind.tenant : null),
      'c1',
      newClientId: newClientId ?? () => 'cid-fixe',
    );

    Object? tenantRoute(RecordedCall call) {
      if (call.method == 'GET' && call.path.endsWith('/messages')) {
        return apiFixture('messages/tenant_messages_after_empty');
      }
      if (call.method == 'GET') return apiFixture('messages/tenant_thread');
      if (call.method == 'PATCH') return apiFixture('messages/tenant_thread');
      return null;
    }

    test('ouverture : marque lu un fil non lu', () async {
      route = tenantRoute;
      final viewModel = build(_tenant);
      await viewModel.load();
      await Future<void>.delayed(Duration.zero);
      expect(count('PATCH', '/conversations/c1'), 1);
      expect(api.calls.firstWhere((c) => c.method == 'PATCH').body, {
        'read': true,
      });
      expect(viewModel.state.dataOrNull!.summary.unread, isFalse);
    });

    test(
      'le mandant ne marque rien comme lu (jeton personnel refusé)',
      () async {
        route = tenantRoute;
        final viewModel = build(_owner);
        await viewModel.load();
        await Future<void>.delayed(Duration.zero);
        expect(count('PATCH', '/conversations/c1'), 0);
      },
    );

    test('envoi nominal : message ajouté, brouillon libéré', () async {
      route = (call) => call.method == 'POST'
          ? apiFixture('messages/tenant_message_posted')
          : tenantRoute(call);
      final viewModel = build(_tenant);
      await viewModel.load();
      final sent = await viewModel.send('  Merci, à demain.  ');
      expect(sent, isTrue);
      expect(viewModel.sendError, isNull);
      expect(viewModel.state.dataOrNull!.messages, hasLength(3));
      final post = api.calls.firstWhere((c) => c.method == 'POST');
      expect(post.body, {'body': 'Merci, à demain.', 'client_id': 'cid-fixe'});
    });

    test('envoi vide ou espaces : rien n’est envoyé', () async {
      route = tenantRoute;
      final viewModel = build(_tenant);
      await viewModel.load();
      expect(await viewModel.send('   '), isFalse);
      expect(api.calls.where((c) => c.method == 'POST'), isEmpty);
    });

    test('échec 429 : le texte reste, même client_id au renvoi', () async {
      var attempts = 0;
      var generated = 0;
      route = (call) {
        if (call.method == 'POST') {
          attempts += 1;
          return attempts == 1
              ? apiProblem('messages/problem_rate_limited', status: 429)
              : apiFixture('messages/tenant_message_posted');
        }
        return tenantRoute(call);
      };
      final viewModel = build(_tenant, newClientId: () => 'cid-${generated++}');
      await viewModel.load();
      expect(await viewModel.send('Bonjour'), isFalse);
      expect(
        viewModel.sendError,
        'Trop de requêtes envoyées. Réessayez dans 42 s.',
      );
      expect(viewModel.state.dataOrNull!.messages, hasLength(2));
      expect(await viewModel.send('Bonjour'), isTrue);
      final ids = api.calls
          .where((c) => c.method == 'POST')
          .map((c) => (c.body! as Map<String, Object?>)['client_id'])
          .toList();
      expect(ids, ['cid-0', 'cid-0']);
      expect(viewModel.sendError, isNull);
    });

    test('un texte modifié reçoit un nouveau client_id', () async {
      var generated = 0;
      route = (call) => call.method == 'POST'
          ? apiProblem('messages/problem_rate_limited', status: 429)
          : tenantRoute(call);
      final viewModel = build(_tenant, newClientId: () => 'cid-${generated++}');
      await viewModel.load();
      await viewModel.send('Un');
      await viewModel.send('Deux');
      final ids = api.calls
          .where((c) => c.method == 'POST')
          .map((c) => (c.body! as Map<String, Object?>)['client_id'])
          .toList();
      expect(ids, ['cid-0', 'cid-1']);
    });

    test('fil fermé côté serveur : message affiché et fil rechargé', () async {
      route = (call) {
        if (call.method == 'POST') {
          return apiProblem(
            'messages/problem_conversation_closed',
            status: 409,
          );
        }
        if (call.method == 'GET' && !call.path.endsWith('/messages')) {
          return apiFixture(
            call.path.endsWith('c1') && api.calls.length > 3
                ? 'messages/tenant_thread_closed'
                : 'messages/tenant_thread',
          );
        }
        return tenantRoute(call);
      };
      final viewModel = build(_tenant);
      await viewModel.load();
      final sent = await viewModel.send('Bonjour');
      await Future<void>.delayed(Duration.zero);
      expect(sent, isFalse);
      expect(viewModel.sendError, contains('Cette conversation est fermée'));
      expect(count('GET', '/conversations/c1'), 2);
    });

    test('403 fil restreint : le message du serveur est affiché', () async {
      route = (call) => call.method == 'POST'
          ? apiProblem('messages/problem_conversation_muted', status: 403)
          : tenantRoute(call);
      final viewModel = build(_tenant);
      await viewModel.load();
      expect(await viewModel.send('Bonjour'), isFalse);
      expect(viewModel.sendError, contains("restreint l'envoi"));
    });

    test('panne réseau : message générique, texte conservé', () async {
      route = (call) =>
          call.method == 'POST' ? networkFailure() : tenantRoute(call);
      final viewModel = build(_tenant);
      await viewModel.load();
      expect(await viewModel.send('Bonjour'), isFalse);
      expect(viewModel.sendError, contains('Connexion impossible'));
    });

    test('historique : les messages plus anciens passent devant', () async {
      route = (call) {
        if (call.method == 'GET' && call.path.endsWith('/messages')) {
          return apiFixture('messages/tenant_messages_after');
        }
        if (call.method == 'GET') {
          return apiFixture('messages/tenant_thread_earlier');
        }
        return null;
      };
      final viewModel = build(_tenant);
      await viewModel.load();
      await viewModel.loadEarlier();
      final data = viewModel.state.dataOrNull!;
      expect(data.messages, hasLength(3));
      expect(data.messages.first.body, 'Le plombier passera à 9 h.');
      expect(data.hasEarlier, isFalse);
      expect(api.calls.last.query?['cursor'], 'eyJpZCI6IjEifQ');
    });

    test('l’équipe ferme le fil', () async {
      route = (call) {
        if (call.method == 'PATCH' &&
            (call.body! as Map<String, Object?>).containsKey('status')) {
          return apiFixture('messages/staff_thread_closed');
        }
        return apiFixture('messages/staff_thread');
      };
      final viewModel = build(_staff);
      await viewModel.load();
      await viewModel.setClosed(closed: true);
      expect(viewModel.state.dataOrNull!.summary.isClosed, isTrue);
      expect(api.calls.lastWhere((c) => c.method == 'PATCH').body, {
        'status': 'closed',
      });
    });

    test('le locataire ne peut pas fermer un fil', () async {
      route = tenantRoute;
      final viewModel = build(_tenant);
      await viewModel.load();
      await viewModel.setClosed(closed: true);
      expect(
        api.calls.where(
          (c) => (c.body as Map?)?.containsKey('status') ?? false,
        ),
        isEmpty,
      );
    });

    testWidgets('interrogation : un nouveau message apparaît, marqué lu', (
      tester,
    ) async {
      route = (call) {
        if (call.method == 'GET' && call.path.endsWith('/messages')) {
          return apiFixture('messages/tenant_messages_after');
        }
        return tenantRoute(call);
      };
      final viewModel = build(_tenant);
      await viewModel.load();
      viewModel.setActive(true);
      await tester.pump(const Duration(seconds: 10));
      final data = viewModel.state.dataOrNull!;
      expect(data.messages, hasLength(3));
      expect(data.summary.preview, 'Le plombier passera à 9 h.');
      expect(data.summary.counterpartReadAt, isNotNull);
      final poll = api.calls.lastWhere(
        (c) => c.method == 'GET' && c.path.endsWith('/messages'),
      );
      expect(poll.query?['after'], '01a1ef82-0000-7000-8000-000000000002');
      viewModel.setActive(false);
      viewModel.dispose();
    });

    testWidgets('interrogation : 404 définitif arrête et signale', (
      tester,
    ) async {
      route = (call) {
        if (call.method == 'GET' && call.path.endsWith('/messages')) {
          return problem(
            404,
            'conversation_not_found',
            'Conversation introuvable.',
          );
        }
        return tenantRoute(call);
      };
      final viewModel = build(_tenant);
      await viewModel.load();
      viewModel.setActive(true);
      await tester.pump(const Duration(seconds: 10));
      expect(viewModel.pollNotice, 'Conversation introuvable.');
      final before = api.calls.length;
      await tester.pump(const Duration(minutes: 10));
      expect(api.calls.length, before);
      viewModel.dispose();
    });

    testWidgets('repère inconnu (message_not_found) : le fil est rechargé', (
      tester,
    ) async {
      route = (call) {
        if (call.method == 'GET' && call.path.endsWith('/messages')) {
          return apiProblem('messages/problem_message_not_found', status: 404);
        }
        return tenantRoute(call);
      };
      final viewModel = build(_tenant);
      await viewModel.load();
      viewModel.setActive(true);
      await tester.pump(const Duration(seconds: 10));
      expect(count('GET', '/conversations/c1'), 2);
      expect(viewModel.pollNotice, isNull);
      viewModel.setActive(false);
      viewModel.dispose();
    });
  });
}
