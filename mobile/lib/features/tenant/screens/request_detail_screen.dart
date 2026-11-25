import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/confirm_sheet.dart';
import '../../../core/widgets/info_card.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/key_value_row.dart';
import '../../../core/widgets/status_pill.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../models/tenant_intervention.dart';
import '../viewmodels/requests_viewmodel.dart';
import '../widgets/request_card.dart';

class const RequestDetailScreen({super.key}) extends StatefulWidget {
  @override
  State<RequestDetailScreen> createState() => _RequestDetailScreenState();
}

class _RequestDetailScreenState() extends State<RequestDetailScreen> {
  final _comment = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _send(RequestDetailViewModel viewModel) async {
    if (_comment.text.trim().isEmpty) {
      setState(() => _error = 'Écrivez un message avant d’envoyer.');
      return;
    }
    final error = await viewModel.comment(_comment.text);
    if (!mounted) return;
    setState(() => _error = error);
    if (error == null) _comment.clear();
  }

  Future<void> _cancel(RequestDetailViewModel viewModel) async {
    final confirmed = await confirmAction(
      context,
      title: 'Annuler cette demande ?',
      message: 'La demande sera classée comme annulée. Vous pourrez en signaler une nouvelle.',
      confirmLabel: 'Annuler la demande',
      keepLabel: 'Conserver',
    );
    if (!confirmed) return;
    final error = await viewModel.cancel();
    if (mounted) setState(() => _error = error);
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<RequestDetailViewModel>();
    return SubPageScaffold(
      title: 'Demande',
      fallbackRoute: RouteName.tenantRequests,
      body: RefreshIndicator(
        onRefresh: viewModel.load,
        child: AsyncBody<TenantIntervention>(
          state: viewModel.state,
          onRetry: viewModel.load,
          builder: (context, request) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.screenGutter),
            children: [
              _Summary(request: request),
              if (request.visits.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                _Visits(visits: request.visits),
              ],
              if (_error case final message?) ...[
                const SizedBox(height: AppSpacing.md),
                InlineMessage(message: message),
              ],
              const SizedBox(height: AppSpacing.md),
              _Timeline(events: request.events ?? const []),
              if (request.state.isOpen) ...[
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  label: 'Ajouter un message',
                  placeholder: 'Ex. : je suis disponible jeudi matin',
                  controller: _comment,
                  maxLines: 3,
                  maxLength: 500,
                ),
                const SizedBox(height: AppSpacing.sm),
                AppButton(
                  label: 'Envoyer le message',
                  expanded: true,
                  loading: viewModel.busy,
                  onPressed: () => _send(viewModel),
                ),
              ],
              if (request.cancellable) ...[
                const SizedBox(height: AppSpacing.md),
                AppButton(
                  label: 'Annuler la demande',
                  style: AppButtonStyle.dangerOutline,
                  expanded: true,
                  loading: viewModel.busy,
                  onPressed: () => _cancel(viewModel),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              Text(
                'L’ajout de photos et la gestion des visites ne sont pas encore disponibles dans l’application.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class const _Summary({required final TenantIntervention request})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StatusPill(
            label: request.state.label,
            tone: requestTone(request.state),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(request.title, style: theme.textTheme.titleLarge),
          Text(request.reference, style: theme.textTheme.bodySmall),
          const SizedBox(height: AppSpacing.sm),
          Text(request.description, style: theme.textTheme.bodyLarge),
          const SizedBox(height: AppSpacing.sm),
          if (request.natureLabel case final nature?)
            KeyValueRow(label: 'Nature', value: nature),
          KeyValueRow(label: 'Lieu', value: request.place),
          KeyValueRow(
            label: 'Signalée le',
            value: Formatters.dateLong(request.reportedOn),
          ),
          if (request.urgency case final urgency?)
            KeyValueRow(label: 'Urgence', value: urgency.label),
          if (request.completedOn case final done?)
            KeyValueRow(label: 'Terminée le', value: Formatters.dateLong(done)),
          if (request.declineReason case final reason?)
            KeyValueRow(label: 'Motif', value: reason),
        ],
      ),
    );
  }
}

class const _Visits({required final List<RequestVisit> visits})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text('Visites', style: theme.textTheme.titleMedium),
          ),
          for (final visit in visits)
            KeyValueRow(
              label:
                  '${Formatters.dateLong(visit.scheduledOn)}, ${slotLabel(visit.slot)}',
              value: visit.status.label,
            ),
        ],
      ),
    );
  }
}

class const _Timeline({required final List<RequestEvent> events})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.palette;
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text('Historique', style: theme.textTheme.titleMedium),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (events.isEmpty)
            Text(
              'Aucun échange pour le moment.',
              style: theme.textTheme.bodyMedium,
            ),
          for (final event in events)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${event.byTenant ? 'Vous' : 'Équipe de gestion'} · ${Formatters.dateTime(event.createdAt.toLocal())}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: p.textMuted,
                    ),
                  ),
                  Text(event.text, style: theme.textTheme.bodyMedium),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
