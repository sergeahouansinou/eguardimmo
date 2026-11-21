<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources;

use App\Modules\Rent\Enums\ReceiptState;
use App\Modules\Rent\Http\Support\ApiShapes;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Models\PaymentAllocation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Money\Money;

/**
 * @property Payment $resource
 */
final class PaymentResource extends JsonResource
{
    /**
     * @param  array<string, ReceiptState>  $receipts  sort de la quittance par échéance soldée, à l'enregistrement
     */
    public function __construct(Payment $paiement, private readonly array $receipts = [], private readonly ?bool $replayed = null)
    {
        parent::__construct($paiement);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $p = $this->resource;
        $imputations = $p->relationLoaded('allocations') ? $p->allocations->filter(fn (PaymentAllocation $a): bool => $a->reversed_at === null) : null;
        $reste = $imputations === null ? null : array_reduce($imputations->all(), fn (Money $reste, PaymentAllocation $a): Money => $reste->subtract($a->amount), $p->amount);

        return [
            'id' => $p->id,
            'lease_id' => $p->lease_id,
            'party_id' => $p->party_id,
            'status' => $p->status->value,
            'method' => $p->method->value,
            'amount' => ApiShapes::money($p->amount),
            'received_on' => $p->received_on->toDateString(),
            'reference' => $p->reference,
            'note' => $p->note,
            'cancelled_on' => $p->cancelled_on?->toDateString(),
            'cancellation_reason' => $p->cancellation_reason,
            'recorded_at' => $p->created_at?->toIso8601String(),
            'allocations' => $imputations === null ? null : array_values($imputations->map(fn (PaymentAllocation $a): array => [
                'installment_id' => $a->installment_id,
                'amount' => ApiShapes::money($a->amount),
            ])->all()),
            'advance' => $reste === null || $p->status->value === 'cancelled' ? null : ApiShapes::money($reste),
            'replayed' => $this->replayed,
            'receipts' => $this->receipts === [] ? null : array_map(fn (ReceiptState $e): string => $e->value, $this->receipts),
        ];
    }
}
