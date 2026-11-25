import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/inline_message.dart';
import '../messages_copy.dart';
import '../models/compose_option.dart';
import '../viewmodels/new_thread_viewmodel.dart';

class const NewThreadScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<NewThreadViewModel>();
    return Scaffold(
      appBar: AppBar(title: const Text('Nouveau message')),
      body: SafeArea(
        child: AsyncBody<List<ComposeOption>>(
          state: viewModel.state,
          onRetry: viewModel.load,
          isEmpty: (options) => options.isEmpty,
          emptyTitle: 'Aucun bail ne permet d’écrire pour le moment',
          emptyMessage: 'Vous pouvez écrire à l’agence tant qu’un de vos baux est visible dans votre espace.',
          builder: (context, options) =>
              _Form(viewModel: viewModel, options: options),
        ),
      ),
    );
  }
}

class const _Form({
  required final NewThreadViewModel viewModel,
  required final List<ComposeOption> options,
}) extends StatefulWidget {
  @override
  State<_Form> createState() => _FormState();
}

class _FormState() extends State<_Form> {
  final _formKey = GlobalKey<FormState>();
  final _subject = TextEditingController();
  final _body = TextEditingController();
  late ComposeOption _option = widget.options.first;

  @override
  void dispose() {
    _subject.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final router = GoRouter.of(context);
    await widget.viewModel.submit(
      option: _option,
      subject: _subject.text,
      body: _body.text,
    );
    final createdId = widget.viewModel.createdId;
    if (createdId != null && mounted) {
      unawaited(router.pushReplacement(AppRoutes.conversation(createdId)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final viewModel = widget.viewModel;
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.screenGutter),
        children: [
          Text(
            'Le message est adressé à l’agence qui gère votre bail et reste dans votre historique.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: context.palette.textMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text('Bail concerné', style: theme.textTheme.labelLarge),
          const SizedBox(height: AppSpacing.sm),
          DropdownButtonFormField<ComposeOption>(
            initialValue: _option,
            isExpanded: true,
            decoration: const InputDecoration(hintText: 'Choisir un bail'),
            items: [
              for (final option in widget.options)
                DropdownMenuItem(
                  value: option,
                  child: Text(option.label, overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (value) {
              if (value != null) setState(() => _option = value);
            },
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'Objet',
            placeholder: 'Ex. Question sur ma quittance de novembre',
            controller: _subject,
            maxLength: NewThreadViewModel.subjectMaxLength,
            textInputAction: TextInputAction.next,
            validator: (value) =>
                Validators.required(value, message: 'Indiquez un objet'),
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'Message',
            placeholder: 'Écrivez votre message à l’agence',
            controller: _body,
            maxLines: 6,
            maxLength: NewThreadViewModel.bodyMaxLength,
            keyboardType: TextInputType.multiline,
            validator: (value) =>
                Validators.required(value, message: 'Écrivez votre message'),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            notANoticeText,
            style: theme.textTheme.bodySmall?.copyWith(
              color: context.palette.textMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Vous pouvez ouvrir 5 conversations par heure et 20 par jour.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: context.palette.textMuted,
            ),
          ),
          if (viewModel.error != null) ...[
            const SizedBox(height: AppSpacing.md),
            InlineMessage(message: viewModel.error!),
          ],
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: 'Envoyer',
            expanded: true,
            loading: viewModel.submitting,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}
