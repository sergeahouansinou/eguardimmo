import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/routes/route_args.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/inline_message.dart';
import '../models/support_enums.dart';
import '../support_copy.dart';
import '../viewmodels/open_ticket_viewmodel.dart';

class const NewTicketScreen({super.key}) extends StatefulWidget {
  @override
  State<NewTicketScreen> createState() => _NewTicketScreenState();
}

class _NewTicketScreenState() extends State<NewTicketScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subject = TextEditingController();
  final _body = TextEditingController();
  TicketCategory _category = TicketCategory.other;

  @override
  void dispose() {
    _subject.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final viewModel = context.read<OpenTicketViewModel>();
    final navigator = Navigator.of(context);
    await viewModel.submit(
      category: _category,
      subject: _subject.text,
      body: _body.text,
    );
    final createdId = viewModel.createdId;
    if (createdId != null && mounted) {
      unawaited(
        navigator.pushReplacementNamed<Object?, Object?>(
          RouteName.supportTicket,
          arguments: ResourceArgs(createdId),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<OpenTicketViewModel>();
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(
      color: context.palette.textMuted,
    );
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvelle demande')),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.screenGutter),
            children: [
              Text(
                'Décrivez ce que vous faisiez, ce que vous attendiez et ce qui s’est passé.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: context.palette.textMuted,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text('Catégorie', style: theme.textTheme.labelLarge),
              const SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<TicketCategory>(
                initialValue: _category,
                isExpanded: true,
                decoration: const InputDecoration(
                  hintText: 'Choisir une catégorie',
                ),
                items: [
                  for (final category in TicketCategory.values)
                    DropdownMenuItem(
                      value: category,
                      child: Text(category.label),
                    ),
                ],
                onChanged: (value) {
                  if (value != null) setState(() => _category = value);
                },
              ),
              const SizedBox(height: AppSpacing.md),
              AppTextField(
                label: 'Objet',
                placeholder: 'Ex. Je ne retrouve pas un document',
                controller: _subject,
                maxLength: OpenTicketViewModel.subjectMaxLength,
                textInputAction: TextInputAction.next,
                validator: (value) =>
                    Validators.required(value, message: 'Indiquez un objet'),
              ),
              const SizedBox(height: AppSpacing.md),
              AppTextField(
                label: 'Message',
                placeholder: 'Décrivez votre demande : ce que vous faisiez, ce que vous attendiez, ce qui s’est passé.',
                controller: _body,
                maxLines: 6,
                maxLength: OpenTicketViewModel.bodyMaxLength,
                keyboardType: TextInputType.multiline,
                validator: (value) => Validators.required(
                  value,
                  message: 'Décrivez votre demande',
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(supportPrivacyText, style: muted),
              const SizedBox(height: AppSpacing.sm),
              Text(supportOpenLimitText, style: muted),
              if (viewModel.error != null) ...[
                const SizedBox(height: AppSpacing.md),
                InlineMessage(message: viewModel.error!),
              ],
              const SizedBox(height: AppSpacing.lg),
              AppButton(
                label: 'Envoyer la demande',
                expanded: true,
                loading: viewModel.submitting,
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
