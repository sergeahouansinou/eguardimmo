import 'package:flutter/material.dart';

import '../../../core/state/load_state.dart';
import '../../../core/widgets/app_button.dart';
import '../models/agency_access.dart';
import '../models/unpaid_item.dart';

/// Pied d'une carte d'impayé : le bouton n'apparaît que pour un impayé déjà
/// rattaché à un dossier de recouvrement et un rôle autorisé ; sinon, la
/// raison est dite.
class const ReminderFooter({
  super.key,
  required final UnpaidItem item,
  required final LoadState<AgencyAccess> access,
  required final bool busy,
  required final VoidCallback onRemind,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodySmall;
    final rights = access.dataOrNull;
    if (rights == null) {
      return switch (access) {
        Failed<AgencyAccess>() => Text(
          'Droits indisponibles : tirez pour actualiser.',
          style: style,
        ),
        _ => const SizedBox.shrink(),
      };
    }
    if (!rights.recoveryWrite) {
      return Text(
        'Lecture seule : votre rôle ne permet pas de relancer.',
        style: style,
      );
    }
    if (item.caseId == null) {
      return Text(
        'Aucun dossier de recouvrement : ouvrez-le depuis le site pour relancer.',
        style: style,
      );
    }
    return AppButton(
      label: 'Relancer',
      style: AppButtonStyle.outline,
      expanded: true,
      loading: busy,
      onPressed: onRemind,
    );
  }
}
