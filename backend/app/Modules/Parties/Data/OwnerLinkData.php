<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use App\Modules\Identity\Enums\OwnerAccessRole;
use Carbon\CarbonImmutable;

/**
 * Accès vivant d'un compte à un mandant : la clé (organisation, mandant) de l'espace propriétaire (ADR 0032).
 */
final readonly class OwnerLinkData
{
    public function __construct(
        public string $accessId,
        public string $organizationId,
        public string $mandantPartyId,
        public string $mandantName,
        public OwnerAccessRole $role,
        public ?string $personPartyId,
        public CarbonImmutable $linkedAt,
    ) {}
}
