<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\ActivateMandate;
use App\Modules\Mandates\Http\Requests\ActivateMandateRequest;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;

final class ActivateMandateController
{
    public function __invoke(string $mandate, ActivateMandateRequest $request, Mandates $mandats, ActivateMandate $activer, MandateViews $views): MandateResource
    {
        return new MandateResource($views->find($activer->handle($mandats->get($mandate), $request->toData())->id));
    }
}
