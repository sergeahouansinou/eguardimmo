<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Support\InsuranceOverview;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InsuranceOverview
 */
final class InsuranceOverviewResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'coverage' => ['state' => $this->coverage->state->value, 'ends_on' => $this->coverage->endsOn?->toDateString()],
            'submissions' => InsuranceSubmissionResource::collection($this->submissions)->resolve($request),
        ];
    }
}
