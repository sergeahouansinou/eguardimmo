<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources\Console;

use App\Modules\Notifications\Data\PlatformCampaignEstimate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property PlatformCampaignEstimate $resource
 */
final class PlatformCampaignEstimateResource extends JsonResource
{
    /**
     * @return array<string, int>
     */
    public function toArray(Request $request): array
    {
        return [
            'total' => $this->resource->total,
            'eligible' => $this->resource->eligible,
            'excluded_no_consent' => $this->resource->excludedNoConsent,
            'excluded_unreachable' => $this->resource->excludedUnreachable,
        ];
    }
}
