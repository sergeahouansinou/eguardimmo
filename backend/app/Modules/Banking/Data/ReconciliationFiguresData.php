<?php

declare(strict_types=1);

namespace App\Modules\Banking\Data;

/**
 * Chiffres d'un état de rapprochement en unités mineures (signés : crédit du relevé et débit du compte de banque positifs).
 */
final readonly class ReconciliationFiguresData
{
    /**
     * @param  array<string, mixed>  $items
     * @param  list<StatementGapData>  $gaps
     */
    public function __construct(
        public string $source,
        public int $bankBalance,
        public int $bookBalance,
        public int $unmatchedLines,
        public int $unmatchedEntries,
        public int $ignored,
        public int $timing,
        public int $unexplained,
        public array $items,
        public array $gaps,
        public string $freshness,
    ) {}
}
