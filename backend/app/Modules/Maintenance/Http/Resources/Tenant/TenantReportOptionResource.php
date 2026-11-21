<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources\Tenant;

use App\Modules\Maintenance\Data\ReportOptionData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Jamais de mandant, de mandat, d'adresse ni de métadonnée de nature (responsabilité, imputation) : identifiants et libellés seulement.
 *
 * @property ReportOptionData $resource
 */
final class TenantReportOptionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $option = $this->resource;

        return [
            'lease_id' => $option->leaseId,
            'label' => $option->label,
            'units' => $option->units,
            'common_area_allowed' => $option->commonAreaAllowed,
            'natures' => $option->natures,
        ];
    }
}
