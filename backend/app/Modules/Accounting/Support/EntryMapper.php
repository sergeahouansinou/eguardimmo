<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Support;

use App\Modules\Accounting\Data\PostedEntryData;
use App\Modules\Accounting\Data\PostedLineData;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Models\JournalLine;
use Carbon\CarbonImmutable;

final class EntryMapper
{
    public function map(JournalEntry $entree, bool $replayed): PostedEntryData
    {
        return new PostedEntryData(
            id: $entree->id,
            fiscalYear: $entree->fiscal_year,
            number: $entree->number,
            journal: $entree->journal,
            date: CarbonImmutable::parse($entree->entry_date),
            label: $entree->label,
            sourceType: $entree->source_type,
            sourceId: $entree->source_id,
            idempotencyKey: $entree->idempotency_key,
            reversalOfId: $entree->reversal_of_id,
            lines: array_values($entree->lines->map(fn (JournalLine $ligne): PostedLineData => new PostedLineData(
                id: $ligne->id,
                account: $ligne->account->role,
                accountCode: $ligne->account->code,
                debit: $ligne->debit,
                credit: $ligne->credit,
                leaseId: $ligne->lease_id,
                partyId: $ligne->party_id,
                unitId: $ligne->unit_id,
                itemType: $ligne->item_type,
                itemId: $ligne->item_id,
            ))->all()),
            replayed: $replayed,
        );
    }
}
