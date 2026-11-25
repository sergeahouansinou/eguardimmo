import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/widgets/state_message.dart';
import '../models/app_user.dart';
import '../viewmodels/session_viewmodel.dart';
import 'require_sign_in.dart';

/// Écran réservé aux comptes connectés : rend les quatre états de la session
/// (vérification, déconnecté, non vérifiable, connecté).
class const SessionGate({
  super.key,
  required final String signedOutMessage,
  required final Widget Function(BuildContext context, AppUser user) builder,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionViewModel>();
    return switch (session.state) {
      SessionChecking() => Center(
        child: Semantics(
          label: 'Vérification de la session',
          child: CircularProgressIndicator(),
        ),
      ),
      SignedIn(:final user) => builder(context, user),
      SignedOut(:final notice) => StateMessage(
        icon: Icons.lock_outline_rounded,
        title: 'Connexion requise',
        message: notice ?? signedOutMessage,
        actionLabel: 'Se connecter',
        onAction: () => requireSignIn(context),
      ),
      SessionUnverifiable(:final message) => StateMessage(
        message: message,
        actionLabel: 'Réessayer',
        onAction: session.bootstrap,
      ),
    };
  }
}
