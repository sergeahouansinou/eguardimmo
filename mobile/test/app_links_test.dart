import 'package:eguardimmo/app.dart';
import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:eguardimmo/features/auth/screens/login_screen.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'helpers/harness.dart';

void main() {
  testWidgets('l’application ouvre une seule fois un lien reçu', (
    tester,
  ) async {
    await initializeDateFormatting('fr_FR');
    FlutterSecureStorage.setMockInitialValues({});
    await tester.pumpWidget(const App());
    await tester.pumpAndSettle();

    await receiveLink(tester, RouteName.login);
    await receiveLink(tester, RouteName.login);
    expect(find.byType(LoginScreen, skipOffstage: false), findsOneWidget);
  });
}
