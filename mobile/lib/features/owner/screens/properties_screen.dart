import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/widgets/async_list_view.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../models/owner_unit.dart';
import '../viewmodels/owner_lists_viewmodels.dart';
import '../widgets/access_notices.dart';
import '../widgets/owner_cards.dart';

class const OwnerPropertiesScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<OwnerPropertiesViewModel>();
    return SubPageScaffold(
      title: 'Biens',
      fallbackRoute: RouteName.ownerHome,
      bottom: const AccessLine(),
      body: AsyncListView<OwnerUnit>(
        state: viewModel.state,
        onRefresh: viewModel.load,
        emptyMessage: 'Aucun bien n’est rattaché à votre mandat.',
        itemBuilder: (_, unit) => UnitCard(unit: unit),
      ),
    );
  }
}
