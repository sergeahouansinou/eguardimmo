import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/routes/route_args.dart';
import '../../../core/state/list_page.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/active_polling.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_choice_chip.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/state_message.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/messaging_scope.dart';
import '../models/thread.dart';
import '../services/threads_service.dart';
import '../viewmodels/thread_list_viewmodel.dart';
import 'support_entry_card.dart';
import 'thread_tile.dart';

class const InboxView({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<ThreadListViewModel>();
    final scope = viewModel.scope;
    return ActivePolling(
      onActiveChanged: viewModel.setActive,
      child: LayoutBuilder(
        builder: (context, constraints) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: constraints.maxHeight * _maxHeaderShare,
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Padding(
                      padding: EdgeInsets.fromLTRB(
                        AppSpacing.screenGutter,
                        AppSpacing.lg,
                        AppSpacing.screenGutter,
                        AppSpacing.sm,
                      ),
                      child: SupportEntryCard(),
                    ),
                    if (scope != null)
                      _Controls(viewModel: viewModel, scope: scope),
                  ],
                ),
              ),
            ),
            if (scope == null)
              const Expanded(
                child: StateMessage(
                  icon: Icons.chat_bubble_outline_rounded,
                  title: 'Aucune conversation',
                  message: 'Les conversations avec une agence sont ouvertes aux locataires, aux propriétaires et aux agences. Choisissez l’un de ces profils pour les consulter.',
                ),
              )
            else
              Expanded(
                child: _Threads(viewModel: viewModel, scope: scope),
              ),
          ],
        ),
      ),
    );
  }

  static const _maxHeaderShare = 0.5;
}

class const _Controls({
  required final ThreadListViewModel viewModel,
  required final MessagingScope scope,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final unreadOnly = viewModel.filter == ThreadFilter.unread;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (scope.kinds.length > 1)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.screenGutter,
              vertical: AppSpacing.sm,
            ),
            child: ChipRow(
              children: [
                for (final kind in scope.kinds)
                  AppChoiceChip(
                    label: kind.label,
                    selected: viewModel.kind == kind,
                    onSelected: () => viewModel.selectKind(kind),
                  ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.screenGutter,
            vertical: AppSpacing.sm,
          ),
          child: ChipRow(
            children: [
              AppChoiceChip(
                label: 'Toutes',
                selected: !unreadOnly,
                onSelected: () => viewModel.selectFilter(ThreadFilter.all),
              ),
              AppChoiceChip(
                label: 'Non lues',
                selected: unreadOnly,
                onSelected: () => viewModel.selectFilter(ThreadFilter.unread),
              ),
            ],
          ),
        ),
        if (scope.canOpenThread)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.screenGutter,
              vertical: AppSpacing.xs,
            ),
            child: AppButton(
              label: 'Nouveau message',
              expanded: true,
              onPressed: () => Navigator.pushNamed<Object?>(
                context,
                RouteName.newConversation,
              ),
            ),
          ),
        if (!scope.canWrite)
          const Padding(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacing.screenGutter,
              vertical: AppSpacing.xs,
            ),
            child: InlineMessage(
              tone: PillTone.info,
              message: 'Sur mobile, vos conversations avec l’agence sont en lecture seule. Pour écrire, utilisez le site eGuardImmo.',
            ),
          ),
        if (viewModel.pollNotice != null)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.screenGutter,
              vertical: AppSpacing.xs,
            ),
            child: InlineMessage(
              tone: PillTone.warning,
              message:
                  'Actualisation automatique en pause. ${viewModel.pollNotice}',
            ),
          ),
      ],
    );
  }
}

class const _Threads({
  required final ThreadListViewModel viewModel,
  required final MessagingScope scope,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final unreadOnly = viewModel.filter == ThreadFilter.unread;
    return RefreshIndicator(
      onRefresh: viewModel.load,
      child: AsyncBody<ListPage<ThreadSummary>>(
        state: viewModel.state,
        onRetry: viewModel.load,
        isEmpty: (page) => page.items.isEmpty,
        emptyTitle: 'Aucune conversation',
        emptyMessage: unreadOnly
            ? 'Aucune conversation non lue.'
            : _emptyHint(scope),
        builder: (context, page) => _List(viewModel: viewModel, page: page),
      ),
    );
  }

  String _emptyHint(MessagingScope scope) => switch (scope.space.apiSpace) {
    'tenant' => 'Écrivez à votre agence depuis « Nouveau message » : l’échange reste dans votre historique.',
    'owner' => 'Vos échanges avec vos agences apparaîtront ici.',
    _ => 'Les échanges avec vos locataires et vos mandants apparaîtront ici.',
  };
}

class const _List({
  required final ThreadListViewModel viewModel,
  required final ListPage<ThreadSummary> page,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.screenGutter),
      itemCount: page.items.length + 1,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
      itemBuilder: (context, index) {
        if (index < page.items.length) {
          final thread = page.items[index];
          return ThreadTile(
            thread: thread,
            now: now,
            fallbackName: viewModel.scope?.isStaff ?? false
                ? 'Contact'
                : 'Agence',
            onOpen: () => Navigator.pushNamed<Object?>(
              context,
              RouteName.conversation,
              arguments: ResourceArgs(thread.id),
            ),
          );
        }
        return _Footer(viewModel: viewModel, page: page);
      },
    );
  }
}

class const _Footer({
  required final ThreadListViewModel viewModel,
  required final ListPage<ThreadSummary> page,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    if (!page.hasMore) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (viewModel.loadMoreError != null) ...[
          InlineMessage(message: viewModel.loadMoreError!),
          const SizedBox(height: AppSpacing.sm),
        ],
        AppButton(
          label: 'Afficher plus',
          style: AppButtonStyle.outline,
          loading: viewModel.loadingMore,
          onPressed: viewModel.loadMore,
        ),
      ],
    );
  }
}
