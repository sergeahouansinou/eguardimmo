<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

/**
 * Catalogue fermé des rappels (ADR 0042).
 */
enum ReminderCode: string
{
    case AccountInactive = 'account_inactive';
    case EmailUnverified = 'email_unverified';
    case SpaceNotCreated = 'space_not_created';
    case AgencyNotCreated = 'agency_not_created';
    case LandlordSpaceNotCreated = 'landlord_space_not_created';
    case PropertyMissing = 'property_missing';
    case ListingMissing = 'listing_missing';
    case ListingDraft = 'listing_draft';
    case LeadUnanswered = 'lead_unanswered';
    case InvitationPending = 'invitation_pending';
    case RecoveryStalled = 'recovery_stalled';
    case RentDueSoon = 'rent_due_soon';
    case RentUnpaid = 'rent_unpaid';
    case TrialEnding = 'trial_ending';

    public function type(): NotificationType
    {
        return match ($this) {
            self::AccountInactive => NotificationType::AccountReminderInactive,
            self::EmailUnverified => NotificationType::AccountReminderEmailUnverified,
            self::SpaceNotCreated => NotificationType::AccountReminderSpace,
            self::AgencyNotCreated => NotificationType::AccountReminderAgency,
            self::LandlordSpaceNotCreated => NotificationType::AccountReminderLandlord,
            self::PropertyMissing => NotificationType::RemindersPropertyMissing,
            self::ListingMissing => NotificationType::RemindersListingMissing,
            self::ListingDraft => NotificationType::RemindersListingDraft,
            self::LeadUnanswered => NotificationType::RemindersLeadUnanswered,
            self::InvitationPending => NotificationType::RemindersInvitationPending,
            self::RecoveryStalled => NotificationType::RemindersRecoveryStalled,
            self::RentDueSoon => NotificationType::TenantReminderRentDue,
            self::RentUnpaid => NotificationType::TenantReminderRentUnpaid,
            self::TrialEnding => NotificationType::RemindersTrialEnding,
        };
    }

    public function category(): ReminderCategory
    {
        return match ($this) {
            self::AccountInactive, self::EmailUnverified => ReminderCategory::Account,
            self::SpaceNotCreated, self::AgencyNotCreated, self::LandlordSpaceNotCreated, self::PropertyMissing,
            self::ListingMissing, self::ListingDraft => ReminderCategory::Journey,
            self::RentDueSoon, self::RentUnpaid => ReminderCategory::Tenant,
            self::LeadUnanswered, self::InvitationPending, self::RecoveryStalled, self::TrialEnding => ReminderCategory::Team,
        };
    }

    public function timing(): ReminderTiming
    {
        return $this === self::RentDueSoon || $this === self::TrialEnding ? ReminderTiming::Before : ReminderTiming::After;
    }

    /**
     * @return array{delay: int, min: int, max: int, repeat: int|null, occurrences: int}
     */
    public function defaults(): array
    {
        [$delai, $minimum, $maximum, $repetition, $occurrences] = match ($this) {
            self::AccountInactive => [14, 7, 365, 30, 2],
            self::EmailUnverified => [2, 1, 30, 5, 2],
            self::SpaceNotCreated => [3, 1, 60, null, 1],
            self::AgencyNotCreated, self::LandlordSpaceNotCreated => [3, 1, 60, 7, 2],
            self::PropertyMissing => [7, 1, 90, 14, 2],
            self::ListingMissing => [14, 1, 180, 30, 2],
            self::ListingDraft => [5, 1, 90, 7, 2],
            self::LeadUnanswered => [2, 1, 30, 3, 2],
            self::InvitationPending => [3, 1, 30, null, 1],
            self::RecoveryStalled => [15, 3, 180, 15, 3],
            self::RentDueSoon => [3, 1, 15, null, 1],
            self::RentUnpaid => [5, 1, 90, 7, 3],
            self::TrialEnding => [3, 1, 14, null, 1],
        };

        return ['delay' => $delai, 'min' => $minimum, 'max' => $maximum, 'repeat' => $repetition, 'occurrences' => $occurrences];
    }

    /** L'adresse non confirmée peut être celle d'un tiers : les envois y sont plus limités. */
    public function occurrencesLimit(): int
    {
        return $this === self::EmailUnverified ? 2 : 5;
    }

    /**
     * @return list<NotificationChannel>
     */
    public function availableChannels(): array
    {
        return $this === self::EmailUnverified ? [NotificationChannel::Email] : NotificationChannel::cases();
    }

    public function label(): string
    {
        return match ($this) {
            self::AccountInactive => 'Compte inactif',
            self::EmailUnverified => 'Adresse e-mail non confirmée',
            self::SpaceNotCreated => 'Aucun espace créé',
            self::AgencyNotCreated => 'Agence non créée',
            self::LandlordSpaceNotCreated => 'Espace bailleur non créé',
            self::PropertyMissing => 'Aucun bien enregistré',
            self::ListingMissing => 'Aucune annonce',
            self::ListingDraft => 'Annonce restée en brouillon',
            self::LeadUnanswered => 'Demande sans réponse',
            self::InvitationPending => 'Invitation locataire en attente',
            self::RecoveryStalled => 'Dossier de recouvrement sans suite',
            self::RentDueSoon => 'Échéance de loyer à venir',
            self::RentUnpaid => 'Loyer non réglé',
            self::TrialEnding => 'Fin d\'essai proche',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::AccountInactive => 'Compte sans connexion ni utilisation depuis le délai.',
            self::EmailUnverified => 'Inscription dont l\'adresse e-mail n\'est pas confirmée ; envoyé par e-mail seulement.',
            self::SpaceNotCreated => 'Compte confirmé qui n\'a ni choisi son profil ni rejoint d\'espace.',
            self::AgencyNotCreated => 'Compte inscrit comme agence qui n\'a pas créé son agence.',
            self::LandlordSpaceNotCreated => 'Compte inscrit comme bailleur qui n\'a pas créé son espace.',
            self::PropertyMissing => 'Organisation qui n\'a encore enregistré aucun bien.',
            self::ListingMissing => 'Organisation qui n\'a encore aucune annonce.',
            self::ListingDraft => 'Annonce enregistrée mais jamais publiée.',
            self::LeadUnanswered => 'Demande reçue sur une annonce et restée sans réponse.',
            self::InvitationPending => 'Invitation de locataire non acceptée et encore valable.',
            self::RecoveryStalled => 'Dossier de recouvrement ouvert sans acte depuis le délai.',
            self::RentDueSoon => 'Rappel au locataire avant une échéance non soldée.',
            self::RentUnpaid => 'Rappel de courtoisie au locataire après une échéance non soldée ; ce n\'est pas une mise en demeure.',
            self::TrialEnding => 'Rappel avant la fin de la période d\'essai.',
        };
    }
}
