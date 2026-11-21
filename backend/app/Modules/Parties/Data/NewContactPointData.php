<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use App\Modules\Parties\Enums\ContactPointType;

final readonly class NewContactPointData
{
    public function __construct(
        public ContactPointType $type,
        public string $value,
        public ?string $label,
        public bool $primary,
    ) {}
}
