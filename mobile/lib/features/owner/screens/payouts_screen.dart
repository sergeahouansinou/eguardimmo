import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../models/owner_payout.dart';
import '../viewmodels/owner_lists_viewmodels.dart';
import '../widgets/access_notices.dart';
import '../widgets/owner_cards.dart';

class const OwnerPayoutsScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<OwnerPayoutsViewModel>();
    return SubPageScaffold(
      title: 'Reversements',
      fallbackRoute: RouteName.ownerHome,
      bottom: const AccessLine(),
      body: RefreshIndicator(
        onRefresh: viewModel.load,
        child: AsyncBody<PayoutsPage>(
          state: viewModel.state,
          onRetry: viewModel.load,
          isEmpty: (page) => page.items.isEmpty && page.upcoming.isEmpty,
          emptyMessage: 'Aucun reversement pour le moment.',
          builder: (context, page) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.screenGutter,
              0,
              AppSpacing.screenGutter,
              AppSpacing.screenGutter,
            ),
            children: [
              for (final upcoming in page.upcoming) ...[
                UpcomingPayoutCard(upcoming: upcoming),
                const SizedBox(height: AppSpacing.md),
              ],
              for (final payout in page.items) ...[
                PayoutCard(payout: payout),
                const SizedBox(height: AppSpacing.md),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
