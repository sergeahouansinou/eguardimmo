<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;

final readonly class ScopedMemberData
{
    public function __construct(
        public string $organizationId,
        public string $memberId,
        public MemberRole $role,
        public MemberStatus $status,
        public int $propertyCount,
    ) {}
}
