<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

final readonly class InstallmentNoticeData
{
    public function __construct(
        public string $installmentId,
        public string $number,
        public string $storedFileId,
        public string $fingerprint,
        public string $issuedOn,
    ) {}
}
