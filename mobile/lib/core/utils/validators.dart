abstract final class Validators() {
  static final RegExp _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');

  static String? required(
    String? value, {
    String message = 'Champ obligatoire',
  }) => (value == null || value.trim().isEmpty) ? message : null;

  static String? email(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return 'Adresse e-mail obligatoire';
    return _email.hasMatch(trimmed) ? null : 'Adresse e-mail invalide';
  }

  static String? password(String? value) {
    if (value == null || value.isEmpty) return 'Mot de passe obligatoire';
    return null;
  }

  static String? maxLength(String? value, int max) =>
      (value != null && value.trim().length > max)
      ? '$max caractères maximum'
      : null;
}
