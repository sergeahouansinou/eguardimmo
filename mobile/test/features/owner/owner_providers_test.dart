import 'package:eguardimmo/core/config/provider_manager.dart';
import 'package:eguardimmo/core/services/api_client.dart';
import 'package:eguardimmo/core/services/token_storage.dart';
import 'package:eguardimmo/features/auth/viewmodels/session_viewmodel.dart';
import 'package:eguardimmo/features/owner/viewmodels/owner_access_viewmodel.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';

Map<String, Object?> _me(String id) => {
  'data': {...(Fixtures.me()['data']! as Map<String, Object?>), 'id': id},
};

void main() {
  testWidgets(
    'changement de compte : l’ancien OwnerAccessViewModel est libéré',
    (tester) async {
      var userId = 'u1';
      final storage = MemoryTokenStorage(Fixtures.token);
      final api = FakeApiClient((call) => _me(userId), storage: storage);

      late OwnerAccessViewModel current;
      late SessionViewModel session;
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            Provider<TokenStorage>.value(value: storage),
            Provider<ApiClient>.value(value: api),
            ...dependentServices,
          ],
          child: Builder(
            builder: (context) {
              session = context.read<SessionViewModel>();
              current = context.watch<OwnerAccessViewModel>();
              return const SizedBox();
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      final first = current;
      expect(first.userId, 'u1');

      userId = 'u2';
      await session.signIn('8|jeton-du-compte-b');
      await tester.pump();

      expect(current.userId, 'u2');
      expect(identical(current, first), isFalse);
      expect(() => first.addListener(() {}), throwsFlutterError);
    },
  );
}
