<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

use App\Modules\Documents\Enums\CertificateState;

final readonly class CertificateFilters
{
    public function __construct(
        public ?CertificateState $state = null,
        public ?DocumentSubject $subject = null,
        public ?string $certificateTypeTermId = null,
        public bool $includeReplaced = false,
        public ?string $expiresFrom = null,
        public ?string $expiresTo = null,
    ) {}
}
