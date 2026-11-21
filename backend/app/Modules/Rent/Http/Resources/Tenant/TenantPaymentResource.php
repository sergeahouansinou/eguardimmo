<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources\Tenant;

use App\Modules\Rent\Http\Support\ApiShapes;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Models\PaymentAllocation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Jamais : fiche de partie, référence bancaire, note, motif d'annulation, clé d'idempotence, empreinte, écriture comptable, auteur.
 *
 * @property Payment $resource
 */
final class TenantPaymentResource extends JsonResource
{
    /**
     * @param  array<string, string>  $references  référence du bail par identifiant de bail
     */
    public function __construct(Payment $paiement, private readonly array $references)
    {
        parent::__construct($paiement);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $p = $this->resource;

        return [
            'id' => $p->id,
            'lease' => ['id' => $p->lease_id, 'reference' => $this->references[$p->lease_id] ?? null],
            'status' => $p->status->value,
            'method' => $p->method->value,
            'amount' => ApiShapes::money($p->amount),
            'received_on' => $p->received_on->toDateString(),
            'cancelled_on' => $p->cancelled_on?->toDateString(),
            'allocations' => $p->relationLoaded('allocations') ? array_values($p->allocations->map(fn (PaymentAllocation $a): array => [
                'installment_id' => $a->installment_id,
                'amount' => ApiShapes::money($a->amount),
            ])->all()) : null,
        ];
    }
}
