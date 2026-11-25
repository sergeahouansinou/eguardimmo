import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import 'app_button.dart';
import 'inline_message.dart';

/// Échec d'une actualisation alors que des données déjà chargées restent
/// affichées : le message et la reprise sont toujours visibles.
class const RefreshFailureBanner({
  super.key,
  required final String message,
  required final VoidCallback onRetry,
  final EdgeInsetsGeometry padding = const EdgeInsets.all(
    AppSpacing.screenGutter,
  ),
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InlineMessage(message: message),
          AppButton(
            label: 'Réessayer',
            style: AppButtonStyle.ghost,
            onPressed: onRetry,
          ),
        ],
      ),
    );
  }
}

/// Place le bandeau au-dessus du contenu. Sans hauteur bornée (contenu dans
/// un défilement), le contenu garde sa taille naturelle.
class const RefreshFailureLayout({
  super.key,
  required final String message,
  required final VoidCallback onRetry,
  required final Widget child,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final bounded = constraints.hasBoundedHeight;
        return Column(
          mainAxisSize: bounded ? MainAxisSize.max : MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            RefreshFailureBanner(message: message, onRetry: onRetry),
            if (bounded) Expanded(child: child) else child,
          ],
        );
      },
    );
  }
}
