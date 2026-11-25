import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../models/agency_intervention.dart';
import '../models/intervention_detail.dart';
import 'intervention_flows.dart';

const _cancellable = {
  InterventionStatus.reported,
  InterventionStatus.qualified,
  InterventionStatus.quoting,
  InterventionStatus.awaitingApproval,
  InterventionStatus.approved,
  InterventionStatus.scheduled,
  InterventionStatus.inProgress,
};

/// Actions proposées selon le statut lu sur le serveur ; le serveur reste
/// l'autorité et refuse (409) toute transition qui ne convient plus.
class const InterventionActionButtons({
  super.key,
  required final InterventionDetail detail,
  required final InterventionFlows flows,
  required final bool disabled,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final status = detail.status;
    final buttons = <Widget>[
      if (status == InterventionStatus.reported)
        AppButton(
          label: 'Qualifier',
          expanded: true,
          loading: disabled,
          onPressed: () => flows.qualify(context, detail),
        ),
      if (status == InterventionStatus.qualified ||
          status == InterventionStatus.quoting)
        AppButton(
          label: 'Assigner un prestataire',
          expanded: true,
          loading: disabled,
          onPressed: () => flows.assign(context),
        ),
      if (status == InterventionStatus.reported ||
          status == InterventionStatus.qualified)
        AppButton(
          label: 'Refuser la demande',
          style: AppButtonStyle.outline,
          expanded: true,
          loading: disabled,
          onPressed: () => flows.decline(context),
        ),
      if (_cancellable.contains(status))
        AppButton(
          label: 'Annuler l’intervention',
          style: AppButtonStyle.dangerOutline,
          expanded: true,
          loading: disabled,
          onPressed: () => flows.cancel(context),
        ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final button in buttons) ...[
          button,
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}
