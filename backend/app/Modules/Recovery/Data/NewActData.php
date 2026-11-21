<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Data;

use App\Modules\Recovery\Enums\ActType;

final readonly class NewActData
{
    /**
     * @param  string  $performedOn  Y-m-d
     */
    public function __construct(
        public ActType $type,
        public string $performedOn,
        public ?string $note = null,
        public ?string $reference = null,
    ) {}
}
