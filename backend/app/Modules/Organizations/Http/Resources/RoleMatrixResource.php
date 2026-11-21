<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Resources;

use App\Modules\Organizations\Data\RoleDomainData;
use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property list<RoleDomainData> $resource
 */
final class RoleMatrixResource extends JsonResource
{
    /**
     * @param  list<RoleDomainData>  $domaines
     */
    public function __construct(array $domaines, private readonly MemberRole $role)
    {
        parent::__construct($domaines);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'current_role' => $this->role->value,
            'domains' => array_map(fn (RoleDomainData $d): array => [
                'key' => $d->key,
                'levels' => array_map(fn ($niveau): string => $niveau->value, $d->levels),
                'two_factor' => $d->twoFactor(),
            ], $this->resource),
        ];
    }
}
