import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/routes/app_routes.dart';
import '../../core/routes/route_pages.dart';
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

Widget? supportPage(String? name, Object? arguments) => switch (name) {
  RouteName.support => _signedIn(
    (_) => MultiProvider(
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
  RouteName.newSupportTicket => _signedIn((context) {
    final userId = context.watch<SessionViewModel>().user?.id;
    final space = ProfileSpace.of(context.watch<ProfilesViewModel>().active);
    return ChangeNotifierProvider(
      key: ValueKey('$userId|${space.key}'),
      create: (context) =>
          OpenTicketViewModel(context.read<SupportService>(), space),
      child: const NewTicketScreen(),
    );
  }),
  RouteName.supportTicket => resourcePage(
    arguments,
    (id) => _signedIn(
      (_) => ChangeNotifierProvider(
        key: ValueKey(id),
        create: (context) =>
            TicketViewModel(context.read<SupportService>(), id)..load(),
        child: const TicketScreen(),
      ),
    ),
  ),
  _ => null,
};

Widget _signedIn(Widget Function(BuildContext context) build) => Builder(
  builder: (context) {
    if (context.watch<SessionViewModel>().isSignedIn) return build(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: SessionGate(
          signedOutMessage: 'Connectez-vous pour contacter le support.',
          builder: (context, _) => const SizedBox.shrink(),
        ),
      ),
    );
  },
);
