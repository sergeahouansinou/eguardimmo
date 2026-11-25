import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';

class const AppTextField({
  super.key,
  required final String label,
  required final String placeholder,
  required final TextEditingController controller,
  final String? Function(String?)? validator,
  final TextInputType? keyboardType,
  final bool obscureText = false,
  final Iterable<String>? autofillHints,
  final TextInputAction? textInputAction,
  final int maxLines = 1,
  final int? maxLength,
  final Widget? suffix,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: AppSpacing.sm),
        TextFormField(
          controller: controller,
          validator: validator,
          keyboardType: keyboardType,
          obscureText: obscureText,
          autofillHints: autofillHints,
          textInputAction: textInputAction,
          maxLines: obscureText ? 1 : maxLines,
          maxLength: maxLength,
          decoration: InputDecoration(
            hintText: placeholder,
            suffixIcon: suffix,
          ),
        ),
      ],
    );
  }
}
