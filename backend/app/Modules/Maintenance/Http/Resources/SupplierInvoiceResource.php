<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Http\Support\Shapes;
use App\Modules\Maintenance\Models\SupplierInvoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property SupplierInvoice $resource
 */
final class SupplierInvoiceResource extends JsonResource
{
    public function __construct(SupplierInvoice $facture, private readonly ?bool $replayed = null)
    {
        parent::__construct($facture);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $f = $this->resource;

        return [
            'id' => $f->id,
            'intervention_id' => $f->intervention_id,
            'supplier_party_id' => $f->supplier_party_id,
            'billed_party_id' => $f->billed_party_id,
            'number' => $f->number,
            'invoice_on' => $f->invoice_on->toDateString(),
            'due_on' => $f->due_on?->toDateString(),
            'total_net' => Shapes::money($f->total_net),
            'total_tax' => Shapes::money($f->total_tax),
            'total_gross' => Shapes::money($f->total_gross),
            'status' => $f->status->value,
            'exceeds_approved_amount' => $f->exceeds_approved_amount,
            'taxes' => $f->relationLoaded('taxes') ? $f->taxes->map(fn ($t): array => [
                'category' => $t->category->value,
                'rate_pcm' => $t->rate_pcm,
                'base_amount' => $t->base_amount,
                'tax_amount' => $t->tax_amount,
            ])->values()->all() : null,
            'allocations' => $f->relationLoaded('allocations') ? $f->allocations->map(fn ($a): array => (new AllocationResource($a))->toArray($request))->values()->all() : null,
            'payments' => $f->relationLoaded('payments') ? $f->payments->map(fn ($p): array => (new PaymentResource($p))->toArray($request))->values()->all() : null,
            'lock_version' => $f->lock_version,
            'replayed' => $this->replayed,
        ];
    }
}
