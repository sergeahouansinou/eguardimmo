<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Resources;

use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Jamais l'IBAN : seuls l'identifiant du compte de paiement et ses quatre derniers caractères.
 *
 * @property PayoutItem $resource
 */
final class PayoutItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $e = $this->resource;

        return [
            'id' => $e->id,
            'batch_id' => $e->batch_id,
            'mandant_party_id' => $e->mandant_party_id,
            'status' => $e->status->value,
            'exclusion_reason' => $e->exclusion_reason?->value,
            'net_amount' => MoneyShape::of($e->net_amount),
            'fees_settled_amount' => MoneyShape::of($e->fees_settled_amount),
            'bank_account_id' => $e->bank_account_id,
            'bank_last4' => $e->bank_last4,
            'executed_on' => $e->executed_on?->toDateString(),
            'bank_reference' => $e->bank_reference,
            'executed_solo' => $e->executed_solo,
            'failure_reason' => $e->failure_reason,
            'lock_version' => $e->lock_version,
        ];
    }
}
