<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

use App\Modules\Documents\Enums\LibraryKind;

final readonly class LibraryFilters
{
    public function __construct(
        public ?LibraryKind $kind = null,
        public ?DocumentSubject $subject = null,
        public bool $archived = false,
    ) {}
}
