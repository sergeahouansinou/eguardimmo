import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/widgets/brand_header.dart';
import '../../auth/widgets/session_gate.dart';
import '../../profiles/widgets/profile_menu_button.dart';
import '../widgets/inbox_view.dart';

class const MessagesScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            BrandHeader(
              trailing: const ProfileMenuButton(),
              child: Semantics(
                header: true,
                child: Text(
                  'Messages',
                  style: Theme.of(context).textTheme.titleMedium
                      ?.copyWith(color: p.navText, fontWeight: FontWeight.w700),
                ),
              ),
            ),
            const Expanded(
              child: SessionGate(
                signedOutMessage: 'Connectez-vous pour consulter vos messages et contacter le support.',
                builder: _inbox,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _inbox(BuildContext context, Object user) => const InboxView();
}
