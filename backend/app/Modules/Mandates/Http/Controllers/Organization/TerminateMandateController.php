<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Actions\TerminateMandate;
use App\Modules\Mandates\Http\Requests\TerminateMandateRequest;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;

final class TerminateMandateController
{
    public function __invoke(string $mandate, TerminateMandateRequest $request, Mandates $mandats, TerminateMandate $resilier, MandateViews $views): MandateResource
    {
        /** @var User $user */
        $user = $request->user();

        return new MandateResource($views->find($resilier->handle($mandats->get($mandate), $request->toData(), $user->id)->id));
    }
}
