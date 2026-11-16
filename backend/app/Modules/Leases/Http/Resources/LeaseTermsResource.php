<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Support\LeaseView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property LeaseView $resource
 */
final class LeaseTermsResource extends JsonResource
{
    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_map(
            fn ($terme): array => (new LeaseTermResource($terme, $this->resource))->toArray($request),
            $this->resource->terms,
        );
    }
}
