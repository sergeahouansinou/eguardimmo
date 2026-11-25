import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/routes/app_routes.dart';
import '../auth/viewmodels/session_viewmodel.dart';
import '../auth/widgets/session_gate.dart';
import '../profiles/models/profile_space.dart';
import '../profiles/viewmodels/profiles_viewmodel.dart';
import 'screens/new_ticket_screen.dart';
import 'screens/support_screen.dart';
import 'screens/ticket_screen.dart';
import 'services/support_service.dart';
import 'viewmodels/open_ticket_viewmodel.dart';
import 'viewmodels/support_availability_viewmodel.dart';
import 'viewmodels/ticket_viewmodel.dart';
import 'viewmodels/tickets_viewmodel.dart';

List<RouteBase> supportRootRoutes() => [
  GoRoute(
    path: AppRoutes.support,
    builder: (context, _) => _signedIn(
      context,
      () => MultiProvider(
        providers: [
          ChangeNotifierProvider(
            create: (context) =>
                SupportAvailabilityViewModel(context.read<SupportService>())
                  ..load(),
          ),
          ChangeNotifierProvider(
            create: (context) =>
                TicketsViewModel(context.read<SupportService>())..load(),
          ),
        ],
        child: const SupportScreen(),
      ),
    ),
  ),
  GoRoute(
    path: AppRoutes.newSupportTicket,
    builder: (context, _) {
      final userId = context.watch<SessionViewModel>().user?.id;
      final space = ProfileSpace.of(context.watch<ProfilesViewModel>().active);
      return _signedIn(
        context,
        () => ChangeNotifierProvider(
          key: ValueKey('$userId|${space.key}'),
          create: (context) =>
              OpenTicketViewModel(context.read<SupportService>(), space),
          child: const NewTicketScreen(),
        ),
      );
    },
  ),
  GoRoute(
    path: AppRoutes.supportTicketPattern,
    builder: (context, state) {
      final id = state.pathParameters['id']!;
      return _signedIn(
        context,
        () => ChangeNotifierProvider(
          key: ValueKey(id),
          create: (context) =>
              TicketViewModel(context.read<SupportService>(), id)..load(),
          child: const TicketScreen(),
        ),
      );
    },
  ),
];

Widget _signedIn(BuildContext context, Widget Function() build) {
  if (context.watch<SessionViewModel>().isSignedIn) return build();
  return Scaffold(
    appBar: AppBar(),
    body: SafeArea(
      child: SessionGate(
        signedOutMessage: 'Connectez-vous pour contacter le support.',
        builder: (context, _) => const SizedBox.shrink(),
      ),
    ),
  );
}
