import '../../../core/utils/json_reader.dart';

sealed class const LoginResult() {
  /// Forme de `POST /auth/token` et `POST /auth/token/two-factor`
  /// (MobileLoginResource) : `data.two_factor` puis `data.token` ou `data.challenge`.
  factory LoginResult.fromBody(Object? body) {
    final data = Json.data(body, 'connexion');
    if (Json.boolean(data, 'two_factor')) {
      return TwoFactorRequired(Json.string(data, 'challenge'));
    }
    return SignedInWithToken(Json.string(data, 'token'));
  }
}

final class const SignedInWithToken(final String token) extends LoginResult {}

final class const TwoFactorRequired(final String challenge)
    extends LoginResult {}
