<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Http\Resources;

use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\MoneyPresenter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property JournalEntry $resource
 */
final class EntryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'reference' => $this->resource->reference(),
            'fiscal_year' => $this->resource->fiscal_year,
            'number' => $this->resource->number,
            'journal' => $this->resource->journal->value,
            'entry_date' => $this->resource->entry_date,
            'label' => $this->resource->label,
            'source' => ['type' => $this->resource->source_type->value, 'id' => $this->resource->source_id],
            'reversal_of_id' => $this->resource->reversal_of_id,
            'posted_at' => $this->resource->created_at->toIso8601String(),
            'lines_count' => $this->whenCounted('lines'),
            'lines' => $this->whenLoaded('lines', fn (): array => $this->resource->lines->map(fn (JournalLine $ligne): array => [
                'id' => $ligne->id,
                'position' => $ligne->position,
                'account' => ['id' => $ligne->account_id, 'code' => $ligne->account->code, 'role' => $ligne->account->role->value, 'label' => $ligne->account->label],
                'debit' => MoneyPresenter::present($ligne->debit),
                'credit' => MoneyPresenter::present($ligne->credit),
                'lease_id' => $ligne->lease_id,
                'party_id' => $ligne->party_id,
                'unit_id' => $ligne->unit_id,
                'item' => $ligne->item_type === null ? null : ['type' => $ligne->item_type->value, 'id' => $ligne->item_id],
            ])->values()->all()),
        ];
    }
}
