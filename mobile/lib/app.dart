import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'core/config/app_config.dart';
import 'core/di/app_providers.dart';
import 'core/routes/app_router.dart';
import 'core/routes/app_routes.dart';
import 'core/security/pinned_transport.dart';
import 'core/services/api_client.dart';
import 'core/services/token_storage.dart';
import 'core/theme/app_theme.dart';

class const App({
  super.key,
  final TokenStorage? tokenStorage,
  final String? apiBaseUrl,
  final bool? requireHttps,
  final Dio? dio,
  final String initialLocation = AppRoutes.explore,
}) extends StatefulWidget {
  @override
  State<App> createState() => _AppState();
}

class _AppState() extends State<App> {
  late final TokenStorage _tokens = widget.tokenStorage ?? SecureTokenStorage();
  late final ApiClient _api = ApiClient(
    baseUrl: widget.apiBaseUrl ?? AppConfig.current.apiBaseUrl,
    tokenStorage: _tokens,
    requireHttps: widget.requireHttps ?? AppConfig.current.requiresHttps(),
    dio: widget.dio ?? PinnedTransport.dio(AppConfig.current),
  );
  late final GoRouter _router = buildRouter(
    initialLocation: widget.initialLocation,
  );

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: buildProviders(api: _api, tokenStorage: _tokens),
      child: MaterialApp.router(
        title: 'eGuardImmo',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        locale: const Locale('fr', 'FR'),
        supportedLocales: const [Locale('fr', 'FR')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        routerConfig: _router,
        builder: (context, child) {
          final dark = Theme.of(context).brightness == Brightness.dark;
          return AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarBrightness: dark ? Brightness.dark : Brightness.light,
              statusBarIconBrightness: dark
                  ? Brightness.light
                  : Brightness.dark,
            ),
            child: child ?? const SizedBox.shrink(),
          );
        },
      ),
    );
  }
}
