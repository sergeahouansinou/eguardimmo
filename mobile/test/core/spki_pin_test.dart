import 'dart:convert';
import 'dart:typed_data';

import 'package:eguardimmo/core/security/spki_pin.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/test_certificates.dart';

Uint8List der(int tag, List<int> content) {
  final length = content.length;
  final header = length < 0x80
      ? [tag, length]
      : [tag, 0x82, length >> 8, length & 0xFF];
  return Uint8List.fromList([...header, ...content]);
}

Uint8List syntheticCertificate({required bool withVersion, int spkiSize = 4}) {
  final spki = der(0x30, List.filled(spkiSize, 7));
  final tbs = der(0x30, [
    if (withVersion) ...der(0xA0, der(0x02, [2])),
    ...der(0x02, [1]),
    ...der(0x30, [0x05, 0x00]),
    ...der(0x30, [0x31, 0x00]),
    ...der(0x30, [0x31, 0x00]),
    ...der(0x30, [0x31, 0x00]),
    ...spki,
  ]);
  return der(0x30, [
    ...tbs,
    ...der(0x30, [0x05, 0x00]),
    ...der(0x03, [0, 1]),
  ]);
}

void main() {
  group('calcul de l’empreinte SPKI', () {
    test('certificat RSA : même valeur qu’openssl', () {
      expect(
        SpkiPin.fromCertificateDer(
          base64.decode(TestCertificates.rsaDerBase64),
        ),
        TestCertificates.rsaPin,
      );
    });

    test('certificat ECDSA : même valeur qu’openssl', () {
      expect(
        SpkiPin.fromCertificateDer(base64.decode(TestCertificates.ecDerBase64)),
        TestCertificates.ecPin,
      );
    });

    test('certificat sans champ version (v1) et longueurs sur 2 octets', () {
      final v1 = syntheticCertificate(withVersion: false, spkiSize: 300);
      final v3 = syntheticCertificate(withVersion: true, spkiSize: 300);
      expect(SpkiPin.fromCertificateDer(v1), SpkiPin.fromCertificateDer(v3));
    });

    test('DER tronqué ou qui n’est pas un certificat : FormatException', () {
      final valid = base64.decode(TestCertificates.rsaDerBase64);
      expect(
        () => SpkiPin.fromCertificateDer(valid.sublist(0, 100)),
        throwsFormatException,
      );
      expect(() => SpkiPin.fromCertificateDer(const []), throwsFormatException);
      expect(
        () => SpkiPin.fromCertificateDer([0x04, 0x02, 0x01, 0x02]),
        throwsFormatException,
      );
      expect(
        () => SpkiPin.fromCertificateDer(der(0x30, der(0x30, [0x02]))),
        throwsFormatException,
      );
    });
  });

  group('comparaison avec les empreintes épinglées', () {
    final rsa = base64.decode(TestCertificates.rsaDerBase64);
    final ec = base64.decode(TestCertificates.ecDerBase64);

    test('accepte l’empreinte courante comme celle de secours', () {
      final pins = PinSet([TestCertificates.rsaPin, TestCertificates.ecPin]);
      expect(pins.matches(rsa), isTrue);
      expect(pins.matches(ec), isTrue);
    });

    test('refuse une clé publique non épinglée', () {
      final pins = PinSet([TestCertificates.rsaPin, 'A' * 43 + '=']);
      expect(pins.matches(ec), isFalse);
    });

    test('refuse un certificat illisible au lieu de lever', () {
      expect(
        PinSet([TestCertificates.rsaPin]).matches(const [1, 2, 3]),
        isFalse,
      );
    });

    test('un ensemble vide est refusé à la construction', () {
      expect(() => PinSet(const []), throwsArgumentError);
    });
  });
}
