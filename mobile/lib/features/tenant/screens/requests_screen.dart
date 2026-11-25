import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../models/tenant_intervention.dart';
import '../tenant_paths.dart';
import '../viewmodels/requests_viewmodel.dart';
import '../widgets/request_card.dart';

class const RequestsScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<RequestsViewModel>();
    return SubPageScaffold(
      title: 'Demandes d’intervention',
      fallbackRoute: TenantPaths.home,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.screenGutter),
            child: AppButton(
              label: 'Signaler un problème',
              expanded: true,
              onPressed: () async {
                await context.push<void>(TenantPaths.newRequest);
                if (context.mounted) await viewModel.load();
              },
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: viewModel.load,
              child: AsyncBody<List<TenantIntervention>>(
                state: viewModel.state,
                onRetry: viewModel.load,
                isEmpty: (items) => items.isEmpty,
                emptyMessage: 'Vous n’avez signalé aucun problème.',
                builder: (context, items) => ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.screenGutter,
                    0,
                    AppSpacing.screenGutter,
                    AppSpacing.screenGutter,
                  ),
                  itemCount: items.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) => RequestCard(
                    request: items[index],
                    onTap: () async {
                      await context.push<void>(
                        TenantPaths.request(items[index].id),
                      );
                      if (context.mounted) await viewModel.load();
                    },
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
