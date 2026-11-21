<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Http\Resources\InterventionResource;
use App\Modules\Maintenance\Http\Support\Presenter;

final class ShowInterventionController
{
    public function __invoke(string $intervention, Presenter $presenter): InterventionResource
    {
        return $presenter->show($intervention);
    }
}
