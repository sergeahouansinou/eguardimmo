<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Planning\Actions\CancelEvent;
use App\Modules\Planning\Http\Resources\EventResource;
use App\Modules\Planning\Queries\Events;

final class CancelEventController
{
    public function __invoke(string $event, Events $evenements, CancelEvent $annuler): EventResource
    {
        return new EventResource($evenements->data($annuler->handle($evenements->get($event))));
    }
}
