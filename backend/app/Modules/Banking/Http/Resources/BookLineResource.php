<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Resources;

use App\Modules\Accounting\Data\BankBookLineData;
use App\Modules\Banking\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ligne d'écriture `Bank` ou `TrustBank` non pointée, telle que lue au grand livre.
 *
 * @property BankBookLineData $resource
 */
final class BookLineResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;

        return [
            'line_id' => $r->lineId,
            'entry_id' => $r->entryId,
            'entry_reference' => $r->entryReference,
            'entry_date' => $r->entryDate,
            'entry_label' => $r->entryLabel,
            'journal' => $r->journal->value,
            'side' => $r->side->value,
            'amount' => MoneyShape::of($r->amount),
            'source_type' => $r->sourceType->value,
            'source_id' => $r->sourceId,
            'is_reversal' => $r->isReversal,
            'is_reversed' => $r->isReversed,
        ];
    }
}
