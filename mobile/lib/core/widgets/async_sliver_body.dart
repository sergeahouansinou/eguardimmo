import 'package:flutter/material.dart';

import '../state/load_state.dart';
import 'refresh_failure_banner.dart';
import 'state_message.dart';

/// Variante sliver d'AsyncBody pour les écrans à en-tête défilant.
class const AsyncSliverBody<T>({
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
        return _fill(StateMessage(title: emptyTitle, message: emptyMessage));
      }
      final content = builder(context, data);
      return switch (state) {
        Failed<T>(:final message) => SliverMainAxisGroup(
          slivers: [
            SliverToBoxAdapter(
              child: RefreshFailureBanner(message: message, onRetry: onRetry),
            ),
            content,
          ],
        ),
        _ => content,
      };
    }
    return switch (state) {
      Idle<T>() || Loading<T>() => _fill(
        Center(
          child: Semantics(
            label: 'Chargement en cours',
            child: CircularProgressIndicator(),
          ),
        ),
      ),
      Failed<T>(:final message) => _fill(
        StateMessage(
          message: message,
          actionLabel: 'Réessayer',
          onAction: onRetry,
        ),
      ),
      Loaded<T>() => const SliverToBoxAdapter(child: SizedBox.shrink()),
    };
  }

  Widget _fill(Widget child) =>
      SliverFillRemaining(hasScrollBody: false, child: child);
}
