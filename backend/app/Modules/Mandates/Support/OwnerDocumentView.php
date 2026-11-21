<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Support;

use App\Modules\Documents\Data\StoredFileData;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\Models\MandateDocument;

final readonly class OwnerDocumentView
{
    public function __construct(
        public MandateDocument $document,
        public ?StoredFileData $file,
        public ?string $mandateReference,
        public ?string $agencyName,
        public ?OwnerVisibleData $visible,
    ) {}
}
