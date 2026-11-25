import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../viewmodels/session_viewmodel.dart';

/// Vrai quand le compte est connecté, après un passage éventuel par l'écran
/// de connexion. Faux si l'utilisateur renonce.
Future<bool> requireSignIn(BuildContext context) async {
  final session = context.read<SessionViewModel>();
  if (session.isSignedIn) return true;
  final signedIn = await context.push<bool>(AppRoutes.login);
  return signedIn ?? false;
}
