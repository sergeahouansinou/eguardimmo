import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/auth_routes.dart';
import '../../features/messages/messages_routes.dart';
import '../../features/profiles/profiles_routes.dart';
import '../../features/sebook/sebook_routes.dart';
import '../../features/support/support_routes.dart';
import '../widgets/app_shell.dart';
import 'app_routes.dart';
import 'deep_link_guard.dart';
import 'route_error_screen.dart';

const _destinations = [
  ShellDestination(
    label: 'Explorer',
    icon: Icons.search_rounded,
    selectedIcon: Icons.search_rounded,
  ),
  ShellDestination(
    label: 'Séjours',
    icon: Icons.calendar_month_outlined,
    selectedIcon: Icons.calendar_month_rounded,
  ),
  ShellDestination(
    label: 'Messages',
    icon: Icons.chat_bubble_outline_rounded,
    selectedIcon: Icons.chat_bubble_rounded,
  ),
  ShellDestination(
    label: 'Compte',
    icon: Icons.person_outline_rounded,
    selectedIcon: Icons.person_rounded,
  ),
];

/// Les routes appartiennent aux features ; ce fichier les assemble et porte
/// le contrôle des liens entrants.
GoRouter buildRouter({String initialLocation = AppRoutes.explore}) => GoRouter(
  initialLocation: initialLocation,
  redirect: DeepLinkGuard.redirect,
  errorBuilder: (_, _) => const RouteErrorScreen(),
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (_, _, shell) =>
          AppShell(navigationShell: shell, destinations: _destinations),
      branches: [
        StatefulShellBranch(routes: exploreTabRoutes()),
        StatefulShellBranch(routes: staysTabRoutes()),
        StatefulShellBranch(routes: messagesTabRoutes()),
        StatefulShellBranch(routes: accountTabRoutes()),
      ],
    ),
    ...sebookRootRoutes(),
    ...messagesRootRoutes(),
    ...supportRootRoutes(),
    ...loginRoutes(),
    ...profilesRoutes(),
  ],
);
