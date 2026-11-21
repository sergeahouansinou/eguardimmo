<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Http\Support\Shapes;
use App\Modules\Maintenance\Models\InvoiceAllocation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property InvoiceAllocation $resource
 */
final class AllocationResource extends JsonResource
{
    public function __construct(InvoiceAllocation $imputation, private readonly ?bool $replayed = null)
    {
        parent::__construct($imputation);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $a = $this->resource;

        return [
            'id' => $a->id,
            'supplier_invoice_id' => $a->supplier_invoice_id,
            'target' => $a->target->value,
            'party_id' => $a->party_id,
            'lease_id' => $a->lease_id,
            'share_amount' => Shapes::money($a->share_amount),
            'wear_basis_points' => $a->wear_basis_points,
            'charged_amount' => Shapes::money($a->charged_amount),
            'basis_note' => $a->basis_note,
            'cancelled_at' => $a->cancelled_at?->toIso8601String(),
            'replayed' => $this->replayed,
        ];
    }
}
