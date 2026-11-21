<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Planning\Actions\CreateEvent;
use App\Modules\Planning\Http\Requests\CreateEventRequest;
use App\Modules\Planning\Http\Resources\EventResource;
use App\Modules\Planning\Queries\Events;
use Illuminate\Http\JsonResponse;

final class CreateEventController
{
    public function __invoke(CreateEventRequest $request, CreateEvent $creer, Events $evenements): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return (new EventResource($evenements->data($creer->handle($user->id, $request->toData()))))->response()->setStatusCode(201);
    }
}
