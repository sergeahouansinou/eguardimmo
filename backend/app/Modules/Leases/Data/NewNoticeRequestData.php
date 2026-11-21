<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Documents\Data\FileSource;
use Carbon\CarbonImmutable;

final readonly class NewNoticeRequestData
{
    public function __construct(
        public string $reasonKey,
        public CarbonImmutable $requestedDepartureOn,
        public ?string $forwardingAddress,
        public string $consentVersion,
        public string $clientId,
        public ?FileSource $proof,
        public ?string $proofName,
    ) {}
}
