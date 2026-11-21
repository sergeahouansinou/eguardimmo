<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class ActivateMandateData
{
    public function __construct(
        public int $lockVersion,
        public string $signedOn,
        public ?string $signedFileId,
    ) {}
}
