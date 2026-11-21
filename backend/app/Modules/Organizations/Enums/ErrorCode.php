<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case OrganizationNotFound = 'organization_not_found';
    case RoleForbidden = 'role_forbidden';
    case TwoFactorRequired = 'two_factor_required';
    case MemberNotFound = 'member_not_found';
    case AlreadyMember = 'already_member';
    case OwnerImmutable = 'owner_immutable';
    case SelfChangeForbidden = 'self_change_forbidden';
    case LastAdministrator = 'last_administrator';
    case NotInvited = 'not_invited';
    case NotDisabled = 'not_disabled';
    case SingleMemberOrganization = 'single_member_organization';
    case InvitationInvalid = 'invitation_invalid';
    case InvitationEmailMismatch = 'invitation_email_mismatch';
    case LegalIdentityNotFound = 'legal_identity_not_found';
    case MemberScopeUnsupported = 'member_scope_unsupported';
    case OrganizationSuspended = 'organization_suspended';
    case OrganizationSuspendedAlready = 'organization_already_suspended';
    case OrganizationNotSuspended = 'organization_not_suspended';
    case ActivityNotFound = 'activity_not_found';
    case ActivityRangeTooWide = 'activity_range_too_wide';
    case ActivityExportTooLarge = 'activity_export_too_large';
    case InvitationRateLimited = 'member_invitation_rate_limited';
    case InvitationDailyLimitReached = 'member_invitation_daily_limit_reached';
    case InvitationAddressLimitReached = 'member_invitation_address_limit_reached';
    case InvitationResendTooSoon = 'member_invitation_resend_too_soon';
    case InvitationResendLimitReached = 'member_invitation_resend_limit_reached';
    case OrganizationLimitReached = 'organization_limit_reached';

    public function problem(?int $reessayerDans = null): ApiProblem
    {
        $entetes = $reessayerDans === null ? [] : ['Retry-After' => (string) max(1, $reessayerDans)];

        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail(), $entetes);
    }

    public function status(): int
    {
        return match ($this) {
            self::OrganizationNotFound, self::MemberNotFound, self::InvitationInvalid, self::LegalIdentityNotFound, self::ActivityNotFound => 404,
            self::RoleForbidden, self::TwoFactorRequired, self::InvitationEmailMismatch, self::OrganizationSuspended, self::OrganizationLimitReached => 403,
            self::AlreadyMember, self::OwnerImmutable, self::SelfChangeForbidden, self::LastAdministrator,
            self::NotInvited, self::NotDisabled, self::SingleMemberOrganization, self::OrganizationSuspendedAlready, self::OrganizationNotSuspended => 409,
            self::MemberScopeUnsupported, self::ActivityRangeTooWide, self::ActivityExportTooLarge => 422,
            self::InvitationRateLimited, self::InvitationDailyLimitReached, self::InvitationAddressLimitReached,
            self::InvitationResendTooSoon, self::InvitationResendLimitReached => 429,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::OrganizationNotFound => 'Organisation introuvable',
            self::RoleForbidden => 'Action réservée',
            self::TwoFactorRequired => 'Double authentification requise',
            self::MemberNotFound => 'Membre introuvable',
            self::AlreadyMember => 'Déjà membre',
            self::OwnerImmutable => 'Titulaire non modifiable',
            self::SelfChangeForbidden => 'Action sur vous-même',
            self::LastAdministrator => 'Dernier administrateur',
            self::NotInvited => 'Aucune invitation',
            self::NotDisabled => 'Membre actif',
            self::SingleMemberOrganization => 'Compte individuel',
            self::InvitationInvalid => 'Invitation invalide',
            self::InvitationEmailMismatch => 'Invitation destinée à une autre adresse',
            self::LegalIdentityNotFound => 'Identité légale non renseignée',
            self::MemberScopeUnsupported => 'Périmètre non appliqué',
            self::OrganizationSuspended => 'Organisation suspendue',
            self::OrganizationSuspendedAlready => 'Organisation déjà suspendue',
            self::OrganizationNotSuspended => 'Organisation non suspendue',
            self::ActivityNotFound => 'Entrée du journal introuvable',
            self::ActivityRangeTooWide => 'Période trop large',
            self::ActivityExportTooLarge => 'Export trop volumineux',
            self::InvitationRateLimited => 'Trop d\'invitations',
            self::InvitationDailyLimitReached => 'Trop d\'invitations aujourd\'hui',
            self::InvitationAddressLimitReached => 'Trop d\'invitations à cette adresse',
            self::InvitationResendTooSoon => 'Renvoi trop rapproché',
            self::InvitationResendLimitReached => 'Trop de renvois',
            self::OrganizationLimitReached => 'Limite d\'organisations atteinte',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::OrganizationNotFound => 'Cette organisation n\'existe pas ou vous n\'en êtes pas membre.',
            self::RoleForbidden => 'Votre rôle ne permet pas cette action.',
            self::TwoFactorRequired => 'Activez la double authentification sur votre compte pour accéder à cette organisation.',
            self::MemberNotFound => 'Ce membre n\'existe pas dans cette organisation.',
            self::AlreadyMember => 'Cette adresse e-mail est déjà membre ou invitée.',
            self::OwnerImmutable => 'Le titulaire du compte ne peut être ni retiré, ni désactivé, ni changé de rôle.',
            self::SelfChangeForbidden => 'Vous ne pouvez pas modifier votre propre accès.',
            self::LastAdministrator => 'L\'administrateur unique ne peut pas perdre ses droits : nommez-en un autre d\'abord.',
            self::NotInvited => 'Ce membre n\'a pas d\'invitation en attente.',
            self::NotDisabled => 'Ce membre n\'est pas désactivé.',
            self::SingleMemberOrganization => 'Un compte de bailleur individuel n\'a qu\'un membre.',
            self::InvitationInvalid => 'Cette invitation est invalide, expirée ou déjà utilisée.',
            self::InvitationEmailMismatch => 'Connectez-vous avec l\'adresse e-mail qui a reçu l\'invitation.',
            self::LegalIdentityNotFound => 'Le siège de cette organisation n\'a pas encore renseigné son identité légale.',
            self::MemberScopeUnsupported => 'Le périmètre « biens sélectionnés » n\'est pas appliqué par l\'API : un membre y verrait tous les biens. Invitez ce membre avec le périmètre « tous les biens ».',
            self::OrganizationSuspended => 'Votre organisation est suspendue : vous pouvez la consulter et exporter vos données, mais plus la modifier. Contactez le support.',
            self::OrganizationSuspendedAlready => 'Cette organisation est déjà suspendue.',
            self::OrganizationNotSuspended => 'Cette organisation n\'est pas suspendue.',
            self::ActivityNotFound => 'Cette entrée n\'existe pas dans le journal de votre organisation.',
            self::ActivityRangeTooWide => 'La période demandée ne peut pas dépasser 366 jours.',
            self::ActivityExportTooLarge => 'Cette période contient trop d\'entrées pour un export : réduisez-la.',
            self::InvitationRateLimited => 'Cette organisation envoie trop d\'invitations en peu de temps. Réessayez dans quelques instants.',
            self::InvitationDailyLimitReached => 'Cette organisation a atteint le nombre d\'invitations autorisé sur vingt-quatre heures. Réessayez plus tard.',
            self::InvitationAddressLimitReached => 'Cette adresse a déjà reçu plusieurs invitations de votre organisation. Réessayez plus tard.',
            self::InvitationResendTooSoon => 'Cette invitation vient d\'être envoyée. Patientez avant de la renvoyer.',
            self::InvitationResendLimitReached => 'Cette invitation a déjà été renvoyée plusieurs fois aujourd\'hui. Réessayez plus tard.',
            self::OrganizationLimitReached => 'Vous avez atteint le nombre maximal d\'organisations que vous pouvez créer. Contactez le support si vous avez besoin d\'en créer davantage.',
        };
    }
}
