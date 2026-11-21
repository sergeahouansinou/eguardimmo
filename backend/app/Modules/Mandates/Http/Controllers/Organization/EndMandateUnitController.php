<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\EndMandateUnit;
use App\Modules\Mandates\Http\Requests\EndMandateUnitRequest;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;

final class EndMandateUnitController
{
    public function __invoke(string $mandate, string $mandateUnit, EndMandateUnitRequest $request, Mandates $mandats, EndMandateUnit $terminer, MandateViews $views): MandateResource
    {
        $courant = $mandats->get($mandate);
        $terminer->handle($courant, $mandateUnit, $request->toData());

        return new MandateResource($views->find($courant->id));
    }
}
