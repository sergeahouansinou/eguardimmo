<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Resources;

use App\Modules\Invoicing\Http\Support\ApiShapes;
use App\Modules\Invoicing\Models\InvoicePayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property InvoicePayment $resource
 */
final class InvoicePaymentResource extends JsonResource
{
    public function __construct(InvoicePayment $reglement, private readonly ?bool $replayed = null)
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
            'invoice_id' => $p->invoice_id,
            'amount' => ApiShapes::money($p->amount),
            'method' => $p->method->value,
            'paid_on' => $p->paid_on->toDateString(),
            'reference' => $p->reference,
            'cancelled_at' => $p->cancelled_at?->toIso8601String(),
            'recorded_at' => $p->created_at?->toIso8601String(),
            'replayed' => $this->replayed,
        ];
    }
}
