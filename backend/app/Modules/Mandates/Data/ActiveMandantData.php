<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class ActiveMandantData
{
    public function __construct(
        public string $partyId,
        public string $mandateId,
        public string $mandateReference,
    ) {}
}
