import 'package:flutter/material.dart';

import 'state_message.dart';

/// État honnête d'une fonction dont l'API n'est pas encore branchée.
class const ComingSoon({super.key, required final String message})
    extends StatelessWidget {
  static const title = 'Bientôt disponible';

  @override
  Widget build(BuildContext context) => StateMessage(
    title: title,
    message: message,
    icon: Icons.hourglass_empty_rounded,
  );
}
