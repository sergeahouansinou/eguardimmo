import 'package:flutter/foundation.dart';

import '../../../core/services/api_exception.dart';
import '../../../core/services/app_logger.dart';
import '../models/login_result.dart';
import '../services/auth_service.dart';
import 'session_viewmodel.dart';

enum LoginStage() {
  credentials,
  twoFactor,
}

class LoginViewModel(
  final AuthService _auth,
  final SessionViewModel _session, {
  final AppLogger _logger = const AppLogger(),
}) extends ChangeNotifier {
  static const _genericFailure =
      'Connexion impossible pour le moment. Réessayez dans un instant.';

  LoginStage _stage = LoginStage.credentials;
  String? _challenge;
  bool _busy = false;
  bool _signedIn = false;
  bool _disposed = false;
  String? _error;

  LoginStage get stage => _stage;
  bool get busy => _busy;
  bool get signedIn => _signedIn;
  String? get error => _error;

  Future<void> submitCredentials(String email, String password) => _run(
    () async {
      final result = await _auth.login(email: email.trim(), password: password);
      await _handle(result);
    },
  );

  Future<void> submitCode(String value, {required bool recovery}) =>
      _run(() async {
        final challenge = _challenge;
        if (challenge == null) {
          restart();
          return;
        }
        final result = await _auth.completeTwoFactor(
          challenge: challenge,
          code: recovery ? null : value.trim(),
          recoveryCode: recovery ? value.trim() : null,
        );
        await _handle(result);
      });

  void restart() {
    _stage = LoginStage.credentials;
    _challenge = null;
    _error = null;
    _notify();
  }

  Future<void> _handle(LoginResult result) async {
    switch (result) {
      case TwoFactorRequired(:final challenge):
        _challenge = challenge;
        _stage = LoginStage.twoFactor;
      case SignedInWithToken(:final token):
        final failure = await _session.signIn(token);
        if (failure == null) {
          _signedIn = true;
        } else {
          _error = failure;
        }
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    _busy = true;
    _error = null;
    _notify();
    try {
      await action();
    } on ApiException catch (error) {
      _error = error.message;
    } on Exception catch (error, stack) {
      _logger.error('Connexion impossible', error: error, stack: stack);
      _error = _genericFailure;
    } finally {
      _busy = false;
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
