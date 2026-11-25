<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Gabarits en français, rendus une fois à la création : modifier un gabarit ne réécrit pas l'historique (ADR 0027).
 */
final class Templates
{
    /**
     * @return array{title: string, body: string}
     */
    public function render(NotificationInput $entree): array
    {
        [$titre, $corps] = $this->template($entree->type);
        $valeurs = [];

        foreach ($entree->params as $cle => $valeur) {
            $valeurs['{'.$cle.'}'] = $cle === 'date' ? CarbonImmutable::parse($valeur)->format('d/m/Y') : $valeur;
        }

        return [
            'title' => Str::limit(strtr($titre, $valeurs), 160, ''),
            'body' => Str::limit(strtr($corps, $valeurs), 500, ''),
        ];
    }

    public function link(NotificationInput $entree): string
    {
        return match ($entree->type) {
            NotificationType::RentOverdue => '/finances/impayes',
            NotificationType::RentPaymentRecorded, NotificationType::RentPaymentCancelled => '/finances/encaissements',
            NotificationType::RecoveryBundleSent => '/finances/recouvrement',
            NotificationType::CertificateToRenew, NotificationType::CertificateExpired => $entree->subjectId === null ? '/conformite' : "/conformite/{$entree->subjectId}",
            NotificationType::LeaseSigned => $entree->leaseId === null ? '/baux' : "/baux/{$entree->leaseId}",
            NotificationType::TenantLeaseSigned => '/bail',
            NotificationType::TenantNoticeIssued, NotificationType::TenantReceiptIssued, NotificationType::TenantPaymentRecorded, NotificationType::TenantPaymentCancelled => '/loyers',
            NotificationType::TenantChargeStatementIssued => $entree->subjectId === null ? '/regularisation-charges' : "/regularisation-charges/{$entree->subjectId}",
            NotificationType::ChargesRegularizationDue => $entree->leaseId === null ? '/baux' : "/baux/{$entree->leaseId}",
            NotificationType::MaintenanceRequestReceived, NotificationType::MaintenanceApprovalDecided, NotificationType::MaintenanceApprovalExpired,
            NotificationType::MaintenanceRescheduleRequested => $entree->subjectId === null ? '/interventions' : "/interventions/{$entree->subjectId}",
            NotificationType::TenantRequestQualified, NotificationType::TenantVisitScheduled, NotificationType::TenantRequestDeclined,
            NotificationType::TenantWorkCompleted => $entree->subjectId === null ? '/interventions' : "/interventions/{$entree->subjectId}",
            NotificationType::OwnerFundsPayoutExecuted, NotificationType::OwnerFundsPayoutReturned, NotificationType::OwnerFundsPayoutFailed => '/finances/reversements',
            NotificationType::OwnerFundsTrustGap => '/finances/fonds-des-mandants',
            NotificationType::ReportingReportsDue => '/comptes-rendus',
            NotificationType::OwnerFundsAccountChangeRequested, NotificationType::OwnerFundsAccountChangeContested => '/finances/reversements',
            NotificationType::OwnerMandateEndDismissed, NotificationType::OwnerMandateEndFulfilled => $entree->subjectId === null ? '/mandats' : "/mandats/{$entree->subjectId}",
            NotificationType::MandatesEndRequested => $entree->subjectId === null ? '/mandats' : "/mandats/{$entree->subjectId}",
            NotificationType::OwnerApprovalRequested, NotificationType::OwnerApprovalExpired, NotificationType::OwnerApprovalRecorded => $entree->subjectId === null ? '/interventions' : "/interventions/{$entree->subjectId}",
            NotificationType::OwnerReportPublished => $entree->subjectId === null ? '/comptes-rendus' : "/comptes-rendus/{$entree->subjectId}",
            NotificationType::OwnerTaxStatementPublished => $entree->subjectId === null ? '/fiscalite' : "/fiscalite/{$entree->subjectId}",
            NotificationType::OwnerPayoutExecuted, NotificationType::OwnerPayoutReturned => '/reversements',
            NotificationType::OwnerAccountChangeRequested, NotificationType::OwnerAccountChangeApproved, NotificationType::OwnerAccountChangeContested => '/compte-de-paiement',
            NotificationType::MessagingMessageReceived, NotificationType::TenantMessageReceived, NotificationType::OwnerMessageReceived,
            NotificationType::MessagingMessageRedacted, NotificationType::TenantMessageRedacted, NotificationType::OwnerMessageRedacted => $entree->subjectId === null ? '/messages' : "/messages/{$entree->subjectId}",
            NotificationType::AccountSupportReplied => $entree->subjectId === null ? '/support' : "/support/{$entree->subjectId}",
            NotificationType::SupportAccessRequested, NotificationType::SupportAccessUsed, NotificationType::SupportAccessEmergency => '/reglages/acces-support',
            NotificationType::OrganizationSuspended, NotificationType::OrganizationReactivated => '/reglages',
            NotificationType::PrivacyRequestForwarded => '/reglages/donnees-personnelles',
            NotificationType::AccountPrivacyCompleted, NotificationType::AccountExportReady, NotificationType::AccountPrivacyReceived => $entree->subjectId === null ? '/compte/donnees-personnelles' : "/compte/donnees-personnelles/{$entree->subjectId}",
            NotificationType::TenantAnnouncement, NotificationType::OwnerAnnouncement => $entree->subjectId === null ? '/annonces' : "/annonces/{$entree->subjectId}",
            NotificationType::LeasesNoticeRequested, NotificationType::LeasesNoticeUnacknowledged => $entree->leaseId === null ? '/baux' : "/baux/{$entree->leaseId}",
            NotificationType::TenantNoticeAcknowledged, NotificationType::TenantNoticeClosed => '/bail/conge',
            NotificationType::LeasesInsuranceSubmitted => $entree->leaseId === null ? '/baux' : "/baux/{$entree->leaseId}",
            NotificationType::TenantInsuranceAccepted, NotificationType::TenantInsuranceRejected, NotificationType::TenantInsuranceExpiring,
            NotificationType::TenantInsuranceExpired, NotificationType::TenantInsuranceReminder => '/assurance',
            NotificationType::TenantDocumentShared, NotificationType::OwnerDocumentShared => '/documents',
            NotificationType::TenantInspectionPublished, NotificationType::TenantInspectionRemarkAnswered => $entree->subjectId === null ? '/etats-des-lieux' : "/etats-des-lieux/{$entree->subjectId}",
            NotificationType::InspectionsRemarkReceived => $entree->leaseId === null ? '/baux' : "/baux/{$entree->leaseId}",
            NotificationType::TenantOnlinePaymentFailed => '/loyers/payer',
            NotificationType::PartiesContactUpdateRequested => '/locataires',
            NotificationType::PlanningTaskAssigned, NotificationType::PlanningTaskDue => $entree->subjectId === null ? '/taches' : "/taches/{$entree->subjectId}",
            NotificationType::PlanningEventReminder => '/agenda',
            NotificationType::AccountMarketing, NotificationType::AccountServiceMessage => '/notifications',
            NotificationType::AccountReminderInactive, NotificationType::AccountReminderEmailUnverified, NotificationType::AccountReminderSpace,
            NotificationType::AccountReminderAgency, NotificationType::AccountReminderLandlord => '/',
            NotificationType::RemindersPropertyMissing => '/biens',
            NotificationType::RemindersListingMissing, NotificationType::RemindersListingDraft, NotificationType::RemindersLeadUnanswered => '/annonces',
            NotificationType::RemindersInvitationPending => '/locataires',
            NotificationType::RemindersRecoveryStalled => '/finances/recouvrement',
            NotificationType::RemindersTrialEnding => '/reglages',
            NotificationType::TenantReminderRentDue, NotificationType::TenantReminderRentUnpaid => '/loyers',
        };
    }

    /**
     * @return array{string, string}
     */
    private function template(NotificationType $type): array
    {
        return match ($type) {
            NotificationType::RentOverdue => ['Loyer en retard', 'L\'échéance du {date} du bail {reference} n\'est pas soldée.'],
            NotificationType::RentPaymentRecorded => ['Paiement enregistré', 'Un paiement a été enregistré sur le bail {reference}.'],
            NotificationType::RentPaymentCancelled => ['Paiement annulé', 'Un paiement du bail {reference} a été annulé : les échéances concernées sont recalculées.'],
            NotificationType::RecoveryBundleSent => ['Dossier de recouvrement transmis', 'Un dossier de recouvrement a été transmis au commissaire de justice par lien sécurisé.'],
            NotificationType::CertificateToRenew => ['Pièce à renouveler', '{label} arrive à échéance le {date}.'],
            NotificationType::CertificateExpired => ['Pièce expirée', '{label} a expiré le {date}.'],
            NotificationType::LeaseSigned => ['Bail signé', 'Le bail {reference} est signé.'],
            NotificationType::TenantNoticeIssued => ['Avis d\'échéance disponible', 'L\'avis d\'échéance du {date} de votre bail {reference} est disponible.'],
            NotificationType::TenantChargeStatementIssued => ['Décompte de charges disponible', 'Le décompte de régularisation des charges de votre bail {reference} est disponible.'],
            NotificationType::ChargesRegularizationDue => ['Régularisation des charges à effectuer', 'Le bail {reference} n\'a pas de décompte de charges émis pour l\'exercice {year} : préparez la régularisation.'],
            NotificationType::TenantReceiptIssued => ['Quittance disponible', 'La quittance de loyer de votre bail {reference} est disponible.'],
            NotificationType::TenantPaymentRecorded => ['Paiement enregistré', 'Votre paiement sur le bail {reference} a été enregistré.'],
            NotificationType::TenantPaymentCancelled => ['Paiement annulé', 'Un paiement enregistré sur votre bail {reference} a été annulé.'],
            NotificationType::TenantLeaseSigned => ['Bail signé', 'Votre bail {reference} est signé.'],
            NotificationType::MaintenanceRequestReceived => ['Demande d\'intervention reçue', 'Une demande {label} a été signalée par un locataire.'],
            NotificationType::MaintenanceApprovalDecided => ['Accord du mandant', 'Le mandant a répondu à la demande d\'accord de l\'intervention {label}.'],
            NotificationType::MaintenanceApprovalExpired => ['Accord du mandant expiré', 'La demande d\'accord de l\'intervention {label} a expiré sans réponse : elle ne vaut pas accord.'],
            NotificationType::MaintenanceRescheduleRequested => ['Report de rendez-vous demandé', 'Le locataire demande un autre créneau pour l\'intervention {label}.'],
            NotificationType::TenantRequestQualified => ['Demande prise en charge', 'Votre demande {label} est prise en charge.'],
            NotificationType::TenantVisitScheduled => ['Rendez-vous d\'intervention', 'Un rendez-vous est fixé le {date} pour votre demande {label}.'],
            NotificationType::TenantRequestDeclined => ['Demande classée sans suite', 'Votre demande {label} est classée sans suite : consultez le motif.'],
            NotificationType::TenantWorkCompleted => ['Intervention terminée', 'L\'intervention de votre demande {label} est terminée.'],
            NotificationType::OwnerFundsPayoutExecuted => ['Reversement exécuté', 'Un reversement du lot {label} a été exécuté à la banque.'],
            NotificationType::OwnerFundsPayoutReturned => ['Reversement retourné', 'Un virement du lot {label} a été retourné par la banque : la dette envers le mandant est reconstituée.'],
            NotificationType::OwnerFundsPayoutFailed => ['Reversement échoué', 'Un virement du lot {label} a échoué : le montant est restitué au compte du mandant.'],
            NotificationType::OwnerFundsTrustGap => ['Écart de cantonnement', 'Le compte de tiers ne couvre plus les fonds des mandants : reversements, prélèvements et clôtures sont bloqués.'],
            NotificationType::ReportingReportsDue => ['Comptes rendus de gestion à produire', 'Le compte rendu de gestion d\'un mandant est à produire pour la période du {date}.'],
            NotificationType::OwnerFundsAccountChangeRequested => ['Changement de compte de paiement à valider', 'Un mandant demande à changer de compte de paiement : vérifiez la pièce justificative avant de valider.'],
            NotificationType::OwnerFundsAccountChangeContested => ['Changement de compte de paiement contesté', 'Un mandant conteste un changement de compte de paiement : ses reversements sont bloqués, contactez-le.'],
            NotificationType::MandatesEndRequested => ['Fin de mandat demandée', 'Un mandant demande la fin de son mandat {label} : la résiliation relève de l\'agence.'],
            NotificationType::OwnerMandateEndDismissed => ['Demande de fin de mandat rejetée', 'Votre agence n\'a pas donné suite à votre demande de fin du mandat {label} : le mandat reste en vigueur. Contactez-la pour en savoir plus.'],
            NotificationType::OwnerMandateEndFulfilled => ['Fin de mandat acceptée', 'Votre agence a résilié le mandat {label} suite à votre demande : consultez le mandat dans votre espace.'],
            NotificationType::OwnerApprovalRequested => ['Accord demandé', 'Votre agence demande votre accord pour l\'intervention {label}.'],
            NotificationType::OwnerApprovalExpired => ['Demande d\'accord expirée', 'La demande d\'accord de l\'intervention {label} a expiré sans réponse : elle ne vaut pas accord.'],
            NotificationType::OwnerApprovalRecorded => ['Accord enregistré par l\'agence', 'Votre agence a enregistré votre décision sur l\'intervention {label}.'],
            NotificationType::OwnerReportPublished => ['Compte rendu de gestion disponible', 'Un nouveau compte rendu de gestion est disponible dans votre espace.'],
            NotificationType::OwnerTaxStatementPublished => ['Relevé fiscal disponible', 'Un relevé fiscal est disponible dans votre espace.'],
            NotificationType::OwnerPayoutExecuted => ['Reversement exécuté', 'Un reversement a été exécuté à la banque : retrouvez-le dans vos reversements.'],
            NotificationType::OwnerPayoutReturned => ['Reversement retourné', 'Un virement vous concernant a été retourné par la banque : contactez votre agence.'],
            NotificationType::OwnerAccountChangeRequested => ['Changement de compte de paiement demandé', 'Une demande de changement de votre compte de paiement a été faite. Si ce n\'est pas vous, contestez-la immédiatement dans votre espace.'],
            NotificationType::OwnerAccountChangeApproved => ['Compte de paiement modifié', 'Votre compte de paiement a été modifié. Si ce n\'est pas vous, contestez-le immédiatement dans votre espace.'],
            NotificationType::OwnerAccountChangeContested => ['Contestation enregistrée', 'Votre contestation est enregistrée : vos reversements sont suspendus, votre agence vous contactera.'],
            NotificationType::MessagingMessageReceived => ['Nouveau message', 'Un locataire ou un mandant vous a écrit : ouvrez la conversation.'],
            NotificationType::TenantMessageReceived => ['Nouveau message de votre agence', 'Votre agence vous a écrit : ouvrez la conversation.'],
            NotificationType::OwnerMessageReceived => ['Nouveau message de votre agence', 'Votre agence vous a écrit : ouvrez la conversation.'],
            NotificationType::MessagingMessageRedacted, NotificationType::TenantMessageRedacted, NotificationType::OwnerMessageRedacted => ['Message retiré', 'Un administrateur de l\'organisation a retiré l\'un de vos messages : ouvrez la conversation.'],
            NotificationType::AccountSupportReplied => ['Réponse du support', 'Le support a répondu à votre demande : ouvrez-la pour la lire.'],
            NotificationType::SupportAccessRequested => ['Accès du support demandé', 'Le support demande l\'accès à certaines données de votre organisation pour traiter une demande : acceptez ou refusez dans les réglages.'],
            NotificationType::SupportAccessUsed => ['Accès du support utilisé', 'Le support a consulté, avec votre accord, des données de votre organisation : le détail figure dans les accès du support.'],
            NotificationType::TenantAnnouncement, NotificationType::OwnerAnnouncement => ['Annonce de votre agence', 'Votre agence a publié une annonce : ouvrez-la pour la lire.'],
            NotificationType::OrganizationSuspended => ['Organisation suspendue', 'Votre organisation a été suspendue par eGuardImmo : vous pouvez la consulter et exporter vos données, mais plus la modifier. Contactez le support pour en connaître la raison.'],
            NotificationType::PrivacyRequestForwarded => ['Demande de données personnelles à traiter', 'Une personne liée à votre organisation exerce ses droits sur ses données personnelles : consultez la demande et traitez-la avec vos outils avant l\'échéance.'],
            NotificationType::AccountPrivacyCompleted => ['Demande de données personnelles traitée', 'Votre demande concernant vos données personnelles est traitée : ouvrez-la pour lire la réponse.'],
            NotificationType::AccountPrivacyReceived => ['Demande de données personnelles enregistrée', 'Une demande d\'exercice de vos droits sur vos données personnelles (accès, export, effacement ou autre) a été enregistrée sur votre compte. Si ce n\'est pas vous, changez votre mot de passe et contactez le support sans attendre.'],
            NotificationType::AccountExportReady => ['Export de vos données disponible', 'L\'export de vos données est prêt : téléchargez-le depuis votre espace avant son expiration.'],
            NotificationType::OrganizationReactivated => ['Organisation réactivée', 'La suspension de votre organisation est levée : vous pouvez de nouveau la modifier.'],
            NotificationType::SupportAccessEmergency => ['Accès d\'urgence du support', 'Le support a ouvert, sans votre accord préalable, un accès d\'une heure aux réglages et à l\'équipe de votre organisation : le motif figure dans les accès du support.'],
            NotificationType::LeasesNoticeRequested => ['Demande de congé reçue', 'Un locataire du bail {reference} a déposé une demande de congé : accusez-en réception.'],
            NotificationType::LeasesNoticeUnacknowledged => ['Demande de congé sans accusé', 'Une demande de congé du bail {reference} attend toujours un accusé de réception.'],
            NotificationType::TenantNoticeAcknowledged => ['Demande de congé reçue', 'Votre agence a accusé réception de votre demande de congé du bail {reference}.'],
            NotificationType::TenantNoticeClosed => ['Demande de congé traitée', 'Votre demande de congé du bail {reference} a été traitée : consultez votre bail.'],
            NotificationType::LeasesInsuranceSubmitted => ['Attestation d\'assurance déposée', 'Une attestation d\'assurance a été déposée pour le bail {reference} : acceptez-la ou refusez-la.'],
            NotificationType::TenantInsuranceAccepted => ['Attestation acceptée', 'Votre attestation d\'assurance du bail {reference} a été acceptée.'],
            NotificationType::TenantInsuranceRejected => ['Attestation refusée', 'Votre attestation d\'assurance du bail {reference} a été refusée : consultez le motif et déposez-en une nouvelle.'],
            NotificationType::TenantInsuranceExpiring => ['Assurance bientôt échue', 'Votre assurance du bail {reference} arrive à échéance le {date} : déposez la nouvelle attestation.'],
            NotificationType::TenantInsuranceExpired => ['Assurance échue', 'Votre assurance du bail {reference} est échue depuis le {date} : déposez une attestation à jour.'],
            NotificationType::TenantInsuranceReminder => ['Attestation d\'assurance demandée', 'Votre agence vous demande l\'attestation d\'assurance du bail {reference}. Ce message n\'est pas une mise en demeure.'],
            NotificationType::OwnerDocumentShared => ['Document partagé', 'Votre agence a partagé un document avec vous : retrouvez-le dans vos documents.'],
            NotificationType::TenantDocumentShared => ['Document partagé', 'Votre agence a partagé un document sur votre bail {reference}.'],
            NotificationType::TenantInspectionPublished => ['État des lieux disponible', 'Un état des lieux de votre bail {reference} est disponible : vous pouvez le consulter et déposer une remarque.'],
            NotificationType::InspectionsRemarkReceived => ['Remarque sur un état des lieux', 'Un locataire du bail {reference} a déposé une remarque sur un état des lieux.'],
            NotificationType::TenantInspectionRemarkAnswered => ['Réponse à votre remarque', 'Votre agence a répondu à votre remarque sur l\'état des lieux du bail {reference}.'],
            NotificationType::TenantOnlinePaymentFailed => ['Paiement en ligne non abouti', 'Votre paiement en ligne sur le bail {reference} n\'a pas abouti : aucune somme n\'a été encaissée.'],
            NotificationType::PartiesContactUpdateRequested => ['Modification de coordonnées à traiter', 'Une personne demande à modifier ses coordonnées : vérifiez et traitez la demande.'],
            NotificationType::PlanningTaskAssigned => ['Tâche confiée', 'Une tâche vous a été confiée : retrouvez-la dans vos tâches.'],
            NotificationType::PlanningTaskDue => ['Tâche à échéance', 'Une de vos tâches arrive à échéance le {date}.'],
            NotificationType::PlanningEventReminder => ['Rappel d\'agenda', 'Un événement de votre agenda a lieu le {date}.'],
            NotificationType::AccountMarketing, NotificationType::AccountServiceMessage => ['Information eGuardImmo', 'Vous avez une information d\'eGuardImmo.'],
            NotificationType::AccountReminderInactive => ['Votre compte eGuardImmo vous attend', 'Vous ne vous êtes pas connecté depuis un moment : reconnectez-vous pour reprendre où vous en étiez.'],
            NotificationType::AccountReminderEmailUnverified => ['Confirmez votre adresse e-mail', 'Votre inscription n\'est pas terminée : connectez-vous pour demander un nouveau message de confirmation.'],
            NotificationType::AccountReminderSpace => ['Créez votre espace', 'Votre compte est prêt : choisissez votre profil et créez votre espace.'],
            NotificationType::AccountReminderAgency => ['Créez votre agence', 'Vous vous êtes inscrit comme agence : créez votre agence pour commencer.'],
            NotificationType::AccountReminderLandlord => ['Créez votre espace bailleur', 'Vous vous êtes inscrit comme bailleur : créez votre espace pour commencer.'],
            NotificationType::RemindersPropertyMissing => ['Ajoutez votre premier bien', 'Aucun bien n\'est encore enregistré dans votre organisation.'],
            NotificationType::RemindersListingMissing => ['Créez votre première annonce', 'Aucune annonce n\'est encore créée dans votre organisation.'],
            NotificationType::RemindersListingDraft => ['Annonce en brouillon', 'Une annonce est enregistrée mais pas encore publiée : terminez-la.'],
            NotificationType::RemindersLeadUnanswered => ['Demande sans réponse', 'Une demande reçue sur une annonce attend toujours votre réponse.'],
            NotificationType::RemindersInvitationPending => ['Invitation en attente', 'Une invitation de locataire n\'a pas encore été acceptée.'],
            NotificationType::RemindersRecoveryStalled => ['Dossier de recouvrement sans suite', 'Un dossier de recouvrement ouvert n\'a pas d\'acte récent.'],
            NotificationType::TenantReminderRentDue => ['Échéance à venir', 'Une échéance de votre bail {reference} arrive le {date}.'],
            NotificationType::TenantReminderRentUnpaid => ['Rappel de loyer', 'Sauf erreur de notre part, l\'échéance du {date} de votre bail {reference} n\'est pas soldée. Ce message n\'est pas une mise en demeure.'],
            NotificationType::RemindersTrialEnding => ['Votre essai se termine bientôt', 'La période d\'essai de votre organisation se termine le {date}.'],
        };
    }
}
