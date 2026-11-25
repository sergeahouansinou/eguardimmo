import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../models/intervention_commands.dart';

class const CommentForm({
  super.key,
  required final Future<bool> Function(CommentCommand command) onSubmit,
  required final bool disabled,
}) extends StatefulWidget {
  @override
  State<CommentForm> createState() => _CommentFormState();
}

class _CommentFormState() extends State<CommentForm> {
  final _text = TextEditingController();
  bool _tenant = false;
  bool _owner = false;
  String? _error;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _text.text.trim();
    if (text.isEmpty) {
      setState(() => _error = 'Écrivez un commentaire avant de publier.');
      return;
    }
    setState(() => _error = null);
    final published = await widget.onSubmit(
      CommentCommand(
        text: text,
        visibleToTenant: _tenant,
        visibleToOwner: _owner,
      ),
    );
    if (published && mounted) {
      _text.clear();
      setState(() {
        _tenant = false;
        _owner = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(
          label: 'Ajouter un commentaire',
          placeholder: 'Ex. : prestataire prévenu, passage jeudi',
          controller: _text,
          maxLines: 3,
          maxLength: 500,
        ),
        if (_error case final message?)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Text(
              message,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _tenant,
          onChanged: (value) => setState(() => _tenant = value ?? false),
          title: const Text('Visible par le locataire'),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _owner,
          onChanged: (value) => setState(() => _owner = value ?? false),
          title: const Text('Visible par le propriétaire'),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Publier le commentaire',
          expanded: true,
          loading: widget.disabled,
          onPressed: _submit,
        ),
      ],
    );
  }
}
