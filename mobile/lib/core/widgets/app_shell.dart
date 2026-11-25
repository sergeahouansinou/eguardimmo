import 'package:flutter/material.dart';

import '../routes/app_tab.dart';
import '../theme/app_palette.dart';

/// Navigation basse des quatre onglets. Un onglet n'est construit qu'à sa
/// première visite à l'écran, puis garde son état (pile indexée).
class const AppShell({
  super.key,
  required final ValueNotifier<AppTab> tab,
  required final Widget Function(AppTab tab) pageFor,
}) extends StatefulWidget {
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState() extends State<AppShell> {
  final _visited = <AppTab, Widget>{};

  @override
  Widget build(BuildContext context) {
    final onScreen = ModalRoute.isCurrentOf(context) ?? true;
    return ValueListenableBuilder<AppTab>(
      valueListenable: widget.tab,
      builder: (context, selected, _) {
        if (onScreen) {
          _visited.putIfAbsent(selected, () => widget.pageFor(selected));
        }
        final p = context.palette;
        return Scaffold(
          body: IndexedStack(
            index: selected.index,
            children: [
              for (final tab in AppTab.values)
                TickerMode(
                  enabled: tab == selected,
                  child: _visited[tab] ?? const SizedBox.shrink(),
                ),
            ],
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: selected.index,
            backgroundColor: p.surface,
            indicatorColor: p.primarySoft,
            surfaceTintColor: Colors.transparent,
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            onDestinationSelected: (index) =>
                widget.tab.value = AppTab.values[index],
            destinations: [
              for (final tab in AppTab.values)
                NavigationDestination(
                  icon: Icon(tab.icon),
                  selectedIcon: Icon(tab.selectedIcon, color: p.link),
                  label: tab.label,
                ),
            ],
          ),
        );
      },
    );
  }
}
