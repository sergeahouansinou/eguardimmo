<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\ResumeMandate;
use App\Modules\Mandates\Http\Requests\MandateVersionRequest;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;

final class ResumeMandateController
{
    public function __invoke(string $mandate, MandateVersionRequest $request, Mandates $mandats, ResumeMandate $reprendre, MandateViews $views): MandateResource
    {
        return new MandateResource($views->find($reprendre->handle($mandats->get($mandate), $request->lockVersion())->id));
    }
}
