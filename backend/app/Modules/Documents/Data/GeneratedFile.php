<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

final readonly class GeneratedFile
{
    public function __construct(
        public string $name,
        public string $contents,
    ) {}
}
