import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_palette.dart';

class const ShellDestination({
  required final String label,
  required final IconData icon,
  required final IconData selectedIcon,
}) {}

/// Navigation basse des quatre onglets. Les libellés restent visibles et
/// annoncés ; chaque onglet garde son état (pile indexée).
class const AppShell({
  super.key,
  required final StatefulNavigationShell navigationShell,
  required final List<ShellDestination> destinations,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        backgroundColor: p.surface,
        indicatorColor: p.primarySoft,
        surfaceTintColor: Colors.transparent,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: [
          for (final destination in destinations)
            NavigationDestination(
              icon: Icon(destination.icon),
              selectedIcon: Icon(destination.selectedIcon, color: p.link),
              label: destination.label,
            ),
        ],
      ),
    );
  }
}
