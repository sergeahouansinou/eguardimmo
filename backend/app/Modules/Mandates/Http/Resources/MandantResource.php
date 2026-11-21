<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources;

use App\Modules\Mandates\Data\MandantData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property MandantData $resource
 */
final class MandantResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'party_id' => $this->resource->partyId,
            'display_name' => $this->resource->displayName,
            'mandate_count' => $this->resource->mandateCount,
            'running_mandate_count' => $this->resource->runningMandateCount,
        ];
    }
}
