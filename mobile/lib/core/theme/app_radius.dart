import 'package:flutter/painting.dart';

import 'tokens.dart';

abstract final class AppRadius() {
  static const double xs = EgTokens.radiusXs;
  static const double sm = EgTokens.radiusMd;
  static const double md = EgTokens.radiusLg;
  static const double pill = EgTokens.radiusFull;

  static const BorderRadius card = BorderRadius.all(Radius.circular(md));
  static const BorderRadius field = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius badge = BorderRadius.all(Radius.circular(xs));
  static const BorderRadius sheet = BorderRadius.vertical(
    top: Radius.circular(md),
  );
}
