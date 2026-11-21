<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Resources\Owner;

use App\Modules\Invoicing\Http\Support\ApiShapes;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Invoicing\Models\InvoiceTax;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Facture d'honoraires telle que le mandant la reçoit. Jamais le bail, le reste dû, l'empreinte, le gabarit, la clé d'idempotence,
 * l'auteur de l'émission, l'envoi ni le motif d'un avoir : le reste dû se lit au compte du mandant, pas ici.
 *
 * @property array{invoice: Invoice, agency_name: string|null, detail: bool} $resource
 */
final class OwnerInvoiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $f = $this->resource['invoice'];

        $donnees = [
            'id' => $f->id,
            'kind' => $f->kind->value,
            'status' => $f->status->value,
            'number' => $f->number,
            'agency' => ['id' => $f->organization_id, 'name' => $this->resource['agency_name']],
            'mandate_id' => $f->mandate_id,
            'credited_invoice_id' => $f->credited_invoice_id,
            'issued_on' => $f->issued_on?->toDateString(),
            'due_on' => $f->due_on?->toDateString(),
            'service_from' => $f->service_from?->toDateString(),
            'service_to' => $f->service_to?->toDateString(),
            'currency' => $f->currency,
            'total_net' => ApiShapes::money($f->total_net),
            'total_tax' => ApiShapes::money($f->total_tax),
            'total_gross' => ApiShapes::money($f->total_gross),
            'has_pdf' => $f->stored_file_id !== null,
        ];

        if (! $this->resource['detail']) {
            return $donnees;
        }

        return [
            ...$donnees,
            'lines' => array_values($f->lines->map(fn (InvoiceLine $l): array => [
                'position' => $l->position,
                'description' => $l->description,
                'quantity_milli' => $l->quantity_milli,
                'unit_price' => ['amount' => $l->unit_price, 'currency' => $f->currency],
                'net_amount' => ['amount' => $l->net_amount, 'currency' => $f->currency],
                'tax_category' => $l->tax_category->value,
                'tax_rate_pcm' => $l->tax_rate_pcm,
            ])->all()),
            'taxes' => array_values($f->taxes->map(fn (InvoiceTax $t): array => [
                'category' => $t->category->value,
                'rate_pcm' => $t->rate_pcm,
                'base_amount' => ['amount' => $t->base_amount, 'currency' => $f->currency],
                'tax_amount' => ['amount' => $t->tax_amount, 'currency' => $f->currency],
            ])->all()),
        ];
    }
}
