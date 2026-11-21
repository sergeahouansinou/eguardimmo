<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources;

use App\Modules\Rent\Http\Support\ApiShapes;
use App\Modules\Rent\Models\RentReceipt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Tout ce que la quittance affiche vient de son instantané, jamais d'une fiche (ADR 0022).
 *
 * @property RentReceipt $resource
 */
final class ReceiptResource extends JsonResource
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

        return [
            'id' => $q->id,
            'number' => $q->number,
            'lease' => $s['lease'] ?? ['id' => $q->lease_id],
            'installment_id' => $q->installment_id,
            'tenants' => array_column(is_array($s['tenants'] ?? null) ? $s['tenants'] : [], 'name'),
            'unit' => $s['unit'] ?? null,
            'period' => $s['period'] ?? null,
            'amounts' => [
                'rent' => ApiShapes::money($q->rent_amount),
                'charges' => ApiShapes::money($q->charges_amount),
                'vat' => ApiShapes::money($q->vat_amount),
                'total' => ApiShapes::money($q->total_amount),
            ],
            'issued_on' => $q->issued_on->toDateString(),
            'fingerprint' => $q->fingerprint,
            'is_void' => $q->voided_at !== null,
            'voided_at' => $q->voided_at?->toIso8601String(),
            'void_reason' => $q->void_reason,
            'snapshot' => $this->detail ? $s : null,
        ];
    }
}
