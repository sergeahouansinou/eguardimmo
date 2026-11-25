import 'package:flutter/material.dart';

import 'app_routes.dart';

/// Les onglets de la coquille, dans l'ordre d'affichage.
enum AppTab(
  final String route,
  final String label,
  final IconData icon,
  final IconData selectedIcon,
) {
  explore(
    RouteName.explore,
    'Explorer',
    Icons.search_rounded,
    Icons.search_rounded,
  ),
  stays(
    RouteName.stays,
    'Séjours',
    Icons.calendar_month_outlined,
    Icons.calendar_month_rounded,
  ),
  messages(
    RouteName.messages,
    'Messages',
    Icons.chat_bubble_outline_rounded,
    Icons.chat_bubble_rounded,
  ),
  account(
    RouteName.account,
    'Compte',
    Icons.person_outline_rounded,
    Icons.person_rounded,
  );

  static AppTab? named(String? route) {
    for (final tab in values) {
      if (tab.route == route) return tab;
    }
    return null;
  }
}
