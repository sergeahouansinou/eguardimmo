<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use App\Modules\Parties\Enums\IdentifierScheme;

final readonly class NewIdentifierData
{
    public function __construct(
        public IdentifierScheme $scheme,
        public string $country,
        public string $value,
    ) {}
}
