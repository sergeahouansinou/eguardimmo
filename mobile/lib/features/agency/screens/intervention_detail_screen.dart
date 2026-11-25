import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/state/load_state.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/refresh_failure_banner.dart';
import '../../../core/widgets/status_pill.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../../../core/widgets/write_reporting.dart';
import '../models/agency_access.dart';
import '../models/intervention_detail.dart';
import '../viewmodels/agency_access_viewmodels.dart';
import '../viewmodels/agency_intervention_viewmodel.dart';
import '../widgets/comment_form.dart';
import '../widgets/intervention_actions.dart';
import '../widgets/intervention_flows.dart';
import '../widgets/intervention_sections.dart';

class const InterventionDetailScreen({super.key}) extends StatefulWidget {
  @override
  State<InterventionDetailScreen> createState() =>
      _InterventionDetailScreenState();
}

class _InterventionDetailScreenState()
    extends State<InterventionDetailScreen>
    with WriteReporting<InterventionDetailScreen> {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<AgencyInterventionViewModel>();
    final access = context.watch<AgencyAccessViewModel>();
    final flows = InterventionFlows(
      viewModel,
      context.read<AgencySuppliersViewModel>(),
      report,
    );
    return SubPageScaffold(
      title: 'Intervention',
      fallbackRoute: RouteName.agencyInterventions,
      body: RefreshIndicator(
        onRefresh: () => Future.wait([viewModel.load(), access.load()]),
        child: AsyncBody<InterventionDetail>(
          state: viewModel.state,
          onRetry: viewModel.load,
          builder: (context, detail) {
            final canWrite = access.state.dataOrNull?.maintenanceWrite ?? false;
            final disabled = viewModel.busy || viewModel.state.isLoading;
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.screenGutter),
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    InterventionSummaryCard(detail: detail),
                    const SizedBox(height: AppSpacing.md),
                    _AccessNotice(access: access),
                    if (writeError case final message?) ...[
                      InlineMessage(message: message),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    if (canWrite) ...[
                      InterventionActionButtons(
                        detail: detail,
                        flows: flows,
                        disabled: disabled,
                      ),
                    ],
                    if (detail.quotes.isNotEmpty) ...[
                      QuotesCard(
                        quotes: detail.quotes,
                        canAct: canWrite && !disabled,
                        onAccept: (quote) => flows.acceptQuote(context, quote),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    if (detail.approvals.isNotEmpty) ...[
                      ApprovalsCard(
                        detail: detail,
                        canAct: canWrite && !disabled,
                        onRecord: (approval) =>
                            flows.recordDecision(context, detail, approval),
                        onWithdraw: (approval) =>
                            flows.withdrawApproval(context, approval),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    TimelineCard(
                      events: detail.events,
                      footer: canWrite
                          ? CommentForm(
                              disabled: disabled,
                              onSubmit: (command) =>
                                  flows.comment(context, command),
                            )
                          : null,
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class const _AccessNotice({required final AgencyAccessViewModel access})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final state = access.state;
    final AgencyAccess? data = state.dataOrNull;
    final Widget? notice = switch ((data, state)) {
      (AgencyAccess(maintenanceWrite: false), _) => const InlineMessage(
        message: 'Lecture seule : votre rôle ne permet pas de modifier les interventions.',
        tone: PillTone.info,
      ),
      (null, Failed<AgencyAccess>(:final message)) => RefreshFailureBanner(
        message: 'Droits indisponibles : $message',
        onRetry: access.load,
        padding: EdgeInsets.zero,
      ),
      _ => null,
    };
    if (notice == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: notice,
    );
  }
}
