<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

use App\Modules\Documents\Enums\IssuedDocumentType;
use Carbon\CarbonImmutable;

final readonly class IssuedDocumentData
{
    /**
     * @param  array<string, mixed>  $snapshot
     */
    public function __construct(
        public string $id,
        public IssuedDocumentType $type,
        public int $sequence,
        public string $number,
        public array $snapshot,
        public string $templateVersion,
        public string $fingerprint,
        public StoredFileData $file,
        public ?DocumentSubject $subject,
        public CarbonImmutable $issuedAt,
    ) {}
}
