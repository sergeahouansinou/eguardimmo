<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\RenewMandate;
use App\Modules\Mandates\Http\Requests\RenewMandateRequest;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;

final class RenewMandateController
{
    public function __invoke(string $mandate, RenewMandateRequest $request, Mandates $mandats, RenewMandate $renouveler, MandateViews $views): MandateResource
    {
        return new MandateResource($views->find($renouveler->handle($mandats->get($mandate), $request->toData())->id));
    }
}
