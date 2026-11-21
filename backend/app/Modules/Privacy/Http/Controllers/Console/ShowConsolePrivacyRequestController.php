<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers\Console;

use App\Modules\Privacy\Http\Resources\Console\ConsolePrivacyRequestResource;
use App\Modules\Privacy\Queries\ConsoleRequestViews;
use App\Modules\Privacy\Queries\PrivacyRequests;

final class ShowConsolePrivacyRequestController
{
    public function __invoke(string $privacyRequest, PrivacyRequests $demandes, ConsoleRequestViews $vues): ConsolePrivacyRequestResource
    {
        return new ConsolePrivacyRequestResource($vues->one($demandes->find($privacyRequest), true));
    }
}
