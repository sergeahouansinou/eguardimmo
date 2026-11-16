<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Http\Support\ApiShapes;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Support\LeaseView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property LeaseTerm $resource
 */
final class LeaseTermResource extends JsonResource
{
    public function __construct(LeaseTerm $terme, private readonly LeaseView $vue)
    {
        parent::__construct($terme);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $terme = $this->resource;
        $composante = $this->vue->components[$terme->component_term_id] ?? null;

        return [
            'id' => $terme->id,
            'component' => $composante === null ? ['id' => $terme->component_term_id] : ApiShapes::component($composante),
            'amount' => ApiShapes::money($terme->amount),
            'vat_bp' => $terme->vat_bp,
            'indexed' => $terme->indexed,
            'valid_from' => $terme->valid_from->toDateString(),
            'end_date' => ApiShapes::endDate($terme->valid_to),
            'in_force' => $this->vue->termIsInForce($terme),
            'reason' => $terme->reason->value,
            'replaces_id' => $terme->replaces_id,
        ];
    }
}
