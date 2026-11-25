import 'package:flutter/material.dart';

import '../state/load_state.dart';
import '../theme/app_spacing.dart';
import 'async_body.dart';

/// Liste rafraîchissable d'une collection chargée : mêmes quatre états que
/// [AsyncBody], éventuellement un en-tête, un pied de liste explicatif.
class const AsyncListView<T>({
  super.key,
  required final LoadState<List<T>> state,
  required final Future<void> Function() onRefresh,
  required final String emptyMessage,
  required final Widget Function(BuildContext context, T item) itemBuilder,
  final List<Widget> header = const [],
  final String? footer,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: AsyncBody<List<T>>(
        state: state,
        onRetry: onRefresh,
        isEmpty: (items) => items.isEmpty,
        emptyMessage: emptyMessage,
        builder: (context, items) => ListView.separated(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.screenGutter,
            0,
            AppSpacing.screenGutter,
            AppSpacing.screenGutter,
          ),
          itemCount: header.length + items.length + (footer == null ? 0 : 1),
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
          itemBuilder: (context, index) {
            if (index < header.length) return header[index];
            final itemIndex = index - header.length;
            return itemIndex == items.length
                ? Text(footer!, style: Theme.of(context).textTheme.bodySmall)
                : itemBuilder(context, items[itemIndex]);
          },
        ),
      ),
    );
  }
}
