import 'package:eguardimmo/core/state/load_state.dart';
import 'package:eguardimmo/features/messages/models/messaging_scope.dart';
import 'package:eguardimmo/features/messages/services/threads_service.dart';
import 'package:eguardimmo/features/messages/viewmodels/new_thread_viewmodel.dart';
import 'package:eguardimmo/features/messages/viewmodels/thread_list_viewmodel.dart';
import 'package:eguardimmo/features/profiles/models/profile_space.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';

const _tenant = MessagingScope(space: SpaceKind.tenant);
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

  group('boîte de conversations', () {
    ThreadListViewModel build(MessagingScope? scope) =>
        ThreadListViewModel(ThreadsService(api))..useScope(scope);

    test('sans profil de messagerie : liste vide, aucun appel', () async {
      final viewModel = build(null);
      await viewModel.load();
      expect(viewModel.items, isEmpty);
      expect(api.calls, isEmpty);
    });

    test('charge la première page puis la suivante', () async {
      route = (call) => call.query?['cursor'] == null
          ? apiFixture('messages/tenant_threads')
          : apiFixture('messages/tenant_threads_page2');
      final viewModel = build(_tenant);
      await viewModel.load();
      expect(viewModel.items, hasLength(2));
      await viewModel.loadMore();
      expect(viewModel.items, hasLength(3));
      expect(api.calls.last.query?['cursor'], 'eyJjb25ndiI6Mn0');
      expect(viewModel.state.dataOrNull!.hasMore, isFalse);
    });

    test('liste vide', () async {
      route = (_) => apiFixture('messages/tenant_threads_empty');
      final viewModel = build(_tenant);
      await viewModel.load();
      expect(viewModel.state, isA<Loaded<Object?>>());
      expect(viewModel.items, isEmpty);
    });

    test('429 : message avec l’attente, aucune donnée inventée', () async {
      route = (_) => apiProblem('messages/problem_rate_limited', status: 429);
      final viewModel = build(_tenant);
      await viewModel.load();
      final state = viewModel.state as Failed<Object?>;
      expect(state.message, 'Trop de requêtes envoyées. Réessayez dans 42 s.');
    });

    test('403 : le message du serveur est affiché', () async {
      route = (_) => problem(
        403,
        'email_unverified',
        'Confirmez votre adresse e-mail pour accéder à cet espace.',
      );
      final viewModel = build(_tenant);
      await viewModel.load();
      expect(
        (viewModel.state as Failed<Object?>).message,
        'Confirmez votre adresse e-mail pour accéder à cet espace.',
      );
    });

    test('la page suivante en échec garde la liste et dit pourquoi', () async {
      var calls = 0;
      route = (call) {
        calls += 1;
        return calls == 1
            ? apiFixture('messages/tenant_threads')
            : apiProblem('messages/problem_rate_limited', status: 429);
      };
      final viewModel = build(_tenant);
      await viewModel.load();
      await viewModel.loadMore();
      expect(viewModel.items, hasLength(2));
      expect(viewModel.loadMoreError, contains('42 s'));
    });

    test('changer de filtre ou de type repart d’une page neuve', () async {
      route = (_) => apiFixture('messages/staff_threads');
      final viewModel = build(_staff);
      expect(viewModel.kind, ThreadKind.tenant);
      await viewModel.load();
      await viewModel.selectKind(ThreadKind.owner);
      await viewModel.selectFilter(ThreadFilter.unread);
      expect(api.calls.last.query, {
        'per_page': 25,
        'kind': 'owner',
        'tab': 'unread',
      });
    });

    testWidgets('interroge toutes les 30 s tant que l’écran est actif', (
      tester,
    ) async {
      route = (_) => apiFixture('messages/tenant_threads_empty');
      final viewModel = build(_tenant);
      await viewModel.load();
      viewModel.setActive(true);
      await tester.pump(const Duration(seconds: 29));
      expect(api.calls, hasLength(1));
      await tester.pump(const Duration(seconds: 1));
      expect(api.calls, hasLength(2));
      viewModel.setActive(false);
      await tester.pump(const Duration(minutes: 2));
      expect(api.calls, hasLength(2));
      viewModel.dispose();
    });

    testWidgets('l’interrogation en échec 429 signale l’attente', (
      tester,
    ) async {
      var calls = 0;
      route = (_) {
        calls += 1;
        return calls == 1
            ? apiFixture('messages/tenant_threads_empty')
            : apiProblem('messages/problem_rate_limited', status: 429);
      };
      final viewModel = build(_tenant);
      await viewModel.load();
      viewModel.setActive(true);
      await tester.pump(const Duration(seconds: 30));
      expect(viewModel.pollNotice, contains('42 s'));
      expect(viewModel.items, isEmpty);
      viewModel.dispose();
    });
  });

  group('nouveau fil', () {
    test('options puis ouverture idempotente', () async {
      var generated = 0;
      route = (call) => call.method == 'POST'
          ? apiFixture('messages/tenant_thread')
          : apiFixture('messages/tenant_options');
      final viewModel = NewThreadViewModel(
        ThreadsService(api),
        ThreadsEndpoint(_tenant),
        newClientId: () => 'cid-${generated++}',
      );
      await viewModel.load();
      final option = viewModel.state.dataOrNull!.single;
      await viewModel.submit(
        option: option,
        subject: ' Fuite ',
        body: ' Bonjour ',
      );
      expect(viewModel.createdId, '01a1ef81-0000-7000-8000-000000000001');
      final post = api.calls.firstWhere((c) => c.method == 'POST');
      expect(post.body, {
        'lease_id': '01a1ef80-1111-7000-8000-000000000b01',
        'subject': 'Fuite',
        'body': 'Bonjour',
        'client_id': 'cid-0',
      });
    });

    test(
      'limite de fils ouverts : message du serveur, client_id stable',
      () async {
        var generated = 0;
        route = (call) => call.method == 'POST'
            ? apiProblem('messages/problem_open_limit', status: 409)
            : apiFixture('messages/tenant_options');
        final viewModel = NewThreadViewModel(
          ThreadsService(api),
          ThreadsEndpoint(_tenant),
          newClientId: () => 'cid-${generated++}',
        );
        await viewModel.load();
        final option = viewModel.state.dataOrNull!.single;
        await viewModel.submit(
          option: option,
          subject: 'Fuite',
          body: 'Bonjour',
        );
        await viewModel.submit(
          option: option,
          subject: 'Fuite',
          body: 'Bonjour',
        );
        expect(viewModel.createdId, isNull);
        expect(viewModel.error, contains('conversations ouvertes'));
        final ids = api.calls
            .where((c) => c.method == 'POST')
            .map((c) => (c.body! as Map<String, Object?>)['client_id'])
            .toList();
        expect(ids, ['cid-0', 'cid-0']);
      },
    );

    test('aucun bail : liste d’options vide', () async {
      route = (_) => apiFixture('messages/tenant_options_empty');
      final viewModel = NewThreadViewModel(
        ThreadsService(api),
        ThreadsEndpoint(_tenant),
      );
      await viewModel.load();
      expect(viewModel.state.dataOrNull, isEmpty);
    });
  });
}
