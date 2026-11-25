import 'package:flutter/material.dart';

import 'app_palette.dart';
import 'app_radius.dart';
import 'app_spacing.dart';
import 'app_typography.dart';
import 'tokens.dart';

abstract final class AppTheme() {
  static ThemeData light() => _build(AppPalette.light, Brightness.light);
  static ThemeData dark() => _build(AppPalette.dark, Brightness.dark);

  static ThemeData _build(AppPalette palette, Brightness brightness) {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: palette.primary,
          brightness: brightness,
        ).copyWith(
          primary: palette.primary,
          onPrimary: palette.onPrimary,
          surface: palette.surface,
          onSurface: palette.text,
          error: palette.danger,
          onError: palette.onDanger,
          outline: palette.borderStrong,
        );
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: palette.background,
      canvasColor: palette.background,
      textTheme: AppTypography.textTheme(palette.text, palette.textMuted),
      dividerColor: palette.border,
      splashFactory: InkSparkle.splashFactory,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: palette.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        border: _border(palette.borderStrong),
        enabledBorder: _border(palette.borderStrong),
        focusedBorder: _border(palette.primary, width: EgTokens.focusWidth),
        errorBorder: _border(palette.danger),
        focusedErrorBorder: _border(palette.danger, width: EgTokens.focusWidth),
        hintStyle: TextStyle(color: palette.textSubtle),
        errorStyle: TextStyle(color: palette.onDangerSoft),
      ),
      extensions: [palette],
      visualDensity: VisualDensity.standard,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: palette.navBackground,
        contentTextStyle: TextStyle(color: palette.navText),
        actionTextColor: palette.navActive,
        showCloseIcon: true,
        closeIconColor: palette.navText,
      ),
      dividerTheme: DividerThemeData(
        color: palette.border,
        space: 1,
        thickness: EgTokens.borderWidth,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: palette.link),
      focusColor: palette.primary,
    );
  }

  static OutlineInputBorder _border(Color color, {double? width}) =>
      OutlineInputBorder(
        borderRadius: AppRadius.field,
        borderSide: BorderSide(
          color: color,
          width: width ?? EgTokens.borderWidth,
        ),
      );
}
