import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../widgets/state_message.dart';
import 'app_routes.dart';

/// Route sans écran : renvoie aussitôt à l'accueil, avec un bouton de repli.
class const RouteErrorScreen({super.key}) extends StatefulWidget {
  @override
  State<RouteErrorScreen> createState() => _RouteErrorScreenState();
}

class _RouteErrorScreenState() extends State<RouteErrorScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.go(AppRoutes.explore);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: StateMessage(
          message: 'Cette page n’existe pas.',
          actionLabel: 'Retour à l’accueil',
          onAction: () => context.go(AppRoutes.explore),
        ),
      ),
    );
  }
}
