import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/routes/route_args.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_choice_chip.dart';
import '../../../core/widgets/async_list_view.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../models/agency_intervention.dart';
import '../viewmodels/agency_viewmodels.dart';
import '../widgets/agency_cards.dart';

class const AgencyInterventionsScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<AgencyInterventionsViewModel>();
    return SubPageScaffold(
      title: 'Interventions',
      fallbackRoute: RouteName.agencyHome,
      bottom: Padding(
        padding: const EdgeInsets.all(AppSpacing.screenGutter),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final filter in InterventionFilter.values)
                AppChoiceChip(
                  label: filter.label,
                  selected: filter == viewModel.filter,
                  onSelected: () => viewModel.select(filter),
                ),
            ],
          ),
        ),
      ),
      body: AsyncListView<AgencyIntervention>(
        state: viewModel.state,
        onRefresh: viewModel.load,
        emptyMessage: 'Aucune intervention ne correspond à ce filtre.',
        itemBuilder: (context, item) => InterventionCard(
          intervention: item,
          onTap: () => Navigator.pushNamed<Object?>(
            context,
            RouteName.agencyIntervention,
            arguments: ResourceArgs(item.id),
          ),
        ),
      ),
    );
  }
}
