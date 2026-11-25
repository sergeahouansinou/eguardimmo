import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_icon_button.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/info_card.dart';
import '../../../core/widgets/key_value_row.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../models/owner_statement.dart';
import '../viewmodels/owner_statement_viewmodel.dart';
import '../widgets/access_notices.dart';
import '../widgets/owner_cards.dart';

class const OwnerStatementScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<OwnerStatementViewModel>();
    return SubPageScaffold(
      title: 'Relevé de compte',
      fallbackRoute: RouteName.ownerHome,
      bottom: Column(
        children: [
          const AccessLine(),
          _MonthStepper(viewModel: viewModel),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: viewModel.load,
        child: AsyncBody<OwnerStatement>(
          state: viewModel.state,
          onRetry: viewModel.load,
          builder: (context, statement) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.screenGutter,
              AppSpacing.sm,
              AppSpacing.screenGutter,
              AppSpacing.screenGutter,
            ),
            children: [
              InfoCard(
                child: Column(
                  children: [
                    KeyValueRow(
                      label: 'Solde d’ouverture',
                      value: statement.opening.text,
                    ),
                    KeyValueRow(
                      label: 'Solde de clôture',
                      value: statement.closing.text,
                      emphasized: true,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (statement.lines.isEmpty)
                Text(
                  'Aucune opération sur ce mois.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              for (final line in statement.lines) ...[
                StatementLineCard(line: line),
                const SizedBox(height: AppSpacing.md),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class const _MonthStepper({required final OwnerStatementViewModel viewModel})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final busy = viewModel.state.isLoading;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenGutter),
      child: Row(
        children: [
          AppIconButton(
            icon: Icons.chevron_left_rounded,
            tooltip: 'Mois précédent',
            onPressed: busy ? null : viewModel.previous,
          ),
          Expanded(
            child: Semantics(
              liveRegion: true,
              child: Text(
                Formatters.monthYear(viewModel.month),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
          ),
          AppIconButton(
            icon: Icons.chevron_right_rounded,
            tooltip: 'Mois suivant',
            onPressed: busy || !viewModel.canGoNext ? null : viewModel.next,
          ),
        ],
      ),
    );
  }
}
