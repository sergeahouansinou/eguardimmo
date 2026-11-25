import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

/// Empreinte SPKI SHA-256 d'un certificat X.509 (format de l'en-tête HPKP) :
/// base64 du SHA-256 du `SubjectPublicKeyInfo` en DER. Elle survit au
/// renouvellement du certificat tant que la clé publique est conservée.
abstract final class SpkiPin() {
  static const _sequence = 0x30;
  static const _explicitVersion = 0xA0;

  static String fromCertificateDer(List<int> certificateDer) {
    final der = Uint8List.fromList(certificateDer);
    final spki = _subjectPublicKeyInfo(der);
    return base64.encode(sha256.convert(spki).bytes);
  }

  /// Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signature }
  /// tbsCertificate ::= SEQUENCE { [0] version?, serial, signature, issuer,
  /// validity, subject, subjectPublicKeyInfo, … }
  static Uint8List _subjectPublicKeyInfo(Uint8List der) {
    final certificate = _element(der, 0);
    _expectSequence(certificate, 'certificat');
    final tbs = _element(der, certificate.contentStart);
    _expectSequence(tbs, 'tbsCertificate');
    var offset = tbs.contentStart;
    final first = _element(der, offset);
    if (first.tag == _explicitVersion) offset = first.end;
    for (var skipped = 0; skipped < 5; skipped++) {
      offset = _element(der, offset).end;
    }
    final spki = _element(der, offset);
    _expectSequence(spki, 'SubjectPublicKeyInfo');
    if (spki.end > tbs.end) {
      throw const FormatException('SubjectPublicKeyInfo hors du certificat.');
    }
    return Uint8List.sublistView(der, spki.start, spki.end);
  }

  static void _expectSequence(_Tlv element, String name) {
    if (element.tag != _sequence) {
      throw FormatException('DER : $name n’est pas une séquence.');
    }
  }

  static _Tlv _element(Uint8List der, int start) {
    if (start < 0 || start + 2 > der.length) {
      throw const FormatException('DER tronqué.');
    }
    final tag = der[start];
    final first = der[start + 1];
    var length = first;
    var headerSize = 2;
    if (first & 0x80 != 0) {
      final count = first & 0x7F;
      if (count == 0 || count > 4 || start + 2 + count > der.length) {
        throw const FormatException('DER : longueur invalide.');
      }
      length = 0;
      for (var i = 0; i < count; i++) {
        length = (length << 8) | der[start + 2 + i];
      }
      headerSize += count;
    }
    final end = start + headerSize + length;
    if (end > der.length) throw const FormatException('DER tronqué.');
    return _Tlv(tag, start, start + headerSize, end);
  }
}

class const _Tlv(
  final int tag,
  final int start,
  final int contentStart,
  final int end,
) {}

/// Ensemble d'empreintes acceptées : courante et secours.
class PinSet(Iterable<String> pins) {
  this : _pins = Set.unmodifiable(pins) {
    if (_pins.isEmpty) {
      throw ArgumentError('Au moins une empreinte est nécessaire.');
    }
  }

  final Set<String> _pins;

  bool matches(List<int> certificateDer) {
    try {
      return _pins.contains(SpkiPin.fromCertificateDer(certificateDer));
    } on FormatException {
      return false;
    }
  }
}
