<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Queries;

use App\Modules\Organizations\Models\Organization;
use Illuminate\Support\Str;

final readonly class OrganizationNames
{
    /**
     * @param  list<string>  $ids
     * @return array<string, string> nom par identifiant ; les identifiants inconnus sont absents
     */
    public function of(array $ids): array
    {
        $valides = array_values(array_unique(array_filter($ids, fn (string $id): bool => Str::isUuid($id))));

        if ($valides === []) {
            return [];
        }

        return Organization::query()->whereIn('id', $valides)->pluck('name', 'id')->all();
    }
}
