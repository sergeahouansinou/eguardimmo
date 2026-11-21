<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources\Tenant;

use App\Modules\Rent\Http\Support\ApiShapes;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\InstallmentLine;
use App\Modules\Rent\Support\InstallmentView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Jamais : fiche de partie ou de lot, empreinte, écriture comptable, motif d'annulation, état interne de la quittance.
 *
 * @property Installment $resource
 */
final class TenantInstallmentResource extends JsonResource
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
        $reste = $this->vue->outstanding[$e->id] ?? null;
        $avis = $e->relationLoaded('notice') ? $e->notice : null;
        $quittance = $e->relationLoaded('receipt') ? $e->receipt : null;

        return [
            'id' => $e->id,
            'lease' => ['id' => $e->lease_id, 'reference' => ($this->vue->leases[$e->lease_id] ?? null)?->reference],
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
            'notice' => $avis === null ? null : ['number' => $avis->number, 'issued_on' => $avis->issued_on->toDateString()],
            'receipt' => $quittance === null ? null : ['id' => $quittance->id, 'number' => $quittance->number, 'issued_on' => $quittance->issued_on->toDateString()],
            'lines' => $this->whenLoaded('lines', fn (): array => $e->lines->map(fn (InstallmentLine $l): array => [
                'label' => $l->label,
                'from' => $l->from_date->toDateString(),
                'to' => $l->to_date->toDateString(),
                'days' => $l->days,
                'month_days' => $l->month_days,
                'amount' => ApiShapes::money($l->amount),
                'vat_bp' => $l->vat_bp,
                'vat_amount' => ApiShapes::money($l->vat_amount),
            ])->values()->all()),
        ];
    }
}
