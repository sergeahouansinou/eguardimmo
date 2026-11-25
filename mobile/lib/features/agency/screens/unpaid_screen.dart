import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/models/money.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_sheet.dart';
import '../../../core/widgets/async_list_view.dart';
import '../../../core/widgets/confirm_sheet.dart';
import '../../../core/widgets/info_card.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/key_value_row.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../../../core/widgets/write_reporting.dart';
import '../models/intervention_commands.dart';
import '../models/unpaid_item.dart';
import '../viewmodels/agency_access_viewmodels.dart';
import '../viewmodels/agency_viewmodels.dart';
import '../widgets/agency_cards.dart';
import '../widgets/intervention_forms.dart';
import '../widgets/reminder_footer.dart';

class const UnpaidScreen({super.key}) extends StatefulWidget {
  @override
  State<UnpaidScreen> createState() => _UnpaidScreenState();
}

class _UnpaidScreenState()
    extends State<UnpaidScreen>
    with WriteReporting<UnpaidScreen> {
  Future<void> _remind(UnpaidViewModel viewModel, UnpaidItem item) async {
    final command = await showAppSheet<ReminderCommand>(
      context,
      builder: (_) => ReminderSheet(today: viewModel.today),
    );
    if (command == null || !mounted) return;
    final confirmed = await confirmAction(
      context,
      title: 'Enregistrer cette relance ?',
      message:
          '${command.kind.label} du ${Formatters.dateLong(command.performedOn)} pour ${item.partyName ?? 'ce locataire'}, dossier ${item.caseNumber}. '
          'Elle est inscrite au dossier ; aucun message n’est envoyé.',
      confirmLabel: 'Confirmer la relance',
      keepLabel: 'Revenir',
      destructive: false,
    );
    if (confirmed) {
      await report(
        () => viewModel.remind(item, command),
        'Relance enregistrée.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<UnpaidViewModel>();
    final access = context.watch<AgencyAccessViewModel>();
    final items = viewModel.state.dataOrNull ?? const <UnpaidItem>[];
    return SubPageScaffold(
      title: 'Impayés',
      fallbackRoute: RouteName.agencyHome,
      body: AsyncListView<UnpaidItem>(
        state: viewModel.state,
        onRefresh: () => Future.wait([viewModel.load(), access.load()]),
        emptyMessage: 'Aucun impayé : toutes les échéances sont à jour.',
        header: [
          if (writeError case final message?) InlineMessage(message: message),
          if (items.isNotEmpty) _Total(items: items),
        ],
        itemBuilder: (_, item) => UnpaidCard(
          item: item,
          footer: ReminderFooter(
            item: item,
            access: access.state,
            busy: viewModel.busy,
            onRemind: () => _remind(viewModel, item),
          ),
        ),
      ),
    );
  }
}

class const _Total({required final List<UnpaidItem> items})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final totals = <String, int>{};
    for (final item in items) {
      totals.update(
        item.outstanding.currency,
        (sum) => sum + item.outstanding.minor,
        ifAbsent: () => item.outstanding.minor,
      );
    }
    return InfoCard(
      child: Column(
        children: [
          KeyValueRow(label: 'Créances en retard', value: '${items.length}'),
          KeyValueRow(
            label: 'Reste dû',
            value: [
              for (final MapEntry(:key, :value) in totals.entries)
                Money(value, key).text,
            ].join(' + '),
            emphasized: true,
          ),
        ],
      ),
    );
  }
}
