import 'package:flutter/material.dart';

import 'tokens.dart';

/// Échelle typographique issue des jetons : les écrans lisent
/// `Theme.of(context).textTheme` et ne déclarent jamais de `fontSize`.
/// La famille « Inter » n'est utilisée qu'une fois la police embarquée
/// dans pubspec.yaml ; sans fichier, le texte retombe sur la police système.
abstract final class AppTypography() {
  static const String? family = null;

  static TextStyle _style(
    double size,
    double lineHeight,
    FontWeight weight,
    Color color,
  ) => TextStyle(
    fontFamily: family,
    fontSize: size,
    height: lineHeight / size,
    fontWeight: weight,
    color: color,
  );

  static TextTheme textTheme(Color text, Color muted) => TextTheme(
    headlineSmall: _style(
      EgTokens.textEmptyTitleFontSize,
      EgTokens.textEmptyTitleLineHeight,
      EgTokens.textEmptyTitleFontWeight,
      text,
    ),
    titleLarge: _style(
      EgTokens.textPageTitleFontSize,
      EgTokens.textPageTitleLineHeight,
      EgTokens.textPageTitleFontWeight,
      text,
    ),
    titleMedium: _style(
      EgTokens.textValueFontSize,
      EgTokens.textValueLineHeight,
      EgTokens.textValueFontWeight,
      text,
    ),
    titleSmall: _style(
      EgTokens.textBlockTitleFontSize,
      EgTokens.textBlockTitleLineHeight,
      EgTokens.textBlockTitleFontWeight,
      text,
    ),
    bodyLarge: _style(
      EgTokens.textBodyFontSize,
      EgTokens.textBodyLineHeight,
      EgTokens.textBodyFontWeight,
      text,
    ),
    bodyMedium: _style(
      EgTokens.textBodyFontSize,
      EgTokens.textBodyLineHeight,
      EgTokens.textBodyFontWeight,
      text,
    ),
    bodySmall: _style(
      EgTokens.textCaptionFontSize,
      EgTokens.textCaptionLineHeight,
      EgTokens.textCaptionFontWeight,
      muted,
    ),
    labelLarge: _style(
      EgTokens.textBodyStrongFontSize,
      EgTokens.textBodyStrongLineHeight,
      EgTokens.textBodyStrongFontWeight,
      text,
    ),
    labelSmall: _style(
      EgTokens.textCaptionFontSize,
      EgTokens.textCaptionLineHeight,
      EgTokens.textCaptionFontWeight,
      muted,
    ),
  );
}
