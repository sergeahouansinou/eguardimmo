<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources\Tenant;

use App\Modules\Rent\Http\Support\ApiShapes;
use App\Modules\Rent\Models\RentReceipt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Tout vient de l'instantané (ADR 0022), trié : jamais d'identifiant de fiche, d'empreinte ni de motif d'annulation.
 *
 * @property RentReceipt $resource
 */
final class TenantReceiptResource extends JsonResource
{
    public function __construct(RentReceipt $quittance, private readonly bool $detail = false)
    {
        parent::__construct($quittance);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $q = $this->resource;
        $s = $q->snapshot;
        $bail = is_array($s['lease'] ?? null) ? $s['lease'] : [];
        $lot = is_array($s['unit'] ?? null) ? $s['unit'] : null;

        return [
            'id' => $q->id,
            'number' => $q->number,
            'lease' => ['id' => $q->lease_id, 'reference' => $bail['reference'] ?? null],
            'installment_id' => $q->installment_id,
            'issuer' => $this->detail ? ($s['issuer']['name'] ?? null) : null,
            'tenants' => array_column(is_array($s['tenants'] ?? null) ? $s['tenants'] : [], 'name'),
            'unit' => $lot === null ? null : ['reference' => $lot['reference'] ?? null, 'property_name' => $lot['property_name'] ?? null, 'address' => $lot['address'] ?? null],
            'period' => is_array($s['period'] ?? null) ? ['start' => $s['period']['start'] ?? null, 'end' => $s['period']['end'] ?? null] : null,
            'amounts' => [
                'rent' => ApiShapes::money($q->rent_amount),
                'charges' => ApiShapes::money($q->charges_amount),
                'vat' => ApiShapes::money($q->vat_amount),
                'total' => ApiShapes::money($q->total_amount),
            ],
            'issued_on' => $q->issued_on->toDateString(),
            'is_void' => $q->voided_at !== null,
            'voided_at' => $q->voided_at?->toIso8601String(),
            'paid_on' => $this->detail ? ($s['paid_on'] ?? null) : null,
        ];
    }
}
