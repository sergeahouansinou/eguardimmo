import 'package:flutter/material.dart';

import '../../auth/widgets/session_gate.dart';

/// Les écrans d'un profil n'appellent l'API qu'une fois la session vérifiée :
/// les providers de l'écran ne sont créés qu'à l'intérieur de la garde.
class const ProfileRouteGate({super.key, required final WidgetBuilder builder})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: SessionGate(
        signedOutMessage: 'Connectez-vous pour accéder à votre espace.',
        builder: (context, _) => builder(context),
      ),
    ),
  );
}
