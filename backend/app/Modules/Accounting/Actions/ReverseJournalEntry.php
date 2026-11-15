<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Actions;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Data\PostedEntryData;
use App\Modules\Accounting\Enums\ErrorCode;
use App\Modules\Accounting\Enums\Side;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\EntryMapper;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ReverseJournalEntry
{
    public function __construct(
        private PostJournalEntry $ecriture,
        private EntryMapper $mapper,
    ) {}

    public function handle(string $entryId, CarbonImmutable $date): PostedEntryData
    {
        return DB::transaction(function () use ($entryId, $date): PostedEntryData {
            $originale = JournalEntry::query()->with('lines.account')->lockForUpdate()->find($entryId)
                ?? throw ErrorCode::EntryNotFound->problem();

            if ($originale->reversal_of_id !== null) {
                throw ErrorCode::EntryIsReversal->problem();
            }

            $existante = JournalEntry::query()->with('lines.account')->where('reversal_of_id', $originale->id)->first();

            if ($existante !== null) {
                if ($existante->entry_date !== $date->format('Y-m-d')) {
                    throw ErrorCode::EntryAlreadyReversed->problem();
                }

                return $this->mapper->map($existante, replayed: true);
            }

            return $this->ecriture->handle(new EntryData(
                journal: $originale->journal,
                date: $date,
                label: mb_substr("Contre-passation de l'écriture {$originale->reference()} : {$originale->label}", 0, 255),
                sourceType: SourceType::JournalEntry,
                sourceId: $originale->id,
                idempotencyKey: 'reversal:'.$originale->id,
                lines: array_values($originale->lines->map(fn (JournalLine $ligne): LineData => $this->inverse($ligne))->all()),
            ), reversalOfId: $originale->id);
        });
    }

    private function inverse(JournalLine $ligne): LineData
    {
        $aDebite = $ligne->debit->isPositive();

        return new LineData(
            account: $ligne->account->role,
            side: ($aDebite ? Side::Debit : Side::Credit)->opposite(),
            amount: $aDebite ? $ligne->debit : $ligne->credit,
            leaseId: $ligne->lease_id,
            partyId: $ligne->party_id,
            unitId: $ligne->unit_id,
            itemType: $ligne->item_type,
            itemId: $ligne->item_id,
        );
    }
}
