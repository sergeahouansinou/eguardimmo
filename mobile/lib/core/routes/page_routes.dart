import 'package:flutter/cupertino.dart';

import 'app_tab.dart';

/// La coquille des onglets : sans animation, elle porte l'onglet affiché pour
/// qu'on puisse en changer sans la recréer (chaque onglet garde son état).
class ShellRoute(final ValueNotifier<AppTab> tab, Widget page, {super.settings})
    extends PageRouteBuilder<Object?> {
  this
    : super(
        pageBuilder: (_, _, _) => page,
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
      );

  @override
  void dispose() {
    super.dispose();
    tab.dispose();
  }
}

Route<Object?> slideInRoute(Widget page, RouteSettings settings) =>
    CupertinoPageRoute<Object?>(builder: (_) => page, settings: settings);
