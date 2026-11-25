import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_choice_chip.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../models/report_option.dart';
import '../models/tenant_intervention.dart';
import '../tenant_paths.dart';
import '../viewmodels/new_request_viewmodel.dart';

class const NewRequestScreen({super.key}) extends StatefulWidget {
  @override
  State<NewRequestScreen> createState() => _NewRequestScreenState();
}

class _NewRequestScreenState() extends State<NewRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _room = TextEditingController();
  final _availability = TextEditingController();

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _room.dispose();
    _availability.dispose();
    super.dispose();
  }

  Future<void> _submit(NewRequestViewModel viewModel) async {
    if (!_formKey.currentState!.validate()) return;
    final created = await viewModel.submit(
      title: _title.text,
      description: _description.text,
      room: _room.text,
      availability: _availability.text,
    );
    if (created == null || !mounted) return;
    context.pushReplacement(TenantPaths.request(created.id));
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<NewRequestViewModel>();
    return SubPageScaffold(
      title: 'Signaler un problème',
      fallbackRoute: TenantPaths.requests,
      body: AsyncBody<List<ReportOption>>(
        state: viewModel.state,
        onRetry: viewModel.load,
        isEmpty: (options) => options.isEmpty,
        emptyTitle: 'Signalement indisponible',
        emptyMessage: 'Aucun bail actif ne permet de signaler un problème depuis ce compte.',
        builder: (context, options) => Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.screenGutter),
            children: [
              if (options.length > 1) ...[
                _Label(
                  'Bail',
                  child: ChipRow(
                    children: [
                      for (final option in options)
                        AppChoiceChip(
                          label: option.label,
                          selected: viewModel.option == option,
                          onSelected: () => viewModel.selectLease(option),
                        ),
                    ],
                  ),
                ),
              ],
              if (viewModel.option case final option?) ...[
                _Label(
                  'Nature du problème',
                  child: Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final nature in option.natures)
                        AppChoiceChip(
                          label: nature.label,
                          selected: viewModel.nature == nature,
                          onSelected: () => viewModel.selectNature(nature),
                        ),
                    ],
                  ),
                ),
                if (viewModel.fieldError('nature_term_id') case final e?)
                  Text(e, style: Theme.of(context).textTheme.bodySmall),
                _Label(
                  'Lieu',
                  child: Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final unit in option.units)
                        AppChoiceChip(
                          label: unit.label,
                          selected: viewModel.unit == unit,
                          onSelected: () => viewModel.selectUnit(unit),
                        ),
                      if (option.commonAreaAllowed)
                        AppChoiceChip(
                          label: 'Parties communes',
                          selected: viewModel.commonArea,
                          onSelected: viewModel.selectCommonArea,
                        ),
                    ],
                  ),
                ),
                _Label(
                  'Urgence',
                  child: Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final urgency in Urgency.values)
                        AppChoiceChip(
                          label: urgency.label,
                          selected: viewModel.urgency == urgency,
                          onSelected: () => viewModel.selectUrgency(
                            viewModel.urgency == urgency ? null : urgency,
                          ),
                        ),
                    ],
                  ),
                ),
                AppTextField(
                  label: 'Titre',
                  placeholder: 'Ex. : Fuite sous l’évier',
                  controller: _title,
                  maxLength: 120,
                  validator: (v) =>
                      Validators.required(v, message: 'Titre obligatoire') ??
                      ((v ?? '').trim().length < 3
                          ? '3 caractères minimum'
                          : null),
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  label: 'Description',
                  placeholder:
                      'Ex. : De l’eau coule sous l’évier de la cuisine',
                  controller: _description,
                  maxLines: 4,
                  maxLength: 1000,
                  validator: (v) => Validators.required(
                    v,
                    message: 'Description obligatoire',
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  label: 'Pièce (facultatif)',
                  placeholder: 'Ex. : Cuisine',
                  controller: _room,
                  maxLength: 80,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  label: 'Disponibilités (facultatif)',
                  placeholder: 'Ex. : En semaine après 18 h',
                  controller: _availability,
                  maxLength: 200,
                ),
              ],
              if (viewModel.error case final message?) ...[
                const SizedBox(height: AppSpacing.md),
                InlineMessage(message: message),
              ],
              const SizedBox(height: AppSpacing.lg),
              AppButton(
                label: 'Envoyer la demande',
                expanded: true,
                loading: viewModel.submitting,
                onPressed: viewModel.option == null || viewModel.nature == null
                    ? null
                    : () => _submit(viewModel),
              ),
              if (viewModel.option != null && viewModel.nature == null)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.sm),
                  child: Text(
                    'Choisissez la nature du problème pour envoyer la demande.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class const _Label(final String text, {required final Widget child})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.md),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(text, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: AppSpacing.sm),
        Align(alignment: Alignment.centerLeft, child: child),
      ],
    ),
  );
}
