<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Organizations\Data\MembershipData;
use App\Modules\Organizations\Enums\ErrorCode as OrganizationError;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Qui rédige et envoie une diffusion de l'organisation courante : `owner`, `admin` et `manager` (ADR 0033, décision 10). Le comptable
 * en est exclu. Les mandants ne se diffusent que depuis une agence.
 */
final readonly class CampaignAccess
{
    public const array ROLES = [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager];

    public function __construct(
        private MembershipDirectory $adhesions,
        private CurrentOrganization $organisation,
    ) {}

    public function assertManager(User $user): MembershipData
    {
        $adhesion = $this->adhesions->activeMembership($user->id, $this->organisation->id()) ?? throw OrganizationError::RoleForbidden->problem();

        if (! in_array($adhesion->role, self::ROLES, true)) {
            throw OrganizationError::RoleForbidden->problem();
        }

        return $adhesion;
    }

    /**
     * Revérifie, au moment du départ, l'auteur d'un envoi programmé : membre actif, rôle autorisé, double authentification active.
     */
    public function assertSenderStillAllowed(string $userId): void
    {
        $adhesion = $this->adhesions->activeMembership($userId, $this->organisation->id());
        $compte = User::query()->find($userId);

        if ($adhesion === null || $compte === null || ! in_array($adhesion->role, self::ROLES, true) || ! $compte->hasConfirmedTwoFactor()) {
            throw ErrorCode::CampaignSenderNotAllowed->problem();
        }
    }

    public function allows(MembershipData $adhesion, CampaignAudience $audience): bool
    {
        return $audience !== CampaignAudience::Mandants || $adhesion->kind === OrganizationKind::Agency;
    }

    public function assertAudience(MembershipData $adhesion, CampaignAudience $audience): void
    {
        if (! $this->allows($adhesion, $audience)) {
            throw ErrorCode::CampaignAudienceUnavailable->problem();
        }
    }
}
