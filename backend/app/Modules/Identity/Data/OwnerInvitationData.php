<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Enums\OwnerInvitationStatus;
use Carbon\CarbonImmutable;

final readonly class OwnerInvitationData
{
    public function __construct(
        public string $id,
        public string $organizationId,
        public string $organizationName,
        public string $mandantPartyId,
        public ?string $personPartyId,
        public OwnerAccessRole $role,
        public string $emailHint,
        public OwnerInvitationStatus $status,
        public CarbonImmutable $expiresAt,
        public int $attemptsRemaining,
        public string $identityAttestedByUserId,
        public CarbonImmutable $identityAttestedAt,
        public ?CarbonImmutable $acceptedAt,
        public string $consentVersion,
    ) {}
}
