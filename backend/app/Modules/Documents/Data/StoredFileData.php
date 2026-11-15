<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

use App\Modules\Documents\Enums\FileCategory;
use Carbon\CarbonImmutable;

final readonly class StoredFileData
{
    public function __construct(
        public string $id,
        public string $displayName,
        public string $mimeType,
        public int $sizeBytes,
        public string $sha256,
        public FileCategory $category,
        public ?DocumentSubject $subject,
        public ?CarbonImmutable $retentionUntil,
        public CarbonImmutable $createdAt,
    ) {}
}
