<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Planning\Actions\UpdateEvent;
use App\Modules\Planning\Http\Requests\UpdateEventRequest;
use App\Modules\Planning\Http\Resources\EventResource;
use App\Modules\Planning\Queries\Events;

final class UpdateEventController
{
    public function __invoke(string $event, UpdateEventRequest $request, Events $evenements, UpdateEvent $modifier): EventResource
    {
        return new EventResource($evenements->data($modifier->handle($evenements->get($event), $request->toData())));
    }
}
