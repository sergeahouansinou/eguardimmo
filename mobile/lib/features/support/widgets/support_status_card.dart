import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/state/load_state.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/support_availability.dart';
import '../viewmodels/support_availability_viewmodel.dart';

/// Disponibilité du support, lue sur le serveur. Un échec s'affiche et se
/// reprend : il n'empêche pas d'ouvrir une demande, qui attend hors ligne.
class const SupportStatusCard({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<SupportAvailabilityViewModel>();
    final known = viewModel.state.dataOrNull;
    if (known != null) return _Card(availability: known);
    return switch (viewModel.state) {
      Failed<SupportAvailability>(:final message) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InlineMessage(message: 'Horaires du support indisponibles. $message'),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Réessayer',
            style: AppButtonStyle.outline,
            onPressed: viewModel.load,
          ),
        ],
      ),
      _ => Semantics(
        label: 'Chargement des horaires du support',
        child: const LinearProgressIndicator(),
      ),
    };
  }
}

class const _Card({required final SupportAvailability availability})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final theme = Theme.of(context);
    return Semantics(
      container: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: p.surface,
          borderRadius: AppRadius.card,
          border: Border.all(color: p.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              StatusPill(
                label: availability.online
                    ? 'Support en ligne'
                    : 'Support hors ligne',
                tone: availability.online ? PillTone.success : PillTone.neutral,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(availability.hoursLabel, style: theme.textTheme.bodyMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(
                availability.responseLabel,
                style: theme.textTheme.bodySmall?.copyWith(color: p.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
