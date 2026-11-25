<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

use App\Modules\Organizations\Enums\MemberRole;

enum NotificationType: string
{
    case RentOverdue = 'rent.overdue';
    case RentPaymentRecorded = 'rent.payment_recorded';
    case RentPaymentCancelled = 'rent.payment_cancelled';
    case RecoveryBundleSent = 'recovery.bundle_sent';
    case CertificateToRenew = 'compliance.certificate_to_renew';
    case CertificateExpired = 'compliance.certificate_expired';
    case LeaseSigned = 'lease.signed';
    case TenantNoticeIssued = 'tenant.notice_issued';
    case TenantReceiptIssued = 'tenant.receipt_issued';
    case TenantPaymentRecorded = 'tenant.payment_recorded';
    case TenantPaymentCancelled = 'tenant.payment_cancelled';
    case TenantLeaseSigned = 'tenant.lease_signed';
    case MaintenanceRequestReceived = 'maintenance.request_received';
    case MaintenanceApprovalDecided = 'maintenance.approval_decided';
    case MaintenanceApprovalExpired = 'maintenance.approval_expired';
    case MaintenanceRescheduleRequested = 'maintenance.reschedule_requested';
    case TenantRequestQualified = 'tenant.request_qualified';
    case TenantVisitScheduled = 'tenant.visit_scheduled';
    case TenantRequestDeclined = 'tenant.request_declined';
    case TenantWorkCompleted = 'tenant.work_completed';
    case OwnerFundsPayoutExecuted = 'ownerfunds.payout_executed';
    case OwnerFundsPayoutReturned = 'ownerfunds.payout_returned';
    case OwnerFundsPayoutFailed = 'ownerfunds.payout_failed';
    case OwnerFundsTrustGap = 'ownerfunds.trust_gap';
    case ReportingReportsDue = 'reporting.reports_due';
    case OwnerFundsAccountChangeRequested = 'ownerfunds.account_change_requested';
    case OwnerFundsAccountChangeContested = 'ownerfunds.account_change_contested';
    case MandatesEndRequested = 'mandates.end_requested';
    case OwnerApprovalRequested = 'owner.approval_requested';
    case OwnerApprovalExpired = 'owner.approval_expired';
    case OwnerApprovalRecorded = 'owner.approval_recorded';
    case OwnerReportPublished = 'owner.report_published';
    case OwnerTaxStatementPublished = 'owner.tax_statement_published';
    case OwnerPayoutExecuted = 'owner.payout_executed';
    case OwnerPayoutReturned = 'owner.payout_returned';
    case OwnerAccountChangeRequested = 'owner.account_change_requested';
    case OwnerAccountChangeApproved = 'owner.account_change_approved';
    case OwnerAccountChangeContested = 'owner.account_change_contested';
    case OwnerDocumentShared = 'owner.document_shared';
    case OwnerMandateEndDismissed = 'owner.mandate_end_dismissed';
    case OwnerMandateEndFulfilled = 'owner.mandate_end_fulfilled';
    case MessagingMessageReceived = 'messaging.message_received';
    case TenantMessageReceived = 'tenant.message_received';
    case OwnerMessageReceived = 'owner.message_received';
    case MessagingMessageRedacted = 'messaging.message_redacted';
    case TenantMessageRedacted = 'tenant.message_redacted';
    case OwnerMessageRedacted = 'owner.message_redacted';
    case AccountSupportReplied = 'account.support_replied';
    case SupportAccessRequested = 'support.access_requested';
    case SupportAccessUsed = 'support.access_used';
    case SupportAccessEmergency = 'support.access_emergency';
    case TenantAnnouncement = 'tenant.announcement';
    case OwnerAnnouncement = 'owner.announcement';
    case TenantChargeStatementIssued = 'tenant.charge_statement_issued';
    case ChargesRegularizationDue = 'charges.regularization_due';
    case LeasesNoticeRequested = 'leases.notice_requested';
    case LeasesNoticeUnacknowledged = 'leases.notice_unacknowledged';
    case TenantNoticeAcknowledged = 'tenant.notice_acknowledged';
    case TenantNoticeClosed = 'tenant.notice_closed';
    case LeasesInsuranceSubmitted = 'leases.insurance_submitted';
    case TenantInsuranceAccepted = 'tenant.insurance_accepted';
    case TenantInsuranceRejected = 'tenant.insurance_rejected';
    case TenantInsuranceExpiring = 'tenant.insurance_expiring';
    case TenantInsuranceExpired = 'tenant.insurance_expired';
    case TenantInsuranceReminder = 'tenant.insurance_reminder';
    case TenantDocumentShared = 'tenant.document_shared';
    case TenantInspectionPublished = 'tenant.inspection_published';
    case InspectionsRemarkReceived = 'inspections.remark_received';
    case TenantInspectionRemarkAnswered = 'tenant.inspection_remark_answered';
    case TenantOnlinePaymentFailed = 'tenant.online_payment_failed';
    case PartiesContactUpdateRequested = 'parties.contact_update_requested';
    case PlanningTaskAssigned = 'planning.task_assigned';
    case PlanningTaskDue = 'planning.task_due';
    case PlanningEventReminder = 'planning.event_reminder';
    case OrganizationSuspended = 'organizations.suspended';
    case OrganizationReactivated = 'organizations.reactivated';
    case PrivacyRequestForwarded = 'privacy.request_forwarded';
    case AccountPrivacyCompleted = 'account.privacy_completed';
    case AccountExportReady = 'account.export_ready';
    case AccountPrivacyReceived = 'account.privacy_received';
    case AccountMarketing = 'account.marketing';
    case AccountServiceMessage = 'account.service_message';
    case AccountReminderInactive = 'account.reminder_inactive';
    case AccountReminderEmailUnverified = 'account.reminder_email_unverified';
    case AccountReminderSpace = 'account.reminder_space';
    case AccountReminderAgency = 'account.reminder_agency';
    case AccountReminderLandlord = 'account.reminder_landlord';
    case RemindersPropertyMissing = 'reminders.property_missing';
    case RemindersListingMissing = 'reminders.listing_missing';
    case RemindersListingDraft = 'reminders.listing_draft';
    case RemindersLeadUnanswered = 'reminders.lead_unanswered';
    case RemindersInvitationPending = 'reminders.invitation_pending';
    case RemindersRecoveryStalled = 'reminders.recovery_stalled';
    case TenantReminderRentDue = 'tenant.reminder_rent_due';
    case TenantReminderRentUnpaid = 'tenant.reminder_rent_unpaid';
    case RemindersTrialEnding = 'reminders.trial_ending';

    /**
     * Alerte de sécurité qui part aussi vers l'adresse principale de la fiche du mandant, au cas où le compte serait détourné.
     */
    public function alertsPrimaryAddress(): bool
    {
        return in_array($this, [self::OwnerAccountChangeRequested, self::OwnerAccountChangeApproved, self::OwnerAccountChangeContested], true);
    }

    public function audience(): NotificationAudience
    {
        return match (true) {
            str_starts_with($this->value, 'tenant.') => NotificationAudience::Tenant,
            str_starts_with($this->value, 'owner.') => NotificationAudience::Owner,
            str_starts_with($this->value, 'account.') => NotificationAudience::Account,
            default => NotificationAudience::Staff,
        };
    }

    /**
     * Rôles de l'organisation qui lisent ce type ; vide pour un type destiné au locataire.
     *
     * @return list<MemberRole>
     */
    public function roles(): array
    {
        return match ($this) {
            self::RentOverdue, self::RentPaymentRecorded, self::RentPaymentCancelled, self::RecoveryBundleSent => [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager, MemberRole::Accountant],
            self::CertificateToRenew, self::CertificateExpired, self::LeaseSigned, self::MaintenanceRequestReceived, self::MaintenanceApprovalDecided,
            self::MaintenanceApprovalExpired, self::MaintenanceRescheduleRequested => [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager],
            self::OwnerFundsPayoutExecuted, self::OwnerFundsPayoutReturned, self::OwnerFundsPayoutFailed, self::OwnerFundsTrustGap => [MemberRole::Owner, MemberRole::Admin, MemberRole::Accountant],
            self::ReportingReportsDue, self::MandatesEndRequested, self::MessagingMessageReceived, self::MessagingMessageRedacted => [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager],
            self::SupportAccessRequested, self::SupportAccessUsed, self::SupportAccessEmergency, self::OrganizationSuspended, self::OrganizationReactivated, self::PrivacyRequestForwarded => [MemberRole::Owner, MemberRole::Admin],
            self::ChargesRegularizationDue => [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager],
            self::OwnerFundsAccountChangeRequested, self::OwnerFundsAccountChangeContested => [MemberRole::Owner, MemberRole::Admin, MemberRole::Accountant],
            self::LeasesNoticeRequested, self::LeasesNoticeUnacknowledged, self::LeasesInsuranceSubmitted, self::InspectionsRemarkReceived,
            self::PartiesContactUpdateRequested => [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager],
            self::PlanningTaskAssigned, self::PlanningTaskDue, self::PlanningEventReminder => [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager, MemberRole::Accountant],
            self::RemindersPropertyMissing, self::RemindersListingMissing, self::RemindersListingDraft, self::RemindersLeadUnanswered,
            self::RemindersInvitationPending => [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager],
            self::RemindersRecoveryStalled => [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager, MemberRole::Accountant],
            self::RemindersTrialEnding => [MemberRole::Owner, MemberRole::Admin],
            default => [],
        };
    }

    /**
     * Types que la console peut couper pour tous les comptes : un rappel se règle par sa règle, une campagne par son envoi.
     *
     * @return list<NotificationType>
     */
    public static function configurable(): array
    {
        $exclus = [self::AccountMarketing, self::AccountServiceMessage, ...array_map(fn (ReminderCode $code): self => $code->type(), ReminderCode::cases())];

        return array_values(array_filter(self::cases(), fn (self $type): bool => ! in_array($type, $exclus, true)));
    }

    /**
     * @return list<NotificationType>
     */
    public static function forRole(MemberRole $role): array
    {
        return array_values(array_filter(self::cases(), fn (self $type): bool => in_array($role, $type->roles(), true)));
    }

    /**
     * @return list<NotificationType>
     */
    public static function forAudience(NotificationAudience $audience): array
    {
        return array_values(array_filter(self::cases(), fn (self $type): bool => $type->audience() === $audience));
    }

    /**
     * Canaux actifs tant que le compte n'a rien choisi.
     *
     * @return list<NotificationChannel>
     */
    public function defaults(): array
    {
        $tous = [NotificationChannel::InApp, NotificationChannel::Email, NotificationChannel::Push];

        return match ($this) {
            self::RentOverdue, self::CertificateExpired, self::TenantNoticeIssued, self::TenantReceiptIssued => $tous,
            self::TenantVisitScheduled => $tous,
            self::RentPaymentCancelled, self::CertificateToRenew, self::TenantPaymentRecorded, self::TenantPaymentCancelled, self::TenantLeaseSigned,
            self::MaintenanceRequestReceived, self::MaintenanceApprovalDecided, self::MaintenanceApprovalExpired, self::TenantRequestQualified,
            self::TenantRequestDeclined, self::TenantWorkCompleted => [NotificationChannel::InApp, NotificationChannel::Email],
            self::RentPaymentRecorded, self::RecoveryBundleSent, self::LeaseSigned, self::MaintenanceRescheduleRequested, self::OwnerFundsPayoutExecuted, self::ReportingReportsDue => [NotificationChannel::InApp],
            self::OwnerFundsPayoutReturned, self::OwnerFundsPayoutFailed => [NotificationChannel::InApp, NotificationChannel::Email],
            self::OwnerFundsTrustGap => $tous,
            self::TenantAnnouncement, self::OwnerAnnouncement, self::ChargesRegularizationDue => [NotificationChannel::InApp],
            self::TenantChargeStatementIssued => [NotificationChannel::InApp, NotificationChannel::Email],
            self::MessagingMessageReceived => [NotificationChannel::InApp, NotificationChannel::Email],
            self::MessagingMessageRedacted => [NotificationChannel::InApp, NotificationChannel::Email],
            self::TenantMessageReceived, self::OwnerMessageReceived => $tous,
            self::TenantMessageRedacted, self::OwnerMessageRedacted => [NotificationChannel::InApp, NotificationChannel::Email],
            self::AccountSupportReplied, self::SupportAccessRequested, self::SupportAccessUsed, self::SupportAccessEmergency, self::OrganizationSuspended, self::OrganizationReactivated,
            self::PrivacyRequestForwarded, self::AccountPrivacyCompleted, self::AccountExportReady, self::AccountPrivacyReceived => [NotificationChannel::InApp, NotificationChannel::Email],
            self::OwnerFundsAccountChangeRequested, self::OwnerFundsAccountChangeContested, self::MandatesEndRequested => [NotificationChannel::InApp, NotificationChannel::Email],
            self::OwnerApprovalRequested, self::OwnerApprovalExpired, self::OwnerApprovalRecorded, self::OwnerReportPublished, self::OwnerTaxStatementPublished, self::OwnerPayoutExecuted,
            self::OwnerPayoutReturned, self::OwnerAccountChangeRequested, self::OwnerAccountChangeApproved, self::OwnerAccountChangeContested, self::OwnerDocumentShared, self::OwnerMandateEndDismissed, self::OwnerMandateEndFulfilled => [NotificationChannel::InApp, NotificationChannel::Email],
            self::LeasesNoticeRequested, self::LeasesNoticeUnacknowledged, self::TenantNoticeAcknowledged, self::TenantNoticeClosed, self::TenantInsuranceAccepted,
            self::TenantInsuranceRejected, self::TenantDocumentShared, self::TenantInspectionPublished, self::InspectionsRemarkReceived,
            self::TenantInspectionRemarkAnswered, self::TenantOnlinePaymentFailed => [NotificationChannel::InApp, NotificationChannel::Email],
            self::LeasesInsuranceSubmitted, self::PartiesContactUpdateRequested, self::PlanningTaskAssigned => [NotificationChannel::InApp],
            self::PlanningTaskDue, self::PlanningEventReminder => [NotificationChannel::InApp, NotificationChannel::Email],
            self::TenantInsuranceExpiring, self::TenantInsuranceExpired, self::TenantInsuranceReminder => $tous,
            self::AccountMarketing => [],
            self::AccountReminderEmailUnverified => [NotificationChannel::Email],
            self::AccountServiceMessage, self::AccountReminderInactive, self::AccountReminderSpace, self::AccountReminderAgency,
            self::AccountReminderLandlord, self::RemindersPropertyMissing, self::RemindersListingMissing, self::RemindersListingDraft,
            self::RemindersLeadUnanswered, self::RemindersInvitationPending, self::RemindersRecoveryStalled, self::TenantReminderRentDue,
            self::TenantReminderRentUnpaid, self::RemindersTrialEnding => $tous,
        };
    }

    /**
     * Canaux qu'un compte ne peut pas désactiver : la trace d'un événement financier ou probant reste dans le centre.
     *
     * @return list<NotificationChannel>
     */
    public function locked(): array
    {
        return match ($this) {
            self::RentPaymentCancelled, self::RecoveryBundleSent, self::CertificateExpired, self::TenantPaymentCancelled,
            self::MaintenanceApprovalDecided, self::MaintenanceApprovalExpired, self::TenantRequestDeclined,
            self::OwnerFundsPayoutReturned, self::OwnerFundsPayoutFailed, self::OwnerFundsTrustGap, self::OwnerFundsAccountChangeRequested,
            self::OwnerFundsAccountChangeContested, self::OwnerApprovalRequested, self::OwnerPayoutReturned => [NotificationChannel::InApp],
            self::OwnerAccountChangeRequested, self::OwnerAccountChangeApproved, self::OwnerAccountChangeContested,
            self::SupportAccessRequested, self::SupportAccessUsed, self::SupportAccessEmergency, self::OrganizationSuspended, self::OrganizationReactivated,
            self::PrivacyRequestForwarded, self::AccountPrivacyReceived => [NotificationChannel::InApp, NotificationChannel::Email],
            self::LeasesNoticeRequested, self::TenantNoticeAcknowledged, self::TenantNoticeClosed => [NotificationChannel::InApp],
            default => [],
        };
    }

    public function group(): string
    {
        return match ($this) {
            self::RentOverdue, self::RentPaymentRecorded, self::RentPaymentCancelled, self::RecoveryBundleSent, self::ChargesRegularizationDue => 'Finances',
            self::CertificateToRenew, self::CertificateExpired => 'Conformité',
            self::LeaseSigned, self::TenantLeaseSigned => 'Baux',
            self::TenantNoticeIssued, self::TenantReceiptIssued, self::TenantPaymentRecorded, self::TenantPaymentCancelled, self::TenantChargeStatementIssued => 'Loyers',
            self::MaintenanceRequestReceived, self::MaintenanceApprovalDecided, self::MaintenanceApprovalExpired, self::MaintenanceRescheduleRequested,
            self::TenantRequestQualified, self::TenantVisitScheduled, self::TenantRequestDeclined, self::TenantWorkCompleted => 'Interventions',
            self::OwnerFundsPayoutExecuted, self::OwnerFundsPayoutReturned, self::OwnerFundsPayoutFailed, self::OwnerFundsTrustGap => 'Fonds des mandants',
            self::ReportingReportsDue => 'Comptes rendus',
            self::OwnerFundsAccountChangeRequested, self::OwnerFundsAccountChangeContested, self::OwnerAccountChangeRequested,
            self::OwnerAccountChangeApproved, self::OwnerAccountChangeContested => 'Compte de paiement',
            self::MandatesEndRequested, self::OwnerMandateEndDismissed, self::OwnerMandateEndFulfilled => 'Mandats',
            self::OwnerApprovalRequested, self::OwnerApprovalExpired, self::OwnerApprovalRecorded => 'Interventions',
            self::OwnerReportPublished => 'Comptes rendus',
            self::OwnerTaxStatementPublished => 'Fiscalité',
            self::OwnerPayoutExecuted, self::OwnerPayoutReturned => 'Reversements',
            self::MessagingMessageReceived, self::TenantMessageReceived, self::OwnerMessageReceived,
            self::MessagingMessageRedacted, self::TenantMessageRedacted, self::OwnerMessageRedacted => 'Messagerie',
            self::AccountSupportReplied, self::SupportAccessRequested, self::SupportAccessUsed, self::SupportAccessEmergency => 'Support',
            self::TenantAnnouncement, self::OwnerAnnouncement => 'Annonces',
            self::LeasesNoticeRequested, self::LeasesNoticeUnacknowledged, self::TenantNoticeAcknowledged, self::TenantNoticeClosed => 'Congé',
            self::LeasesInsuranceSubmitted, self::TenantInsuranceAccepted, self::TenantInsuranceRejected, self::TenantInsuranceExpiring,
            self::TenantInsuranceExpired, self::TenantInsuranceReminder => 'Assurance',
            self::TenantDocumentShared, self::OwnerDocumentShared => 'Documents',
            self::TenantInspectionPublished, self::InspectionsRemarkReceived, self::TenantInspectionRemarkAnswered => 'États des lieux',
            self::TenantOnlinePaymentFailed => 'Loyers',
            self::PartiesContactUpdateRequested => 'Coordonnées',
            self::PlanningTaskAssigned, self::PlanningTaskDue, self::PlanningEventReminder => 'Agenda',
            self::OrganizationSuspended, self::OrganizationReactivated => 'Organisation',
            self::PrivacyRequestForwarded, self::AccountPrivacyCompleted, self::AccountExportReady, self::AccountPrivacyReceived => 'Données personnelles',
            self::AccountMarketing, self::AccountServiceMessage => 'Informations eGuardImmo',
            self::AccountReminderInactive, self::AccountReminderEmailUnverified, self::AccountReminderSpace, self::AccountReminderAgency,
            self::AccountReminderLandlord, self::RemindersPropertyMissing, self::RemindersListingMissing, self::RemindersListingDraft,
            self::RemindersLeadUnanswered, self::RemindersInvitationPending, self::RemindersRecoveryStalled, self::TenantReminderRentDue,
            self::TenantReminderRentUnpaid, self::RemindersTrialEnding => 'Rappels',
        };
    }

    public function tone(): string
    {
        return match ($this) {
            self::RentOverdue, self::CertificateExpired, self::OwnerFundsTrustGap, self::OwnerFundsAccountChangeContested, self::OwnerAccountChangeContested => 'danger',
            self::RentPaymentCancelled, self::TenantPaymentCancelled, self::CertificateToRenew, self::MaintenanceApprovalExpired, self::TenantRequestDeclined,
            self::OwnerFundsPayoutReturned, self::OwnerFundsPayoutFailed, self::OwnerApprovalExpired, self::OwnerPayoutReturned, self::OwnerAccountChangeRequested, self::ChargesRegularizationDue => 'warning',
            self::RentPaymentRecorded, self::TenantPaymentRecorded, self::TenantReceiptIssued, self::LeaseSigned, self::TenantLeaseSigned,
            self::MaintenanceApprovalDecided, self::TenantWorkCompleted, self::OwnerFundsPayoutExecuted, self::OwnerPayoutExecuted, self::OwnerAccountChangeApproved => 'success',
            self::RecoveryBundleSent, self::TenantNoticeIssued, self::TenantChargeStatementIssued, self::MaintenanceRequestReceived, self::MaintenanceRescheduleRequested,
            self::TenantRequestQualified, self::TenantVisitScheduled, self::ReportingReportsDue, self::OwnerFundsAccountChangeRequested, self::MandatesEndRequested,
            self::OwnerApprovalRequested, self::OwnerApprovalRecorded, self::OwnerReportPublished, self::OwnerTaxStatementPublished, self::OwnerMandateEndDismissed, self::OwnerMandateEndFulfilled,
            self::MessagingMessageReceived, self::TenantMessageReceived, self::OwnerMessageReceived => 'info',
            self::MessagingMessageRedacted, self::TenantMessageRedacted, self::OwnerMessageRedacted, self::SupportAccessRequested => 'warning',
            self::AccountSupportReplied, self::SupportAccessUsed, self::TenantAnnouncement, self::OwnerAnnouncement => 'info',
            self::SupportAccessEmergency, self::OrganizationSuspended => 'danger',
            self::OrganizationReactivated, self::AccountExportReady => 'success',
            self::PrivacyRequestForwarded, self::AccountPrivacyReceived => 'warning',
            self::AccountPrivacyCompleted => 'info',
            self::TenantInsuranceExpired => 'danger',
            self::LeasesNoticeUnacknowledged, self::TenantInsuranceRejected, self::TenantInsuranceExpiring, self::TenantInsuranceReminder, self::TenantOnlinePaymentFailed => 'warning',
            self::TenantNoticeAcknowledged, self::TenantInsuranceAccepted => 'success',
            self::LeasesNoticeRequested, self::TenantNoticeClosed, self::LeasesInsuranceSubmitted, self::TenantDocumentShared, self::OwnerDocumentShared, self::TenantInspectionPublished,
            self::InspectionsRemarkReceived, self::TenantInspectionRemarkAnswered, self::PartiesContactUpdateRequested, self::PlanningTaskAssigned, self::PlanningEventReminder => 'info',
            self::PlanningTaskDue => 'warning',
            self::AccountMarketing, self::AccountServiceMessage, self::AccountReminderInactive, self::AccountReminderEmailUnverified,
            self::AccountReminderSpace, self::AccountReminderAgency, self::AccountReminderLandlord, self::RemindersPropertyMissing,
            self::RemindersListingMissing, self::RemindersListingDraft, self::RemindersInvitationPending, self::TenantReminderRentDue => 'info',
            self::TenantReminderRentUnpaid, self::RemindersRecoveryStalled, self::RemindersTrialEnding, self::RemindersLeadUnanswered => 'warning',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::RentOverdue => 'Loyer en retard',
            self::RentPaymentRecorded, self::TenantPaymentRecorded => 'Paiement enregistré',
            self::RentPaymentCancelled, self::TenantPaymentCancelled => 'Paiement annulé',
            self::RecoveryBundleSent => 'Dossier de recouvrement transmis',
            self::CertificateToRenew => 'Pièce à renouveler',
            self::CertificateExpired => 'Pièce expirée',
            self::LeaseSigned, self::TenantLeaseSigned => 'Bail signé',
            self::TenantNoticeIssued => 'Avis d\'échéance émis',
            self::TenantReceiptIssued => 'Quittance émise',
            self::TenantChargeStatementIssued => 'Décompte de charges disponible',
            self::ChargesRegularizationDue => 'Régularisation des charges à effectuer',
            self::MaintenanceRequestReceived => 'Demande d\'intervention reçue',
            self::MaintenanceApprovalDecided => 'Accord du mandant',
            self::MaintenanceApprovalExpired => 'Accord du mandant expiré',
            self::MaintenanceRescheduleRequested => 'Report de rendez-vous demandé',
            self::TenantRequestQualified => 'Demande prise en charge',
            self::TenantVisitScheduled => 'Rendez-vous d\'intervention',
            self::TenantRequestDeclined => 'Demande classée sans suite',
            self::TenantWorkCompleted => 'Intervention terminée',
            self::OwnerFundsPayoutExecuted => 'Reversement exécuté',
            self::OwnerFundsPayoutReturned => 'Reversement retourné par la banque',
            self::OwnerFundsPayoutFailed => 'Reversement échoué',
            self::OwnerFundsTrustGap => 'Écart de cantonnement',
            self::ReportingReportsDue => 'Comptes rendus de gestion à produire',
            self::OwnerFundsAccountChangeRequested => 'Changement de compte de paiement à valider',
            self::OwnerFundsAccountChangeContested => 'Changement de compte de paiement contesté',
            self::MandatesEndRequested => 'Fin de mandat demandée',
            self::OwnerApprovalRequested => 'Accord demandé',
            self::OwnerApprovalExpired => 'Demande d\'accord expirée',
            self::OwnerApprovalRecorded => 'Accord enregistré par l\'agence',
            self::OwnerReportPublished => 'Compte rendu de gestion disponible',
            self::OwnerTaxStatementPublished => 'Relevé fiscal disponible',
            self::OwnerPayoutExecuted => 'Reversement exécuté',
            self::OwnerPayoutReturned => 'Reversement retourné par la banque',
            self::OwnerAccountChangeRequested => 'Changement de compte de paiement demandé',
            self::OwnerAccountChangeApproved => 'Compte de paiement modifié',
            self::OwnerAccountChangeContested => 'Changement de compte de paiement contesté',
            self::OwnerMandateEndDismissed => 'Demande de fin de mandat rejetée',
            self::OwnerMandateEndFulfilled => 'Fin de mandat acceptée',
            self::MessagingMessageReceived => 'Nouveau message',
            self::TenantMessageReceived => 'Nouveau message de votre agence',
            self::OwnerMessageReceived => 'Nouveau message de votre agence',
            self::MessagingMessageRedacted, self::TenantMessageRedacted, self::OwnerMessageRedacted => 'Message retiré par l\'organisation',
            self::AccountSupportReplied => 'Réponse du support',
            self::SupportAccessRequested => 'Accès du support demandé',
            self::SupportAccessUsed => 'Accès du support utilisé',
            self::SupportAccessEmergency => 'Accès d\'urgence du support',
            self::OrganizationSuspended => 'Organisation suspendue',
            self::OrganizationReactivated => 'Organisation réactivée',
            self::PrivacyRequestForwarded => 'Demande de données personnelles à traiter',
            self::AccountPrivacyCompleted => 'Demande de données personnelles traitée',
            self::AccountPrivacyReceived => 'Demande de données personnelles enregistrée',
            self::AccountExportReady => 'Export de vos données disponible',
            self::TenantAnnouncement, self::OwnerAnnouncement => 'Annonce de votre agence',
            self::LeasesNoticeRequested => 'Demande de congé reçue',
            self::LeasesNoticeUnacknowledged => 'Demande de congé sans accusé',
            self::TenantNoticeAcknowledged => 'Demande de congé reçue par l\'agence',
            self::TenantNoticeClosed => 'Demande de congé traitée',
            self::LeasesInsuranceSubmitted => 'Attestation d\'assurance déposée',
            self::TenantInsuranceAccepted => 'Attestation d\'assurance acceptée',
            self::TenantInsuranceRejected => 'Attestation d\'assurance refusée',
            self::TenantInsuranceExpiring => 'Assurance bientôt échue',
            self::TenantInsuranceExpired => 'Assurance échue',
            self::TenantInsuranceReminder => 'Attestation d\'assurance demandée',
            self::TenantDocumentShared, self::OwnerDocumentShared => 'Document partagé',
            self::TenantInspectionPublished => 'État des lieux disponible',
            self::InspectionsRemarkReceived => 'Remarque sur un état des lieux',
            self::TenantInspectionRemarkAnswered => 'Réponse à votre remarque',
            self::TenantOnlinePaymentFailed => 'Paiement en ligne non abouti',
            self::PartiesContactUpdateRequested => 'Modification de coordonnées à traiter',
            self::PlanningTaskAssigned => 'Tâche confiée',
            self::PlanningTaskDue => 'Tâche à échéance',
            self::PlanningEventReminder => 'Rappel d\'agenda',
            self::AccountMarketing => 'Nouveautés et offres eGuardImmo',
            self::AccountServiceMessage => 'Informations de service eGuardImmo',
            self::AccountReminderInactive => 'Rappel de connexion',
            self::AccountReminderEmailUnverified => 'Adresse e-mail à confirmer',
            self::AccountReminderSpace => 'Espace à créer',
            self::AccountReminderAgency => 'Agence à créer',
            self::AccountReminderLandlord => 'Espace bailleur à créer',
            self::RemindersPropertyMissing => 'Premier bien à enregistrer',
            self::RemindersListingMissing => 'Première annonce à créer',
            self::RemindersListingDraft => 'Annonce à publier',
            self::RemindersLeadUnanswered => 'Demande reçue sans réponse',
            self::RemindersInvitationPending => 'Invitation de locataire en attente',
            self::RemindersRecoveryStalled => 'Dossier de recouvrement à suivre',
            self::TenantReminderRentDue => 'Échéance de loyer à venir',
            self::TenantReminderRentUnpaid => 'Rappel de loyer',
            self::RemindersTrialEnding => 'Fin d\'essai proche',
        };
    }

    /**
     * Texte du push : générique, il s'affiche sur un écran verrouillé.
     */
    public function pushBody(): string
    {
        return match ($this) {
            self::RentOverdue => 'Un loyer est en retard.',
            self::RentPaymentRecorded, self::TenantPaymentRecorded => 'Un paiement a été enregistré.',
            self::RentPaymentCancelled, self::TenantPaymentCancelled => 'Un paiement a été annulé.',
            self::RecoveryBundleSent => 'Un dossier de recouvrement a été transmis.',
            self::CertificateToRenew => 'Une pièce est à renouveler.',
            self::CertificateExpired => 'Une pièce a expiré.',
            self::LeaseSigned, self::TenantLeaseSigned => 'Un bail a été signé.',
            self::TenantNoticeIssued => 'Un avis d\'échéance est disponible.',
            self::TenantReceiptIssued => 'Une quittance est disponible.',
            self::TenantChargeStatementIssued => 'Un décompte de charges est disponible.',
            self::ChargesRegularizationDue => 'Une régularisation des charges est à effectuer.',
            self::MaintenanceRequestReceived => 'Une demande d\'intervention a été reçue.',
            self::MaintenanceApprovalDecided => 'Le mandant a répondu à une demande d\'accord.',
            self::MaintenanceApprovalExpired => 'Une demande d\'accord a expiré.',
            self::MaintenanceRescheduleRequested => 'Un report de rendez-vous est demandé.',
            self::TenantRequestQualified, self::TenantVisitScheduled, self::TenantRequestDeclined, self::TenantWorkCompleted => 'Votre demande a avancé.',
            self::OwnerFundsPayoutExecuted => 'Un reversement a été exécuté.',
            self::OwnerFundsPayoutReturned => 'Un reversement a été retourné par la banque.',
            self::OwnerFundsPayoutFailed => 'Un reversement a échoué.',
            self::OwnerFundsTrustGap => 'Le compte de tiers ne couvre plus les fonds des mandants.',
            self::ReportingReportsDue => 'Des comptes rendus de gestion sont à produire.',
            self::OwnerFundsAccountChangeRequested => 'Une demande de changement de compte de paiement est à valider.',
            self::OwnerFundsAccountChangeContested => 'Un changement de compte de paiement est contesté.',
            self::MandatesEndRequested => 'Une fin de mandat est demandée.',
            self::OwnerMandateEndDismissed, self::OwnerMandateEndFulfilled => 'Votre agence a répondu à votre demande de fin de mandat.',
            self::OwnerApprovalRequested => 'Votre accord est demandé.',
            self::OwnerApprovalExpired => 'Une demande d\'accord a expiré.',
            self::OwnerApprovalRecorded => 'Votre agence a enregistré votre accord.',
            self::OwnerReportPublished => 'Un compte rendu de gestion est disponible.',
            self::OwnerTaxStatementPublished => 'Un relevé fiscal est disponible.',
            self::OwnerPayoutExecuted => 'Un reversement a été exécuté.',
            self::OwnerPayoutReturned => 'Un reversement a été retourné par la banque.',
            self::OwnerAccountChangeRequested, self::OwnerAccountChangeApproved, self::OwnerAccountChangeContested => 'Votre compte de paiement fait l\'objet d\'un changement.',
            self::MessagingMessageReceived, self::TenantMessageReceived, self::OwnerMessageReceived => 'Vous avez un nouveau message.',
            self::MessagingMessageRedacted, self::TenantMessageRedacted, self::OwnerMessageRedacted => 'Un de vos messages a été retiré par l\'organisation.',
            self::AccountSupportReplied => 'Le support a répondu à votre demande.',
            self::SupportAccessRequested => 'Le support demande un accès à vos données.',
            self::SupportAccessUsed => 'Le support a consulté vos données.',
            self::SupportAccessEmergency => 'Le support a ouvert un accès d\'urgence à vos données.',
            self::OrganizationSuspended => 'Votre organisation a été suspendue : les modifications sont bloquées.',
            self::OrganizationReactivated => 'Votre organisation a été réactivée.',
            self::PrivacyRequestForwarded => 'Une personne exerce ses droits sur des données de votre organisation.',
            self::AccountPrivacyCompleted => 'Votre demande concernant vos données personnelles est traitée.',
            self::AccountPrivacyReceived => 'Une demande concernant vos données personnelles a été enregistrée sur votre compte.',
            self::AccountExportReady => 'L\'export de vos données est prêt à télécharger.',
            self::TenantAnnouncement, self::OwnerAnnouncement => 'Votre agence a publié une annonce.',
            self::LeasesNoticeRequested => 'Une demande de congé a été reçue.',
            self::LeasesNoticeUnacknowledged => 'Une demande de congé attend toujours un accusé de réception.',
            self::TenantNoticeAcknowledged => 'Votre agence a accusé réception de votre demande.',
            self::TenantNoticeClosed => 'Votre demande a été traitée.',
            self::LeasesInsuranceSubmitted => 'Une attestation d\'assurance a été déposée.',
            self::TenantInsuranceAccepted, self::TenantInsuranceRejected => 'Votre agence a traité votre attestation.',
            self::TenantInsuranceExpiring => 'Votre assurance arrive à échéance.',
            self::TenantInsuranceExpired => 'Votre assurance est échue.',
            self::TenantInsuranceReminder => 'Votre agence vous demande une attestation.',
            self::TenantDocumentShared, self::OwnerDocumentShared => 'Un document est disponible.',
            self::TenantInspectionPublished => 'Un état des lieux est disponible.',
            self::InspectionsRemarkReceived => 'Une remarque a été déposée sur un état des lieux.',
            self::TenantInspectionRemarkAnswered => 'Votre agence a répondu à votre remarque.',
            self::TenantOnlinePaymentFailed => 'Un paiement en ligne n\'a pas abouti.',
            self::PartiesContactUpdateRequested => 'Une modification de coordonnées est à traiter.',
            self::PlanningTaskAssigned => 'Une tâche vous a été confiée.',
            self::PlanningTaskDue => 'Une tâche arrive à échéance.',
            self::PlanningEventReminder => 'Un rendez-vous approche.',
            self::AccountMarketing, self::AccountServiceMessage => 'Vous avez une information d\'eGuardImmo.',
            self::AccountReminderInactive => 'Votre compte vous attend.',
            self::AccountReminderEmailUnverified => 'Confirmez votre adresse e-mail.',
            self::AccountReminderSpace, self::AccountReminderAgency, self::AccountReminderLandlord => 'Votre espace reste à créer.',
            self::RemindersPropertyMissing => 'Ajoutez votre premier bien.',
            self::RemindersListingMissing => 'Publiez votre première annonce.',
            self::RemindersListingDraft => 'Une annonce attend sa publication.',
            self::RemindersLeadUnanswered => 'Une demande attend votre réponse.',
            self::RemindersInvitationPending => 'Une invitation n\'a pas encore été acceptée.',
            self::RemindersRecoveryStalled => 'Un dossier de recouvrement attend une suite.',
            self::TenantReminderRentDue => 'Une échéance approche.',
            self::TenantReminderRentUnpaid => 'Un rappel concerne votre loyer.',
            self::RemindersTrialEnding => 'Votre période d\'essai se termine bientôt.',
        };
    }
}
