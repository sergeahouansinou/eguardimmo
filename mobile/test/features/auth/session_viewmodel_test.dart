import 'package:eguardimmo/features/auth/services/auth_service.dart';
import 'package:eguardimmo/features/auth/viewmodels/session_viewmodel.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';

void main() {
  late MemoryTokenStorage storage;
  late FakeApiClient api;

  SessionViewModel build(FakeHandler handler) {
    api = FakeApiClient(handler, storage: storage);
    final session = SessionViewModel(
      AuthService(api, storage, deviceName: 'test'),
    );
    api.onSessionExpired = session.expire;
    return session;
  }

  setUp(() => storage = MemoryTokenStorage());

  test('sans jeton stocké : déconnecté, aucun appel réseau', () async {
    final session = build((_) => fail('aucun appel attendu'));
    await session.bootstrap();
    expect(session.state, isA<SignedOut>());
    expect(api.calls, isEmpty);
  });

  test('jeton valide : connecté avec le compte du serveur', () async {
    storage.token = Fixtures.token;
    final session = build((_) => Fixtures.me());
    await session.bootstrap();
    expect(session.user?.email, 'jeanne@exemple.fr');
  });

  test('jeton rejeté (401) : déconnecté avec message d’expiration', () async {
    storage.token = Fixtures.token;
    final session = build(
      (_) => problem(401, 'unauthenticated', 'Authentification requise.'),
    );
    await session.bootstrap();
    expect(
      session.state,
      isA<SignedOut>().having(
        (s) => s.notice,
        'notice',
        SessionViewModel.expiredNotice,
      ),
    );
  });

  test('réseau coupé : non vérifiable, le jeton est conservé', () async {
    storage.token = Fixtures.token;
    final session = build((_) => networkFailure());
    await session.bootstrap();
    expect(session.state, isA<SessionUnverifiable>());
    expect(storage.token, Fixtures.token);
  });

  test(
    'réponse illisible : non vérifiable (journalisée), jeton conservé',
    () async {
      storage.token = Fixtures.token;
      final session = build((_) => {'inattendu': true});
      await session.bootstrap();
      expect(session.state, isA<SessionUnverifiable>());
      expect(storage.token, Fixtures.token);
    },
  );

  test('signIn : enregistre le jeton puis charge le compte', () async {
    final session = build((_) => Fixtures.me());
    expect(await session.signIn(Fixtures.token), isNull);
    expect(storage.token, Fixtures.token);
    expect(session.isSignedIn, isTrue);
  });

  test('signIn pendant une session ouverte : déconnexion propre du compte A '
      'avant d’ouvrir B', () async {
    storage.token = Fixtures.token;
    final session = build((_) => Fixtures.me());
    await session.bootstrap();
    expect(session.isSignedIn, isTrue);

    final seen = <Type>[];
    session.addListener(() => seen.add(session.state.runtimeType));
    expect(await session.signIn('8|jeton-du-compte-b'), isNull);

    expect(seen, [SignedOut, SignedIn]);
    expect(api.calls.map((c) => '${c.method} ${c.path}'), [
      'GET /me',
      'DELETE /auth/token',
      'GET /me',
    ]);
    expect(storage.token, '8|jeton-du-compte-b');
  });

  test('signIn dont /me échoue : jeton retiré, message renvoyé', () async {
    final session = build((_) => networkFailure());
    expect(
      await session.signIn(Fixtures.token),
      contains('Connexion impossible'),
    );
    expect(storage.token, isNull);
    expect(session.state, isA<SignedOut>());
  });

  test('signOut : jeton révoqué côté serveur puis effacé', () async {
    storage.token = Fixtures.token;
    final session = build((call) => call.path == '/me' ? Fixtures.me() : null);
    await session.bootstrap();

    expect(await session.signOut(), isTrue);
    expect(session.state, isA<SignedOut>());
    expect(storage.token, isNull);
    expect(
      api.calls.map((c) => '${c.method} ${c.path}'),
      contains('DELETE /auth/token'),
    );
  });

  test('session expirée en cours d’usage : retour déconnecté', () async {
    storage.token = Fixtures.token;
    final session = build((_) => Fixtures.me());
    await session.bootstrap();
    api.onSessionExpired!.call();
    expect(session.state, isA<SignedOut>());
  });
}
