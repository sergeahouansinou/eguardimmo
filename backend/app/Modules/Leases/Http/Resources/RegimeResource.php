<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Data\RegimeData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property RegimeData $resource
 */
final class RegimeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $regime = $this->resource;
        $defauts = $regime->defaults;

        return [
            'key' => $regime->key,
            'label' => $regime->label,
            'jurisdiction' => $regime->jurisdiction,
            'currency' => $regime->currency,
            'defaults' => [
                'duration_months' => $defauts->defaultDurationMonths,
                'minimum_duration_months' => $defauts->minimumDurationMonths,
                'maximum_duration_months' => $defauts->maximumDurationMonths,
                'tacit_renewal' => $defauts->tacitRenewal,
                'renewal_months' => $defauts->renewalMonths,
                'deposit_cap_months' => $defauts->depositCapMonths,
                'tenant_notice_months' => $defauts->tenantNoticeMonths,
                'landlord_notice_months' => $defauts->landlordNoticeMonths,
            ],
            'jurisdiction_data_fields' => $regime->fields,
        ];
    }
}
