import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:eguardimmo/features/auth/models/login_result.dart';
import 'package:eguardimmo/features/auth/services/auth_service.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';

void main() {
  late MemoryTokenStorage storage;

  AuthService service(FakeApiClient api) =>
      AuthService(api, storage, deviceName: 'eGuardImmo Android');

  setUp(() => storage = MemoryTokenStorage());

  test(
    'connexion sans 2FA : jeton lu dans data.token, appel anonyme',
    () async {
      final api = FakeApiClient((_) => Fixtures.loginToken());
      final result = await service(api)
          .login(email: 'jeanne@exemple.fr', password: 'secret');

      expect(
        result,
        isA<SignedInWithToken>().having(
          (r) => r.token,
          'token',
          Fixtures.token,
        ),
      );
      final call = api.calls.single;
      expect(call.path, '/auth/token');
      expect(call.authenticated, isFalse);
      expect(call.body, {
        'email': 'jeanne@exemple.fr',
        'password': 'secret',
        'device_name': 'eGuardImmo Android',
      });
    },
  );

  test('connexion avec 2FA : défi renvoyé, aucun jeton', () async {
    final api = FakeApiClient((_) => Fixtures.loginChallenge());
    final result = await service(api).login(email: 'a@b.fr', password: 'x');
    expect(
      result,
      isA<TwoFactorRequired>().having((r) => r.challenge.length, 'taille', 64),
    );
  });

  test('défi 2FA : code ou code de secours, jamais les deux', () async {
    final api = FakeApiClient((_) => Fixtures.loginToken());
    await service(api).completeTwoFactor(challenge: 'c' * 64, code: '123456');
    await service(api)
        .completeTwoFactor(challenge: 'c' * 64, recoveryCode: 'abcde-fghij');

    expect(api.calls[0].path, '/auth/token/two-factor');
    expect(api.calls[0].body, {'challenge': 'c' * 64, 'code': '123456'});
    expect(api.calls[1].body, {
      'challenge': 'c' * 64,
      'recovery_code': 'abcde-fghij',
    });
  });

  test('une réponse de forme inattendue lève une FormatException', () async {
    final api = FakeApiClient((_) => {'token': 'x'});
    await expectLater(
      service(api).login(email: 'a@b.fr', password: 'x'),
      throwsFormatException,
    );
  });

  test('/me : utilisateur lu dans data', () async {
    final api = FakeApiClient((_) => Fixtures.me());
    final user = await service(api).fetchMe();
    expect(user.name, 'Jeanne Martin');
    expect(user.emailVerified, isTrue);
    expect(api.calls.single.path, '/me');
  });

  test('e-mail non vérifié : email_verified_at nul', () async {
    final api = FakeApiClient((_) => Fixtures.me(verifiedAt: null));
    expect((await service(api).fetchMe()).emailVerified, isFalse);
  });

  test('déconnexion : DELETE /auth/token puis jeton effacé', () async {
    storage.token = Fixtures.token;
    final api = FakeApiClient((_) => null);
    expect(await service(api).revokeAndForget(), isTrue);
    expect(api.calls.single.method, 'DELETE');
    expect(api.calls.single.path, '/auth/token');
    expect(storage.token, isNull);
  });

  test(
    'déconnexion sans réseau : jeton local effacé, révocation non confirmée',
    () async {
      storage.token = Fixtures.token;
      final api = FakeApiClient((_) => networkFailure());
      expect(await service(api).revokeAndForget(), isFalse);
      expect(storage.token, isNull);
    },
  );

  test(
    'déconnexion avec jeton déjà invalide (401) : considérée révoquée',
    () async {
      storage.token = Fixtures.token;
      final api = FakeApiClient(
        (_) => const ApiException(
          statusCode: 401,
          message: 'x',
          code: 'unauthenticated',
        ),
      );
      expect(await service(api).revokeAndForget(), isTrue);
    },
  );
}
