<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

use App\Modules\Documents\Enums\IssuedDocumentType;
use Carbon\CarbonInterface;

final readonly class NewIssuedDocumentData
{
    /**
     * @param  array<string, mixed>  $snapshot  émetteur, destinataire, adresses, lignes, montants, références : figé à l'émission
     */
    public function __construct(
        public IssuedDocumentType $type,
        public array $snapshot,
        public string $templateVersion,
        public FileSource $pdf,
        public string $displayName,
        public ?DocumentSubject $subject = null,
        public ?CarbonInterface $retentionUntil = null,
    ) {}
}
