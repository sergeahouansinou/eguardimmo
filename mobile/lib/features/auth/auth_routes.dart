import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

import '../../core/config/app_config.dart';
import '../../core/routes/app_routes.dart';
import 'screens/account_screen.dart';
import 'screens/login_screen.dart';
import 'services/auth_service.dart';
import 'viewmodels/login_viewmodel.dart';
import 'viewmodels/session_viewmodel.dart';

Widget accountTab() => const AccountScreen(config: AppConfig.current);

Widget? authPage(String? name) => switch (name) {
  RouteName.login => ChangeNotifierProvider(
    create: (context) => LoginViewModel(
      context.read<AuthService>(),
      context.read<SessionViewModel>(),
    ),
    child: const LoginScreen(),
  ),
  _ => null,
};
