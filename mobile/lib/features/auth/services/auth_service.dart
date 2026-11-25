import '../../../core/services/api_client.dart';
import '../../../core/services/api_exception.dart';
import '../../../core/services/token_storage.dart';
import '../../../core/utils/json_reader.dart';
import '../models/app_user.dart';
import '../models/login_result.dart';

class const AuthService(
  final ApiClient _api,
  final TokenStorage _tokens, {
  required final String deviceName,
}) {
  Future<LoginResult> login({
    required String email,
    required String password,
  }) async => LoginResult.fromBody(
    await _api.post(
      '/auth/token',
      authenticated: false,
      body: {'email': email, 'password': password, 'device_name': deviceName},
    ),
  );

  Future<LoginResult> completeTwoFactor({
    required String challenge,
    String? code,
    String? recoveryCode,
  }) async => LoginResult.fromBody(
    await _api.post(
      '/auth/token/two-factor',
      authenticated: false,
      body: {
        'challenge': challenge,
        'code': ?code,
        'recovery_code': ?recoveryCode,
      },
    ),
  );

  Future<AppUser> fetchMe() async =>
      AppUser.fromJson(Json.data(await _api.get('/me'), '/me'));

  Future<String?> storedToken() => _tokens.read();

  Future<void> saveToken(String token) => _tokens.write(token);

  Future<void> forgetToken() => _tokens.clear();

  /// Révoque le jeton courant côté serveur (`DELETE /auth/token`, 204), puis
  /// l'efface du stockage sécurisé. Renvoie false si la révocation n'a pas pu
  /// être confirmée : le jeton local est effacé dans tous les cas.
  Future<bool> revokeAndForget() async {
    var revoked = true;
    try {
      await _api.delete('/auth/token');
    } on ApiException catch (error) {
      revoked = error.isUnauthorized;
    }
    await _tokens.clear();
    return revoked;
  }
}
