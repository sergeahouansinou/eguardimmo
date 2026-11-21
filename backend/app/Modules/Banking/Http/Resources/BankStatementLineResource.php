<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Resources;

use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ni l'empreinte ni la clé de dédoublonnage de la contrepartie ne sortent. `suggestion` est la meilleure proposition vivante.
 *
 * @property BankStatementLine $resource
 */
final class BankStatementLineResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;
        $suggestion = $r->getAttribute('best_suggestion');

        return [
            'id' => $r->id,
            'statement_id' => $r->statement_id,
            'bank_account_id' => $r->bank_account_id,
            'booking_date' => $r->booking_date->toDateString(),
            'value_date' => $r->value_date?->toDateString(),
            'direction' => $r->direction->value,
            'amount' => MoneyShape::of($r->amount),
            'signed_amount' => MoneyShape::minor($r->direction->sign() * (int) $r->amount->getAmount(), $r->currency),
            'original_amount' => $r->original_amount === null ? null : MoneyShape::of($r->original_amount),
            'reversal' => $r->reversal,
            'bank_reference' => $r->bank_reference,
            'end_to_end_id' => $r->end_to_end_id,
            'transaction_code' => $r->transaction_code,
            'label' => $r->label,
            'remittance_reference' => $r->remittance_reference,
            'counterparty_name' => $r->counterparty_name,
            'counterparty_last4' => $r->counterparty_last4,
            'state' => $r->state->value,
            'ignore_reason' => $r->ignore_reason?->value,
            'lock_version' => $r->lock_version,
            'match_id' => $r->getAttribute('active_match_id'),
            'suggestion' => $suggestion === null ? null : new BankSuggestionResource($suggestion),
        ];
    }
}
