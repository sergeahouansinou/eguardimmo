<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Planning\Http\Resources\EventResource;
use App\Modules\Planning\Queries\Events;

final class ShowEventController
{
    public function __invoke(string $event, Events $evenements): EventResource
    {
        return new EventResource($evenements->view($event));
    }
}
