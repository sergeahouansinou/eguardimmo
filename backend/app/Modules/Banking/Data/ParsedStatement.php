<?php

declare(strict_types=1);

namespace App\Modules\Banking\Data;

use App\Modules\Banking\Enums\StatementSource;
use Carbon\CarbonImmutable;
use SensitiveParameter;

/**
 * Relevé lu dans un fichier. `rejected` liste les lignes refusées par leur numéro et un code, jamais leur contenu.
 */
final readonly class ParsedStatement
{
    /**
     * @param  list<ParsedLine>  $lines
     * @param  list<array{line: int, code: string}>  $rejected
     */
    public function __construct(
        public StatementSource $source,
        public ?string $formatVersion,
        public ?string $reference,
        public ?string $sequence,
        public CarbonImmutable $periodFrom,
        public CarbonImmutable $periodTo,
        public ?int $openingBalance,
        public ?int $closingBalance,
        public ?string $currency,
        public bool $isCopy,
        #[SensitiveParameter] public ?string $accountIdentifier,
        public array $lines,
        public array $rejected,
    ) {}
}
