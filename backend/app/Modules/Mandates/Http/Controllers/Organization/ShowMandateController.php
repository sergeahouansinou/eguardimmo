<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\MandateViews;

final class ShowMandateController
{
    public function __invoke(string $mandate, MandateViews $views): MandateResource
    {
        return new MandateResource($views->find($mandate));
    }
}
