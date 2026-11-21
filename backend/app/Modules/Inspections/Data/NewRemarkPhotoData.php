<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Data;

use App\Modules\Documents\Data\FileSource;

final readonly class NewRemarkPhotoData
{
    public function __construct(
        public FileSource $source,
        public string $name,
    ) {}
}
