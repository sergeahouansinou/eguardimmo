import 'package:flutter/material.dart';

import '../../../core/state/idempotent_writes.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_sheet.dart';
import '../../../core/widgets/confirm_sheet.dart';
import '../models/intervention_commands.dart';
import '../models/intervention_detail.dart';
import '../models/intervention_parts.dart';
import '../viewmodels/agency_access_viewmodels.dart';
import '../viewmodels/agency_intervention_viewmodel.dart';
import 'intervention_forms.dart';

typedef ReportWrite = Future<bool> Function(
  Future<WriteResult> Function() action,
  String success,
);

/// Chaque écriture suit le même parcours : saisie éventuelle, fenêtre de
/// confirmation qui résume ce qui sera fait, puis envoi. Annuler la saisie ou
/// la confirmation n'envoie aucune requête.
class const InterventionFlows(
  final AgencyInterventionViewModel viewModel,
  final AgencySuppliersViewModel suppliers,
  final ReportWrite report,
) {
  Future<void> qualify(BuildContext context, InterventionDetail detail) async {
    final command = await showAppSheet<QualifyCommand>(
      context,
      builder: (_) => QualifySheet(detail: detail),
    );
    if (command == null || !context.mounted) return;
    final due = command.dueOn;
    final confirmed = await confirmAction(
      context,
      title: 'Qualifier cette intervention ?',
      message:
          'Priorité : ${command.priority.label}. Responsabilité : ${command.responsibility.label}.'
          '${due == null ? '' : ' Échéance : ${Formatters.dateLong(due)}.'}',
      confirmLabel: 'Confirmer la qualification',
      keepLabel: 'Revenir',
      destructive: false,
    );
    if (confirmed) {
      await report(() => viewModel.qualify(command), 'Intervention qualifiée.');
    }
  }

  Future<void> decline(BuildContext context) async {
    final command = await showAppSheet<DeclineCommand>(
      context,
      builder: (_) => const DeclineSheet(),
    );
    if (command == null || !context.mounted) return;
    final confirmed = await confirmAction(
      context,
      title: 'Refuser cette demande ?',
      message:
          'Motif : ${command.reason.label}. « ${command.note} » Le locataire verra cette explication.',
      confirmLabel: 'Confirmer le refus',
      keepLabel: 'Revenir',
    );
    if (confirmed) {
      await report(() => viewModel.decline(command), 'Demande refusée.');
    }
  }

  Future<void> assign(BuildContext context) async {
    await suppliers.load();
    if (!context.mounted) return;
    final supplier = await showAppSheet<Supplier>(
      context,
      builder: (_) => AssignSheet(suppliers: suppliers),
    );
    if (supplier == null || !context.mounted) return;
    final confirmed = await confirmAction(
      context,
      title: 'Assigner à ${supplier.name} ?',
      message: 'Le prestataire est désigné et un devis est attendu de sa part.',
      confirmLabel: 'Confirmer l’assignation',
      keepLabel: 'Revenir',
      destructive: false,
    );
    if (confirmed) {
      await report(
        () => viewModel.assign(supplier.partyId),
        'Prestataire assigné.',
      );
    }
  }

  Future<void> cancel(BuildContext context) async {
    final confirmed = await confirmAction(
      context,
      title: 'Annuler cette intervention ?',
      message: 'Les visites prévues et les demandes d’accord ouvertes seront annulées. Cette action est définitive.',
      confirmLabel: 'Confirmer l’annulation',
    );
    if (confirmed) {
      await report(viewModel.cancel, 'Intervention annulée.');
    }
  }

  Future<void> acceptQuote(
    BuildContext context,
    InterventionQuote quote,
  ) async {
    final confirmed = await confirmAction(
      context,
      title: 'Accepter ce devis ?',
      message:
          'Devis ${quote.reference} de ${quote.totalGross.text} TTC. Son acceptation engage la dépense ; le serveur vérifie l’accord du propriétaire si le plafond est dépassé.',
      confirmLabel: 'Confirmer l’acceptation',
      keepLabel: 'Revenir',
      destructive: false,
    );
    if (confirmed) {
      await report(() => viewModel.acceptQuote(quote.id), 'Devis accepté.');
    }
  }

  Future<void> recordDecision(
    BuildContext context,
    InterventionDetail detail,
    InterventionApproval approval,
  ) async {
    final command = await showAppSheet<DecisionCommand>(
      context,
      builder: (_) =>
          DecisionSheet(approval: approval, proofs: detail.availableProofs),
    );
    if (command == null || !context.mounted) return;
    final confirmed = await confirmAction(
      context,
      title: 'Enregistrer cette décision ?',
      message:
          '${command.decision.label} pour ${approval.amount.text}, sur la base de la pièce écrite choisie. Le propriétaire en sera informé.',
      confirmLabel: 'Confirmer la décision',
      keepLabel: 'Revenir',
      destructive: false,
    );
    if (confirmed) {
      await report(
        () => viewModel.recordDecision(command),
        'Décision enregistrée.',
      );
    }
  }

  Future<void> withdrawApproval(
    BuildContext context,
    InterventionApproval approval,
  ) async {
    final confirmed = await confirmAction(
      context,
      title: 'Retirer la demande d’accord ?',
      message:
          'La demande de ${approval.amount.text} est retirée : un nouveau devis sera nécessaire.',
      confirmLabel: 'Confirmer le retrait',
    );
    if (confirmed) {
      await report(
        () => viewModel.withdrawApproval(approval.id),
        'Demande d’accord retirée.',
      );
    }
  }

  Future<bool> comment(BuildContext context, CommentCommand command) async {
    final audience = [
      'l’équipe',
      if (command.visibleToTenant) 'le locataire',
      if (command.visibleToOwner) 'le propriétaire',
    ].join(', ');
    final confirmed = await confirmAction(
      context,
      title: 'Publier ce commentaire ?',
      message: 'Visible par : $audience.',
      confirmLabel: 'Confirmer la publication',
      keepLabel: 'Revenir',
      destructive: false,
    );
    if (!confirmed) return false;
    return report(() => viewModel.comment(command), 'Commentaire publié.');
  }
}
