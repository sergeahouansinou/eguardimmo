<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use App\Modules\Identity\Enums\TenantInvitationStatus;
use Carbon\CarbonImmutable;

final readonly class TenantInvitationData
{
    public function __construct(
        public string $id,
        public string $organizationId,
        public string $organizationName,
        public string $partyId,
        public string $emailHint,
        public TenantInvitationStatus $status,
        public CarbonImmutable $expiresAt,
        public ?CarbonImmutable $acceptedAt,
    ) {}
}
