<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class SignLeaseData
{
    /**
     * @param  string  $signedOn  Y-m-d
     */
    public function __construct(
        public string $signedOn,
        public ?string $signedFileId,
        public int $lockVersion,
    ) {}
}
