import 'package:eguardimmo/features/auth/services/auth_service.dart';
import 'package:eguardimmo/features/auth/viewmodels/login_viewmodel.dart';
import 'package:eguardimmo/features/auth/viewmodels/session_viewmodel.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';

void main() {
  late MemoryTokenStorage storage;
  late SessionViewModel session;

  LoginViewModel build(FakeHandler handler) {
    final api = FakeApiClient(handler, storage: storage);
    final auth = AuthService(api, storage, deviceName: 'test');
    session = SessionViewModel(auth);
    return LoginViewModel(auth, session);
  }

  setUp(() => storage = MemoryTokenStorage());

  test(
    'chemin nominal : jeton stocké, compte chargé, connexion terminée',
    () async {
      final viewModel = build(
        (call) =>
            call.path == '/auth/token' ? Fixtures.loginToken() : Fixtures.me(),
      );
      await viewModel.submitCredentials(' jeanne@exemple.fr ', 'secret');

      expect(viewModel.signedIn, isTrue);
      expect(viewModel.error, isNull);
      expect(storage.token, Fixtures.token);
      expect(session.user?.name, 'Jeanne Martin');
    },
  );

  test(
    'mauvais identifiants (422) : message du serveur, rien de stocké',
    () async {
      final viewModel = build(
        (_) => problem(
          422,
          'validation_failed',
          'Ces identifiants ne correspondent pas à nos enregistrements.',
          fieldErrors: {
            'email': [
              'Ces identifiants ne correspondent pas à nos enregistrements.',
            ],
          },
        ),
      );
      await viewModel.submitCredentials('a@b.fr', 'mauvais');
      expect(viewModel.signedIn, isFalse);
      expect(viewModel.error, contains('ne correspondent pas'));
      expect(storage.token, isNull);
    },
  );

  test('compte à 2FA : étape code, puis connexion avec le défi', () async {
    final viewModel = build(
      (call) => switch (call.path) {
        '/auth/token' => Fixtures.loginChallenge(),
        '/auth/token/two-factor' => Fixtures.loginToken(),
        _ => Fixtures.me(),
      },
    );
    await viewModel.submitCredentials('a@b.fr', 'secret');
    expect(viewModel.stage, LoginStage.twoFactor);
    expect(storage.token, isNull);

    await viewModel.submitCode('123456', recovery: false);
    expect(viewModel.signedIn, isTrue);
    expect(storage.token, Fixtures.token);
  });

  test('code erroné : message affiché, l’étape reste ouverte', () async {
    final viewModel = build(
      (call) => switch (call.path) {
        '/auth/token' => Fixtures.loginChallenge(),
        _ => problem(422, 'validation_failed', 'Code invalide ou défi expiré.'),
      },
    );
    await viewModel.submitCredentials('a@b.fr', 'secret');
    await viewModel.submitCode('000000', recovery: false);
    expect(viewModel.stage, LoginStage.twoFactor);
    expect(viewModel.error, 'Code invalide ou défi expiré.');
    viewModel.restart();
    expect(viewModel.stage, LoginStage.credentials);
    expect(viewModel.error, isNull);
  });

  test('compte suspendu (403) : le message du serveur est montré', () async {
    final viewModel = build(
      (_) => problem(403, 'account_suspended', 'Ce compte est suspendu.'),
    );
    await viewModel.submitCredentials('a@b.fr', 'secret');
    expect(viewModel.error, 'Ce compte est suspendu.');
  });

  test('limitation de débit (429) : message visible', () async {
    final viewModel = build(
      (_) => problem(
        429,
        'too_many_requests',
        'Trop de tentatives. Réessayez plus tard.',
      ),
    );
    await viewModel.submitCredentials('a@b.fr', 'secret');
    expect(viewModel.error, contains('Trop de tentatives'));
  });

  test('réponse inattendue : message générique, pas de connexion', () async {
    final viewModel = build((_) => {'oops': 1});
    await viewModel.submitCredentials('a@b.fr', 'secret');
    expect(viewModel.signedIn, isFalse);
    expect(viewModel.error, contains('Connexion impossible'));
  });
}
