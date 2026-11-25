<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Http\Resources\Console\PlatformCampaignResource;
use App\Modules\Notifications\Support\PlatformCampaignView;

final class ShowPlatformCampaignController
{
    public function __invoke(string $campaign, PlatformCampaignView $vue): PlatformCampaignResource
    {
        return new PlatformCampaignResource($vue->detail($campaign));
    }
}
