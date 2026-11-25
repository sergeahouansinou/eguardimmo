import 'package:flutter/widgets.dart';

import 'route_args.dart';
import 'route_error_screen.dart';

/// Page d'une ressource : sans argument bien formé, la route est refusée.
Widget resourcePage(Object? arguments, Widget Function(String id) build) =>
    switch (arguments) {
      final ResourceArgs args when args.isValid => build(args.id),
      _ => const RouteErrorScreen(),
    };
