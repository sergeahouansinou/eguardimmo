<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Actions\DismissMandateEndRequest;
use App\Modules\Mandates\Http\Requests\DismissMandateEndRequestRequest;
use App\Modules\Mandates\Http\Resources\MandateEndRequestResource;
use App\Modules\Mandates\Queries\Mandates;

final class DismissMandateEndRequestController
{
    public function __invoke(string $mandate, DismissMandateEndRequestRequest $request, Mandates $mandats, DismissMandateEndRequest $rejeter): MandateEndRequestResource
    {
        /** @var User $user */
        $user = $request->user();

        return new MandateEndRequestResource($rejeter->handle($mandats->get($mandate)->id, $user->id, $request->note()));
    }
}
