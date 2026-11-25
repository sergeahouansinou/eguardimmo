import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_icon_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/inline_message.dart';
import '../viewmodels/login_viewmodel.dart';

class const LoginScreen({super.key}) extends StatefulWidget {
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState() extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  bool _showPassword = false;
  bool _recovery = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit(LoginViewModel viewModel) async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (viewModel.stage == LoginStage.credentials) {
      await viewModel.submitCredentials(_email.text, _password.text);
    } else {
      await viewModel.submitCode(_code.text, recovery: _recovery);
    }
    if (!mounted) return;
    if (viewModel.signedIn) _leave(true);
  }

  void _leave(bool signedIn) {
    if (Navigator.canPop(context)) {
      Navigator.pop<Object?>(context, signedIn);
    } else {
      unawaited(
        Navigator.pushReplacementNamed<Object?, Object?>(
          context,
          RouteName.explore,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<LoginViewModel>();
    final twoFactor = viewModel.stage == LoginStage.twoFactor;
    return Scaffold(
      appBar: AppBar(
        title: Text(twoFactor ? 'Vérification en deux étapes' : 'Connexion'),
        leading: AppIconButton(
          icon: Icons.arrow_back_rounded,
          tooltip: 'Fermer',
          onPressed: () => _leave(false),
        ),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.screenGutter),
            children: [
              if (twoFactor)
                ..._twoFactorFields(viewModel)
              else
                ..._credentialFields(),
              if (viewModel.error != null) ...[
                const SizedBox(height: AppSpacing.lg),
                InlineMessage(message: viewModel.error!),
              ],
              const SizedBox(height: AppSpacing.xl),
              AppButton(
                label: twoFactor ? 'Valider' : 'Se connecter',
                expanded: true,
                loading: viewModel.busy,
                onPressed: () => _submit(viewModel),
              ),
              if (twoFactor) ...[
                const SizedBox(height: AppSpacing.sm),
                AppButton(
                  label: 'Recommencer',
                  expanded: true,
                  style: AppButtonStyle.ghost,
                  onPressed: viewModel.busy
                      ? null
                      : () {
                          _code.clear();
                          viewModel.restart();
                        },
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _credentialFields() => [
    AppTextField(
      label: 'Adresse e-mail',
      placeholder: 'prenom.nom@exemple.fr',
      controller: _email,
      keyboardType: TextInputType.emailAddress,
      autofillHints: const [AutofillHints.username, AutofillHints.email],
      textInputAction: TextInputAction.next,
      validator: Validators.email,
    ),
    const SizedBox(height: AppSpacing.lg),
    AppTextField(
      label: 'Mot de passe',
      placeholder: 'Votre mot de passe',
      controller: _password,
      obscureText: !_showPassword,
      autofillHints: const [AutofillHints.password],
      textInputAction: TextInputAction.done,
      validator: Validators.password,
      suffix: AppIconButton(
        icon: _showPassword
            ? Icons.visibility_off_outlined
            : Icons.visibility_outlined,
        tooltip: _showPassword
            ? 'Masquer le mot de passe'
            : 'Afficher le mot de passe',
        onPressed: () => setState(() => _showPassword = !_showPassword),
      ),
    ),
  ];

  List<Widget> _twoFactorFields(LoginViewModel viewModel) => [
    Text(
      _recovery ? 'Saisissez l’un de vos codes de secours.' : 'Saisissez le code à 6 chiffres de votre application d’authentification.',
      style: Theme.of(context).textTheme.bodyLarge,
    ),
    const SizedBox(height: AppSpacing.lg),
    AppTextField(
      label: _recovery ? 'Code de secours' : 'Code de vérification',
      placeholder: _recovery ? 'xxxxx-xxxxx' : '123456',
      controller: _code,
      keyboardType: _recovery ? TextInputType.text : TextInputType.number,
      autofillHints: const [AutofillHints.oneTimeCode],
      textInputAction: TextInputAction.done,
      validator: (value) =>
          Validators.required(value, message: 'Code obligatoire'),
    ),
    const SizedBox(height: AppSpacing.sm),
    Align(
      alignment: Alignment.centerLeft,
      child: AppButton(
        label: _recovery
            ? 'Utiliser le code de l’application'
            : 'Utiliser un code de secours',
        style: AppButtonStyle.ghost,
        onPressed: () => setState(() {
          _recovery = !_recovery;
          _code.clear();
        }),
      ),
    ),
  ];
}
