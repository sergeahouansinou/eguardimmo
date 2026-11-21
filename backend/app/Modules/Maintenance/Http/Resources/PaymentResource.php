<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Http\Support\Shapes;
use App\Modules\Maintenance\Models\SupplierPayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property SupplierPayment $resource
 */
final class PaymentResource extends JsonResource
{
    public function __construct(SupplierPayment $reglement, private readonly ?bool $replayed = null)
    {
        parent::__construct($reglement);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $p = $this->resource;

        return [
            'id' => $p->id,
            'supplier_invoice_id' => $p->supplier_invoice_id,
            'amount' => Shapes::money($p->amount),
            'method' => $p->method->value,
            'paid_on' => $p->paid_on->toDateString(),
            'reference' => $p->reference,
            'cancelled_at' => $p->cancelled_at?->toIso8601String(),
            'replayed' => $this->replayed,
        ];
    }
}
