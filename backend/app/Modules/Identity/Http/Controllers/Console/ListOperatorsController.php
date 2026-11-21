<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers\Console;

use App\Modules\Identity\Http\Resources\Console\OperatorResource;
use App\Modules\Identity\Queries\OperatorRoster;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListOperatorsController
{
    public function __invoke(OperatorRoster $equipe): AnonymousResourceCollection
    {
        return OperatorResource::collection($equipe->all());
    }
}
