<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use App\Modules\Identity\Enums\OwnerAccessRole;

final readonly class LinkedOwnerData
{
    public function __construct(
        public string $accessId,
        public string $organizationId,
        public string $organizationName,
        public OwnerAccessRole $role,
    ) {}
}
