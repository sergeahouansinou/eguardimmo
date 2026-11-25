import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/services/api_exception.dart';
import '../../../core/services/app_logger.dart';
import '../models/app_user.dart';
import '../services/auth_service.dart';

sealed class const SessionState();

final class const SessionChecking() extends SessionState;

final class const SignedOut({final String? notice}) extends SessionState {}

final class const SignedIn(final AppUser user) extends SessionState {}

/// Un jeton est stocké mais le serveur n'a pas pu confirmer la session
/// (réseau, panne) : ni connecté ni déconnecté, on ne casse pas le jeton.
final class const SessionUnverifiable(final String message)
    extends SessionState {}

class SessionViewModel(
  final AuthService _auth, {
  final AppLogger _logger = const AppLogger(),
}) extends ChangeNotifier {
  static const expiredNotice = 'Votre session a expiré. Reconnectez-vous.';
  static const _genericFailure =
      'Impossible de vérifier votre session pour le moment.';

  SessionState _state = const SessionChecking();
  bool _disposed = false;

  SessionState get state => _state;

  AppUser? get user => switch (_state) {
    SignedIn(:final user) => user,
    _ => null,
  };

  bool get isSignedIn => user != null;

  Future<void> bootstrap() async {
    _emit(const SessionChecking());
    final String? token;
    try {
      token = await _auth.storedToken();
    } on Exception catch (error, stack) {
      _logger.error('Lecture du jeton impossible', error: error, stack: stack);
      _emit(const SessionUnverifiable(_genericFailure));
      return;
    }
    if (token == null) {
      _emit(const SignedOut());
      return;
    }
    await _loadUser(keepTokenOnFailure: true);
  }

  /// Enregistre le jeton reçu puis charge le compte. Une session déjà ouverte
  /// est fermée d'abord : aucun état du compte précédent ne survit au suivant.
  /// Renvoie un message d'erreur, ou null en cas de succès.
  Future<String?> signIn(String token) async {
    if (isSignedIn) await signOut();
    await _auth.saveToken(token);
    final failure = await _loadUser(keepTokenOnFailure: false);
    return failure;
  }

  /// Renvoie false quand la révocation côté serveur n'a pas pu être confirmée.
  Future<bool> signOut() async {
    final revoked = await _auth.revokeAndForget();
    _emit(const SignedOut());
    return revoked;
  }

  void expire() => _emit(const SignedOut(notice: expiredNotice));

  Future<String?> _loadUser({required bool keepTokenOnFailure}) async {
    try {
      _emit(SignedIn(await _auth.fetchMe()));
      return null;
    } on ApiException catch (error) {
      if (error.isUnauthorized) {
        if (_state is! SignedOut) _emit(const SignedOut(notice: expiredNotice));
        return error.message;
      }
      return _fail(error.message, keepTokenOnFailure: keepTokenOnFailure);
    } on Exception catch (error, stack) {
      _logger.error('Compte illisible', error: error, stack: stack);
      return _fail(_genericFailure, keepTokenOnFailure: keepTokenOnFailure);
    }
  }

  Future<String> _fail(
    String message, {
    required bool keepTokenOnFailure,
  }) async {
    if (keepTokenOnFailure) {
      _emit(SessionUnverifiable(message));
    } else {
      await _auth.forgetToken();
      _emit(const SignedOut());
    }
    return message;
  }

  void _emit(SessionState next) {
    if (_disposed) return;
    _state = next;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
