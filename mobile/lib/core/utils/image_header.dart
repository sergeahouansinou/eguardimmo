import 'dart:typed_data';

enum ImageFormat(final String mimeType) {
  jpeg('image/jpeg'),
  png('image/png'),
  webp('image/webp'),
}

class const ImageHeader({
  required final ImageFormat format,
  required final int width,
  required final int height,
}) {
  int get pixels => width * height;
}

/// Lit le format réel et les dimensions d'une image à partir de ses seuls
/// octets d'en-tête, sans la décoder : le type annoncé par le serveur ne
/// suffit pas à lui faire confiance.
abstract final class ImageHeaders() {
  static const maxPixels = 40 * 1000 * 1000;

  static ImageHeader? parse(Uint8List bytes) {
    if (_startsWith(bytes, const [0xFF, 0xD8, 0xFF])) return _jpeg(bytes);
    if (_startsWith(bytes, const [0x89, 0x50, 0x4E, 0x47])) return _png(bytes);
    if (_startsWith(bytes, const [0x52, 0x49, 0x46, 0x46]) &&
        bytes.length >= 25 &&
        _ascii(bytes, 8, 'WEBP')) {
      return _webp(bytes);
    }
    return null;
  }

  static bool _startsWith(Uint8List bytes, List<int> prefix) {
    if (bytes.length < prefix.length) return false;
    for (var i = 0; i < prefix.length; i++) {
      if (bytes[i] != prefix[i]) return false;
    }
    return true;
  }

  static bool _ascii(Uint8List bytes, int offset, String text) {
    if (bytes.length < offset + text.length) return false;
    for (var i = 0; i < text.length; i++) {
      if (bytes[offset + i] != text.codeUnitAt(i)) return false;
    }
    return true;
  }

  static ImageHeader? _png(Uint8List bytes) {
    if (bytes.length < 24 || !_ascii(bytes, 12, 'IHDR')) return null;
    final data = ByteData.sublistView(bytes);
    return _valid(ImageFormat.png, data.getUint32(16), data.getUint32(20));
  }

  static ImageHeader? _jpeg(Uint8List bytes) {
    final data = ByteData.sublistView(bytes);
    var offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] != 0xFF) return null;
      final marker = bytes[offset + 1];
      if (marker == 0xFF) {
        offset++;
        continue;
      }
      if (marker == 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker == 1) {
        offset += 2;
        continue;
      }
      final length = data.getUint16(offset + 2);
      final isFrame =
          marker >= 0xC0 &&
          marker <= 0xCF &&
          marker != 0xC4 &&
          marker != 0xC8 &&
          marker != 0xCC;
      if (isFrame) {
        if (offset + 9 > bytes.length) return null;
        return _valid(
          ImageFormat.jpeg,
          data.getUint16(offset + 7),
          data.getUint16(offset + 5),
        );
      }
      if (marker == 0xDA || length < 2) return null;
      offset += 2 + length;
    }
    return null;
  }

  static ImageHeader? _webp(Uint8List bytes) {
    if (_ascii(bytes, 12, 'VP8X') && bytes.length >= 30) {
      final width = 1 + (bytes[24] | bytes[25] << 8 | bytes[26] << 16);
      final height = 1 + (bytes[27] | bytes[28] << 8 | bytes[29] << 16);
      return _valid(ImageFormat.webp, width, height);
    }
    if (_ascii(bytes, 12, 'VP8L') && bytes[20] == 0x2F) {
      final bits =
          bytes[21] | bytes[22] << 8 | bytes[23] << 16 | bytes[24] << 24;
      return _valid(
        ImageFormat.webp,
        1 + (bits & 0x3FFF),
        1 + ((bits >> 14) & 0x3FFF),
      );
    }
    if (_ascii(bytes, 12, 'VP8 ') &&
        bytes.length >= 30 &&
        bytes[23] == 0x9D &&
        bytes[24] == 0x01 &&
        bytes[25] == 0x2A) {
      final data = ByteData.sublistView(bytes);
      return _valid(
        ImageFormat.webp,
        data.getUint16(26, Endian.little) & 0x3FFF,
        data.getUint16(28, Endian.little) & 0x3FFF,
      );
    }
    return null;
  }

  static ImageHeader? _valid(ImageFormat format, int width, int height) =>
      width <= 0 || height <= 0
      ? null
      : ImageHeader(format: format, width: width, height: height);
}
