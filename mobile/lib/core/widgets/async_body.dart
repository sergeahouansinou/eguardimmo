import 'package:flutter/material.dart';

import '../state/load_state.dart';
import 'refresh_failure_banner.dart';
import 'state_message.dart';

/// Rend les quatre états d'un chargement. Il n'existe pas de chemin silencieux :
/// un échec affiche toujours son message et une action de reprise.
class const AsyncBody<T>({
  super.key,
  required final LoadState<T> state,
  required final VoidCallback onRetry,
  required final Widget Function(BuildContext context, T data) builder,
  final bool Function(T data)? isEmpty,
  final String emptyMessage = 'Rien à afficher pour le moment.',
  final String? emptyTitle,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final data = state.dataOrNull;
    if (data != null) {
      if (isEmpty?.call(data) ?? false) {
        return StateMessage(title: emptyTitle, message: emptyMessage);
      }
      final content = builder(context, data);
      return switch (state) {
        Failed<T>(:final message) => RefreshFailureLayout(
          message: message,
          onRetry: onRetry,
          child: content,
        ),
        _ => content,
      };
    }
    return switch (state) {
      Idle<T>() || Loading<T>() => Center(
        child: Semantics(
          label: 'Chargement en cours',
          child: CircularProgressIndicator(),
        ),
      ),
      Failed<T>(:final message) => StateMessage(
        message: message,
        actionLabel: 'Réessayer',
        onAction: onRetry,
      ),
      Loaded<T>() => const SizedBox.shrink(),
    };
  }
}
