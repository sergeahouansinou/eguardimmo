import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'core/config/provider_manager.dart';
import 'core/routes/app_routes.dart';
import 'core/routes/incoming_links.dart';
import 'core/routes/router_manager.dart';
import 'core/theme/app_theme.dart';

class const App({super.key, final String initialLocation = RouteName.explore})
    extends StatefulWidget {
  @override
  State<App> createState() => _AppState();
}

class _AppState() extends State<App> {
  final _navigatorKey = GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    return IncomingLinks(
      navigatorKey: _navigatorKey,
      child: MultiProvider(
        providers: providers,
        child: MaterialApp(
          title: 'eGuardImmo',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          locale: const Locale('fr', 'FR'),
          supportedLocales: const [Locale('fr', 'FR')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          navigatorKey: _navigatorKey,
          initialRoute: widget.initialLocation,
          onGenerateInitialRoutes: RouterManager.initialRoutes,
          onGenerateRoute: RouterManager.generateRoute,
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
      ),
    );
  }
}
