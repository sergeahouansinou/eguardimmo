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

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::OrganizationNotFound, self::MemberNotFound, self::InvitationInvalid => 404,
            self::RoleForbidden, self::TwoFactorRequired, self::InvitationEmailMismatch => 403,
            self::AlreadyMember, self::OwnerImmutable, self::SelfChangeForbidden, self::LastAdministrator,
            self::NotInvited, self::NotDisabled, self::SingleMemberOrganization => 409,
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
        };
    }
}
