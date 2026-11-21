<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources;

use App\Modules\Rent\Enums\ReceiptState;
use App\Modules\Rent\Http\Support\ApiShapes;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\InstallmentLine;
use App\Modules\Rent\Support\InstallmentView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property Installment $resource
 */
final class InstallmentResource extends JsonResource
{
    public function __construct(Installment $echeance, private readonly InstallmentView $vue)
    {
        parent::__construct($echeance);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $e = $this->resource;
        $bail = $this->vue->leases[$e->lease_id] ?? null;
        $reste = $this->vue->outstanding[$e->id] ?? null;
        $avis = $e->relationLoaded('notice') ? $e->notice : null;
        $quittance = $e->relationLoaded('receipt') ? $e->receipt : null;

        return [
            'id' => $e->id,
            'lease' => ['id' => $e->lease_id, 'reference' => $bail?->reference],
            'party_id' => $e->party_id,
            'unit_id' => $e->unit_id,
            'period' => ['start' => $e->period_start->toDateString(), 'end' => $e->period_end->toDateString()],
            'due_date' => $e->due_date->toDateString(),
            'status' => $e->status->value,
            'is_overdue' => $e->status->isOpen() && $e->due_date->toDateString() < $this->vue->today->toDateString(),
            'amounts' => [
                'rent' => ApiShapes::money($e->rent_amount),
                'charges' => ApiShapes::money($e->charges_amount),
                'vat' => ApiShapes::money($e->vat_amount),
                'total' => ApiShapes::money($e->total_amount),
            ],
            'outstanding' => $reste === null ? null : ApiShapes::money($reste),
            'issued_on' => $e->issued_on?->toDateString(),
            'cancelled_on' => $e->cancelled_on?->toDateString(),
            'cancellation_reason' => $e->cancellation_reason,
            'notice' => $avis === null ? null : [
                'id' => $avis->id,
                'number' => $avis->number,
                'issued_on' => $avis->issued_on->toDateString(),
                'fingerprint' => $avis->fingerprint,
            ],
            'receipt' => $quittance === null ? null : [
                'id' => $quittance->id,
                'number' => $quittance->number,
                'issued_on' => $quittance->issued_on->toDateString(),
            ],
            'receipt_state' => ($this->vue->receiptStates[$e->id] ?? ReceiptState::NotDue)->value,
            'lines' => $this->whenLoaded('lines', fn (): array => $e->lines->map(fn (InstallmentLine $l): array => [
                'id' => $l->id,
                'label' => $l->label,
                'component_key' => $l->component_key,
                'semantic' => $l->semantic,
                'from' => $l->from_date->toDateString(),
                'to' => $l->to_date->toDateString(),
                'days' => $l->days,
                'month_days' => $l->month_days,
                'monthly_amount' => ApiShapes::money($l->monthly_amount),
                'amount' => ApiShapes::money($l->amount),
                'vat_bp' => $l->vat_bp,
                'vat_amount' => ApiShapes::money($l->vat_amount),
            ])->values()->all()),
        ];
    }
}
