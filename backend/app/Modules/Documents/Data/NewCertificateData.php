<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

use Carbon\CarbonImmutable;

final readonly class NewCertificateData
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        public DocumentSubject $subject,
        public string $certificateTypeTermId,
        public ?string $reference,
        public ?string $issuerPartyId,
        public CarbonImmutable $issuedOn,
        public ?CarbonImmutable $expiresOn,
        public array $data,
        public ?string $storedFileId,
    ) {}
}
