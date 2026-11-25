import 'dart:convert';
import 'dart:typed_data';

import 'package:eguardimmo/core/utils/image_header.dart';
import 'package:flutter_test/flutter_test.dart';

final _png1x1 = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
);

Uint8List _jpeg({required int width, required int height}) =>
    Uint8List.fromList([
      0xFF,
      0xD8,
      0xFF,
      0xE0,
      0x00,
      0x10,
      0x4A,
      0x46,
      0x49,
      0x46,
      0x00,
      0x01,
      0x01,
      0x00,
      0x00,
      0x01,
      0x00,
      0x01,
      0x00,
      0x00,
      0xFF,
      0xC0,
      0x00,
      0x11,
      0x08,
      height >> 8,
      height & 0xFF,
      width >> 8,
      width & 0xFF,
      0x03,
      0x01,
      0x22,
      0x00,
      0x02,
      0x11,
      0x01,
      0x03,
      0x11,
      0x01,
    ]);

Uint8List _riff(String fourCc, List<int> payload) {
  final bytes = <int>[
    ...'RIFF'.codeUnits,
    0,
    0,
    0,
    0,
    ...'WEBP'.codeUnits,
    ...fourCc.codeUnits,
    payload.length,
    0,
    0,
    0,
    ...payload,
  ];
  return Uint8List.fromList(bytes);
}

Uint8List _png({required int width, required int height}) {
  final bytes = Uint8List.fromList(_png1x1);
  ByteData.sublistView(bytes)
    ..setUint32(16, width)
    ..setUint32(20, height);
  return bytes;
}

void main() {
  test('PNG : format et dimensions', () {
    final header = ImageHeaders.parse(_png1x1)!;
    expect(header.format, ImageFormat.png);
    expect((header.width, header.height), (1, 1));
  });

  test('JPEG : dimensions lues dans le segment SOF', () {
    final header = ImageHeaders.parse(_jpeg(width: 640, height: 480))!;
    expect(header.format, ImageFormat.jpeg);
    expect((header.width, header.height), (640, 480));
  });

  test('WebP VP8X, VP8L et VP8', () {
    final vp8x = ImageHeaders.parse(
      _riff('VP8X', [0, 0, 0, 0, 0x1F, 0x03, 0, 0xDF, 0x01, 0]),
    )!;
    expect(
      (vp8x.format, vp8x.width, vp8x.height),
      (ImageFormat.webp, 800, 480),
    );

    const width = 300 - 1;
    const height = 200 - 1;
    const bits = width | height << 14;
    final vp8l = ImageHeaders.parse(
      _riff('VP8L', [
        0x2F,
        bits & 0xFF,
        (bits >> 8) & 0xFF,
        (bits >> 16) & 0xFF,
        (bits >> 24) & 0xFF,
      ]),
    )!;
    expect((vp8l.width, vp8l.height), (300, 200));

    final vp8 = ImageHeaders.parse(
      _riff('VP8 ', [0, 0, 0, 0x9D, 0x01, 0x2A, 0x40, 0x01, 0xF0, 0x00]),
    )!;
    expect((vp8.width, vp8.height), (320, 240));
  });

  test('octets étrangers ou tronqués : aucun en-tête', () {
    expect(ImageHeaders.parse(Uint8List.fromList([1, 2, 3])), isNull);
    expect(
      ImageHeaders.parse(Uint8List.fromList('%PDF-1.7'.codeUnits)),
      isNull,
    );
    expect(ImageHeaders.parse(Uint8List.fromList([0xFF, 0xD8, 0xFF])), isNull);
    expect(ImageHeaders.parse(_png1x1.sublist(0, 20)), isNull);
    expect(ImageHeaders.parse(_riff('VP8X', [0, 0, 0, 0, 1, 0])), isNull);
  });

  test('dimensions nulles : aucun en-tête', () {
    expect(ImageHeaders.parse(_png(width: 0, height: 10)), isNull);
  });

  test('pixels : produit largeur x hauteur', () {
    expect(ImageHeaders.parse(_png(width: 10000, height: 10000))!.pixels, 1e8);
  });
}
