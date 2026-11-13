<?php

declare(strict_types=1);

namespace App\Shared\Tenancy;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

final class AcrossOrganizations
{
    /**
     * @template TModel of Model
     *
     * @param  class-string<TModel>  $modele
     * @return Builder<TModel>
     */
    public static function query(string $modele): Builder
    {
        return $modele::query()->withoutGlobalScope(OrganizationScope::class);
    }
}
