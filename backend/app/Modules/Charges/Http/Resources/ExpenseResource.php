<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Resources;

use App\Modules\Charges\Http\Support\Shapes;
use App\Modules\Charges\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property Expense $resource
 */
final class ExpenseResource extends JsonResource
{
    public static $wrap = 'data';

    /**
     * @param  list<string>  $files
     */
    public function __construct(Expense $depense, private readonly array $files = [])
    {
        parent::__construct($depense);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $d = $this->resource;

        return [
            'id' => $d->id,
            'property_id' => $d->property_id,
            'unit_id' => $d->unit_id,
            'kind' => $d->kind->value,
            'category_term_id' => $d->category_term_id,
            'payee_party_id' => $d->payee_party_id,
            'payee_label' => $d->payee_label,
            'reference' => $d->reference,
            'document_on' => $d->document_on->toDateString(),
            'service_from' => $d->service_from->toDateString(),
            'service_to' => $d->service_to->toDateString(),
            'total_gross' => Shapes::money($d->total_gross),
            'tax_amount' => Shapes::money($d->tax_amount),
            'recoverable_amount' => Shapes::money($d->recoverable_amount),
            'recoverable_rubric' => $d->recoverable_rubric,
            'settlement' => $d->settlement->value,
            'paid_on' => $d->paid_on?->toDateString(),
            'mandate_id' => $d->mandate_id,
            'mandant_party_id' => $d->mandant_party_id,
            'status' => $d->status->value,
            'cancel_reason' => $d->cancel_reason,
            'posted' => $d->ledger_entry_id !== null,
            'files' => $this->files === [] && $d->stored_file_id !== null ? [$d->stored_file_id] : $this->files,
            'lock_version' => $d->lock_version,
            'created_at' => $d->created_at?->toIso8601String(),
        ];
    }
}
