<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Http\Resources\AcquisitionResource;
use App\Modules\Investments\Queries\Loans;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;

final class ListAcquisitionsController
{
    public function __invoke(Request $requete, Loans $prets): AnonymousResourceCollection
    {
        $bien = $requete->query('property_id');

        return AcquisitionResource::collection($prets->acquisitions(is_string($bien) && Str::isUuid($bien) ? $bien : null));
    }
}
