import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

abstract class TokenStorage() {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

/// Coffre clé/valeur sous le jeton : Keychain sur iOS, Keystore sur Android.
abstract class SecretStore() {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
  Future<void> deleteAll();
}

class KeychainSecretStore([FlutterSecureStorage? storage])
    implements SecretStore {
  this
    : _storage =
          storage ??
          const FlutterSecureStorage(
            iOptions: iosOptions,
            aOptions: androidOptions,
          );

  /// Inaccessible avant le premier déverrouillage, jamais migré ni synchronisé
  /// vers un autre appareil.
  static const iosOptions = IOSOptions(
    accessibility: KeychainAccessibility.first_unlock_this_device,
    synchronizable: false,
  );

  /// Clé enveloppée par le Keystore (RSA-OAEP SHA-256), données en AES-GCM.
  static const androidOptions = AndroidOptions(
    keyCipherAlgorithm:
        KeyCipherAlgorithm.RSA_ECB_OAEPwithSHA_256andMGF1Padding,
    storageCipherAlgorithm: StorageCipherAlgorithm.AES_GCM_NoPadding,
  );

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);

  @override
  Future<void> deleteAll() => _storage.deleteAll();
}

/// Drapeau d'installation hors Keychain : sur iOS le Keychain survit à la
/// désinstallation, pas les préférences de l'application.
abstract class InstallMarker() {
  Future<bool> isPresent();
  Future<void> mark();
}

class PreferencesInstallMarker() implements InstallMarker {
  static const _key = 'install_marker';

  @override
  Future<bool> isPresent() async =>
      (await SharedPreferences.getInstance()).getBool(_key) ?? false;

  @override
  Future<void> mark() async {
    final saved = await (await SharedPreferences.getInstance()).setBool(
      _key,
      true,
    );
    if (!saved) throw StateError('Drapeau d’installation non enregistré.');
  }
}

class SecureTokenStorage({
  SecretStore? store,
  InstallMarker? marker,
  bool? purgeOnFreshInstall,
}) implements TokenStorage {
  this
    : _store = store ?? KeychainSecretStore(),
      _marker = marker ?? PreferencesInstallMarker(),
      _purgeOnFreshInstall =
          purgeOnFreshInstall ?? defaultTargetPlatform == TargetPlatform.iOS;

  static const _tokenKey = 'sanctum_token';

  final SecretStore _store;
  final InstallMarker _marker;
  final bool _purgeOnFreshInstall;
  Future<void>? _freshInstallCheck;

  /// Premier lancement après (ré)installation sur iOS : un jeton resté dans le
  /// Keychain d'une installation précédente est purgé avant toute lecture.
  Future<void> _purgeStaleKeychain() async {
    if (!_purgeOnFreshInstall || await _marker.isPresent()) return;
    await _store.deleteAll();
    await _marker.mark();
  }

  Future<void> _ready() async {
    final check = _freshInstallCheck ??= _purgeStaleKeychain();
    try {
      await check;
    } on Object {
      _freshInstallCheck = null;
      rethrow;
    }
  }

  @override
  Future<String?> read() async {
    await _ready();
    return _store.read(_tokenKey);
  }

  @override
  Future<void> write(String token) async {
    await _ready();
    await _store.write(_tokenKey, token);
  }

  @override
  Future<void> clear() async {
    await _ready();
    await _store.delete(_tokenKey);
  }
}
