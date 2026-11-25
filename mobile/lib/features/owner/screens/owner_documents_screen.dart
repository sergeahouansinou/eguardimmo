import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/widgets/async_list_view.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../models/owner_document.dart';
import '../owner_paths.dart';
import '../viewmodels/owner_lists_viewmodels.dart';
import '../widgets/access_notices.dart';
import '../widgets/owner_cards.dart';

class const OwnerDocumentsScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<OwnerDocumentsViewModel>();
    return SubPageScaffold(
      title: 'Documents',
      fallbackRoute: OwnerPaths.home,
      bottom: const AccessLine(),
      body: AsyncListView<OwnerDocument>(
        state: viewModel.state,
        onRefresh: viewModel.load,
        emptyMessage: 'Aucun document n’a été partagé pour le moment.',
        footer: 'Le téléchargement des documents n’est pas encore disponible dans l’application.',
        itemBuilder: (_, document) => DocumentCard(document: document),
      ),
    );
  }
}
