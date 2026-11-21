<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Resources;

use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Modules\Recovery\Support\ApiShapes;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property RecoveryBundle $resource
 */
final class BundleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $b = $this->resource;

        return [
            'id' => $b->id,
            'case_id' => $b->case_id,
            'number' => $b->number,
            'generated_on' => $b->generated_on->toDateString(),
            'size_bytes' => $b->size_bytes,
            'sha256' => $b->sha256,
            'total_due' => ApiShapes::money($b->total_due),
            'pieces' => $b->pieces,
            'statement' => $b->statement,
            'transmissions' => $this->whenLoaded('transmissions', fn (): array => $b->transmissions
                ->map(fn (RecoveryTransmission $t): array => (new TransmissionResource($t))->toArray($request))->all()),
        ];
    }
}
