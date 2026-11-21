<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\RemoveMandateUnit;
use App\Modules\Mandates\Http\Requests\MandateVersionRequest;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;

final class RemoveMandateUnitController
{
    public function __invoke(string $mandate, string $mandateUnit, MandateVersionRequest $request, Mandates $mandats, RemoveMandateUnit $retirer, MandateViews $views): MandateResource
    {
        $courant = $mandats->get($mandate);
        $retirer->handle($courant, $mandateUnit, $request->lockVersion());

        return new MandateResource($views->find($courant->id));
    }
}
