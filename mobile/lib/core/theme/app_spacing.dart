import 'tokens.dart';

abstract final class AppSpacing() {
  static const double xxs = EgTokens.space2;
  static const double xs = EgTokens.space4;
  static const double sm = EgTokens.space8;
  static const double md = EgTokens.space12;
  static const double lg = EgTokens.space16;
  static const double xl = EgTokens.space24;
  static const double xxl = EgTokens.space32;
  static const double huge = EgTokens.space40;

  static const double screenGutter = lg;
  static const double minTapTarget = 48;
  static const double headerBarHeight = 56;
}
