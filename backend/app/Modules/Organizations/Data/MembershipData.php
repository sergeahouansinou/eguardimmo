<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;

final readonly class MembershipData
{
    public function __construct(
        public string $organizationId,
        public string $organizationName,
        public OrganizationKind $kind,
        public string $memberId,
        public MemberRole $role,
    ) {}
}
