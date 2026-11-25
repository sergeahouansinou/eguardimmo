import 'package:eguardimmo/core/theme/app_theme.dart';
import 'package:eguardimmo/core/widgets/app_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'la feuille se pose sur le navigateur racine, au-dessus d’une barre inférieure',
    (tester) async {
      final rootKey = GlobalKey<NavigatorState>();
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          navigatorKey: rootKey,
          home: Scaffold(
            body: Navigator(
              onGenerateRoute: (_) => MaterialPageRoute<void>(
                builder: (context) => Center(
                  child: TextButton(
                    onPressed: () => showAppSheet<void>(
                      context,
                      builder: (_) => const Text('Contenu'),
                    ),
                    child: const Text('Ouvrir'),
                  ),
                ),
              ),
            ),
            bottomNavigationBar: const SizedBox(
              height: 80,
              child: Text('Barre'),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Ouvrir'));
      await tester.pumpAndSettle();
      expect(find.text('Contenu'), findsOneWidget);
      expect(rootKey.currentState!.canPop(), isTrue);
    },
  );
}
