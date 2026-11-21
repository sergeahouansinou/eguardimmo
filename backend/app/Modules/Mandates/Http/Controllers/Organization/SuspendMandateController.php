<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\SuspendMandate;
use App\Modules\Mandates\Http\Requests\MandateVersionRequest;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;

final class SuspendMandateController
{
    public function __invoke(string $mandate, MandateVersionRequest $request, Mandates $mandats, SuspendMandate $suspendre, MandateViews $views): MandateResource
    {
        return new MandateResource($views->find($suspendre->handle($mandats->get($mandate), $request->lockVersion())->id));
    }
}
