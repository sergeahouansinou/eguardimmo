import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_sheet.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/inline_message.dart';
import '../services/marketplace_service.dart';
import '../viewmodels/visit_request_viewmodel.dart';

Future<void> showVisitSheet(
  BuildContext context, {
  required String listingRef,
}) {
  final service = context.read<MarketplaceService>();
  return showAppSheet<void>(
    context,
    builder: (_) => ChangeNotifierProvider(
      create: (_) => VisitRequestViewModel(service, listingRef),
      child: const VisitSheet(),
    ),
  );
}

class const VisitSheet({super.key}) extends StatefulWidget {
  @override
  State<VisitSheet> createState() => _VisitSheetState();
}

class _VisitSheetState() extends State<VisitSheet> {
  final _formKey = GlobalKey<FormState>();
  final _slot = TextEditingController();
  final _message = TextEditingController();

  @override
  void dispose() {
    _slot.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit(VisitRequestViewModel viewModel) async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    await viewModel.submit(slot: _slot.text, message: _message.text);
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<VisitRequestViewModel>();
    final theme = Theme.of(context);
    if (viewModel.sent) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Demande envoyée', style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Votre demande est transmise à l’agence. Elle vous répondra dès que possible.',
            style: theme.textTheme.bodyLarge,
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: 'Fermer',
            expanded: true,
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      );
    }
    return Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Demander une visite', style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.lg),
          AppTextField(
            label: 'Créneau souhaité',
            placeholder: 'ex. samedi 6 déc., 10 h à 12 h',
            controller: _slot,
            maxLength: VisitRequestViewModel.slotMaxLength,
            textInputAction: TextInputAction.next,
            validator: (value) =>
                Validators.required(value, message: 'Indiquez un créneau'),
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'Message',
            placeholder: 'ex. Nous sommes deux, arrivée en train.',
            controller: _message,
            maxLines: 3,
            maxLength: VisitRequestViewModel.messageMaxLength,
            keyboardType: TextInputType.multiline,
          ),
          if (viewModel.error != null) ...[
            const SizedBox(height: AppSpacing.md),
            InlineMessage(message: viewModel.error!),
          ],
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: 'Envoyer la demande',
            expanded: true,
            loading: viewModel.busy,
            onPressed: () => _submit(viewModel),
          ),
        ],
      ),
    );
  }
}
