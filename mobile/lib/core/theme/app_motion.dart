import 'package:flutter/animation.dart';

import 'tokens.dart';

abstract final class AppMotion() {
  static const Duration fast = EgTokens.durationFast;
  static const Duration base = EgTokens.durationNormal;
  static const Duration slow = Duration(milliseconds: 320);
  static const Curve standard = Cubic(.2, .8, .2, 1);
}
