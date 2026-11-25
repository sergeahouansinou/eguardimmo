import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../core/services/api_client.dart';
import '../../core/services/token_storage.dart';
import 'services/auth_service.dart';
import 'viewmodels/session_viewmodel.dart';

String deviceLabel() => switch (defaultTargetPlatform) {
  TargetPlatform.iOS => 'eGuardImmo iOS',
  TargetPlatform.android => 'eGuardImmo Android',
  _ => 'eGuardImmo mobile',
};

List<SingleChildWidget> authProviders() => [
  ProxyProvider2<ApiClient, TokenStorage, AuthService>(
    update: (_, api, tokens, _) =>
        AuthService(api, tokens, deviceName: deviceLabel()),
  ),
  ChangeNotifierProxyProvider<AuthService, SessionViewModel>(
    create: (context) {
      final session = SessionViewModel(context.read<AuthService>());
      context.read<ApiClient>().onSessionExpired = session.expire;
      return session..bootstrap();
    },
    update: (_, _, session) => session!,
  ),
];
