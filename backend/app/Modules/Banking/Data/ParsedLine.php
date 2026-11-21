<?php

declare(strict_types=1);

namespace App\Modules\Banking\Data;

use App\Modules\Banking\Enums\Direction;
use Carbon\CarbonImmutable;
use SensitiveParameter;

/**
 * Ligne lue dans un fichier, commune à tous les formats. Aucun IBAN n'est conservé : seul l'identifiant de contrepartie
 * transite jusqu'à son empreinte.
 */
final readonly class ParsedLine
{
    public function __construct(
        public int $number,
        public CarbonImmutable $bookingDate,
        public ?CarbonImmutable $valueDate,
        public Direction $direction,
        public int $amount,
        public string $currency,
        public ?int $originalAmount,
        public ?string $originalCurrency,
        public bool $reversal,
        public ?string $bankReference,
        public ?string $endToEndId,
        public ?string $transactionCode,
        public string $label,
        public ?string $remittanceReference,
        public ?string $counterpartyName,
        #[SensitiveParameter] public ?string $counterpartyIdentifier,
    ) {}
}
