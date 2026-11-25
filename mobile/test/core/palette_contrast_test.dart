import 'package:eguardimmo/core/theme/app_palette.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';

double contrast(Color foreground, Color background) {
  final over = Color.alphaBlend(foreground, background);
  final a = over.computeLuminance();
  final b = background.computeLuminance();
  final lighter = a > b ? a : b;
  final darker = a > b ? b : a;
  return (lighter + 0.05) / (darker + 0.05);
}

void main() {
  for (final (name, palette) in [
    ('clair', AppPalette.light),
    ('sombre', AppPalette.dark),
  ]) {
    group('contrastes AA ($name)', () {
      final pairs = <String, (Color, Color)>{
        'texte / fond': (palette.text, palette.background),
        'texte / surface': (palette.text, palette.surface),
        'texte atténué / surface': (palette.textMuted, palette.surface),
        'texte discret / fond': (palette.textSubtle, palette.background),
        'texte discret / surface': (palette.textSubtle, palette.surface),
        'bouton principal': (palette.onPrimary, palette.primary),
        'bouton accent': (palette.onAccent, palette.accent),
        'bouton danger': (palette.onDanger, palette.danger),
        'lien / surface': (palette.link, palette.surface),
        'lien / fond': (palette.link, palette.background),
        'en-tête': (palette.navText, palette.navBackground),
        'en-tête actif': (palette.navActive, palette.navBackground),
        'succès': (palette.onSuccessSoft, palette.surface),
        'alerte': (palette.onWarningSoft, palette.surface),
        'danger': (palette.onDangerSoft, palette.surface),
        'info': (palette.onPrimarySoft, palette.surface),
      };
      pairs.forEach((label, pair) {
        test(label, () {
          expect(contrast(pair.$1, pair.$2), greaterThanOrEqualTo(4.5));
        });
      });
    });
  }
}
