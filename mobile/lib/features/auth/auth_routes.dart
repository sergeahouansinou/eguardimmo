import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/config/app_config.dart';
import '../../core/routes/app_routes.dart';
import 'screens/account_screen.dart';
import 'screens/login_screen.dart';
import 'services/auth_service.dart';
import 'viewmodels/login_viewmodel.dart';
import 'viewmodels/session_viewmodel.dart';

List<RouteBase> accountTabRoutes() => [
  GoRoute(
    path: AppRoutes.account,
    builder: (_, _) => const AccountScreen(config: AppConfig.current),
  ),
];

List<RouteBase> loginRoutes() => [
  GoRoute(
    path: AppRoutes.login,
    builder: (context, _) => ChangeNotifierProvider(
      create: (context) => LoginViewModel(
        context.read<AuthService>(),
        context.read<SessionViewModel>(),
      ),
      child: const LoginScreen(),
    ),
  ),
];
