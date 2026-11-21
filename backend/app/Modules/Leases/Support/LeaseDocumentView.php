<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Documents\Data\StoredFileData;
use Carbon\CarbonInterface;

final readonly class LeaseDocumentView
{
    public const string SIGNED_LEASE = 'signed_lease';

    public function __construct(
        public string $id,
        public string $kind,
        public ?CarbonInterface $sharedAt,
        public ?StoredFileData $file,
    ) {}
}
