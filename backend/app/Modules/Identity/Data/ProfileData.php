<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use App\Modules\Identity\Enums\Space;

final readonly class ProfileData
{
    /**
     * @param  array<string, scalar|null>  $meta
     */
    public function __construct(
        public Space $space,
        public string $label,
        public array $meta = [],
    ) {}
}
