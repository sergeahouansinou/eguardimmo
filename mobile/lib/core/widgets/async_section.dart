import 'package:flutter/material.dart';

import '../state/load_state.dart';
import '../theme/app_palette.dart';
import '../theme/app_spacing.dart';
import 'app_button.dart';
import 'info_card.dart';
import 'refresh_failure_banner.dart';

/// Section compacte d'un écran d'accueil : chargement, échec avec reprise et
/// données, sans jamais masquer une panne derrière une valeur par défaut.
class const AsyncSection<T>({
  super.key,
  required final String title,
  required final LoadState<T> state,
  required final VoidCallback onRetry,
  required final Widget Function(BuildContext context, T data) builder,
  final String? emptyMessage,
  final bool Function(T data)? isEmpty,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final data = state.dataOrNull;
    Widget body;
    if (data != null) {
      body = (isEmpty?.call(data) ?? false)
          ? Text(
              emptyMessage ?? 'Rien à afficher pour le moment.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: context.palette.textMuted,
              ),
            )
          : builder(context, data);
      if (state case Failed<T>(:final message)) {
        body = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            RefreshFailureBanner(
              message: message,
              onRetry: onRetry,
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            ),
            body,
          ],
        );
      }
    } else {
      body = switch (state) {
        Failed<T>(:final message) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message, style: theme.textTheme.bodyMedium),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: 'Réessayer',
              style: AppButtonStyle.outline,
              onPressed: onRetry,
            ),
          ],
        ),
        _ => Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Semantics(
              label: 'Chargement de la section $title',
              child: const CircularProgressIndicator(),
            ),
          ),
        ),
      };
    }
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(title, style: theme.textTheme.titleMedium),
          ),
          const SizedBox(height: AppSpacing.sm),
          body,
        ],
      ),
    );
  }
}
