import 'package:flutter/material.dart';

import 'tokens.dart';

/// Rôles sémantiques alimentés par les jetons partagés (packages/tokens).
/// Changer une valeur de marque se fait dans le paquet de jetons, jamais ici.
@immutable
class const AppPalette({
  required final Color background,
  required final Color surface,
  required final Color surfaceMuted,
  required final Color border,
  required final Color borderStrong,
  required final Color text,
  required final Color textMuted,
  required final Color textSubtle,
  required final Color primary,
  required final Color onPrimary,
  required final Color primarySoft,
  required final Color onPrimarySoft,
  required final Color link,
  required final Color accent,
  required final Color onAccent,
  required final Color navBackground,
  required final Color navText,
  required final Color navActive,
  required final Color successSoft,
  required final Color onSuccessSoft,
  required final Color warningSoft,
  required final Color onWarningSoft,
  required final Color dangerSoft,
  required final Color onDangerSoft,
  required final Color danger,
  required final Color onDanger,
  required final Color overlay,
}) extends ThemeExtension<AppPalette> {
  static const light = AppPalette(
    background: EgTokens.lightBgPage,
    surface: EgTokens.lightBgSurface,
    surfaceMuted: EgTokens.lightBgMuted,
    border: EgTokens.lightBorderDefault,
    borderStrong: EgTokens.lightBorderControl,
    text: EgTokens.lightTextDefault,
    textMuted: EgTokens.lightTextMuted,
    textSubtle: EgTokens.lightTextSubtle,
    primary: EgTokens.lightActionDefault,
    onPrimary: EgTokens.lightActionText,
    primarySoft: EgTokens.lightActionSubtle,
    onPrimarySoft: EgTokens.lightActionOnSubtle,
    link: EgTokens.lightActionDefault,
    accent: EgTokens.lightAccentDefault,
    onAccent: EgTokens.lightAccentOn,
    navBackground: EgTokens.lightNavBg,
    navText: EgTokens.lightNavText,
    navActive: EgTokens.lightNavActive,
    successSoft: EgTokens.lightSuccessBg,
    onSuccessSoft: EgTokens.lightSuccessText,
    warningSoft: EgTokens.lightWarningBg,
    onWarningSoft: EgTokens.lightWarningText,
    dangerSoft: EgTokens.lightDangerBg,
    onDangerSoft: EgTokens.lightDangerText,
    danger: EgTokens.lightDangerDefault,
    onDanger: EgTokens.lightTextInverse,
    overlay: Color(0x8C0B2E38),
  );

  static const dark = AppPalette(
    background: EgTokens.darkBgPage,
    surface: EgTokens.darkBgSurface,
    surfaceMuted: EgTokens.darkBgMuted,
    border: EgTokens.darkBorderDefault,
    borderStrong: EgTokens.darkBorderControl,
    text: EgTokens.darkTextDefault,
    textMuted: EgTokens.darkTextMuted,
    textSubtle: EgTokens.darkTextSubtle,
    primary: EgTokens.darkActionDefault,
    onPrimary: EgTokens.darkActionText,
    primarySoft: EgTokens.darkActionSubtle,
    onPrimarySoft: EgTokens.darkActionOnSubtle,
    link: EgTokens.darkActionOnSubtle,
    accent: EgTokens.darkAccentDefault,
    onAccent: EgTokens.darkAccentOn,
    navBackground: EgTokens.darkNavBg,
    navText: EgTokens.darkNavText,
    navActive: EgTokens.darkNavActive,
    successSoft: EgTokens.darkSuccessBg,
    onSuccessSoft: EgTokens.darkSuccessBorder,
    warningSoft: EgTokens.darkWarningBg,
    onWarningSoft: EgTokens.darkWarningBorder,
    dangerSoft: EgTokens.darkDangerBg,
    onDangerSoft: EgTokens.darkTextDanger,
    danger: EgTokens.darkDangerDefault,
    onDanger: EgTokens.darkTextInverse,
    overlay: Color(0xB3000000),
  );

  List<Color> get _all => [
    background,
    surface,
    surfaceMuted,
    border,
    borderStrong,
    text,
    textMuted,
    textSubtle,
    primary,
    onPrimary,
    primarySoft,
    onPrimarySoft,
    link,
    accent,
    onAccent,
    navBackground,
    navText,
    navActive,
    successSoft,
    onSuccessSoft,
    warningSoft,
    onWarningSoft,
    dangerSoft,
    onDangerSoft,
    danger,
    onDanger,
    overlay,
  ];

  @override
  AppPalette copyWith() => this;

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    final mixed = [
      for (var i = 0; i < _all.length; i++)
        Color.lerp(_all[i], other._all[i], t)!,
    ];
    return AppPalette(
      background: mixed[0],
      surface: mixed[1],
      surfaceMuted: mixed[2],
      border: mixed[3],
      borderStrong: mixed[4],
      text: mixed[5],
      textMuted: mixed[6],
      textSubtle: mixed[7],
      primary: mixed[8],
      onPrimary: mixed[9],
      primarySoft: mixed[10],
      onPrimarySoft: mixed[11],
      link: mixed[12],
      accent: mixed[13],
      onAccent: mixed[14],
      navBackground: mixed[15],
      navText: mixed[16],
      navActive: mixed[17],
      successSoft: mixed[18],
      onSuccessSoft: mixed[19],
      warningSoft: mixed[20],
      onWarningSoft: mixed[21],
      dangerSoft: mixed[22],
      onDangerSoft: mixed[23],
      danger: mixed[24],
      onDanger: mixed[25],
      overlay: mixed[26],
    );
  }
}

extension PaletteContext on BuildContext {
  AppPalette get palette => Theme.of(this).extension<AppPalette>()!;
}
