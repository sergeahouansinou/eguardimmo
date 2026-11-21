<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Resources;

use App\Modules\Banking\Models\BankRule;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property BankRule $resource
 */
final class BankRuleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;

        return [
            'id' => $r->id,
            'name' => $r->name,
            'label_contains' => $r->label_contains,
            'has_counterparty' => $r->counterparty_hash !== null,
            'transaction_code' => $r->transaction_code,
            'amount_min' => $r->amount_min,
            'amount_max' => $r->amount_max,
            'direction' => $r->direction?->value,
            'action' => $r->action->value,
            'target_lease_id' => $r->target_lease_id,
            'ignore_reason' => $r->ignore_reason?->value,
            'confidence' => $r->confidence->value,
            'position' => $r->position,
            'active' => $r->active,
            'lock_version' => $r->lock_version,
        ];
    }
}
