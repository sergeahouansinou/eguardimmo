import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/config/app_config.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/services/url_opener.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/app_user.dart';
import '../viewmodels/session_viewmodel.dart';
import '../widgets/session_gate.dart';

class const AccountScreen({super.key, required final AppConfig config})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Compte')),
      body: SafeArea(
        child: SessionGate(
          signedOutMessage: 'Connectez-vous pour accéder à votre compte.',
          builder: (context, user) => _AccountBody(user: user, config: config),
        ),
      ),
    );
  }
}

class const _AccountBody({
  required final AppUser user,
  required final AppConfig config,
}) extends StatefulWidget {
  @override
  State<_AccountBody> createState() => _AccountBodyState();
}

class _AccountBodyState() extends State<_AccountBody> {
  bool _signingOut = false;

  Future<void> _signOut() async {
    final messenger = ScaffoldMessenger.of(context);
    final session = context.read<SessionViewModel>();
    setState(() => _signingOut = true);
    final revoked = await session.signOut();
    if (!revoked) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            'Déconnecté sur cet appareil, mais la révocation de la session n’a pas pu être confirmée.',
          ),
        ),
      );
    }
    if (mounted) setState(() => _signingOut = false);
  }

  Future<void> _open(Uri uri) async {
    final messenger = ScaffoldMessenger.of(context);
    final opened = await const UrlOpener().open(uri);
    if (!opened) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Impossible d’ouvrir ce lien sur cet appareil.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = widget.user;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenGutter),
      children: [
        Text(user.name, style: theme.textTheme.titleLarge),
        const SizedBox(height: AppSpacing.xs),
        Text(
          user.email,
          style: theme.textTheme.bodyLarge?.copyWith(
            color: context.palette.textMuted,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Align(
          alignment: Alignment.centerLeft,
          child: StatusPill(
            label: user.emailVerified ? 'E-mail vérifié' : 'E-mail à vérifier',
            tone: user.emailVerified ? PillTone.success : PillTone.warning,
          ),
        ),
        if (!user.emailVerified) ...[
          const SizedBox(height: AppSpacing.lg),
          const InlineMessage(
            tone: PillTone.warning,
            message: 'Confirmez votre adresse e-mail pour utiliser les favoris, demander une visite ou réserver.',
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        AppButton(
          label: 'Conditions d’utilisation',
          style: AppButtonStyle.outline,
          expanded: true,
          onPressed: () => _open(Uri.parse(widget.config.termsUrl)),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Confidentialité',
          style: AppButtonStyle.outline,
          expanded: true,
          onPressed: () => _open(Uri.parse(widget.config.privacyUrl)),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Mes demandes d’assistance',
          style: AppButtonStyle.outline,
          expanded: true,
          onPressed: () => context.push(AppRoutes.support),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Contacter le support',
          style: AppButtonStyle.outline,
          expanded: true,
          onPressed: () =>
              _open(Uri(scheme: 'mailto', path: widget.config.supportEmail)),
        ),
        const SizedBox(height: AppSpacing.xl),
        AppButton(
          label: 'Se déconnecter',
          style: AppButtonStyle.dangerOutline,
          expanded: true,
          loading: _signingOut,
          onPressed: _signOut,
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          'Version ${widget.config.appVersion}',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}
