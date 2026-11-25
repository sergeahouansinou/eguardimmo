import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import 'app_button.dart';
import 'inline_message.dart';

/// Contenu type d'une feuille de saisie : titre, champs, message d'erreur de
/// validation et bouton « Continuer » qui mène à la confirmation.
class const FormSheet({
  super.key,
  required final String title,
  required final List<Widget> children,
  required final VoidCallback onSubmit,
  final String submitLabel = 'Continuer',
  final String? error,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
        const SizedBox(height: AppSpacing.md),
        for (final child in children) ...[
          child,
          const SizedBox(height: AppSpacing.md),
        ],
        if (error case final message?) ...[
          InlineMessage(message: message),
          const SizedBox(height: AppSpacing.md),
        ],
        AppButton(label: submitLabel, expanded: true, onPressed: onSubmit),
      ],
    );
  }
}

/// Ligne de pastilles de choix qui passe à la ligne : jamais de débordement à
/// 320 px.
class const ChoiceWrap({super.key, required final List<Widget> children})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: AppSpacing.sm,
    runSpacing: AppSpacing.sm,
    children: children,
  );
}
