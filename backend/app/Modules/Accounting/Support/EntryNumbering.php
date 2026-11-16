<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Support;

use App\Shared\Database\ContinuousCounter;

final readonly class EntryNumbering
{
    public function __construct(private ContinuousCounter $compteur) {}

    /**
     * Continu par organisation et par exercice ; à appeler dans la transaction qui écrit l'écriture, pour que l'annulation libère le numéro.
     */
    public function next(string $organizationId, int $fiscalYear): int
    {
        return $this->compteur->next('journal_entry_counters', ['organization_id' => $organizationId, 'fiscal_year' => $fiscalYear]);
    }
}
