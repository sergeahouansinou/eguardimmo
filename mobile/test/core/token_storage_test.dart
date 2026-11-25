import 'package:eguardimmo/core/services/token_storage.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

class MapSecretStore([Map<String, String>? initial]) implements SecretStore {
  this : data = {...?initial};

  final Map<String, String> data;
  int deleteAllCalls = 0;

  @override
  Future<String?> read(String key) async => data[key];

  @override
  Future<void> write(String key, String value) async => data[key] = value;

  @override
  Future<void> delete(String key) async => data.remove(key);

  @override
  Future<void> deleteAll() async {
    deleteAllCalls++;
    data.clear();
  }
}

class MemoryMarker({var bool present = false}) implements InstallMarker {
  int marks = 0;
  Error? failure;

  @override
  Future<bool> isPresent() async => present;

  @override
  Future<void> mark() async {
    if (failure case final Error error) throw error;
    marks++;
    present = true;
  }
}

void main() {
  const staleToken = '9|jeton-d-une-installation-precedente';

  group('premier lancement iOS', () {
    test('drapeau absent : Keychain purgé avant la lecture du jeton', () async {
      final store = MapSecretStore({'sanctum_token': staleToken});
      final marker = MemoryMarker();
      final storage = SecureTokenStorage(
        store: store,
        marker: marker,
        purgeOnFreshInstall: true,
      );

      expect(await storage.read(), isNull);
      expect(store.deleteAllCalls, 1);
      expect(marker.present, isTrue);
    });

    test('drapeau présent : le jeton est conservé, aucune purge', () async {
      final store = MapSecretStore({'sanctum_token': '1|jeton'});
      final storage = SecureTokenStorage(
        store: store,
        marker: MemoryMarker(present: true),
        purgeOnFreshInstall: true,
      );

      expect(await storage.read(), '1|jeton');
      expect(store.deleteAllCalls, 0);
    });

    test(
      'la purge n’a lieu qu’une fois, le jeton écrit ensuite survit',
      () async {
        final store = MapSecretStore({'sanctum_token': staleToken});
        final marker = MemoryMarker();
        final storage = SecureTokenStorage(
          store: store,
          marker: marker,
          purgeOnFreshInstall: true,
        );

        await storage.write('2|nouveau');
        expect(await storage.read(), '2|nouveau');
        expect(await storage.read(), '2|nouveau');
        expect(store.deleteAllCalls, 1);
        expect(marker.marks, 1);
      },
    );

    test('écrire avant toute lecture purge aussi l’ancien jeton', () async {
      final store = MapSecretStore({'sanctum_token': staleToken, 'autre': 'x'});
      final storage = SecureTokenStorage(
        store: store,
        marker: MemoryMarker(),
        purgeOnFreshInstall: true,
      );
      await storage.write('2|nouveau');
      expect(store.data, {'sanctum_token': '2|nouveau'});
    });

    test(
      'échec du drapeau : erreur remontée, jamais de lecture du jeton périmé',
      () async {
        final store = MapSecretStore({'sanctum_token': staleToken});
        final marker = MemoryMarker()..failure = StateError('disque plein');
        final storage = SecureTokenStorage(
          store: store,
          marker: marker,
          purgeOnFreshInstall: true,
        );

        await expectLater(storage.read(), throwsA(isA<StateError>()));
        marker.failure = null;
        expect(await storage.read(), isNull);
      },
    );

    test('clear efface le jeton', () async {
      final storage = SecureTokenStorage(
        store: MapSecretStore({'sanctum_token': '1|jeton'}),
        marker: MemoryMarker(present: true),
        purgeOnFreshInstall: true,
      );
      await storage.clear();
      expect(await storage.read(), isNull);
    });
  });

  test('hors iOS : pas de purge, drapeau ignoré', () async {
    final store = MapSecretStore({'sanctum_token': '1|jeton'});
    final marker = MemoryMarker();
    final storage = SecureTokenStorage(
      store: store,
      marker: marker,
      purgeOnFreshInstall: false,
    );
    expect(await storage.read(), '1|jeton');
    expect(store.deleteAllCalls, 0);
    expect(marker.marks, 0);
  });

  group('options du coffre', () {
    test('Keychain : accessible après le premier déverrouillage, cet appareil seulement', () {
      expect(
        KeychainSecretStore.iosOptions.accessibility,
        KeychainAccessibility.first_unlock_this_device,
      );
      expect(KeychainSecretStore.iosOptions.synchronizable, isFalse);
    });

    test('Android : clé RSA-OAEP SHA-256 et données AES-GCM explicites', () {
      const options = KeychainSecretStore.androidOptions;
      expect(
        options.toMap()['keyCipherAlgorithm'],
        KeyCipherAlgorithm.RSA_ECB_OAEPwithSHA_256andMGF1Padding.name,
      );
      expect(
        options.toMap()['storageCipherAlgorithm'],
        StorageCipherAlgorithm.AES_GCM_NoPadding.name,
      );
    });
  });
}
