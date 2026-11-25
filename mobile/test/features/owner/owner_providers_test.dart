import 'package:eguardimmo/core/services/api_client.dart';
import 'package:eguardimmo/features/auth/services/auth_service.dart';
import 'package:eguardimmo/features/auth/viewmodels/session_viewmodel.dart';
import 'package:eguardimmo/features/owner/owner_providers.dart';
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
      final session = SessionViewModel(
        AuthService(api, storage, deviceName: 'test'),
      );
      addTearDown(session.dispose);
      await session.bootstrap();

      late OwnerAccessViewModel current;
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            Provider<ApiClient>.value(value: api),
            ChangeNotifierProvider<SessionViewModel>.value(value: session),
            ...ownerProviders(),
          ],
          child: Builder(
            builder: (context) {
              current = context.watch<OwnerAccessViewModel>();
              return const SizedBox();
            },
          ),
        ),
      );
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
