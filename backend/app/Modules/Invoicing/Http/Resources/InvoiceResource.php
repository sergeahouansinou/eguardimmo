<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Resources;

use App\Modules\Invoicing\Http\Support\ApiShapes;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Invoicing\Models\InvoicePayment;
use App\Modules\Invoicing\Models\InvoiceTax;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Money\Money;

/**
 * @property Invoice $resource
 */
final class InvoiceResource extends JsonResource
{
    public function __construct(Invoice $facture, private readonly ?Money $outstanding = null, private readonly ?bool $replayed = null)
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
            'kind' => $f->kind->value,
            'status' => $f->status->value,
            'number' => $f->number,
            'credited_invoice_id' => $f->credited_invoice_id,
            'issued_on' => $f->issued_on?->toDateString(),
            'due_on' => $f->due_on?->toDateString(),
            'service_from' => $f->service_from?->toDateString(),
            'service_to' => $f->service_to?->toDateString(),
            'recipient_party_id' => $f->recipient_party_id,
            'lease_id' => $f->lease_id,
            'mandate_id' => $f->mandate_id,
            'currency' => $f->currency,
            'total_net' => ApiShapes::money($f->total_net),
            'total_tax' => ApiShapes::money($f->total_tax),
            'total_gross' => ApiShapes::money($f->total_gross),
            'outstanding' => $this->outstanding === null ? null : ApiShapes::money($this->outstanding),
            'credit_reason' => $f->credit_reason,
            'lock_version' => $f->lock_version,
            'overdue_flagged_at' => $f->overdue_flagged_at?->toIso8601String(),
            'sent_at' => $f->sent_at?->toIso8601String(),
            'created_at' => $f->created_at?->toIso8601String(),
            'lines' => $f->relationLoaded('lines') ? array_values($f->lines->map(fn (InvoiceLine $l): array => [
                'id' => $l->id,
                'position' => $l->position,
                'item_term_id' => $l->item_term_id,
                'description' => $l->description,
                'quantity_milli' => $l->quantity_milli,
                'unit_price' => $l->unit_price,
                'net_amount' => $l->net_amount,
                'tax_category' => $l->tax_category->value,
                'tax_rate_pcm' => $l->tax_rate_pcm,
                'credited_line_id' => $l->credited_line_id,
            ])->all()) : null,
            'taxes' => $f->relationLoaded('taxes') ? array_values($f->taxes->map(fn (InvoiceTax $t): array => [
                'tax_code' => $t->tax_code->value,
                'category' => $t->category->value,
                'rate_pcm' => $t->rate_pcm,
                'base_amount' => $t->base_amount,
                'tax_amount' => $t->tax_amount,
            ])->all()) : null,
            'payments' => $f->relationLoaded('payments') ? array_values($f->payments->map(fn (InvoicePayment $p): array => (new InvoicePaymentResource($p))->toArray($request))->all()) : null,
            'replayed' => $this->replayed,
        ];
    }
}
