<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use App\Modules\Parties\Enums\PartyKind;

final readonly class PartyFilters
{
    public function __construct(
        public ?string $search = null,
        public ?string $categoryId = null,
        public ?PartyKind $kind = null,
        public string $status = 'active',
    ) {}
}
