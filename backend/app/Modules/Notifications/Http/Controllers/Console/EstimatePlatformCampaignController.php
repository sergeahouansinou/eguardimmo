<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Actions\EstimatePlatformCampaign;
use App\Modules\Notifications\Http\Resources\Console\PlatformCampaignEstimateResource;

final class EstimatePlatformCampaignController
{
    public function __invoke(string $campaign, EstimatePlatformCampaign $action): PlatformCampaignEstimateResource
    {
        return new PlatformCampaignEstimateResource($action->handle($campaign));
    }
}
