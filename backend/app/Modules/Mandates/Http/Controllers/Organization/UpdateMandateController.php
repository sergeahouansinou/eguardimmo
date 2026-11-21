<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\UpdateMandate;
use App\Modules\Mandates\Http\Requests\UpdateMandateRequest;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;

final class UpdateMandateController
{
    public function __invoke(string $mandate, UpdateMandateRequest $request, Mandates $mandats, UpdateMandate $modifier, MandateViews $views): MandateResource
    {
        return new MandateResource($views->find($modifier->handle($mandats->get($mandate), $request->toData())->id));
    }
}
