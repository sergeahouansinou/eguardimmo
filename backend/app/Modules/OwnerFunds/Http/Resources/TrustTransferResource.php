<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Resources;

use App\Modules\OwnerFunds\Models\TrustTransfer;
use App\Modules\OwnerFunds\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property TrustTransfer $resource
 */
final class TrustTransferResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $t = $this->resource;

        return [
            'id' => $t->id,
            'direction' => $t->direction->value,
            'amount' => MoneyShape::of($t->amount),
            'executed_on' => $t->executed_on->toDateString(),
            'bank_reference' => $t->bank_reference,
            'ledger_entry_id' => $t->ledger_entry_id,
        ];
    }
}
