<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\RestoreMandate;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;

final class RestoreMandateController
{
    public function __invoke(string $mandate, Mandates $mandats, RestoreMandate $restaurer, MandateViews $views): MandateResource
    {
        return new MandateResource($views->find($restaurer->handle($mandats->get($mandate))->id));
    }
}
