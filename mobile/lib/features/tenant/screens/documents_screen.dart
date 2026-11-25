import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/info_card.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../models/lease_document.dart';
import '../tenant_paths.dart';
import '../viewmodels/tenant_leases_viewmodels.dart';

class const DocumentsScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<TenantDocumentsViewModel>();
    final theme = Theme.of(context);
    return SubPageScaffold(
      title: 'Documents',
      fallbackRoute: TenantPaths.home,
      body: RefreshIndicator(
        onRefresh: viewModel.load,
        child: AsyncBody<List<LeaseDocuments>>(
          state: viewModel.state,
          onRetry: viewModel.load,
          isEmpty: (groups) => groups.every((g) => g.documents.isEmpty),
          emptyMessage:
              'Votre agence n’a partagé aucun document pour le moment.',
          builder: (context, groups) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.screenGutter),
            children: [
              for (final group in groups)
                if (group.documents.isNotEmpty) ...[
                  Semantics(
                    header: true,
                    child: Text(
                      'Bail ${group.leaseReference}',
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  for (final document in group.documents) ...[
                    _DocumentCard(document: document),
                    const SizedBox(height: AppSpacing.md),
                  ],
                ],
              Text(
                'Le téléchargement des documents n’est pas encore disponible dans l’application.',
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class const _DocumentCard({required final LeaseDocument document})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: context.palette.textMuted,
    );
    final details = [
      ?document.fileName,
      if (document.sizeBytes case final size?) Formatters.fileSize(size),
      if (document.sharedAt case final shared?)
        'partagé le ${Formatters.dateLong(shared.toLocal())}',
    ];
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(document.kindLabel, style: theme.textTheme.titleMedium),
          if (details.isNotEmpty) Text(details.join(' · '), style: muted),
        ],
      ),
    );
  }
}
