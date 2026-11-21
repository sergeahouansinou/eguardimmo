<?php

declare(strict_types=1);

namespace App\Modules\Banking\Data;

use Carbon\CarbonInterface;

/**
 * Trou de continuité : le solde d'ouverture d'un relevé ne reprend pas le solde de clôture du relevé précédent.
 */
final readonly class StatementGapData
{
    public function __construct(
        public string $previousStatementId,
        public string $statementId,
        public CarbonInterface $periodFrom,
        public int $expectedOpening,
        public int $actualOpening,
    ) {}
}
