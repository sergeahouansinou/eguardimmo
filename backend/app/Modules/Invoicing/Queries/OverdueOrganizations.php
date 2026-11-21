<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Queries;

use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Models\Invoice;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

final readonly class OverdueOrganizations
{
    /**
     * Organisations qui ont au moins une facture échue, ouverte et pas encore signalée.
     *
     * @return list<string>
     */
    public function at(CarbonImmutable $today): array
    {
        return array_values(array_map(strval(...), AcrossOrganizations::query(Invoice::class)
            ->where('kind', InvoiceKind::Invoice->value)
            ->whereIn('status', array_map(fn (InvoiceStatus $s): string => $s->value, InvoiceStatus::open()))
            ->where('due_on', '<', $today->toDateString())
            ->whereNull('overdue_flagged_at')
            ->distinct()
            ->orderBy('organization_id')
            ->pluck('organization_id')
            ->all()));
    }
}
