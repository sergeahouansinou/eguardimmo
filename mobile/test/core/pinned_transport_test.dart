import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/io.dart';
import 'package:eguardimmo/core/config/app_config.dart';
import 'package:eguardimmo/core/security/pinned_transport.dart';
import 'package:eguardimmo/core/security/spki_pin.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/test_certificates.dart';

class FakeCertificate(
  @override final Uint8List der, {
  DateTime? start,
  DateTime? end,
}) implements X509Certificate {
  this
    : startValidity = start ?? DateTime(2026, 11, 21),
      endValidity = end ?? DateTime(2036, 11, 18);

  @override
  final DateTime startValidity;

  @override
  final DateTime endValidity;

  @override
  String get pem => '';

  @override
  Uint8List get sha1 => Uint8List(20);

  @override
  String get subject => 'CN=api.test.invalid';

  @override
  String get issuer => 'CN=api.test.invalid';
}

void main() {
  final rsa = FakeCertificate(base64.decode(TestCertificates.rsaDerBase64));
  final ec = FakeCertificate(base64.decode(TestCertificates.ecDerBase64));
  final now = DateTime(2027, 6, 1);

  CertificatePolicy policy([List<String>? pins]) => CertificatePolicy(
    host: 'api.eguardimmo.test',
    pins: PinSet(pins ?? [TestCertificates.rsaPin, TestCertificates.ecPin]),
    now: () => now,
  );

  group('politique de certificat', () {
    test('clé épinglée, bon hôte, dans sa validité : acceptée', () {
      expect(policy().accepts(rsa, 'api.eguardimmo.test', 443), isTrue);
    });

    test('clé de secours acceptée', () {
      expect(policy().accepts(ec, 'api.eguardimmo.test', 443), isTrue);
    });

    test('clé non épinglée : refusée', () {
      expect(
        policy([TestCertificates.rsaPin, 'B' * 43 + '='])
            .accepts(ec, 'api.eguardimmo.test', 443),
        isFalse,
      );
    });

    test('autre hôte que l’API : refusé même avec la bonne clé', () {
      expect(policy().accepts(rsa, 'autre.example', 443), isFalse);
    });

    test('certificat expiré ou pas encore valide : refusé', () {
      final expired = FakeCertificate(rsa.der, end: DateTime(2027, 1, 1));
      final future = FakeCertificate(rsa.der, start: DateTime(2028, 1, 1));
      expect(policy().accepts(expired, 'api.eguardimmo.test', 443), isFalse);
      expect(policy().accepts(future, 'api.eguardimmo.test', 443), isFalse);
    });
  });

  group('transport selon la configuration', () {
    AppConfig config({String env = 'prod', String pins = ''}) => AppConfig(
      environmentName: env,
      apiBaseUrl: 'https://api.eguardimmo.test/api/v1',
      apiBaseUrlProvided: true,
      termsUrl: 'https://eguardimmo.test/cgu',
      privacyUrl: 'https://eguardimmo.test/confidentialite',
      supportEmail: 'support@eguardimmo.test',
      appVersion: '1.0.0',
      apiPinsRaw: pins,
    );

    test('prod : adaptateur épinglé', () {
      final dio = PinnedTransport.dio(
        config(pins: '${TestCertificates.rsaPin},${TestCertificates.ecPin}'),
      );
      expect(dio.httpClientAdapter, isA<IOHttpClientAdapter>());
    });

    test('dev en debug : Dio standard, épinglage désactivé', () {
      final dio = PinnedTransport.dio(config(env: 'dev'));
      expect(
        dio.httpClientAdapter,
        isNot(
          isA<IOHttpClientAdapter>().having(
            (a) => a.createHttpClient,
            'createHttpClient',
            isNotNull,
          ),
        ),
      );
    });
  });
}
