<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\OrganizationKind;

final readonly class NewOrganizationData
{
    public function __construct(
        public OrganizationKind $kind,
        public string $name,
        public string $country,
    ) {}
}
