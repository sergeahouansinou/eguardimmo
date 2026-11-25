import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/state/list_page.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/active_polling.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/status_pill.dart';
import '../../auth/widgets/session_gate.dart';
import '../models/ticket.dart';
import '../support_copy.dart';
import '../viewmodels/support_availability_viewmodel.dart';
import '../viewmodels/tickets_viewmodel.dart';
import '../widgets/support_status_card.dart';
import '../widgets/ticket_tile.dart';

class const SupportScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Support')),
      body: SafeArea(
        child: SessionGate(
          signedOutMessage: 'Connectez-vous pour contacter le support.',
          builder: (context, _) => const _Board(),
        ),
      ),
    );
  }
}

class const _Board() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final tickets = context.watch<TicketsViewModel>();
    return ActivePolling(
      onActiveChanged: tickets.setActive,
      child: RefreshIndicator(
        onRefresh: () async {
          await context.read<SupportAvailabilityViewModel>().load();
          await tickets.load();
        },
        child: AsyncBody<ListPage<TicketSummary>>(
          state: tickets.state,
          onRetry: tickets.load,
          builder: (context, page) => _Tickets(viewModel: tickets, page: page),
        ),
      ),
    );
  }
}

class const _Tickets({
  required final TicketsViewModel viewModel,
  required final ListPage<TicketSummary> page,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final theme = Theme.of(context);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.screenGutter),
      children: [
        const SupportStatusCard(),
        const SizedBox(height: AppSpacing.md),
        Text(
          supportPrivacyText,
          style: theme.textTheme.bodySmall?.copyWith(
            color: context.palette.textMuted,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppButton(
          label: 'Nouvelle demande',
          expanded: true,
          onPressed: () => context.push(AppRoutes.newSupportTicket),
        ),
        if (viewModel.pollNotice != null) ...[
          const SizedBox(height: AppSpacing.md),
          InlineMessage(
            tone: PillTone.warning,
            message:
                'Actualisation automatique en pause. ${viewModel.pollNotice}',
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        Semantics(
          header: true,
          child: Text('Mes demandes', style: theme.textTheme.titleMedium),
        ),
        const SizedBox(height: AppSpacing.md),
        if (page.items.isEmpty)
          Text(
            'Vous n’avez aucune demande. Ouvrez-en une pour joindre le support.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: context.palette.textMuted,
            ),
          )
        else
          for (final ticket in page.items) ...[
            TicketTile(
              ticket: ticket,
              now: now,
              onOpen: () => context.push(AppRoutes.supportTicket(ticket.id)),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        if (page.hasMore) ...[
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
      ],
    );
  }
}
