import 'package:flutter/material.dart';

import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_choice_chip.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/form_sheet.dart';
import '../models/agency_intervention.dart';
import '../models/intervention_commands.dart';
import '../models/intervention_detail.dart';
import '../models/intervention_parts.dart';
import '../viewmodels/agency_access_viewmodels.dart';

class const QualifySheet({super.key, required final InterventionDetail detail})
    extends StatefulWidget {
  @override
  State<QualifySheet> createState() => _QualifySheetState();
}

class _QualifySheetState() extends State<QualifySheet> {
  late InterventionPriority _priority = widget.detail.priority;
  late Responsibility _responsibility = widget.detail.responsibility;
  late DateTime? _due = widget.detail.dueOn;

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _due ?? now,
      firstDate: DateTime(2000),
      lastDate: DateTime(now.year + 5),
    );
    if (picked != null) setState(() => _due = picked);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return FormSheet(
      title: 'Qualifier l’intervention',
      onSubmit: () => Navigator.of(context).pop(
        QualifyCommand(
          priority: _priority,
          responsibility: _responsibility,
          dueOn: _due,
        ),
      ),
      children: [
        Text('Priorité', style: theme.textTheme.labelLarge),
        ChoiceWrap(
          children: [
            for (final priority in InterventionPriority.values)
              AppChoiceChip(
                label: priority.label,
                selected: priority == _priority,
                onSelected: () => setState(() => _priority = priority),
              ),
          ],
        ),
        Text('Responsabilité', style: theme.textTheme.labelLarge),
        ChoiceWrap(
          children: [
            for (final responsibility in Responsibility.values)
              AppChoiceChip(
                label: responsibility.label,
                selected: responsibility == _responsibility,
                onSelected: () =>
                    setState(() => _responsibility = responsibility),
              ),
          ],
        ),
        AppButton(
          label: _due == null
              ? 'Choisir une échéance (facultatif)'
              : 'Échéance : ${Formatters.dateLong(_due!)}',
          style: AppButtonStyle.outline,
          expanded: true,
          onPressed: _pickDate,
        ),
      ],
    );
  }
}

class const DeclineSheet({super.key}) extends StatefulWidget {
  @override
  State<DeclineSheet> createState() => _DeclineSheetState();
}

class _DeclineSheetState() extends State<DeclineSheet> {
  static const _minNote = 3;

  final _note = TextEditingController();
  DeclineReason _reason = DeclineReason.duplicate;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _submit() {
    final note = _note.text.trim();
    if (note.length < _minNote) {
      setState(() => _error = 'Expliquez le refus (3 caractères au moins).');
      return;
    }
    Navigator.of(context).pop(DeclineCommand(reason: _reason, note: note));
  }

  @override
  Widget build(BuildContext context) {
    return FormSheet(
      title: 'Motif du refus',
      error: _error,
      onSubmit: _submit,
      children: [
        ChoiceWrap(
          children: [
            for (final reason in DeclineReason.values)
              AppChoiceChip(
                label: reason.label,
                selected: reason == _reason,
                onSelected: () => setState(() => _reason = reason),
              ),
          ],
        ),
        AppTextField(
          label: 'Explication pour le locataire',
          placeholder: 'Ex. : déjà signalée le 18 novembre',
          controller: _note,
          maxLines: 3,
          maxLength: 500,
        ),
      ],
    );
  }
}

class const AssignSheet({
  super.key,
  required final AgencySuppliersViewModel suppliers,
}) extends StatefulWidget {
  @override
  State<AssignSheet> createState() => _AssignSheetState();
}

class _AssignSheetState() extends State<AssignSheet> {
  Supplier? _selected;
  String? _error;

  void _submit() {
    final selected = _selected;
    if (selected == null) {
      setState(() => _error = 'Choisissez un prestataire.');
      return;
    }
    Navigator.of(context).pop(selected);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.suppliers,
      builder: (context, _) => FormSheet(
        title: 'Choisir un prestataire',
        error: _error,
        onSubmit: _submit,
        children: [
          SizedBox(
            height: 220,
            child: AsyncBody<List<Supplier>>(
              state: widget.suppliers.state,
              onRetry: widget.suppliers.load,
              isEmpty: (suppliers) => suppliers.isEmpty,
              emptyMessage: 'Aucun prestataire actif.',
              builder: (context, suppliers) => RadioGroup<Supplier>(
                groupValue: _selected,
                onChanged: (value) => setState(() => _selected = value),
                child: ListView(
                  children: [
                    for (final supplier in suppliers)
                      RadioListTile<Supplier>(
                        value: supplier,
                        title: Text(supplier.name),
                        subtitle: supplier.preferred
                            ? const Text('Prestataire préféré')
                            : null,
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class const DecisionSheet({
  super.key,
  required final InterventionApproval approval,
  required final List<InterventionFile> proofs,
}) extends StatefulWidget {
  @override
  State<DecisionSheet> createState() => _DecisionSheetState();
}

class _DecisionSheetState() extends State<DecisionSheet> {
  final _comment = TextEditingController();
  ApprovalDecision _decision = ApprovalDecision.accept;
  late InterventionFile _proof = widget.proofs.first;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  String _proofLabel(InterventionFile file) => file.createdAt == null
      ? 'Pièce écrite'
      : 'Pièce du ${Formatters.dateLong(file.createdAt!.toLocal())}';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return FormSheet(
      title: 'Décision du propriétaire',
      onSubmit: () => Navigator.of(context).pop(
        DecisionCommand(
          approvalId: widget.approval.id,
          decision: _decision,
          proofFileId: _proof.id,
          comment: _comment.text.trim(),
        ),
      ),
      children: [
        Text(
          'Montant soumis : ${widget.approval.amount.text}',
          style: theme.textTheme.bodyLarge,
        ),
        ChoiceWrap(
          children: [
            for (final decision in ApprovalDecision.values)
              AppChoiceChip(
                label: decision.label,
                selected: decision == _decision,
                onSelected: () => setState(() => _decision = decision),
              ),
          ],
        ),
        Text('Pièce écrite du propriétaire', style: theme.textTheme.labelLarge),
        ChoiceWrap(
          children: [
            for (final file in widget.proofs)
              AppChoiceChip(
                label: _proofLabel(file),
                selected: file.id == _proof.id,
                onSelected: () => setState(() => _proof = file),
              ),
          ],
        ),
        AppTextField(
          label: 'Commentaire (facultatif)',
          placeholder: 'Ex. : accord reçu par courrier',
          controller: _comment,
          maxLines: 2,
          maxLength: 500,
        ),
      ],
    );
  }
}

class const ReminderSheet({super.key, required final DateTime today})
    extends StatefulWidget {
  @override
  State<ReminderSheet> createState() => _ReminderSheetState();
}

class _ReminderSheetState() extends State<ReminderSheet> {
  final _note = TextEditingController();
  ReminderKind _kind = ReminderKind.reminder;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FormSheet(
      title: 'Type de relance',
      onSubmit: () => Navigator.of(context).pop(
        ReminderCommand(
          kind: _kind,
          performedOn: widget.today,
          note: _note.text.trim(),
        ),
      ),
      children: [
        Text(
          'Date : ${Formatters.dateLong(widget.today)}',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        ChoiceWrap(
          children: [
            for (final kind in ReminderKind.values)
              AppChoiceChip(
                label: kind.label,
                selected: kind == _kind,
                onSelected: () => setState(() => _kind = kind),
              ),
          ],
        ),
        AppTextField(
          label: 'Note (facultative)',
          placeholder: 'Ex. : rappel par SMS, sans réponse',
          controller: _note,
          maxLines: 3,
          maxLength: 500,
        ),
      ],
    );
  }
}
