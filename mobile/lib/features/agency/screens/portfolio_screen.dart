import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_choice_chip.dart';
import '../../../core/widgets/async_list_view.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../agency_paths.dart';
import '../models/portfolio.dart';
import '../viewmodels/agency_viewmodels.dart';
import '../widgets/agency_cards.dart';

class const PortfolioScreen({super.key}) extends StatefulWidget {
  @override
  State<PortfolioScreen> createState() => _PortfolioScreenState();
}

class _PortfolioScreenState() extends State<PortfolioScreen> {
  bool _leases = false;

  @override
  Widget build(BuildContext context) {
    final leases = context.watch<AgencyLeasesViewModel>();
    return SubPageScaffold(
      title: 'Portefeuille',
      fallbackRoute: AgencyPaths.home,
      bottom: Padding(
        padding: const EdgeInsets.all(AppSpacing.screenGutter),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              AppChoiceChip(
                label: 'Biens',
                selected: !_leases,
                onSelected: () => setState(() => _leases = false),
              ),
              AppChoiceChip(
                label: 'Baux',
                selected: _leases,
                onSelected: () => setState(() => _leases = true),
              ),
              if (_leases)
                for (final filter in LeaseFilter.values)
                  AppChoiceChip(
                    label: filter.label,
                    selected: filter == leases.filter,
                    onSelected: () => leases.select(filter),
                  ),
            ],
          ),
        ),
      ),
      body: _leases ? const _Leases() : const _Properties(),
    );
  }
}

class const _Properties() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<AgencyPropertiesViewModel>();
    return AsyncListView<AgencyProperty>(
      state: viewModel.state,
      onRefresh: viewModel.load,
      emptyMessage: 'Aucun bien dans le portefeuille.',
      itemBuilder: (_, property) => PropertyCard(property: property),
    );
  }
}

class const _Leases() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<AgencyLeasesViewModel>();
    return AsyncListView<AgencyLease>(
      state: viewModel.state,
      onRefresh: viewModel.load,
      emptyMessage: 'Aucun bail dans cette situation.',
      itemBuilder: (_, lease) => LeaseCard(lease: lease),
    );
  }
}
