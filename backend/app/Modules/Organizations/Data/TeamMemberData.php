<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\MemberRole;

final readonly class TeamMemberData
{
    public function __construct(
        public string $userId,
        public string $firstName,
        public string $lastName,
        public MemberRole $role,
    ) {}
}
