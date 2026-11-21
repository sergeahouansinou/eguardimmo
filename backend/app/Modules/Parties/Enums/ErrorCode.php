<?php

declare(strict_types=1);

namespace App\Modules\Parties\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case PartyNotFound = 'party_not_found';
    case ContactPointNotFound = 'contact_point_not_found';
    case IdentifierNotFound = 'identifier_not_found';
    case BankAccountNotFound = 'bank_account_not_found';
    case VersionConflict = 'party_version_conflict';
    case PartyAnonymized = 'party_anonymized';
    case ContactPointExists = 'contact_point_exists';
    case IdentifierTaken = 'identifier_taken';
    case BankAccountExists = 'bank_account_exists';
    case BankAccountClosed = 'bank_account_closed';
    case BankAccountPeriodInvalid = 'bank_account_period_invalid';
    case TenantAccessPersonRequired = 'tenant_access_person_required';
    case TenantAccessEmailRequired = 'tenant_access_email_required';
    case TenantAccessPartyArchived = 'tenant_access_party_archived';
    case PartyAlreadyLinked = 'party_already_linked';
    case AccountAlreadyLinked = 'tenant_account_already_linked';
    case TenantAccessNotFound = 'tenant_access_not_found';
    case OwnerIdentityAttestationRequired = 'owner_identity_attestation_required';
    case OwnerAccessRoleInvalid = 'owner_access_role_invalid';
    case OwnerAccessLimitReached = 'owner_access_limit_reached';
    case OwnerAccessNotFound = 'owner_access_not_found';
    case OwnerAccessAlreadyLinked = 'owner_access_already_linked';
    case OwnerAccessEmailRequired = 'owner_access_email_required';
    case OwnerAccessPartyArchived = 'owner_access_party_archived';
    case OwnerAccessEmailForbidden = 'owner_access_email_forbidden';
    case OwnerAccessRequiresPayoutRequest = 'owner_access_requires_payout_request';
    case ContactUpdateNotFound = 'contact_update_not_found';
    case ContactUpdateNotPending = 'contact_update_not_pending';
    case ContactUpdateEmpty = 'contact_update_empty';
    case IdempotencyKeyReused = 'idempotency_key_reused';
    case PartyPossibleDuplicate = 'party_possible_duplicate';
    case PartyImportInvalid = 'party_import_invalid';

    /**
     * @param  array<string, mixed>  $extensions
     */
    public function problem(array $extensions = []): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail(), extensions: $extensions);
    }

    public function status(): int
    {
        return match ($this) {
            self::PartyNotFound, self::ContactPointNotFound, self::IdentifierNotFound, self::BankAccountNotFound, self::TenantAccessNotFound, self::OwnerAccessNotFound, self::ContactUpdateNotFound => 404,
            self::VersionConflict, self::PartyAnonymized, self::ContactPointExists, self::IdentifierTaken,
            self::BankAccountExists, self::BankAccountClosed, self::TenantAccessPartyArchived, self::PartyAlreadyLinked, self::AccountAlreadyLinked,
            self::OwnerAccessLimitReached, self::OwnerAccessAlreadyLinked, self::OwnerAccessPartyArchived, self::OwnerAccessRequiresPayoutRequest, self::ContactUpdateNotPending, self::IdempotencyKeyReused, self::PartyPossibleDuplicate => 409,
            self::BankAccountPeriodInvalid, self::TenantAccessPersonRequired, self::TenantAccessEmailRequired,
            self::OwnerIdentityAttestationRequired, self::OwnerAccessRoleInvalid, self::OwnerAccessEmailRequired, self::OwnerAccessEmailForbidden, self::ContactUpdateEmpty, self::PartyImportInvalid => 422,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::PartyNotFound => 'Contact introuvable',
            self::ContactPointNotFound => 'Coordonnée introuvable',
            self::IdentifierNotFound => 'Identifiant introuvable',
            self::BankAccountNotFound => 'Compte bancaire introuvable',
            self::VersionConflict => 'Fiche modifiée entre-temps',
            self::PartyAnonymized => 'Contact anonymisé',
            self::ContactPointExists => 'Coordonnée existante',
            self::IdentifierTaken => 'Identifiant déjà utilisé',
            self::BankAccountExists => 'Compte bancaire existant',
            self::BankAccountClosed => 'Compte bancaire clôturé',
            self::BankAccountPeriodInvalid => 'Période invalide',
            self::TenantAccessPersonRequired => 'Personne physique requise',
            self::TenantAccessEmailRequired => 'Adresse e-mail requise',
            self::TenantAccessPartyArchived => 'Contact archivé',
            self::PartyAlreadyLinked => 'Contact déjà rattaché',
            self::AccountAlreadyLinked => 'Compte déjà rattaché',
            self::TenantAccessNotFound => 'Accès introuvable',
            self::OwnerIdentityAttestationRequired => 'Attestation d\'identité requise',
            self::OwnerAccessRoleInvalid => 'Rôle incompatible avec ce contact',
            self::OwnerAccessLimitReached => 'Nombre d\'accès atteint',
            self::OwnerAccessNotFound => 'Accès introuvable',
            self::OwnerAccessAlreadyLinked => 'Accès déjà accordé',
            self::OwnerAccessEmailRequired => 'Adresse e-mail requise',
            self::OwnerAccessPartyArchived => 'Contact archivé',
            self::OwnerAccessEmailForbidden => 'Adresse e-mail non autorisée',
            self::OwnerAccessRequiresPayoutRequest => 'Changement de compte réservé au mandant',
            self::ContactUpdateNotFound => 'Demande de coordonnées introuvable',
            self::ContactUpdateNotPending => 'Demande déjà traitée',
            self::ContactUpdateEmpty => 'Aucune coordonnée à transmettre',
            self::IdempotencyKeyReused => 'Clé d\'idempotence réutilisée',
            self::PartyPossibleDuplicate => 'Doublon possible',
            self::PartyImportInvalid => 'Import invalide',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::PartyNotFound => 'Ce contact n\'existe pas dans votre organisation.',
            self::ContactPointNotFound => 'Cette coordonnée n\'existe pas dans votre organisation.',
            self::IdentifierNotFound => 'Cet identifiant n\'existe pas dans votre organisation.',
            self::BankAccountNotFound => 'Ce compte bancaire n\'existe pas dans votre organisation.',
            self::VersionConflict => 'La fiche a été modifiée depuis sa lecture : rechargez-la avant de renvoyer vos changements.',
            self::PartyAnonymized => 'Un contact anonymisé ne se modifie plus.',
            self::ContactPointExists => 'Ce contact porte déjà cette coordonnée.',
            self::IdentifierTaken => 'Un contact de votre organisation porte déjà cet identifiant.',
            self::BankAccountExists => 'Ce contact a déjà ce compte bancaire en cours de validité.',
            self::BankAccountClosed => 'Ce compte bancaire est déjà clôturé.',
            self::BankAccountPeriodInvalid => 'La date de début du nouveau compte précède celle du compte remplacé.',
            self::TenantAccessPersonRequired => 'Seule une personne physique peut être invitée à l\'espace locataire.',
            self::TenantAccessEmailRequired => 'Indiquez l\'adresse e-mail à inviter : ce contact n\'a pas d\'e-mail principal.',
            self::TenantAccessPartyArchived => 'Restaurez ce contact avant de l\'inviter.',
            self::PartyAlreadyLinked => 'Ce contact est déjà rattaché à un compte : révoquez l\'accès avant d\'en inviter un autre.',
            self::AccountAlreadyLinked => 'Ce compte est déjà rattaché à un autre contact de cette organisation.',
            self::TenantAccessNotFound => 'Aucune invitation ni aucun accès pour ce contact.',
            self::OwnerIdentityAttestationRequired => 'Attestez avoir vérifié l\'identité du mandant (et, pour un représentant, ses pouvoirs) avant d\'inviter.',
            self::OwnerAccessRoleInvalid => 'Ce rôle ne correspond pas à ce contact : « holder » pour une personne, « representative » pour une société, « co_owner » avec la fiche du co-indivisaire.',
            self::OwnerAccessLimitReached => 'Ce mandant a atteint le nombre maximal de comptes rattachés : révoquez un accès avant d\'en inviter un autre.',
            self::OwnerAccessNotFound => 'Aucune invitation ni aucun accès propriétaire pour cette référence.',
            self::OwnerAccessAlreadyLinked => 'Ce compte est déjà rattaché à ce mandant.',
            self::OwnerAccessEmailRequired => 'Indiquez l\'adresse e-mail à inviter : la fiche n\'a pas d\'e-mail principal.',
            self::OwnerAccessPartyArchived => 'Restaurez ce contact avant de l\'inviter.',
            self::OwnerAccessEmailForbidden => 'Cette adresse est celle d\'un membre de votre organisation : un propriétaire se rattache avec sa propre adresse.',
            self::ContactUpdateNotFound => 'Cette demande de coordonnées n\'existe pas.',
            self::ContactUpdateNotPending => 'Cette demande a déjà été appliquée ou écartée.',
            self::ContactUpdateEmpty => 'Votre compte ne porte aucune des coordonnées demandées.',
            self::IdempotencyKeyReused => 'Cette clé a déjà servi pour une demande différente.',
            self::PartyPossibleDuplicate => 'Un contact de votre organisation ressemble à celui-ci : ouvrez la fiche existante, ou renvoyez la demande avec allow_duplicate pour créer quand même.',
            self::PartyImportInvalid => 'Aucun contact n\'a été importé : corrigez les lignes signalées.',
            self::OwnerAccessRequiresPayoutRequest => 'Ce mandant a un accès à son espace : son compte de paiement ne se change que par sa demande, que vous validez ensuite (ADR 0032, décision 5).',
        };
    }
}
