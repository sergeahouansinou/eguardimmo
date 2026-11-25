import 'dart:convert';
import 'dart:typed_data';

import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:eguardimmo/core/services/file_rejected_exception.dart';
import 'package:eguardimmo/core/theme/app_theme.dart';
import 'package:eguardimmo/core/widgets/chat/attachment_preview_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

final _pixel = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
);

Future<void> _pump(
  WidgetTester tester, {
  required String mimeType,
  required Future<Uint8List> Function() load,
  int size = 1024,
}) => tester.pumpWidget(
  MaterialApp(
    theme: AppTheme.light(),
    home: Scaffold(
      body: AttachmentPreview(
        name: 'fichier',
        mimeType: mimeType,
        sizeBytes: size,
        load: load,
      ),
    ),
  ),
);

Uint8List _png({required int width, required int height}) {
  final bytes = Uint8List.fromList(_pixel);
  ByteData.sublistView(bytes)
    ..setUint32(16, width)
    ..setUint32(20, height);
  return bytes;
}

void main() {
  testWidgets('image : téléchargée puis affichée', (tester) async {
    var loads = 0;
    await _pump(
      tester,
      mimeType: 'image/png',
      load: () async {
        loads += 1;
        return _pixel;
      },
    );
    await tester.pumpAndSettle();
    expect(loads, 1);
    expect(find.byType(Image), findsOneWidget);
    expect(find.text('1 Ko'), findsOneWidget);
  });

  testWidgets('PDF : ni téléchargé ni ouvert, l’écran le dit', (tester) async {
    var loads = 0;
    await _pump(
      tester,
      mimeType: 'application/pdf',
      load: () async {
        loads += 1;
        return _pixel;
      },
    );
    await tester.pumpAndSettle();
    expect(loads, 0);
    expect(find.byType(Image), findsNothing);
    expect(find.textContaining('Aperçu indisponible'), findsOneWidget);
  });

  testWidgets('image trop lourde : pas de téléchargement', (tester) async {
    var loads = 0;
    await _pump(
      tester,
      mimeType: 'image/jpeg',
      size: AttachmentPreview.maxPreviewBytes + 1,
      load: () async {
        loads += 1;
        return _pixel;
      },
    );
    await tester.pumpAndSettle();
    expect(loads, 0);
    expect(find.textContaining('Aperçu indisponible'), findsOneWidget);
  });

  testWidgets('403 : message du serveur et reprise', (tester) async {
    var failing = true;
    await _pump(
      tester,
      mimeType: 'image/png',
      load: () async {
        if (failing) {
          throw const ApiException(
            statusCode: 403,
            message: 'Accès refusé à cette pièce jointe.',
            code: 'forbidden',
          );
        }
        return _pixel;
      },
    );
    await tester.pumpAndSettle();
    expect(find.text('Accès refusé à cette pièce jointe.'), findsOneWidget);
    failing = false;
    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();
    expect(find.byType(Image), findsOneWidget);
  });

  testWidgets('octets illisibles : message plutôt qu’un écran cassé', (
    tester,
  ) async {
    await _pump(
      tester,
      mimeType: 'image/png',
      load: () async => Uint8List.fromList([1, 2, 3]),
    );
    await tester.pumpAndSettle();
    expect(find.text('Cette image ne peut pas être affichée.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('PNG annoncé JPEG : refusé, jamais affiché', (tester) async {
    await _pump(tester, mimeType: 'image/jpeg', load: () async => _pixel);
    await tester.pumpAndSettle();
    expect(find.byType(Image), findsNothing);
    expect(find.text(AttachmentPreview.unreadableImage), findsOneWidget);
    expect(find.text('Réessayer'), findsNothing);
  });

  testWidgets('image de plus de 40 Mpx : refusée avant tout décodage', (
    tester,
  ) async {
    await _pump(
      tester,
      mimeType: 'image/png',
      load: () async => _png(width: 10000, height: 10000),
    );
    await tester.pumpAndSettle();
    expect(find.byType(Image), findsNothing);
    expect(find.text(AttachmentPreview.oversizedImage), findsOneWidget);
  });

  testWidgets('octets plus lourds que le plafond : refusés', (tester) async {
    await _pump(
      tester,
      mimeType: 'image/png',
      load: () async =>
          Uint8List(AttachmentPreview.maxPreviewBytes + 1)..setAll(0, _pixel),
    );
    await tester.pumpAndSettle();
    expect(find.byType(Image), findsNothing);
    expect(find.text(AttachmentPreview.oversizedImage), findsOneWidget);
  });

  testWidgets('téléchargement refusé par le client : message affiché', (
    tester,
  ) async {
    await _pump(
      tester,
      mimeType: 'image/png',
      load: () async =>
          throw const FileRejectedException('Ce fichier est trop volumineux.'),
    );
    await tester.pumpAndSettle();
    expect(find.text('Ce fichier est trop volumineux.'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });
}
