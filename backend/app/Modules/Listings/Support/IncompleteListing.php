<?php

declare(strict_types=1);

namespace App\Modules\Listings\Support;

use App\Modules\Listings\Enums\ErrorCode;
use App\Modules\Listings\Models\Listing;
use App\Shared\Http\ApiProblem;

final class IncompleteListing
{
    public static function problem(Listing $annonce): ApiProblem
    {
        $base = ErrorCode::ListingIncomplete->problem();

        return new ApiProblem($base->problemCode, $base->status, $base->title, $base->getMessage(), extensions: ['missing' => $annonce->missingForPublication()]);
    }
}
