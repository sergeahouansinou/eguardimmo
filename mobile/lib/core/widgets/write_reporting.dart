import 'package:flutter/material.dart';

import '../state/idempotent_writes.dart';

/// Résultat d'une écriture dans un écran : le succès n'est annoncé que pour un
/// résultat confirmé par le serveur (WriteDone) ; un refus reste affiché avec
/// le message du serveur jusqu'à la prochaine tentative.
mixin WriteReporting<T extends StatefulWidget> on State<T> {
  String? writeError;

  Future<bool> report(
    Future<WriteResult> Function() action,
    String success,
  ) async {
    setState(() => writeError = null);
    final result = await action();
    if (!mounted) return false;
    switch (result) {
      case WriteDone():
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(success)));
        return true;
      case WriteRefused(:final message):
        setState(() => writeError = message);
      case WriteIgnored():
        break;
    }
    return false;
  }
}
