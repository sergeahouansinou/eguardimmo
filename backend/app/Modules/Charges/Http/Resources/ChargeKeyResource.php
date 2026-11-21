<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Resources;

use App\Modules\Charges\Models\ChargeKey;
use App\Modules\Charges\Models\ChargeKeyShare;
use App\Modules\Charges\Models\ChargeKeyVersion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property ChargeKey $resource
 */
final class ChargeKeyResource extends JsonResource
{
    public static $wrap = 'data';

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $c = $this->resource;

        return [
            'id' => $c->id,
            'property_id' => $c->property_id,
            'label' => $c->label,
            'kind' => $c->kind->value,
            'archived' => $c->archived_at !== null,
            'lock_version' => $c->lock_version,
            'versions' => $c->versions->map(fn (ChargeKeyVersion $v): array => [
                'id' => $v->id,
                'valid_from' => $v->valid_from->toDateString(),
                'valid_to' => $v->valid_to?->toDateString(),
                'shares' => $v->shares->map(fn (ChargeKeyShare $s): array => ['unit_id' => $s->unit_id, 'weight' => $s->weight])->values()->all(),
            ])->values()->all(),
        ];
    }
}
