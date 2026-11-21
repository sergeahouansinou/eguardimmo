<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\ArchiveMandate;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;

final class ArchiveMandateController
{
    public function __invoke(string $mandate, Mandates $mandats, ArchiveMandate $archiver, MandateViews $views): MandateResource
    {
        return new MandateResource($views->find($archiver->handle($mandats->get($mandate))->id));
    }
}
